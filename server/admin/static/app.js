// ---------- Yardımcılar ----------
const $ = sel => document.querySelector(sel);

// Kullanıcıdan gelen hiçbir metin innerHTML ile basılmaz; hepsi textContent.
function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
        if (key === "class") node.className = value;
        else if (key === "text") node.textContent = value;
        else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
        else if (value === true) node.setAttribute(key, "");
        else if (value !== false && value != null) node.setAttribute(key, value);
    }
    for (const child of children.flat()) if (child) node.append(child);
    return node;
}

async function api(method, url, body, contentType = "application/json") {
    const res = await fetch(`/admin/api${url}`, {
        method,
        headers: body !== undefined ? { "Content-Type": contentType } : {},
        body: body === undefined ? undefined : contentType === "application/json" ? JSON.stringify(body) : body,
    });
    if (res.status === 401) {
        location.href = "/admin/login";
        throw new Error("Oturum kapandı.");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Hata (${res.status})`);
    return data;
}

let toastTimer;
function toast(message) {
    const t = $("#toast");
    t.textContent = message;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 3000);
}

const formatDate = iso => new Date(iso).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });
const formatSize = bytes => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);

// ---------- Sekmeler ----------
const loaders = { stats: () => loadStats(), messages: loadMessages, cv: loadCv, backups: loadBackups };

document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
        const name = tab.dataset.tab;
        document.querySelectorAll(".tab").forEach(t => t.setAttribute("aria-selected", String(t === tab)));
        document.querySelectorAll("main > section").forEach(s => (s.hidden = s.id !== `tab-${name}`));
        $("#savebar").hidden = name !== "content";
        loaders[name]?.();
    });
});

$("#logoutBtn").addEventListener("click", async () => {
    if (dirty && !confirm("Kaydedilmemiş değişiklikler var. Yine de çıkılsın mı?")) return;
    dirty = false;
    await api("POST", "/logout").catch(() => {});
    location.href = "/admin/login";
});

// ---------- İçerik düzenleyici (şemadan üretilir) ----------
let schema, state, dirty = false;

function setDirty(value = true) {
    dirty = value;
    const status = $("#saveStatus");
    status.className = `status${value ? " dirty" : ""}`;
    status.textContent = value ? "Kaydedilmemiş değişiklikler var" : "Tüm değişiklikler yayında";
    $("#saveBtn").disabled = !value;
}

window.addEventListener("beforeunload", e => {
    if (dirty) e.preventDefault();
});

function emptyValue(def) {
    switch (def.type) {
        case "object": return Object.fromEntries(def.fields.map(f => [f.key, emptyValue(f)]));
        case "list":
        case "tags": return [];
        case "boolean": return false;
        default: return "";
    }
}

function hintNode(def) {
    return def.hint ? el("small", { class: "hint", text: def.hint }) : null;
}

// get(): mevcut değeri döndürür, set(v): değeri yazar
function renderField(def, get, set) {
    switch (def.type) {
        case "object":
            return el("div", { class: "obj" },
                def.fields.map(f => renderField(f, () => get()[f.key], v => { get()[f.key] = v; })));

        case "list":
            return renderList(def, get);

        case "boolean":
            return el("label", { class: "check" },
                el("input", { type: "checkbox", checked: get() === true, onchange: e => { set(e.target.checked); setDirty(); } }),
                el("span", { text: def.label }));

        case "tags":
            return el("label", {},
                el("span", { text: def.label }),
                el("input", {
                    type: "text",
                    value: (get() || []).join(", "),
                    oninput: e => { set(e.target.value.split(",").map(s => s.trim()).filter(Boolean)); setDirty(); },
                }),
                hintNode(def));

        case "textarea": {
            const counter = el("small", { class: "hint" });
            const update = v => (counter.textContent = `${v.length} / ${def.max}${def.hint ? " · " + def.hint : ""}`);
            update(get() || "");
            return el("label", {},
                el("span", { text: def.label + (def.optional ? " (isteğe bağlı)" : "") }),
                el("textarea", {
                    maxlength: def.max,
                    rows: def.max > 300 ? 4 : 2,
                    oninput: e => { set(e.target.value); update(e.target.value); setDirty(); },
                }, get() || ""),
                counter);
        }

        default: // text, icon
            return el("label", {},
                el("span", { text: def.label + (def.optional ? " (isteğe bağlı)" : "") }),
                el("input", {
                    type: "text",
                    value: get() || "",
                    maxlength: def.max,
                    spellcheck: def.type === "icon" || def.url ? "false" : false,
                    oninput: e => { set(e.target.value); setDirty(); },
                }),
                hintNode(def));
    }
}

function renderList(def, get) {
    const wrap = el("div", { class: "list" });
    const simple = def.item.type !== "object"; // tek satırlık metin listesi

    const draw = () => {
        const arr = get();
        const max = def.maxItems ?? 50;
        const min = def.minItems ?? 0;
        wrap.replaceChildren();
        if (def.label) wrap.append(el("div", { class: "list-title", text: `${def.label} (${arr.length}/${max})` }));
        if (def.hint && simple) wrap.append(hintNode(def));

        arr.forEach((_, i) => {
            const move = (to) => { const [x] = arr.splice(i, 1); arr.splice(to, 0, x); setDirty(); draw(); };
            const controls = [
                el("button", { type: "button", class: "icon-btn", title: "Yukarı taşı", disabled: i === 0, onclick: () => move(i - 1) }, "↑"),
                el("button", { type: "button", class: "icon-btn", title: "Aşağı taşı", disabled: i === arr.length - 1, onclick: () => move(i + 1) }, "↓"),
                el("button", {
                    type: "button", class: "icon-btn del", title: "Sil", disabled: arr.length <= min,
                    onclick: () => {
                        const name = simple ? arr[i] : arr[i][def.itemLabel];
                        if (!confirm(`"${name || "Bu öğe"}" silinsin mi?`)) return;
                        arr.splice(i, 1); setDirty(); draw();
                    },
                }, "✕"),
            ];

            if (simple) {
                wrap.append(el("div", { class: "row" },
                    el("input", {
                        type: "text", value: arr[i], maxlength: def.item.max,
                        oninput: e => { arr[i] = e.target.value; setDirty(); },
                    }),
                    controls));
                return;
            }

            const title = el("strong");
            const refreshTitle = () => (title.textContent = arr[i][def.itemLabel] || `Yeni öğe #${i + 1}`);
            refreshTitle();
            wrap.append(el("div", { class: "item", oninput: refreshTitle },
                el("div", { class: "item-head" }, title, controls),
                el("div", { class: "item-body" },
                    renderField(def.item, () => arr[i], v => { arr[i] = v; }))));
        });

        wrap.append(el("button", {
            type: "button", class: "btn btn-sm add-btn", disabled: arr.length >= max,
            onclick: () => { arr.push(emptyValue(def.item)); setDirty(); draw(); },
        }, "+ Ekle"));
    };

    draw();
    return wrap;
}

