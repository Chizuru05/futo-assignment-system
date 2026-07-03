// admin-login.js - Admin Login Page

const loginForm = document.getElementById('loginForm');
const identifier = document.getElementById('identifier');
const password = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const rememberMe = document.getElementById('rememberMe');
const passwordToggle = document.getElementById('passwordToggle');

// Password Toggle
passwordToggle.addEventListener('click', () => {
    const icon = passwordToggle.querySelector('i');
    if (password.type === 'password') {
        password.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        password.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
});

// Show Toast Notification
function showToast(message, type = 'success') {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: 'fa-circle-check', danger: 'fa-circle-exclamation' };
    toast.innerHTML = `
        <i class="fa-solid ${icons[type] || icons.success}"></i>
        <div class="toast-content">
            <div class="toast-title">${type === 'success' ? 'Success' : 'Error'}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Handle Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const identifierValue = identifier.value.trim();
    const passwordValue = password.value;

    // Validate
    if (!identifierValue) {
        document.getElementById('identifierError').textContent = 'Email is required';
        identifier.classList.add('error');
        return;
    } else {
        document.getElementById('identifierError').textContent = '';
        identifier.classList.remove('error');
    }

    if (!passwordValue) {
        document.getElementById('passwordError').textContent = 'Password is required';
        password.classList.add('error');
        return;
    } else {
        document.getElementById('passwordError').textContent = '';
        password.classList.remove('error');
    }

    loginBtn.disabled = true;
    loginBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Logging in...';

    try {
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: identifierValue, password: passwordValue })
        });
        const data = await response.json();

        if (data.success) {
            // Verify admin role
            if (data.user.role !== 'admin') {
                showToast('This account is not an admin. Please use the correct login page.', 'danger');
                loginBtn.disabled = false;
                loginBtn.innerHTML = '<span>Login as Admin</span> <i class="fa-regular fa-paper-plane"></i>';
                return;
            }

            // Clear and store session
            localStorage.clear();
            localStorage.setItem('admin_token', data.token);
            localStorage.setItem('token', data.token);
            localStorage.setItem('userRole', 'admin');
            localStorage.setItem('userId', data.user._id);
            localStorage.setItem('fullName', data.user.fullName);
            localStorage.setItem('email', data.user.email);

            if (rememberMe.checked) {
                localStorage.setItem('rememberedIdentifier', identifierValue);
                localStorage.setItem('rememberedRole', 'admin');
            }

            showToast(`Welcome back, ${data.user.fullName}!`, 'success');
            setTimeout(() => {
                window.location.href = 'admin-dashboard.html';
            }, 1000);
        } else {
            showToast(data.message || 'Login failed. Please check your credentials.', 'danger');
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<span>Login as Admin</span> <i class="fa-regular fa-paper-plane"></i>';
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('Cannot connect to server. Please try again.', 'danger');
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<span>Login as Admin</span> <i class="fa-regular fa-paper-plane"></i>';
    }
});

// Load remembered credentials
const rememberedIdentifier = localStorage.getItem('rememberedIdentifier');
const rememberedRole = localStorage.getItem('rememberedRole');
if (rememberedIdentifier && rememberedRole === 'admin') {
    identifier.value = rememberedIdentifier;
    rememberMe.checked = true;
}

// Check if already logged in
const userRole = localStorage.getItem('userRole');
if (userRole === 'admin') {
    const token = localStorage.getItem('admin_token') || localStorage.getItem('token');
    if (token) {
        window.location.href = 'admin-dashboard.html';
    }
}