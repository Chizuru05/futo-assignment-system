// admin-dashboard.js - COMPLETE FIXED VERSION WITH SPINNER FIX

function getAuthToken() {
    const userRole = localStorage.getItem('userRole');
    if (!userRole) return null;
    return localStorage.getItem(userRole + '_token') || localStorage.getItem('token');
}

// ========== FETCH WITH TIMEOUT ==========
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

// ========== FETCH ACTIVE SETTINGS ==========
async function fetchActiveSettings() {
    try {
        const response = await fetchWithTimeout(API_URL + '/api/settings', {
            headers: { Authorization: 'Bearer ' + token }
        }, 15000);
        const data = await response.json();

        if (data.success) {
            currentSession = data.settings.activeSession;
            currentSemester = data.settings.activeSemester;
            console.log('Active settings from backend:', currentSession, currentSemester);

            const sidebarSession = document.getElementById('sidebarSession');
            if (sidebarSession) {
                sidebarSession.innerHTML = currentSession + ' ' + currentSemester;
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

    // FIXED: Proper loading spinner without rotation issues
    contentWrapper.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i> Connecting to server...</div>';

    const slowNotice = setTimeout(function() {
        if (contentWrapper.querySelector('.loading-spinner')) {
            contentWrapper.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i> Server is waking up, this can take up to a minute on first load...</div>';
        }
    }, 6000);

    await fetchActiveSettings();
    clearTimeout(slowNotice);

    contentWrapper.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i> Loading dashboard...</div>';

    try {
        // Fetch stats from admin API
        const statsRes = await fetchWithTimeout(API_URL + '/api/admin/stats?session=' + currentSession + '&semester=' + currentSemester, {
            headers: { Authorization: 'Bearer ' + token }
        }, 15000);
        const statsData = await statsRes.json();

        // Fetch all users to get correct counts
        const usersRes = await fetchWithTimeout(API_URL + '/api/admin/users/all', {
            headers: { Authorization: 'Bearer ' + token }
        }, 15000);
        const usersData = await usersRes.json();

        let totalStudents = 0;
        let approvedLecturers = 0;

        if (usersData.success && usersData.users) {
            totalStudents = usersData.users.filter(function(u) { return u.role === 'student'; }).length;
            approvedLecturers = usersData.users.filter(function(u) { return u.role === 'lecturer' && u.isApproved === true; }).length;
        }

        const courses = statsData.success ? statsData.stats.courses : 0;

        contentWrapper.innerHTML = `
            <!-- Stats Grid -->
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fa-solid fa-book"></i></div>
                    <div class="stat-details">
                        <h3>${courses || 0}</h3>
                        <p>Courses (${currentSemester})</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fa-solid fa-users"></i></div>
                    <div class="stat-details">
                        <h3>${totalStudents || 0}</h3>
                        <p>Students</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fa-solid fa-chalkboard-user"></i></div>
                    <div class="stat-details">
                        <h3>${approvedLecturers || 0}</h3>
                        <p>Lecturers</p>
                    </div>
                </div>
            </div>

            <!-- Welcome Card with Create Admin Button -->
            <div class="welcome-card">
                <div class="card-header">
                    <h3><i class="fa-solid fa-crown"></i> Welcome, ${localStorage.getItem('fullName') || 'Administrator'}!</h3>
                    <button class="btn-primary" onclick="openCreateAdminModal()">
                        <i class="fa-solid fa-user-plus"></i> Create Admin
                    </button>
                </div>
                <div class="card-body">
                    <p>Current Academic Session: <strong>${currentSession} ${currentSemester}</strong></p>
                    <p>Use the sidebar to manage courses, lecturers, and students.</p>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading dashboard:', error);
        const isTimeout = error.name === 'AbortError';
        contentWrapper.innerHTML = '<div class="error-message">' + (isTimeout ? 'Server took too long to respond. It may be waking up from sleep — please refresh in a moment.' : 'Failed to load dashboard. Please refresh the page.') + '</div>';
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
        const response = await fetchWithTimeout(API_URL + '/api/admin/courses/all?session=' + currentSession + '&semester=' + currentSemester, {
            headers: { Authorization: 'Bearer ' + token }
        }, 15000);
        const data = await response.json();

        if (data.success) {
            allCourses = data.courses || [];
            renderCoursesTable();
        } else {
            const spinner = document.querySelector('#contentWrapper .card .loading-spinner');
            if (spinner) spinner.outerHTML = '<div class="error-message">Failed to load courses</div>';
        }
    } catch (error) {
        console.error('Error loading courses:', error);
        const isTimeout = error.name === 'AbortError';
        const spinner = document.querySelector('#contentWrapper .card .loading-spinner');
        if (spinner) spinner.outerHTML = '<div class="error-message">' + (isTimeout ? 'Server took too long to respond.' : 'Failed to connect to server') + '</div>';
        showToast('Failed to load courses', 'danger');
    }
}

function renderCoursesTable() {
    const card = document.querySelector('#contentWrapper .card');
    if (!card) return;

    var totalCount = allCourses.length;
    var harmattanCount = allCourses.filter(function(c) { return c.semester === 'Harmattan' || c.semester === 'Both'; }).length;
    var rainCount = allCourses.filter(function(c) { return c.semester === 'Rain' || c.semester === 'Both'; }).length;

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
                    ${allCourses.map(function(course) {
                        return `
                            <tr>
                                <td><strong>${escapeHtml(course.courseCode)}</strong></td>
                                <td>${escapeHtml(course.courseTitle)}</td>
                                <td>${course.level} Level</td>
                                <td>${course.credits || 3}</td>
                                <td>
                                    <button class="btn-icon" onclick="editCourse('${course._id}')" title="Edit">
                                        <i class="fa-regular fa-pen-to-square"></i>
                                    </button>
                                    <button class="btn-icon danger" onclick="confirmDeleteCourse('${course._id}', '${course.courseCode}')" title="Delete">
                                        <i class="fa-regular fa-trash-can"></i>
                                    </button>
                                </td>
                            </tr>
                        `;
                    }).join('')}
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

    var saveBtn = document.getElementById('saveCourseBtn');
    var newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    newSaveBtn.onclick = saveCourse;
}

async function saveCourse() {
    var courseData = {
        courseCode: document.getElementById('courseCode').value.trim().toUpperCase(),
        courseTitle: document.getElementById('courseTitle').value.trim(),
        level: document.getElementById('courseLevel').value,
        credits: parseInt(document.getElementById('courseCredits').value)
    };

    if (!courseData.courseCode || !courseData.courseTitle) {
        showToast('Please fill all fields', 'warning');
        return;
    }

    var saveBtn = document.getElementById('saveCourseBtn');
    var originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

    try {
        var response = await fetchWithTimeout(API_URL + '/api/admin/courses', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(courseData)
        }, 15000);
        var data = await response.json();

        if (data.success) {
            showToast('Course added successfully for ' + currentSemester + ' semester!', 'success');
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
    var course = allCourses.find(function(c) { return c._id === courseId; });
    if (!course) return;

    document.getElementById('courseCode').value = course.courseCode;
    document.getElementById('courseCode').readOnly = true;
    document.getElementById('courseTitle').value = course.courseTitle;
    document.getElementById('courseLevel').value = course.level;
    document.getElementById('courseCredits').value = course.credits || 3;

    document.querySelector('#courseModal .modal-header h3').textContent = 'Edit Course';
    document.getElementById('courseModal').classList.add('show');

    var saveBtn = document.getElementById('saveCourseBtn');
    var newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    newSaveBtn.onclick = function() { updateCourse(courseId); };
}

async function updateCourse(courseId) {
    var courseData = {
        courseTitle: document.getElementById('courseTitle').value.trim(),
        level: document.getElementById('courseLevel').value,
        credits: parseInt(document.getElementById('courseCredits').value)
    };

    if (!courseData.courseTitle) {
        showToast('Course title is required', 'warning');
        return;
    }

    var saveBtn = document.getElementById('saveCourseBtn');
    var originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';

    try {
        var response = await fetchWithTimeout(API_URL + '/api/admin/courses/' + courseId, {
            method: 'PUT',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(courseData)
        }, 15000);
        var data = await response.json();

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

    var confirmBtn = document.getElementById('confirmDeleteCourseBtn');
    var newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    newConfirmBtn.onclick = async function() {
        await deleteCourse(currentDeleteId);
        closeModal('deleteCourseModal');
    };
}

async function deleteCourse(courseId) {
    try {
        var response = await fetchWithTimeout(API_URL + '/api/admin/courses/' + courseId, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
        }, 15000);
        var data = await response.json();

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
    var contentWrapper = document.getElementById('contentWrapper');
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
        var usersRes = await fetchWithTimeout(API_URL + '/api/admin/users/all', {
            headers: { Authorization: 'Bearer ' + token }
        }, 15000);
        var usersData = await usersRes.json();
        var allLecturers = usersData.users ? usersData.users.filter(function(u) { return u.role === 'lecturer' && u.isApproved === true; }) : [];

        if (allLecturers.length === 0) {
            var spinner = document.querySelector('#contentWrapper .card .loading-spinner');
            if (spinner) spinner.outerHTML = '<div class="empty-state">No approved lecturers registered</div>';
            return;
        }

        var lecturersWithCourses = [];

        for (var i = 0; i < allLecturers.length; i++) {
            var lecturer = allLecturers[i];
            var url = API_URL + '/api/admin/lecturer/' + lecturer._id + '/courses?session=' + currentSession + '&semester=' + currentSemester;
            var coursesRes = await fetchWithTimeout(url, {
                headers: { Authorization: 'Bearer ' + token }
            }, 15000);
            var coursesData = await coursesRes.json();

            if (coursesData.success && coursesData.courses && coursesData.courses.length > 0) {
                lecturersWithCourses.push({
                    _id: lecturer._id,
                    fullName: lecturer.fullName,
                    staffId: lecturer.staffId,
                    email: lecturer.email,
                    rank: lecturer.rank,
                    department: lecturer.department,
                    courses: coursesData.courses
                });
            }
        }

        if (lecturersWithCourses.length === 0) {
            var spinner2 = document.querySelector('#contentWrapper .card .loading-spinner');
            if (spinner2) spinner2.outerHTML = '<div class="empty-state">No lecturers with courses for ' + currentSession + ' ' + currentSemester + '</div>';
            return;
        }

        renderLecturersTable(lecturersWithCourses);

    } catch (error) {
        console.error('Error loading lecturers:', error);
        var isTimeout = error.name === 'AbortError';
        var spinner3 = document.querySelector('#contentWrapper .card .loading-spinner');
        if (spinner3) spinner3.outerHTML = '<div class="error-message">' + (isTimeout ? 'Server took too long to respond.' : 'Failed to load lecturers') + '</div>';
        showToast('Failed to load lecturers', 'danger');
    }
}

function renderLecturersTable(lecturers) {
    var card = document.querySelector('#contentWrapper .card');
    if (!card) return;

    var html = `
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

    for (var i = 0; i < lecturers.length; i++) {
        var lecturer = lecturers[i];
        var courses = lecturer.courses || [];

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
                            ${courses.map(function(c) {
                                return `
                                    <tr>
                                        <td><strong>${c.courseCode}</strong></td>
                                        <td>${escapeHtml(c.courseTitle)}</td>
                                        <td>${c.level} Level</td>
                                        <td>${c.credits || 3}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    html += '</div>';
    card.innerHTML = html;
}

// ========== LOAD STUDENTS ==========
async function loadStudents() {
    var contentWrapper = document.getElementById('contentWrapper');
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
        var response = await fetchWithTimeout(API_URL + '/api/admin/students/grouped?session=' + currentSession + '&semester=' + currentSemester, {
            headers: { Authorization: 'Bearer ' + token }
        }, 15000);
        var data = await response.json();

        if (data.success && data.data) {
            renderStudentsGrouped(data.data);
        } else {
            var spinner = document.querySelector('#contentWrapper .card .loading-spinner');
            if (spinner) spinner.outerHTML = '<div class="empty-state">No students registered for ' + currentSession + ' ' + currentSemester + '</div>';
        }
    } catch (error) {
        console.error('Error loading students:', error);
        var isTimeout = error.name === 'AbortError';
        var spinner = document.querySelector('#contentWrapper .card .loading-spinner');
        if (spinner) spinner.outerHTML = '<div class="error-message">' + (isTimeout ? 'Server took too long to respond.' : 'Failed to load students') + '</div>';
        showToast('Failed to load students', 'danger');
    }
}

function renderStudentsGrouped(groupedData) {
    var card = document.querySelector('#contentWrapper .card');
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

    var html = `
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

    for (var i = 0; i < groupedData.length; i++) {
        var levelGroup = groupedData[i];
        html += `
            <div class="level-group">
                <div class="level-header" onclick="toggleGroup(this)">
                    <i class="fa-solid fa-chevron-right"></i>
                    <h4>${levelGroup.level} Level</h4>
                    <span class="group-count">${levelGroup.totalStudents || 0} student(s)</span>
                </div>
                <div class="level-content" style="display: none;">
        `;

        var courses = levelGroup.courses || [];

        for (var j = 0; j < courses.length; j++) {
            var course = courses[j];
            var studentsList = course.students || [];
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
                                ${studentsList.map(function(s) {
                                    return `
                                        <tr>
                                            <td><strong>${escapeHtml(s.name)}</strong></td>
                                            <td>${s.matricNumber || 'N/A'}</td>
                                            <td>${s.email || 'N/A'}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }

        html += '</div></div>';
    }

    html += '</div>';
    card.innerHTML = html;
}

// ========== LOAD APPLICATIONS ==========
function loadApplications() {
    window.location.href = 'admin-applications.html';
}

// ========== LOAD SETTINGS ==========
function loadSettings() {
    window.location.href = 'admin-settings.html';
}

// ========== TOGGLE GROUP ==========
function toggleGroup(element) {
    var parent = element.parentElement;
    var content = parent.querySelector('.level-content, .course-content');
    var icon = element.querySelector('i');

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

// ========== CREATE ADMIN ==========
function openCreateAdminModal() {
    document.getElementById('adminFullName').value = '';
    document.getElementById('adminEmail').value = '';
    document.getElementById('adminDepartment').value = 'Information Technology';
    document.getElementById('adminPassword').value = '';
    document.getElementById('adminConfirmPassword').value = '';
    document.getElementById('adminSecretCode').value = '';
    document.getElementById('createAdminModal').classList.add('show');
}

function toggleAdminPassword() {
    var input = document.getElementById('adminPassword');
    var icon = document.querySelector('#adminPassword').nextElementSibling.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

function toggleAdminConfirmPassword() {
    var input = document.getElementById('adminConfirmPassword');
    var icon = document.querySelector('#adminConfirmPassword').nextElementSibling.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

async function createAdmin() {
    var fullName = document.getElementById('adminFullName').value.trim();
    var email = document.getElementById('adminEmail').value.trim();
    var department = document.getElementById('adminDepartment').value.trim();
    var password = document.getElementById('adminPassword').value;
    var confirmPassword = document.getElementById('adminConfirmPassword').value;
    var secretCode = document.getElementById('adminSecretCode').value.trim();

    if (!fullName) { showToast('Full name is required', 'warning'); return; }
    if (!email) { showToast('Email is required', 'warning'); return; }
    if (!password) { showToast('Password is required', 'warning'); return; }
    if (password.length < 8) { showToast('Password must be at least 8 characters', 'warning'); return; }
    if (password !== confirmPassword) { showToast('Passwords do not match', 'warning'); return; }
    if (!secretCode) { showToast('Admin secret code is required', 'warning'); return; }

    var createBtn = document.getElementById('createAdminBtn');
    var originalText = createBtn.innerHTML;
    createBtn.disabled = true;
    createBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating...';

    try {
        var response = await fetchWithTimeout(API_URL + '/api/admin/create-admin', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fullName: fullName,
                email: email,
                password: password,
                department: department,
                secretCode: secretCode
            })
        }, 15000);

        var data = await response.json();

        if (data.success) {
            showToast('Admin "' + fullName + '" created successfully!', 'success');
            closeModal('createAdminModal');
            loadDashboard();
        } else {
            showToast(data.message || 'Failed to create admin', 'danger');
        }
    } catch (error) {
        console.error('Error creating admin:', error);
        showToast('Failed to connect to server', 'danger');
    } finally {
        createBtn.disabled = false;
        createBtn.innerHTML = originalText;
    }
}

// ========== UTILITY FUNCTIONS ==========
function closeModal(modalId) {
    var modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('show');
}

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
    var icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
    toast.innerHTML = '<i class="fa-solid ' + icon + '"></i> ' + message + '<button class="toast-close" onclick="this.parentElement.remove()">×</button>';
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

function loadPage(page) {
    var pageTitle = document.getElementById('pageTitle');
    if (pageTitle) pageTitle.textContent = page.charAt(0).toUpperCase() + page.slice(1);

    document.querySelectorAll('.nav-item').forEach(function(nav) { nav.classList.remove('active'); });
    var activeNav = document.querySelector('.nav-item[data-page="' + page + '"]');
    if (activeNav) activeNav.classList.add('active');

    if (page === 'dashboard') loadDashboard();
    else if (page === 'courses') loadCourses();
    else if (page === 'lecturers') loadLecturers();
    else if (page === 'students') loadStudents();
    else if (page === 'applications') loadApplications();
    else if (page === 'settings') loadSettings();
}

// ========== SIDEBAR & THEME ==========
function initSidebar() {
    var sidebar = document.getElementById('sidebar');
    var sidebarToggle = document.getElementById('sidebarToggle');
    var menuBtn = document.getElementById('menuBtn');

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
}

function initDarkMode() {
    var themeToggle = document.getElementById('themeToggle');
    if (localStorage.getItem('futoTheme') === 'dark') document.body.classList.add('dark');
    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            document.body.classList.toggle('dark');
            localStorage.setItem('futoTheme', document.body.classList.contains('dark') ? 'dark' : 'light');
        });
    }
}

// ========== EVENT LISTENERS ==========
document.querySelectorAll('.nav-item[data-page]').forEach(function(nav) {
    nav.addEventListener('click', function(e) {
        e.preventDefault();
        loadPage(nav.getAttribute('data-page'));
    });
});

document.getElementById('createAdminBtn').addEventListener('click', createAdmin);

// ========== INITIALIZE ==========
document.addEventListener('DOMContentLoaded', function() {
    initDarkMode();
    initSidebar();
    fetchActiveSettings().then(function() {
        var savedPage = localStorage.getItem('adminPage');
        if (savedPage && savedPage !== 'dashboard') {
            localStorage.removeItem('adminPage');
            loadPage(savedPage);
        } else {
            loadDashboard();
        }
    });
});

// Make functions global
window.loadPage = loadPage;
window.openCourseModal = openCourseModal;
window.saveCourse = saveCourse;
window.editCourse = editCourse;
window.confirmDeleteCourse = confirmDeleteCourse;
window.openCreateAdminModal = openCreateAdminModal;
window.createAdmin = createAdmin;
window.toggleAdminPassword = toggleAdminPassword;
window.toggleAdminConfirmPassword = toggleAdminConfirmPassword;
window.closeModal = closeModal;
window.logout = logout;
window.showToast = showToast;
window.toggleGroup = toggleGroup;