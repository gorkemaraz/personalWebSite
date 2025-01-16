const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const nodemailer = require("nodemailer");

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Nodemailer transporter
const transporter = nodemailer.createTransport({
    host: "mail.gorkemaraz.com",
    port: 465, // Güvenli SMTP portu
    secure: true, // SSL kullanımı
    auth: {
        user: "info@gorkemaraz.com", // Kullanıcı adınız
        pass: "GorkemAraz65", // Şifreniz
    },
});

// POST /send-email endpoint
app.post("/send-email", (req, res) => {
    const { name, email, phone, subject, message } = req.body;

    const mailOptions = {
        from: `"${name}" <info@gorkemaraz.com>`, // Gönderen
        to: "gorkemaaraz@gmail.com", // Alıcı
        subject: subject || "Yeni İletişim Formu Mesajı", // Konu
        html: `
            <h1>İletişim Formu Mesajı</h1>
            <p><strong>Ad:</strong> ${name}</p>
            <p><strong>E-posta:</strong> ${email}</p>
            <p><strong>Telefon:</strong> ${phone}</p>
            <p><strong>Mesaj:</strong> ${message}</p>
        `, // HTML içeriği
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error("E-posta gönderimi başarısız:", error);
            return res.status(500).send("Mesaj gönderilirken bir hata oluştu.");
        }
        console.log("E-posta başarıyla gönderildi:", info.response);
        res.status(200).send("Mesajınız başarıyla gönderildi!");
    });
});

// Sunucu başlat
app.listen(PORT, () => {
    console.log(`Sunucu çalışıyor: http://localhost:${PORT}`);
});
