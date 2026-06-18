// login.js - Separate role login forms

// DOM Elements
const studentRoleBtn = document.getElementById('studentRoleBtn');
const lecturerRoleBtn = document.getElementById('lecturerRoleBtn');
const adminRoleBtn = document.getElementById('adminRoleBtn');

// Student Login Form
const studentLoginForm = document.getElementById('studentLoginForm');
const studentIdentifier = document.getElementById('studentIdentifier');
const studentPassword = document.getElementById('studentPassword');
const studentLoginBtn = document.getElementById('studentLoginBtn');
const studentRememberMe = document.getElementById('studentRememberMe');

// Lecturer Login Form
const lecturerLoginForm = document.getElementById('lecturerLoginForm');
const lecturerIdentifier = document.getElementById('lecturerIdentifier');
const lecturerPassword = document.getElementById('lecturerPassword');
const lecturerLoginBtn = document.getElementById('lecturerLoginBtn');
const lecturerRememberMe = document.getElementById('lecturerRememberMe');

// Admin Login Form
const adminLoginForm = document.getElementById('adminLoginForm');
const adminIdentifier = document.getElementById('adminIdentifier');
const adminPassword = document.getElementById('adminPassword');
const adminLoginBtn = document.getElementById('adminLoginBtn');
const adminRememberMe = document.getElementById('adminRememberMe');

let currentRole = 'student';

// ========== ROLE SWITCHING ==========
function switchRole(role) {
    currentRole = role;
    
    // Update active button
    document.querySelectorAll('.role-btn').forEach(btn => btn.classList.remove('active'));
    if (role === 'student') studentRoleBtn.classList.add('active');
    else if (role === 'lecturer') lecturerRoleBtn.classList.add('active');
    else if (role === 'admin') adminRoleBtn.classList.add('active');
    
    // Show/hide forms
    studentLoginForm.style.display = role === 'student' ? 'block' : 'none';
    lecturerLoginForm.style.display = role === 'lecturer' ? 'block' : 'none';
    adminLoginForm.style.display = role === 'admin' ? 'block' : 'none';
    
    // Clear errors
    clearAllErrors();
}

if (studentRoleBtn) {
    studentRoleBtn.addEventListener('click', () => switchRole('student'));
}
if (lecturerRoleBtn) {
    lecturerRoleBtn.addEventListener('click', () => switchRole('lecturer'));
}
if (adminRoleBtn) {
    adminRoleBtn.addEventListener('click', () => switchRole('admin'));
}

// ========== PASSWORD TOGGLE ==========
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const btn = input.nextElementSibling;
    const icon = btn.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

// ========== CLEAR ERRORS ==========
function clearAllErrors() {
    document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
    document.querySelectorAll('input.error').forEach(el => el.classList.remove('error'));
}

function showInputError(input, errorElementId, message) {
    const errorElement = document.getElementById(errorElementId);
    if (input) input.classList.add('error');
    if (errorElement) errorElement.textContent = message;
}

// ========== VALIDATE FORM ==========
function validateLogin(identifier, password, identifierLabel, identifierErrorId, passwordErrorId) {
    let isValid = true;
    
    if (!identifier || !identifier.trim()) {
        showInputError(document.getElementById(identifierErrorId.replace('Error', '')), identifierErrorId, `${identifierLabel} is required`);
        isValid = false;
    } else {
        const input = document.getElementById(identifierErrorId.replace('Error', ''));
        if (input) input.classList.remove('error');
        document.getElementById(identifierErrorId).textContent = '';
    }
    
    if (!password || !password.trim()) {
        showInputError(document.getElementById(passwordErrorId.replace('Error', '')), passwordErrorId, 'Password is required');
        isValid = false;
    } else {
        const input = document.getElementById(passwordErrorId.replace('Error', ''));
        if (input) input.classList.remove('error');
        document.getElementById(passwordErrorId).textContent = '';
    }
    
    return isValid;
}

// ========== SHOW TOAST ==========
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
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
}

