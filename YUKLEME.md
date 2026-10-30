# gorkemaraz.com — Sunucuya yükleme

Bu klasörün yapısı sunucudakiyle birebir aynıdır:

```
Bilgisayar (Desktop\gorkemaraz.com)     Sunucu (/home/gorkemar)
├── server/            ───────────────▶  server/        ← Node uygulaması (Application root)
│   ├── server.js                         │  + .env        ← şifreler, SADECE sunucuda
│   ├── lib/  admin/  templates/  scripts/
│   ├── data/content.json                 │  data/         ← panelin verisi (aşağıya bak!)
│   └── package.json, package-lock.json
└── public_html/       ───────────────▶  public_html/   ← herkese açık site
                                           └── .htaccess  ← panelin oluşturduğu dosya, SİLME
```

`server/` içindeki hiçbir dosya `public_html` içine konmaz.

---

## İlk kurulum (yönetim paneli)

1. **Dosyaları yükle**
   - `server/` klasörünün tüm içeriğini → sunucuda `/home/gorkemar/server/`
     (`node_modules` yüklenmez; sunucudaki `.env` dosyasına dokunulmaz)
   - `public_html/` içindeki dosyaları → sunucuda `/home/gorkemar/public_html/`
2. Panel → **Setup Node.js App** → **Run NPM Install** → **Restart**
3. **Admin hesabını oluştur** — cPanel **Terminal**:
   ```
   source /home/gorkemar/nodevenv/server/22/bin/activate && cd /home/gorkemar/server
   node scripts/admin-kurulum.js
   ```
   - Şifre sorulur (en az 12 karakter, yazarken görünmez).
   - Ekranda çıkan anahtarı Google Authenticator'a girin: **+ → Kurulum anahtarı gir**.
   - Uygulamadaki 6 haneli kodu girin; eşleşirse bilgiler `.env`'ye yazılır.
4. Panel → **Restart**
5. Giriş: **https://gorkemaraz.com/admin**

### Panel komutları (Terminal, aynı klasörde)
| Komut | Ne yapar |
|---|---|
| `node scripts/admin-kurulum.js --sadece-sifre` | Admin şifresini değiştirir (Authenticator aynı kalır) |
| `node scripts/admin-kurulum.js --oturumlari-kapat` | Açık tüm panel oturumlarını sonlandırır |
| `node scripts/admin-kurulum.js` | Her şeyi sıfırdan kurar (telefon kaybolursa) |

Her komuttan sonra panelden **Restart** yapın.

---

## ⚠️ Panel kurulduktan sonra güncelleme yaparken

- **`server/data/` klasörünü bir daha YÜKLEMEYİN.** Panelden yaptığınız değişiklikler,
  gelen mesajlar ve yedekler sunucudaki bu klasörde durur; bilgisayardaki eski kopya
  hepsinin üzerine yazar.
- **`public_html/index.html` ve `sitemap.xml` dosyalarını YÜKLEMEYİN.** Panel bunları
  her kayıtta yeniden üretir. Siteyi değiştirmek için paneli kullanın.
- `index.html`'i elle düzenlemek gerekirse (ör. menüye yeni bölüm) şablonu düzenleyin:
  `server/templates/index.html` → yükleyin → **Restart**.
- Sunucu her açılışta (Restart) `index.html`'i şablondan yeniden üretir ve `?v=`
  değerlerini `style.css` / `script.js` içeriğinden günceller. Yani kod, şablon,
  CSS veya JS değiştiğinde: yükle → **Restart**. Başka bir şey gerekmez.

---

## Kontrol listesi

- `https://gorkemaraz.com/server.js` ve `https://gorkemaraz.com/.env` → açılmamalı (404/403)
- `https://gorkemaraz.com/admin` → giriş ekranı
- Siteden test mesajı → Gmail'e gelmeli ve panelde **Mesajlar** sekmesinde görünmeli

## Önbellek

Sunucudaki `public_html/.htaccess` önbellek kuralları: `htaccess-onbellek-eklentisi.txt`
(dosyanın sonuna EKLENİR, mevcut satırlar silinmez — zaten eklendi).
