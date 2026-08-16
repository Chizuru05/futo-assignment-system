// admin-dashboard.js - FIXED VERSION (ad- prefixed markup)

function getAuthToken() {
    const userRole = localStorage.getItem('userRole');
    if (!userRole) return null;
    return localStorage.getItem(userRole + '_token') || localStorage.getItem('token');
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

if (!token) {
    window.location.href = 'login.html';
}

if (userRole !== 'admin') {
    alert('Access denied. Admin only.');
    if (userRole === 'student') window.location.href = 'student-dashboard.html';
    else if (userRole === 'lecturer') window.location.href = 'lecturer-dashboard.html';
    else window.location.href = 'login.html';
}

const adminNameEl = document.getElementById('adAdminName');
if (adminNameEl) adminNameEl.textContent = localStorage.getItem('fullName') || 'Administrator';

const pageTitleEl = document.getElementById('adPageTitle');
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

            const sidebarSession = document.getElementById('adSidebarSession');
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
    const contentWrapper = document.getElementById('adContentWrapper');
    if (!contentWrapper) return;

    contentWrapper.innerHTML = '<div class="ad-panel-loading"><i class="fa-solid fa-spinner fa-spin"></i> Connecting to server...</div>';

    const slowNotice = setTimeout(function() {
        if (contentWrapper.querySelector('.ad-panel-loading')) {
            contentWrapper.innerHTML = '<div class="ad-panel-loading"><i class="fa-solid fa-spinner fa-spin"></i> Server is waking up, this can take up to a minute on first load...</div>';
        }
    }, 6000);

    await fetchActiveSettings();
    clearTimeout(slowNotice);

    contentWrapper.innerHTML = '<div class="ad-panel-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading dashboard...</div>';

    try {
        const statsRes = await fetchWithTimeout(API_URL + '/api/admin/stats?session=' + currentSession + '&semester=' + currentSemester, {
            headers: { Authorization: 'Bearer ' + token }
        }, 15000);
        const statsData = await statsRes.json();

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
            <div class="ad-stats-grid">
                <div class="ad-stat-box">
                    <div class="ad-stat-icon"><i class="fa-solid fa-book"></i></div>
                    <div class="ad-stat-text">
                        <h3>${courses || 0}</h3>
                        <p>Courses (${currentSemester})</p>
                    </div>
                </div>
                <div class="ad-stat-box">
                    <div class="ad-stat-icon"><i class="fa-solid fa-users"></i></div>
                    <div class="ad-stat-text">
                        <h3>${totalStudents || 0}</h3>
                        <p>Students</p>
                    </div>
                </div>
                <div class="ad-stat-box">
                    <div class="ad-stat-icon"><i class="fa-solid fa-chalkboard-user"></i></div>
                    <div class="ad-stat-text">
                        <h3>${approvedLecturers || 0}</h3>
                        <p>Lecturers</p>
                    </div>
                </div>
            </div>

            <div class="ad-welcome-card">
                <div class="ad-card-head">
                    <h3><i class="fa-solid fa-crown"></i> Welcome, ${localStorage.getItem('fullName') || 'Administrator'}!</h3>
                    <button class="ad-btn-primary" onclick="openCreateAdminModal()">
                        <i class="fa-solid fa-user-plus"></i> Create Admin
                    </button>
                </div>
                <div class="ad-card-body">
                    <p>Current Academic Session: <strong>${currentSession} ${currentSemester}</strong></p>
                    <p>Use the sidebar to manage courses, lecturers, and students.</p>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading dashboard:', error);
        const isTimeout = error.name === 'AbortError';
        contentWrapper.innerHTML = '<div class="ad-panel-error">' + (isTimeout ? 'Server took too long to respond. It may be waking up from sleep — please refresh in a moment.' : 'Failed to load dashboard. Please refresh the page.') + '</div>';
        showToast('Failed to load dashboard', 'danger');
    }
}

