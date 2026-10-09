// lecturer-students.js - pick a level, then optionally a course in that level

function getAuthToken() {
    const role = localStorage.getItem('userRole');
    if (!role) return null;
    return localStorage.getItem(`${role}_token`) || localStorage.getItem('token');
}

const token = getAuthToken();
const userRole = localStorage.getItem('userRole');

if (!token || userRole !== 'lecturer') {
    window.location.href = 'login.html';
}

let currentSession = localStorage.getItem('currentSession') || '2025-2026';
let currentSemester = localStorage.getItem('currentSemester') || 'Harmattan';

let enrolledCourses = [];   // courses this lecturer teaches
let uniqueStudents = [];    // one entry per student, with their courses
let selectedLevel = 'all';
let selectedCourse = 'all';
let searchTerm = '';

const tableBody = document.getElementById('studentsTableBody');
const loadingOverlay = document.getElementById('loadingOverlay');
const totalStudentsEl = document.getElementById('totalStudents');
const totalCoursesEl = document.getElementById('totalCourses');
const pendingSubmissionsEl = document.getElementById('pendingSubmissions');
const levelFilterSelect = document.getElementById('levelFilter');
const courseFilterSelect = document.getElementById('courseFilter');
const searchInput = document.getElementById('searchInput');
const refreshBtn = document.getElementById('refreshBtn');
const semesterDisplay = document.getElementById('semesterDisplay');

function authHeaders() {
    return { 'Authorization': `Bearer ${token}` };
}

// ========== HELPERS FOR LEVEL / COURSE ==========

// Level of a course: use the course's level field, or work it out from the code (IFT501 -> "500")
function courseLevel(course) {
    if (course.level) return String(course.level);
    const m = String(course.courseCode || '').match(/(\d)\d{2}/);
    return m ? m[1] + '00' : '';
}

function levelRank(level) {
    const n = parseInt(level, 10);
    return isNaN(n) ? 9999 : n;
}

// ========== MERGE ROWS INTO ONE ENTRY PER STUDENT ==========
function mergeStudents(rawStudents) {
    const map = new Map();

    for (const s of rawStudents) {
        const id = s.userId;
        if (!map.has(id)) {
            map.set(id, {
                userId: id,
                name: s.name || 'Unnamed',
                email: s.email || '',
                matricNumber: s.matricNumber || 'N/A',
                level: String(s.level || '').trim() || 'Unknown',
                courses: []
            });
        }
        map.get(id).courses.push({
            courseCode: s.courseCode,
            courseTitle: s.courseTitle || '',
            totalAssignments: s.totalAssignments || 0,
            submittedCount: s.submittedCount || 0,
            pendingSubmissions: s.pendingSubmissions || 0
        });
    }

    return Array.from(map.values());
}

// ========== FETCH DATA ==========
async function fetchData() {
    showLoading(true);
    try {
        const coursesRes = await fetch(`${API_URL}/api/lecturer/my-courses?session=${currentSession}&semester=${currentSemester}`, {
            headers: authHeaders()
        });
        const coursesData = await coursesRes.json();
        enrolledCourses = coursesData.success ? (coursesData.courses || []) : [];

        const studentsRes = await fetch(`${API_URL}/api/lecturer/students?session=${currentSession}&semester=${currentSemester}`, {
            headers: authHeaders()
        });
        const studentsData = await studentsRes.json();

        if (studentsData.success) {
            uniqueStudents = mergeStudents(studentsData.students || []);
        } else {
            uniqueStudents = [];
            showToast(studentsData.message || 'Failed to load students', 'danger');
        }

        renderLevelOptions();
        renderCourseOptions();
        renderTable();

        if (semesterDisplay) {
            semesterDisplay.innerHTML = `<i class="fa-regular fa-calendar"></i> ${currentSession} · ${currentSemester}`;
        }
    } catch (error) {
        console.error('Error fetching data:', error);
        showToast('Failed to load data', 'danger');
        uniqueStudents = [];
        renderLevelOptions();
        renderCourseOptions();
        renderTable();
    } finally {
        showLoading(false);
    }
}

// ========== DROPDOWNS ==========

// Level dropdown: every level that has students, lowest first
    // Level dropdown: always show 500 down to 100
const ALL_LEVELS = ['500', '400', '300', '200', '100'];

function renderLevelOptions() {
    if (!levelFilterSelect) return;

    levelFilterSelect.innerHTML = '<option value="all">All Levels</option>';
    ALL_LEVELS.forEach(level => {
        const option = document.createElement('option');
        option.value = level;
        option.textContent = `${level} Level`;
        levelFilterSelect.appendChild(option);
    });

    levelFilterSelect.value = selectedLevel;
}

// Course dropdown: only the lecturer's courses that belong to the selected level
function getCoursesForSelectedLevel() {
    if (selectedLevel === 'all') return enrolledCourses;
    return enrolledCourses.filter(c => courseLevel(c) === selectedLevel);
}

