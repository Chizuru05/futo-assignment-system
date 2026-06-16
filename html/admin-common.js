// admin-common.js

const token = localStorage.getItem('token');
const userRole = localStorage.getItem('userRole');

// Authentication check
if (!token) window.location.href = 'login.html';
if (userRole !== 'admin') {
    if (userRole === 'student') window.location.href = 'student-dashboard.html';
    else if (userRole === 'lecturer') window.location.href = 'lecturer-dashboard.html';
    else window.location.href = 'login.html';
}

// Update admin name
document.getElementById('adminName').textContent = localStorage.getItem('userName') || 'Administrator';

// Modal functions
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

// Toast notification
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Logout
function logout() {
    localStorage.clear();
    window.location.href = 'login.html';
}

// Dark mode
function initDarkMode() {
    const themeToggle = document.getElementById('themeToggle');
    if (localStorage.getItem('futoTheme') === 'dark') document.body.classList.add('dark');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark');
            localStorage.setItem('futoTheme', document.body.classList.contains('dark') ? 'dark' : 'light');
        });
    }
}

// Sidebar
function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const menuBtn = document.getElementById('menuBtn');
    if (sidebarToggle) sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('collapsed'));
    if (menuBtn) menuBtn.addEventListener('click', () => sidebar.classList.toggle('show'));
}

document.addEventListener('DOMContentLoaded', () => {
    initDarkMode();
    initSidebar();
});

window.closeModal = closeModal;
window.showToast = showToast;
window.logout = logout;
