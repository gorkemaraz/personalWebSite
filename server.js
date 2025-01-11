require('dotenv').config();
const fs = require('fs');
const https = require('https');
const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const app = express();
const PORT = 443; // HTTPS için 443 portunu kullanıyoruz

// Sertifika ve Anahtar Dosyalarını Yükle
const options = {
    key: fs.readFileSync('/home/gorkemar/ssl/keys/privatekey.key'),   // Private key dosyasının yolu
    cert: fs.readFileSync('/home/gorkemar/ssl/certs/certificate.crt'),  // Sertifika dosyasının yolu
};

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files (if necessary)
app.use(express.static('public'));

// Endpoint for handling form submissions
app.post('/api/messages', async (req, res) => {
    const { name, email, phone, subject, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).send('Lütfen gerekli tüm alanları doldurun.');
    }

    try {
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        // Email content
        const mailOptions = {
            from: `"${name}" <${email}>`, // Sender
            to: 'info@gorkemaraz.com', // Recipient
            subject: subject || 'Yeni İletişim Formu Mesajı',
            text: `Ad: ${name}\nE-posta: ${email}\nTelefon: ${phone || 'Belirtilmedi'}\n\nMesaj:\n${message}`,
        };

        // Send email
        await transporter.sendMail(mailOptions);

        res.status(200).send('Mesaj başarıyla gönderildi.');
    } catch (error) {
        console.error('E-posta gönderim hatası:', error);
        res.status(500).send('Mesaj gönderilirken bir hata oluştu.');
    }
});

// HTTPS Sunucusunu Başlat
https.createServer(options, app).listen(PORT, () => {
    console.log(`Server is running at https://localhost:${PORT}`);
});
