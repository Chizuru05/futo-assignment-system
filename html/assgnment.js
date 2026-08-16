// ========== TOKEN FUNCTION ==========
function getAuthToken() {
    const userRole = localStorage.getItem('userRole');
    if (!userRole) return null;
    return localStorage.getItem(userRole + '_token') || localStorage.getItem('token');
}

const token = getAuthToken();
const userRole = localStorage.getItem('userRole');

console.log('=== ASSIGNMENT PAGE DEBUG ===');
console.log('Token exists:', !!token);
console.log('User role:', userRole);

if (!token) {
    console.log('No token, redirecting to login');
    window.location.href = 'login.html';
}

if (userRole !== 'student') {
    console.log('Not a student, redirecting');
    if (userRole === 'lecturer') window.location.href = 'lecturer-dashboard.html';
    else if (userRole === 'admin') window.location.href = 'admin-dashboard.html';
    else window.location.href = 'login.html';
}

const userName = localStorage.getItem('fullName') || localStorage.getItem('userName') || 'Student';
const userMatric = localStorage.getItem('matricNumber') || localStorage.getItem('userMatric') || '';
const userLevel = localStorage.getItem('level') || localStorage.getItem('userLevel') || '500';

let allAssignments = [];
let mySubmissions = [];
let enrolledCourses = [];
let currentFilter = 'all';
let currentCourseFilter = 'all';
let currentAssignmentForSubmission = null;
let pollingInterval = null;
let lastUpdateTimestamp = Date.now();
let currentSession = '';
let currentSemester = '';

