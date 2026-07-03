function getAuthToken() {
    const userRole = localStorage.getItem('userRole');
    if (!userRole) return null;
    return localStorage.getItem(`${userRole}_token`) || localStorage.getItem('token');
}

const token = getAuthToken();
const userRole = localStorage.getItem('userRole');

if (!token || userRole !== 'admin') {
    window.location.href = 'login.html';
}

document.getElementById('adminName').textContent = localStorage.getItem('fullName') || 'Administrator';

async function loadSettings() {
    try {
        const response = await fetch(`${API_URL}/api/settings`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            const sessionSelect = document.getElementById('activeSession');
            if (sessionSelect) {
                sessionSelect.value = data.settings.activeSession;
            }
            
            const semesterRadios = document.querySelectorAll('input[name="semester"]');
            semesterRadios.forEach(radio => {
                radio.checked = radio.value === data.settings.activeSemester;
            });
            
            const displaySession = document.getElementById('displaySession');
            const displaySemester = document.getElementById('displaySemester');
            const lastUpdated = document.getElementById('lastUpdated');
            
            if (displaySession) displaySession.textContent = data.settings.activeSession;
            if (displaySemester) displaySemester.textContent = data.settings.activeSemester;
            if (lastUpdated) lastUpdated.textContent = new Date(data.settings.updatedAt).toLocaleString();
            
            const sidebarSession = document.getElementById('sidebarSession');
            if (sidebarSession) {
                sidebarSession.textContent = `${data.settings.activeSession} ${data.settings.activeSemester}`;
            }
        } else {
            showToast('Failed to load settings', 'danger');
        }
    } catch (error) {
        console.error('Error loading settings:', error);
        showToast('Failed to load settings', 'danger');
    }
}

async function saveSettings() {
    const activeSession = document.getElementById('activeSession').value;
    const activeSemester = document.querySelector('input[name="semester"]:checked')?.value;
    
    if (!activeSemester) {
        showToast('Please select a semester', 'warning');
        return;
    }
    
    const saveBtn = document.getElementById('saveSettingsBtn');
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    
    try {
        const response = await fetch(`${API_URL}/api/settings`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ activeSession, activeSemester })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Settings saved successfully!', 'success');
            loadSettings();
        } else {
            showToast(data.message || 'Failed to save settings', 'danger');
        }
    } catch (error) {
        console.error('Error saving settings:', error);
        showToast('Failed to save settings', 'danger');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
    }
}

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

function logout() {
    localStorage.clear();
    window.location.href = 'login.html';
}

function setupTheme() {
    if (localStorage.getItem('futoTheme') === 'dark') document.body.classList.add('dark');
}

function setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const menuBtn = document.getElementById('menuBtn');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('collapsed'));
    }
    if (menuBtn) {
        menuBtn.addEventListener('click', () => sidebar.classList.toggle('show'));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setupTheme();
    setupSidebar();
    loadSettings();
});

document.getElementById('saveSettingsBtn')?.addEventListener('click', saveSettings);