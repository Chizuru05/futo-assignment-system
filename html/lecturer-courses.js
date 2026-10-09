// lecturer-courses.js - COMPLETE FIXED VERSION (fc- prefixed markup)

function getAuthToken() {
    const userRole = localStorage.getItem('userRole');
    if (!userRole) return null;
    return localStorage.getItem(userRole + '_token');
}

async function fetchWithTimeout(url, options, timeoutMs) {
    if (timeoutMs === undefined) timeoutMs = 15000;
    const controller = new AbortController();
    const timeoutId = setTimeout(function() { controller.abort(); }, timeoutMs);
    try {
        const response = await fetch(url, Object.assign({}, options, { signal: controller.signal }));
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

const token = getAuthToken();
const userRole = localStorage.getItem('userRole');

if (!token) window.location.href = 'login.html';
if (userRole !== 'lecturer') window.location.href = 'student-dashboard.html';

let allCourses = [];
let currentSession = localStorage.getItem('currentSession') || '2025-2026';
let currentSemester = localStorage.getItem('currentSemester') || 'Harmattan';
let currentFilter = 'all';
let searchQuery = '';
let levelValue = 'all';

// DOM Elements
const coursesGrid = document.getElementById('coursesGrid');
const levelFilter = document.getElementById('levelFilter');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');
const searchInput = document.getElementById('searchInput');
const filterTabs = document.querySelectorAll('.fc-tab');
const themeToggle = document.getElementById('themeToggle');
const sidebar = document.getElementById('fcSide');
const sidebarToggle = document.getElementById('fcSideToggle');
const menuBtn = document.getElementById('fcMenuBtn');
const logoutBtn = document.getElementById('fcLogoutBtn');
const notifBtn = document.getElementById('notifBtn');
const notifPanel = document.getElementById('notifPanel');
const currentSemesterDisplay = document.getElementById('currentSemesterDisplay');

// Delete Modal Elements
const deleteModal = document.getElementById('deleteModal');
const deleteCourseCode = document.getElementById('deleteCourseCode');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
let courseToDelete = null;

// ========== FETCH ACTIVE SETTINGS ==========
async function fetchActiveSettings() {
    try {
        const response = await fetchWithTimeout(API_URL + '/api/settings', {
            headers: { 'Authorization': 'Bearer ' + token }
        }, 15000);
        const data = await response.json();

        if (data.success) {
            currentSession = data.settings.activeSession;
            currentSemester = data.settings.activeSemester;
            localStorage.setItem('currentSession', currentSession);
            localStorage.setItem('currentSemester', currentSemester);
            console.log('Active settings loaded:', currentSession, currentSemester);
        }
    } catch (error) {
        console.error('Error fetching active settings:', error);
        currentSession = localStorage.getItem('currentSession') || '2025-2026';
        currentSemester = localStorage.getItem('currentSemester') || 'Harmattan';
    }
}

// ========== FETCH COURSES ==========
async function fetchCourses() {
    // Loading state uses the panel-scoped class so it can never be
    // styled/overridden by any other page's .loading-spinner rules
    if (coursesGrid) {
        coursesGrid.innerHTML = '<div class="fc-panel-loading"><i class="fa-solid fa-spinner fa-spin"></i> Connecting to server...</div>';
    }

    const slowNotice = setTimeout(function() {
        if (coursesGrid && coursesGrid.querySelector('.fc-panel-loading')) {
            coursesGrid.innerHTML = '<div class="fc-panel-loading"><i class="fa-solid fa-spinner fa-spin"></i> Server is waking up, this can take up to a minute on first load...</div>';
        }
    }, 6000);

    try {
        const response = await fetchWithTimeout(API_URL + '/api/lecturer/my-courses?session=' + currentSession + '&semester=' + currentSemester, {
            headers: { 'Authorization': 'Bearer ' + token }
        }, 15000);

        clearTimeout(slowNotice);

        if (response.ok) {
            const data = await response.json();
            if (data.success && data.courses) {
                allCourses = data.courses;
                window._uniqueStudentCount = data.uniqueStudentCount || 0;
                showToast('Loaded ' + allCourses.length + ' courses', 'success');
            } else {
                allCourses = [];
                showToast(data.message || 'No courses found', 'info');
            }
        } else {
            allCourses = [];
            showToast('Failed to load courses', 'danger');
        }

        renderCourses();
        updateStats();

    } catch (error) {
        clearTimeout(slowNotice);
        console.error('Error fetching courses:', error);
        var isTimeout = error.name === 'AbortError';
        showToast(isTimeout ? 'Server took too long to respond' : 'Failed to connect to server', 'danger');
        allCourses = [];
        renderCourses();
        updateStats();
    }
}

function renderCourses() {
    if (!coursesGrid) return;

    var filtered = allCourses.slice();

    if (currentFilter === 'active') {
        filtered = filtered.filter(function(c) { return c.status !== 'completed'; });
    } else if (currentFilter === 'completed') {
        filtered = filtered.filter(function(c) { return c.status === 'completed'; });
    }

    // Compare as strings: Course.level is stored as "500", not 500
    if (levelValue !== 'all') {
        filtered = filtered.filter(function(c) { return String(c.level) === String(levelValue); });
    }

    if (searchQuery) {
        var query = searchQuery.toLowerCase();
        filtered = filtered.filter(function(c) {
            return (c.courseCode || '').toLowerCase().includes(query) ||
                (c.courseTitle || '').toLowerCase().includes(query);
        });
    }

    if (filtered.length === 0) {
        coursesGrid.innerHTML = '<div class="fc-panel-empty"><i class="fa-regular fa-folder-open"></i><p>No courses found</p></div>';
        return;
    }

    coursesGrid.innerHTML = filtered.map(function(course) {
        var code = course.courseCode;
        var title = course.courseTitle;
        var id = course._id || course.courseId;
        var level = course.level;
        var credits = course.credits || 3;
        var students = course.studentCount || 0;
        var status = course.status || 'active';

        return `
        <div class="fc-tile" data-level="${level}" data-status="${status}">
            <div class="fc-tile-head">
                <div class="fc-tile-code-group">
                    <span class="fc-tile-code">${escapeHtml(code)}</span>
                    <span class="fc-tile-status ${status === 'completed' ? 'fc-completed' : 'fc-active'}">
                        ${status === 'completed' ? 'Completed' : 'Active'}
                    </span>
                </div>
                <div class="fc-tile-actions">
                    <button class="fc-icon-btn" onclick="viewCourse('${id}')" title="View Course">
                        <i class="fa-regular fa-eye"></i>
                    </button>
                    <button class="fc-icon-btn" onclick="viewStudents('${id}')" title="View Students">
                        <i class="fa-regular fa-users"></i>
                    </button>
                    <button class="fc-icon-btn fc-danger" onclick="openDeleteModal('${id}', '${code}', true)" title="Unregister from Course">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
            <h3 class="fc-tile-title">${escapeHtml(title)}</h3>
            <div class="fc-tile-details">
                <div class="fc-tile-detail"><i class="fa-regular fa-users"></i> <span>${students} student${students !== 1 ? 's' : ''}</span></div>
                <div class="fc-tile-detail"><i class="fa-regular fa-star"></i> <span>${credits} Credits</span></div>
                <div class="fc-tile-detail"><i class="fa-regular fa-layer-group"></i> <span>${level} Level</span></div>
                <div class="fc-tile-detail"><i class="fa-regular fa-calendar"></i> <span>${currentSession} · ${currentSemester}</span></div>
            </div>
            <div class="fc-tile-foot">
                <a href="lecturer-assignments.html?course=${code}" class="fc-btn-sm">
                    <i class="fa-regular fa-eye"></i> Assignments
                </a>
                <a href="lecturer-submissions.html?course=${code}" class="fc-btn-sm fc-outline">
                    <i class="fa-regular fa-file-export"></i> Submissions
                </a>
            </div>
        </div>
    `}).join('');
}

function updateStats() {
    var totalCourses = allCourses.length;
    var totalStudents = window._uniqueStudentCount || 0;

    var totalCoursesEl = document.getElementById('totalCourses');
    var totalStudentsEl = document.getElementById('totalStudents');
    var totalAssignmentsEl = document.getElementById('totalAssignments');
    var pendingGradingEl = document.getElementById('pendingGrading');

    if (totalCoursesEl) totalCoursesEl.textContent = totalCourses;
    if (totalStudentsEl) totalStudentsEl.textContent = totalStudents;

    // Calculate assignments and pending grading from courses data
    var totalAssignments = 0;
    var pendingGrading = 0;

    for (var i = 0; i < allCourses.length; i++) {
        var course = allCourses[i];
        if (course.assignments) {
            totalAssignments += course.assignments.length || 0;
            for (var j = 0; j < (course.assignments || []).length; j++) {
                var assignment = course.assignments[j];
                if (assignment.pendingGrading) {
                    pendingGrading += assignment.pendingGrading || 0;
                }
            }
        }
    }

    if (totalAssignmentsEl) totalAssignmentsEl.textContent = totalAssignments;
    if (pendingGradingEl) pendingGradingEl.textContent = pendingGrading;

    if (currentSemesterDisplay) {
        currentSemesterDisplay.innerHTML = '<i class="fa-regular fa-calendar"></i> ' + currentSession + ' · ' + currentSemester;
    }
}

function applyFilters() {
    levelValue = levelFilter ? levelFilter.value : 'all';
    renderCourses();
}

function clearFilters() {
    if (levelFilter) levelFilter.value = 'all';
    if (searchInput) searchInput.value = '';
    levelValue = 'all';
    searchQuery = '';
    currentFilter = 'all';

    filterTabs.forEach(function(tab) {
        if (tab.dataset.filter === 'all') {
            tab.classList.add('fc-tab-active');
        } else {
            tab.classList.remove('fc-tab-active');
        }
    });

    renderCourses();
    showToast('Filters cleared', 'success');
}

function handleTabClick(filter) {
    currentFilter = filter;
    filterTabs.forEach(function(tab) {
        if (tab.dataset.filter === filter) {
            tab.classList.add('fc-tab-active');
        } else {
            tab.classList.remove('fc-tab-active');
        }
    });
    renderCourses();
}

async function unregisterCourse(courseId, courseCode) {
    try {
        var response = await fetchWithTimeout(API_URL + '/api/lecturer/unregister-course', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
                courseId: courseId,
                session: currentSession,
                semester: currentSemester
            })
        }, 15000);

        if (response.ok) {
            var data = await response.json();
            if (data.success) {
                allCourses = allCourses.filter(function(c) { return (c._id || c.courseId) !== courseId; });
                renderCourses();
                updateStats();
                showToast('Successfully unregistered from ' + courseCode, 'success');
                return true;
            }
        }
        showToast('Failed to unregister from ' + courseCode, 'danger');
        return false;
    } catch (error) {
        console.error('Unregister error:', error);
        var isTimeout = error.name === 'AbortError';
        showToast(isTimeout ? 'Server took too long to respond' : 'Error unregistering from ' + courseCode, 'danger');
        return false;
    }
}

