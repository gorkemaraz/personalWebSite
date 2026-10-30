const express = require("express");
const nodemailer = require("nodemailer");
const { escapeHtml, oneLine, clean } = require("./util");
const { addMessage } = require("./store");

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_TO } = process.env;

const smtpPort = Number(SMTP_PORT) || 465;
const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: smtpPort,
    secure: smtpPort === 465, // 465 = SSL
    auth: { user: SMTP_USER, pass: SMTP_PASS },
});

// ---------- Basit hız sınırı: IP başına 15 dakikada 5 mesaj ----------
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map();

function isRateLimited(ip) {
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
    recent.push(now);
    hits.set(ip, recent);
    return recent.length > MAX_PER_WINDOW;
}

// Bellek şişmesin diye eski kayıtları temizle
setInterval(() => {
    const now = Date.now();
    for (const [ip, times] of hits) {
        if (times.every(t => now - t >= WINDOW_MS)) hits.delete(ip);
    }
}, WINDOW_MS).unref();

const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/;

function validate(body) {
    const data = {
        name: oneLine(clean(body.name)),
        email: oneLine(clean(body.email)),
        phone: oneLine(clean(body.phone)),
        subject: oneLine(clean(body.subject)),
        message: clean(body.message),
    };

    if (!data.name || data.name.length > 80) return { error: "Lütfen adınızı girin." };
    if (!EMAIL_RE.test(data.email) || data.email.length > 120) return { error: "Lütfen geçerli bir e-posta adresi girin." };
    if (data.phone.length > 20) return { error: "Telefon numarası çok uzun." };
    if (data.subject.length > 120) return { error: "Konu çok uzun." };
    if (data.message.length < 10 || data.message.length > 3000) return { error: "Mesaj 10 ile 3000 karakter arasında olmalı." };

    return { data };
}

function sendMail({ name, email, phone, subject, message }) {
    const safe = Object.fromEntries(Object.entries({ name, email, phone, subject, message }).map(([k, v]) => [k, escapeHtml(v)]));
    return transporter.sendMail({
        from: `"gorkemaraz.com İletişim Formu" <${SMTP_USER}>`,
        to: MAIL_TO,
        replyTo: { name, address: email }, // "Yanıtla" deyince doğrudan ziyaretçiye gider
        subject: subject ? `[Site] ${subject}` : `[Site] ${name} size mesaj gönderdi`,
        text: `Ad: ${name}\nE-posta: ${email}\nTelefon: ${phone || "-"}\nKonu: ${subject || "-"}\n\n${message}`,
        html: `
            <h2>İletişim Formu Mesajı</h2>
            <p><strong>Ad:</strong> ${safe.name}</p>
            <p><strong>E-posta:</strong> ${safe.email}</p>
            <p><strong>Telefon:</strong> ${safe.phone || "-"}</p>
            <p><strong>Konu:</strong> ${safe.subject || "-"}</p>
            <p><strong>Mesaj:</strong></p>
            <p style="white-space:pre-wrap">${safe.message}</p>
        `,
    });
}

const router = express.Router();

router.post("/send-email", express.json({ limit: "16kb" }), async (req, res) => {
    const body = req.body || {};

    // Bot tuzağı doluysa sessizce başarılı dön
    if (clean(body.website)) {
        return res.status(200).send("Mesajınız başarıyla gönderildi!");
    }

    if (isRateLimited(req.ip)) {
        return res.status(429).send("Çok fazla mesaj gönderildi. Lütfen daha sonra tekrar deneyin.");
    }

    const { data, error } = validate(body);
    if (error) {
        return res.status(400).send(error);
    }

    // Önce kaydet: e-posta gitmese bile mesaj panelde görünür
    let saved = false;
    try {
        await addMessage(data);
        saved = true;
    } catch (err) {
        console.error("Mesaj kaydedilemedi:", err.message);
    }

    try {
        await sendMail(data);
    } catch (err) {
        console.error("E-posta gönderimi başarısız:", err.message);
        if (!saved) return res.status(500).send("Mesaj gönderilirken bir hata oluştu.");
    }
    res.status(200).send("Mesajınız başarıyla gönderildi!");
});

module.exports = router;
