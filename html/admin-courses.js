// admin-courses.js


// ========== ROLE-SPECIFIC TOKEN FUNCTION ==========
function getAuthToken() {
    const userRole = localStorage.getItem('userRole');
    if (!userRole) return null;
    return localStorage.getItem(`${userRole}_token`) || localStorage.getItem('token');
}

// ========== CHECK AUTHENTICATION ==========
const token = getAuthToken();
const userRole = localStorage.getItem('userRole');

console.log('=== ADMIN COURSES DEBUG ===');
console.log('Token exists:', !!token);
console.log('User role:', userRole);

if (!token) {
    console.log('No token, redirecting to login');
    window.location.href = 'login.html';
}
if (userRole !== 'admin') {
    console.log('Invalid role, redirecting');
    alert('Access denied. Admin only.');
    window.location.href = 'login.html';
}

// DOM Elements
const coursesTableBody = document.getElementById('coursesTableBody');
const totalCoursesEl = document.getElementById('totalCourses');
const harmattanCoursesEl = document.getElementById('harmattanCourses');
const rainCoursesEl = document.getElementById('rainCourses');
const semesterFilter = document.getElementById('semesterFilter');
const levelFilter = document.getElementById('levelFilter');
const addCourseBtn = document.getElementById('addCourseBtn');
const saveCourseBtn = document.getElementById('saveCourseBtn');

let allCourses = [];
let currentDeleteId = null;
let currentEditId = null;

// ========== LOAD COURSES ==========
async function loadCourses() {
    if (!coursesTableBody) return;
    
    try {
        coursesTableBody.innerHTML = '<tr><td colspan="6" class="loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading courses...</td></tr>';
        
        const response = await fetch(`${API_URL}/api/admin/courses/all`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            allCourses = data.courses || [];
            updateStats();
            renderCourses();
            showToast(`Loaded ${allCourses.length} courses`, 'success');
        } else {
            showToast(data.message || 'Failed to load courses', 'danger');
            coursesTableBody.innerHTML = '<tr><td colspan="6" class="text-center">Failed to load courses</td></tr>';
        }
    } catch (error) {
        console.error('Error loading courses:', error);
        showToast('Failed to connect to server', 'danger');
        coursesTableBody.innerHTML = '<tr><td colspan="6" class="text-center">Error loading courses. Make sure backend is running.</td></tr>';
    }
}

function updateStats() {
    if (totalCoursesEl) totalCoursesEl.textContent = allCourses.length;
    if (harmattanCoursesEl) harmattanCoursesEl.textContent = allCourses.filter(c => c.semester === 'Harmattan').length;
    if (rainCoursesEl) rainCoursesEl.textContent = allCourses.filter(c => c.semester === 'Rain').length;
}

