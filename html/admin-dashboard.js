// admin-dashboard.js - COMPLETE UPDATED VERSION
const API_URL = 'http://localhost:5000';

function getAuthToken() {
    const userRole = localStorage.getItem('userRole');
    if (!userRole) return null;
    return localStorage.getItem(`${userRole}_token`) || localStorage.getItem('token');
}

const token = getAuthToken();
const userRole = localStorage.getItem('userRole');

if (!token) {
    window.location.href = 'login.html';
}

if (userRole !== 'admin') {
    alert('Access denied. Admin only.');
    if (userRole === 'student') window.location.href = 'student-dashboard.html';
    else if (userRole === 'lecturer') window.location.href = 'lecturer-dashboard.html';
    else window.location.href = 'login.html';
}

// Set admin name
const adminNameEl = document.getElementById('adminName');
if (adminNameEl) adminNameEl.textContent = localStorage.getItem('fullName') || 'Administrator';

const pageTitleEl = document.getElementById('pageTitle');
if (pageTitleEl) pageTitleEl.textContent = 'Dashboard';

let allCourses = [];
let currentDeleteId = null;
let currentSession = '';
let currentSemester = '';

// ========== FETCH ACTIVE SETTINGS FROM BACKEND ==========
async function fetchActiveSettings() {
    try {
        const response = await fetch(`${API_URL}/api/settings`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            currentSession = data.settings.activeSession;
            currentSemester = data.settings.activeSemester;
            console.log('✅ Active settings from backend:', currentSession, currentSemester);
            
            // Update sidebar session info
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

// ========== LOAD DASHBOARD ==========
async function loadDashboard() {
    const contentWrapper = document.getElementById('contentWrapper');
    if (!contentWrapper) return;
    
    await fetchActiveSettings();
    
    contentWrapper.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i> Loading dashboard...</div>';
    
    try {
        const statsRes = await fetch(`${API_URL}/api/admin/stats?session=${currentSession}&semester=${currentSemester}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const statsData = await statsRes.json();
        
        if (statsData.success) {
            const stats = statsData.stats;
            contentWrapper.innerHTML = `
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fa-solid fa-book"></i></div>
                        <div class="stat-details">
                            <h3>${stats.courses || 0}</h3>
                            <p>Courses (${currentSemester})</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fa-solid fa-users"></i></div>
                        <div class="stat-details">
                            <h3>${stats.students || 0}</h3>
                            <p>Students</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fa-solid fa-chalkboard-user"></i></div>
                        <div class="stat-details">
                            <h3>${stats.lecturers || 0}</h3>
                            <p>Lecturers</p>
                        </div>
                    </div>
                </div>
                <div class="welcome-card">
                    <div class="card-header">
                        <h3><i class="fa-solid fa-crown"></i> Welcome, ${localStorage.getItem('fullName') || 'Administrator'}!</h3>
                    </div>
                    <div class="card-body">
                        <p>Current Academic Session: <strong>${currentSession} ${currentSemester}</strong></p>
                        <p>Use the sidebar to manage courses, lecturers, and students.</p>
                    </div>
                </div>
            `;
        } else {
            contentWrapper.innerHTML = '<div class="error-message">Failed to load dashboard stats</div>';
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
        contentWrapper.innerHTML = '<div class="error-message">Failed to load dashboard</div>';
        showToast('Failed to load dashboard', 'danger');
    }
}

// ========== LOAD COURSES ==========
async function loadCourses() {
    const contentWrapper = document.getElementById('contentWrapper');
    if (!contentWrapper) return;
    
    await fetchActiveSettings();
    
    contentWrapper.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3><i class="fa-solid fa-book"></i> Manage Courses</h3>
                <div class="header-actions">
                    <button class="btn-primary" onclick="openCourseModal()">
                        <i class="fa-solid fa-plus"></i> Add Course
                    </button>
                </div>
            </div>
            <div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i> Loading courses...</div>
        </div>
    `;
    
    await refreshCoursesList();
}

async function refreshCoursesList() {
    try {
        const response = await fetch(`${API_URL}/api/admin/courses/all?session=${currentSession}&semester=${currentSemester}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            allCourses = data.courses || [];
            renderCoursesTable();
        } else {
            document.querySelector('#contentWrapper .card .loading-spinner').outerHTML = 
                '<div class="error-message">Failed to load courses</div>';
        }
    } catch (error) {
        console.error('Error loading courses:', error);
        document.querySelector('#contentWrapper .card .loading-spinner').outerHTML = 
            '<div class="error-message">Failed to connect to server</div>';
        showToast('Failed to load courses', 'danger');
    }
}

function renderCoursesTable() {
    const card = document.querySelector('#contentWrapper .card');
    if (!card) return;
    
    let totalCount = allCourses.length;
    let harmattanCount = allCourses.filter(c => c.semester === 'Harmattan' || c.semester === 'Both').length;
    let rainCount = allCourses.filter(c => c.semester === 'Rain' || c.semester === 'Both').length;
    
    if (allCourses.length === 0) {
        card.innerHTML = `
            <div class="card-header">
                <h3><i class="fa-solid fa-book"></i> Manage Courses</h3>
                <div class="header-actions">
                    <button class="btn-primary" onclick="openCourseModal()">
                        <i class="fa-solid fa-plus"></i> Add Course
                    </button>
                </div>
            </div>
            <div class="stats-mini">
                <div class="stat-mini"><span class="stat-value-mini">0</span><span class="stat-label-mini">Total Courses</span></div>
                <div class="stat-mini"><span class="stat-value-mini">0</span><span class="stat-label-mini">Harmattan</span></div>
                <div class="stat-mini"><span class="stat-value-mini">0</span><span class="stat-label-mini">Rain</span></div>
            </div>
            <div class="empty-state">
                <i class="fa-regular fa-folder-open"></i>
                <p>No courses found for ${currentSession} ${currentSemester}</p>
                <button class="btn-primary" onclick="openCourseModal()" style="margin-top: 1rem;">Create First Course</button>
            </div>
        `;
        return;
    }
    
    card.innerHTML = `
        <div class="card-header">
            <h3><i class="fa-solid fa-book"></i> Manage Courses</h3>
            <div class="header-actions">
                <span class="active-semester-badge" style="background: var(--primary-light); padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.8rem;">
                    <i class="fa-regular fa-calendar"></i> ${currentSession} ${currentSemester}
                </span>
                <button class="btn-primary" onclick="openCourseModal()">
                    <i class="fa-solid fa-plus"></i> Add Course
                </button>
            </div>
        </div>
        <div class="stats-mini">
            <div class="stat-mini"><span class="stat-value-mini">${totalCount}</span><span class="stat-label-mini">Total Courses</span></div>
            <div class="stat-mini"><span class="stat-value-mini">${harmattanCount}</span><span class="stat-label-mini">Harmattan</span></div>
            <div class="stat-mini"><span class="stat-value-mini">${rainCount}</span><span class="stat-label-mini">Rain</span></div>
        </div>
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr><th>Code</th><th>Title</th><th>Level</th><th>Credits</th><th>Actions</th></tr>
                </thead>
                <tbody>
                    ${allCourses.map(course => `
                        <tr>
                            <td><strong>${escapeHtml(course.courseCode)}</strong></div>
                            <td>${escapeHtml(course.courseTitle)}</div>
                            <td>${course.level} Level</div>
                            <td>${course.credits || 3}</div>
                            <td>
                                <button class="btn-icon" onclick="editCourse('${course._id}')" title="Edit">
                                    <i class="fa-regular fa-pen-to-square"></i>
                                </button>
                                <button class="btn-icon danger" onclick="confirmDeleteCourse('${course._id}', '${course.courseCode}')" title="Delete">
                                    <i class="fa-regular fa-trash-can"></i>
                                </button>
                            </div>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// ========== COURSE MODAL FUNCTIONS ==========
function openCourseModal() {
    document.getElementById('courseCode').value = '';
    document.getElementById('courseCode').readOnly = false;
    document.getElementById('courseTitle').value = '';
    document.getElementById('courseLevel').value = '400';
    document.getElementById('courseCredits').value = '3';
    
    document.getElementById('courseModal').classList.add('show');
    
    const saveBtn = document.getElementById('saveCourseBtn');
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    newSaveBtn.onclick = saveCourse;
}

async function saveCourse() {
    const courseData = {
        courseCode: document.getElementById('courseCode').value.trim().toUpperCase(),
        courseTitle: document.getElementById('courseTitle').value.trim(),
        level: document.getElementById('courseLevel').value,
        credits: parseInt(document.getElementById('courseCredits').value)
    };
    
    if (!courseData.courseCode || !courseData.courseTitle) {
        showToast('Please fill all fields', 'warning');
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
            showToast(`✅ Course added successfully for ${currentSemester} semester!`, 'success');
            closeModal('courseModal');
            loadCourses();
        } else {
            showToast(data.message || 'Failed to add course', 'danger');
        }
    } catch (error) {
        console.error('Error saving course:', error);
        showToast('Failed to add course', 'danger');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
    }
}

function editCourse(courseId) {
    const course = allCourses.find(c => c._id === courseId);
    if (!course) return;
    
    document.getElementById('courseCode').value = course.courseCode;
    document.getElementById('courseCode').readOnly = true;
    document.getElementById('courseTitle').value = course.courseTitle;
    document.getElementById('courseLevel').value = course.level;
    document.getElementById('courseCredits').value = course.credits || 3;
    
    document.querySelector('#courseModal .modal-header h3').textContent = 'Edit Course';
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
        credits: parseInt(document.getElementById('courseCredits').value)
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
        showToast('Failed to update course', 'danger');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
    }
}

function confirmDeleteCourse(courseId, courseCode) {
    currentDeleteId = courseId;
    document.getElementById('deleteCourseName').textContent = courseCode;
    document.getElementById('deleteCourseModal').classList.add('show');
    
    const confirmBtn = document.getElementById('confirmDeleteCourseBtn');
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    newConfirmBtn.onclick = async () => {
        await deleteCourse(currentDeleteId);
        closeModal('deleteCourseModal');
    };
}

async function deleteCourse(courseId) {
    try {
        const response = await fetch(`${API_URL}/api/admin/courses/${courseId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            showToast('Course deleted successfully', 'success');
            loadCourses();
        } else {
            showToast(data.message || 'Failed to delete course', 'danger');
        }
    } catch (error) {
        console.error('Error deleting course:', error);
        showToast('Failed to delete course', 'danger');
    }
}

// ========== LOAD LECTURERS ==========
async function loadLecturers() {
    const contentWrapper = document.getElementById('contentWrapper');
    if (!contentWrapper) return;
    
    await fetchActiveSettings();
    
    contentWrapper.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3><i class="fa-solid fa-chalkboard-user"></i> Lecturers & Their Courses</h3>
                <div class="header-actions">
                    <span class="active-semester-badge" style="background: var(--primary-light); padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.8rem;">
                        <i class="fa-regular fa-calendar"></i> ${currentSession} ${currentSemester}
                    </span>
                </div>
            </div>
            <div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i> Loading lecturers...</div>
        </div>
    `;
    
    try {
        const usersRes = await fetch(`${API_URL}/api/admin/users/all`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const usersData = await usersRes.json();
        const allLecturers = usersData.users?.filter(u => u.role === 'lecturer') || [];
        
        if (allLecturers.length === 0) {
            document.querySelector('#contentWrapper .card .loading-spinner').outerHTML = 
                '<div class="empty-state">No lecturers registered</div>';
            return;
        }
        
        const lecturersWithCourses = [];
        
        for (const lecturer of allLecturers) {
            const url = `${API_URL}/api/admin/lecturer/${lecturer._id}/courses?session=${currentSession}&semester=${currentSemester}`;
            const coursesRes = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const coursesData = await coursesRes.json();
            
            // Only add lecturer if they have courses in the active session
            if (coursesData.success && coursesData.courses && coursesData.courses.length > 0) {
                lecturersWithCourses.push({
                    ...lecturer,
                    courses: coursesData.courses
                });
            }
        }
        
        if (lecturersWithCourses.length === 0) {
            document.querySelector('#contentWrapper .card .loading-spinner').outerHTML = 
                `<div class="empty-state">No lecturers with courses for ${currentSession} ${currentSemester}</div>`;
            return;
        }
        
        renderLecturersTable(lecturersWithCourses);
        
    } catch (error) {
        console.error('Error loading lecturers:', error);
        document.querySelector('#contentWrapper .card .loading-spinner').outerHTML = 
            '<div class="error-message">Failed to load lecturers</div>';
        showToast('Failed to load lecturers', 'danger');
    }
}

function renderLecturersTable(lecturers) {
    const card = document.querySelector('#contentWrapper .card');
    if (!card) return;
    
    let html = `
        <div class="card-header">
            <h3><i class="fa-solid fa-chalkboard-user"></i> Lecturers & Their Courses</h3>
            <div class="header-actions">
                <span class="active-semester-badge" style="background: var(--primary-light); padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.8rem;">
                    <i class="fa-regular fa-calendar"></i> ${currentSession} ${currentSemester}
                </span>
            </div>
        </div>
        <div class="grouped-list">
    `;
    
    for (const lecturer of lecturers) {
        const courses = lecturer.courses || [];
        
        html += `
            <div class="level-group">
                <div class="level-header" onclick="toggleGroup(this)">
                    <i class="fa-solid fa-chevron-right"></i>
                    <h4>${escapeHtml(lecturer.fullName)}</h4>
                    <span class="group-count">${courses.length} course(s)</span>
                </div>
                <div class="level-content" style="display: none;">
                    <div class="lecturer-info" style="margin-bottom: 1rem; padding: 0.8rem; background: var(--bg-body); border-radius: 8px;">
                        <p><strong>Staff ID:</strong> ${lecturer.staffId || 'N/A'}</p>
                        <p><strong>Email:</strong> ${lecturer.email}</p>
                        <p><strong>Rank:</strong> ${lecturer.rank || 'N/A'}</p>
                        <p><strong>Department:</strong> ${lecturer.department || 'Information Technology'}</p>
                    </div>
                    <h5 style="margin-top: 0.5rem; margin-bottom: 0.5rem;">Courses Teaching (${currentSession} ${currentSemester}):</h5>
                    <table class="data-table">
                        <thead>
                            <tr><th>Course Code</th><th>Course Title</th><th>Level</th><th>Credits</th></tr>
                        </thead>
                        <tbody>
                            ${courses.map(c => `
                                <tr>
                                    <td><strong>${c.courseCode}</strong></div>
                                    <td>${escapeHtml(c.courseTitle)}</div>
                                    <td>${c.level} Level</div>
                                    <td>${c.credits || 3}</div>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
    
    html += `</div>`;
    card.innerHTML = html;
}

// ========== LOAD STUDENTS ==========
async function loadStudents() {
    const contentWrapper = document.getElementById('contentWrapper');
    if (!contentWrapper) return;
    
    await fetchActiveSettings();
    
    contentWrapper.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3><i class="fa-solid fa-users"></i> Students</h3>
                <div class="header-actions">
                    <span class="active-semester-badge" style="background: var(--primary-light); padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.8rem;">
                        <i class="fa-regular fa-calendar"></i> ${currentSession} ${currentSemester}
                    </span>
                </div>
            </div>
            <div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i> Loading students...</div>
        </div>
    `;
    
    try {
        const response = await fetch(`${API_URL}/api/admin/students/grouped?session=${currentSession}&semester=${currentSemester}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success && data.data) {
            renderStudentsGrouped(data.data);
        } else {
            document.querySelector('#contentWrapper .card .loading-spinner').outerHTML = 
                `<div class="empty-state">No students registered for ${currentSession} ${currentSemester}</div>`;
        }
    } catch (error) {
        console.error('Error loading students:', error);
        document.querySelector('#contentWrapper .card .loading-spinner').outerHTML = 
            '<div class="error-message">Failed to load students</div>';
        showToast('Failed to load students', 'danger');
    }
}

function renderStudentsGrouped(groupedData) {
    const card = document.querySelector('#contentWrapper .card');
    if (!card) return;
    
    if (!groupedData || groupedData.length === 0) {
        card.innerHTML = `
            <div class="card-header">
                <h3><i class="fa-solid fa-users"></i> Students</h3>
                <div class="header-actions">
                    <span class="active-semester-badge" style="background: var(--primary-light); padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.8rem;">
                        <i class="fa-regular fa-calendar"></i> ${currentSession} ${currentSemester}
                    </span>
                </div>
            </div>
            <div class="empty-state">No students registered for ${currentSession} ${currentSemester}</div>
        `;
        return;
    }
    
    let html = `
        <div class="card-header">
            <h3><i class="fa-solid fa-users"></i> Students</h3>
            <div class="header-actions">
                <span class="active-semester-badge" style="background: var(--primary-light); padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.8rem;">
                    <i class="fa-regular fa-calendar"></i> ${currentSession} ${currentSemester}
                </span>
            </div>
        </div>
        <div class="grouped-list">
    `;
    
    for (const levelGroup of groupedData) {
        html += `
            <div class="level-group">
                <div class="level-header" onclick="toggleGroup(this)">
                    <i class="fa-solid fa-chevron-right"></i>
                    <h4>${levelGroup.level} Level</h4>
                    <span class="group-count">${levelGroup.totalStudents || 0} student(s)</span>
                </div>
                <div class="level-content" style="display: none;">
        `;
        
        const courses = levelGroup.courses || [];
        
        for (const course of courses) {
            const studentsList = course.students || [];
            html += `
                <div class="course-group">
                    <div class="course-header" onclick="toggleGroup(this)">
                        <i class="fa-solid fa-chevron-right"></i>
                        <strong>${course.courseCode} - ${course.courseTitle}</strong>
                        <span class="group-count">${studentsList.length} student(s)</span>
                    </div>
                    <div class="course-content" style="display: none;">
                        <table class="data-table">
                            <thead>
                                <tr><th>Name</th><th>Matric Number</th><th>Email</th></tr>
                            </thead>
                            <tbody>
                                ${studentsList.map(s => `
                                    <tr>
                                        <td><strong>${escapeHtml(s.name)}</strong></div>
                                        <td>${s.matricNumber || 'N/A'}</div>
                                        <td>${s.email || 'N/A'}</div>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }
        
        html += `</div></div>`;
    }
    
    html += `</div>`;
    card.innerHTML = html;
}

// ========== LOAD SETTINGS PAGE ==========
function loadSettings() {
    window.location.href = 'admin-settings.html';
}

// ========== TOGGLE GROUP FUNCTION ==========
function toggleGroup(element) {
    const parent = element.parentElement;
    const content = parent.querySelector('.level-content, .course-content');
    const icon = element.querySelector('i');
    
    if (content) {
        if (content.style.display === 'none' || !content.style.display) {
            content.style.display = 'block';
            if (icon) icon.className = 'fa-solid fa-chevron-down';
        } else {
            content.style.display = 'none';
            if (icon) icon.className = 'fa-solid fa-chevron-right';
        }
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
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${message}<button class="toast-close" onclick="this.parentElement.remove()">×</button>`;
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

function loadPage(page) {
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) pageTitle.textContent = page.charAt(0).toUpperCase() + page.slice(1);
    
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    const activeNav = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (activeNav) activeNav.classList.add('active');
    
    if (page === 'dashboard') loadDashboard();
    else if (page === 'courses') loadCourses();
    else if (page === 'lecturers') loadLecturers();
    else if (page === 'students') loadStudents();
    else if (page === 'settings') loadSettings();
}

// ========== SIDEBAR & THEME ==========
function initSidebar() {
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

function initDarkMode() {
    const themeToggle = document.getElementById('themeToggle');
    if (localStorage.getItem('futoTheme') === 'dark') document.body.classList.add('dark');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark');
            localStorage.setItem('futoTheme', document.body.classList.contains('dark') ? 'dark' : 'light');
        });
    }
}

// ========== EVENT LISTENERS ==========
document.querySelectorAll('.nav-item[data-page]').forEach(nav => {
    nav.addEventListener('click', (e) => {
        e.preventDefault();
        loadPage(nav.getAttribute('data-page'));
    });
});

// ========== INITIALIZE ==========
document.addEventListener('DOMContentLoaded', async () => {
    initDarkMode();
    initSidebar();
    await fetchActiveSettings();
    
    const savedPage = localStorage.getItem('adminPage');
    if (savedPage && savedPage !== 'dashboard') {
        localStorage.removeItem('adminPage');
        loadPage(savedPage);
    } else {
        loadDashboard();
    }
});

// Make functions global
window.loadPage = loadPage;
window.openCourseModal = openCourseModal;
window.saveCourse = saveCourse;
window.editCourse = editCourse;
window.confirmDeleteCourse = confirmDeleteCourse;
window.closeModal = closeModal;
window.logout = logout;
window.showToast = showToast;
window.toggleGroup = toggleGroup;