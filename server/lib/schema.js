// Panelde düzenlenebilen içeriğin tanımı. Hem sunucu doğrulaması hem de
// paneldeki form bu şemadan üretilir.

const ICON_HINT = "Boxicons adı, ör. bx-server, bx-line-chart, bxl-github (boxicons.com)";

const text = (key, label, max, extra = {}) => ({ key, label, type: "text", max, ...extra });
const area = (key, label, max, extra = {}) => ({ key, label, type: "textarea", max, ...extra });
const icon = (key = "icon", label = "İkon") => ({ key, label, type: "icon", max: 40, hint: ICON_HINT });
const tags = (key, label) => ({ key, label, type: "tags", max: 30, maxItems: 20, hint: "Virgülle ayırın" });

const schema = {
    type: "object",
    fields: [
        {
            key: "meta", label: "Genel (Google ve sosyal medya)", type: "object",
            fields: [
                text("title", "Sayfa başlığı", 70),
                area("description", "Google açıklaması", 170, { hint: "Arama sonuçlarında görünen metin (en fazla ~160 karakter)" }),
            ],
        },
        {
            key: "hero", label: "Giriş", type: "object",
            fields: [
                text("badge", "Rozet", 60, { optional: true }),
                text("name", "İsim", 60),
                { key: "phrases", label: "Kayan slogan", type: "list", minItems: 1, maxItems: 5, item: { type: "text", max: 60 } },
                area("intro", "Tanıtım paragrafı", 600),
            ],
        },
        {
            key: "about", label: "Hakkımda", type: "object",
            fields: [
                area("lead", "Giriş metni", 600),
                {
                    key: "stats", label: "Kutucuklar", type: "list", maxItems: 4, itemLabel: "value",
                    item: { type: "object", fields: [text("value", "Değer", 12), text("label", "Açıklama", 40)] },
                },
                {
                    key: "focus", label: "Odak kartları", type: "list", maxItems: 6, itemLabel: "title",
                    item: { type: "object", fields: [icon(), text("title", "Başlık", 50), area("text", "Metin", 300)] },
                },
            ],
        },
        {
            key: "licenses", label: "Lisans & Sertifikalar", type: "list", maxItems: 12, itemLabel: "title",
            item: {
                type: "object", fields: [
                    icon(),
                    text("date", "Tarih", 30, { optional: true }),
                    text("title", "Ad", 100),
                    text("issuer", "Veren kurum", 120, { optional: true }),
                    area("description", "Açıklama", 300, { optional: true }),
                ],
            },
        },
        {
            key: "projects", label: "Projeler", type: "list", maxItems: 12, itemLabel: "title",
            item: {
                type: "object", fields: [
                    text("title", "Proje adı", 80),
                    { key: "featured", label: "Öne çıkar (vurgulu çerçeve)", type: "boolean" },
                    text("link", "Bağlantı (https://...)", 300, { optional: true, url: true }),
                    text("linkLabel", "Bağlantı yazısı", 30, { optional: true, hint: "Boş bırakılırsa \"Kaynak kod\"" }),
                    area("description", "Açıklama", 600),
                    {
                        key: "points", label: "Maddeler", type: "list", maxItems: 8,
                        item: { type: "text", max: 200 }, hint: "**kalın** yazmak için iki yıldız kullanın",
                    },
                    tags("tags", "Teknolojiler"),
                    text("note", "Alt not", 150, { optional: true, hint: "ör. Yatırım tavsiyesi değildir" }),
                ],
            },
        },
        {
            key: "skills", label: "Yetkinlikler", type: "list", maxItems: 8, itemLabel: "title",
            item: { type: "object", fields: [icon(), text("title", "Grup adı", 50), tags("tags", "Yetkinlikler")] },
        },
        {
            key: "timeline", label: "Eğitim & Yol Haritası", type: "list", maxItems: 20, itemLabel: "title",
            item: {
                type: "object", fields: [
                    text("date", "Tarih", 30),
                    text("title", "Başlık", 100),
                    area("text", "Açıklama", 400, { optional: true }),
                ],
            },
        },
    ],
};

class ValidationError extends Error {}

const ICON_RE = /^bx[sl]?-[a-z0-9-]+$/;

function normalize(def, value, label = "İçerik") {
    switch (def.type) {
        case "object": {
            if (!value || typeof value !== "object" || Array.isArray(value)) throw new ValidationError(`${label}: geçersiz veri.`);
            const out = {};
            for (const field of def.fields) out[field.key] = normalize(field, value[field.key], field.label);
            return out;
        }
        case "list": {
            if (!Array.isArray(value)) value = [];
            const max = def.maxItems ?? 50;
            if (value.length < (def.minItems ?? 0)) throw new ValidationError(`${label}: en az ${def.minItems} öğe olmalı.`);
            if (value.length > max) throw new ValidationError(`${label}: en fazla ${max} öğe olabilir.`);
            return value.map((item, i) => normalize({ ...def.item, label: `${label} #${i + 1}` }, item, `${label} #${i + 1}`));
        }
        case "tags": {
            const list = (Array.isArray(value) ? value : []).map(v => String(v).replace(/[\r\n]+/g, " ").trim()).filter(Boolean);
            if (list.length > def.maxItems) throw new ValidationError(`${label}: en fazla ${def.maxItems} öğe olabilir.`);
            for (const t of list) if (t.length > def.max) throw new ValidationError(`${label}: "${t}" çok uzun.`);
            return list;
        }
        case "boolean":
            return value === true;
        case "icon":
        case "text":
        case "textarea": {
            let str = typeof value === "string" ? value.trim() : "";
            if (def.type !== "textarea") str = str.replace(/[\r\n]+/g, " ");
            if (!str && !def.optional) throw new ValidationError(`${label} boş olamaz.`);
            if (str.length > def.max) throw new ValidationError(`${label} en fazla ${def.max} karakter olabilir.`);
            if (str && def.type === "icon" && !ICON_RE.test(str)) throw new ValidationError(`${label}: "${str}" geçerli bir ikon adı değil.`);
            if (str && def.url && !/^https:\/\/[^\s"<>]+$/.test(str)) throw new ValidationError(`${label}: https:// ile başlayan bir adres olmalı.`);
            return str;
        }
        default:
            throw new Error(`Bilinmeyen alan tipi: ${def.type}`);
    }
}

module.exports = { schema, normalize, ValidationError };
