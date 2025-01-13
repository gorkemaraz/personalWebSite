const textElement = document.getElementById("dynamic-text");
const words = [
    "Front-end Developer'ım",
    "Back-end Developer'ım",
    "Data Scientist'im",
    "Price Action Trader'ım",
    "Swing Trader'ım"
];

let wordIndex = 0;
let letterIndex = 0;
let isDeleting = false;

function typeEffect() {
    const currentWord = words[wordIndex];
    if (isDeleting) {
        letterIndex--;
    } else {
        letterIndex++;
    }

    textElement.textContent = currentWord.slice(0, letterIndex);

    if (!isDeleting && letterIndex === currentWord.length) {
        isDeleting = true;
        setTimeout(typeEffect, 1200); // Bekleme süresi
    } else if (isDeleting && letterIndex === 0) {
        isDeleting = false;
        wordIndex = (wordIndex + 1) % words.length; // Döngü için
        setTimeout(typeEffect, 500);
    } else {
        setTimeout(typeEffect, isDeleting ? 50 : 100);
    }
}

typeEffect();   
let menuIcon = document.querySelector('#menu-icon');
let navbar = document.querySelector('.navbar');
let navLinks = document.querySelectorAll('.navbar a');
menuIcon.onclick =()=>{
    menuIcon.classList.toggle('bx-x');
    navbar.classList.toggle('active');
}
// Menüyü kapat
navLinks.forEach(link => {
    link.onclick = () => {
        menuIcon.classList.remove('bx-x'); 
        navbar.classList.remove('active'); 
    };
});
const form = document.querySelector('#contactForm');

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = {
        name: document.querySelector('[name="name"]').value,
        email: document.querySelector('[name="email"]').value,
        phone: document.querySelector('[name="phone"]').value,
        subject: document.querySelector('[name="subject"]').value,
        message: document.querySelector('[name="message"]').value,
    };

    try {
        const response = await fetch('https://gorkemaraz.com/submit-form', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData),
        });

        if (response.ok) {
            alert('Form başarıyla gönderildi!');
            form.reset(); // Form sıfırla
        } else {
            alert('Bir hata oluştu, lütfen tekrar deneyin.');
        }
    } catch (error) {
        console.error('Hata:', error);
        alert('Sunucuya bağlanılamadı!');
    }
});