// ========== LOAD COURSES ==========
async function loadCourses() {
    const contentWrapper = document.getElementById('adContentWrapper');
    if (!contentWrapper) return;

    await fetchActiveSettings();

    contentWrapper.innerHTML = `
        <div class="ad-card">
            <div class="ad-card-head">
                <h3><i class="fa-solid fa-book"></i> Manage Courses</h3>
                <div class="ad-header-actions">
                    <button class="ad-btn-primary" onclick="openCourseModal()">
                        <i class="fa-solid fa-plus"></i> Add Course
                    </button>
                </div>
            </div>
            <div class="ad-panel-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading courses...</div>
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
            const spinner = document.querySelector('#adContentWrapper .ad-card .ad-panel-loading');
            if (spinner) spinner.outerHTML = '<div class="ad-panel-error">Failed to load courses</div>';
        }
    } catch (error) {
        console.error('Error loading courses:', error);
        const isTimeout = error.name === 'AbortError';
        const spinner = document.querySelector('#adContentWrapper .ad-card .ad-panel-loading');
        if (spinner) spinner.outerHTML = '<div class="ad-panel-error">' + (isTimeout ? 'Server took too long to respond.' : 'Failed to connect to server') + '</div>';
        showToast('Failed to load courses', 'danger');
    }
}

function renderCoursesTable() {
    const card = document.querySelector('#adContentWrapper .ad-card');
    if (!card) return;

    var totalCount = allCourses.length;
    var harmattanCount = allCourses.filter(function(c) { return c.semester === 'Harmattan' || c.semester === 'Both'; }).length;
    var rainCount = allCourses.filter(function(c) { return c.semester === 'Rain' || c.semester === 'Both'; }).length;

    if (allCourses.length === 0) {
        card.innerHTML = `
            <div class="ad-card-head">
                <h3><i class="fa-solid fa-book"></i> Manage Courses</h3>
                <div class="ad-header-actions">
                    <button class="ad-btn-primary" onclick="openCourseModal()">
                        <i class="fa-solid fa-plus"></i> Add Course
                    </button>
                </div>
            </div>
            <div class="ad-stats-mini">
                <div class="ad-stat-mini"><span class="ad-stat-value-mini">0</span><span class="ad-stat-label-mini">Total Courses</span></div>
                <div class="ad-stat-mini"><span class="ad-stat-value-mini">0</span><span class="ad-stat-label-mini">Harmattan</span></div>
                <div class="ad-stat-mini"><span class="ad-stat-value-mini">0</span><span class="ad-stat-label-mini">Rain</span></div>
            </div>
            <div class="ad-panel-empty">
                <i class="fa-regular fa-folder-open"></i>
                <p>No courses found for ${currentSession} ${currentSemester}</p>
                <button class="ad-btn-primary" onclick="openCourseModal()" style="margin-top: 1rem;">Create First Course</button>
            </div>
        `;
        return;
    }

    card.innerHTML = `
        <div class="ad-card-head">
            <h3><i class="fa-solid fa-book"></i> Manage Courses</h3>
            <div class="ad-header-actions">
                <span class="ad-active-semester-badge" style="background: var(--ad-primary-light); padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.8rem;">
                    <i class="fa-regular fa-calendar"></i> ${currentSession} ${currentSemester}
                </span>
                <button class="ad-btn-primary" onclick="openCourseModal()">
                    <i class="fa-solid fa-plus"></i> Add Course
                </button>
            </div>
        </div>
        <div class="ad-stats-mini">
            <div class="ad-stat-mini"><span class="ad-stat-value-mini">${totalCount}</span><span class="ad-stat-label-mini">Total Courses</span></div>
            <div class="ad-stat-mini"><span class="ad-stat-value-mini">${harmattanCount}</span><span class="ad-stat-label-mini">Harmattan</span></div>
            <div class="ad-stat-mini"><span class="ad-stat-value-mini">${rainCount}</span><span class="ad-stat-label-mini">Rain</span></div>
        </div>
        <div class="ad-table-wrap">
            <table class="ad-table">
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
                                    <button class="ad-icon-btn" onclick="editCourse('${course._id}')" title="Edit">
                                        <i class="fa-regular fa-pen-to-square"></i>
                                    </button>
                                    <button class="ad-icon-btn ad-danger" onclick="confirmDeleteCourse('${course._id}', '${course.courseCode}')" title="Delete">
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
    document.getElementById('adCourseCode').value = '';
    document.getElementById('adCourseCode').readOnly = false;
    document.getElementById('adCourseTitle').value = '';
    document.getElementById('adCourseLevel').value = '400';
    document.getElementById('adCourseCredits').value = '3';

    document.getElementById('adCourseModal').classList.add('ad-show');

    var saveBtn = document.getElementById('adSaveCourseBtn');
    var newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    newSaveBtn.onclick = saveCourse;
}

