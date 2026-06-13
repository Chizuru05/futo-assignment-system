// API_URL is defined in api-config.js (loaded globally)
if (typeof API_URL === 'undefined') {
    console.warn('API_URL not defined in lecturer-dashboard.js, using fallback');
    var API_URL = 'https://futo-assignment-system-api.onrender.com';
}
console.log('lecturer-dashboard.js loaded with API_URL:', API_URL);
// lecturer-dashboard.js - COMPLETE FIXED VERSION


// ========== TOKEN MANAGEMENT ==========
function getAuthToken() {
    const userRole = localStorage.getItem('userRole');
    if (!userRole) return null;
    return localStorage.getItem(`${userRole}_token`);
}

function logout() {
    localStorage.clear();
    window.location.href = 'login.html';
}

// Check authentication
const token = getAuthToken();
const userRole = localStorage.getItem('userRole');

console.log('Lecturer Dashboard - Token exists:', !!token, 'Role:', userRole);

if (!token || userRole !== 'lecturer') {
    logout();
}

// Get lecturer info
const lecturerName = localStorage.getItem('fullName') || 'Dr. Lecturer';
const staffId = localStorage.getItem('staffId') || 'STAFF/2024/001';
const lecturerRank = localStorage.getItem('rank') || 'Senior Lecturer';

// DOM Elements
const welcomeName = document.getElementById('welcomeName');
const lecturerNameEl = document.getElementById('lecturerName');
const lecturerRankEl = document.getElementById('lecturerRank');
const staffIdEl = document.getElementById('staffId');
const currentDateEl = document.getElementById('currentDate');
const totalCoursesEl = document.getElementById('totalCourses');
const totalStudentsEl = document.getElementById('totalStudents');
const totalAssignmentsEl = document.getElementById('totalAssignments');
const pendingSubmissionsEl = document.getElementById('pendingSubmissions');
const myCoursesList = document.getElementById('myCoursesList');
const recentSubmissionsList = document.getElementById('recentSubmissions');
const activeAssignmentsList = document.getElementById('activeAssignments');

let allCourses = [];
let allAssignments = [];
let allSubmissions = [];
let currentSession = '';
let currentSemester = '';

// Set user info
if (welcomeName) welcomeName.textContent = `Welcome back, ${lecturerName.split(' ')[0]}!`;
if (lecturerNameEl) lecturerNameEl.textContent = lecturerName;
if (lecturerRankEl) lecturerRankEl.textContent = lecturerRank;
if (staffIdEl) staffIdEl.textContent = staffId;

// Set current date
if (currentDateEl) {
    const now = new Date();
    currentDateEl.textContent = now.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}

// ========== FETCH ACTIVE SETTINGS ==========
async function fetchActiveSettings() {
    try {
        const response = await fetch(`${API_URL}/api/settings`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            currentSession = data.settings.activeSession;
            currentSemester = data.settings.activeSemester;
            localStorage.setItem('currentSession', currentSession);
            localStorage.setItem('currentSemester', currentSemester);
            console.log('Active settings loaded:', currentSession, currentSemester);
            
            // Update session info display
            const sessionInfo = document.getElementById('sessionInfo');
            if (sessionInfo) {
                sessionInfo.textContent = `${currentSession} ${currentSemester}`;
            }
        }
    } catch (error) {
        console.error('Error fetching active settings:', error);
        currentSession = localStorage.getItem('currentSession') || '2025-2026';
        currentSemester = localStorage.getItem('currentSemester') || 'Harmattan';
    }
}

