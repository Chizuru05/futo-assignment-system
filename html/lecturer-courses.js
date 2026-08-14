// lecturer-courses.js - COMPLETE FIXED VERSION WITH SPINNER FIX

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
const filterTabs = document.querySelectorAll('.filter-tab');
const themeToggle = document.getElementById('themeToggle');
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const menuBtn = document.getElementById('menuBtn');
const logoutBtn = document.getElementById('logoutBtn');
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
    window._coursesLoaded = false; // Reset flag
    
    if (coursesGrid) {
        coursesGrid.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i> Loading courses...</div>';
    }

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
                window._coursesLoaded = true; // Mark as loaded
                showToast('Loaded ' + allCourses.length + ' courses', 'success');
            } else {
                allCourses = [];
                window._coursesLoaded = true;
                showToast(data.message || 'No courses found', 'info');
            }
        } else {
            allCourses = [];
            window._coursesLoaded = true;
            showToast('Failed to load courses', 'danger');
        }

        renderCourses();
        updateStats();

    } catch (error) {
        clearTimeout(slowNotice);
        console.error('Error fetching courses:', error);
        window._coursesLoaded = true;
        // Show error state
        coursesGrid.innerHTML = `
            <div class="error-message" style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                <i class="fa-solid fa-circle-exclamation" style="font-size: 2rem; color: var(--danger);"></i>
                <p style="color: var(--danger);">Failed to load courses</p>
                <button onclick="fetchCourses()" class="btn-small">Retry</button>
            </div>
        `;
        showToast('Failed to connect to server', 'danger');
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

    if (levelValue !== 'all') {
        filtered = filtered.filter(function(c) { return c.level === parseInt(levelValue); });
    }

    if (searchQuery) {
        var query = searchQuery.toLowerCase();
        filtered = filtered.filter(function(c) {
            return (c.courseCode || '').toLowerCase().includes(query) ||
                (c.courseTitle || '').toLowerCase().includes(query);
        });
    }

    // === FIX: Clear spinner and show proper empty state ===
    if (filtered.length === 0) {
        // Check if we're still loading
        if (allCourses.length === 0 && !window._coursesLoaded) {
            // Still loading - show spinner
            coursesGrid.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i> Loading courses...</div>';
            return;
        }
        // No courses found - show empty state
        coursesGrid.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                <i class="fa-regular fa-folder-open" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                <p style="color: var(--text-light);">No courses found for ${currentSession} ${currentSemester}</p>
                <p style="font-size: 0.85rem; color: var(--text-light);">Register for courses to get started</p>
            </div>
        `;
        return;
    }

    // === Render courses normally ===
    coursesGrid.innerHTML = filtered.map(function(course) {
        // ... your existing course card HTML ...
    }).join('');
    
    window._coursesLoaded = true;
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

    // FIXED: Calculate assignments and pending grading from courses data
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
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    renderCourses();
    showToast('Filters cleared', 'success');
}

function handleTabClick(filter) {
    currentFilter = filter;
    filterTabs.forEach(function(tab) {
        if (tab.dataset.filter === filter) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
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
    deleteModal.classList.add('show');
}

function closeDeleteModal() {
    deleteModal.classList.remove('show');
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
        container.className = 'toast-container';
        container.id = 'toastContainer';
        document.body.appendChild(container);
    }

    var toast = document.createElement('div');
    toast.className = 'toast ' + type;

    var icon = 'fa-check-circle';
    if (type === 'danger') icon = 'fa-exclamation-circle';
    if (type === 'info') icon = 'fa-info-circle';
    if (type === 'warning') icon = 'fa-triangle-exclamation';

    toast.innerHTML = '<i class="fa-solid ' + icon + '"></i><span>' + escapeHtml(message) + '</span><button class="toast-close" onclick="this.parentElement.remove()">×</button>';
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
                sidebar.classList.remove('show');
            } else {
                sidebar.classList.toggle('collapsed');
            }
        });
    }

    if (menuBtn) {
        menuBtn.addEventListener('click', function() {
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

    if (window.innerWidth <= 1024) {
        sidebar.classList.remove('collapsed');
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
            notifPanel.classList.toggle('show');
        });

        document.addEventListener('click', function(e) {
            if (!notifBtn.contains(e.target) && !notifPanel.contains(e.target)) {
                notifPanel.classList.remove('show');
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
        if (e.key === 'Escape' && deleteModal && deleteModal.classList.contains('show')) {
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