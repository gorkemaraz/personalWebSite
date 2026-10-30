const escapeHtml = str => String(str).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[ch]));

// Başlıklara / tek satırlık alanlara girecek metinde satır sonu olmasın
const oneLine = str => String(str).replace(/[\r\n]+/g, " ").trim();

const clean = value => (typeof value === "string" ? value.trim() : "");

// Kaçışlı metinde **kalın** yazımı <strong>'a çevirir (başka HTML'e izin yok)
const inlineFormat = str => escapeHtml(str).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

module.exports = { escapeHtml, oneLine, clean, inlineFormat };