function renderCourses() {
    if (!coursesTableBody) return;
    
    let filtered = [...allCourses];
    
    if (semesterFilter && semesterFilter.value !== 'all') {
        filtered = filtered.filter(c => c.semester === semesterFilter.value);
    }
    
    if (levelFilter && levelFilter.value !== 'all') {
        filtered = filtered.filter(c => c.level === levelFilter.value);
    }
    
    if (filtered.length === 0) {
        coursesTableBody.innerHTML = '<tr><td colspan="6" class="text-center">No courses found</td></tr>';
        return;
    }
    
    coursesTableBody.innerHTML = filtered.map(course => `
        <tr>
            <td><strong>${escapeHtml(course.courseCode)}</strong></td>
            <td>${escapeHtml(course.courseTitle)}</td>
            <td>${course.level} Level</td>
            <td><span class="semester-badge ${course.semester.toLowerCase()}">${course.semester}</span></td>
            <td>${course.credits || 3}</td>
            <td>
                <button class="btn-icon" onclick="editCourse('${course._id}')" title="Edit Course">
                    <i class="fa-regular fa-pen-to-square"></i>
                </button>
                <button class="btn-icon danger" onclick="confirmDelete('${course._id}', '${course.courseCode}')" title="Delete Course">
                    <i class="fa-regular fa-trash-can"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// ========== ADD COURSE ==========
function openAddModal() {
    document.getElementById('courseCode').value = '';
    document.getElementById('courseCode').readOnly = false;
    document.getElementById('courseTitle').value = '';
    document.getElementById('courseLevel').value = '400';
    document.getElementById('courseCredits').value = '3';
    document.querySelector('input[name="semester"][value="Harmattan"]').checked = true;
    
    document.querySelector('#courseModal .modal-header h3').textContent = 'Add New Course';
    
    const saveBtn = document.getElementById('saveCourseBtn');
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    newSaveBtn.onclick = saveCourse;
    
    document.getElementById('courseModal').classList.add('show');
}

async function saveCourse() {
    const courseData = {
        courseCode: document.getElementById('courseCode').value.trim().toUpperCase(),
        courseTitle: document.getElementById('courseTitle').value.trim(),
        level: document.getElementById('courseLevel').value,
        credits: parseInt(document.getElementById('courseCredits').value),
        semester: document.querySelector('input[name="semester"]:checked').value
    };
    
    if (!courseData.courseCode) {
        showToast('Course code is required', 'warning');
        return;
    }
    if (!courseData.courseTitle) {
        showToast('Course title is required', 'warning');
        return;
    }
    
    const saveBtn = document.getElementById('saveCourseBtn');
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    
    try {
        const response = await fetch(`${API_URL}/api/admin/courses`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(courseData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Course added successfully!', 'success');
            closeModal();
            loadCourses();
        } else {
            showToast(data.message || 'Failed to add course', 'danger');
        }
    } catch (error) {
        console.error('Error saving course:', error);
        showToast('Failed to save course. Make sure backend is running.', 'danger');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
    }
}

// ========== EDIT COURSE ==========
async function editCourse(courseId) {
    const course = allCourses.find(c => c._id === courseId);
    if (!course) {
        showToast('Course not found', 'danger');
        return;
    }
    
    currentEditId = courseId;
    
    document.getElementById('courseCode').value = course.courseCode;
    document.getElementById('courseCode').readOnly = true;
    document.getElementById('courseTitle').value = course.courseTitle;
    document.getElementById('courseLevel').value = course.level;
    document.getElementById('courseCredits').value = course.credits || 3;
    
    if (course.semester === 'Harmattan') {
        document.querySelector('input[name="semester"][value="Harmattan"]').checked = true;
    } else {
        document.querySelector('input[name="semester"][value="Rain"]').checked = true;
    }
    
    document.querySelector('#courseModal .modal-header h3').textContent = 'Edit Course';
    
    const saveBtn = document.getElementById('saveCourseBtn');
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    newSaveBtn.onclick = () => updateCourse(courseId);
    
    document.getElementById('courseModal').classList.add('show');
}

async function updateCourse(courseId) {
    const courseData = {
        courseTitle: document.getElementById('courseTitle').value.trim(),
        level: document.getElementById('courseLevel').value,
        credits: parseInt(document.getElementById('courseCredits').value),
        semester: document.querySelector('input[name="semester"]:checked').value
    };
    
    if (!courseData.courseTitle) {
        showToast('Course title is required', 'warning');
        return;
    }
    
    const saveBtn = document.getElementById('saveCourseBtn');
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';
    
    try {
        const response = await fetch(`${API_URL}/api/admin/courses/${courseId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(courseData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Course updated successfully!', 'success');
            closeModal();
            loadCourses();
        } else {
            showToast(data.message || 'Failed to update course', 'danger');
        }
    } catch (error) {
        console.error('Error updating course:', error);
        showToast('Failed to update course. Make sure backend is running.', 'danger');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
        document.getElementById('courseCode').readOnly = false;
    }
}

// ========== DELETE COURSE ==========
function confirmDelete(courseId, courseCode) {
    currentDeleteId = courseId;
    document.getElementById('deleteCourseName').textContent = courseCode;
    document.getElementById('deleteModal').classList.add('show');
}

async function deleteCourse() {
    if (!currentDeleteId) return;
    
    const deleteBtn = document.getElementById('confirmDeleteBtn');
    const originalText = deleteBtn.innerHTML;
    deleteBtn.disabled = true;
    deleteBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Deleting...';
    
    try {
        const response = await fetch(`${API_URL}/api/admin/courses/${currentDeleteId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Course deleted successfully', 'success');
            closeDeleteModal();
            loadCourses();
        } else {
            showToast(data.message || 'Failed to delete course', 'danger');
        }
    } catch (error) {
        console.error('Error deleting course:', error);
        showToast('Failed to delete course. Make sure backend is running.', 'danger');
    } finally {
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = originalText;
    }
}

// ========== MODAL FUNCTIONS ==========
function closeModal() {
    document.getElementById('courseModal').classList.remove('show');
    document.getElementById('courseCode').readOnly = false;
    currentEditId = null;
}

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('show');
    currentDeleteId = null;
}

// ========== FILTER FUNCTIONS ==========
function clearFilters() {
    if (semesterFilter) semesterFilter.value = 'all';
    if (levelFilter) levelFilter.value = 'all';
    renderCourses();
    showToast('Filters cleared', 'success');
}

// ========== TOAST NOTIFICATION ==========
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
    
    const icons = {
        success: 'fa-check-circle',
        danger: 'fa-exclamation-circle',
        warning: 'fa-triangle-exclamation',
        info: 'fa-info-circle'
    };
    
    toast.innerHTML = `
        <i class="fa-solid ${icons[type] || icons.success}"></i>
        <span>${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">Ã—</button>
    `;
    
    container.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ========== SIDEBAR FUNCTIONS ==========
function setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const menuBtn = document.getElementById('menuBtn');
    
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('collapsed'));
    }
    if (menuBtn && sidebar) {
        menuBtn.addEventListener('click', () => sidebar.classList.toggle('show'));
    }
    
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 1024 && sidebar && !sidebar.contains(e.target) && !menuBtn?.contains(e.target)) {
            sidebar.classList.remove('show');
        }
    });
}

function setupTheme() {
    const themeToggle = document.getElementById('themeToggle');
    const body = document.body;
    
    if (localStorage.getItem('futoTheme') === 'dark') {
        body.classList.add('dark');
    }
    
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            body.classList.toggle('dark');
            localStorage.setItem('futoTheme', body.classList.contains('dark') ? 'dark' : 'light');
        });
    }
}

function logout() {
    localStorage.clear();
    window.location.href = 'login.html';
}

// ========== EVENT LISTENERS ==========
if (addCourseBtn) {
    addCourseBtn.addEventListener('click', openAddModal);
}

if (semesterFilter) {
    semesterFilter.addEventListener('change', renderCourses);
}

if (levelFilter) {
    levelFilter.addEventListener('change', renderCourses);
}

// ========== INITIALIZE ==========
document.addEventListener('DOMContentLoaded', () => {
    console.log('Admin courses page initializing...');
    setupSidebar();
    setupTheme();
    loadCourses();
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
});

// Make functions global for inline event handlers
window.openAddModal = openAddModal;
window.closeModal = closeModal;
window.closeDeleteModal = closeDeleteModal;
window.confirmDelete = confirmDelete;
window.deleteCourse = deleteCourse;
window.editCourse = editCourse;
window.saveCourse = saveCourse;
window.clearFilters = clearFilters;
window.logout = logout;
window.showToast = showToast;// admin-courses.js


// ========== ROLE-SPECIFIC TOKEN FUNCTION ==========
function getAuthToken() {
    const userRole = localStorage.getItem('userRole');
    if (!userRole) return null;
    return localStorage.getItem(`${userRole}_token`) || localStorage.getItem('token');
}

// ========== CHECK AUTHENTICATION ==========
const token = getAuthToken();
const userRole = localStorage.getItem('userRole');

console.log('=== ADMIN COURSES DEBUG ===');
console.log('Token exists:', !!token);
console.log('User role:', userRole);

if (!token) {
    console.log('No token, redirecting to login');
    window.location.href = 'login.html';
}
if (userRole !== 'admin') {
    console.log('Invalid role, redirecting');
    alert('Access denied. Admin only.');
    window.location.href = 'login.html';
}

// DOM Elements
const coursesTableBody = document.getElementById('coursesTableBody');
const totalCoursesEl = document.getElementById('totalCourses');
const harmattanCoursesEl = document.getElementById('harmattanCourses');
const rainCoursesEl = document.getElementById('rainCourses');
const semesterFilter = document.getElementById('semesterFilter');
const levelFilter = document.getElementById('levelFilter');
const addCourseBtn = document.getElementById('addCourseBtn');
const saveCourseBtn = document.getElementById('saveCourseBtn');

let allCourses = [];
let currentDeleteId = null;
let currentEditId = null;

// ========== LOAD COURSES ==========
async function loadCourses() {
    if (!coursesTableBody) return;
    
    try {
        coursesTableBody.innerHTML = '<tr><td colspan="6" class="loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading courses...</td></tr>';
        
        const response = await fetch(`${API_URL}/api/admin/courses/all`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            allCourses = data.courses || [];
            updateStats();
            renderCourses();
            showToast(`Loaded ${allCourses.length} courses`, 'success');
        } else {
            showToast(data.message || 'Failed to load courses', 'danger');
            coursesTableBody.innerHTML = '<tr><td colspan="6" class="text-center">Failed to load courses</td></tr>';
        }
    } catch (error) {
        console.error('Error loading courses:', error);
        showToast('Failed to connect to server', 'danger');
        coursesTableBody.innerHTML = '<tr><td colspan="6" class="text-center">Error loading courses. Make sure backend is running.</td></tr>';
    }
}

function updateStats() {
    if (totalCoursesEl) totalCoursesEl.textContent = allCourses.length;
    if (harmattanCoursesEl) harmattanCoursesEl.textContent = allCourses.filter(c => c.semester === 'Harmattan').length;
    if (rainCoursesEl) rainCoursesEl.textContent = allCourses.filter(c => c.semester === 'Rain').length;
}

function renderCourses() {
    if (!coursesTableBody) return;
    
    let filtered = [...allCourses];
    
    if (semesterFilter && semesterFilter.value !== 'all') {
        filtered = filtered.filter(c => c.semester === semesterFilter.value);
    }
    
    if (levelFilter && levelFilter.value !== 'all') {
        filtered = filtered.filter(c => c.level === levelFilter.value);
    }
    
    if (filtered.length === 0) {
        coursesTableBody.innerHTML = '<tr><td colspan="6" class="text-center">No courses found</td></tr>';
        return;
    }
    
    coursesTableBody.innerHTML = filtered.map(course => `
        <tr>
            <td><strong>${escapeHtml(course.courseCode)}</strong></td>
            <td>${escapeHtml(course.courseTitle)}</td>
            <td>${course.level} Level</td>
            <td><span class="semester-badge ${course.semester.toLowerCase()}">${course.semester}</span></td>
            <td>${course.credits || 3}</td>
            <td>
                <button class="btn-icon" onclick="editCourse('${course._id}')" title="Edit Course">
                    <i class="fa-regular fa-pen-to-square"></i>
                </button>
                <button class="btn-icon danger" onclick="confirmDelete('${course._id}', '${course.courseCode}')" title="Delete Course">
                    <i class="fa-regular fa-trash-can"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// ========== ADD COURSE ==========
function openAddModal() {
    document.getElementById('courseCode').value = '';
    document.getElementById('courseCode').readOnly = false;
    document.getElementById('courseTitle').value = '';
    document.getElementById('courseLevel').value = '400';
    document.getElementById('courseCredits').value = '3';
    document.querySelector('input[name="semester"][value="Harmattan"]').checked = true;
    
    document.querySelector('#courseModal .modal-header h3').textContent = 'Add New Course';
    
    const saveBtn = document.getElementById('saveCourseBtn');
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    newSaveBtn.onclick = saveCourse;
    
    document.getElementById('courseModal').classList.add('show');
}

async function saveCourse() {
    const courseData = {
        courseCode: document.getElementById('courseCode').value.trim().toUpperCase(),
        courseTitle: document.getElementById('courseTitle').value.trim(),
        level: document.getElementById('courseLevel').value,
        credits: parseInt(document.getElementById('courseCredits').value),
        semester: document.querySelector('input[name="semester"]:checked').value
    };
    
    if (!courseData.courseCode) {
        showToast('Course code is required', 'warning');
        return;
    }
    if (!courseData.courseTitle) {
        showToast('Course title is required', 'warning');
        return;
    }
    
    const saveBtn = document.getElementById('saveCourseBtn');
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    
    try {
        const response = await fetch(`${API_URL}/api/admin/courses`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(courseData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Course added successfully!', 'success');
            closeModal();
            loadCourses();
        } else {
            showToast(data.message || 'Failed to add course', 'danger');
        }
    } catch (error) {
        console.error('Error saving course:', error);
        showToast('Failed to save course. Make sure backend is running.', 'danger');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
    }
}

// ========== EDIT COURSE ==========
async function editCourse(courseId) {
    const course = allCourses.find(c => c._id === courseId);
    if (!course) {
        showToast('Course not found', 'danger');
        return;
    }
    
    currentEditId = courseId;
    
    document.getElementById('courseCode').value = course.courseCode;
    document.getElementById('courseCode').readOnly = true;
    document.getElementById('courseTitle').value = course.courseTitle;
    document.getElementById('courseLevel').value = course.level;
    document.getElementById('courseCredits').value = course.credits || 3;
    
    if (course.semester === 'Harmattan') {
        document.querySelector('input[name="semester"][value="Harmattan"]').checked = true;
    } else {
        document.querySelector('input[name="semester"][value="Rain"]').checked = true;
    }
    
    document.querySelector('#courseModal .modal-header h3').textContent = 'Edit Course';
    
    const saveBtn = document.getElementById('saveCourseBtn');
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    newSaveBtn.onclick = () => updateCourse(courseId);
    
    document.getElementById('courseModal').classList.add('show');
}

async function updateCourse(courseId) {
    const courseData = {
        courseTitle: document.getElementById('courseTitle').value.trim(),
        level: document.getElementById('courseLevel').value,
        credits: parseInt(document.getElementById('courseCredits').value),
        semester: document.querySelector('input[name="semester"]:checked').value
    };
    
    if (!courseData.courseTitle) {
        showToast('Course title is required', 'warning');
        return;
    }
    
    const saveBtn = document.getElementById('saveCourseBtn');
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';
    
    try {
        const response = await fetch(`${API_URL}/api/admin/courses/${courseId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(courseData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Course updated successfully!', 'success');
            closeModal();
            loadCourses();
        } else {
            showToast(data.message || 'Failed to update course', 'danger');
        }
    } catch (error) {
        console.error('Error updating course:', error);
        showToast('Failed to update course. Make sure backend is running.', 'danger');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
        document.getElementById('courseCode').readOnly = false;
    }
}

// ========== DELETE COURSE ==========
function confirmDelete(courseId, courseCode) {
    currentDeleteId = courseId;
    document.getElementById('deleteCourseName').textContent = courseCode;
    document.getElementById('deleteModal').classList.add('show');
}

async function deleteCourse() {
    if (!currentDeleteId) return;
    
    const deleteBtn = document.getElementById('confirmDeleteBtn');
    const originalText = deleteBtn.innerHTML;
    deleteBtn.disabled = true;
    deleteBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Deleting...';
    
    try {
        const response = await fetch(`${API_URL}/api/admin/courses/${currentDeleteId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Course deleted successfully', 'success');
            closeDeleteModal();
            loadCourses();
        } else {
            showToast(data.message || 'Failed to delete course', 'danger');
        }
    } catch (error) {
        console.error('Error deleting course:', error);
        showToast('Failed to delete course. Make sure backend is running.', 'danger');
    } finally {
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = originalText;
    }
}

// ========== MODAL FUNCTIONS ==========
function closeModal() {
    document.getElementById('courseModal').classList.remove('show');
    document.getElementById('courseCode').readOnly = false;
    currentEditId = null;
}

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('show');
    currentDeleteId = null;
}

// ========== FILTER FUNCTIONS ==========
function clearFilters() {
    if (semesterFilter) semesterFilter.value = 'all';
    if (levelFilter) levelFilter.value = 'all';
    renderCourses();
    showToast('Filters cleared', 'success');
}

// ========== TOAST NOTIFICATION ==========
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
    
    const icons = {
        success: 'fa-check-circle',
        danger: 'fa-exclamation-circle',
        warning: 'fa-triangle-exclamation',
        info: 'fa-info-circle'
    };
    
    toast.innerHTML = `
        <i class="fa-solid ${icons[type] || icons.success}"></i>
        <span>${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">Ã—</button>
    `;
    
    container.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ========== SIDEBAR FUNCTIONS ==========
function setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const menuBtn = document.getElementById('menuBtn');
    
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('collapsed'));
    }
    if (menuBtn && sidebar) {
        menuBtn.addEventListener('click', () => sidebar.classList.toggle('show'));
    }
    
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 1024 && sidebar && !sidebar.contains(e.target) && !menuBtn?.contains(e.target)) {
            sidebar.classList.remove('show');
        }
    });
}

