// Back Button Handler
const backButton = document.querySelector('.back-button');
if (backButton) {
    backButton.addEventListener('click', (e) => {
        e.preventDefault();
        showToast('Returning to dashboard...', 'info');
        setTimeout(() => {
            window.location.href = backButton.getAttribute('href');
        }, 500);
    });
}

// Settings Menu Cards Animation
const menuCards = document.querySelectorAll('.settings-menu-card');
menuCards.forEach((card, index) => {
    card.style.animation = `fadeIn 0.5s ease ${index * 0.1}s forwards`;
    card.style.opacity = '0';
    
    card.addEventListener('click', (e) => {
        const href = card.getAttribute('href');
        const title = card.querySelector('h3').textContent;
        
        e.preventDefault();
        showToast(`Opening ${title}...`, 'info');
        
        setTimeout(() => {
            window.location.href = href;
        }, 500);
    });
});

// Toast Notification System
const toastContainer = document.getElementById('toastContainer');

function showToast(message, type = 'success', duration = 3000) {
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-circle-check';
    let title = 'Success';
    
    if (type === 'warning') {
        icon = 'fa-triangle-exclamation';
        title = 'Warning';
    } else if (type === 'danger') {
        icon = 'fa-circle-exclamation';
        title = 'Error';
    } else if (type === 'info') {
        icon = 'fa-circle-info';
        title = 'Info';
    }
    
    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fa-solid fa-times"></i>
        </button>
    `;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, duration);
}

// Confirm Modal
const confirmModal = document.getElementById('confirmModal');
const confirmTitle = document.getElementById('confirmTitle');
const confirmMessage = document.getElementById('confirmMessage');
const confirmActionBtn = document.getElementById('confirmActionBtn');
let confirmCallback = null;

function showConfirm(title, message, callback, type = 'warning') {
    if (confirmTitle) confirmTitle.textContent = title;
    if (confirmMessage) confirmMessage.textContent = message;
    
    confirmCallback = callback;
    
    if (confirmActionBtn) {
        confirmActionBtn.onclick = () => {
            if (confirmCallback) confirmCallback();
            closeConfirm();
        };
        
        if (type === 'danger') {
            confirmActionBtn.style.background = '#ef4444';
        } else {
            confirmActionBtn.style.background = 'var(--primary)';
        }
    }
    
    if (confirmModal) confirmModal.classList.add('show');
}

function closeConfirm() {
    if (confirmModal) confirmModal.classList.remove('show');
}

window.showConfirm = showConfirm;
window.closeConfirm = closeConfirm;

// Close modal when clicking outside
if (confirmModal) {
    confirmModal.addEventListener('click', (e) => {
        if (e.target === confirmModal) {
            closeConfirm();
        }
    });
}

// Make showToast available globally
window.showToast = showToast;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('Settings page initialized - Save All button removed');
});