function renderEditor() {
    const editor = $("#editor");
    const openSections = new Set([...editor.querySelectorAll("details[open]")].map(d => d.dataset.key));
    if (!openSections.size && location.hash) openSections.add(location.hash.slice(1)); // ör. /admin/#projects
    editor.replaceChildren(...schema.fields.map((section, i) =>
        el("details", { class: "section-card", "data-key": section.key, open: openSections.size ? openSections.has(section.key) : i === 0 },
            el("summary", { text: section.label }),
            el("div", { class: "section-body" },
                section.type === "list"
                    ? renderList({ ...section, label: "" }, () => state[section.key])
                    : renderField(section, () => state[section.key], v => { state[section.key] = v; })))));
}

$("#saveBtn").addEventListener("click", async () => {
    const btn = $("#saveBtn");
    btn.disabled = true;
    btn.textContent = "Kaydediliyor...";
    try {
        const { content } = await api("PUT", "/content", state);
        state = content;
        renderEditor();
        setDirty(false);
        toast("Kaydedildi ve sitede yayınlandı.");
    } catch (err) {
        const status = $("#saveStatus");
        status.className = "status error";
        status.textContent = err.message;
        btn.disabled = false;
    } finally {
        btn.textContent = "Kaydet ve yayınla";
    }
});

// ---------- Mesajlar ----------
async function refreshUnread(messages) {
    const count = messages.filter(m => !m.read).length;
    const badge = $("#unreadCount");
    badge.hidden = count === 0;
    badge.textContent = count;
}

