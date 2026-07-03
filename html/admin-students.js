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

let allStudents = [];
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
            const semesterDisplay = document.querySelector('.current-semester');
            if (semesterDisplay) {
                semesterDisplay.innerHTML = `<i class="fa-regular fa-calendar"></i> ${currentSession} ${currentSemester}`;
            }
        }
    } catch (error) {
        console.error('Error fetching active settings:', error);
        currentSession = localStorage.getItem('currentSession') || '2025-2026';
        currentSemester = localStorage.getItem('currentSemester') || 'Harmattan';
    }
}

// ========== LOAD STUDENTS ==========
async function loadStudents() {
    try {
        const response = await fetch(`${API_URL}/api/admin/users/all`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            allStudents = data.users?.filter(u => u.role === 'student') || [];
            updateStats();
            renderStudents();
        } else {
            showToast('Failed to load students', 'danger');
        }
    } catch (error) {
        console.error('Error loading students:', error);
        showToast('Failed to connect to server', 'danger');
    }
}

function updateStats() {
    const total = allStudents.length;
    const active = allStudents.filter(s => s.isActive !== false).length;
    
    document.getElementById('totalStudents').textContent = total;
    document.getElementById('activeStudents').textContent = active;
    document.getElementById('studentCount').textContent = `${total} students`;
}

