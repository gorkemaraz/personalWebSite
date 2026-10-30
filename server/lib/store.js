const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const DATA_DIR = path.join(__dirname, "..", "data");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const CONTENT_FILE = path.join(DATA_DIR, "content.json");
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");
const MAX_BACKUPS = 30;

async function readJson(file, fallback) {
    try {
        return JSON.parse(await fs.readFile(file, "utf8"));
    } catch (err) {
        if (err.code === "ENOENT") return fallback;
        throw err;
    }
}

// Önce geçici dosyaya yaz, sonra adını değiştir: yarım yazılmış dosya oluşmaz
async function writeAtomic(file, data) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${crypto.randomBytes(6).toString("hex")}.tmp`;
    await fs.writeFile(tmp, data);
    await fs.rename(tmp, file);
}

const writeJson = (file, value) => writeAtomic(file, JSON.stringify(value, null, 2) + "\n");

// ---------- İçerik ----------
const readContent = () => readJson(CONTENT_FILE, null);

async function saveContent(content) {
    const current = await readContent();
    if (current) await backupContent(current);
    await writeJson(CONTENT_FILE, content);
}

// ---------- Yedekler ----------
const BACKUP_RE = /^content-\d{8}-\d{6}-[a-f0-9]{4}\.json$/;

async function backupContent(content) {
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
    const name = `content-${stamp}-${crypto.randomBytes(2).toString("hex")}.json`;
    await writeJson(path.join(BACKUP_DIR, name), content);

    const names = (await listBackups()).map(b => b.name);
    for (const old of names.slice(MAX_BACKUPS)) {
        await fs.unlink(path.join(BACKUP_DIR, old)).catch(() => {});
    }
}

async function listBackups() {
    let names;
    try {
        names = await fs.readdir(BACKUP_DIR);
    } catch (err) {
        if (err.code === "ENOENT") return [];
        throw err;
    }
    const backups = [];
    for (const name of names.filter(n => BACKUP_RE.test(n))) {
        const { mtime } = await fs.stat(path.join(BACKUP_DIR, name));
        backups.push({ name, date: mtime.toISOString() });
    }
    return backups.sort((a, b) => b.date.localeCompare(a.date));
}

async function readBackup(name) {
    if (!BACKUP_RE.test(name)) return null; // dizin dışına çıkmayı engeller
    return readJson(path.join(BACKUP_DIR, name), null);
}

// ---------- Mesajlar ----------
const readMessages = () => readJson(MESSAGES_FILE, []);

async function addMessage(message) {
    const messages = await readMessages();
    const entry = { id: crypto.randomUUID(), date: new Date().toISOString(), read: false, ...message };
    messages.unshift(entry);
    await writeJson(MESSAGES_FILE, messages.slice(0, 1000));
    return entry;
}

async function updateMessage(id, changes) {
    const messages = await readMessages();
    const msg = messages.find(m => m.id === id);
    if (!msg) return false;
    Object.assign(msg, changes);
    await writeJson(MESSAGES_FILE, messages);
    return true;
}

async function deleteMessage(id) {
    const messages = await readMessages();
    const rest = messages.filter(m => m.id !== id);
    if (rest.length === messages.length) return false;
    await writeJson(MESSAGES_FILE, rest);
    return true;
}

module.exports = {
    readJson, writeJson, writeAtomic,
    readContent, saveContent,
    listBackups, readBackup,
    readMessages, addMessage, updateMessage, deleteMessage,
};
