require("dotenv").config({ quiet: true });

const { SMTP_HOST, SMTP_USER, SMTP_PASS, MAIL_TO } = process.env;
if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !MAIL_TO) {
    console.error("Eksik ortam değişkeni: SMTP_HOST, SMTP_USER, SMTP_PASS ve MAIL_TO tanımlı olmalı (.env veya panel).");
    process.exit(1);
}

const express = require("express");
const contact = require("./lib/contact");
const stats = require("./lib/stats");
const admin = require("./lib/admin");

const app = express();
const PORT = process.env.PORT || 3000;

// Apache/LiteSpeed arkasında gerçek ziyaretçi IP'sini almak için
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(contact);          // POST /send-email
app.use(stats.router);     // POST /ziyaret (anonim sayaç)
app.use("/admin", admin);  // yönetim paneli

// Bozuk JSON vb. hatalarda düz metin dön
app.use((err, req, res, next) => {
    if (!err.status || err.status >= 500) console.error(err);
    res.status(err.status || 400).send("Geçersiz istek.");
});

app.listen(PORT, () => {
    console.log(`Sunucu çalışıyor: http://localhost:${PORT}`);
});

// Açılışta sayfayı yeniden üret: şablon veya style.css/script.js güncellendiyse
// index.html ve ?v= değerleri Restart sonrası kendiliğinden güncellenir.
(async () => {
    const { readContent } = require("./lib/store");
    const { publish } = require("./lib/render");
    const { schema, normalize } = require("./lib/schema");
    const content = await readContent();
    if (content) await publish(normalize(schema, content));
})().catch(err => console.error("Açılışta sayfa üretilemedi:", err.message));
