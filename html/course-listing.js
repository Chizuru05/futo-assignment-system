// course-listing.js
const API_URL = 'http://localhost:5000';

// ========== TOKEN FUNCTION ==========
function getAuthToken() {
    const userRole = localStorage.getItem('userRole');
    if (!userRole) return null;
    return localStorage.getItem(`${userRole}_token`) || localStorage.getItem('token');
}

// ========== CHECK AUTHENTICATION ==========
const token = getAuthToken();
const userRole = localStorage.getItem('userRole');

console.log('=== COURSE LISTING PAGE ===');
console.log('Token exists:', !!token);
console.log('User role:', userRole);

if (!token) {
    console.log('No token, redirecting to login');
    window.location.href = 'login.html';
}

if (userRole !== 'student') {
    console.log('Not a student, redirecting');
    window.location.href = 'login.html';
}

// Get selected session info from localStorage (set by session page)
let currentSession = localStorage.getItem('currentSession') || '2025-2026';
let currentSemester = localStorage.getItem('currentSemester') || 'Harmattan';
let selectedLevel = localStorage.getItem('selectedLevel') || '500';

// DOM Elements
const coursesTableBody = document.getElementById('coursesTableBody');
const totalUnitsSpan = document.getElementById('totalUnits');
const selectedUnitsSpan = document.getElementById('selectedUnits');
const selectedCountSpan = document.getElementById('selectedCount');
const registerBtn = document.getElementById('registerSelectedBtn');
const backBtn = document.getElementById('backBtn');
const addMoreBtn = document.getElementById('addMoreCourseBtn');
const sessionInfo = document.getElementById('sessionInfo');

let availableCourses = [];
let selectedCourses = [];

// Display session info
if (sessionInfo) {
    sessionInfo.innerHTML = `Session: ${currentSession} | Semester: ${currentSemester} | Level: ${selectedLevel}`;
}

// Fetch available courses from API
async function fetchAvailableCourses() {
    try {
        if (coursesTableBody) {
            coursesTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Loading courses...</td></tr>';
        }
        
        const url = `${API_URL}/api/student/courses/available?session=${currentSession}&semester=${currentSemester}&level=${selectedLevel}`;
        console.log('Fetching courses from:', url);
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        console.log('Courses response:', data);
        
        if (data.success) {
            availableCourses = data.courses || [];
            renderCoursesTable();
            updateTotalUnits();
            showToast(`Loaded ${availableCourses.length} courses for ${selectedLevel} level`, 'success');
        } else {
            showToast(data.message || 'Failed to load courses', 'danger');
            availableCourses = [];
            renderCoursesTable();
        }
    } catch (error) {
        console.error('Error fetching courses:', error);
        showToast('Failed to connect to server', 'danger');
        availableCourses = [];
        renderCoursesTable();
    }
}

// Render courses table
function renderCoursesTable() {
    if (!coursesTableBody) return;
    
    if (availableCourses.length === 0) {
        coursesTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem;">No courses available for ${selectedLevel} level</td></tr>`;
        return;
    }
    
    coursesTableBody.innerHTML = availableCourses.map(course => {
        const isSelected = selectedCourses.some(c => c._id === course._id);
        return `
            <tr>
                <td style="text-align: center;">
                    <input type="checkbox" class="course-checkbox" 
                           data-id="${course._id}" 
                           data-code="${course.courseCode}" 
                           data-title="${course.courseTitle}" 
                           data-credits="${course.credits || 3}" 
                           ${isSelected ? 'checked' : ''}>
                </td>
                <td><strong>${course.courseCode}</strong></td>
                <td>${course.courseTitle}</td>
                <td>${course.credits || 3}</td>
                <td><span class="course-type compulsory">Compulsory</span></td>
            </tr>
        `;
    }).join('');
    
    // Add event listeners to checkboxes
    document.querySelectorAll('.course-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function(e) {
            e.stopPropagation();
            const courseId = this.getAttribute('data-id');
            const courseCode = this.getAttribute('data-code');
            const courseTitle = this.getAttribute('data-title');
            const credits = parseInt(this.getAttribute('data-credits')) || 3;
            
            if (this.checked) {
                if (!selectedCourses.some(c => c._id === courseId)) {
                    selectedCourses.push({ _id: courseId, courseCode, courseTitle, credits });
                }
            } else {
                selectedCourses = selectedCourses.filter(c => c._id !== courseId);
            }
            updateSelectionSummary();
        });
    });
}

