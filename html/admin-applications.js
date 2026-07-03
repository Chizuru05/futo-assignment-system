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

// Set admin name
const adminNameEl = document.getElementById('adminName');
if (adminNameEl) adminNameEl.textContent = localStorage.getItem('fullName') || 'Administrator';

let applications = [];
let currentAppId = null;

// ========== LOAD ALL APPLICATIONS ==========
async function loadApplications() {
    try {
        console.log('Fetching all lecturer applications...');
        // Use the endpoint that returns ALL applications
        const response = await fetch(`${API_URL}/api/admin/pending-applications`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        console.log('Applications response:', data);

        if (data.success) {
            applications = data.data || [];
            renderApplications();
            updateStats();
        } else {
            showToast('Failed to load applications', 'danger');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Failed to connect to server', 'danger');
    }
}

function renderApplications() {
    const tbody = document.getElementById('applicationsBody');
    if (!tbody) return;

    if (applications.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="fa-regular fa-folder-open"></i><p>No applications found</p></td></tr>';
        return;
    }

    tbody.innerHTML = applications.map(app => {
        const statusColor = app.status === 'pending' ? '#f59e0b' : app.status === 'approved' ? '#2a7a4b' : '#ef4444';
        const statusBg = app.status === 'pending' ? '#fff3e0' : app.status === 'approved' ? '#e8f5e9' : '#fee2e2';
        const statusText = app.status || 'pending';
        
        return `
            <tr>
                <td><strong>${escapeHtml(app.fullName)}</strong></td>
                <td>${escapeHtml(app.email)}</td>
                <td>${escapeHtml(app.staffId || 'N/A')}</td>
                <td>${escapeHtml(app.rank || 'N/A')}</td>
                <td><span style="background:${statusBg};color:${statusColor};padding:0.2rem 0.8rem;border-radius:20px;font-size:0.75rem;font-weight:600;">${statusText}</span></td>
                <td>
                    <button class="btn-icon" onclick="viewDetail('${app._id}')" title="View Details"><i class="fa-regular fa-eye"></i></button>
                    ${app.status === 'pending' ? `
                        <button class="btn-icon" onclick="approveApplication('${app._id}')" title="Approve" style="color:#2a7a4b"><i class="fa-solid fa-check"></i></button>
                        <button class="btn-icon danger" onclick="rejectApplication('${app._id}')" title="Reject"><i class="fa-solid fa-times"></i></button>
                    ` : app.status === 'approved' ? `
                        <span style="color:#2a7a4b;font-size:0.75rem;font-weight:600;">✓ Approved</span>
                    ` : `
                        <span style="color:#ef4444;font-size:0.75rem;font-weight:600;">✗ Rejected</span>
                    `}
                </td>
            </tr>
        `;
    }).join('');
}

function updateStats() {
    const pending = applications.filter(a => a.status === 'pending' || a.isApproved === false).length;
    const approved = applications.filter(a => a.status === 'approved' || a.isApproved === true).length;
    const total = applications.length;

    const totalEl = document.getElementById('totalApps');
    const pendingEl = document.getElementById('pendingApps');
    const approvedEl = document.getElementById('approvedApps');
    const countBadge = document.getElementById('pendingCount');

    if (totalEl) totalEl.textContent = total;
    if (pendingEl) pendingEl.textContent = pending;
    if (approvedEl) approvedEl.textContent = approved;
    if (countBadge) countBadge.textContent = pending;
}

function viewDetail(id) {
    const app = applications.find(a => a._id === id);
    if (!app) return;

    currentAppId = id;
    const body = document.getElementById('detailBody');
    if (body) {
        const statusColor = app.status === 'pending' ? '#f59e0b' : app.status === 'approved' ? '#2a7a4b' : '#ef4444';
        const statusBg = app.status === 'pending' ? '#fff3e0' : app.status === 'approved' ? '#e8f5e9' : '#fee2e2';
        
        body.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem;">
                <div><strong>Name:</strong></div><div>${escapeHtml(app.fullName)}</div>
                <div><strong>Email:</strong></div><div>${escapeHtml(app.email)}</div>
                <div><strong>Staff ID:</strong></div><div>${escapeHtml(app.staffId || 'N/A')}</div>
                <div><strong>Department:</strong></div><div>${escapeHtml(app.department || 'Information Technology')}</div>
                <div><strong>Rank:</strong></div><div>${escapeHtml(app.rank || 'N/A')}</div>
                <div><strong>Specialization:</strong></div><div>${escapeHtml(app.specialization || 'N/A')}</div>
                <div><strong>Status:</strong></div><div><span style="background:${statusBg};color:${statusColor};padding:0.2rem 0.8rem;border-radius:20px;font-size:0.75rem;font-weight:600;">${app.status || 'pending'}</span></div>
            </div>
        `;
    }

    const approveBtn = document.getElementById('approveBtn');
    const rejectBtn = document.getElementById('rejectBtn');
    
    if (app.status === 'pending') {
        if (approveBtn) { approveBtn.style.display = 'inline-flex'; approveBtn.onclick = () => { approveApplication(id); closeDetail(); }; }
        if (rejectBtn) { rejectBtn.style.display = 'inline-flex'; rejectBtn.onclick = () => { rejectApplication(id); closeDetail(); }; }
    } else {
        if (approveBtn) approveBtn.style.display = 'none';
        if (rejectBtn) rejectBtn.style.display = 'none';
    }

    document.getElementById('detailModal')?.classList.add('show');
}

function closeDetail() {
    document.getElementById('detailModal')?.classList.remove('show');
    currentAppId = null;
}

async function approveApplication(id) {
    try {
        const response = await fetch(`${API_URL}/api/admin/approve-lecturer/${id}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            showToast('Lecturer approved successfully!', 'success');
            loadApplications();
        } else {
            showToast(data.message || 'Failed to approve', 'danger');
        }
    } catch (error) {
        showToast('Failed to connect to server', 'danger');
    }
}

async function rejectApplication(id) {
    if (!confirm('Are you sure you want to reject this application?')) return;

    try {
        const response = await fetch(`${API_URL}/api/admin/reject-lecturer/${id}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            showToast('Application rejected', 'success');
            loadApplications();
        } else {
            showToast(data.message || 'Failed to reject', 'danger');
        }
    } catch (error) {
        showToast('Failed to connect to server', 'danger');
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
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i><span>${message}</span><button onclick="this.parentElement.remove()" style="background:none;border:none;cursor:pointer;margin-left:auto">&times;</button>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
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
        sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('collapsed'));
    }
    if (menuBtn) {
        menuBtn.addEventListener('click', () => sidebar.classList.toggle('show'));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setupTheme();
    setupSidebar();
    setupThemeToggle();
    loadApplications();
});

window.viewDetail = viewDetail;
window.closeDetail = closeDetail;
window.approveApplication = approveApplication;
window.rejectApplication = rejectApplication;
window.logout = logout;