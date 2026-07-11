// logout.js

// Fully clear the session — must happen before the countdown starts
localStorage.clear();
console.log('User logged out successfully — session fully cleared');

// Countdown timer
let countdown = 5;
const countdownElement = document.getElementById('countdown');

const timer = setInterval(() => {
    countdown--;
    if (countdownElement) countdownElement.textContent = countdown;

    if (countdown <= 0) {
        clearInterval(timer);
        redirectToLogin();
    }
}, 1000);

function redirectToLogin() {
    window.location.href = 'login.html';
}

// Prevent bfcache from showing a stale logged-in page on back/forward
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        window.location.reload();
    }
});

const loginBtn = document.querySelector('.btn-primary');
const homeBtn = document.querySelector('.btn-secondary');

if (loginBtn) {
    loginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        document.body.style.opacity = '0.5';
        setTimeout(() => {
            window.location.href = loginBtn.getAttribute('href');
        }, 300);
    });
}

if (homeBtn) {
    homeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        document.body.style.opacity = '0.5';
        setTimeout(() => {
            window.location.href = homeBtn.getAttribute('href');
        }, 300);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const elements = document.querySelectorAll('.logout-card > *');
    elements.forEach((el, index) => {
        el.style.opacity = '0';
        el.style.animation = `fadeIn 0.5s ease ${index * 0.1}s forwards`;
    });
});