function openDeleteModal(courseId, courseCode, isUnregister) {
    if (isUnregister === undefined) isUnregister = true;
    courseToDelete = { courseId: courseId, courseCode: courseCode, isUnregister: isUnregister };
    deleteCourseCode.textContent = courseCode;
    deleteModal.classList.add('fc-show');
}

function closeDeleteModal() {
    deleteModal.classList.remove('fc-show');
    courseToDelete = null;
}

async function confirmDelete() {
    if (!courseToDelete) return;

    var courseId = courseToDelete.courseId;
    var courseCode = courseToDelete.courseCode;
    var isUnregister = courseToDelete.isUnregister;

    if (confirmDeleteBtn) {
        confirmDeleteBtn.disabled = true;
        confirmDeleteBtn.textContent = 'Processing...';
    }

    if (isUnregister) {
        await unregisterCourse(courseId, courseCode);
    }

    if (confirmDeleteBtn) {
        confirmDeleteBtn.disabled = false;
        confirmDeleteBtn.textContent = 'Yes, Unregister Course';
    }

    closeDeleteModal();
}

// Global functions for onclick
window.viewCourse = function(courseId) {
    window.location.href = 'lecturer-course-details.html?id=' + courseId;
};

window.viewStudents = function(courseId) {
    window.location.href = 'lecturer-students.html?course=' + courseId;
};