function renderCourseOptions() {
    if (!courseFilterSelect) return;

    const courses = getCoursesForSelectedLevel();

    courseFilterSelect.innerHTML = '<option value="all">All Courses</option>';
    courses.forEach(course => {
        const option = document.createElement('option');
        option.value = course.courseCode;
        option.textContent = `${course.courseCode} - ${course.courseTitle}`;
        courseFilterSelect.appendChild(option);
    });

    // If the chosen course is not in this level, reset to all courses
    if (selectedCourse !== 'all' && !courses.some(c => c.courseCode === selectedCourse)) {
        selectedCourse = 'all';
    }
    courseFilterSelect.value = selectedCourse;
}

// ========== FILTERING ==========
function getVisibleStudents() {
    let list = [...uniqueStudents];

    // 1. Level first
    if (selectedLevel !== 'all') {
        list = list.filter(s => s.level === selectedLevel);
    }

    // 2. Then course, within that level
    if (selectedCourse !== 'all') {
        list = list.filter(s => s.courses.some(c => c.courseCode === selectedCourse));
    }

    // 3. Search
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        list = list.filter(s =>
            (s.name || '').toLowerCase().includes(term) ||
            (s.matricNumber || '').toLowerCase().includes(term) ||
            (s.email || '').toLowerCase().includes(term)
        );
    }

    // Sort by level, then name
    list.sort((a, b) => {
        const byLevel = levelRank(a.level) - levelRank(b.level);
        if (byLevel !== 0) return byLevel;
        return a.name.localeCompare(b.name);
    });

    return list;
}

// Submission numbers for the selected course, or all courses combined
function statsFor(student) {
    const empty = { total: 0, submitted: 0, pending: 0 };

    if (selectedCourse === 'all') {
        return student.courses.reduce((acc, c) => ({
            total: acc.total + c.totalAssignments,
            submitted: acc.submitted + c.submittedCount,
            pending: acc.pending + c.pendingSubmissions
        }), empty);
    }

    const c = student.courses.find(x => x.courseCode === selectedCourse);
    if (!c) return empty;
    return { total: c.totalAssignments, submitted: c.submittedCount, pending: c.pendingSubmissions };
}

// ========== STATS ==========
function updateStats(visible) {
    const pending = visible.reduce((sum, s) => sum + statsFor(s).pending, 0);

    if (totalStudentsEl) totalStudentsEl.textContent = visible.length;
    if (totalCoursesEl) totalCoursesEl.textContent = getCoursesForSelectedLevel().length;
    if (pendingSubmissionsEl) pendingSubmissionsEl.textContent = pending;
}

