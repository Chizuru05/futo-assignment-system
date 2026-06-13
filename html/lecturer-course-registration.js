// API_URL is defined in api-config.js (loaded globally)
if (typeof API_URL === 'undefined') {
    console.warn('API_URL not defined in lecturer-course-registration.js, using fallback');
    var API_URL = 'https://futo-assignment-system-api.onrender.com';
}
console.log('lecturer-course-registration.js loaded with API_URL:', API_URL);
// lecturer-course-registration.js - COMPLETE UPDATED WITH ACTIVE SESSION


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

// DOM Elements
const loadCoursesBtn = document.getElementById('loadCoursesBtn');
const coursesCard = document.getElementById('coursesCard');
const courseList = document.getElementById('courseList');
const submitBtn = document.getElementById('submitBtn');
const cancelBtn = document.getElementById('cancelBtn');
const selectedCount = document.getElementById('selectedCount');
const selectedSummary = document.getElementById('selectedSummary');
const summaryList = document.getElementById('summaryList');
const academicSession = document.getElementById('academicSession');
const semester = document.getElementById('semester');
const levelFilter = document.getElementById('levelFilter');

let allCourses = [];
let selectedCourses = [];
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
            console.log('✅ Active settings loaded:', currentSession, currentSemester);
            
            // Set the dropdown values
            if (academicSession) academicSession.value = currentSession;
            if (semester) semester.value = currentSemester;
            
            // Update session info display
            const sessionInfo = document.querySelector('.session-info span');
            if (sessionInfo) {
                sessionInfo.innerHTML = `Showing courses for <strong>${currentSession} ${currentSemester} Semester</strong> in <strong>Information Technology Department</strong>`;
            }
        }
    } catch (error) {
        console.error('Error fetching active settings:', error);
        currentSession = academicSession?.value || '2025-2026';
        currentSemester = semester?.value || 'Harmattan';
    }
}

async function loadAvailableCourses() {
    const session = academicSession?.value;
    const sem = semester?.value;
    const level = levelFilter?.value || 'all';
    
    if (!session || !sem) {
        showToast('Please select session and semester', 'warning');
        return;
    }
    
    currentSession = session;
    currentSemester = sem;
    
    showToast('Loading courses...', 'info');
    if (loadCoursesBtn) {
        loadCoursesBtn.disabled = true;
        loadCoursesBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
    }
    
    try {
        let url = `${API_URL}/api/lecturer/courses/available?session=${session}&semester=${sem}`;
        if (level !== 'all') {
            url += `&level=${level}`;
        }
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            allCourses = data.courses || [];
            renderCourseList();
            if (coursesCard) coursesCard.style.display = 'block';
            coursesCard?.scrollIntoView({ behavior: 'smooth' });
            showToast(`Loaded ${allCourses.length} available courses`, 'success');
        } else {
            showToast(data.message || 'Failed to load courses', 'danger');
            allCourses = [];
            renderCourseList();
        }
    } catch (error) {
        console.error('Error loading courses:', error);
        showToast('Failed to connect to server', 'danger');
        allCourses = [];
        renderCourseList();
    } finally {
        if (loadCoursesBtn) {
            loadCoursesBtn.disabled = false;
            loadCoursesBtn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Load Available Courses';
        }
    }
}