window.openDeleteModal = openDeleteModal;
window.closeDeleteModal = closeDeleteModal;
window.confirmDelete = confirmDelete;

function showToast(message, type) {
    if (type === undefined) type = 'success';
    var container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.className = 'fc-toast-wrap';
        container.id = 'toastContainer';
        document.body.appendChild(container);
    }

    var toast = document.createElement('div');
    toast.className = 'fc-toast fc-' + type;

    var icon = 'fa-check-circle';
    if (type === 'danger') icon = 'fa-exclamation-circle';
    if (type === 'info') icon = 'fa-info-circle';
    if (type === 'warning') icon = 'fa-triangle-exclamation';

    toast.innerHTML = '<i class="fa-solid ' + icon + '"></i><span>' + escapeHtml(message) + '</span><button class="fc-toast-close" onclick="this.parentElement.remove()">×</button>';
    container.appendChild(toast);
    setTimeout(function() { toast.remove(); }, 3000);
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

function initUI() {
    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            document.body.classList.toggle('dark');
            localStorage.setItem('futoTheme', document.body.classList.contains('dark') ? 'dark' : 'light');
        });
        if (localStorage.getItem('futoTheme') === 'dark') document.body.classList.add('dark');
    }

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            if (window.innerWidth <= 1024) {
                sidebar.classList.remove('fc-show');
            } else {
                sidebar.classList.toggle('fc-collapsed');
            }
        });
    }

    if (menuBtn) {
        menuBtn.addEventListener('click', function() {
            sidebar.classList.toggle('fc-show');
        });
    }

    document.addEventListener('click', function(e) {
        if (window.innerWidth <= 1024 && sidebar && menuBtn) {
            if (!sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
                sidebar.classList.remove('fc-show');
            }
        }
    });

    if (window.innerWidth <= 1024) {
        sidebar.classList.remove('fc-collapsed');
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            logout();
        });
    }

    if (notifBtn && notifPanel) {
        notifBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            notifPanel.classList.toggle('fc-show');
        });

        document.addEventListener('click', function(e) {
            if (!notifBtn.contains(e.target) && !notifPanel.contains(e.target)) {
                notifPanel.classList.remove('fc-show');
            }
        });
    }

    if (levelFilter) levelFilter.addEventListener('change', applyFilters);
    if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearFilters);
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            searchQuery = e.target.value;
            renderCourses();
        });
    }

    filterTabs.forEach(function(tab) {
        tab.addEventListener('click', function() {
            handleTabClick(tab.dataset.filter);
        });
    });

    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', confirmDelete);
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && deleteModal && deleteModal.classList.contains('fc-show')) {
            closeDeleteModal();
        }
    });

    if (deleteModal) {
        deleteModal.addEventListener('click', function(e) {
            if (e.target === deleteModal) {
                closeDeleteModal();
            }
        });
    }
}

window.showToast = showToast;
window.logout = logout;

document.addEventListener('DOMContentLoaded', function() {
    initUI();
    fetchActiveSettings().then(function() {
        fetchCourses();
    });
});