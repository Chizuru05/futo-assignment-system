// login.js


const studentRoleBtn = document.getElementById('studentRoleBtn');
const lecturerRoleBtn = document.getElementById('lecturerRoleBtn');
const adminRoleBtn = document.getElementById('adminRoleBtn');
const identifierInput = document.getElementById('identifier');
const identifierLabel = document.getElementById('identifierLabel');
const identifierHint = document.getElementById('identifierHint');
const loginBtn = document.getElementById('loginBtn');
const loginBtnText = document.getElementById('loginBtnText');
const loginForm = document.getElementById('loginForm');
const passwordToggle = document.getElementById('passwordToggle');
const passwordInput = document.getElementById('password');
const rememberMeCheckbox = document.getElementById('rememberMe');

let currentRole = 'student';

function updateIdentifierField() {
    if (currentRole === 'student') {
        identifierLabel.textContent = 'Matric Number / Email';
        identifierHint.textContent = 'Enter your matric number (e.g., 20211263362) or email';
        identifierInput.placeholder = '20211263362 or student@gmail.com';
        loginBtnText.textContent = 'Login as Student';
    } else if (currentRole === 'lecturer') {
        identifierLabel.textContent = 'Staff ID / Email';
        identifierHint.textContent = 'Enter your staff ID (e.g., STAFF/2024/001) or email';
        identifierInput.placeholder = 'STAFF/2024/001 or lecturer@gmail.com';
        loginBtnText.textContent = 'Login as Lecturer';
    } else if (currentRole === 'admin') {
        identifierLabel.textContent = 'Email';
        identifierHint.textContent = 'Enter your admin email';
        identifierInput.placeholder = 'admin@gmail.com';
        loginBtnText.textContent = 'Login as Admin';
    }
    clearErrors();
}

if (studentRoleBtn) {
    studentRoleBtn.addEventListener('click', () => {
        studentRoleBtn.classList.add('active');
        lecturerRoleBtn.classList.remove('active');
        adminRoleBtn.classList.remove('active');
        currentRole = 'student';
        updateIdentifierField();
    });
}

if (lecturerRoleBtn) {
    lecturerRoleBtn.addEventListener('click', () => {
        lecturerRoleBtn.classList.add('active');
        studentRoleBtn.classList.remove('active');
        adminRoleBtn.classList.remove('active');
        currentRole = 'lecturer';
        updateIdentifierField();
    });
}

if (adminRoleBtn) {
    adminRoleBtn.addEventListener('click', () => {
        adminRoleBtn.classList.add('active');
        studentRoleBtn.classList.remove('active');
        lecturerRoleBtn.classList.remove('active');
        currentRole = 'admin';
        updateIdentifierField();
    });
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
    if (identifierInput) identifierInput.classList.remove('error');
    if (passwordInput) passwordInput.classList.remove('error');
}

function showInputError(input, errorElementId, message) {
    const errorElement = document.getElementById(errorElementId);
    if (input) input.classList.add('error');
    if (errorElement) errorElement.textContent = message;
}

function validateForm() {
    let isValid = true;
    const identifier = identifierInput?.value.trim();
    const password = passwordInput?.value;

    if (!identifier) {
        showInputError(identifierInput, 'identifierError', `${identifierLabel.textContent} is required`);
        isValid = false;
    } else {
        if (identifierInput) identifierInput.classList.remove('error');
        const el = document.getElementById('identifierError');
        if (el) el.textContent = '';
    }

    if (!password) {
        showInputError(passwordInput, 'passwordError', 'Password is required');
        isValid = false;
    } else {
        if (passwordInput) passwordInput.classList.remove('error');
        const el = document.getElementById('passwordError');
        if (el) el.textContent = '';
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
        <button class="toast-close" onclick="this.parentElement.remove()">Ã—</button>
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

    try {
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier, password })
        });

        const data = await response.json();

        if (data.success) {
            // Clear all existing session data first
            localStorage.clear();

            const role = data.user.role;

            // FIXED: Store both role-specific token AND generic token
            localStorage.setItem(`${role}_token`, data.token);
            localStorage.setItem('token', data.token); // fallback for older pages
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
                localStorage.setItem('rememberedIdentifier', identifier);
                localStorage.setItem('rememberedRole', currentRole);
            }

            showToast(`Welcome back, ${data.user.fullName}!`, 'success');

            setTimeout(() => {
                if (role === 'student') window.location.href = 'student-dashboard.html';
                else if (role === 'lecturer') window.location.href = 'lecturer-dashboard.html';
                else if (role === 'admin') window.location.href = 'admin-dashboard.html';
            }, 1000);
        } else {
            showToast(data.message || 'Login failed. Please check your credentials.', 'danger');
            loginBtn.disabled = false;
            loginBtn.innerHTML = originalText;
        }

    } catch (error) {
        console.error('Login error:', error);
        showToast('Cannot connect to server. Make sure backend is running.', 'danger');
        loginBtn.disabled = false;
        loginBtn.innerHTML = originalText;
    }
}

function checkAlreadyLoggedIn() {
    const userRole = localStorage.getItem('userRole');
    if (userRole) {
        const token = localStorage.getItem(`${userRole}_token`) || localStorage.getItem('token');
        if (token) {
            if (userRole === 'student') window.location.href = 'student-dashboard.html';
            else if (userRole === 'lecturer') window.location.href = 'lecturer-dashboard.html';
            else if (userRole === 'admin') window.location.href = 'admin-dashboard.html';
        }
    }
}

function loadRememberedCredentials() {
    const rememberedIdentifier = localStorage.getItem('rememberedIdentifier');
    const rememberedRole = localStorage.getItem('rememberedRole');
    if (rememberedIdentifier && rememberedRole) {
        identifierInput.value = rememberedIdentifier;
        if (rememberedRole === 'student' && studentRoleBtn) studentRoleBtn.click();
        else if (rememberedRole === 'lecturer' && lecturerRoleBtn) lecturerRoleBtn.click();
        else if (rememberedRole === 'admin' && adminRoleBtn) adminRoleBtn.click();
        if (rememberMeCheckbox) rememberMeCheckbox.checked = true;
    }
}

if (loginForm) loginForm.addEventListener('submit', handleLogin);

document.addEventListener('DOMContentLoaded', () => {
    checkAlreadyLoggedIn();
    updateIdentifierField();
    loadRememberedCredentials();
});

window.showToast = showToast;