function getDueDateTime(assignment) {
    const datePart = (assignment.dueDateISO || '').split('T')[0];
    return new Date(datePart + ' ' + (assignment.dueTime || '23:59'));
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

function fetchWithTimeout(url, options, timeoutMs) {
    if (timeoutMs === undefined) timeoutMs = 20000;
    const controller = new AbortController();
    const timeout = setTimeout(function() { controller.abort(); }, timeoutMs);
    return fetch(url, Object.assign({}, options, { signal: controller.signal }))
        .finally(function() { clearTimeout(timeout); });
}

// DOM Elements
const assignmentContainer = document.getElementById('assignmentList');
const statTotal = document.getElementById('totalAssignments');
const statPending = document.getElementById('pendingAssignments');
const statSubmitted = document.getElementById('submittedAssignments');
const deadlineContainer = document.getElementById('deadlineList');
const deadlineBadge = document.getElementById('deadlineBadge');
const filterBtns = document.querySelectorAll('.as-tab');
const courseFilter = document.getElementById('courseFilter');
const sidebarBadge = document.getElementById('pendingBadge');
const notifCount = document.getElementById('notifCount');
const assignmentModal = document.getElementById('assignmentModal');
const submissionModal = document.getElementById('submissionModal');
const gradeModal = document.getElementById('gradeModal');
const searchInput = document.getElementById('searchInput');

function updateSidebarSessionInfo() {
    const sessionInfo = document.getElementById('sessionInfo');
    if (sessionInfo && currentSession && currentSemester) {
        sessionInfo.textContent = currentSession + ' ' + currentSemester;
    }
}

async function fetchActiveSettings() {
    try {
        const response = await fetch(API_URL + '/api/settings', {
            headers: { Authorization: 'Bearer ' + token }
        });
        const data = await response.json();

        if (data.success) {
            currentSession = data.settings.activeSession;
            currentSemester = data.settings.activeSemester;
            localStorage.setItem('currentSession', currentSession);
            localStorage.setItem('currentSemester', currentSemester);
            console.log('Active settings loaded:', currentSession, currentSemester);

            const pageSubtitle = document.getElementById('pageSubtitle');
            if (pageSubtitle) {
                pageSubtitle.innerHTML = 'You are in <strong>' + userLevel + ' Level</strong> · ' + currentSession + ' ' + currentSemester;
            }

            updateSidebarSessionInfo();
        }
    } catch (error) {
        console.error('Error fetching active settings:', error);
        currentSession = localStorage.getItem('currentSession') || '2025-2026';
        currentSemester = localStorage.getItem('currentSemester') || 'Harmattan';
        updateSidebarSessionInfo();
    }
}

function updateProfileDisplay() {
    const profileName = document.getElementById('profileName');
    const profileMatric = document.getElementById('profileMatric');
    const profileLevel = document.getElementById('profileLevel');

    if (profileName) profileName.textContent = userName;
    if (profileMatric) profileMatric.textContent = userMatric;
    if (profileLevel) profileLevel.textContent = userLevel + ' Level';
}

async function refreshPage() {
    showToast('Checking for deadline updates...', 'info');
    allAssignments = [];
    mySubmissions = [];
    await fetchData(true);
    showToast('Assignments refreshed!', 'success');
}

async function fetchData(forceRefresh) {
    if (forceRefresh === undefined) forceRefresh = false;
    if (!assignmentContainer) return;
    assignmentContainer.innerHTML = '<div class="as-panel-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading assignments...</div>';

    var timestamp = Date.now();
    lastUpdateTimestamp = timestamp;

    try {
        var coursesRes = await fetch(
            API_URL + '/api/student/my-courses?session=' + currentSession + '&semester=' + currentSemester + '&_=' + timestamp,
            {
                headers: {
                    Authorization: 'Bearer ' + token,
                    'Cache-Control': 'no-cache, no-store, must-revalidate'
                }
            }
        );
        var coursesData = await coursesRes.json();

        if (coursesData.success) {
            enrolledCourses = coursesData.courses || [];
            updateCourseFilter();
        }

        var assignmentsRes = await fetch(API_URL + '/api/assignments/all?_=' + timestamp, {
            headers: {
                Authorization: 'Bearer ' + token,
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
        });
        var assignmentsData = await assignmentsRes.json();

        if (assignmentsData.success) {
            var allFetchedAssignments = assignmentsData.assignments || [];

            allAssignments = allFetchedAssignments.filter(function(assignment) {
                var assignmentSession = assignment.session || '2025-2026';
                var assignmentSemester = assignment.semester || 'Harmattan';
                return assignmentSession === currentSession && assignmentSemester === currentSemester;
            });

            if (statTotal) statTotal.textContent = allAssignments.length;
            console.log('Total assignments for ' + currentSession + ' ' + currentSemester + ': ' + allAssignments.length);
        }

        var submissionsRes = await fetch(API_URL + '/api/submissions/my-submissions?_=' + timestamp, {
            headers: {
                Authorization: 'Bearer ' + token,
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
        });
        var submissionsData = await submissionsRes.json();

        if (submissionsData.success) {
            mySubmissions = submissionsData.submissions || [];

            if (statSubmitted) statSubmitted.textContent = mySubmissions.length;
            console.log('Submitted assignments for ' + currentSession + ' ' + currentSemester + ': ' + mySubmissions.length);

            var pendingCount = allAssignments.length - mySubmissions.length;
            var finalPending = pendingCount > 0 ? pendingCount : 0;

            if (statPending) statPending.textContent = finalPending;
            if (sidebarBadge) sidebarBadge.textContent = finalPending > 0 ? finalPending : '';
            if (notifCount) notifCount.textContent = finalPending > 0 ? (finalPending > 9 ? '9+' : finalPending) : '0';

            console.log('Pending assignments: ' + finalPending);
        }

        renderAssignments();
        renderDeadlines();

        if (forceRefresh) {
            showToast('Assignments updated successfully!', 'success');
        }

    } catch (error) {
        console.error('Error fetching data:', error);
        if (assignmentContainer) {
            assignmentContainer.innerHTML = '<div class="as-panel-empty">Failed to load assignments. <button onclick="refreshPage()" class="as-btn-primary" style="margin-top: 10px;">Retry</button></div>';
        }
    }
}

async function checkForUpdates() {
    if (!document.hasFocus()) return;

    var timestamp = Date.now();

    try {
        var response = await fetch(API_URL + '/api/assignments/all?_=' + timestamp, {
            headers: {
                Authorization: 'Bearer ' + token,
                'Cache-Control': 'no-cache'
            }
        });

        var data = await response.json();

        if (data.success && data.assignments) {
            var currentAssignments = data.assignments.filter(function(assignment) {
                var assignmentSession = assignment.session || '2025-2026';
                var assignmentSemester = assignment.semester || 'Harmattan';
                return assignmentSession === currentSession && assignmentSemester === currentSemester;
            });

            var hasChanges = false;

            if (currentAssignments.length !== allAssignments.length) {
                hasChanges = true;
            } else {
                for (var i = 0; i < currentAssignments.length; i++) {
                    var newAssignment = currentAssignments[i];
                    var oldAssignment = allAssignments.find(function(a) { return a._id === newAssignment._id; });

                    if (!oldAssignment) {
                        hasChanges = true;
                        break;
                    }

                    if (oldAssignment.dueDateISO !== newAssignment.dueDateISO ||
                        oldAssignment.dueTime !== newAssignment.dueTime ||
                        oldAssignment.title !== newAssignment.title) {
                        hasChanges = true;
                        console.log('Assignment changed: ' + newAssignment.title);
                        break;
                    }
                }
            }

            if (hasChanges) {
                console.log('Detected assignment changes, refreshing...');
                showToast('Assignment deadlines have been updated!', 'info');
                await fetchData();
            }
        }
    } catch (error) {
        console.log('Polling check failed:', error.message);
    }
}

function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(checkForUpdates, 20000);
}

function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}

function updateCourseFilter() {
    if (!courseFilter) return;
    courseFilter.innerHTML = '<option value="all">All Courses</option>';
    enrolledCourses.forEach(function(course) {
        var option = document.createElement('option');
        option.value = course.courseCode;
        option.textContent = course.courseCode + ' - ' + course.courseTitle;
        courseFilter.appendChild(option);
    });
}

async function viewAssignmentDetails(assignmentId) {
    try {
        showToast('Loading assignment details...', 'info');

        var response = await fetch(API_URL + '/api/assignments/' + assignmentId + '?_=' + Date.now(), {
            headers: {
                Authorization: 'Bearer ' + token,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
            }
        });

        var data = await response.json();

        if (data.success && data.assignment) {
            var index = allAssignments.findIndex(function(a) { return a._id === assignmentId; });
            if (index !== -1) {
                allAssignments[index] = data.assignment;
            } else {
                allAssignments.push(data.assignment);
            }

            displayAssignmentModal(data.assignment);
            currentAssignmentForSubmission = data.assignment;

            renderAssignments();
            renderDeadlines();
        } else {
            var assignment = allAssignments.find(function(a) { return a._id === assignmentId; });
            if (assignment) {
                displayAssignmentModal(assignment);
                currentAssignmentForSubmission = assignment;
            } else {
                showToast('Failed to load assignment details', 'danger');
            }
        }
    } catch (error) {
        console.error('Error fetching assignment details:', error);
        showToast('Failed to load assignment details', 'danger');
    }
}

function displayAssignmentModal(assignment) {
    var modalTitle = document.getElementById('modalTitle');
    var modalBody = document.getElementById('modalBody');

    if (!modalTitle || !modalBody) return;

    modalTitle.innerHTML = '<i class="fa-regular fa-file-lines"></i> ' + assignment.course + ' - ' + assignment.title;

    var isSubmitted = mySubmissions.some(function(s) { return s.assignmentId && s.assignmentId._id === assignment._id; });
    var submission = mySubmissions.find(function(s) { return s.assignmentId && s.assignmentId._id === assignment._id; });
    var isGraded = submission && submission.status === 'graded';

    var dueDate = getDueDateTime(assignment);
    var today = new Date();
    var diffTime = dueDate - today;
    var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    var isOverdue = diffTime < 0;

    var allowLate = assignment.allowLate !== false;
    var canSubmit = !isOverdue || (isOverdue && allowLate);

    var dueStatusHtml = '';
    if (isOverdue) {
        if (allowLate) {
            dueStatusHtml = '<span class="as-status-pill as-warning"><i class="fa-solid fa-clock"></i> Late Submission Allowed</span>';
        } else {
            dueStatusHtml = '<span class="as-status-pill as-locked"><i class="fa-solid fa-lock"></i> Submission Closed</span>';
        }
    } else if (diffDays === 0) {
        dueStatusHtml = '<span class="as-status-pill as-urgent"><i class="fa-solid fa-clock"></i> Due Today!</span>';
    } else if (diffDays <= 3) {
        dueStatusHtml = '<span class="as-status-pill as-warning"><i class="fa-solid fa-hourglass-half"></i> ' + diffDays + ' days left</span>';
    } else {
        dueStatusHtml = '<span class="as-status-pill as-normal"><i class="fa-regular fa-calendar"></i> ' + diffDays + ' days left</span>';
    }

    var rubricHtml = '';
    if (assignment.rubric && assignment.rubric.length > 0) {
        rubricHtml = `
            <div class="as-rubric-section">
                <h4><i class="fa-solid fa-table-list"></i> Grading Rubric</h4>
                <table class="as-rubric-table">
                    <thead>
                        <tr><th>Criterion</th><th>Max Points</th></tr>
                    </thead>
                    <tbody>
                        ${assignment.rubric.map(function(r) {
                            return '<tr><td>' + escapeHtml(r.name) + '</td><td class="as-text-center">' + r.maxScore + '</td></tr>';
                        }).join('')}
                        <tr class="as-rubric-total-row">
                            <td><strong>Total</strong></td>
                            <td class="as-text-center"><strong>${assignment.totalMarks || 0}</strong></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    }

    var submissionHtml = '';
    if (isSubmitted && submission) {
        if (isGraded) {
            var percentage = ((submission.totalScore / assignment.totalMarks) * 100).toFixed(1);
            var gradeLetter = 'F';
            if (percentage >= 70) gradeLetter = 'A';
            else if (percentage >= 60) gradeLetter = 'B';
            else if (percentage >= 50) gradeLetter = 'C';
            else if (percentage >= 45) gradeLetter = 'D';
            else if (percentage >= 40) gradeLetter = 'E';

            submissionHtml = `
                <div class="as-graded-info">
                    <h4><i class="fa-solid fa-chart-line"></i> Your Grade</h4>
                    <div class="as-grade-details">
                        <div class="as-grade-score">
                            <span class="as-score-value">${submission.totalScore}/${assignment.totalMarks}</span>
                            <span class="as-score-pct">(${percentage}%)</span>
                            <span class="as-score-letter">Grade: ${gradeLetter}</span>
                        </div>
                        <div class="as-grade-feedback">
                            <strong>Feedback:</strong>
                            <p>${escapeHtml(submission.feedback || 'No additional feedback provided.')}</p>
                        </div>
                    </div>
                </div>
            `;
        } else {
            submissionHtml = `
                <div class="as-submitted-info">
                    <h4><i class="fa-regular fa-clock"></i> Submission Status</h4>
                    <p>You have submitted this assignment. It is currently being reviewed.</p>
                    <p class="as-submission-date">Submitted on: ${new Date(submission.submittedAt).toLocaleString()}</p>
                </div>
            `;
        }
    }

    modalBody.innerHTML = `
        <div class="as-details-wrap">
            <div class="as-detail-head">
                <div class="as-detail-meta">
                    <div class="as-meta-row">
                        <span><i class="fa-regular fa-calendar"></i> Due: ${assignment.dueDate} at ${assignment.dueTime || '23:59'}</span>
                        ${dueStatusHtml}
                    </div>
                    <div class="as-meta-row">
                        <span><i class="fa-regular fa-star"></i> Total Marks: ${assignment.totalMarks || 0}</span>
                    </div>
                    <div class="as-meta-row">
                        <span><i class="fa-regular fa-calendar-alt"></i> Session: ${assignment.session || currentSession} ${assignment.semester || currentSemester}</span>
                    </div>
                </div>
            </div>

            <div class="as-detail-desc">
                <h4><i class="fa-regular fa-rectangle-list"></i> Description / Instructions</h4>
                <div class="as-desc-content">
                    ${escapeHtml(assignment.description || 'No description provided.').replace(/\n/g, '<br>')}
                </div>
            </div>

            ${rubricHtml}
            ${submissionHtml}
        </div>
    `;

    var modalSubmitBtn = document.getElementById('modalSubmitBtn');
    if (modalSubmitBtn) {
        if (isSubmitted) {
            modalSubmitBtn.innerHTML = '<i class="fa-regular fa-pen-to-square"></i> Update Submission';
            modalSubmitBtn.disabled = false;
            modalSubmitBtn.style.opacity = '1';
            modalSubmitBtn.style.cursor = 'pointer';
        } else if (!canSubmit) {
            modalSubmitBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Submission Closed';
            modalSubmitBtn.disabled = true;
            modalSubmitBtn.style.opacity = '0.6';
            modalSubmitBtn.style.cursor = 'not-allowed';
        } else {
            modalSubmitBtn.innerHTML = '<i class="fa-regular fa-paper-plane"></i> Submit Assignment';
            modalSubmitBtn.disabled = false;
            modalSubmitBtn.style.opacity = '1';
            modalSubmitBtn.style.cursor = 'pointer';
        }

        var newBtn = modalSubmitBtn.cloneNode(true);
        modalSubmitBtn.parentNode.replaceChild(newBtn, modalSubmitBtn);
        newBtn.addEventListener('click', function() { submitFromModal(); });
    }

    assignmentModal.classList.add('as-show');
    document.body.style.overflow = 'hidden';
}

function closeAssignmentModal() {
    if (assignmentModal) assignmentModal.classList.remove('as-show');
    document.body.style.overflow = '';
}

function submitFromModal() {
    closeAssignmentModal();
    if (currentAssignmentForSubmission) {
        openSubmitModal(currentAssignmentForSubmission._id);
    }
}

function openSubmitModal(assignmentId) {
    var assignment = allAssignments.find(function(a) { return a._id === assignmentId; });
    if (!assignment) {
        showToast('Assignment not found', 'danger');
        return;
    }

    var dueDate = getDueDateTime(assignment);
    var today = new Date();
    var isOverdue = dueDate < today;
    var allowLate = assignment.allowLate !== false;

    if (isOverdue && !allowLate) {
        showToast('This assignment is past the due date and late submissions are not allowed.', 'warning');
        return;
    }

    if (isOverdue && allowLate) {
        showToast('Late submission - penalty may apply', 'warning');
    }

    currentAssignmentForSubmission = assignment;

    var submissionAssignmentInfo = document.getElementById('submissionAssignmentInfo');
    if (submissionAssignmentInfo) {
        submissionAssignmentInfo.innerHTML = `
            <div class="as-submission-info">
                <p><strong>Course:</strong> ${assignment.course}</p>
                <p><strong>Assignment:</strong> ${assignment.title}</p>
                <p><strong>Due Date:</strong> ${assignment.dueDate} at ${assignment.dueTime || '23:59'}</p>
                <p><strong>Total Marks:</strong> ${assignment.totalMarks || 0}</p>
                <p><strong>Session:</strong> ${assignment.session || currentSession} ${assignment.semester || currentSemester}</p>
                ${isOverdue ? '<p class="as-late-warning"><i class="fa-solid fa-triangle-exclamation"></i> LATE SUBMISSION</p>' : ''}
            </div>
        `;
    }

    var fileListDiv = document.getElementById('submissionFileList');
    var commentsTextarea = document.getElementById('submissionComments');
    var fileInput = document.getElementById('submissionFiles');
    var uploadBtn = document.getElementById('uploadBtn');

    if (fileListDiv) fileListDiv.innerHTML = '';
    if (commentsTextarea) commentsTextarea.value = '';
    if (fileInput) fileInput.value = '';
    if (uploadBtn) {
        uploadBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit';
        uploadBtn.disabled = false;
    }

    submissionModal.classList.add('as-show');
    document.body.style.overflow = 'hidden';
}

function closeSubmissionModal() {
    if (submissionModal) submissionModal.classList.remove('as-show');
    document.body.style.overflow = '';
    currentAssignmentForSubmission = null;
}

async function uploadAssignment() {
    if (!currentAssignmentForSubmission) {
        showToast('No assignment selected', 'danger');
        return;
    }

    var fileInput = document.getElementById('submissionFiles');
    var files = fileInput ? fileInput.files : [];
    var comments = document.getElementById('submissionComments') ? document.getElementById('submissionComments').value : '';

    if (files.length === 0) {
        showToast('Please select at least one file to upload', 'warning');
        return;
    }

    var uploadBtn = document.getElementById('uploadBtn');
    var originalText = uploadBtn ? uploadBtn.innerHTML : 'Submit';

    if (uploadBtn) {
        uploadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';
        uploadBtn.disabled = true;
    }
    showToast('Uploading — this can take up to a minute if the server was idle', 'info', 8000);

    var formData = new FormData();
    formData.append('assignmentId', currentAssignmentForSubmission._id);
    formData.append('comments', comments);

    for (var i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
    }

    try {
        var response = await fetchWithTimeout(API_URL + '/api/submissions', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token },
            body: formData
        }, 25000);

        var data = await response.json();

        if (response.ok && data.success) {
            showToast('Assignment submitted successfully!', 'success');
            closeSubmissionModal();
            await fetchData(true);
        } else {
            showToast(data.message || 'Failed to submit assignment', 'danger');
        }
    } catch (error) {
        console.error('Upload error:', error);
        if (error.name === 'AbortError') {
            showToast('Upload timed out — the server may be slow. Please try again.', 'danger');
        } else {
            showToast('Failed to submit assignment. Please try again.', 'danger');
        }
    } finally {
        if (uploadBtn) {
            uploadBtn.innerHTML = originalText;
            uploadBtn.disabled = false;
        }
    }
}

async function viewGrade(assignmentId) {
    try {
        var submission = mySubmissions.find(function(s) { return s.assignmentId && s.assignmentId._id === assignmentId; });
        var assignment = allAssignments.find(function(a) { return a._id === assignmentId; });

        if (!submission || !assignment) {
            showToast('Grade information not found', 'danger');
            return;
        }

        var percentage = ((submission.totalScore / assignment.totalMarks) * 100).toFixed(1);
        var gradeLetter = 'F';
        var gradeClass = 'as-grade-f';

        if (percentage >= 70) { gradeLetter = 'A';
            gradeClass = 'as-grade-a'; } else if (percentage >= 60) { gradeLetter = 'B';
            gradeClass = 'as-grade-b'; } else if (percentage >= 50) { gradeLetter = 'C';
            gradeClass = 'as-grade-c'; } else if (percentage >= 45) { gradeLetter = 'D';
            gradeClass = 'as-grade-d'; } else if (percentage >= 40) { gradeLetter = 'E';
            gradeClass = 'as-grade-e'; }

        var gradeModalBody = document.getElementById('gradeModalBody');
        if (gradeModalBody) {
            gradeModalBody.innerHTML = `
                <div class="as-grade-modal-wrap">
                    <div class="as-grade-summary ${gradeClass}">
                        <div class="as-grade-score-lg">
                            <span class="as-score">${submission.totalScore}</span>
                            <span class="as-out-of">/${assignment.totalMarks}</span>
                        </div>
                        <div class="as-grade-pct-lg">${percentage}%</div>
                        <div class="as-grade-letter-lg">${gradeLetter}</div>
                    </div>

                    <div class="as-grade-breakdown">
                        <h4>Score Breakdown</h4>
                        ${submission.scores && Object.keys(submission.scores).length > 0 ? `
                            <table class="as-breakdown-table">
                                <thead>
                                    <tr><th>Criterion</th><th>Score</th><th>Max</th></tr>
                                </thead>
                                <tbody>
                                    ${Object.entries(submission.scores).map(function(entry) {
                                        return '<tr><td>' + escapeHtml(entry[0]) + '</td><td>' + entry[1] + '</td><td>-</td></tr>';
                                    }).join('')}
                                </tbody>
                            </table>
                        ` : '<p>No breakdown available</p>'}
                    </div>

                    <div class="as-grade-feedback-modal">
                        <h4>Lecturer\'s Feedback</h4>
                        <p>${escapeHtml(submission.feedback || 'No feedback provided.')}</p>
                    </div>
                </div>
            `;
        }

        gradeModal.classList.add('as-show');
        document.body.style.overflow = 'hidden';

    } catch (error) {
        console.error('Error viewing grade:', error);
        showToast('Failed to load grade details', 'danger');
    }
}

function closeGradeModal() {
    if (gradeModal) gradeModal.classList.remove('as-show');
    document.body.style.overflow = '';
}

function renderAssignments() {
    if (!assignmentContainer) return;

    var filtered = allAssignments.slice();
    var submittedIds = new Set(mySubmissions.map(function(s) { return s.assignmentId ? s.assignmentId._id : null; }));

    if (currentCourseFilter !== 'all') {
        filtered = filtered.filter(function(a) { return a.course === currentCourseFilter; });
    }

    if (currentFilter === 'pending') {
        filtered = filtered.filter(function(a) { return !submittedIds.has(a._id); });
    } else if (currentFilter === 'submitted') {
        filtered = filtered.filter(function(a) { return submittedIds.has(a._id); });
    } else if (currentFilter === 'graded') {
        filtered = filtered.filter(function(a) {
            var sub = mySubmissions.find(function(s) { return s.assignmentId && s.assignmentId._id === a._id; });
            return sub && sub.status === 'graded';
        });
    } else if (currentFilter === 'thisweek') {
        var today = new Date();
        var nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);
        filtered = filtered.filter(function(a) {
            var due = getDueDateTime(a);
            return due >= today && due <= nextWeek;
        });
    }

    var searchQuery = searchInput ? searchInput.value.toLowerCase() : '';
    if (searchQuery) {
        filtered = filtered.filter(function(a) {
            return a.title.toLowerCase().includes(searchQuery) ||
                a.course.toLowerCase().includes(searchQuery);
        });
    }

    if (filtered.length === 0) {
        assignmentContainer.innerHTML = '<div class="as-panel-empty">No assignments found for ' + currentSession + ' ' + currentSemester + '</div>';
        return;
    }

    assignmentContainer.innerHTML = filtered.map(function(assignment) {
        var isSubmitted = submittedIds.has(assignment._id);
        var submission = mySubmissions.find(function(s) { return s.assignmentId && s.assignmentId._id === assignment._id; });
        var isGraded = submission && submission.status === 'graded';

        var dueDate = getDueDateTime(assignment);
        var today = new Date();
        var diffTime = dueDate - today;
        var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        var diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
        var isOverdue = dueDate < today;
        var allowLate = assignment.allowLate !== false;

        var isLocked = isOverdue && !allowLate;

        var dueClass = '';
        var dueText = '';

        if (isLocked) {
            dueClass = 'as-locked';
            dueText = 'Submission Closed';
        } else if (isOverdue && allowLate) {
            dueClass = 'as-warning';
            dueText = 'Late (' + Math.abs(diffHours) + 'h overdue)';
        } else if (diffDays === 0) {
            dueClass = 'as-urgent';
            dueText = diffHours <= 1 ? 'Due in ' + diffHours + ' hour' : 'Due in ' + diffHours + ' hours';
        } else if (diffDays === 1) {
            dueClass = 'as-warning';
            dueText = 'Due tomorrow';
        } else if (diffDays <= 3) {
            dueClass = 'as-warning';
            dueText = 'Due in ' + diffDays + ' days';
        } else {
            dueClass = 'as-normal';
            dueText = 'Due in ' + diffDays + ' days';
        }

        var gradeInfo = '';
        if (isGraded && submission) {
            var percentage = ((submission.totalScore / assignment.totalMarks) * 100).toFixed(0);
            gradeInfo = '<div class="as-grade-preview"><span class="as-grade-label">Grade:</span><span class="as-grade-value">' + submission.totalScore + '/' + assignment.totalMarks + '</span><span class="as-grade-pct">' + percentage + '%</span></div>';
        }

        var statusClass = isLocked ? 'as-locked' : '';
        var statusBarClass = isLocked ? 'as-locked' : (isGraded ? 'as-graded' : (isSubmitted ? 'as-submitted' : dueClass));

        return `
            <div class="as-tile ${statusClass}">
                <div class="as-tile-bar ${statusBarClass}"></div>
                <div class="as-tile-content">
                    <div class="as-tile-head">
                        <span class="as-tile-code">${assignment.course}</span>
                        ${!isSubmitted ?
                            '<span class="as-due-pill ' + dueClass + '">' + dueText + '</span>' :
                            '<span class="as-status-pill">' + (isGraded ? 'Graded' : 'Submitted') + '</span>'}
                    </div>
                    <h3 class="as-tile-title">${escapeHtml(assignment.title)}</h3>
                    <div class="as-tile-meta">
                        <span><i class="fa-regular fa-star"></i> ${assignment.totalMarks || 0} Marks</span>
                        <span><i class="fa-regular fa-calendar"></i> Due: ${assignment.dueDate} at ${assignment.dueTime || '23:59'}</span>
                    </div>
                    ${gradeInfo}
                    <div class="as-tile-actions">
                        <button class="as-btn-primary" onclick="viewAssignmentDetails('${assignment._id}')">
                            <i class="fa-regular fa-eye"></i> View Details
                        </button>
                        ${!isSubmitted && !isLocked ? `
                            <button class="as-btn-outline" onclick="openSubmitModal('${assignment._id}')">
                                <i class="fa-solid fa-upload"></i> Submit
                            </button>
                        ` : isLocked && !isSubmitted ? `
                            <button class="as-btn-outline" disabled>
                                <i class="fa-solid fa-lock"></i> Closed
                            </button>
                        ` : isSubmitted && !isGraded ? `
                            <button class="as-btn-outline" disabled>
                                <i class="fa-regular fa-clock"></i> Pending Review
                            </button>
                        ` : isGraded ? `
                            <button class="as-btn-outline" onclick="viewGrade('${assignment._id}')">
                                <i class="fa-solid fa-chart-line"></i> View Grade
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderDeadlines() {
    if (!deadlineContainer) return;

    var today = new Date();
    var submittedIds = new Set(mySubmissions.map(function(s) { return s.assignmentId ? s.assignmentId._id : null; }));

    var upcoming = allAssignments
        .filter(function(a) {
            var isSubmitted = submittedIds.has(a._id);
            if (isSubmitted) return false;
            var isOverdue = getDueDateTime(a) < today;
            var allowLate = a.allowLate !== false;
            return !isOverdue || (isOverdue && allowLate);
        })
        .sort(function(a, b) { return getDueDateTime(a) - getDueDateTime(b); })
        .slice(0, 4);

    var nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    var dueThisWeek = allAssignments.filter(function(a) {
        var due = getDueDateTime(a);
        return !submittedIds.has(a._id) && due >= today && due <= nextWeek;
    }).length;

    if (deadlineBadge) deadlineBadge.textContent = dueThisWeek + ' This Week';

    if (upcoming.length === 0) {
        deadlineContainer.innerHTML = '<div class="as-panel-empty">No upcoming deadlines</div>';
        return;
    }

    deadlineContainer.innerHTML = upcoming.map(function(assignment) {
        var due = getDueDateTime(assignment);
        var diffMs = due - today;
        var diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        var diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
        var isOverdue = due < today;
        var allowLate = assignment.allowLate !== false;

        var itemClass = '';
        var badgeText = '';

        if (isOverdue && allowLate) {
            itemClass = 'as-warning';
            badgeText = 'LATE (' + Math.abs(diffHours) + 'h)';
        } else if (diffDays === 0) {
            if (diffHours <= 1) {
                itemClass = 'as-urgent';
                badgeText = '1 hour left';
            } else {
                itemClass = 'as-urgent';
                badgeText = diffHours + ' hours left';
            }
        } else if (diffDays === 1) {
            itemClass = 'as-warning';
            badgeText = 'Tomorrow';
        } else if (diffDays <= 3) {
            itemClass = 'as-warning';
            badgeText = diffDays + ' days left';
        } else {
            badgeText = diffDays + ' days left';
        }

        return `
            <div class="as-deadline-item ${itemClass}" onclick="viewAssignmentDetails('${assignment._id}')" style="cursor: pointer;">
                <div class="as-deadline-time">
                    <span class="as-date">${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    <span class="as-time">${assignment.dueTime || '23:59'}</span>
                </div>
                <div class="as-deadline-info">
                    <span class="as-course">${assignment.course}</span>
                    <span class="as-assignment">${escapeHtml(assignment.title)}</span>
                </div>
                <span class="as-deadline-badge-sm ${itemClass}">${badgeText}</span>
            </div>
        `;
    }).join('');
}

function setupFileUpload() {
    var uploadArea = document.getElementById('uploadArea');
    var fileInput = document.getElementById('submissionFiles');
    var fileListDiv = document.getElementById('submissionFileList');

    if (!uploadArea || !fileInput) return;

    uploadArea.addEventListener('click', function() { fileInput.click(); });

    uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        uploadArea.style.background = 'rgba(42, 122, 75, 0.1)';
        uploadArea.style.borderColor = '#2a7a4b';
    });

    uploadArea.addEventListener('dragleave', function() {
        uploadArea.style.background = '';
        uploadArea.style.borderColor = '';
    });

    uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        uploadArea.style.background = '';
        uploadArea.style.borderColor = '';
        fileInput.files = e.dataTransfer.files;
        updateFileList(fileInput.files, fileListDiv);
    });

    fileInput.addEventListener('change', function() {
        updateFileList(fileInput.files, fileListDiv);
    });
}

function updateFileList(files, fileListDiv) {
    if (!fileListDiv) return;

    if (files.length === 0) {
        fileListDiv.innerHTML = '';
        return;
    }

    fileListDiv.innerHTML = '';
    for (var i = 0; i < files.length; i++) {
        var file = files[i];
        if (file.size > 50 * 1024 * 1024) {
            showToast('File ' + file.name + ' is too large. Max 50MB.', 'warning');
            continue;
        }

        var fileItem = document.createElement('div');
        fileItem.className = 'as-file-item';

        var icon = 'fa-regular fa-file';
        var ext = file.name.split('.').pop().toLowerCase();
        if (ext === 'pdf') icon = 'fa-regular fa-file-pdf';
        else if (ext === 'doc' || ext === 'docx') icon = 'fa-regular fa-file-word';
        else if (ext === 'zip' || ext === 'rar') icon = 'fa-regular fa-file-zipper';

        var fileSize = (file.size / 1024).toFixed(2);

        fileItem.innerHTML = `
            <span><i class="${icon}"></i> ${file.name} (${fileSize} KB)</span>
            <span class="as-file-remove" onclick="this.parentElement.remove()">&times;</span>
        `;
        fileListDiv.appendChild(fileItem);
    }
}

function showToast(message, type, duration) {
    if (type === undefined) type = 'success';
    if (duration === undefined) duration = 4000;

    var container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.className = 'as-toast-wrap';
        container.id = 'toastContainer';
        document.body.appendChild(container);
    }

    var toast = document.createElement('div');
    toast.className = 'as-toast as-' + type;

    var icons = {
        success: 'fa-check-circle',
        danger: 'fa-exclamation-circle',
        warning: 'fa-triangle-exclamation',
        info: 'fa-info-circle'
    };

    toast.innerHTML = `
        <i class="fa-solid ${icons[type] || icons.success}"></i>
        <span>${message}</span>
        <button class="as-toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;

    container.appendChild(toast);
    setTimeout(function() { toast.remove(); }, duration);
}

function setupSidebar() {
    var sidebar = document.getElementById('asSidebar');
    var sidebarToggle = document.getElementById('asSidebarToggle');
    var menuBtn = document.getElementById('menuBtn');
    var toggleIcon = sidebarToggle ? sidebarToggle.querySelector('i') : null;

    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('as-collapsed');
            if (toggleIcon) {
                toggleIcon.style.transform = sidebar.classList.contains('as-collapsed') ?
                    'rotate(180deg)' :
                    'rotate(0deg)';
            }
        });
    }

    if (menuBtn && sidebar) {
        menuBtn.addEventListener('click', function() {
            sidebar.classList.toggle('as-show');
        });
    }

    document.addEventListener('click', function(e) {
        if (window.innerWidth <= 1024 && sidebar && menuBtn) {
            if (!sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
                sidebar.classList.remove('as-show');
            }
        }
    });
}

function setupTheme() {
    var themeToggle = document.getElementById('themeToggle');
    var body = document.body;

    if (localStorage.getItem('futoTheme') === 'dark') {
        body.classList.add('dark');
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            body.classList.toggle('dark');
            localStorage.setItem('futoTheme', body.classList.contains('dark') ? 'dark' : 'light');
        });
    }
}

