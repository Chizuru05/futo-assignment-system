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

let applications = [];
let currentAppId = null;

async function loadApplications() {
    try {
        const response = await fetch(`${API_URL}/api/admin/pending-applications`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

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
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No pending applications</td></tr>';
        return;
    }

    tbody.innerHTML = applications.map(app => `
        <tr>
            <td><strong>${escapeHtml(app.fullName)}</strong></td>
            <td>${escapeHtml(app.email)}</td>
            <td>${escapeHtml(app.staffId || 'N/A')}</td>
            <td>${escapeHtml(app.department || 'N/A')}</td>
            <td>${escapeHtml(app.rank || 'N/A')}</td>
            <td><span style="padding:0.2rem 0.8rem;border-radius:20px;font-size:0.75rem;font-weight:600;background:#fff3e0;color:#f59e0b">${app.status || 'pending'}</span></td>
            <td>
                <button class="btn-icon" onclick="viewDetail('${app._id}')" title="View Details"><i class="fa-regular fa-eye"></i></button>
                <button class="btn-icon" onclick="approveApplication('${app._id}')" title="Approve" style="color:#2a7a4b"><i class="fa-solid fa-check"></i></button>
                <button class="btn-icon danger" onclick="rejectApplication('${app._id}')" title="Reject"><i class="fa-solid fa-times"></i></button>
            </td>
        </tr>
    `).join('');
}

function updateStats() {
    const pending = applications.filter(a => a.status === 'pending').length;
    const approved = applications.filter(a => a.status === 'approved').length;

    const totalEl = document.getElementById('totalApps');
    const pendingEl = document.getElementById('pendingApps');
    const approvedEl = document.getElementById('approvedApps');
    const countBadge = document.getElementById('pendingCount');

    if (totalEl) totalEl.textContent = applications.length;
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
        body.innerHTML = `
            <p><strong>Name:</strong> ${escapeHtml(app.fullName)}</p>
            <p><strong>Email:</strong> ${escapeHtml(app.email)}</p>
            <p><strong>Staff ID:</strong> ${escapeHtml(app.staffId || 'N/A')}</p>
            <p><strong>Department:</strong> ${escapeHtml(app.department || 'N/A')}</p>
            <p><strong>Rank:</strong> ${escapeHtml(app.rank || 'N/A')}</p>
            <p><strong>Specialization:</strong> ${escapeHtml(app.specialization || 'N/A')}</p>
            <p><strong>Status:</strong> ${app.status}</p>
        `;
    }

    const approveBtn = document.getElementById('approveBtn');
    const rejectBtn = document.getElementById('rejectBtn');
    if (approveBtn) approveBtn.onclick = () => { approveApplication(id); closeDetail(); };
    if (rejectBtn) rejectBtn.onclick = () => { rejectApplication(id); closeDetail(); };

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
    if (!container) { container = document.createElement('div'); container.id = 'toastContainer'; container.className = 'toast-container'; document.body.appendChild(container); }
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

document.addEventListener('DOMContentLoaded', () => {
    setupTheme();
    loadApplications();
});

window.viewDetail = viewDetail;
window.closeDetail = closeDetail;
window.approveApplication = approveApplication;
window.rejectApplication = rejectApplication;
window.logout = logout;