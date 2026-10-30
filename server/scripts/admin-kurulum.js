#!/usr/bin/env node
// Yönetim paneli kurulumu: admin şifresi + Google Authenticator + oturum anahtarı.
//   node scripts/admin-kurulum.js               → tam kurulum
//   node scripts/admin-kurulum.js --sadece-sifre → sadece şifreyi değiştir
//   node scripts/admin-kurulum.js --oturumlari-kapat → tüm açık oturumları sonlandır

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const readline = require("node:readline");
const auth = require("../lib/auth");

const ENV_FILE = path.join(__dirname, "..", ".env");
const args = process.argv.slice(2);

function ask(question, { hidden = false } = {}) {
    return new Promise(resolve => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
        if (hidden) {
            rl._writeToOutput = str => {
                if (str.includes(question)) rl.output.write(str);
                else if (!/[\r\n]/.test(str)) rl.output.write("*");
            };
        }
        rl.question(question, answer => {
            rl.close();
            if (hidden) process.stdout.write("\n");
            resolve(answer.trim());
        });
    });
}

function updateEnv(values) {
    let lines = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/) : [];
    for (const [key, value] of Object.entries(values)) {
        const line = `${key}='${value}'`;
        const idx = lines.findIndex(l => l.startsWith(`${key}=`));
        if (idx >= 0) lines[idx] = line;
        else lines.push(line);
    }
    lines = lines.filter((l, i) => l !== "" || i < lines.length - 1);
    fs.writeFileSync(ENV_FILE, lines.join("\n") + "\n", { mode: 0o600 });
    fs.chmodSync(ENV_FILE, 0o600);
}

const newSessionSecret = () => crypto.randomBytes(32).toString("hex");

async function askPassword() {
    for (;;) {
        const pw = await ask("Yeni admin şifresi (en az 12 karakter): ", { hidden: true });
        if (pw.length < 12) { console.log("  Şifre en az 12 karakter olmalı.\n"); continue; }
        const again = await ask("Şifre tekrar: ", { hidden: true });
        if (pw !== again) { console.log("  Şifreler eşleşmedi.\n"); continue; }
        return auth.hashPassword(pw);
    }
}

async function main() {
    if (args.includes("--oturumlari-kapat")) {
        updateEnv({ SESSION_SECRET: newSessionSecret() });
        console.log("Tüm oturumlar kapatıldı. Panelden Node uygulamasını yeniden başlatın (Restart).");
        return;
    }

    if (args.includes("--sadece-sifre")) {
        updateEnv({ ADMIN_PASSWORD_HASH: await askPassword(), SESSION_SECRET: newSessionSecret() });
        console.log("\nŞifre değişti. Panelden Node uygulamasını yeniden başlatın (Restart).");
        return;
    }

    console.log("=== gorkemaraz.com yönetim paneli kurulumu ===\n");
    const hash = await askPassword();

    const secret = auth.newTotpSecret();
    const grouped = secret.match(/.{1,4}/g).join(" ");
    console.log("\nGoogle Authenticator (veya Microsoft Authenticator) uygulamasında:");
    console.log("  + → \"Kurulum anahtarı gir\"");
    console.log("  Hesap adı : gorkemaraz.com");
    console.log(`  Anahtar   : ${grouped}`);
    console.log("  Tür       : Zamana dayalı\n");
    console.log(`(Alternatif: otpauth://totp/gorkemaraz.com:admin?secret=${secret}&issuer=gorkemaraz.com)\n`);

    for (;;) {
        const code = (await ask("Uygulamada görünen 6 haneli kodu girin: ")).replace(/\s/g, "");
        if (auth.verifyTotp(secret, code)) break;
        console.log("  Kod eşleşmedi. Telefonun saatinin otomatik ayarlı olduğundan emin olup tekrar deneyin.\n");
    }

    updateEnv({ ADMIN_PASSWORD_HASH: hash, ADMIN_TOTP_SECRET: secret, SESSION_SECRET: newSessionSecret() });
    console.log("\n✓ Kurulum tamamlandı, bilgiler .env dosyasına yazıldı.");
    console.log("  Şimdi panelden Node uygulamasını yeniden başlatın (Restart).");
    console.log("  Panel adresi: https://gorkemaraz.com/admin");
}

main().catch(err => {
    console.error("Kurulum hatası:", err.message);
    process.exit(1);
});
