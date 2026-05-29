// lecturer-students.js
const API_URL = 'http://localhost:5000';

function getAuthToken() {
    const userRole = localStorage.getItem('userRole');
    if (!userRole) return null;
    return localStorage.getItem(`${userRole}_token`) || localStorage.getItem('token');
}

const token = getAuthToken();
const userRole = localStorage.getItem('userRole');

if (!token) window.location.href = 'login.html';
if (userRole !== 'lecturer') window.location.href = 'login.html';

const lecturerName = localStorage.getItem('fullName') || 'Dr. Lecturer';
const staffId = localStorage.getItem('staffId') || 'STAFF/2024/001';
const lecturerRank = localStorage.getItem('rank') || 'Senior Lecturer';

let allStudents = [];
let enrolledCourses = [];
let currentPage = 1;
const itemsPerPage = 10;
let currentFilter = 'all';
let currentSort = 'name';
let searchTerm = '';

let currentSession = localStorage.getItem('currentSession') || '2025-2026';
let currentSemester = localStorage.getItem('currentSemester') || 'Harmattan';

const studentsTableBody = document.getElementById('studentsTableBody');
const loadingOverlay = document.getElementById('loadingOverlay');
const totalStudentsEl = document.getElementById('totalStudents');
const totalCoursesEl = document.getElementById('totalCourses');
const pendingSubmissionsEl = document.getElementById('pendingSubmissions');
const courseFilterSelect = document.getElementById('courseFilter');
const sortFilterSelect = document.getElementById('sortFilter');
const searchInput = document.getElementById('searchInput');
const refreshBtn = document.getElementById('refreshBtn');
const paginationDiv = document.getElementById('pagination');
const semesterDisplay = document.getElementById('semesterDisplay');
const pendingSubmissionsBadge = document.getElementById('pendingSubmissionsBadge');
const lecturerNameEl = document.getElementById('lecturerName');
const lecturerRankEl = document.getElementById('lecturerRank');
const staffIdEl = document.getElementById('staffId');

if (lecturerNameEl) lecturerNameEl.textContent = lecturerName;
if (lecturerRankEl) lecturerRankEl.textContent = lecturerRank;
if (staffIdEl) staffIdEl.textContent = staffId;

