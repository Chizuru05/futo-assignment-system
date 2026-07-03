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

let allLecturers = [];
let currentSession = '';
let currentSemester = '';

// Set admin name
const adminNameEl = document.getElementById('adminName');
if (adminNameEl) adminNameEl.textContent = localStorage.getItem('fullName') || 'Administrator';

// ========== FETCH ACTIVE SETTINGS ==========
async function fetchActiveSettings() {
    try {
        const response = await fetch(`${API_URL}/api/settings`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
            currentSession = data.settings.activeSession;
            currentSemester = data.settings.activeSemester;
            const sidebarSession = document.getElementById('sidebarSession');
            if (sidebarSession) {
                sidebarSession.innerHTML = `${currentSession} ${currentSemester}`;
            }
        }
    } catch (error) {
        console.error('Error fetching active settings:', error);
        currentSession = localStorage.getItem('currentSession') || '2025-2026';
        currentSemester = localStorage.getItem('currentSemester') || 'Harmattan';
    }
}

// ========== LOAD LECTURERS ==========
async function loadLecturers() {
    try {
        const response = await fetch(`${API_URL}/api/admin/users/all`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            allLecturers = data.users?.filter(u => u.role === 'lecturer') || [];
            updateStats();
            renderLecturers();
        } else {
            showToast('Failed to load lecturers', 'danger');
        }
    } catch (error) {
        console.error('Error loading lecturers:', error);
        showToast('Failed to connect to server', 'danger');
    }
}

function updateStats() {
    const total = allLecturers.length;
    const pending = allLecturers.filter(l => l.status === 'pending').length;
    const approved = allLecturers.filter(l => l.status === 'approved').length;
    
    document.getElementById('totalLecturers').textContent = total;
    document.getElementById('pendingLecturers').textContent = pending;
    document.getElementById('approvedLecturers').textContent = approved;
    document.getElementById('lecturerCount').textContent = `${total} lecturers`;
}

function renderLecturers() {
    const tbody = document.getElementById('lecturersTableBody');
    if (!tbody) return;
    
    let filtered = [...allLecturers];
    const statusFilter = document.getElementById('statusFilter').value;
    
    if (statusFilter !== 'all') {
        filtered = filtered.filter(l => l.status === statusFilter);
    }
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><i class="fa-regular fa-folder-open"></i><p>No lecturers found</p></td></tr>';
        return;
    }
    
    tbody.innerHTML = filtered.map(lecturer => {
        const statusColor = lecturer.status === 'approved' ? '#2a7a4b' : lecturer.status === 'pending' ? '#f59e0b' : '#ef4444';
        const statusBg = lecturer.status === 'approved' ? '#e8f5e9' : lecturer.status === 'pending' ? '#fff3e0' : '#fee2e2';
        return `
            <tr>
                <td><strong>${escapeHtml(lecturer.fullName)}</strong></td>
                <td>${escapeHtml(lecturer.email)}</td>
                <td>${escapeHtml(lecturer.staffId || 'N/A')}</td>
                <td>${escapeHtml(lecturer.rank || 'N/A')}</td>
                <td>${escapeHtml(lecturer.department || 'Information Technology')}</td>
                <td><span style="background:${statusBg};color:${statusColor};padding:0.2rem 0.8rem;border-radius:20px;font-size:0.75rem;font-weight:600;">${lecturer.status || 'N/A'}</span></td>
                <td>
                    <button class="btn-icon" onclick="viewLecturer('${lecturer._id}')" title="View Details"><i class="fa-regular fa-eye"></i></button>
                    ${lecturer.status === 'pending' ? `
                        <button class="btn-icon" onclick="approveLecturer('${lecturer._id}')" title="Approve" style="color:#2a7a4b"><i class="fa-solid fa-check"></i></button>
                        <button class="btn-icon danger" onclick="rejectLecturer('${lecturer._id}')" title="Reject"><i class="fa-solid fa-times"></i></button>
                    ` : ''}
                </td>
            </tr>
        `;
    }).join('');
}

function applyFilters() {
    renderLecturers();
    showToast('Filters applied', 'success');
}

function clearFilters() {
    document.getElementById('statusFilter').value = 'all';
    renderLecturers();
    showToast('Filters cleared', 'success');
}

// ========== VIEW LECTURER DETAILS ==========
function viewLecturer(id) {
    const lecturer = allLecturers.find(l => l._id === id);
    if (!lecturer) {
        showToast('Lecturer not found', 'danger');
        return;
    }
    
    showToast(`Viewing ${lecturer.fullName}`, 'info');
}

// ========== APPROVE LECTURER ==========
async function approveLecturer(id) {
    try {
        const response = await fetch(`${API_URL}/api/admin/approve-lecturer/${id}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            showToast('Lecturer approved successfully!', 'success');
            loadLecturers();
            // Also update applications count
            const pendingCount = document.getElementById('pendingCount');
            if (pendingCount) {
                const pending = allLecturers.filter(l => l.status === 'pending').length;
                pendingCount.textContent = pending > 0 ? pending : '0';
            }
        } else {
            showToast(data.message || 'Failed to approve', 'danger');
        }
    } catch (error) {
        showToast('Failed to connect to server', 'danger');
    }
}

// ========== REJECT LECTURER ==========
async function rejectLecturer(id) {
    if (!confirm('Are you sure you want to reject this lecturer?')) return;
    
    try {
        const response = await fetch(`${API_URL}/api/admin/reject-lecturer/${id}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            showToast('Lecturer rejected', 'success');
            loadLecturers();
        } else {
            showToast(data.message || 'Failed to reject', 'danger');
        }
    } catch (error) {
        showToast('Failed to connect to server', 'danger');
    }
}

// ========== UTILITY FUNCTIONS ==========
function showToast(message, type = 'success') {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        container.id = 'toastContainer';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i><span>${message}</span><button class="toast-close" onclick="this.parentElement.remove()">×</button>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function logout() {
    localStorage.clear();
    window.location.href = 'login.html';
}

function setupTheme() {
    if (localStorage.getItem('futoTheme') === 'dark') document.body.classList.add('dark');
}

function setupThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark');
            localStorage.setItem('futoTheme', document.body.classList.contains('dark') ? 'dark' : 'light');
        });
    }
}

function setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const menuBtn = document.getElementById('menuBtn');
    
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            if (window.innerWidth <= 1024) {
                sidebar.classList.remove('show');
            } else {
                sidebar.classList.toggle('collapsed');
            }
        });
    }
    if (menuBtn) {
        menuBtn.addEventListener('click', () => sidebar.classList.toggle('show'));
    }
}

// ========== INITIALIZE ==========
document.addEventListener('DOMContentLoaded', async () => {
    setupTheme();
    setupSidebar();
    setupThemeToggle();
    await fetchActiveSettings();
    loadLecturers();
});

window.viewLecturer = viewLecturer;
window.approveLecturer = approveLecturer;
window.rejectLecturer = rejectLecturer;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.logout = logout;
window.showToast = showToast;