function setupTheme() {
    const themeToggle = document.getElementById('themeToggle');
    const body = document.body;
    
    if (localStorage.getItem('futoTheme') === 'dark') {
        body.classList.add('dark');
    }
    
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            body.classList.toggle('dark');
            localStorage.setItem('futoTheme', body.classList.contains('dark') ? 'dark' : 'light');
        });
    }
}

function logout() {
    localStorage.clear();
    window.location.href = 'login.html';
}

// ========== EVENT LISTENERS ==========
if (addCourseBtn) {
    addCourseBtn.addEventListener('click', openAddModal);
}

if (semesterFilter) {
    semesterFilter.addEventListener('change', renderCourses);
}

if (levelFilter) {
    levelFilter.addEventListener('change', renderCourses);
}

// ========== INITIALIZE ==========
document.addEventListener('DOMContentLoaded', () => {
    console.log('Admin courses page initializing...');
    setupSidebar();
    setupTheme();
    loadCourses();
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
});

// Make functions global for inline event handlers
window.openAddModal = openAddModal;
window.closeModal = closeModal;
window.closeDeleteModal = closeDeleteModal;
window.confirmDelete = confirmDelete;
window.deleteCourse = deleteCourse;
window.editCourse = editCourse;
window.saveCourse = saveCourse;
window.clearFilters = clearFilters;
window.logout = logout;
window.showToast = showToast;
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