// ========== HANDLE LOGIN ==========
async function handleLogin(identifier, password, role, rememberMe, form) {
    const loginBtn = form.querySelector('.login-btn');
    const originalText = loginBtn.innerHTML;
    
    // Validate
    let identifierLabel = '';
    if (role === 'student') identifierLabel = 'Matric Number / Email';
    else if (role === 'lecturer') identifierLabel = 'Staff ID / Email';
    else identifierLabel = 'Email';
    
    const identifierErrorId = `${role}IdentifierError`;
    const passwordErrorId = `${role}PasswordError`;
    
    if (!validateLogin(identifier, password, identifierLabel, identifierErrorId, passwordErrorId)) {
        return;
    }
    
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Logging in...';
    
    try {
        console.log(`🔐 Attempting ${role} login with identifier:`, identifier);
        
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier, password })
        });
        
        const data = await response.json();
        
        console.log('📥 Login response:', data);
        
        if (data.success) {
            const userRole = data.user.role;
            
            // Verify role matches
            if (userRole !== role) {
                showToast(`⚠️ This account is for ${userRole}s only. Please select the correct role.`, 'warning');
                loginBtn.disabled = false;
                loginBtn.innerHTML = originalText;
                return;
            }
            
            localStorage.clear();
            
            localStorage.setItem(`${userRole}_token`, data.token);
            localStorage.setItem('token', data.token);
            localStorage.setItem('userRole', userRole);
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
                localStorage.setItem('rememberedRole', role);
            }
            
            showToast(`Welcome back, ${data.user.fullName}!`, 'success');
            
            setTimeout(() => {
                if (userRole === 'student') window.location.href = 'student-dashboard.html';
                else if (userRole === 'lecturer') window.location.href = 'lecturer-dashboard.html';
                else if (userRole === 'admin') window.location.href = 'admin-dashboard.html';
            }, 1000);
        } else {
            showToast(data.message || 'Login failed. Please check your credentials.', 'danger');
            loginBtn.disabled = false;
            loginBtn.innerHTML = originalText;
        }
    } catch (error) {
        console.error('❌ Login error:', error);
        showToast('Cannot connect to server. Make sure backend is running.', 'danger');
        loginBtn.disabled = false;
        loginBtn.innerHTML = originalText;
    }
}

// ========== EVENT LISTENERS ==========

// Student Login
if (studentLoginForm) {
    studentLoginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleLogin(
            studentIdentifier.value.trim(),
            studentPassword.value,
            'student',
            studentRememberMe.checked,
            studentLoginForm
        );
    });
}

// Lecturer Login
if (lecturerLoginForm) {
    lecturerLoginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleLogin(
            lecturerIdentifier.value.trim(),
            lecturerPassword.value,
            'lecturer',
            lecturerRememberMe.checked,
            lecturerLoginForm
        );
    });
}

// Admin Login
if (adminLoginForm) {
    adminLoginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleLogin(
            adminIdentifier.value.trim(),
            adminPassword.value,
            'admin',
            adminRememberMe.checked,
            adminLoginForm
        );
    });
}

// ========== LOAD REMEMBERED CREDENTIALS ==========
function loadRememberedCredentials() {
    const rememberedIdentifier = localStorage.getItem('rememberedIdentifier');
    const rememberedRole = localStorage.getItem('rememberedRole');
    
    if (rememberedIdentifier && rememberedRole) {
        if (rememberedRole === 'student') {
            studentIdentifier.value = rememberedIdentifier;
            studentRememberMe.checked = true;
            switchRole('student');
        } else if (rememberedRole === 'lecturer') {
            lecturerIdentifier.value = rememberedIdentifier;
            lecturerRememberMe.checked = true;
            switchRole('lecturer');
        } else if (rememberedRole === 'admin') {
            adminIdentifier.value = rememberedIdentifier;
            adminRememberMe.checked = true;
            switchRole('admin');
        }
    }
}

// ========== CHECK ALREADY LOGGED IN ==========
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

// ========== INITIALIZE ==========
document.addEventListener('DOMContentLoaded', () => {
    checkAlreadyLoggedIn();
    loadRememberedCredentials();
    // Default to student login
    switchRole('student');
});

// Make functions global
window.togglePassword = togglePassword;
window.showToast = showToast;