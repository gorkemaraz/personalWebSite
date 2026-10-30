const crypto = require("node:crypto");
const { promisify } = require("node:util");

const scrypt = promisify(crypto.scrypt);

// ---------- Şifre (scrypt) ----------
async function hashPassword(password) {
    const salt = crypto.randomBytes(16);
    const key = await scrypt(password, salt, 64);
    return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

async function verifyPassword(password, stored) {
    const [scheme, saltHex, keyHex] = String(stored).split("$");
    if (scheme !== "scrypt" || !saltHex || !keyHex) return false;
    const expected = Buffer.from(keyHex, "hex");
    const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
    return crypto.timingSafeEqual(actual, expected);
}

// ---------- TOTP (Google Authenticator, RFC 6238) ----------
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf) {
    let bits = "", out = "";
    for (const byte of buf) bits += byte.toString(2).padStart(8, "0");
    for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)];
    return out;
}

function base32Decode(str) {
    let bits = "";
    for (const ch of str.toUpperCase().replace(/[\s=]/g, "")) {
        const idx = B32.indexOf(ch);
        if (idx === -1) throw new Error("Geçersiz base32");
        bits += idx.toString(2).padStart(5, "0");
    }
    const bytes = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
    return Buffer.from(bytes);
}

const newTotpSecret = () => base32Encode(crypto.randomBytes(20));

function totpAt(secret, counter) {
    const msg = Buffer.alloc(8);
    msg.writeBigUInt64BE(BigInt(counter));
    const hmac = crypto.createHmac("sha1", base32Decode(secret)).update(msg).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const num = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
    return String(num).padStart(6, "0");
}

let lastUsedCounter = -1; // aynı kodun ikinci kez kullanılmasını engeller

// Saat kaymasına karşı bir önceki / sonraki 30 sn'lik kod da kabul edilir
function verifyTotp(secret, code) {
    if (!/^\d{6}$/.test(String(code))) return false;
    const now = Math.floor(Date.now() / 30000);
    for (const counter of [now - 1, now, now + 1]) {
        const expected = Buffer.from(totpAt(secret, counter));
        if (counter > lastUsedCounter && crypto.timingSafeEqual(expected, Buffer.from(String(code)))) {
            lastUsedCounter = counter;
            return true;
        }
    }
    return false;
}

// ---------- Oturum: imzalı, durumsuz çerez ----------
// Sunucu belleğine bağlı değil; uygulama yeniden başlasa da birden çok süreçte de çalışır.
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 saat
const COOKIE = "ga_admin";

const sign = (data, secret) => crypto.createHmac("sha256", secret).update(data).digest("base64url");

function createSession(secret) {
    const payload = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_TTL_MS })).toString("base64url");
    return `${payload}.${sign(payload, secret)}`;
}

function verifySession(token, secret) {
    const [payload, sig] = String(token || "").split(".");
    if (!payload || !sig) return false;
    const expected = Buffer.from(sign(payload, secret));
    const given = Buffer.from(sig);
    if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return false;
    try {
        return JSON.parse(Buffer.from(payload, "base64url").toString()).exp > Date.now();
    } catch {
        return false;
    }
}

function readCookie(req, name) {
    for (const part of (req.headers.cookie || "").split(";")) {
        const [k, ...v] = part.trim().split("=");
        if (k === name) return decodeURIComponent(v.join("="));
    }
    return null;
}

const cookieOptions = maxAge =>
    `Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.floor(maxAge / 1000)}`;

const setSessionCookie = (res, token) => res.setHeader("Set-Cookie", `${COOKIE}=${token}; ${cookieOptions(SESSION_TTL_MS)}`);
const clearSessionCookie = res => res.setHeader("Set-Cookie", `${COOKIE}=; ${cookieOptions(0)}`);
const isLoggedIn = (req, secret) => verifySession(readCookie(req, COOKIE), secret);

module.exports = {
    hashPassword, verifyPassword,
    newTotpSecret, verifyTotp, totpAt,
    createSession, setSessionCookie, clearSessionCookie, isLoggedIn,
};