let allCourses = [];
let currentDeleteId = null;
let currentEditId = null;
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

// ========== LOAD COURSES ==========
async function loadCourses() {
    try {
        const response = await fetch(`${API_URL}/api/admin/courses/all?session=${currentSession}&semester=${currentSemester}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            allCourses = data.courses || [];
            updateStats();
            renderCourses();
        } else {
            showToast('Failed to load courses', 'danger');
        }
    } catch (error) {
        console.error('Error loading courses:', error);
        showToast('Failed to connect to server', 'danger');
    }
}

function updateStats() {
    const total = allCourses.length;
    const harmattan = allCourses.filter(c => c.semester === 'Harmattan').length;
    const rain = allCourses.filter(c => c.semester === 'Rain').length;
    const both = allCourses.filter(c => c.semester === 'Both').length;
    
    document.getElementById('totalCourses').textContent = total;
    document.getElementById('harmattanCourses').textContent = harmattan;
    document.getElementById('rainCourses').textContent = rain;
    document.getElementById('bothCourses').textContent = both;
    document.getElementById('courseCount').textContent = `${total} courses`;
}

function renderCourses() {
    const tbody = document.getElementById('coursesTableBody');
    if (!tbody) return;
    
    let filtered = [...allCourses];
    const semesterFilter = document.getElementById('semesterFilter').value;
    const levelFilter = document.getElementById('levelFilter').value;
    
    if (semesterFilter !== 'all') {
        filtered = filtered.filter(c => c.semester === semesterFilter);
    }
    if (levelFilter !== 'all') {
        filtered = filtered.filter(c => c.level === levelFilter);
    }
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="fa-regular fa-folder-open"></i><p>No courses found</p></td></tr>';
        return;
    }
    
    tbody.innerHTML = filtered.map(course => `
        <tr>
            <td><strong>${escapeHtml(course.courseCode)}</strong></td>
            <td>${escapeHtml(course.courseTitle)}</td>
            <td>${course.level}</td>
            <td><span class="semester-badge ${course.semester.toLowerCase()}">${course.semester}</span></td>
            <td>${course.credits || 3}</td>
            <td>
                <button class="btn-icon" onclick="editCourse('${course._id}')" title="Edit"><i class="fa-regular fa-pen-to-square"></i></button>
                <button class="btn-icon danger" onclick="confirmDelete('${course._id}', '${course.courseCode}')" title="Delete"><i class="fa-regular fa-trash-can"></i></button>
            </td>
        </tr>
    `).join('');
}

function applyFilters() {
    renderCourses();
    showToast('Filters applied', 'success');
}

function clearFilters() {
    document.getElementById('semesterFilter').value = 'all';
    document.getElementById('levelFilter').value = 'all';
    renderCourses();
    showToast('Filters cleared', 'success');
}

// ========== OPEN ADD COURSE MODAL ==========
function openAddCourseModal() {
    document.getElementById('modalTitle').textContent = 'Add New Course';
    document.getElementById('courseCode').value = '';
    document.getElementById('courseCode').readOnly = false;
    document.getElementById('courseTitle').value = '';
    document.getElementById('courseLevel').value = '500';
    document.getElementById('courseCredits').value = '3';
    document.getElementById('courseSemester').value = 'Harmattan';
    document.getElementById('courseDescription').value = '';
    document.getElementById('courseModal').classList.add('show');
    
    const saveBtn = document.getElementById('saveCourseBtn');
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    newSaveBtn.onclick = saveCourse;
}

// ========== SAVE COURSE ==========
async function saveCourse() {
    const courseData = {
        courseCode: document.getElementById('courseCode').value.trim().toUpperCase(),
        courseTitle: document.getElementById('courseTitle').value.trim(),
        level: document.getElementById('courseLevel').value,
        credits: parseInt(document.getElementById('courseCredits').value) || 3,
        semester: document.getElementById('courseSemester').value,
        description: document.getElementById('courseDescription').value.trim()
    };
    
    if (!courseData.courseCode) {
        showToast('Course code is required', 'warning');
        return;
    }
    if (!courseData.courseTitle) {
        showToast('Course title is required', 'warning');
        return;
    }
    
    const saveBtn = document.getElementById('saveCourseBtn');
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    
    try {
        const response = await fetch(`${API_URL}/api/admin/courses`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(courseData)
        });
        const data = await response.json();
        
        if (data.success) {
            showToast('Course added successfully!', 'success');
            closeModal('courseModal');
            loadCourses();
        } else {
            showToast(data.message || 'Failed to add course', 'danger');
        }
    } catch (error) {
        console.error('Error saving course:', error);
        showToast('Failed to connect to server', 'danger');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
    }
}

// ========== EDIT COURSE ==========
function editCourse(courseId) {
    const course = allCourses.find(c => c._id === courseId);
    if (!course) {
        showToast('Course not found', 'danger');
        return;
    }
    
    currentEditId = courseId;
    document.getElementById('modalTitle').textContent = 'Edit Course';
    document.getElementById('courseCode').value = course.courseCode;
    document.getElementById('courseCode').readOnly = true;
    document.getElementById('courseTitle').value = course.courseTitle;
    document.getElementById('courseLevel').value = course.level;
    document.getElementById('courseCredits').value = course.credits || 3;
    document.getElementById('courseSemester').value = course.semester;
    document.getElementById('courseDescription').value = course.description || '';
    document.getElementById('courseModal').classList.add('show');
    
    const saveBtn = document.getElementById('saveCourseBtn');
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    newSaveBtn.onclick = () => updateCourse(courseId);
}

async function updateCourse(courseId) {
    const courseData = {
        courseTitle: document.getElementById('courseTitle').value.trim(),
        level: document.getElementById('courseLevel').value,
        credits: parseInt(document.getElementById('courseCredits').value) || 3,
        semester: document.getElementById('courseSemester').value,
        description: document.getElementById('courseDescription').value.trim()
    };
    
    if (!courseData.courseTitle) {
        showToast('Course title is required', 'warning');
        return;
    }
    
    const saveBtn = document.getElementById('saveCourseBtn');
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';
    
    try {
        const response = await fetch(`${API_URL}/api/admin/courses/${courseId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(courseData)
        });
        const data = await response.json();
        
        if (data.success) {
            showToast('Course updated successfully!', 'success');
            closeModal('courseModal');
            loadCourses();
        } else {
            showToast(data.message || 'Failed to update course', 'danger');
        }
    } catch (error) {
        console.error('Error updating course:', error);
        showToast('Failed to connect to server', 'danger');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
        document.getElementById('courseCode').readOnly = false;
    }
}

