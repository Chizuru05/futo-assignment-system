// ========== TOKEN FUNCTION ==========
function getAuthToken() {
    const userRole = localStorage.getItem('userRole');
    if (!userRole) return null;
    return localStorage.getItem(userRole + '_token') || localStorage.getItem('token');
}

// ========== CHECK AUTHENTICATION ==========
const token = getAuthToken();
const userRole = localStorage.getItem('userRole');

console.log('=== STUDENT DASHBOARD DEBUG ===');
console.log('Token exists:', !!token);
console.log('User role:', userRole);

if (!token) {
    window.location.href = 'login.html';
}
if (userRole !== 'student') {
    window.location.href = 'login.html';
}

// Get user info
const userName = localStorage.getItem('fullName') || localStorage.getItem('userName') || 'Student';
const userMatric = localStorage.getItem('matricNumber') || localStorage.getItem('userMatric') || '20211263362';
const userLevel = localStorage.getItem('level') || localStorage.getItem('userLevel') || '500';

// DOM Elements
const welcomeName = document.getElementById('welcomeName');
const bannerText = document.getElementById('bannerText');
const totalCoursesEl = document.getElementById('totalCourses');
const totalAssignmentsEl = document.getElementById('totalAssignments');
const pendingAssignmentsEl = document.getElementById('pendingAssignments');
const submittedAssignmentsEl = document.getElementById('submittedAssignments');
const profileName = document.getElementById('profileName');
const profileMatric = document.getElementById('profileMatric');
const profileLevel = document.getElementById('profileLevel');
const pendingBadge = document.getElementById('pendingBadge');
const myCoursesList = document.getElementById('myCoursesList');
const pendingList = document.getElementById('pendingList');

let enrolledCourses = [];
let allAssignments = [];
let mySubmissions = [];
let currentSession = '';
let currentSemester = '';

function getDueDateTime(assignment) {
    const datePart = (assignment.dueDateISO || '').split('T')[0];
    return new Date(datePart + ' ' + (assignment.dueTime || '23:59'));
}

// Update profile
if (profileName) profileName.textContent = userName;
if (profileMatric) profileMatric.textContent = userMatric;
if (profileLevel) profileLevel.textContent = userLevel + ' Level';

// Welcome message
if (welcomeName) {
    const hour = new Date().getHours();
    let greeting = 'Good morning';
    if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
    if (hour >= 17) greeting = 'Good evening';
    welcomeName.innerHTML = greeting + ', ' + userName;
}

// ========== FETCH ACTIVE SETTINGS ==========
async function fetchActiveSettings() {
    try {
        const response = await fetch(API_URL + '/api/settings', {
            headers: { Authorization: 'Bearer ' + token }
        });
        const data = await response.json();

        if (data.success) {
            currentSession = data.settings.activeSession;
            currentSemester = data.settings.activeSemester;
            localStorage.setItem('currentSession', currentSession);
            localStorage.setItem('currentSemester', currentSemester);
            console.log('Active settings loaded:', currentSession, currentSemester);

            if (bannerText) {
                bannerText.innerHTML = 'You are in <strong>' + userLevel + ' Level</strong> &middot; ' + currentSession + ' ' + currentSemester;
            }
        }
    } catch (error) {
        console.error('Error fetching active settings:', error);
        currentSession = localStorage.getItem('currentSession') || '2025-2026';
        currentSemester = localStorage.getItem('currentSemester') || 'Harmattan';
        if (bannerText) {
            bannerText.innerHTML = 'You are in <strong>' + userLevel + ' Level</strong> · ' + currentSession + ' ' + currentSemester;
        }
    }
}

