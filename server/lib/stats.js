// Çerezsiz, anonim ziyaret istatistiği.
// - IP adresi hiçbir yere yazılmaz. Aynı kişiyi gün içinde bir kez saymak için
//   (günlük rastgele anahtar + IP + tarayıcı) özetinin kısa bir parçası tutulur;
//   gün değişince anahtar ve özetler silinir, ertesi gün kimse tanınamaz.
// - Kalıcı olarak yalnızca günlük toplamlar saklanır.

const express = require("express");
const crypto = require("node:crypto");
const path = require("node:path");
const { readJson, writeJson } = require("./store");

const DATA_DIR = path.join(__dirname, "..", "data");
const STATS_FILE = path.join(DATA_DIR, "stats.json");
const TODAY_FILE = path.join(DATA_DIR, "stats-today.json");
const KEEP_DAYS = 400;
const SITE_HOST = "gorkemaraz.com";

const BOT_RE = /bot|crawl|spider|slurp|headless|lighthouse|preview|fetch|curl|wget|python|java\/|go-http|axios|node|monitor|uptime/i;

const dayKey = (date = new Date()) => date.toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });

function deviceOf(ua) {
    if (/iPad|Tablet/i.test(ua)) return "Tablet";
    if (/Mobi|Android|iPhone/i.test(ua)) return "Mobil";
    return "Masaüstü";
}

const REF_NAMES = [
    [/(^|\.)google\./, "Google"],
    [/(^|\.)bing\.com$/, "Bing"],
    [/(^|\.)yandex\./, "Yandex"],
    [/(^|\.)duckduckgo\.com$/, "DuckDuckGo"],
    [/(^|\.)linkedin\.com$|^lnkd\.in$/, "LinkedIn"],
    [/(^|\.)github\.com$/, "GitHub"],
    [/^t\.co$|(^|\.)twitter\.com$|(^|\.)x\.com$/, "X (Twitter)"],
    [/(^|\.)instagram\.com$/, "Instagram"],
    [/(^|\.)whatsapp\.(com|net)$|^wa\.me$/, "WhatsApp"],
    [/(^|\.)facebook\.com$/, "Facebook"],
];

function referrerName(ref) {
    if (!ref) return "Doğrudan";
    let host;
    try {
        host = new URL(ref).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
        return "Doğrudan";
    }
    if (host === SITE_HOST || host.endsWith(`.${SITE_HOST}`)) return null; // site içi gezinti
    for (const [re, name] of REF_NAMES) if (re.test(host)) return name;
    return host.slice(0, 60);
}

// ---------- Yazma kuyruğu: aynı süreçte eşzamanlı yazmalar çakışmasın ----------
let queue = Promise.resolve();
const serial = fn => (queue = queue.then(fn, fn));

async function record(type, ip, ua, ref) {
    const today = dayKey();

    let todayState = await readJson(TODAY_FILE, null);
    if (!todayState || todayState.date !== today) {
        todayState = { date: today, salt: crypto.randomBytes(16).toString("hex"), seen: [] };
    }
    const visitor = crypto.createHash("sha256").update(`${todayState.salt}|${ip}|${ua}`).digest("hex").slice(0, 16);

    const stats = await readJson(STATS_FILE, { days: {} });
    const day = (stats.days[today] ||= { views: 0, visitors: 0, cv: 0, refs: {}, devices: {} });

    if (type === "cv") {
        day.cv++;
    } else {
        day.views++;
        if (!todayState.seen.includes(visitor)) {
            todayState.seen.push(visitor);
            day.visitors++;
            day.devices[deviceOf(ua)] = (day.devices[deviceOf(ua)] || 0) + 1;
            const name = referrerName(ref);
            if (name) day.refs[name] = (day.refs[name] || 0) + 1;
        }
    }

    // Eski günleri at
    const keys = Object.keys(stats.days).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - KEEP_DAYS))) delete stats.days[k];

    await writeJson(TODAY_FILE, todayState);
    await writeJson(STATS_FILE, stats);
}

// ---------- Kötüye kullanım sınırı: aynı kaynaktan dakikada en fazla 20 kayıt ----------
const recent = new Map();
function tooMany(key) {
    const now = Date.now();
    const list = (recent.get(key) || []).filter(t => now - t < 60_000);
    list.push(now);
    recent.set(key, list);
    return list.length > 20;
}
setInterval(() => {
    const now = Date.now();
    for (const [k, list] of recent) if (list.every(t => now - t >= 60_000)) recent.delete(k);
}, 60_000).unref();

const router = express.Router();

// Tarayıcı sendBeacon ile text/plain gönderir
router.post("/ziyaret", express.json({ limit: "1kb", type: ["application/json", "text/plain"] }), (req, res) => {
    res.status(204).end(); // ziyaretçiyi bekletme

    const ua = String(req.get("user-agent") || "").slice(0, 300);
    const type = req.body?.t === "cv" ? "cv" : "view";
    if (!ua || BOT_RE.test(ua)) return;
    // İstek sitenin kendisinden gelmeli
    const origin = req.get("origin");
    try {
        if (origin && new URL(origin).host !== req.get("host")) return;
    } catch {
        return;
    }
    if (tooMany(`${req.ip}|${ua}`)) return;

    const ref = typeof req.body?.r === "string" ? req.body.r.slice(0, 500) : "";
    serial(() => record(type, req.ip, ua, ref)).catch(err => console.error("İstatistik kaydedilemedi:", err.message));
});

// ---------- Panel için özet ----------
async function summary(rangeDays, messages) {
    const stats = await readJson(STATS_FILE, { days: {} });
    const days = [];
    const refs = {};
    const devices = {};
    const totals = { views: 0, visitors: 0, cv: 0, messages: 0 };

    const start = new Date();
    start.setDate(start.getDate() - (rangeDays - 1));
    for (let i = 0; i < rangeDays; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const key = dayKey(d);
        const s = stats.days[key] || {};
        days.push({ date: key, views: s.views || 0, visitors: s.visitors || 0, cv: s.cv || 0 });
        totals.views += s.views || 0;
        totals.visitors += s.visitors || 0;
        totals.cv += s.cv || 0;
        for (const [k, v] of Object.entries(s.refs || {})) refs[k] = (refs[k] || 0) + v;
        for (const [k, v] of Object.entries(s.devices || {})) devices[k] = (devices[k] || 0) + v;
    }

    const first = days[0].date;
    totals.messages = messages.filter(m => dayKey(new Date(m.date)) >= first).length;

    const sorted = obj => Object.entries(obj).map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n);
    return { days, totals, refs: sorted(refs), devices: sorted(devices) };
}

module.exports = { router, summary };
