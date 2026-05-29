// ===== DARK MODE TOGGLE =====
const themeToggle = document.getElementById('themeToggle');
const body = document.body;
const sunIcon = themeToggle?.querySelector('.fa-sun');
const moonIcon = themeToggle?.querySelector('.fa-moon');

// Load saved theme
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

// ===== SIDEBAR TOGGLE (if sidebar exists on this page) =====
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const menuBtn = document.getElementById('menuBtn');

if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        const icon = sidebarToggle.querySelector('i');
        if (icon) {
            if (sidebar.classList.contains('collapsed')) {
                icon.classList.remove('fa-chevron-left');
                icon.classList.add('fa-chevron-right');
                localStorage.setItem('sidebarCollapsed', 'true');
            } else {
                icon.classList.remove('fa-chevron-right');
                icon.classList.add('fa-chevron-left');
                localStorage.setItem('sidebarCollapsed', 'false');
            }
        }
    });
}

// Load sidebar state
if (localStorage.getItem('sidebarCollapsed') === 'true' && sidebar) {
    sidebar.classList.add('collapsed');
    const icon = sidebarToggle?.querySelector('i');
    if (icon) {
        icon.classList.remove('fa-chevron-left');
        icon.classList.add('fa-chevron-right');
    }
}

if (menuBtn && sidebar) {
    menuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('show');
    });
}

// Close sidebar when clicking outside on mobile
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 1024 && sidebar && menuBtn) {
        if (!sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
            sidebar.classList.remove('show');
        }
    }
});

// ===== BACK BUTTON HANDLER =====
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

// ===== SETTINGS MENU CARDS =====
const menuCards = document.querySelectorAll('.settings-menu-card');

// Add animation to cards
menuCards.forEach((card, index) => {
    card.style.animation = `fadeIn 0.5s ease ${index * 0.1}s forwards`;
    card.style.opacity = '0';
    
    // Add click handler
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

// ===== NOTIFICATION PANEL (if exists) =====
const notifBtn = document.getElementById('notifBtn');
const notifPanel = document.getElementById('notifPanel');
const notifCount = document.getElementById('notifCount');

if (notifBtn && notifPanel) {
    notifBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        notifPanel.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
        if (!notifBtn.contains(e.target) && !notifPanel.contains(e.target)) {
            notifPanel.classList.remove('show');
        }
    });
}

// Mark notifications as read
const markAllRead = document.querySelector('.notif-header span');
if (markAllRead && notifCount) {
    markAllRead.addEventListener('click', () => {
        const unreadItems = document.querySelectorAll('.notif-item.unread');
        unreadItems.forEach(item => item.classList.remove('unread'));
        notifCount.textContent = '0';
        showToast('All notifications marked as read', 'success');
    });
}

// ===== TOAST NOTIFICATION SYSTEM =====
const toastContainer = document.getElementById('toastContainer');

// Create toast container if it doesn't exist
if (!toastContainer) {
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
}

function showToast(message, type = 'success', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
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
    
    container.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, duration);
}

// Make showToast globally available
window.showToast = showToast;

// ===== CONFIRM MODAL =====
const confirmModal = document.getElementById('confirmModal');
const confirmTitle = document.getElementById('confirmTitle');
const confirmMessage = document.getElementById('confirmMessage');
const confirmActionBtn = document.getElementById('confirmActionBtn');
let confirmCallback = null;

function showConfirm(title, message, callback, type = 'warning') {
    if (!confirmModal) return;
    
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
    
    confirmModal.classList.add('show');
}

function closeConfirm() {
    if (confirmModal) {
        confirmModal.classList.remove('show');
    }
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

// ===== SIMULATE REAL-TIME NOTIFICATIONS =====
let notificationCount = 8;

function addRandomNotification() {
    const messages = [
        { icon: 'fa-regular fa-bell', text: 'New submission received', time: 'just now' },
        { icon: 'fa-regular fa-clock', text: 'Assignment due tomorrow', time: '2 min ago' },
        { icon: 'fa-regular fa-message', text: 'New message from student', time: '5 min ago' }
    ];
    
    const randomMsg = messages[Math.floor(Math.random() * messages.length)];
    const panel = document.getElementById('notifPanel');
    
    if (panel) {
        const newNotif = document.createElement('div');
        newNotif.className = 'notif-item unread';
        newNotif.innerHTML = `
            <i class="${randomMsg.icon}" style="color: #2a7a4b;"></i>
            <div>
                <p><strong>${randomMsg.text}</strong></p>
                <small>${randomMsg.time}</small>
            </div>
        `;
        
        panel.insertBefore(newNotif, panel.children[1]);
        
        if (panel.children.length > 6) {
            panel.removeChild(panel.lastElementChild);
        }
        
        notificationCount++;
        if (notifCount) {
            notifCount.textContent = notificationCount;
        }
        
        // Bell animation
        const btn = document.getElementById('notifBtn');
        if (btn) {
            btn.style.transform = 'rotate(15deg) scale(1.1)';
            setTimeout(() => btn.style.transform = 'rotate(0deg) scale(1)', 300);
        }
    }
}

// Add random notification every 60 seconds
setInterval(addRandomNotification, 60000);

// ===== ADD ANIMATION STYLES =====
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    .toast {
        transition: all 0.3s;
    }
    
    .toast-close:hover {
        color: var(--text-dark) !important;
    }
`;
document.head.appendChild(style);

// ===== LOGOUT FUNCTION =====
function logout() {
    showConfirm(
        'Logout',
        'Are you sure you want to logout?',
        () => {
            showToast('Logging out...', 'info');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1000);
        }
    );
}

// Add logout handler if logout link exists
const logoutLink = document.querySelector('.logout-link');
if (logoutLink) {
    logoutLink.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });
}

// ===== LOAD USER DATA =====
document.addEventListener('DOMContentLoaded', () => {
    // Load user info from localStorage if available
    const savedUser = localStorage.getItem('lecturerUser');
    
    if (savedUser) {
        try {
            const user = JSON.parse(savedUser);
            console.log('Loaded user data:', user);
        } catch (e) {
            console.error('Error loading user data');
        }
    }
    
    console.log('Lecturer Settings page initialized - Complete');
});

// ===== EXPORT FUNCTIONS =====
window.showToast = showToast;
window.showConfirm = showConfirm;
window.closeConfirm = closeConfirm;
window.logout = logout;