// ========== DELETE COURSE ==========
function confirmDelete(courseId, courseCode) {
    currentDeleteId = courseId;
    document.getElementById('deleteCourseName').textContent = courseCode;
    document.getElementById('deleteModal').classList.add('show');
    
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    newConfirmBtn.onclick = deleteCourse;
}

async function deleteCourse() {
    if (!currentDeleteId) return;
    
    const deleteBtn = document.getElementById('confirmDeleteBtn');
    const originalText = deleteBtn.innerHTML;
    deleteBtn.disabled = true;
    deleteBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Deleting...';
    
    try {
        const response = await fetch(`${API_URL}/api/admin/courses/${currentDeleteId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            showToast('Course deleted successfully', 'success');
            closeModal('deleteModal');
            loadCourses();
        } else {
            showToast(data.message || 'Failed to delete course', 'danger');
        }
    } catch (error) {
        console.error('Error deleting course:', error);
        showToast('Failed to connect to server', 'danger');
    } finally {
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = originalText;
    }
}

// ========== UTILITY FUNCTIONS ==========
function closeModal(modalId) {
    document.getElementById(modalId)?.classList.remove('show');
}

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
    loadCourses();
});

window.openAddCourseModal = openAddCourseModal;
window.editCourse = editCourse;
window.confirmDelete = confirmDelete;
window.deleteCourse = deleteCourse;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.closeModal = closeModal;
window.logout = logout;
window.showToast = showToast;