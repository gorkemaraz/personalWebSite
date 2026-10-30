# gorkemaraz.com

Kişisel web sitem ve onu yöneten, sıfırdan yazdığım içerik yönetim paneli.

**Canlı:** [gorkemaraz.com](https://gorkemaraz.com)

Site sade HTML/CSS/JS olarak yayınlanır; içerik ise bir Node.js panelinden düzenlenir.
Panelde kaydedilen her değişiklik sunucuda `index.html`'i şablondan yeniden üretir —
böylece site hızlı ve arama motoru dostu kalır, Node uygulaması dursa bile yayında olur.

## Özellikler

**Site**
- Tek sayfa, mobil uyumlu, framework'süz
- İletişim formu: sunucu tarafı doğrulama, bot tuzağı, IP başına hız sınırı
- Çerezsiz, anonim ziyaret sayacı (IP saklanmaz)
- SEO: Open Graph, yapılandırılmış veri (schema.org), sitemap

**Yönetim paneli** (`/admin`)
- Şemadan otomatik üretilen içerik düzenleyici: projeler, lisanslar, yetkinlikler, zaman çizelgesi…
- Her kayıttan önce otomatik yedek, tek tıkla geri yükleme
- İletişim formundan gelen mesajların arşivi (e-posta ulaşmasa bile saklanır)
- CV yükleme (PDF doğrulamalı)
- İstatistik: günlük ziyaretçi, kaynak siteler, cihaz dağılımı, CV indirme sayısı

## Güvenlik

- Giriş: **scrypt** ile özetlenmiş şifre + **TOTP** iki aşamalı doğrulama (RFC 6238, harici kütüphane yok); aynı kod tekrar kullanılamaz
- Oturum: HMAC imzalı, durumsuz çerez — `HttpOnly`, `Secure`, `SameSite=Strict`
- CSRF: durum değiştiren her istekte Origin kontrolü
- Kaba kuvvet koruması: IP başına ve toplam hatalı deneme sınırı
- Panel tarafında sıkı Content-Security-Policy; kullanıcıdan gelen metin hiçbir zaman HTML olarak basılmaz
- Sunucu tarafı şema doğrulaması: `javascript:` bağlantıları, geçersiz ikon adları, aşırı uzun alanlar reddedilir
- Şifreler yalnızca sunucudaki `.env` dosyasında; kod ve sır herkese açık klasörün dışında

## Teknolojiler

Node.js 22 · Express 5 · Nodemailer · vanilla JavaScript · HTML/CSS

Sunucu tarafında yalnızca üç bağımlılık var (`express`, `nodemailer`, `dotenv`);
şifreleme, TOTP ve oturum yönetimi Node'un yerleşik `crypto` modülüyle yazıldı.

## Yapı

```
server/                 Node uygulaması
├── server.js           giriş noktası
├── lib/
│   ├── admin.js        panel API'si ve erişim kontrolü
│   ├── auth.js         şifre, TOTP, oturum
│   ├── contact.js      iletişim formu
│   ├── render.js       içerik → index.html
│   ├── schema.js       içerik şeması ve doğrulama
│   ├── stats.js        anonim ziyaret sayacı
│   └── store.js        atomik dosya yazımı, yedekler, mesajlar
├── admin/              panel arayüzü
├── templates/          sayfa şablonu
├── data/content.json   site içeriği
└── scripts/            kurulum betiği (admin şifresi + Authenticator)
public_html/            yayınlanan site
```

## Yerelde çalıştırma

```bash
cd server
npm install
cp .env.example .env        # SMTP bilgilerini doldurun
node scripts/admin-kurulum.js
npm start                   # http://localhost:3000/admin
```

Sunucuya yükleme adımları: [YUKLEME.md](YUKLEME.md)
