// ---------- Mobil menü ----------
const header = document.querySelector(".header");
const menuToggle = document.querySelector("#menu-toggle");
const navbar = document.querySelector("#navbar");
const navLinks = navbar.querySelectorAll("a");

function setMenu(open) {
    navbar.classList.toggle("open", open);
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "Menüyü kapat" : "Menüyü aç");
    menuToggle.querySelector("i").className = open ? "bx bx-x" : "bx bx-menu";
}

menuToggle.addEventListener("click", () => setMenu(!navbar.classList.contains("open")));
navLinks.forEach(link => link.addEventListener("click", () => setMenu(false)));

// ---------- Kaydırınca header kenarlığı ----------
window.addEventListener("scroll", () => {
    header.classList.toggle("scrolled", window.scrollY > 20);
}, { passive: true });

// ---------- Aktif menü bağlantısı ----------
const sections = document.querySelectorAll("main section[id]");
const sectionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const id = entry.target.id === "skills" ? "projects" : entry.target.id;
        navLinks.forEach(link => {
            link.classList.toggle("active", link.getAttribute("href") === `#${id}`);
        });
    });
}, { rootMargin: "-45% 0px -50% 0px" });
sections.forEach(section => sectionObserver.observe(section));

// ---------- Kaydırınca belirme ----------
const revealTargets = document.querySelectorAll(".heading, .section-lead, .stat, .card, .skill-group");
const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.12 });
revealTargets.forEach(el => {
    el.classList.add("reveal");
    revealObserver.observe(el);
});

// ---------- Kayan slogan ----------
const typedEl = document.querySelector("#typed");
// İfadeler panelden gelir: <span id="typed" data-phrases='["...", "..."]'>
let phrases = [];
try { phrases = JSON.parse(typedEl?.dataset.phrases || "[]"); } catch { phrases = []; }
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (typedEl && phrases.length > 1 && !reduceMotion) {
    let phraseIndex = 0;
    let letterIndex = phrases[0].length;
    let isDeleting = true;

    function typeEffect() {
        const current = phrases[phraseIndex];
        letterIndex += isDeleting ? -1 : 1;
        typedEl.textContent = current.slice(0, letterIndex);

        if (!isDeleting && letterIndex === current.length) {
            isDeleting = true;
            setTimeout(typeEffect, 2200); // tam yazılınca bekleme
        } else if (isDeleting && letterIndex === 0) {
            isDeleting = false;
            phraseIndex = (phraseIndex + 1) % phrases.length;
            setTimeout(typeEffect, 400);
        } else {
            setTimeout(typeEffect, isDeleting ? 45 : 90);
        }
    }

    // ilk slogan hazır görünür, bir süre sonra döngü başlar
    setTimeout(typeEffect, 2200);
}

// ---------- Anonim ziyaret sayacı (çerez yok, kişisel veri yok) ----------
function track(type) {
    try {
        if (localStorage.getItem("ga_no_track") === "1") return; // panelden kapatılabilir
    } catch { /* gizli sekme vb. */ }
    if (navigator.doNotTrack === "1" || navigator.globalPrivacyControl || navigator.webdriver) return;

    const body = JSON.stringify({ t: type, r: type === "view" ? document.referrer : "" });
    if (navigator.sendBeacon) {
        navigator.sendBeacon("/ziyaret", new Blob([body], { type: "text/plain" }));
    } else {
        fetch("/ziyaret", { method: "POST", body, keepalive: true, headers: { "Content-Type": "text/plain" } }).catch(() => {});
    }
}

track("view");
document.querySelector('a[href$=".pdf"][download]')?.addEventListener("click", () => track("cv"));

// ---------- Yıl ----------
document.querySelector("#year").textContent = new Date().getFullYear();

// ---------- İletişim formu ----------
const form = document.querySelector("#contactForm");
const statusEl = document.querySelector("#formStatus");
const submitBtn = form.querySelector('button[type="submit"]');

function showStatus(message, type) {
    statusEl.textContent = message;
    statusEl.className = `form-status ${type}`;
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fields = ["name", "email", "phone", "subject", "message"];
    const formData = {};
    fields.forEach(name => {
        formData[name] = form.elements[name].value.trim();
    });

    // Doğrulama
    let firstInvalid = null;
    fields.forEach(name => {
        const input = form.elements[name];
        const invalid = !input.checkValidity() || (input.required && !formData[name]);
        input.classList.toggle("invalid", invalid);
        if (invalid && !firstInvalid) firstInvalid = input;
    });
    if (firstInvalid) {
        showStatus("Lütfen zorunlu alanları doğru şekilde doldurun.", "error");
        firstInvalid.focus();
        return;
    }

    // Bot tuzağı doluysa sessizce başarılı göster, gönderme
    if (form.elements.website.value) {
        showStatus("Mesajınız gönderildi, teşekkürler!", "success");
        form.reset();
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Gönderiliyor...";
    showStatus("", "");

    try {
        const response = await fetch("/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
        });

        if (response.ok) {
            showStatus("Mesajınız gönderildi, teşekkürler! En kısa sürede dönüş yapacağım.", "success");
            form.reset();
        } else if (response.status === 400 || response.status === 429) {
            // Sunucunun doğrulama / hız sınırı mesajını göster
            showStatus(await response.text(), "error");
        } else {
            showStatus("Mesaj gönderilirken bir sorun oluştu. Lütfen e-posta ile ulaşın.", "error");
        }
    } catch (error) {
        console.error("Mesaj gönderim hatası:", error);
        showStatus("Bağlantı kurulamadı. Lütfen tekrar deneyin.", "error");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Mesajı Gönder";
    }
});

form.addEventListener("input", (e) => {
    if (e.target.classList.contains("invalid") && e.target.checkValidity()) {
        e.target.classList.remove("invalid");
    }
});
