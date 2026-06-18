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

let allStudents = [];
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
            // Update current semester display
            const semesterDisplay = document.querySelector('.current-semester');
            if (semesterDisplay) {
                semesterDisplay.innerHTML = `<i class="fa-regular fa-calendar"></i> ${currentSession} ${currentSemester}`;
            }
        }
    } catch (error) {
        console.error('Error fetching active settings:', error);
        currentSession = localStorage.getItem('currentSession') || '2025-2026';
        currentSemester = localStorage.getItem('currentSemester') || 'Harmattan';
    }
}

// ========== LOAD STUDENTS ==========
async function loadStudents() {
    try {
        const response = await fetch(`${API_URL}/api/admin/users/all`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            allStudents = data.users?.filter(u => u.role === 'student') || [];
            updateStats();
            renderStudents();
        } else {
            showToast('Failed to load students', 'danger');
        }
    } catch (error) {
        console.error('Error loading students:', error);
        showToast('Failed to connect to server', 'danger');
    }
}

function updateStats() {
    const total = allStudents.length;
    const active = allStudents.filter(s => s.isActive !== false).length;
    
    document.getElementById('totalStudents').textContent = total;
    document.getElementById('activeStudents').textContent = active;
    document.getElementById('studentCount').textContent = `${total} students`;
}

function renderStudents() {
    const tbody = document.getElementById('studentsTableBody');
    if (!tbody) return;
    
    let filtered = [...allStudents];
    const levelFilter = document.getElementById('levelFilter').value;
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    if (levelFilter !== 'all') {
        filtered = filtered.filter(s => s.level === levelFilter);
    }
    if (searchTerm) {
        filtered = filtered.filter(s => 
            s.fullName?.toLowerCase().includes(searchTerm) ||
            s.matricNumber?.toLowerCase().includes(searchTerm) ||
            s.email?.toLowerCase().includes(searchTerm)
        );
    }
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="fa-regular fa-folder-open"></i><p>No students found</p></td></tr>';
        return;
    }
    
    tbody.innerHTML = filtered.map(student => `
        <tr>
            <td><strong>${escapeHtml(student.fullName)}</strong></td>
            <td>${escapeHtml(student.matricNumber || 'N/A')}</td>
            <td>${escapeHtml(student.email)}</td>
            <td>${escapeHtml(student.level || 'N/A')}</td>
            <td>${escapeHtml(student.department || 'Information Technology')}</td>
            <td>
                <button class="btn-icon" onclick="viewStudent('${student._id}')" title="View Details"><i class="fa-regular fa-eye"></i></button>
            </td>
        </tr>
    `).join('');
}

function applyFilters() {
    renderStudents();
    showToast('Filters applied', 'success');
}

function clearFilters() {
    document.getElementById('levelFilter').value = 'all';
    document.getElementById('searchInput').value = '';
    renderStudents();
    showToast('Filters cleared', 'success');
}

// ========== VIEW STUDENT DETAILS ==========
function viewStudent(id) {
    const student = allStudents.find(s => s._id === id);
    if (!student) {
        showToast('Student not found', 'danger');
        return;
    }
    
    showToast(`Viewing ${student.fullName}`, 'info');
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

function setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const menuBtn = document.getElementById('menuBtn');
    if (sidebarToggle) sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('collapsed'));
    if (menuBtn) menuBtn.addEventListener('click', () => sidebar.classList.toggle('show'));
}

// ========== INITIALIZE ==========
document.addEventListener('DOMContentLoaded', async () => {
    setupTheme();
    setupSidebar();
    await fetchActiveSettings();
    loadStudents();
});

window.viewStudent = viewStudent;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.logout = logout;
window.showToast = showToast;