async function saveCourse() {
    var courseData = {
        courseCode: document.getElementById('adCourseCode').value.trim().toUpperCase(),
        courseTitle: document.getElementById('adCourseTitle').value.trim(),
        level: document.getElementById('adCourseLevel').value,
        credits: parseInt(document.getElementById('adCourseCredits').value)
    };

    if (!courseData.courseCode || !courseData.courseTitle) {
        showToast('Please fill all fields', 'warning');
        return;
    }

    var saveBtn = document.getElementById('adSaveCourseBtn');
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
            closeModal('adCourseModal');
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

    document.getElementById('adCourseCode').value = course.courseCode;
    document.getElementById('adCourseCode').readOnly = true;
    document.getElementById('adCourseTitle').value = course.courseTitle;
    document.getElementById('adCourseLevel').value = course.level;
    document.getElementById('adCourseCredits').value = course.credits || 3;

    document.querySelector('#adCourseModal .ad-modal-head h3').textContent = 'Edit Course';
    document.getElementById('adCourseModal').classList.add('ad-show');

    var saveBtn = document.getElementById('adSaveCourseBtn');
    var newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    newSaveBtn.onclick = function() { updateCourse(courseId); };
}

async function updateCourse(courseId) {
    var courseData = {
        courseTitle: document.getElementById('adCourseTitle').value.trim(),
        level: document.getElementById('adCourseLevel').value,
        credits: parseInt(document.getElementById('adCourseCredits').value)
    };

    if (!courseData.courseTitle) {
        showToast('Course title is required', 'warning');
        return;
    }

    var saveBtn = document.getElementById('adSaveCourseBtn');
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
            closeModal('adCourseModal');
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
    document.getElementById('adDeleteCourseName').textContent = courseCode;
    document.getElementById('adDeleteCourseModal').classList.add('ad-show');

    var confirmBtn = document.getElementById('adConfirmDeleteCourseBtn');
    var newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    newConfirmBtn.onclick = async function() {
        await deleteCourse(currentDeleteId);
        closeModal('adDeleteCourseModal');
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
    var contentWrapper = document.getElementById('adContentWrapper');
    if (!contentWrapper) return;

    await fetchActiveSettings();

    contentWrapper.innerHTML = `
        <div class="ad-card">
            <div class="ad-card-head">
                <h3><i class="fa-solid fa-chalkboard-user"></i> Lecturers & Their Courses</h3>
                <div class="ad-header-actions">
                    <span class="ad-active-semester-badge" style="background: var(--ad-primary-light); padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.8rem;">
                        <i class="fa-regular fa-calendar"></i> ${currentSession} ${currentSemester}
                    </span>
                </div>
            </div>
            <div class="ad-panel-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading lecturers...</div>
        </div>
    `;

    try {
        var usersRes = await fetchWithTimeout(API_URL + '/api/admin/users/all', {
            headers: { Authorization: 'Bearer ' + token }
        }, 15000);
        var usersData = await usersRes.json();
        var allLecturers = usersData.users ? usersData.users.filter(function(u) { return u.role === 'lecturer' && u.isApproved === true; }) : [];

        if (allLecturers.length === 0) {
            var spinner = document.querySelector('#adContentWrapper .ad-card .ad-panel-loading');
            if (spinner) spinner.outerHTML = '<div class="ad-panel-empty">No approved lecturers registered</div>';
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
            var spinner2 = document.querySelector('#adContentWrapper .ad-card .ad-panel-loading');
            if (spinner2) spinner2.outerHTML = '<div class="ad-panel-empty">No lecturers with courses for ' + currentSession + ' ' + currentSemester + '</div>';
            return;
        }

        renderLecturersTable(lecturersWithCourses);

    } catch (error) {
        console.error('Error loading lecturers:', error);
        var isTimeout = error.name === 'AbortError';
        var spinner3 = document.querySelector('#adContentWrapper .ad-card .ad-panel-loading');
        if (spinner3) spinner3.outerHTML = '<div class="ad-panel-error">' + (isTimeout ? 'Server took too long to respond.' : 'Failed to load lecturers') + '</div>';
        showToast('Failed to load lecturers', 'danger');
    }
}

function renderLecturersTable(lecturers) {
    var card = document.querySelector('#adContentWrapper .ad-card');
    if (!card) return;

    var html = `
        <div class="ad-card-head">
            <h3><i class="fa-solid fa-chalkboard-user"></i> Lecturers & Their Courses</h3>
            <div class="ad-header-actions">
                <span class="ad-active-semester-badge" style="background: var(--ad-primary-light); padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.8rem;">
                    <i class="fa-regular fa-calendar"></i> ${currentSession} ${currentSemester}
                </span>
            </div>
        </div>
        <div class="ad-grouped-list">
    `;

    for (var i = 0; i < lecturers.length; i++) {
        var lecturer = lecturers[i];
        var courses = lecturer.courses || [];

        html += `
            <div class="ad-level-group">
                <div class="ad-level-head" onclick="toggleGroup(this)">
                    <i class="fa-solid fa-chevron-right"></i>
                    <h4>${escapeHtml(lecturer.fullName)}</h4>
                    <span class="ad-group-count">${courses.length} course(s)</span>
                </div>
                <div class="ad-level-body" style="display: none;">
                    <div class="ad-lecturer-info" style="margin-bottom: 1rem; padding: 0.8rem; background: var(--ad-bg-body); border-radius: 8px;">
                        <p><strong>Staff ID:</strong> ${lecturer.staffId || 'N/A'}</p>
                        <p><strong>Email:</strong> ${lecturer.email}</p>
                        <p><strong>Rank:</strong> ${lecturer.rank || 'N/A'}</p>
                        <p><strong>Department:</strong> ${lecturer.department || 'Information Technology'}</p>
                    </div>
                    <h5 style="margin-top: 0.5rem; margin-bottom: 0.5rem;">Courses Teaching (${currentSession} ${currentSemester}):</h5>
                    <table class="ad-table">
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
    var contentWrapper = document.getElementById('adContentWrapper');
    if (!contentWrapper) return;

    await fetchActiveSettings();

    contentWrapper.innerHTML = `
        <div class="ad-card">
            <div class="ad-card-head">
                <h3><i class="fa-solid fa-users"></i> Students</h3>
                <div class="ad-header-actions">
                    <span class="ad-active-semester-badge" style="background: var(--ad-primary-light); padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.8rem;">
                        <i class="fa-regular fa-calendar"></i> ${currentSession} ${currentSemester}
                    </span>
                </div>
            </div>
            <div class="ad-panel-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading students...</div>
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
            var spinner = document.querySelector('#adContentWrapper .ad-card .ad-panel-loading');
            if (spinner) spinner.outerHTML = '<div class="ad-panel-empty">No students registered for ' + currentSession + ' ' + currentSemester + '</div>';
        }
    } catch (error) {
        console.error('Error loading students:', error);
        var isTimeout = error.name === 'AbortError';
        var spinner = document.querySelector('#adContentWrapper .ad-card .ad-panel-loading');
        if (spinner) spinner.outerHTML = '<div class="ad-panel-error">' + (isTimeout ? 'Server took too long to respond.' : 'Failed to load students') + '</div>';
        showToast('Failed to load students', 'danger');
    }
}

