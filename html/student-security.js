// student-security.js

function getAuthToken() {
    const userRole = localStorage.getItem('userRole');
    if (!userRole) return null;
    return localStorage.getItem(`${userRole}_token`) || localStorage.getItem('token');
}


const token = getAuthToken();

// ===== DARK MODE =====
const themeToggle = document.getElementById('themeToggle');
const body = document.body;
const sunIcon = themeToggle?.querySelector('.fa-sun');
const moonIcon = themeToggle?.querySelector('.fa-moon');

if (localStorage.getItem('futoTheme') === 'dark') {
    body.classList.add('dark');
    if (sunIcon) sunIcon.classList.remove('active');
    if (moonIcon) moonIcon.classList.add('active');
} else {
    if (sunIcon) sunIcon.classList.add('active');
}

if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        body.classList.toggle('dark');
        if (body.classList.contains('dark')) {
            localStorage.setItem('futoTheme', 'dark');
            if (sunIcon) sunIcon.classList.remove('active');
            if (moonIcon) moonIcon.classList.add('active');
        } else {
            localStorage.setItem('futoTheme', 'light');
            if (sunIcon) sunIcon.classList.add('active');
            if (moonIcon) moonIcon.classList.remove('active');
        }
    });
}

// ===== PASSWORD TOGGLE =====
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const button = input.nextElementSibling;
    const icon = button.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

// ===== PASSWORD STRENGTH =====
const newPassword = document.getElementById('newPassword');
const strengthFill = document.getElementById('strengthFill');
const strengthText = document.getElementById('strengthText');
const reqLength = document.getElementById('req-length');
const reqUppercase = document.getElementById('req-uppercase');
const reqLowercase = document.getElementById('req-lowercase');
const reqNumber = document.getElementById('req-number');
const reqSpecial = document.getElementById('req-special');

if (newPassword) newPassword.addEventListener('input', checkPasswordStrength);

function checkPasswordStrength() {
    const password = newPassword.value;
    const hasLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    updateRequirement(reqLength, hasLength);
    updateRequirement(reqUppercase, hasUppercase);
    updateRequirement(reqLowercase, hasLowercase);
    updateRequirement(reqNumber, hasNumber);
    updateRequirement(reqSpecial, hasSpecial);

    const strength = [hasLength, hasUppercase, hasLowercase, hasNumber, hasSpecial].filter(Boolean).length * 20;

    if (strengthFill) {
        strengthFill.style.width = strength + '%';
        const levels = [
            { max: 20, bg: '#ef4444', label: 'Too weak' },
            { max: 40, bg: '#f59e0b', label: 'Weak' },
            { max: 60, bg: '#fbbf24', label: 'Fair' },
            { max: 80, bg: '#4ade80', label: 'Good' },
            { max: 100, bg: '#2a7a4b', label: 'Strong' }
        ];
        const level = levels.find(l => strength <= l.max) || levels[4];
        strengthFill.style.background = level.bg;
        if (strengthText) { strengthText.textContent = level.label; strengthText.style.color = level.bg; }
    }
}

function updateRequirement(element, met) {
    if (!element) return;
    const icon = element.querySelector('i');
    if (met) {
        icon.classList.replace('fa-circle', 'fa-circle-check');
        element.classList.add('met');
    } else {
        icon.classList.replace('fa-circle-check', 'fa-circle');
        element.classList.remove('met');
    }
}

// ===== PASSWORD MATCH =====
const confirmPassword = document.getElementById('confirmPassword');
const matchIndicator = document.getElementById('matchIndicator');

if (newPassword && confirmPassword) {
    confirmPassword.addEventListener('input', checkPasswordMatch);
    newPassword.addEventListener('input', checkPasswordMatch);
}

function checkPasswordMatch() {
    const password = newPassword.value;
    const confirm = confirmPassword.value;
    if (!confirm) { matchIndicator.textContent = ''; matchIndicator.className = 'match-indicator'; return; }
    if (password === confirm) {
        matchIndicator.textContent = 'âœ“ Passwords match';
        matchIndicator.className = 'match-indicator match';
    } else {
        matchIndicator.textContent = 'âœ— Passwords do not match';
        matchIndicator.className = 'match-indicator no-match';
    }
}