function renderCourseList() {
    if (!courseList) return;
    
    if (allCourses.length === 0) {
        courseList.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-light);">
                <i class="fa-regular fa-folder-open" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                <p>No courses available for the selected level</p>
                <small>Try selecting a different level</small>
            </div>
        `;
        return;
    }
    
    courseList.innerHTML = allCourses.map(course => {
        const isSelected = selectedCourses.some(c => c._id === course._id);
        return `
            <div class="course-item ${isSelected ? 'selected' : ''}" data-id="${course._id}">
                <input type="checkbox" class="course-checkbox" data-id="${course._id}" data-code="${course.courseCode}" data-title="${course.courseTitle}" data-level="${course.level}" data-credits="${course.credits || 3}" ${isSelected ? 'checked' : ''}>
                <div class="course-details">
                    <div class="course-code">${escapeHtml(course.courseCode)}</div>
                    <div class="course-title">${escapeHtml(course.courseTitle)}</div>
                    <div class="course-meta">
                        <span><i class="fa-regular fa-star"></i> ${course.credits || 3} Credits</span>
                        <span><i class="fa-regular fa-layer-group"></i> ${course.level} Level</span>
                    </div>
                </div>
                <div class="course-lecturer">
                    <i class="fa-regular fa-chalkboard-user"></i>
                    Available to register
                </div>
            </div>
        `;
    }).join('');
    
    document.querySelectorAll('.course-item').forEach(item => {
        const checkbox = item.querySelector('.course-checkbox');
        if (!checkbox) return;
        
        const courseId = checkbox.getAttribute('data-id');
        const courseCode = checkbox.getAttribute('data-code');
        const courseTitle = checkbox.getAttribute('data-title');
        const courseLevel = checkbox.getAttribute('data-level');
        const credits = parseInt(checkbox.getAttribute('data-credits')) || 3;
        
        item.addEventListener('click', (e) => {
            if (e.target.type !== 'checkbox') {
                checkbox.checked = !checkbox.checked;
                toggleCourseSelection(courseId, courseCode, courseTitle, courseLevel, credits, checkbox.checked);
                item.classList.toggle('selected', checkbox.checked);
            }
        });
        
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            toggleCourseSelection(courseId, courseCode, courseTitle, courseLevel, credits, checkbox.checked);
            item.classList.toggle('selected', checkbox.checked);
        });
    });
}

function toggleCourseSelection(id, code, title, level, credits, isSelected) {
    if (isSelected) {
        if (!selectedCourses.some(c => c._id === id)) {
            selectedCourses.push({ _id: id, courseCode: code, courseTitle: title, level, credits });
        }
    } else {
        selectedCourses = selectedCourses.filter(c => c._id !== id);
    }
    updateSelectedUI();
}

function updateSelectedUI() {
    if (selectedCount) selectedCount.textContent = `${selectedCourses.length} selected`;
    if (submitBtn) submitBtn.disabled = selectedCourses.length === 0;
    
    if (selectedCourses.length > 0) {
        if (selectedSummary) selectedSummary.style.display = 'block';
        if (summaryList) {
            summaryList.innerHTML = selectedCourses.map(course => `
                <div class="summary-item">
                    ${escapeHtml(course.courseCode)}
                    <i class="fa-regular fa-circle-xmark" onclick="removeCourse('${course._id}')" style="cursor: pointer;"></i>
                </div>
            `).join('');
        }
    } else {
        if (selectedSummary) selectedSummary.style.display = 'none';
    }
}

window.removeCourse = (courseId) => {
    selectedCourses = selectedCourses.filter(c => c._id !== courseId);
    
    const checkbox = document.querySelector(`.course-checkbox[data-id="${courseId}"]`);
    if (checkbox) {
        checkbox.checked = false;
        const courseItem = checkbox.closest('.course-item');
        if (courseItem) courseItem.classList.remove('selected');
    }
    
    updateSelectedUI();
    showToast('Course removed', 'info');
};

async function registerCourses() {
    if (selectedCourses.length === 0) {
        showToast('Please select at least one course', 'warning');
        return;
    }
    
    const courseIds = selectedCourses.map(c => c._id);
    
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registering...';
    }
    
    try {
        const response = await fetch(`${API_URL}/api/lecturer/courses/register`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                courses: courseIds,
                session: currentSession,
                semester: currentSemester
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`Successfully registered ${selectedCourses.length} course(s)!`, 'success');
            
            const modal = document.getElementById('successModal');
            const registeredCount = document.getElementById('registeredCount');
            if (registeredCount) registeredCount.textContent = selectedCourses.length;
            if (modal) modal.classList.add('show');
        } else {
            showToast(data.message || 'Registration failed', 'danger');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fa-regular fa-floppy-disk"></i> Register Selected Courses';
            }
        }
    } catch (error) {
        console.error('Registration error:', error);
        showToast('Failed to connect to server', 'danger');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-regular fa-floppy-disk"></i> Register Selected Courses';
        }
    }
}

function clearSelections() {
    selectedCourses = [];
    
    document.querySelectorAll('.course-checkbox').forEach(checkbox => {
        checkbox.checked = false;
        const courseItem = checkbox.closest('.course-item');
        if (courseItem) courseItem.classList.remove('selected');
    });
    
    updateSelectedUI();
    showToast('Selection cleared', 'info');
}

window.closeSuccessModal = () => {
    document.getElementById('successModal')?.classList.remove('show');
};

window.goToMyCourses = () => {
    window.location.href = 'lecturer-courses.html';
};

if (levelFilter) {
    levelFilter.addEventListener('change', () => {
        if (academicSession?.value && semester?.value) {
            loadAvailableCourses();
        }
    });
}

if (loadCoursesBtn) {
    loadCoursesBtn.addEventListener('click', loadAvailableCourses);
}

if (submitBtn) {
    submitBtn.addEventListener('click', registerCourses);
}

if (cancelBtn) {
    cancelBtn.addEventListener('click', clearSelections);
}

function showToast(message, type = 'success', duration = 3000) {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fa-solid ${type === 'success' ? 'fa-check-circle' : type === 'danger' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <div class="toast-content">
            <div class="toast-title">${type === 'success' ? 'Success' : type === 'danger' ? 'Error' : 'Info'}</div>
            <div class="toast-message">${escapeHtml(message)}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
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
        if (window.innerWidth <= 1024 && sidebar && menuBtn && !sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
            sidebar.classList.remove('show');
        }
    });
    
    const notifBtn = document.getElementById('notifBtn');
    const notifPanel = document.getElementById('notifPanel');
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
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.clear();
            window.location.href = 'login.html';
        });
    }
}

// ========== INITIALIZE - FETCH ACTIVE SETTINGS ON PAGE LOAD ==========
document.addEventListener('DOMContentLoaded', async () => {
    initUI();
    await fetchActiveSettings();
    console.log('Lecturer Course Registration page initialized with session:', currentSession, currentSemester);
});

window.showToast = showToast;