function renderStudents() {
    const tbody = document.getElementById('studentsTableBody');
    if (!tbody) return;
    
    const levelFilter = document.getElementById('levelFilter').value;
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    console.log('Filtering - Level:', levelFilter, 'Search:', searchTerm);
    console.log('Total students:', allStudents.length);
    
    let filtered = [...allStudents];
    
    // FIXED: Filter by level - compare as strings
    if (levelFilter !== 'all') {
        filtered = filtered.filter(s => {
            const studentLevel = String(s.level || '');
            const filterLevel = String(levelFilter);
            return studentLevel === filterLevel;
        });
        console.log(`Filtered by level ${levelFilter}: ${filtered.length} students`);
    }
    
    if (searchTerm) {
        filtered = filtered.filter(s => 
            (s.fullName || '').toLowerCase().includes(searchTerm) ||
            (s.matricNumber || '').toLowerCase().includes(searchTerm) ||
            (s.email || '').toLowerCase().includes(searchTerm)
        );
        console.log(`Filtered by search: ${filtered.length} students`);
    }
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="fa-regular fa-folder-open"></i><p>No students found matching your filters</p></td></tr>';
        return;
    }
    
    tbody.innerHTML = filtered.map(student => {
        // Check if matric number is valid
        const isValidMatric = student.matricNumber ? validateMatricNumber(student.matricNumber) : false;
        const matricClass = isValidMatric ? '' : 'invalid';
        
        return `
            <tr>
                <td><strong>${escapeHtml(student.fullName)}</strong></td>
                <td><span class="matric-number ${matricClass}">${escapeHtml(student.matricNumber || 'N/A')}</span></td>
                <td>${escapeHtml(student.email)}</td>
                <td>${escapeHtml(student.level || 'N/A')}</td>
                <td>${escapeHtml(student.department || 'Information Technology')}</td>
                <td>
                    <button class="btn-icon" onclick="viewStudentCourses('${student._id}')" title="View Courses"><i class="fa-solid fa-book-open"></i></button>
                    <button class="btn-icon" onclick="viewStudentDetails('${student._id}')" title="View Details"><i class="fa-regular fa-eye"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}

// ========== VALIDATE MATRIC NUMBER ==========
function validateMatricNumber(matric) {
    if (!matric || matric.length < 11) return false;
    if (!/^[0-9]+$/.test(matric)) return false;
    if (!matric.endsWith('2')) return false;
    const year = parseInt(matric.substring(0, 4));
    const currentYear = new Date().getFullYear();
    if (year < 2010 || year > currentYear) return false;
    return true;
}

// ========== VIEW STUDENT COURSES ==========
async function viewStudentCourses(id) {
    try {
        showToast('Loading student courses...', 'info');
        
        // Get student info
        const response = await fetch(`${API_URL}/api/admin/users/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (!data.success) {
            showToast('Failed to load student details', 'danger');
            return;
        }
        
        const student = data.user;
        
        // Fetch student's enrolled courses
        const coursesResponse = await fetch(`${API_URL}/api/student/my-courses?session=${currentSession}&semester=${currentSemester}`, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        const coursesData = await coursesResponse.json();
        
        let coursesHtml = '';
        if (coursesData.success && coursesData.courses && coursesData.courses.length > 0) {
            coursesHtml = coursesData.courses.map(c => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:0.6rem 0;border-bottom:1px solid var(--border);">
                    <div>
                        <strong style="color:var(--primary);">${escapeHtml(c.courseCode)}</strong>
                        <span style="color:var(--text-dark);margin-left:0.5rem;">${escapeHtml(c.courseTitle)}</span>
                    </div>
                    <span style="color:var(--text-light);font-size:0.8rem;">${c.credits || 3} Credits</span>
                </div>
            `).join('');
        } else {
            coursesHtml = '<p style="color:var(--text-light);padding:1rem 0;text-align:center;">No courses enrolled for this student</p>';
        }
        
        const modalBody = document.getElementById('studentDetailBody');
        if (modalBody) {
            modalBody.innerHTML = `
                <div style="margin-bottom:1rem;padding:1rem;background:var(--bg-body);border-radius:8px;">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
                        <div><strong>Name:</strong></div><div>${escapeHtml(student.fullName)}</div>
                        <div><strong>Matric Number:</strong></div><div><span class="matric-number">${escapeHtml(student.matricNumber || 'N/A')}</span></div>
                        <div><strong>Email:</strong></div><div>${escapeHtml(student.email)}</div>
                        <div><strong>Level:</strong></div><div>${escapeHtml(student.level || 'N/A')}</div>
                        <div><strong>Department:</strong></div><div>${escapeHtml(student.department || 'Information Technology')}</div>
                        <div><strong>Session:</strong></div><div>${currentSession} ${currentSemester}</div>
                    </div>
                </div>
                <h4 style="margin-bottom:0.8rem;color:var(--primary);"><i class="fa-solid fa-book"></i> Enrolled Courses</h4>
                <div style="background:var(--bg-body);border-radius:8px;padding:0.5rem 1rem;">
                    ${coursesHtml}
                </div>
            `;
        }
        
        document.getElementById('studentDetailModal')?.classList.add('show');
        
    } catch (error) {
        console.error('Error loading student courses:', error);
        showToast('Failed to load student courses. Please try again.', 'danger');
    }
}

function closeStudentDetail() {
    document.getElementById('studentDetailModal')?.classList.remove('show');
}

// ========== VIEW STUDENT DETAILS ==========
function viewStudentDetails(id) {
    const student = allStudents.find(s => s._id === id);
    if (!student) {
        showToast('Student not found', 'danger');
        return;
    }
    viewStudentCourses(id);
}

// ========== FILTER FUNCTIONS - FIXED ==========
function applyFilters() {
    console.log('Apply filters clicked');
    renderStudents();
    showToast('Filters applied', 'success');
}

function clearFilters() {
    console.log('Clear filters clicked');
    document.getElementById('levelFilter').value = 'all';
    document.getElementById('searchInput').value = '';
    renderStudents();
    showToast('Filters cleared', 'success');
}

// ========== UTILITY FUNCTIONS ==========
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

function setupThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark');
            localStorage.setItem('futoTheme', document.body.classList.contains('dark') ? 'dark' : 'light');
        });
    }
}

function setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const menuBtn = document.getElementById('menuBtn');
    
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            if (window.innerWidth <= 1024) {
                sidebar.classList.remove('show');
            } else {
                sidebar.classList.toggle('collapsed');
            }
        });
    }
    if (menuBtn) {
        menuBtn.addEventListener('click', () => sidebar.classList.toggle('show'));
    }
}

// ========== EVENT LISTENERS FOR FILTERS ==========
document.addEventListener('DOMContentLoaded', function() {
    // Auto-apply filter when dropdown changes
    const levelFilter = document.getElementById('levelFilter');
    if (levelFilter) {
        levelFilter.addEventListener('change', function() {
            console.log('Level filter changed to:', this.value);
            renderStudents();
        });
    }
    
    // Auto-apply filter when search input changes
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            renderStudents();
        });
    }
});

// ========== INITIALIZE ==========
document.addEventListener('DOMContentLoaded', async () => {
    setupTheme();
    setupSidebar();
    setupThemeToggle();
    await fetchActiveSettings();
    loadStudents();
    
    console.log('Admin Students page initialized');
    console.log('Current Session:', currentSession);
    console.log('Current Semester:', currentSemester);
});

window.viewStudentDetails = viewStudentDetails;
window.viewStudentCourses = viewStudentCourses;
window.closeStudentDetail = closeStudentDetail;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.logout = logout;
window.showToast = showToast;