function exportGrades() {
    showToast('Exporting grades...', 'info');
}

function viewAllDeadlines() {
    currentFilter = 'pending';
    document.querySelectorAll('.as-tab').forEach(function(btn) {
        btn.classList.remove('as-tab-active');
        if (btn.textContent === 'Pending') btn.classList.add('as-tab-active');
    });
    renderAssignments();
}

function logout() {
    stopPolling();
    localStorage.clear();
    window.location.href = 'login.html';
}

document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        console.log('Page became visible, refreshing data...');
        fetchData(true);
    }
});

document.addEventListener('DOMContentLoaded', async function() {
    console.log('Assignments page loaded');

    allAssignments = [];
    mySubmissions = [];
    enrolledCourses = [];

    await fetchActiveSettings();

    updateProfileDisplay();
    setupSidebar();
    setupTheme();
    setupFileUpload();
    await fetchData();
    startPolling();

    var logoutBtn = document.querySelector('.as-logout');
    if (logoutBtn) logoutBtn.addEventListener('click', function(e) { e.preventDefault(); logout(); });

    if (filterBtns.length) {
        filterBtns.forEach(function(btn) {
            btn.addEventListener('click', function() {
                filterBtns.forEach(function(b) { b.classList.remove('as-tab-active'); });
                btn.classList.add('as-tab-active');
                currentFilter = btn.getAttribute('data-filter') ||
                    btn.textContent.toLowerCase().replace(' ', '');
                renderAssignments();
            });
        });
    }

    if (courseFilter) {
        courseFilter.addEventListener('change', function(e) {
            currentCourseFilter = e.target.value;
            renderAssignments();
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', function() {
            renderAssignments();
        });
    }

    setInterval(function() {
        if (allAssignments.length > 0 && document.hasFocus()) {
            renderDeadlines();
        }
    }, 60000);
});

window.viewAssignmentDetails = viewAssignmentDetails;
window.closeAssignmentModal = closeAssignmentModal;
window.submitFromModal = submitFromModal;
window.openSubmitModal = openSubmitModal;
window.closeSubmissionModal = closeSubmissionModal;
window.uploadAssignment = uploadAssignment;
window.viewGrade = viewGrade;
window.closeGradeModal = closeGradeModal;
window.exportGrades = exportGrades;
window.viewAllDeadlines = viewAllDeadlines;
window.refreshPage = refreshPage;
window.logout = logout;
window.showToast = showToast;
window.checkForUpdates = checkForUpdates;