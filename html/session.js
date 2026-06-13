// API_URL is defined in api-config.js (loaded globally)
if (typeof API_URL === 'undefined') {
    console.warn('API_URL not defined in session.js, using fallback');
    var API_URL = 'https://futo-assignment-system-api.onrender.com';
}
console.log('session.js loaded with API_URL:', API_URL);
function getAuthToken() {
    const userRole = localStorage.getItem('userRole');
    if (!userRole) return null;
    return localStorage.getItem(`${userRole}_token`) || localStorage.getItem('token');
}

const token = getAuthToken();
const userRole = localStorage.getItem('userRole');

if (!token) {
    window.location.href = 'login.html';
}

if (userRole !== 'student') {
    if (userRole === 'lecturer') window.location.href = 'lecturer-dashboard.html';
    else if (userRole === 'admin') window.location.href = 'admin-dashboard.html';
    else window.location.href = 'login.html';
}

let activeSession = '';
let activeSemester = '';

async function loadActiveSettings() {
    try {
        const response = await fetch(`${API_URL}/api/settings`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            activeSession = data.settings.activeSession;
            activeSemester = data.settings.activeSemester;
            
            const infoBox = document.getElementById('activeSessionInfo');
            if (infoBox) {
                infoBox.innerHTML = `
                    <i class="fa-solid fa-info-circle"></i>
                    <p>Registration is open for <strong>${activeSession} ${activeSemester}</strong></p>
                `;
            }
            
            localStorage.setItem('currentSession', activeSession);
            localStorage.setItem('currentSemester', activeSemester);
        }
    } catch (error) {
        console.error('Error loading settings:', error);
        showToast('Failed to load system settings', 'danger');
    }
}

document.getElementById('continueBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    
    const level = document.getElementById('level').value;
    
    if (!level) {
        showToast('Please select your level', 'warning');
        return;
    }
    
    if (!activeSession) {
        await loadActiveSettings();
    }
    
    localStorage.setItem('selectedLevel', level);
    window.location.href = 'course-listing.html';
});

function showToast(message, type = 'success') {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i><span>${message}</span><button class="toast-close" onclick="this.parentElement.remove()">×</button>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

loadActiveSettings();