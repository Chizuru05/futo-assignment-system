// Countdown timer
let countdown = 5;
const countdownElement = document.getElementById('countdown');

// Update countdown every second
const timer = setInterval(() => {
    countdown--;
    countdownElement.textContent = countdown;
    
    if (countdown <= 0) {
        clearInterval(timer);
        redirectToLogin();
    }
}, 1000);

// Redirect function
function redirectToLogin() {
    window.location.href = 'login.html';
}

// Manual redirect with animation
document.addEventListener('DOMContentLoaded', () => {
    // Clear any existing session data
    localStorage.removeItem('futoTheme');
    localStorage.removeItem('sidebarCollapsed');
    localStorage.removeItem('rememberedUser');
    
    console.log('User logged out successfully');
});

// Handle visibility change (if user switches tabs)
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Optionally pause timer when tab is hidden
        // Not implemented for simplicity
    }
});

// Prevent going back to previous page after logout
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        window.location.reload();
    }
});

// Add click handlers for buttons (optional animation)
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

// Add animation to elements on page load
document.addEventListener('DOMContentLoaded', () => {
    const elements = document.querySelectorAll('.logout-card > *');
    elements.forEach((el, index) => {
        el.style.opacity = '0';
        el.style.animation = `fadeIn 0.5s ease ${index * 0.1}s forwards`;
    });
});