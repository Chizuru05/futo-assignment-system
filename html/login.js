// login.js - shared by login.html (student) and lecturer-login.html (lecturer)
const ROLE = document.body.dataset.role; // 'student' or 'lecturer'

const ROLE_SETTINGS = {
    student: {
        label: 'Matric Number / Email',
        hint: 'Enter your matric number (e.g., 20211263362) or email',
        placeholder: '20211263362 or student@gmail.com',
        button: 'Login as Student',
        dashboard: 'student-dashboard.html',
        name: 'Student',
        loginPage: 'login.html'
    },
    lecturer: {
        label: 'Staff ID / Email',
        hint: 'Enter your staff ID (e.g., STAFF/2024/001) or email',
        placeholder: 'STAFF/2024/001 or lecturer@gmail.com',
        button: 'Login as Lecturer',
        dashboard: 'lecturer-dashboard.html',
        name: 'Lecturer',
        loginPage: 'lecturer-login.html'
    }
};

const SETTINGS = ROLE_SETTINGS[ROLE];
const REMEMBER_KEY = 'remembered_' + ROLE;

const identifierInput = document.getElementById('identifier');
const identifierLabel = document.getElementById('identifierLabel');
const identifierHint = document.getElementById('identifierHint');
const loginBtn = document.getElementById('loginBtn');
const loginBtnText = document.getElementById('loginBtnText');
const loginForm = document.getElementById('loginForm');
const passwordToggle = document.getElementById('passwordToggle');
const passwordInput = document.getElementById('password');
const rememberMeCheckbox = document.getElementById('rememberMe');

function setupLabels() {
    identifierLabel.textContent = SETTINGS.label;
    identifierHint.textContent = SETTINGS.hint;
    identifierInput.placeholder = SETTINGS.placeholder;
    loginBtnText.textContent = SETTINGS.button;
}

if (passwordToggle && passwordInput) {
    passwordToggle.addEventListener('click', () => {
        const icon = passwordToggle.querySelector('i');
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            icon.classList.replace('fa-eye', 'fa-eye-slash');
        } else {
            passwordInput.type = 'password';
            icon.classList.replace('fa-eye-slash', 'fa-eye');
        }
    });
}

function clearErrors() {
    const identifierError = document.getElementById('identifierError');
    const passwordError = document.getElementById('passwordError');
    if (identifierError) identifierError.textContent = '';
    if (passwordError) passwordError.textContent = '';
    identifierInput.classList.remove('error');
    passwordInput.classList.remove('error');
}

function showInputError(input, errorElementId, message) {
    const errorElement = document.getElementById(errorElementId);
    if (input) input.classList.add('error');
    if (errorElement) errorElement.textContent = message;
}

function validateForm() {
    let isValid = true;
    const identifier = identifierInput.value.trim();
    const password = passwordInput.value;

    clearErrors();

    if (!identifier) {
        showInputError(identifierInput, 'identifierError', `${SETTINGS.label} is required`);
        isValid = false;
    }
    if (!password) {
        showInputError(passwordInput, 'passwordError', 'Password is required');
        isValid = false;
    }
    return isValid;
}

function showToast(message, type = 'success', duration = 3000) {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        container.id = 'toastContainer';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let icon = 'fa-circle-check';
    if (type === 'warning') icon = 'fa-triangle-exclamation';
    else if (type === 'danger') icon = 'fa-circle-exclamation';
    else if (type === 'info') icon = 'fa-circle-info';

    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <div class="toast-content">
            <div class="toast-title">${type === 'success' ? 'Success' : type === 'danger' ? 'Error' : 'Info'}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
}

async function handleLogin(e) {
    e.preventDefault();
    if (!validateForm()) return;

    const identifier = identifierInput.value.trim();
    const password = passwordInput.value;
    const rememberMe = rememberMeCheckbox?.checked || false;

    loginBtn.disabled = true;
    const originalText = loginBtn.innerHTML;
    loginBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Logging in...';

    const resetButton = () => {
        loginBtn.disabled = false;
        loginBtn.innerHTML = originalText;
    };

    try {
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier, password })
        });

        const data = await response.json();

        if (!data.success) {
            showToast(data.message || 'Login failed. Please check your credentials.', 'danger');
            resetButton();
            return;
        }

        const role = data.user.role;

        if (role === 'admin') {
            showToast('Admins must use the admin login portal.', 'danger', 4500);
            resetButton();
            return;
        }

        // The account must belong to the page the user is on
        if (role !== ROLE) {
            const other = ROLE_SETTINGS[role];
            const otherName = other ? other.name : role;
            const otherPage = other ? other.loginPage : 'index.html';
            showToast(`This is a ${otherName} account. Please use the ${otherName} login page.`, 'danger', 4500);
            resetButton();
            setTimeout(() => { window.location.href = otherPage; }, 2000);
            return;
        }

        // Keep the "remember me" entries and theme preference across the wipe below
        const keep = {};
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('remembered_') || key === 'futoTheme') keep[key] = localStorage.getItem(key);
        });

        localStorage.clear();
        Object.entries(keep).forEach(([k, v]) => localStorage.setItem(k, v));

        localStorage.setItem(`${role}_token`, data.token);
        localStorage.setItem('token', data.token);
        localStorage.setItem('userRole', role);
        localStorage.setItem('userId', data.user._id);
        localStorage.setItem('fullName', data.user.fullName);
        localStorage.setItem('email', data.user.email);

        if (data.user.matricNumber) localStorage.setItem('matricNumber', data.user.matricNumber);
        if (data.user.staffId) localStorage.setItem('staffId', data.user.staffId);
        if (data.user.level) localStorage.setItem('level', data.user.level);
        if (data.user.rank) localStorage.setItem('rank', data.user.rank);

        localStorage.setItem('currentSession', '2025-2026');
        localStorage.setItem('currentSemester', 'Harmattan');

        if (rememberMe) {
            localStorage.setItem(REMEMBER_KEY, identifier);
        } else {
            localStorage.removeItem(REMEMBER_KEY);
        }

        showToast(`Welcome back, ${data.user.fullName}!`, 'success');
        setTimeout(() => { window.location.href = SETTINGS.dashboard; }, 1000);

    } catch (error) {
        console.error('Login error:', error);
        showToast('Cannot connect to server. Make sure backend is running.', 'danger');
        resetButton();
    }
}

function loadRememberedCredentials() {
    const remembered = localStorage.getItem(REMEMBER_KEY);
    if (remembered) {
        identifierInput.value = remembered;
        rememberMeCheckbox.checked = true;
    }
}

if (loginForm) loginForm.addEventListener('submit', handleLogin);

document.addEventListener('DOMContentLoaded', () => {
    setupLabels();
    loadRememberedCredentials();
});

window.showToast = showToast;