// ===== UPDATE PASSWORD â€” REAL API CALL =====
const updateBtn = document.getElementById('updatePasswordBtn');
const currentPassword = document.getElementById('currentPassword');

if (updateBtn) {
    updateBtn.addEventListener('click', async (e) => {
        e.preventDefault();

        const current = currentPassword.value;
        const newPwd = newPassword.value;
        const confirm = confirmPassword.value;

        if (!current) { showToast('Please enter your current password', 'warning'); return; }
        if (!newPwd) { showToast('Please enter a new password', 'warning'); return; }
        if (!confirm) { showToast('Please confirm your new password', 'warning'); return; }
        if (newPwd !== confirm) { showToast('Passwords do not match', 'warning'); return; }

        const hasLength = newPwd.length >= 8;
        const hasUppercase = /[A-Z]/.test(newPwd);
        const hasLowercase = /[a-z]/.test(newPwd);
        const hasNumber = /[0-9]/.test(newPwd);
        const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPwd);

        if (!hasLength || !hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
            showToast('Please meet all password requirements', 'warning');
            return;
        }

        updateBtn.disabled = true;
        updateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';

        try {
            const response = await fetch(`${API_URL}/api/profile/change-password`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ currentPassword: current, newPassword: newPwd })
            });

            const data = await response.json();

            if (data.success) {
                const today = new Date();
                const lastChangedEl = document.getElementById('lastChanged');
                if (lastChangedEl) {
                    lastChangedEl.textContent = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                }

                currentPassword.value = '';
                newPassword.value = '';
                confirmPassword.value = '';

                if (strengthFill) { strengthFill.style.width = '0%'; }
                if (strengthText) { strengthText.textContent = 'Too weak'; strengthText.style.color = '#ef4444'; }
                if (matchIndicator) matchIndicator.textContent = '';

                document.querySelectorAll('.requirement').forEach(req => {
                    req.classList.remove('met');
                    const icon = req.querySelector('i');
                    if (icon) { icon.classList.remove('fa-circle-check'); icon.classList.add('fa-circle'); }
                });

                showToast('Password updated successfully!', 'success');
            } else {
                showToast(data.message || 'Failed to update password', 'danger');
            }
        } catch (error) {
            console.error('Password update error:', error);
            showToast('Failed to connect to server', 'danger');
        } finally {
            updateBtn.disabled = false;
            updateBtn.innerHTML = '<i class="fa-solid fa-key"></i> Update Password';
        }
    });
}

// ===== TOAST =====
const toastContainer = document.getElementById('toastContainer');

function showToast(message, type = 'success', duration = 3000) {
    const container = toastContainer || document.body;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: 'fa-circle-check', warning: 'fa-triangle-exclamation', danger: 'fa-circle-exclamation', info: 'fa-circle-info' };
    const titles = { success: 'Success', warning: 'Warning', danger: 'Error', info: 'Info' };
    toast.innerHTML = `
        <i class="fa-solid ${icons[type] || icons.success}"></i>
        <div class="toast-content">
            <div class="toast-title">${titles[type] || 'Info'}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()"><i class="fa-solid fa-times"></i></button>
    `;
    container.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, duration);
}

// ===== CONFIRM MODAL =====
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
        confirmActionBtn.onclick = () => { if (confirmCallback) confirmCallback(); closeConfirm(); };
        confirmActionBtn.style.background = type === 'danger' ? '#ef4444' : 'var(--primary)';
    }
    if (confirmModal) confirmModal.classList.add('show');
}

function closeConfirm() {
    if (confirmModal) confirmModal.classList.remove('show');
}

if (confirmModal) {
    confirmModal.addEventListener('click', (e) => { if (e.target === confirmModal) closeConfirm(); });
}

const backButton = document.querySelector('.back-button');
if (backButton) {
    backButton.addEventListener('click', (e) => {
        e.preventDefault();
        showToast('Returning to settings...', 'info');
        setTimeout(() => { window.location.href = backButton.getAttribute('href'); }, 500);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('Student Security page initialized');
});

window.togglePassword = togglePassword;
window.showToast = showToast;
window.showConfirm = showConfirm;
window.closeConfirm = closeConfirm;
