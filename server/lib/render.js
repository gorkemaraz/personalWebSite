const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { escapeHtml: e, inlineFormat } = require("./util");
const { writeAtomic } = require("./store");

const TEMPLATE = path.join(__dirname, "..", "templates", "index.html");
const PUBLIC_DIR = process.env.PUBLIC_DIR || path.join(__dirname, "..", "..", "public_html");

const ind = n => " ".repeat(n);
const tagSpans = list => list.map(t => `<span>${e(t)}</span>`).join("");

function hero(h) {
    const badge = h.badge ? `${ind(16)}<span class="badge"><i class="bx bx-badge-check"></i> ${e(h.badge)}</span>\n` : "";
    return badge +
        `${ind(16)}<h1>${e(h.name)}</h1>\n` +
        `${ind(16)}<h2 class="tagline" aria-label="${e(h.phrases.join(", "))}">` +
        `<span id="typed" aria-hidden="true" data-phrases="${e(JSON.stringify(h.phrases))}">${e(h.phrases[0])}</span>` +
        `<span class="cursor" aria-hidden="true"></span></h2>\n` +
        `${ind(16)}<p>${e(h.intro)}</p>\n`;
}

function about(a) {
    const stats = a.stats.length
        ? `${ind(12)}<div class="stats">\n` +
          a.stats.map(s => `${ind(16)}<div class="stat"><strong>${e(s.value)}</strong><span>${e(s.label)}</span></div>\n`).join("") +
          `${ind(12)}</div>\n\n`
        : "";
    const focus = a.focus.length
        ? `${ind(12)}<div class="focus-grid">\n` +
          a.focus.map(f =>
              `${ind(16)}<article class="card focus">\n` +
              `${ind(20)}<i class="bx ${e(f.icon)}"></i>\n` +
              `${ind(20)}<h3>${e(f.title)}</h3>\n` +
              `${ind(20)}<p>${e(f.text)}</p>\n` +
              `${ind(16)}</article>\n`).join("") +
          `${ind(12)}</div>\n`
        : "";
    return `${ind(12)}<p class="section-lead">${e(a.lead)}</p>\n\n` + stats + focus;
}

function licenses(list) {
    return `${ind(12)}<div class="license-list">\n` +
        list.map(l =>
            `${ind(16)}<article class="card license-card">\n` +
            `${ind(20)}<div class="license-icon"><i class="bx ${e(l.icon)}"></i></div>\n` +
            `${ind(20)}<div class="license-body">\n` +
            (l.date ? `${ind(24)}<span class="license-date">${e(l.date)}</span>\n` : "") +
            `${ind(24)}<h3>${e(l.title)}</h3>\n` +
            (l.issuer ? `${ind(24)}<p>${e(l.issuer)}</p>\n` : "") +
            (l.description ? `${ind(24)}<p class="muted">${e(l.description)}</p>\n` : "") +
            `${ind(20)}</div>\n` +
            `${ind(16)}</article>\n`).join("") +
        `${ind(12)}</div>\n`;
}

function projects(list) {
    return `${ind(12)}<div class="projects-grid">\n` +
        list.map(p => {
            const link = p.link
                ? `\n${ind(24)}<a href="${e(p.link)}" target="_blank" rel="noopener" class="project-link" aria-label="${e(p.title)} bağlantısı">\n` +
                  `${ind(28)}<i class="bx ${p.link.includes("github.com") ? "bxl-github" : "bx-link-external"}"></i> ${e(p.linkLabel || "Kaynak kod")}\n` +
                  `${ind(24)}</a>`
                : "";
            const points = p.points.length
                ? `${ind(20)}<ul class="project-points">\n` +
                  p.points.map(pt => `${ind(24)}<li>${inlineFormat(pt)}</li>\n`).join("") +
                  `${ind(20)}</ul>\n`
                : "";
            const tags = p.tags.length ? `${ind(20)}<div class="tags">${tagSpans(p.tags)}</div>\n` : "";
            const note = p.note ? `${ind(20)}<p class="note"><i class="bx bx-info-circle"></i> ${e(p.note)}</p>\n` : "";
            return `${ind(16)}<article class="card project${p.featured ? " featured" : ""}">\n` +
                `${ind(20)}<div class="project-head">\n` +
                `${ind(24)}<h3>${e(p.title)}</h3>${link}\n` +
                `${ind(20)}</div>\n` +
                `${ind(20)}<p>${e(p.description)}</p>\n` +
                points + tags + note +
                `${ind(16)}</article>\n`;
        }).join("\n") +
        `${ind(12)}</div>\n`;
}

function skills(list) {
    return `${ind(12)}<div class="skills-grid">\n` +
        list.map(s =>
            `${ind(16)}<div class="card skill-group">\n` +
            `${ind(20)}<h3><i class="bx ${e(s.icon)}"></i> ${e(s.title)}</h3>\n` +
            `${ind(20)}<div class="tags">${tagSpans(s.tags)}</div>\n` +
            `${ind(16)}</div>\n`).join("") +
        `${ind(12)}</div>\n`;
}

function timeline(list) {
    return `${ind(12)}<ol class="timeline">\n` +
        list.map(t =>
            `${ind(16)}<li class="timeline-item">\n` +
            `${ind(20)}<span class="timeline-date">${e(t.date)}</span>\n` +
            `${ind(20)}<div class="card timeline-content">\n` +
            `${ind(24)}<h3>${e(t.title)}</h3>\n` +
            (t.text ? `${ind(24)}<p>${e(t.text)}</p>\n` : "") +
            `${ind(20)}</div>\n` +
            `${ind(16)}</li>\n`).join("") +
        `${ind(12)}</ol>\n`;
}

// style.css + script.js içeriğinden kısa bir özet: dosyalar değişince ?v= kendiliğinden değişir
async function assetVersion() {
    const hash = crypto.createHash("sha1");
    for (const name of ["style.css", "script.js"]) {
        hash.update(await fs.readFile(path.join(PUBLIC_DIR, name)).catch(() => ""));
    }
    return hash.digest("hex").slice(0, 10);
}

async function renderPage(content) {
    const template = await fs.readFile(TEMPLATE, "utf8");
    const values = {
        META_TITLE: e(content.meta.title),
        META_DESCRIPTION: e(content.meta.description),
        ASSET_VERSION: await assetVersion(),
        HERO: hero(content.hero),
        ABOUT: about(content.about),
        LICENSES: licenses(content.licenses),
        PROJECTS: projects(content.projects),
        SKILLS: skills(content.skills),
        TIMELINE: timeline(content.timeline),
    };
    // Tek geçişte değiştir: içerikteki "{{...}}" metinleri tekrar işlenmez
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => (key in values ? values[key] : match));
}

async function publish(content) {
    await writeAtomic(path.join(PUBLIC_DIR, "index.html"), await renderPage(content));

    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" }); // YYYY-MM-DD
    await writeAtomic(path.join(PUBLIC_DIR, "sitemap.xml"),
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        `    <url>\n        <loc>https://gorkemaraz.com/</loc>\n        <lastmod>${today}</lastmod>\n    </url>\n</urlset>\n`);
}

module.exports = { renderPage, publish, PUBLIC_DIR };