async function fetchData() {
    showLoading(true);
    try {
        const coursesRes = await fetch(`${API_URL}/api/lecturer/my-courses?session=${currentSession}&semester=${currentSemester}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const coursesData = await coursesRes.json();
        if (coursesData.success) {
            enrolledCourses = coursesData.courses || [];
            updateCourseFilter();
            if (totalCoursesEl) totalCoursesEl.textContent = enrolledCourses.length;
        }

        const studentsRes = await fetch(`${API_URL}/api/lecturer/students?session=${currentSession}&semester=${currentSemester}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const studentsData = await studentsRes.json();

        if (studentsData.success) {
            allStudents = studentsData.students || [];
            if (totalStudentsEl) totalStudentsEl.textContent = allStudents.length;

            const pendingCount = allStudents.reduce((sum, s) => sum + (s.pendingSubmissions || 0), 0);
            if (pendingSubmissionsEl) pendingSubmissionsEl.textContent = pendingCount;
            if (pendingSubmissionsBadge) pendingSubmissionsBadge.textContent = pendingCount > 0 ? pendingCount : '';

            renderTable();
            showToast(`Loaded ${allStudents.length} students`, 'success');
        } else {
            showToast(studentsData.message || 'Failed to load students', 'danger');
            allStudents = [];
            renderTable();
        }

        if (semesterDisplay) {
            semesterDisplay.innerHTML = `<i class="fa-regular fa-calendar"></i> ${currentSession} · ${currentSemester}`;
        }
    } catch (error) {
        console.error('Error fetching data:', error);
        showToast('Failed to load data', 'danger');
        allStudents = [];
        renderTable();
    } finally {
        showLoading(false);
    }
}

function updateCourseFilter() {
    if (!courseFilterSelect) return;
    courseFilterSelect.innerHTML = '<option value="all">All Courses</option>';
    enrolledCourses.forEach(course => {
        const option = document.createElement('option');
        option.value = course.courseCode;
        option.textContent = `${course.courseCode} - ${course.courseTitle}`;
        courseFilterSelect.appendChild(option);
    });
}

function renderTable() {
    if (!studentsTableBody) return;

    let filtered = [...allStudents];

    if (currentFilter !== 'all') {
        filtered = filtered.filter(s => s.courseCode === currentFilter);
    }
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(s =>
            s.name?.toLowerCase().includes(term) ||
            s.matricNumber?.toLowerCase().includes(term) ||
            s.email?.toLowerCase().includes(term)
        );
    }

    filtered.sort((a, b) => {
        if (currentSort === 'name') return (a.name || '').localeCompare(b.name || '');
        if (currentSort === 'matric') return (a.matricNumber || '').localeCompare(b.matricNumber || '');
        if (currentSort === 'submissions') return (b.submittedCount || 0) - (a.submittedCount || 0);
        return 0;
    });

    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    const paginated = filtered.slice(start, start + itemsPerPage);

    if (paginated.length === 0) {
        studentsTableBody.innerHTML = `<tr><td colspan="7" class="text-center"><i class="fa-regular fa-folder-open" style="font-size:2rem;opacity:0.5;"></i><p>No students found</p></td></tr>`;
        updatePagination(totalPages);
        return;
    }

    // FIXED: All closing tags are now </td> not </div>
    studentsTableBody.innerHTML = paginated.map(student => {
        const submissionsText = `${student.submittedCount || 0}/${student.totalAssignments || 0}`;
        const percentage = student.totalAssignments > 0
            ? ((student.submittedCount || 0) / student.totalAssignments) * 100
            : 0;

        let statusClass = 'warning';
        let statusText = 'In Progress';
        if (percentage === 100) { statusClass = 'success'; statusText = 'Completed'; }
        else if (percentage >= 50) { statusClass = 'active'; statusText = 'Active'; }
        else if (percentage === 0) { statusClass = 'danger'; statusText = 'Not Started'; }

        return `
            <tr style="cursor:pointer;" onclick="viewStudentDetails('${student.userId}')">
                <td>
                    <div class="student-cell">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=2a7a4b&color=fff&size=40" alt="student">
                        <div>
                            <div class="student-name">${escapeHtml(student.name)}</div>
                            <div class="student-email">${escapeHtml(student.email || '')}</div>
                        </div>
                    </div>
                </td>
                <td>${student.matricNumber || 'N/A'}</td>
                <td>${student.courseCode || 'N/A'}</td>
                <td>${student.level || '500'}</td>
                <td>
                    <div class="submission-progress">
                        <span class="progress-value">${submissionsText}</span>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width:${percentage}%"></div>
                        </div>
                    </div>
                </td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>
                    <div class="action-buttons" onclick="event.stopPropagation()">
                        <button class="btn-icon" onclick="viewStudentDetails('${student.userId}')" title="View Details">
                            <i class="fa-regular fa-eye"></i>
                        </button>
                        <button class="btn-icon" onclick="viewStudentSubmissions('${student.userId}', '${student.courseCode}')" title="View Submissions">
                            <i class="fa-regular fa-file"></i>
                        </button>
                        <button class="btn-icon" onclick="messageStudent('${student.userId}', '${escapeHtml(student.name)}')" title="Send Message">
                            <i class="fa-regular fa-message"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    updatePagination(totalPages);
}

function updatePagination(totalPages) {
    if (!paginationDiv) return;
    if (totalPages <= 1) { paginationDiv.innerHTML = ''; return; }

    let html = `<button class="pagination-btn" onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-left"></i></button>`;
    for (let i = 1; i <= Math.min(totalPages, 5); i++) {
        html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
    }
    if (totalPages > 5) {
        html += `<span>...</span><button class="pagination-btn" onclick="changePage(${totalPages})">${totalPages}</button>`;
    }
    html += `<button class="pagination-btn" onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}><i class="fa-solid fa-chevron-right"></i></button>`;
    paginationDiv.innerHTML = html;
}

function changePage(page) {
    const total = Math.ceil(allStudents.length / itemsPerPage);
    if (page < 1 || page > total) return;
    currentPage = page;
    renderTable();
}

async function viewStudentDetails(userId) {
    try {
        showToast('Loading student details...', 'info');
        const response = await fetch(`${API_URL}/api/lecturer/student/${userId}?session=${currentSession}&semester=${currentSemester}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success && data.student) {
            showStudentModal(data.student);
        } else {
            showToast(data.message || 'Failed to load student details', 'danger');
        }
    } catch (error) {
        console.error('Error loading student details:', error);
        showToast('Failed to load student details', 'danger');
    }
}

function showStudentModal(student) {
    const modal = document.getElementById('studentModal');
    const modalTitle = document.getElementById('studentModalTitle');
    const modalBody = document.getElementById('studentModalBody');
    if (!modal || !modalBody) return;

    if (modalTitle) modalTitle.textContent = `Student Details: ${student.name}`;

    const percentage = student.totalAssignments > 0
        ? ((student.submittedCount || 0) / student.totalAssignments) * 100
        : 0;

    modalBody.innerHTML = `
        <div class="student-detail-header">
            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=2a7a4b&color=fff&size=80" alt="student">
            <div class="student-detail-info">
                <h3>${escapeHtml(student.name)}</h3>
                <p><i class="fa-regular fa-envelope"></i> ${escapeHtml(student.email || 'No email')}</p>
                <p><i class="fa-regular fa-id-card"></i> ${student.matricNumber || 'N/A'}</p>
                <p><i class="fa-solid fa-layer-group"></i> ${student.level || '500'} Level</p>
            </div>
        </div>
        <div class="course-list">
            <h4>Enrolled Courses</h4>
            ${student.courses && student.courses.length > 0
                ? student.courses.map(c => `
                    <div class="course-item">
                        <span class="course-name">${c.courseCode} - ${c.courseTitle}</span>
                        <span class="course-grade">${c.submittedCount || 0}/${c.totalAssignments || 0} assignments</span>
                    </div>`).join('')
                : '<p>No courses enrolled</p>'}
        </div>
        <div style="margin-top:1rem;padding:1rem;background:var(--secondary);border-radius:12px;">
            <h4>Overall Progress</h4>
            <div class="submission-progress">
                <span class="progress-value">${student.submittedCount || 0}/${student.totalAssignments || 0} completed</span>
                <div class="progress-bar">
                    <div class="progress-fill" style="width:${percentage}%"></div>
                </div>
            </div>
        </div>
    `;

    modal.dataset.studentId = student.userId;
    modal.dataset.studentName = student.name;
    modal.classList.add('show');
}

function closeStudentModal() {
    const modal = document.getElementById('studentModal');
    if (modal) modal.classList.remove('show');
}

function viewStudentSubmissions(userId, courseCode) {
    showToast('Loading submissions...', 'info');
    window.location.href = `lecturer-submissions.html?student=${userId}&course=${courseCode}`;
}

function messageStudent(userId, studentName) {
    showToast(`Message feature coming soon for ${studentName}`, 'info');
}

function applyFilters() {
    currentFilter = courseFilterSelect?.value || 'all';
    currentSort = sortFilterSelect?.value || 'name';
    currentPage = 1;
    renderTable();
}

function handleSearch() {
    searchTerm = searchInput?.value || '';
    currentPage = 1;
    renderTable();
}

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
    const icons = { success: 'fa-check-circle', danger: 'fa-exclamation-circle', warning: 'fa-triangle-exclamation', info: 'fa-info-circle' };
    toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.success}"></i><span>${message}</span><button class="toast-close" onclick="this.parentElement.remove()">×</button>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
}

function showLoading(show) {
    if (loadingOverlay) loadingOverlay.style.display = show ? 'flex' : 'none';
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function initUI() {
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark');
            localStorage.setItem('futoTheme', document.body.classList.contains('dark') ? 'dark' : 'light');
        });
        if (localStorage.getItem('futoTheme') === 'dark') document.body.classList.add('dark');
    }

    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const menuBtn = document.getElementById('menuBtn');
    if (sidebarToggle) sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('collapsed'));
    if (menuBtn) menuBtn.addEventListener('click', () => sidebar.classList.toggle('show'));

    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 1024 && sidebar && !sidebar.contains(e.target) && !menuBtn?.contains(e.target)) {
            sidebar.classList.remove('show');
        }
    });

    if (courseFilterSelect) courseFilterSelect.addEventListener('change', applyFilters);
    if (sortFilterSelect) sortFilterSelect.addEventListener('change', applyFilters);
    if (searchInput) searchInput.addEventListener('input', handleSearch);
    if (refreshBtn) refreshBtn.addEventListener('click', fetchData);

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', (e) => { e.preventDefault(); logout(); });
}

function logout() {
    localStorage.clear();
    window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', () => {
    initUI();
    fetchData();
});

window.viewStudentDetails = viewStudentDetails;
window.closeStudentModal = closeStudentModal;
window.viewStudentSubmissions = viewStudentSubmissions;
window.messageStudent = messageStudent;
window.changePage = changePage;
window.showToast = showToast;
window.logout = logout;