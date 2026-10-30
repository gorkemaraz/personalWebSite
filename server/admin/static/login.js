const form = document.querySelector("#loginForm");
const errorEl = document.querySelector("#loginError");
const button = form.querySelector("button");

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.textContent = "";
    button.disabled = true;
    button.textContent = "Kontrol ediliyor...";

    try {
        const res = await fetch("/admin/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                password: form.elements.password.value,
                code: form.elements.code.value.replace(/\s/g, ""),
            }),
        });
        if (res.ok) {
            location.href = "/admin/";
            return;
        }
        const data = await res.json().catch(() => ({}));
        errorEl.textContent = data.error || "Giriş yapılamadı.";
        form.elements.code.value = "";
        form.elements.code.focus();
    } catch {
        errorEl.textContent = "Sunucuya ulaşılamadı.";
    } finally {
        button.disabled = false;
        button.textContent = "Giriş yap";
    }
});