function renderStudentsGrouped(groupedData) {
    var card = document.querySelector('#adContentWrapper .ad-card');
    if (!card) return;

    if (!groupedData || groupedData.length === 0) {
        card.innerHTML = `
            <div class="ad-card-head">
                <h3><i class="fa-solid fa-users"></i> Students</h3>
                <div class="ad-header-actions">
                    <span class="ad-active-semester-badge" style="background: var(--ad-primary-light); padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.8rem;">
                        <i class="fa-regular fa-calendar"></i> ${currentSession} ${currentSemester}
                    </span>
                </div>
            </div>
            <div class="ad-panel-empty">No students registered for ${currentSession} ${currentSemester}</div>
        `;
        return;
    }

    var html = `
        <div class="ad-card-head">
            <h3><i class="fa-solid fa-users"></i> Students</h3>
            <div class="ad-header-actions">
                <span class="ad-active-semester-badge" style="background: var(--ad-primary-light); padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.8rem;">
                    <i class="fa-regular fa-calendar"></i> ${currentSession} ${currentSemester}
                </span>
            </div>
        </div>
        <div class="ad-grouped-list">
    `;

    for (var i = 0; i < groupedData.length; i++) {
        var levelGroup = groupedData[i];
        html += `
            <div class="ad-level-group">
                <div class="ad-level-head" onclick="toggleGroup(this)">
                    <i class="fa-solid fa-chevron-right"></i>
                    <h4>${levelGroup.level} Level</h4>
                    <span class="ad-group-count">${levelGroup.totalStudents || 0} student(s)</span>
                </div>
                <div class="ad-level-body" style="display: none;">
        `;

        var courses = levelGroup.courses || [];

        for (var j = 0; j < courses.length; j++) {
            var course = courses[j];
            var studentsList = course.students || [];
            html += `
                <div class="ad-course-group">
                    <div class="ad-course-head" onclick="toggleGroup(this)">
                        <i class="fa-solid fa-chevron-right"></i>
                        <strong>${course.courseCode} - ${course.courseTitle}</strong>
                        <span class="ad-group-count">${studentsList.length} student(s)</span>
                    </div>
                    <div class="ad-course-body" style="display: none;">
                        <table class="ad-table">
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
    var content = parent.querySelector('.ad-level-body, .ad-course-body');
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
    document.getElementById('adAdminFullName').value = '';
    document.getElementById('adAdminEmail').value = '';
    document.getElementById('adAdminDepartment').value = 'Information Technology';
    document.getElementById('adAdminPassword').value = '';
    document.getElementById('adAdminConfirmPassword').value = '';
    document.getElementById('adAdminSecretCode').value = '';
    document.getElementById('adCreateAdminModal').classList.add('ad-show');
}

function toggleAdminPassword() {
    var input = document.getElementById('adAdminPassword');
    var icon = document.querySelector('#adAdminPassword').nextElementSibling.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

function toggleAdminConfirmPassword() {
    var input = document.getElementById('adAdminConfirmPassword');
    var icon = document.querySelector('#adAdminConfirmPassword').nextElementSibling.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

async function createAdmin() {
    var fullName = document.getElementById('adAdminFullName').value.trim();
    var email = document.getElementById('adAdminEmail').value.trim();
    var department = document.getElementById('adAdminDepartment').value.trim();
    var password = document.getElementById('adAdminPassword').value;
    var confirmPassword = document.getElementById('adAdminConfirmPassword').value;
    var secretCode = document.getElementById('adAdminSecretCode').value.trim();

    if (!fullName) { showToast('Full name is required', 'warning'); return; }
    if (!email) { showToast('Email is required', 'warning'); return; }
    if (!password) { showToast('Password is required', 'warning'); return; }
    if (password.length < 8) { showToast('Password must be at least 8 characters', 'warning'); return; }
    if (password !== confirmPassword) { showToast('Passwords do not match', 'warning'); return; }
    if (!secretCode) { showToast('Admin secret code is required', 'warning'); return; }

    var createBtn = document.getElementById('adCreateAdminBtn');
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
            closeModal('adCreateAdminModal');
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
    if (modal) modal.classList.remove('ad-show');
}

function showToast(message, type) {
    if (type === undefined) type = 'success';
    var container = document.getElementById('adToastContainer');
    if (!container) {
        container = document.createElement('div');
        container.className = 'ad-toast-wrap';
        container.id = 'adToastContainer';
        document.body.appendChild(container);
    }

    var toast = document.createElement('div');
    toast.className = 'ad-toast ad-' + type;
    var icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
    toast.innerHTML = '<i class="fa-solid ' + icon + '"></i> ' + message + '<button class="ad-toast-close" onclick="this.parentElement.remove()">×</button>';
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
    var pageTitle = document.getElementById('adPageTitle');
    if (pageTitle) pageTitle.textContent = page.charAt(0).toUpperCase() + page.slice(1);

    document.querySelectorAll('.ad-nav-link').forEach(function(nav) { nav.classList.remove('ad-nav-active'); });
    var activeNav = document.querySelector('.ad-nav-link[data-page="' + page + '"]');
    if (activeNav) activeNav.classList.add('ad-nav-active');

    if (page === 'dashboard') loadDashboard();
    else if (page === 'courses') loadCourses();
    else if (page === 'lecturers') loadLecturers();
    else if (page === 'students') loadStudents();
    else if (page === 'applications') loadApplications();
    else if (page === 'settings') loadSettings();
}

// ========== SIDEBAR & THEME ==========
function initSidebar() {
    var sidebar = document.getElementById('adSidebar');
    var sidebarToggle = document.getElementById('adSidebarToggle');
    var menuBtn = document.getElementById('adMenuBtn');

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            if (window.innerWidth <= 1024) {
                sidebar.classList.remove('ad-show');
            } else {
                sidebar.classList.toggle('ad-collapsed');
            }
        });
    }
    if (menuBtn) {
        menuBtn.addEventListener('click', function() {
            sidebar.classList.toggle('ad-show');
        });
    }

    document.addEventListener('click', function(e) {
        if (window.innerWidth <= 1024 && sidebar && menuBtn) {
            if (!sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
                sidebar.classList.remove('ad-show');
            }
        }
    });

    if (window.innerWidth <= 1024) {
        sidebar.classList.remove('ad-collapsed');
    }
}

function initDarkMode() {
    var themeToggle = document.getElementById('adThemeToggle');
    if (localStorage.getItem('futoTheme') === 'dark') document.body.classList.add('dark');
    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            document.body.classList.toggle('dark');
            localStorage.setItem('futoTheme', document.body.classList.contains('dark') ? 'dark' : 'light');
        });
    }
}

// ========== EVENT LISTENERS ==========
document.querySelectorAll('.ad-nav-link[data-page]').forEach(function(nav) {
    nav.addEventListener('click', function(e) {
        e.preventDefault();
        loadPage(nav.getAttribute('data-page'));
    });
});

document.getElementById('adCreateAdminBtn').addEventListener('click', createAdmin);

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