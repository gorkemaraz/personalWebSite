const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const xlsx = require('xlsx');
const path = require('path');
const https = require('https');

const app = express();
const PORT = 8080; // HTTPS portu
const options = {
    key: fs.readFileSync('/home/gorkemar/ssl/keys/be205_2c3f5_f1b8d9bd85ad610ac7121e3c490b2806.key'),
    cert: fs.readFileSync('/home/gorkemar/ssl/certs/certificate.crt')
};

// Middleware
app.use(bodyParser.json());
app.use(express.static('/home/gorkemar/public_html')); // Static dosyalar için

// HTTPS Server
https.createServer(options, app).listen(PORT, () => {
    console.log(`HTTPS Server is running on https://localhost:${PORT}`);
});

// Endpoint to handle form submission
app.post('/submit-form', (req, res) => {
    const { name, email, phone, subject, message } = req.body;

    if (!name || !email || !phone || !subject || !message) {
        return res.status(400).json({ error: 'All fields are required!' });
    }

    // Save data to .txt
    const entry = `Name: ${name}, Email: ${email}, Phone: ${phone}, Subject: ${subject}, Message: ${message}\n`;
    fs.appendFile('form_data.txt', entry, (err) => {
        if (err) {
            console.error('Error saving to .txt:', err);
            return res.status(500).json({ error: 'Failed to save data.' });
        }

        // Save data to .xlsx
        const filePath = path.join(__dirname, 'form_data.xlsx');
        let workbook, sheet;

        if (fs.existsSync(filePath)) {
            workbook = xlsx.readFile(filePath);
            sheet = workbook.Sheets[workbook.SheetNames[0]];
        } else {
            workbook = xlsx.utils.book_new();
            sheet = xlsx.utils.aoa_to_sheet([['Name', 'Email', 'Phone', 'Subject', 'Message']]);
            xlsx.utils.book_append_sheet(workbook, sheet, 'FormData');
        }

        const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        rows.push([name, email, phone, subject, message]);
        workbook.Sheets[workbook.SheetNames[0]] = xlsx.utils.aoa_to_sheet(rows);
        xlsx.writeFile(workbook, filePath);

        res.status(200).json({ message: 'Form data saved successfully!' });
    });
});
