const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const cors = require('cors');  // CORS paketini dahil ettik

const app = express();
const PORT = 3000;

// CORS'u aktif hale getirmek ve seçenekleri özelleştirmek
const corsOptions = {
  origin: '*',  // Tüm origin'lere izin verir (geliştirme aşamasında genelde sorun çıkarmaz)
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type'],  // Hangi başlıkların geçerli olduğuna karar verir
};

app.use(cors(corsOptions));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// POST route for form submission
app.post('/submit-form', (req, res) => {
    const { name, email, phone, subject, message } = req.body;

    // Form data validation (optional)
    if (!name || !email || !message) {
        return res.status(400).send('Lütfen tüm gerekli alanları doldurun!');
    }

    // Save form data to a file
    const formData = `Ad: ${name}\nE-posta: ${email}\nTelefon: ${phone}\nKonu: ${subject}\nMesaj: ${message}\n\n`;
    fs.appendFile('form-data.txt', formData, (err) => {
        if (err) {
            console.error('Hata:', err);
            return res.status(500).send('Form verileri kaydedilemedi.');
        }

        console.log('Form verileri kaydedildi.');
        res.send('Form başarıyla gönderildi!');
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Sunucu çalışıyor: http://localhost:${PORT}`);
});