async function loadMessages() {
    const list = $("#messageList");
    let messages;
    try {
        messages = await api("GET", "/messages");
    } catch (err) {
        list.replaceChildren(el("p", { class: "empty", text: err.message }));
        return;
    }
    refreshUnread(messages);
    if (!messages.length) {
        list.replaceChildren(el("p", { class: "empty", text: "Henüz mesaj yok." }));
        return;
    }

    list.replaceChildren(...messages.map(m => {
        const item = el("details", { class: `msg${m.read ? "" : " unread"}` });
        const markRead = async (read) => {
            await api("PATCH", `/messages/${m.id}`, { read });
            m.read = read;
            item.classList.toggle("unread", !read);
            refreshUnread(messages);
        };
        item.addEventListener("toggle", () => { if (item.open && !m.read) markRead(true).catch(() => {}); });

        const reply = `mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent("Re: " + (m.subject || "gorkemaraz.com"))}`;
        item.append(
            el("summary", {},
                el("span", { class: "dot" }),
                el("span", { class: "msg-from" }, m.name, el("small", { text: m.subject || "(konu yok)" })),
                el("span", { class: "msg-date", text: formatDate(m.date) })),
            el("div", { class: "msg-body" },
                el("div", { class: "msg-meta" },
                    el("span", { text: `E-posta: ${m.email}` }),
                    m.phone ? el("span", { text: `Telefon: ${m.phone}` }) : null),
                el("p", { class: "msg-text", text: m.message }),
                el("div", { class: "msg-actions" },
                    el("a", { class: "btn btn-sm btn-primary", href: reply }, "Yanıtla"),
                    el("button", { type: "button", class: "btn btn-sm", onclick: () => { markRead(false); item.open = false; } }, "Okunmadı yap"),
                    el("button", {
                        type: "button", class: "btn btn-sm btn-danger",
                        onclick: async () => {
                            if (!confirm(`${m.name} adlı kişinin mesajı silinsin mi?`)) return;
                            await api("DELETE", `/messages/${m.id}`);
                            toast("Mesaj silindi.");
                            loadMessages();
                        },
                    }, "Sil"))));
        return item;
    }));
}

// ---------- CV ----------
async function loadCv() {
    const status = $("#cvStatus");
    try {
        const cv = await api("GET", "/cv");
        status.replaceChildren(cv.exists
            ? el("span", {}, `Mevcut CV: ${formatSize(cv.size)}, son güncelleme ${formatDate(cv.date)} · `,
                el("a", { href: "/cv/gorkem-araz-cv.pdf", target: "_blank", rel: "noopener" }, "Görüntüle"))
            : el("span", { text: "Sitede henüz CV yok." }));
    } catch (err) {
        status.textContent = err.message;
    }
}

$("#cvFile").addEventListener("change", e => {
    $("#cvUpload").disabled = !e.target.files.length;
});

$("#cvUpload").addEventListener("click", async () => {
    const file = $("#cvFile").files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast("Dosya 5 MB'tan büyük olamaz.");
    const btn = $("#cvUpload");
    btn.disabled = true;
    btn.textContent = "Yükleniyor...";
    try {
        await api("PUT", "/cv", file, "application/pdf");
        $("#cvFile").value = "";
        toast("CV güncellendi.");
        loadCv();
    } catch (err) {
        toast(err.message);
        btn.disabled = false;
    } finally {
        btn.textContent = "Yükle";
    }
});

// ---------- Yedekler ----------
async function loadBackups() {
    const list = $("#backupList");
    let backups;
    try {
        backups = await api("GET", "/backups");
    } catch (err) {
        list.replaceChildren(el("p", { class: "empty", text: err.message }));
        return;
    }
    if (!backups.length) {
        list.replaceChildren(el("p", { class: "empty", text: "Henüz yedek yok. İlk kayıttan sonra burada görünür." }));
        return;
    }
    list.replaceChildren(...backups.map(b =>
        el("div", { class: "backup-row" },
            el("span", { text: formatDate(b.date) }),
            el("button", {
                type: "button", class: "btn btn-sm",
                onclick: async () => {
                    if (dirty && !confirm("Kaydedilmemiş değişiklikleriniz kaybolacak. Devam edilsin mi?")) return;
                    if (!confirm(`İçerik ${formatDate(b.date)} tarihindeki hâline döndürülüp yayınlansın mı?`)) return;
                    const { content } = await api("POST", `/backups/${encodeURIComponent(b.name)}/restore`);
                    state = content;
                    renderEditor();
                    setDirty(false);
                    toast("Yedek geri yüklendi ve yayınlandı.");
                    loadBackups();
                },
            }, "Geri yükle"))));
}

// ---------- İstatistik ----------
const SVG_NS = "http://www.w3.org/2000/svg";
function svg(tag, attrs = {}, ...children) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    for (const c of children) if (c) node.append(c);
    return node;
}