// ========== FETCH DASHBOARD DATA ==========
async function fetchDashboardData() {
    if (!currentSession || !currentSemester) {
        await fetchActiveSettings();
    }
    
    try {
        console.log('Fetching dashboard data for:', currentSession, currentSemester);
        
        // Fetch lecturer's courses for active session/semester
        const coursesRes = await fetch(`${API_URL}/api/lecturer/my-courses?session=${currentSession}&semester=${currentSemester}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const coursesData = await coursesRes.json();
        
        if (coursesData.success) {
            allCourses = coursesData.courses || [];
            if (totalCoursesEl) totalCoursesEl.textContent = allCourses.length;
            
            const totalStudentsCount = allCourses.reduce((sum, course) => sum + (course.studentCount || 0), 0);
            if (totalStudentsEl) totalStudentsEl.textContent = totalStudentsCount;
            
            renderMyCourses();
        }
        
        // Fetch assignments for lecturer - FIXED: Remove query parameters
        const assignmentsRes = await fetch(`${API_URL}/api/assignments/lecturer`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const assignmentsData = await assignmentsRes.json();
        
        if (assignmentsData.success) {
            allAssignments = assignmentsData.assignments || [];
            if (totalAssignmentsEl) totalAssignmentsEl.textContent = allAssignments.length;
            renderActiveAssignments();
        }
        
        // Fetch submissions for active session/semester - FIXED: Use correct endpoint
        const submissionsRes = await fetch(`${API_URL}/api/submissions/lecturer/all?session=${currentSession}&semester=${currentSemester}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const submissionsData = await submissionsRes.json();
        
        if (submissionsData.success) {
            allSubmissions = submissionsData.submissions || [];
            const pendingCount = allSubmissions.filter(s => s.status === 'pending').length;
            if (pendingSubmissionsEl) pendingSubmissionsEl.textContent = pendingCount;
            renderRecentSubmissions();
        } else {
            console.log('No submissions found or error:', submissionsData.message);
            allSubmissions = [];
            if (pendingSubmissionsEl) pendingSubmissionsEl.textContent = 0;
            renderRecentSubmissions();
        }
        
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
    }
}

function renderMyCourses() {
    if (!myCoursesList) return;
    
    if (!allCourses.length) {
        myCoursesList.innerHTML = `<div class="empty-state">No courses registered for ${currentSession} ${currentSemester}. <a href="lecturer-course-registration.html">Register now</a></div>`;
        return;
    }
    
    myCoursesList.innerHTML = allCourses.slice(0, 5).map(course => `
        <div class="course-item" onclick="window.location.href='lecturer-courses.html'">
            <div class="course-code">${escapeHtml(course.courseCode)}</div>
            <div class="course-title">${escapeHtml(course.courseTitle)}</div>
            <div class="course-stats">${course.studentCount || 0} students</div>
        </div>
    `).join('');
}

function renderActiveAssignments() {
    if (!activeAssignmentsList) return;
    
    const now = new Date();
    const activeAssignments = allAssignments.filter(a => new Date(a.dueDateISO) >= now);
    const topAssignments = activeAssignments.slice(0, 5);
    
    if (!topAssignments.length) {
        activeAssignmentsList.innerHTML = `<div class="empty-state">No active assignments for ${currentSession} ${currentSemester}. <a href="lecturer-assignments.html">Create one</a></div>`;
        return;
    }
    
    activeAssignmentsList.innerHTML = topAssignments.map(assignment => {
        const dueDate = new Date(assignment.dueDateISO);
        const daysLeft = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
        const submissionCount = allSubmissions.filter(s => s.assignmentId?._id === assignment._id).length;
        
        return `
            <div class="assignment-item" onclick="window.location.href='lecturer-assignments.html'">
                <div class="assignment-course">${escapeHtml(assignment.course)}</div>
                <div class="assignment-title">${escapeHtml(assignment.title)}</div>
                <div class="assignment-meta">
                    <span><i class="fa-regular fa-calendar"></i> Due: ${assignment.dueDate} (${daysLeft} days left)</span>
                    <span><i class="fa-regular fa-file"></i> ${submissionCount} submissions</span>
                </div>
            </div>
        `;
    }).join('');
}

function renderRecentSubmissions() {
    if (!recentSubmissionsList) return;
    
    const recentSubmissions = [...allSubmissions]
        .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
        .slice(0, 5);
    
    if (!recentSubmissions.length) {
        recentSubmissionsList.innerHTML = `<div class="empty-state">No submissions for ${currentSession} ${currentSemester}</div>`;
        return;
    }
    
    recentSubmissionsList.innerHTML = recentSubmissions.map(submission => {
        const timeAgo = getTimeAgo(new Date(submission.submittedAt));
        const assignment = submission.assignmentId || {};
        return `
            <div class="submission-item" onclick="window.location.href='lecturer-submissions.html'">
                <div class="submission-student">
                    <i class="fa-regular fa-user-circle"></i>
                    <div>
                        <div class="student-name">${escapeHtml(submission.studentName)}</div>
                        <div class="submission-course">${assignment.course || 'Course'} - ${assignment.title || 'Assignment'}</div>
                    </div>
                </div>
                <div class="submission-time">${timeAgo}</div>
            </div>
        `;
    }).join('');
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) return interval === 1 ? '1 year ago' : `${interval} years ago`;
    
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) return interval === 1 ? '1 month ago' : `${interval} months ago`;
    
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return interval === 1 ? 'Yesterday' : `${interval} days ago`;
    
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return interval === 1 ? '1 hour ago' : `${interval} hours ago`;
    
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return interval === 1 ? '1 minute ago' : `${interval} minutes ago`;
    
    return 'Just now';
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

// ========== SIDEBAR & THEME ==========
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

// ========== INITIALIZE ==========
document.addEventListener('DOMContentLoaded', async () => {
    setupSidebar();
    setupTheme();
    await fetchActiveSettings();
    await fetchDashboardData();
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    
    // Refresh data every 30 seconds
    setInterval(() => {
        if (document.hasFocus()) {
            fetchDashboardData();
        }
    }, 30000);
});

window.logout = logout;