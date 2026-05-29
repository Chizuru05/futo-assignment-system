// lecturer-courses.js
const API_URL = 'http://localhost:5000';

// ========== ROLE-SPECIFIC TOKEN RETRIEVAL ==========
function getAuthToken() {
    const userRole = localStorage.getItem('userRole');
    if (!userRole) return null;
    return localStorage.getItem(`${userRole}_token`);
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

// ========== FETCH COURSES ==========
async function fetchCourses() {
    try {
        showToast('Loading courses...', 'info');
        if (coursesGrid) coursesGrid.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i> Loading courses...</div>';
        
        const response = await fetch(`${API_URL}/api/lecturer/my-courses?session=${currentSession}&semester=${currentSemester}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.courses) {
                allCourses = data.courses;
                showToast(`Loaded ${allCourses.length} courses`, 'success');
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
        console.error('Error fetching courses:', error);
        showToast('Failed to connect to server', 'danger');
        allCourses = [];
        renderCourses();
        updateStats();
    }
}

function renderCourses() {
    if (!coursesGrid) return;
    
    let filtered = [...allCourses];
    
    if (currentFilter === 'active') {
        filtered = filtered.filter(c => c.status !== 'completed');
    } else if (currentFilter === 'completed') {
        filtered = filtered.filter(c => c.status === 'completed');
    }
    
    if (levelValue !== 'all') {
        filtered = filtered.filter(c => c.level === parseInt(levelValue));
    }
    
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(c => 
            (c.courseCode || '').toLowerCase().includes(query) || 
            (c.courseTitle || '').toLowerCase().includes(query)
        );
    }
    
    if (filtered.length === 0) {
        coursesGrid.innerHTML = `<div class="empty-state"><i class="fa-regular fa-folder-open"></i><p>No courses found</p></div>`;
        return;
    }
    
    coursesGrid.innerHTML = filtered.map(course => {
        const code = course.courseCode;
        const title = course.courseTitle;
        const id = course._id || course.courseId;
        const level = course.level;
        const credits = course.credits || 3;
        const students = course.studentCount || 0;
        const status = course.status || 'active';
        
        return `
        <div class="course-card" data-level="${level}" data-status="${status}">
            <div class="course-header">
                <div class="course-code-wrapper">
                    <span class="course-code">${escapeHtml(code)}</span>
                    <span class="course-status ${status === 'completed' ? 'completed' : 'active'}">
                        ${status === 'completed' ? 'Completed' : 'Active'}
                    </span>
                </div>
                <div class="course-actions">
                    <button class="btn-icon" onclick="viewCourse('${id}')" title="View Course">
                        <i class="fa-regular fa-eye"></i>
                    </button>
                    <button class="btn-icon" onclick="viewStudents('${id}')" title="View Students">
                        <i class="fa-regular fa-users"></i>
                    </button>
                    <button class="btn-icon delete-btn" onclick="openDeleteModal('${id}', '${code}', true)" title="Unregister from Course">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
            <h3 class="course-title">${escapeHtml(title)}</h3>
            <div class="course-details">
                <div class="detail-item"><i class="fa-regular fa-users"></i> <span>${students} student${students !== 1 ? 's' : ''}</span></div>
                <div class="detail-item"><i class="fa-regular fa-star"></i> <span>${credits} Credits</span></div>
                <div class="detail-item"><i class="fa-regular fa-layer-group"></i> <span>${level} Level</span></div>
                <div class="detail-item"><i class="fa-regular fa-calendar"></i> <span>${currentSession} · ${currentSemester}</span></div>
            </div>
            <div class="course-footer">
                <a href="lecturer-assignments.html?course=${code}" class="btn-small">
                    <i class="fa-regular fa-eye"></i> Assignments
                </a>
                <a href="lecturer-submissions.html?course=${code}" class="btn-small outline">
                    <i class="fa-regular fa-file-export"></i> Submissions
                </a>
            </div>
        </div>
    `}).join('');
}

function updateStats() {
    const totalCourses = allCourses.length;
    const totalStudents = allCourses.reduce((sum, c) => sum + (c.studentCount || 0), 0);
    
    const totalCoursesEl = document.getElementById('totalCourses');
    const totalStudentsEl = document.getElementById('totalStudents');
    
    if (totalCoursesEl) totalCoursesEl.textContent = totalCourses;
    if (totalStudentsEl) totalStudentsEl.textContent = totalStudents;
    
    if (currentSemesterDisplay) {
        currentSemesterDisplay.innerHTML = `<i class="fa-regular fa-calendar"></i> ${currentSession} · ${currentSemester}`;
    }
}

function applyFilters() {
    levelValue = levelFilter?.value || 'all';
    renderCourses();
}

function clearFilters() {
    if (levelFilter) levelFilter.value = 'all';
    if (searchInput) searchInput.value = '';
    levelValue = 'all';
    searchQuery = '';
    currentFilter = 'all';
    
    filterTabs.forEach(tab => {
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
    filterTabs.forEach(tab => {
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
        const response = await fetch(`${API_URL}/api/lecturer/unregister-course`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                courseId: courseId,
                session: currentSession,
                semester: currentSemester
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                allCourses = allCourses.filter(c => (c._id || c.courseId) !== courseId);
                renderCourses();
                updateStats();
                showToast(`✅ Successfully unregistered from ${courseCode}`, 'success');
                return true;
            }
        }
        showToast(`Failed to unregister from ${courseCode}`, 'danger');
        return false;
    } catch (error) {
        console.error('Unregister error:', error);
        showToast(`Error unregistering from ${courseCode}`, 'danger');
        return false;
    }
}

function openDeleteModal(courseId, courseCode, isUnregister = true) {
    courseToDelete = { courseId, courseCode, isUnregister };
    deleteCourseCode.textContent = courseCode;
    deleteModal.classList.add('show');
}

function closeDeleteModal() {
    deleteModal.classList.remove('show');
    courseToDelete = null;
}

async function confirmDelete() {
    if (!courseToDelete) return;
    
    const { courseId, courseCode, isUnregister } = courseToDelete;
    
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

window.viewCourse = (courseId) => { 
    window.location.href = `lecturer-course-details.html?id=${courseId}`; 
};

window.viewStudents = (courseId) => { 
    window.location.href = `lecturer-students.html?course=${courseId}`; 
};

window.openDeleteModal = openDeleteModal;
window.closeDeleteModal = closeDeleteModal;
window.confirmDelete = confirmDelete;

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
    
    let icon = 'fa-check-circle';
    if (type === 'danger') icon = 'fa-exclamation-circle';
    if (type === 'info') icon = 'fa-info-circle';
    if (type === 'warning') icon = 'fa-triangle-exclamation';
    
    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <span>${escapeHtml(message)}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    
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

function initUI() {
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark');
            localStorage.setItem('futoTheme', document.body.classList.contains('dark') ? 'dark' : 'light');
        });
        if (localStorage.getItem('futoTheme') === 'dark') document.body.classList.add('dark');
    }
    
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('collapsed'));
    }
    
    if (menuBtn) {
        menuBtn.addEventListener('click', () => sidebar.classList.toggle('show'));
    }
    
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && sidebar.classList.contains('show')) {
            if (!sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
                sidebar.classList.remove('show');
            }
        }
    });
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
    
    if (notifBtn && notifPanel) {
        notifBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notifPanel.classList.toggle('show');
        });
        
        document.addEventListener('click', (e) => {
            if (!notifBtn.contains(e.target) && !notifPanel.contains(e.target)) {
                notifPanel.classList.remove('show');
            }
        });
    }
    
    if (levelFilter) levelFilter.addEventListener('change', applyFilters);
    if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearFilters);
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            renderCourses();
        });
    }
    
    filterTabs.forEach(tab => {
        tab.addEventListener('click', () => handleTabClick(tab.dataset.filter));
    });
    
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', confirmDelete);
    }
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && deleteModal && deleteModal.classList.contains('show')) {
            closeDeleteModal();
        }
    });
    
    if (deleteModal) {
        deleteModal.addEventListener('click', (e) => {
            if (e.target === deleteModal) {
                closeDeleteModal();
            }
        });
    }
}

window.showToast = showToast;
window.logout = logout;

document.addEventListener('DOMContentLoaded', () => {
    initUI();
    fetchCourses();
});