const fmt = n => n.toLocaleString("tr-TR");
const shortDate = key => new Date(`${key}T12:00:00`).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
const longDate = key => new Date(`${key}T12:00:00`).toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" });

// 0'dan başlayan, okunaklı bir üst sınır (4, 10, 20, 50, 100...)
function niceMax(v) {
    if (v <= 4) return 4;
    const pow = 10 ** Math.floor(Math.log10(v));
    for (const s of [1, 2, 2.5, 5, 10]) if (s * pow >= v) return s * pow;
    return 10 * pow;
}

let statsDays = 30, statsData = null;

async function loadStats(days = statsDays) {
    statsDays = days;
    document.querySelectorAll(".range .btn").forEach(b => b.setAttribute("aria-pressed", String(Number(b.dataset.days) === days)));
    try {
        statsData = await api("GET", `/stats?days=${days}`);
    } catch (err) {
        $("#statTiles").replaceChildren(el("p", { class: "empty", text: err.message }));
        return;
    }
    renderTiles(statsData.totals, statsData.days);
    renderDailyChart(statsData.days);
    renderDailyTable(statsData.days);
    renderBarList($("#refList"), statsData.refs, "Henüz yönlendiren site yok.");
    renderBarList($("#deviceList"), statsData.devices, "Henüz veri yok.");
}

function renderTiles(t, days) {
    const today = days[days.length - 1];
    const tile = (value, label, sub) => el("div", { class: "tile" },
        el("strong", { text: fmt(value) }), el("span", { text: label }), sub ? el("small", { text: sub }) : null);
    $("#statTiles").replaceChildren(
        tile(t.visitors, "Tekil ziyaretçi", `Bugün: ${fmt(today.visitors)}`),
        tile(t.views, "Sayfa görüntüleme", `Bugün: ${fmt(today.views)}`),
        tile(t.cv, "CV indirme", `Bugün: ${fmt(today.cv)}`),
        tile(t.messages, "Gelen mesaj"));
}

function renderDailyChart(days) {
    const box = $("#dailyChart");
    box.replaceChildren();
    const W = Math.max(box.clientWidth, 280), H = 220;
    const m = { top: 12, right: 8, bottom: 26, left: 34 };
    const pw = W - m.left - m.right, ph = H - m.top - m.bottom;
    const max = niceMax(Math.max(...days.map(d => d.visitors)));
    const band = pw / days.length;
    const bw = Math.max(2, Math.min(24, band - 2)); // en fazla 24px, aralarda 2px boşluk
    const y = v => m.top + ph - (v / max) * ph;

    const chart = svg("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img",
        "aria-label": `Son ${days.length} günde günlük tekil ziyaretçi. Toplam ${fmt(days.reduce((s, d) => s + d.visitors, 0))}.` });

    // Izgara + y ekseni (0, yarı, üst)
    for (const v of [0, max / 2, max]) {
        chart.append(svg("line", { x1: m.left, x2: W - m.right, y1: y(v), y2: y(v), class: "grid" }));
        const label = svg("text", { x: m.left - 6, y: y(v) + 4, class: "axis", "text-anchor": "end" });
        label.textContent = fmt(v);
        chart.append(label);
    }

    // x ekseni: ilk, orta, son gün
    for (const i of [...new Set([0, Math.floor((days.length - 1) / 2), days.length - 1])]) {
        const label = svg("text", { x: m.left + band * i + band / 2, y: H - 6, class: "axis",
            "text-anchor": i === 0 ? "start" : i === days.length - 1 ? "end" : "middle" });
        label.textContent = shortDate(days[i].date);
        chart.append(label);
    }

    const tip = el("div", { class: "chart-tip", hidden: true });
    const bars = [];
    days.forEach((d, i) => {
        const x = m.left + band * i + (band - bw) / 2;
        const top = y(d.visitors), base = m.top + ph;
        const h = base - top;
        let bar = null;
        if (h > 0) {
            const r = Math.min(4, bw / 2, h); // üst köşeler yuvarlak, taban düz
            bar = svg("path", { class: "bar",
                d: `M${x},${base}V${top + r}Q${x},${top} ${x + r},${top}H${x + bw - r}Q${x + bw},${top} ${x + bw},${top + r}V${base}Z` });
            chart.append(bar);
        }
        bars.push(bar);

        // Fare hedefi çubuktan büyük: tüm sütun
        const hit = svg("rect", { x: m.left + band * i, y: m.top, width: band, height: ph, class: "hit" });
        hit.addEventListener("mouseenter", () => {
            bars.forEach(b => b?.classList.toggle("dim", b !== bar));
            tip.replaceChildren(
                el("strong", { text: longDate(d.date) }),
                el("span", { text: `${fmt(d.visitors)} ziyaretçi` }),
                el("span", { text: `${fmt(d.views)} görüntüleme` }),
                d.cv ? el("span", { text: `${fmt(d.cv)} CV indirme` }) : null);
            tip.hidden = false;
            const left = Math.min(Math.max(m.left + band * i + band / 2, 70), W - 70);
            tip.style.left = `${left}px`;
            tip.style.top = `${Math.max(top - 8, 0)}px`;
        });
        hit.addEventListener("mouseleave", () => {
            bars.forEach(b => b?.classList.remove("dim"));
            tip.hidden = true;
        });
        chart.append(hit);
    });

    box.append(chart, tip);
    if (days.every(d => d.visitors === 0)) {
        box.append(el("p", { class: "chart-empty", text: "Bu aralıkta henüz ziyaret yok." }));
    }
}