// ========== TABLE ==========
function renderTable() {
    if (!tableBody) return;

    const visible = getVisibleStudents();
    updateStats(visible);

    if (visible.length === 0) {
        let message = 'No students found';
        if (selectedLevel !== 'all' && selectedCourse !== 'all') {
            message = `No ${selectedLevel} Level students registered for ${selectedCourse}`;
        } else if (selectedLevel !== 'all') {
            message = `No students in ${selectedLevel} Level`;
        }

        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">
                    <i class="fa-regular fa-folder-open" style="font-size:2rem;opacity:0.5;display:block;margin-bottom:0.5rem;"></i>
                    <p>${escapeHtml(message)}</p>
                </td>
            </tr>`;
        return;
    }

    tableBody.innerHTML = visible.map(renderStudentRow).join('');
}

function renderStudentRow(student) {
    const st = statsFor(student);
    const percentage = st.total > 0 ? Math.round((st.submitted / st.total) * 100) : 0;

    let statusClass = 'danger';
    let statusText = 'Not Started';
    if (st.total > 0 && percentage === 100) { statusClass = 'success'; statusText = 'Completed'; }
    else if (percentage >= 50) { statusClass = 'active'; statusText = 'Active'; }
    else if (percentage > 0) { statusClass = 'warning'; statusText = 'In Progress'; }

    const chips = student.courses.map(c => {
        const selectedClass = c.courseCode === selectedCourse ? ' chip-selected' : '';
        return `<span class="course-chip${selectedClass}">${escapeHtml(c.courseCode)}</span>`;
    }).join('');

    return `
        <tr onclick="viewStudentDetails('${student.userId}')">
            <td>
                <div class="student-cell">
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=2a7a4b&color=fff&size=40" alt="">
                    <div>
                        <div class="student-name">${escapeHtml(student.name)}</div>
                        <div class="student-email">${escapeHtml(student.email)}</div>
                    </div>
                </div>
            </td>
            <td>${escapeHtml(student.matricNumber)}</td>
            <td><div class="course-chips">${chips}</div></td>
            <td>
                <div class="submission-progress">
                    <span class="progress-value">${st.submitted}/${st.total}</span>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width:${percentage}%"></div>
                    </div>
                </div>
            </td>
            <td>
                <span class="status-badge ${statusClass}">${statusText}</span>
                <div class="action-buttons" onclick="event.stopPropagation()" style="margin-top:6px;">
                    <button class="btn-icon" onclick="viewStudentDetails('${student.userId}')" title="View Details">
                        <i class="fa-regular fa-eye"></i>
                    </button>
                    <button class="btn-icon" onclick="viewStudentSubmissions('${student.userId}', '${selectedCourse}')" title="View Submissions">
                        <i class="fa-regular fa-file"></i>
                    </button>
                </div>
            </td>
        </tr>`;
}

// ========== STUDENT DETAILS MODAL ==========
function viewStudentDetails(userId) {
    const student = uniqueStudents.find(s => s.userId === userId);
    if (!student) {
        showToast('Student not found', 'danger');
        return;
    }
    showStudentModal(student);
}

function showStudentModal(student) {
    const modal = document.getElementById('studentModal');
    const modalTitle = document.getElementById('studentModalTitle');
    const modalBody = document.getElementById('studentModalBody');
    if (!modal || !modalBody) return;

    if (modalTitle) modalTitle.textContent = student.name;

    const overall = student.courses.reduce((acc, c) => ({
        total: acc.total + c.totalAssignments,
        submitted: acc.submitted + c.submittedCount
    }), { total: 0, submitted: 0 });
    const overallPct = overall.total > 0 ? Math.round((overall.submitted / overall.total) * 100) : 0;

    const courseRows = student.courses.map(c => {
        const pct = c.totalAssignments > 0 ? Math.round((c.submittedCount / c.totalAssignments) * 100) : 0;
        return `
            <div style="padding:0.8rem;background:var(--secondary);border-radius:10px;margin-bottom:0.6rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem;">
                    <strong style="font-size:0.88rem;">${escapeHtml(c.courseCode)}${c.courseTitle ? ' — ' + escapeHtml(c.courseTitle) : ''}</strong>
                    <span style="font-size:0.78rem;color:var(--text-light);">${c.submittedCount}/${c.totalAssignments} assignments</span>
                </div>
                <div style="height:6px;background:var(--border);border-radius:4px;">
                    <div style="height:6px;width:${pct}%;background:var(--primary);border-radius:4px;"></div>
                </div>
            </div>`;
    }).join('');

    modalBody.innerHTML = `
        <div class="student-detail-header">
            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=2a7a4b&color=fff&size=80" alt="">
            <div class="student-detail-info">
                <h3>${escapeHtml(student.name)}</h3>
                <p><i class="fa-regular fa-envelope"></i> ${escapeHtml(student.email || 'No email')}</p>
                <p><i class="fa-regular fa-id-card"></i> ${escapeHtml(student.matricNumber)}</p>
                <p><i class="fa-solid fa-layer-group"></i> ${escapeHtml(student.level === 'Unknown' ? 'Level not set' : student.level + ' Level')}</p>
            </div>
        </div>

        <div style="margin:1rem 0;">
            <h4 style="margin-bottom:0.8rem;font-size:0.95rem;">Enrolled Courses (${student.courses.length})</h4>
            ${courseRows || '<p style="color:var(--text-light);">No courses enrolled</p>'}
        </div>

        <div style="padding:1rem;background:var(--secondary);border-radius:10px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem;">
                <strong style="font-size:0.9rem;">Overall Progress</strong>
                <span style="font-size:0.85rem;color:var(--primary);font-weight:600;">${overallPct}%</span>
            </div>
            <div style="height:8px;background:var(--border);border-radius:4px;">
                <div style="height:8px;width:${overallPct}%;background:var(--primary);border-radius:4px;"></div>
            </div>
            <p style="font-size:0.8rem;color:var(--text-light);margin-top:0.4rem;">${overall.submitted} of ${overall.total} assignments submitted</p>
        </div>
    `;

    modal.classList.add('show');
}

function closeStudentModal() {
    const modal = document.getElementById('studentModal');
    if (modal) modal.classList.remove('show');
}

function viewStudentSubmissions(userId, courseCode) {
    window.location.href = `lecturer-submissions.html?student=${userId}&course=${courseCode}`;
}

// ========== HELPERS ==========
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
    toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.success}"></i><span>${escapeHtml(message)}</span><button class="toast-close" onclick="this.parentElement.remove()">&times;</button>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
}

function showLoading(show) {
    if (loadingOverlay) loadingOverlay.style.display = show ? 'flex' : 'none';
}

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function logout() {
    localStorage.clear();
    window.location.href = 'login.html';
}

// ========== UI SETUP ==========
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

    // Level changes: refresh the course list for that level, then the table
    if (levelFilterSelect) {
        levelFilterSelect.addEventListener('change', (e) => {
            selectedLevel = e.target.value;
            selectedCourse = 'all';
            renderCourseOptions();
            renderTable();
        });
    }

    // Course changes: filter the table within the chosen level
    if (courseFilterSelect) {
        courseFilterSelect.addEventListener('change', (e) => {
            selectedCourse = e.target.value;
            renderTable();
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchTerm = e.target.value.trim();
            renderTable();
        });
    }

    if (refreshBtn) refreshBtn.addEventListener('click', fetchData);

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', (e) => { e.preventDefault(); logout(); });

    const modal = document.getElementById('studentModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeStudentModal();
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initUI();
    fetchData();
});

window.viewStudentDetails = viewStudentDetails;
window.closeStudentModal = closeStudentModal;
window.viewStudentSubmissions = viewStudentSubmissions;
window.showToast = showToast;
window.logout = logout;