// ========== FETCH DASHBOARD DATA ==========
async function fetchDashboardData() {
    if (!currentSession || !currentSemester) {
        await fetchActiveSettings();
    }

    try {
        console.log('Fetching dashboard data for:', currentSession, currentSemester);

        // Show loading states
        if (myCoursesList) myCoursesList.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i> Loading courses...</div>';
        if (pendingList) pendingList.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i> Loading assignments...</div>';

        // Fetch enrolled courses for active session/semester
        const coursesRes = await fetch(API_URL + '/api/student/my-courses?session=' + currentSession + '&semester=' + currentSemester, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const coursesData = await coursesRes.json();

        if (coursesData.success) {
            enrolledCourses = coursesData.courses || [];
            if (totalCoursesEl) totalCoursesEl.textContent = enrolledCourses.length;
            renderCourses();
        } else {
            console.log('No courses found:', coursesData.message);
            if (myCoursesList) myCoursesList.innerHTML = '<div class="empty-state"><i class="fa-regular fa-folder-open"></i><p>No courses registered for ' + currentSession + ' ' + currentSemester + '. <a href="select-session.html">Register now</a></p></div>';
        }

        // Fetch all assignments for active session/semester
        const assignmentsRes = await fetch(API_URL + '/api/assignments/all?session=' + currentSession + '&semester=' + currentSemester, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const assignmentsData = await assignmentsRes.json();

        if (assignmentsData.success) {
            allAssignments = (assignmentsData.assignments || []).filter(function(assignment) {
                var matchesSession = !assignment.session || assignment.session === currentSession;
                var matchesSemester = !assignment.semester || assignment.semester === currentSemester;
                return matchesSession && matchesSemester;
            });
            if (totalAssignmentsEl) totalAssignmentsEl.textContent = allAssignments.length;
            console.log('Found ' + allAssignments.length + ' assignments for ' + currentSession + ' ' + currentSemester);
        }

        // Fetch submissions for active session/semester
        const submissionsRes = await fetch(API_URL + '/api/submissions/my-submissions?session=' + currentSession + '&semester=' + currentSemester, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const submissionsData = await submissionsRes.json();

        if (submissionsData.success) {
            mySubmissions = submissionsData.submissions || [];
            if (submittedAssignmentsEl) submittedAssignmentsEl.textContent = mySubmissions.length;

            var pendingCount = allAssignments.length - mySubmissions.length;
            var finalPending = pendingCount > 0 ? pendingCount : 0;
            if (pendingAssignmentsEl) pendingAssignmentsEl.textContent = finalPending;
            if (pendingBadge) pendingBadge.textContent = finalPending > 0 ? finalPending : '';

            renderPendingAssignments();
        }

    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        if (myCoursesList) myCoursesList.innerHTML = '<div class="empty-state">Failed to load courses. Please refresh.</div>';
        if (pendingList) pendingList.innerHTML = '<div class="empty-state">Failed to load assignments.</div>';
    }
}

function renderCourses() {
    if (!myCoursesList) return;

    if (enrolledCourses.length === 0) {
        myCoursesList.innerHTML = '<div class="empty-state"><i class="fa-regular fa-folder-open"></i><p>No courses registered for ' + currentSession + ' ' + currentSemester + '.</p><a href="select-session.html" class="btn-small">Register Courses</a></div>';
        return;
    }

    myCoursesList.innerHTML = enrolledCourses.map(function(course) {
        return `
            <div class="course-item" onclick="window.location.href='assgnment.html?course=' + '${course.courseCode}'">
                <div class="course-code">${course.courseCode}</div>
                <div class="course-title">${escapeHtml(course.courseTitle)}</div>
                <div class="course-stats"><i class="fa-regular fa-star"></i> ${course.credits || 3} Credits</div>
            </div>
        `;
    }).join('');
}

function renderPendingAssignments() {
    if (!pendingList) return;

    var submittedIds = new Set(mySubmissions.map(function(s) {
        return s.assignmentId ? s.assignmentId._id : null;
    }));

    var pendingAssignments = allAssignments.filter(function(a) {
        return !submittedIds.has(a._id);
    });

    if (pendingAssignments.length === 0) {
        pendingList.innerHTML = '<div class="empty-state"><i class="fa-regular fa-check-circle"></i><p>All caught up! No pending assignments for ' + currentSession + ' ' + currentSemester + '.</p></div>';
        return;
    }

    pendingList.innerHTML = pendingAssignments.slice(0, 5).map(function(assignment) {
        var dueDate = getDueDateTime(assignment);
        var today = new Date();
        var dueText = 'Due ' + dueDate.toLocaleDateString();
        var dueClass = '';
        if (dueDate < today) {
            dueText = 'Overdue';
            dueClass = 'overdue';
        }

        return `
            <div class="pending-item" onclick="window.location.href='assgnment.html'">
                <span class="course-tag">${assignment.course}</span>
                <span class="assignment-title-text">${escapeHtml(assignment.title)}</span>
                <span class="due-badge ${dueClass}">${dueText}</span>
            </div>
        `;
    }).join('');
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

function showToast(message, type, duration) {
    if (type === undefined) type = 'success';
    if (duration === undefined) duration = 3000;

    var container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        container.id = 'toastContainer';
        document.body.appendChild(container);
    }

    var toast = document.createElement('div');
    toast.className = 'toast ' + type;

    var icons = {
        success: 'fa-check-circle',
        danger: 'fa-exclamation-circle',
        warning: 'fa-triangle-exclamation',
        info: 'fa-info-circle'
    };

    toast.innerHTML = `
        <i class="fa-solid ${icons[type] || icons.success}"></i>
        <span>${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;

    container.appendChild(toast);
    setTimeout(function() { toast.remove(); }, duration);
}

function logout() {
    localStorage.clear();
    window.location.href = 'login.html';
}

// ========== SIDEBAR & THEME FUNCTIONS ==========
function setupSidebar() {
    var sidebar = document.getElementById('sidebar');
    var sidebarToggle = document.getElementById('sidebarToggle');
    var menuBtn = document.getElementById('menuBtn');
    var toggleIcon = sidebarToggle ? sidebarToggle.querySelector('i') : null;

    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
            if (toggleIcon) {
                toggleIcon.style.transform = sidebar.classList.contains('collapsed') ?
                    'rotate(180deg)' :
                    'rotate(0deg)';
            }
        });
    }

    if (menuBtn && sidebar) {
        menuBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            sidebar.classList.toggle('show');
        });
    }

    document.addEventListener('click', function(e) {
        if (window.innerWidth <= 1024 && sidebar && menuBtn) {
            if (!sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
                sidebar.classList.remove('show');
            }
        }
    });
}

function setupTheme() {
    var themeToggle = document.getElementById('themeToggle');
    var body = document.body;

    if (localStorage.getItem('futoTheme') === 'dark') {
        body.classList.add('dark');
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            body.classList.toggle('dark');
            localStorage.setItem('futoTheme', body.classList.contains('dark') ? 'dark' : 'light');
        });
    }
}

// ========== INITIALIZE ==========
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Student dashboard initializing...');
    setupSidebar();
    setupTheme();
    await fetchActiveSettings();
    await fetchDashboardData();

    var logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            logout();
        });
    }

    // Refresh data every 30 seconds
    setInterval(function() {
        if (document.hasFocus()) {
            fetchDashboardData();
        }
    }, 30000);
});

window.logout = logout;
window.showToast = showToast;