function renderDailyTable(days) {
    const rows = [...days].reverse().map(d => el("tr", {},
        el("td", { text: longDate(d.date) }),
        el("td", { text: fmt(d.visitors) }),
        el("td", { text: fmt(d.views) }),
        el("td", { text: fmt(d.cv) })));
    $("#dailyTable").replaceChildren(el("table", {},
        el("thead", {}, el("tr", {}, ["Gün", "Ziyaretçi", "Görüntüleme", "CV"].map(h => el("th", { text: h })))),
        el("tbody", {}, rows)));
}

function renderBarList(target, items, emptyText) {
    const total = items.reduce((s, i) => s + i.n, 0);
    if (!total) {
        target.replaceChildren(el("p", { class: "empty", text: emptyText }));
        return;
    }
    // En çok 6 satır; geri kalanı "Diğer"
    let rows = items.slice(0, 6);
    const rest = items.slice(6).reduce((s, i) => s + i.n, 0);
    if (rest) rows = [...rows, { name: "Diğer", n: rest }];
    const max = Math.max(...rows.map(r => r.n));

    target.replaceChildren(...rows.map(r => {
        const fill = el("span", { class: "hbar-fill" });
        fill.style.width = `${(r.n / max) * 100}%`;
        return el("div", { class: "hbar" },
            el("span", { class: "hbar-name", text: r.name }),
            el("span", { class: "hbar-track" }, fill),
            el("span", { class: "hbar-value", text: `${fmt(r.n)} · %${Math.round((r.n / total) * 100)}` }));
    }));
}

document.querySelectorAll(".range .btn").forEach(b =>
    b.addEventListener("click", () => loadStats(Number(b.dataset.days))));

$("#toggleTable").addEventListener("click", e => {
    const table = $("#dailyTable");
    table.hidden = !table.hidden;
    $("#dailyChart").hidden = !table.hidden;
    e.target.textContent = table.hidden ? "Tablo olarak göster" : "Grafik olarak göster";
});

let resizeTimer;
window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (statsData && !$("#tab-stats").hidden) renderDailyChart(statsData.days); }, 150);
});

// Panel ile site aynı adreste: bu ayar sitedeki sayacı bu tarayıcı için kapatır
try {
    $("#noTrack").checked = localStorage.getItem("ga_no_track") === "1";
} catch { /* depolama kapalı */ }
$("#noTrack").addEventListener("change", e => {
    try {
        if (e.target.checked) localStorage.setItem("ga_no_track", "1");
        else localStorage.removeItem("ga_no_track");
        toast(e.target.checked ? "Bu tarayıcıdaki ziyaretleriniz artık sayılmayacak." : "Bu tarayıcıdaki ziyaretleriniz sayılacak.");
    } catch {
        toast("Tarayıcı bu ayarı kaydetmeye izin vermiyor.");
    }
});

// ---------- Başlat ----------
(async () => {
    try {
        [schema, state] = await Promise.all([api("GET", "/schema"), api("GET", "/content")]);
        renderEditor();
        setDirty(false);
        api("GET", "/messages").then(refreshUnread).catch(() => {});
        // /admin/#stats gibi adreslerle doğrudan bir sekmeye git
        document.querySelector(`.tab[data-tab="${location.hash.slice(1)}"]`)?.click();
    } catch (err) {
        $("#editor").replaceChildren(el("p", { class: "empty", text: err.message }));
    }
})();
