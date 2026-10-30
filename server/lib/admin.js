const express = require("express");
const path = require("node:path");
const fs = require("node:fs/promises");
const auth = require("./auth");
const store = require("./store");
const { schema, normalize, ValidationError } = require("./schema");
const { publish, PUBLIC_DIR } = require("./render");
const stats = require("./stats");

const { ADMIN_PASSWORD_HASH, ADMIN_TOTP_SECRET, SESSION_SECRET } = process.env;
const ADMIN_DIR = path.join(__dirname, "..", "admin");
const CV_FILE = path.join(PUBLIC_DIR, "cv", "gorkem-araz-cv.pdf");
const CV_PREVIOUS = path.join(__dirname, "..", "data", "cv-onceki.pdf"); // herkese açık klasörün dışında

const router = express.Router();

// Panel hiçbir koşulda arama motorlarına girmesin ve önbelleğe alınmasın
router.use((req, res, next) => {
    res.set({
        "X-Robots-Tag": "noindex, nofollow",
        "Cache-Control": "no-store",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "same-origin",
        "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    });
    next();
});

// Panel ayarlanmamışsa hiç açılmasın
router.use((req, res, next) => {
    if (!ADMIN_PASSWORD_HASH || !ADMIN_TOTP_SECRET || !SESSION_SECRET || SESSION_SECRET.length < 32) {
        return res.status(503).type("text").send("Panel henüz kurulmadı. Sunucuda: node scripts/admin-kurulum.js");
    }
    next();
});

// ---------- Sahte istek koruması ----------
// Durum değiştiren her istek aynı siteden gelmeli (Origin kontrolü + SameSite=Strict çerez)
function sameOrigin(req, res, next) {
    if (["GET", "HEAD"].includes(req.method)) return next();
    const origin = req.get("origin");
    try {
        if (origin && new URL(origin).host === req.get("host")) return next();
    } catch { /* geçersiz Origin */ }
    res.status(403).json({ error: "Geçersiz istek kaynağı." });
}

// Sayfalar giriş ekranına yönlendirir, API 401 döner (panel bunu görünce girişe atar)
function requireLoginPage(req, res, next) {
    if (auth.isLoggedIn(req, SESSION_SECRET)) return next();
    res.redirect("/admin/login");
}

function requireLoginApi(req, res, next) {
    if (auth.isLoggedIn(req, SESSION_SECRET)) return next();
    res.status(401).json({ error: "Oturum süresi doldu, tekrar giriş yapın." });
}

// ---------- Giriş denemesi sınırı ----------
const FAIL_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS_PER_IP = 5;
const MAX_FAILS_TOTAL = 20; // tüm IP'ler toplamı: dağıtık denemelere karşı
const failures = new Map();
let totalFailures = [];

function tooManyFailures(ip) {
    const now = Date.now();
    totalFailures = totalFailures.filter(t => now - t < FAIL_WINDOW_MS);
    const mine = (failures.get(ip) || []).filter(t => now - t < FAIL_WINDOW_MS);
    failures.set(ip, mine);
    return mine.length >= MAX_FAILS_PER_IP || totalFailures.length >= MAX_FAILS_TOTAL;
}

function recordFailure(ip) {
    const now = Date.now();
    failures.set(ip, [...(failures.get(ip) || []), now]);
    totalFailures.push(now);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- Sayfalar ve statik dosyalar ----------
router.use("/static", express.static(path.join(ADMIN_DIR, "static"), { maxAge: 0 }));

router.get("/login", (req, res) => {
    if (auth.isLoggedIn(req, SESSION_SECRET)) return res.redirect("/admin/");
    res.sendFile(path.join(ADMIN_DIR, "login.html"));
});

router.get("/", requireLoginPage, (req, res) => res.sendFile(path.join(ADMIN_DIR, "index.html")));

// ---------- API ----------
const api = express.Router();
api.use(sameOrigin);

api.post("/login", express.json({ limit: "2kb" }), async (req, res) => {
    if (tooManyFailures(req.ip)) {
        return res.status(429).json({ error: "Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin." });
    }
    const { password, code } = req.body || {};
    const passOk = typeof password === "string" && password.length <= 200 &&
        await auth.verifyPassword(password, ADMIN_PASSWORD_HASH);
    const codeOk = passOk && auth.verifyTotp(ADMIN_TOTP_SECRET, String(code || "").replace(/\s/g, ""));

    if (!passOk || !codeOk) {
        recordFailure(req.ip);
        await sleep(800); // kaba kuvvet denemelerini yavaşlat
        return res.status(401).json({ error: "Şifre veya doğrulama kodu hatalı." });
    }
    failures.delete(req.ip);
    auth.setSessionCookie(res, auth.createSession(SESSION_SECRET));
    res.json({ ok: true });
});

api.post("/logout", (req, res) => {
    auth.clearSessionCookie(res);
    res.json({ ok: true });
});

api.use(requireLoginApi);

api.get("/schema", (req, res) => res.json(schema));

api.get("/content", async (req, res) => res.json(await store.readContent()));

api.put("/content", express.json({ limit: "200kb" }), async (req, res) => {
    let content;
    try {
        content = normalize(schema, req.body);
    } catch (err) {
        if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
        throw err;
    }
    await store.saveContent(content);
    await publish(content);
    res.json({ ok: true, content });
});

api.get("/backups", async (req, res) => res.json(await store.listBackups()));

api.post("/backups/:name/restore", async (req, res) => {
    const backup = await store.readBackup(req.params.name);
    if (!backup) return res.status(404).json({ error: "Yedek bulunamadı." });
    const content = normalize(schema, backup);
    await store.saveContent(content); // mevcut hâl de yedeklenir, geri dönüş mümkün
    await publish(content);
    res.json({ ok: true, content });
});

api.get("/messages", async (req, res) => res.json(await store.readMessages()));

api.get("/stats", async (req, res) => {
    const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
    res.json(await stats.summary(days, await store.readMessages()));
});

api.patch("/messages/:id", express.json({ limit: "1kb" }), async (req, res) => {
    const ok = await store.updateMessage(req.params.id, { read: req.body?.read === true });
    res.status(ok ? 200 : 404).json(ok ? { ok } : { error: "Mesaj bulunamadı." });
});

api.delete("/messages/:id", async (req, res) => {
    const ok = await store.deleteMessage(req.params.id);
    res.status(ok ? 200 : 404).json(ok ? { ok } : { error: "Mesaj bulunamadı." });
});

api.get("/cv", async (req, res) => {
    try {
        const { size, mtime } = await fs.stat(CV_FILE);
        res.json({ exists: true, size, date: mtime.toISOString() });
    } catch {
        res.json({ exists: false });
    }
});

api.put("/cv", express.raw({ type: "application/pdf", limit: "5mb" }), async (req, res) => {
    const buf = req.body;
    if (!Buffer.isBuffer(buf) || buf.length < 100 || buf.subarray(0, 5).toString("latin1") !== "%PDF-") {
        return res.status(400).json({ error: "Sadece PDF dosyası yüklenebilir (en fazla 5 MB)." });
    }
    await fs.mkdir(path.dirname(CV_FILE), { recursive: true });
    await fs.copyFile(CV_FILE, CV_PREVIOUS).catch(() => {}); // bir önceki CV'yi sakla
    await store.writeAtomic(CV_FILE, buf);
    res.json({ ok: true, size: buf.length });
});

api.use((err, req, res, next) => {
    if (err.type === "entity.too.large") return res.status(413).json({ error: "Dosya veya veri çok büyük." });
    console.error("Panel hatası:", err);
    res.status(500).json({ error: "Beklenmeyen bir hata oluştu." });
});

router.use("/api", api);

module.exports = router;