// Update total units
function updateTotalUnits() {
    if (totalUnitsSpan) {
        const totalUnits = availableCourses.reduce((sum, c) => sum + (c.credits || 3), 0);
        totalUnitsSpan.textContent = totalUnits;
    }
}

// Update selection summary
function updateSelectionSummary() {
    let selectedUnits = 0;
    selectedCourses.forEach(course => {
        selectedUnits += course.credits || 3;
    });
    
    if (selectedUnitsSpan) selectedUnitsSpan.textContent = selectedUnits;
    if (selectedCountSpan) selectedCountSpan.textContent = selectedCourses.length;
    
    if (registerBtn) {
        registerBtn.disabled = selectedCourses.length === 0;
    }
}

// ========== REGISTER SELECTED COURSES - FIXED ==========
async function registerCourses() {
    if (selectedCourses.length === 0) {
        showToast('Please select at least one course', 'warning');
        return;
    }
    
    const courseIds = selectedCourses.map(c => c._id);
    
    if (registerBtn) {
        registerBtn.disabled = true;
        registerBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registering...';
    }
    
    console.log('Registering courses:', courseIds);
    console.log('Session:', currentSession, 'Semester:', currentSemester);
    
    try {
        const response = await fetch(`${API_URL}/api/student/courses/register`, {
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
        console.log('Registration response:', data);
        
        if (data.success) {
            showToast(`✅ Successfully registered ${selectedCourses.length} course(s)!`, 'success');
            
            // Clear localStorage mock data to force real data fetch
            localStorage.removeItem('userCourses');
            localStorage.removeItem('studentCourses');
            
            // Redirect to dashboard after successful registration
            setTimeout(() => {
                window.location.href = 'student-dashboard.html';
            }, 2000);
        } else {
            showToast(data.message || 'Registration failed', 'danger');
            if (registerBtn) {
                registerBtn.disabled = false;
                registerBtn.innerHTML = '<i class="fa-solid fa-check"></i> Register Selected Courses';
            }
        }
    } catch (error) {
        console.error('Registration error:', error);
        showToast('Failed to connect to server', 'danger');
        if (registerBtn) {
            registerBtn.disabled = false;
            registerBtn.innerHTML = '<i class="fa-solid fa-check"></i> Register Selected Courses';
        }
    }
}

// Go back to session selection
function goBack() {
    window.location.href = 'select-session.html';
}

// Add more course (go back to session selection)
function addMoreCourse() {
    window.location.href = 'select-session.html';
}

// Toast notification
function showToast(message, type = 'success') {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i><span>${message}</span><button onclick="this.parentElement.remove()">×</button>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Event listeners
if (registerBtn) {
    registerBtn.addEventListener('click', registerCourses);
}

if (backBtn) {
    backBtn.addEventListener('click', goBack);
}

if (addMoreBtn) {
    addMoreBtn.addEventListener('click', addMoreCourse);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('Course listing page loaded');
    fetchAvailableCourses();
    updateSelectionSummary();
    
    // Setup menu button for mobile
    const menuBtn = document.getElementById('menuBtn');
    if (menuBtn) {
        menuBtn.addEventListener('click', function() {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.toggle('show');
        });
    }
});

// Make functions global
window.goBack = goBack;
window.addMoreCourse = addMoreCourse;
window.showToast = showToast;