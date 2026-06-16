// assignment.js - COMPLETE UPDATED VERSION WITH FIXED STATS


// ========== TOKEN FUNCTION ==========
function getAuthToken() {
    const userRole = localStorage.getItem('userRole');
    if (!userRole) return null;
    return localStorage.getItem(`${userRole}_token`) || localStorage.getItem('token');
}

// ========== GET TOKEN AT PAGE LOAD ==========
const token = getAuthToken();
const userRole = localStorage.getItem('userRole');

console.log('=== ASSIGNMENT PAGE DEBUG ===');
console.log('Token exists:', !!token);
console.log('User role:', userRole);

// ========== AUTH CHECK ==========
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

// ========== GET USER INFO ==========
const userName = localStorage.getItem('fullName') || localStorage.getItem('userName') || 'Student';
const userMatric = localStorage.getItem('matricNumber') || localStorage.getItem('userMatric') || '';
const userLevel = localStorage.getItem('level') || localStorage.getItem('userLevel') || '500';

// ========== GLOBAL VARIABLES ==========
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

// ========== DOM ELEMENTS ==========
const assignmentContainer = document.getElementById('assignmentList');
const statTotal = document.getElementById('totalAssignments');
const statPending = document.getElementById('pendingAssignments');
const statSubmitted = document.getElementById('submittedAssignments');
const deadlineContainer = document.getElementById('deadlineList');
const deadlineBadge = document.getElementById('deadlineBadge');
const filterBtns = document.querySelectorAll('.filter-btn');
const courseFilter = document.getElementById('courseFilter');
const sidebarBadge = document.getElementById('pendingBadge');
const notifCount = document.getElementById('notifCount');
const assignmentModal = document.getElementById('assignmentModal');
const submissionModal = document.getElementById('submissionModal');
const gradeModal = document.getElementById('gradeModal');

// ========== UPDATE SIDEBAR SESSION INFO ==========
function updateSidebarSessionInfo() {
    const semesterInfoDiv = document.querySelector('.semester-info p');
    if (semesterInfoDiv && currentSession && currentSemester) {
        semesterInfoDiv.innerHTML = `${currentSession} ${currentSemester}`;
    }
}

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
            localStorage.setItem('currentSession', currentSession);
            localStorage.setItem('currentSemester', currentSemester);
            console.log('âœ… Active settings loaded:', currentSession, currentSemester);
            
            // Update banner text if exists
            const bannerText = document.getElementById('bannerText');
            if (bannerText) {
                bannerText.innerHTML = `You are in <strong>${userLevel} Level</strong> Â· ${currentSession} ${currentSemester}`;
            }
            
            // Update sidebar session info
            updateSidebarSessionInfo();
        }
    } catch (error) {
        console.error('Error fetching active settings:', error);
        // Fallback to localStorage
        currentSession = localStorage.getItem('currentSession') || '2025-2026';
        currentSemester = localStorage.getItem('currentSemester') || 'Harmattan';
        updateSidebarSessionInfo();
    }
}

// ========== UPDATE PROFILE DISPLAY ==========
function updateProfileDisplay() {
    const profileName = document.getElementById('profileName');
    const profileMatric = document.getElementById('profileMatric');
    const profileLevel = document.getElementById('profileLevel');
    
    if (profileName) profileName.textContent = userName;
    if (profileMatric) profileMatric.textContent = userMatric;
    if (profileLevel) profileLevel.textContent = `${userLevel} Level`;
}

// ========== MANUAL REFRESH FUNCTION WITH CACHE CLEAR ==========
async function refreshPage() {
    showToast('Checking for deadline updates...', 'info');
    
    // Clear local cache
    allAssignments = [];
    mySubmissions = [];
    
    // Force fresh fetch with cache busting
    await fetchData(true);
    showToast('âœ… Assignments refreshed!', 'success');
}

// ========== FETCH DATA WITH CACHE BUSTING ==========
async function fetchData(forceRefresh = false) {
    if (!assignmentContainer) return;
    assignmentContainer.innerHTML = '<div class="loading-spinner">Loading assignments...</div>';
    
    const timestamp = Date.now();
    lastUpdateTimestamp = timestamp;
    
    try {
        // Fetch enrolled courses
        const coursesRes = await fetch(
            `${API_URL}/api/student/my-courses?session=${currentSession}&semester=${currentSemester}&_=${timestamp}`,
            { 
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Cache-Control': 'no-cache, no-store, must-revalidate'
                } 
            }
        );
        const coursesData = await coursesRes.json();

        if (coursesData.success) {
            enrolledCourses = coursesData.courses || [];
            updateCourseFilter();
        }

        // Fetch ALL assignments
        const assignmentsRes = await fetch(`${API_URL}/api/assignments/all?_=${timestamp}`, {
            headers: { 
                Authorization: `Bearer ${token}`,
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
        });
        const assignmentsData = await assignmentsRes.json();

        if (assignmentsData.success) {
            const allFetchedAssignments = assignmentsData.assignments || [];
            
            allAssignments = allFetchedAssignments.filter(assignment => {
                const assignmentSession = assignment.session || '2025-2026';
                const assignmentSemester = assignment.semester || 'Harmattan';
                return assignmentSession === currentSession && assignmentSemester === currentSemester;
            });
            
            if (statTotal) statTotal.textContent = allAssignments.length;
            console.log(`ðŸ“Š Total assignments for ${currentSession} ${currentSemester}: ${allAssignments.length}`);
        }

        // Fetch submissions - Backend now filters by session/semester
        const submissionsRes = await fetch(`${API_URL}/api/submissions/my-submissions?_=${timestamp}`, {
            headers: { 
                Authorization: `Bearer ${token}`,
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
        });
        const submissionsData = await submissionsRes.json();

        if (submissionsData.success) {
            mySubmissions = submissionsData.submissions || [];
            
            if (statSubmitted) statSubmitted.textContent = mySubmissions.length;
            console.log(`ðŸ“Š Submitted assignments for ${currentSession} ${currentSemester}: ${mySubmissions.length}`);

            const pendingCount = allAssignments.length - mySubmissions.length;
            const finalPending = pendingCount > 0 ? pendingCount : 0;

            if (statPending) statPending.textContent = finalPending;
            if (sidebarBadge) sidebarBadge.textContent = finalPending > 0 ? finalPending : '';
            if (notifCount) notifCount.textContent = finalPending > 0 ? (finalPending > 9 ? '9+' : finalPending) : '0';
            
            console.log(`ðŸ“Š Pending assignments: ${finalPending}`);
        }

        renderAssignments();
        renderDeadlines();

        if (forceRefresh) {
            showToast('Assignments updated successfully!', 'success');
        }

    } catch (error) {
        console.error('Error fetching data:', error);
        if (assignmentContainer) {
            assignmentContainer.innerHTML = '<div class="empty-state">Failed to load assignments. <button onclick="refreshPage()" class="btn-primary" style="margin-top: 10px;">Retry</button></div>';
        }
    }
}

// ========== CHECK FOR ASSIGNMENT UPDATES (POLLING) ==========
async function checkForUpdates() {
    if (!document.hasFocus()) return;
    
    const timestamp = Date.now();
    
    try {
        const response = await fetch(`${API_URL}/api/assignments/all?_=${timestamp}`, {
            headers: { 
                Authorization: `Bearer ${token}`,
                'Cache-Control': 'no-cache'
            }
        });
        
        const data = await response.json();
        
        if (data.success && data.assignments) {
            const currentAssignments = data.assignments.filter(assignment => {
                const assignmentSession = assignment.session || '2025-2026';
                const assignmentSemester = assignment.semester || 'Harmattan';
                return assignmentSession === currentSession && assignmentSemester === currentSemester;
            });
            
            let hasChanges = false;
            
            if (currentAssignments.length !== allAssignments.length) {
                hasChanges = true;
            } else {
                for (let i = 0; i < currentAssignments.length; i++) {
                    const newAssignment = currentAssignments[i];
                    const oldAssignment = allAssignments.find(a => a._id === newAssignment._id);
                    
                    if (!oldAssignment) {
                        hasChanges = true;
                        break;
                    }
                    
                    if (oldAssignment.dueDateISO !== newAssignment.dueDateISO ||
                        oldAssignment.dueTime !== newAssignment.dueTime ||
                        oldAssignment.title !== newAssignment.title) {
                        hasChanges = true;
                        console.log(`Assignment changed: ${newAssignment.title}`);
                        break;
                    }
                }
            }
            
            if (hasChanges) {
                console.log('Detected assignment changes, refreshing...');
                showToast('ðŸ“… Assignment deadlines have been updated!', 'info');
                await fetchData();
            }
        }
    } catch (error) {
        console.log('Polling check failed:', error.message);
    }
}

// ========== START/STOP POLLING ==========
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
    enrolledCourses.forEach(course => {
        const option = document.createElement('option');
        option.value = course.courseCode;
        option.textContent = `${course.courseCode} - ${course.courseTitle}`;
        courseFilter.appendChild(option);
    });
}

// ========== VIEW ASSIGNMENT DETAILS WITH FRESH DATA ==========
async function viewAssignmentDetails(assignmentId) {
    try {
        showToast('Loading assignment details...', 'info');
        
        const response = await fetch(`${API_URL}/api/assignments/${assignmentId}?_=${Date.now()}`, {
            headers: { 
                Authorization: `Bearer ${token}`,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
            }
        });
        
        const data = await response.json();
        
        if (data.success && data.assignment) {
            const index = allAssignments.findIndex(a => a._id === assignmentId);
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
            const assignment = allAssignments.find(a => a._id === assignmentId);
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
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    if (!modalTitle || !modalBody) return;
    
    modalTitle.innerHTML = `<i class="fa-regular fa-file-lines"></i> ${assignment.course} - ${assignment.title}`;
    
    const isSubmitted = mySubmissions.some(s => s.assignmentId?._id === assignment._id);
    const submission = mySubmissions.find(s => s.assignmentId?._id === assignment._id);
    const isGraded = submission?.status === 'graded';
    
    const dueDate = new Date(assignment.dueDateISO);
    const today = new Date();
    const diffTime = dueDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const isOverdue = diffTime < 0;
    
    const allowLate = assignment.allowLate !== false;
    const canSubmit = !isOverdue || (isOverdue && allowLate);
    
    let dueStatusHtml = '';
    if (isOverdue) {
        if (allowLate) {
            dueStatusHtml = '<span class="status-badge warning"><i class="fa-solid fa-clock"></i> Late Submission Allowed</span>';
        } else {
            dueStatusHtml = '<span class="status-badge locked"><i class="fa-solid fa-lock"></i> Submission Closed</span>';
        }
    } else if (diffDays === 0) {
        dueStatusHtml = '<span class="status-badge urgent"><i class="fa-solid fa-clock"></i> Due Today!</span>';
    } else if (diffDays <= 3) {
        dueStatusHtml = `<span class="status-badge warning"><i class="fa-solid fa-hourglass-half"></i> ${diffDays} days left</span>`;
    } else {
        dueStatusHtml = `<span class="status-badge normal"><i class="fa-regular fa-calendar"></i> ${diffDays} days left</span>`;
    }
    
    let rubricHtml = '';
    if (assignment.rubric && assignment.rubric.length > 0) {
        rubricHtml = `
            <div class="rubric-section">
                <h4><i class="fa-solid fa-table-list"></i> Grading Rubric</h4>
                <table class="rubric-table">
                    <thead>
                        <tr><th>Criterion</th><th>Max Points</th></tr>
                    </thead>
                    <tbody>
                        ${assignment.rubric.map(r => `
                            <tr>
                                <td>${escapeHtml(r.name)}</div>
                                <td class="text-center">${r.maxScore}</div>
                            </tr>
                        `).join('')}
                        <tr class="rubric-total-row">
                            <td><strong>Total</strong></div>
                            <td class="text-center"><strong>${assignment.totalMarks || 0}</strong></div>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    }
    
    let submissionHtml = '';
    if (isSubmitted && submission) {
        if (isGraded) {
            const percentage = ((submission.totalScore / assignment.totalMarks) * 100).toFixed(1);
            let gradeLetter = 'F';
            if (percentage >= 70) gradeLetter = 'A';
            else if (percentage >= 60) gradeLetter = 'B';
            else if (percentage >= 50) gradeLetter = 'C';
            else if (percentage >= 45) gradeLetter = 'D';
            else if (percentage >= 40) gradeLetter = 'E';
            
            submissionHtml = `
                <div class="graded-info">
                    <h4><i class="fa-solid fa-chart-line"></i> Your Grade</h4>
                    <div class="grade-details">
                        <div class="grade-score">
                            <span class="score-value">${submission.totalScore}/${assignment.totalMarks}</span>
                            <span class="score-percentage">(${percentage}%)</span>
                            <span class="score-letter">Grade: ${gradeLetter}</span>
                        </div>
                        <div class="grade-feedback">
                            <strong>Feedback:</strong>
                            <p>${escapeHtml(submission.feedback || 'No additional feedback provided.')}</p>
                        </div>
                    </div>
                </div>
            `;
        } else {
            submissionHtml = `
                <div class="submitted-info">
                    <h4><i class="fa-regular fa-clock"></i> Submission Status</h4>
                    <p>You have submitted this assignment. It is currently being reviewed.</p>
                    <p class="submission-date">Submitted on: ${new Date(submission.submittedAt).toLocaleString()}</p>
                </div>
            `;
        }
    }
    
    modalBody.innerHTML = `
        <div class="assignment-details-container">
            <div class="detail-header">
                <div class="detail-meta">
                    <div class="meta-row">
                        <span><i class="fa-regular fa-calendar"></i> Due: ${assignment.dueDate} at ${assignment.dueTime || '23:59'}</span>
                        ${dueStatusHtml}
                    </div>
                    <div class="meta-row">
                        <span><i class="fa-regular fa-star"></i> Total Marks: ${assignment.totalMarks || 0}</span>
                    </div>
                    <div class="meta-row">
                        <span><i class="fa-regular fa-calendar-alt"></i> Session: ${assignment.session || currentSession} ${assignment.semester || currentSemester}</span>
                    </div>
                </div>
            </div>
            
            <div class="detail-description">
                <h4><i class="fa-regular fa-rectangle-list"></i> Description / Instructions</h4>
                <div class="description-content">
                    ${escapeHtml(assignment.description || 'No description provided.').replace(/\n/g, '<br>')}
                </div>
            </div>
            
            ${rubricHtml}
            ${submissionHtml}
        </div>
    `;
    
    const modalSubmitBtn = document.getElementById('modalSubmitBtn');
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
        
        const newBtn = modalSubmitBtn.cloneNode(true);
        modalSubmitBtn.parentNode.replaceChild(newBtn, modalSubmitBtn);
        newBtn.addEventListener('click', () => submitFromModal());
    }
    
    assignmentModal.classList.add('show');
}

function closeAssignmentModal() {
    if (assignmentModal) assignmentModal.classList.remove('show');
}

function submitFromModal() {
    closeAssignmentModal();
    if (currentAssignmentForSubmission) {
        openSubmitModal(currentAssignmentForSubmission._id);
    }
}

// ========== OPEN SUBMIT MODAL ==========
function openSubmitModal(assignmentId) {
    const assignment = allAssignments.find(a => a._id === assignmentId);
    if (!assignment) {
        showToast('Assignment not found', 'danger');
        return;
    }
    
    const dueDate = new Date(assignment.dueDateISO);
    const today = new Date();
    const isOverdue = dueDate < today;
    const allowLate = assignment.allowLate !== false;
    
    if (isOverdue && !allowLate) {
        showToast('This assignment is past the due date and late submissions are not allowed.', 'warning');
        return;
    }
    
    if (isOverdue && allowLate) {
        showToast('âš ï¸ Late submission - penalty may apply', 'warning');
    }
    
    currentAssignmentForSubmission = assignment;
    
    const submissionAssignmentInfo = document.getElementById('submissionAssignmentInfo');
    if (submissionAssignmentInfo) {
        submissionAssignmentInfo.innerHTML = `
            <div class="submission-info">
                <p><strong>Course:</strong> ${assignment.course}</p>
                <p><strong>Assignment:</strong> ${assignment.title}</p>
                <p><strong>Due Date:</strong> ${assignment.dueDate} at ${assignment.dueTime || '23:59'}</p>
                <p><strong>Total Marks:</strong> ${assignment.totalMarks || 0}</p>
                <p><strong>Session:</strong> ${assignment.session || currentSession} ${assignment.semester || currentSemester}</p>
                ${isOverdue ? '<p class="late-warning"><i class="fa-solid fa-triangle-exclamation"></i> LATE SUBMISSION</p>' : ''}
            </div>
        `;
    }
    
    const fileListDiv = document.getElementById('submissionFileList');
    const commentsTextarea = document.getElementById('submissionComments');
    const fileInput = document.getElementById('submissionFiles');
    
    if (fileListDiv) fileListDiv.innerHTML = '';
    if (commentsTextarea) commentsTextarea.value = '';
    if (fileInput) fileInput.value = '';
    
    submissionModal.classList.add('show');
}

function closeSubmissionModal() {
    if (submissionModal) submissionModal.classList.remove('show');
    currentAssignmentForSubmission = null;
}

// ========== SUBMIT ASSIGNMENT ==========
async function uploadAssignment() {
    if (!currentAssignmentForSubmission) {
        showToast('No assignment selected', 'danger');
        return;
    }
    
    const fileInput = document.getElementById('submissionFiles');
    const files = fileInput ? fileInput.files : [];
    const comments = document.getElementById('submissionComments')?.value || '';
    
    if (files.length === 0) {
        showToast('Please select at least one file to upload', 'warning');
        return;
    }
    
    const uploadBtn = document.getElementById('uploadBtn');
    const originalText = uploadBtn ? uploadBtn.innerHTML : 'Submit';
    
    if (uploadBtn) {
        uploadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';
        uploadBtn.disabled = true;
    }
    
    const formData = new FormData();
    formData.append('assignmentId', currentAssignmentForSubmission._id);
    formData.append('comments', comments);
    
    for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
    }
    
    try {
        const response = await fetch(`${API_URL}/api/submissions`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showToast('âœ… Assignment submitted successfully!', 'success');
            closeSubmissionModal();
            await fetchData(true);
        } else {
            showToast(data.message || 'Failed to submit assignment', 'danger');
        }
    } catch (error) {
        console.error('Upload error:', error);
        showToast('Failed to submit assignment. Please try again.', 'danger');
    } finally {
        if (uploadBtn) {
            uploadBtn.innerHTML = originalText;
            uploadBtn.disabled = false;
        }
    }
}

// ========== VIEW GRADE ==========
async function viewGrade(assignmentId) {
    try {
        const submission = mySubmissions.find(s => s.assignmentId?._id === assignmentId);
        const assignment = allAssignments.find(a => a._id === assignmentId);
        
        if (!submission || !assignment) {
            showToast('Grade information not found', 'danger');
            return;
        }
        
        const percentage = ((submission.totalScore / assignment.totalMarks) * 100).toFixed(1);
        let gradeLetter = 'F';
        let gradeClass = 'grade-f';
        
        if (percentage >= 70) { gradeLetter = 'A'; gradeClass = 'grade-a'; }
        else if (percentage >= 60) { gradeLetter = 'B'; gradeClass = 'grade-b'; }
        else if (percentage >= 50) { gradeLetter = 'C'; gradeClass = 'grade-c'; }
        else if (percentage >= 45) { gradeLetter = 'D'; gradeClass = 'grade-d'; }
        else if (percentage >= 40) { gradeLetter = 'E'; gradeClass = 'grade-e'; }
        
        const gradeModalBody = document.getElementById('gradeModalBody');
        if (gradeModalBody) {
            gradeModalBody.innerHTML = `
                <div class="grade-details-modal">
                    <div class="grade-summary ${gradeClass}">
                        <div class="grade-score-large">
                            <span class="score">${submission.totalScore}</span>
                            <span class="out-of">/${assignment.totalMarks}</span>
                        </div>
                        <div class="grade-percentage-large">${percentage}%</div>
                        <div class="grade-letter-large">${gradeLetter}</div>
                    </div>
                    
                    <div class="grade-breakdown">
                        <h4>Score Breakdown</h4>
                        ${submission.scores && Object.keys(submission.scores).length > 0 ? `
                            <table class="breakdown-table">
                                <thead>
                                    <tr><th>Criterion</th><th>Score</th><th>Max</th></tr>
                                </thead>
                                <tbody>
                                    ${Object.entries(submission.scores).map(([criterion, score]) => `
                                        <tr>
                                            <td>${escapeHtml(criterion)}</div>
                                            <td>${score}</div>
                                            <td>-</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        ` : '<p>No breakdown available</p>'}
                    </div>
                    
                    <div class="grade-feedback-modal">
                        <h4>Lecturer\'s Feedback</h4>
                        <p>${escapeHtml(submission.feedback || 'No feedback provided.')}</p>
                    </div>
                </div>
            `;
        }
        
        gradeModal.classList.add('show');
        
    } catch (error) {
        console.error('Error viewing grade:', error);
        showToast('Failed to load grade details', 'danger');
    }
}

function closeGradeModal() {
    if (gradeModal) gradeModal.classList.remove('show');
}

// ========== RENDER ASSIGNMENTS ==========
function renderAssignments() {
    if (!assignmentContainer) return;
    
    let filtered = [...allAssignments];
    const submittedIds = new Set(mySubmissions.map(s => s.assignmentId?._id));
    
    if (currentCourseFilter !== 'all') {
        filtered = filtered.filter(a => a.course === currentCourseFilter);
    }
    
    if (currentFilter === 'pending') {
        filtered = filtered.filter(a => !submittedIds.has(a._id));
    } else if (currentFilter === 'submitted') {
        filtered = filtered.filter(a => submittedIds.has(a._id));
    } else if (currentFilter === 'graded') {
        filtered = filtered.filter(a => {
            const sub = mySubmissions.find(s => s.assignmentId?._id === a._id);
            return sub && sub.status === 'graded';
        });
    } else if (currentFilter === 'thisweek') {
        const today = new Date();
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);
        filtered = filtered.filter(a => {
            const due = new Date(a.dueDateISO);
            return due >= today && due <= nextWeek;
        });
    }
    
    const searchInput = document.getElementById('searchInput');
    const searchQuery = searchInput?.value.toLowerCase() || '';
    if (searchQuery) {
        filtered = filtered.filter(a => 
            a.title.toLowerCase().includes(searchQuery) || 
            a.course.toLowerCase().includes(searchQuery)
        );
    }
    
    if (filtered.length === 0) {
        assignmentContainer.innerHTML = `<div class="empty-state">No assignments found for ${currentSession} ${currentSemester}</div>`;
        return;
    }
    
    assignmentContainer.innerHTML = filtered.map(assignment => {
        const isSubmitted = submittedIds.has(assignment._id);
        const submission = mySubmissions.find(s => s.assignmentId?._id === assignment._id);
        const isGraded = submission?.status === 'graded';
        
        const dueDate = new Date(assignment.dueDateISO);
        const today = new Date();
        const diffTime = dueDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
        const isOverdue = dueDate < today;
        const allowLate = assignment.allowLate !== false;
        const isLocked = isOverdue && !allowLate;
        
        let dueClass = '';
        let dueText = '';
        
        if (isLocked) {
            dueClass = 'locked';
            dueText = 'Submission Closed';
        } else if (isOverdue && allowLate) {
            dueClass = 'warning';
            dueText = `Late (${Math.abs(diffHours)}h overdue)`;
        } else if (diffDays === 0) {
            dueClass = 'urgent';
            dueText = diffHours <= 1 ? `Due in ${diffHours} hour` : `Due in ${diffHours} hours`;
        } else if (diffDays === 1) {
            dueClass = 'warning';
            dueText = 'Due tomorrow';
        } else if (diffDays <= 3) {
            dueClass = 'warning';
            dueText = `Due in ${diffDays} days`;
        } else {
            dueClass = 'normal';
            dueText = `Due in ${diffDays} days`;
        }
        
        let gradeInfo = '';
        if (isGraded && submission) {
            const percentage = ((submission.totalScore / assignment.totalMarks) * 100).toFixed(0);
            gradeInfo = `<div class="assignment-grade-preview"><span class="grade-label">Grade:</span><span class="grade-value">${submission.totalScore}/${assignment.totalMarks}</span><span class="grade-percentage">${percentage}%</span></div>`;
        }
        
        return `
            <div class="assignment-card ${isLocked ? 'locked' : ''}">
                <div class="assignment-status ${dueClass}"></div>
                <div class="assignment-content">
                    <div class="assignment-header">
                        <span class="course-code">${assignment.course}</span>
                        ${!isSubmitted ? 
                            `<span class="due-badge ${dueClass}">${dueText}</span>` : 
                            `<span class="status-badge">${isGraded ? 'Graded âœ“' : 'Submitted'}</span>`}
                    </div>
                    <h3 class="assignment-title">${escapeHtml(assignment.title)}</h3>
                    <div class="assignment-meta">
                        <span><i class="fa-regular fa-star"></i> ${assignment.totalMarks || 0} Marks</span>
                        <span><i class="fa-regular fa-calendar"></i> Due: ${assignment.dueDate} at ${assignment.dueTime || '23:59'}</span>
                    </div>
                    ${gradeInfo}
                    <div class="assignment-actions">
                        <button class="btn-primary" onclick="viewAssignmentDetails('${assignment._id}')">
                            <i class="fa-regular fa-eye"></i> View Details
                        </button>
                        ${!isSubmitted && !isLocked ? `
                            <button class="btn-outline" onclick="openSubmitModal('${assignment._id}')">
                                <i class="fa-solid fa-upload"></i> Submit
                            </button>
                        ` : isLocked && !isSubmitted ? `
                            <button class="btn-outline" disabled style="opacity:0.5; cursor: not-allowed;">
                                <i class="fa-solid fa-lock"></i> Closed
                            </button>
                        ` : isSubmitted && !isGraded ? `
                            <button class="btn-outline" disabled style="opacity:0.5">
                                <i class="fa-regular fa-clock"></i> Pending Review
                            </button>
                        ` : isGraded ? `
                            <button class="btn-outline" onclick="viewGrade('${assignment._id}')">
                                <i class="fa-solid fa-chart-line"></i> View Grade
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ========== RENDER DEADLINES ==========
function renderDeadlines() {
    if (!deadlineContainer) return;
    
    const today = new Date();
    const submittedIds = new Set(mySubmissions.map(s => s.assignmentId?._id));
    
    const upcoming = allAssignments
        .filter(a => {
            const isSubmitted = submittedIds.has(a._id);
            if (isSubmitted) return false;
            const isOverdue = new Date(a.dueDateISO) < today;
            const allowLate = a.allowLate !== false;
            return !isOverdue || (isOverdue && allowLate);
        })
        .sort((a, b) => new Date(a.dueDateISO) - new Date(b.dueDateISO))
        .slice(0, 4);
    
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    const dueThisWeek = allAssignments.filter(a => {
        const due = new Date(a.dueDateISO);
        return !submittedIds.has(a._id) && due >= today && due <= nextWeek;
    }).length;
    
    if (deadlineBadge) deadlineBadge.textContent = `${dueThisWeek} This Week`;
    
    if (upcoming.length === 0) {
        deadlineContainer.innerHTML = '<div class="empty-state">No upcoming deadlines</div>';
        return;
    }
    
    deadlineContainer.innerHTML = upcoming.map(assignment => {
        const due = new Date(assignment.dueDateISO);
        const diffMs = due - today;
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
        const isOverdue = due < today;
        const allowLate = assignment.allowLate !== false;
        
        let itemClass = '';
        let badgeText = '';
        
        if (isOverdue && allowLate) {
            itemClass = 'warning';
            badgeText = `LATE (${Math.abs(diffHours)}h)`;
        } else if (diffDays === 0) {
            if (diffHours <= 1) {
                itemClass = 'urgent';
                badgeText = '1 hour left';
            } else {
                itemClass = 'urgent';
                badgeText = `${diffHours} hours left`;
            }
        } else if (diffDays === 1) {
            itemClass = 'warning';
            badgeText = 'Tomorrow';
        } else if (diffDays <= 3) {
            itemClass = 'warning';
            badgeText = `${diffDays} days left`;
        } else {
            badgeText = `${diffDays} days left`;
        }
        
        return `
            <div class="deadline-item ${itemClass}" onclick="viewAssignmentDetails('${assignment._id}')" style="cursor: pointer;">
                <div class="deadline-time">
                    <span class="date">${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    <span class="time">${assignment.dueTime || '23:59'}</span>
                </div>
                <div class="deadline-info">
                    <span class="course">${assignment.course}</span>
                    <span class="assignment">${escapeHtml(assignment.title)}</span>
                </div>
                <span class="deadline-badge ${itemClass}">${badgeText}</span>
            </div>
        `;
    }).join('');
}

// ========== FILE UPLOAD HANDLERS ==========
function setupFileUpload() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('submissionFiles');
    const fileListDiv = document.getElementById('submissionFileList');
    
    if (!uploadArea || !fileInput) return;
    
    uploadArea.addEventListener('click', () => fileInput.click());
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.background = 'rgba(42, 122, 75, 0.1)';
        uploadArea.style.borderColor = '#2a7a4b';
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.style.background = '';
        uploadArea.style.borderColor = '';
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.background = '';
        uploadArea.style.borderColor = '';
        const files = e.dataTransfer.files;
        fileInput.files = files;
        updateFileList(files, fileListDiv);
    });
    
    fileInput.addEventListener('change', () => {
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
    Array.from(files).forEach(file => {
        if (file.size > 50 * 1024 * 1024) {
            showToast(`File ${file.name} is too large. Max 50MB.`, 'warning');
            return;
        }
        
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        
        let icon = 'fa-regular fa-file';
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext === 'pdf') icon = 'fa-regular fa-file-pdf';
        else if (['doc', 'docx'].includes(ext)) icon = 'fa-regular fa-file-word';
        else if (['zip', 'rar'].includes(ext)) icon = 'fa-regular fa-file-zipper';
        
        const fileSize = (file.size / 1024).toFixed(2);
        
        fileItem.innerHTML = `
            <span><i class="${icon}"></i> ${file.name} (${fileSize} KB)</span>
            <span class="file-remove" onclick="this.parentElement.remove()">âœ•</span>
        `;
        fileListDiv.appendChild(fileItem);
    });
}

// ========== TOAST NOTIFICATION ==========
function showToast(message, type = 'success', duration = 4000) {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        container.id = 'toastContainer';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    const colors = {
        success: '#2a7a4b',
        danger: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
    };
    
    toast.style.cssText = `
        background: white;
        border-radius: 8px;
        padding: 12px 20px;
        margin-bottom: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 10px;
        border-left: 4px solid ${colors[type] || colors.success};
        animation: slideInRight 0.3s ease;
        font-family: 'Inter', sans-serif;
        z-index: 10000;
        position: relative;
    `;
    
    const icons = {
        success: 'fa-check-circle',
        danger: 'fa-exclamation-circle',
        warning: 'fa-triangle-exclamation',
        info: 'fa-info-circle'
    };
    
    toast.innerHTML = `
        <i class="fa-solid ${icons[type] || icons.success}" style="color: ${colors[type] || colors.success}"></i>
        <span style="flex: 1;">${message}</span>
        <button onclick="this.parentElement.remove()" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; color: #94a3b8;">&times;</button>
    `;
    
    container.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
}

// ========== SIDEBAR & THEME FUNCTIONS ==========
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

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function exportGrades() {
    showToast('Exporting grades...', 'info');
}

function viewAllDeadlines() {
    currentFilter = 'pending';
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent === 'Pending') btn.classList.add('active');
    });
    renderAssignments();
}

function logout() {
    stopPolling();
    localStorage.clear();
    window.location.href = 'login.html';
}

// ========== AUTO-REFRESH WHEN PAGE BECOMES VISIBLE ==========
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        console.log('Page became visible, refreshing data...');
        fetchData(true);
    }
});

// ========== INITIALIZE PAGE ==========
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Assignments page loaded - UPDATED VERSION WITH ACTIVE SETTINGS');
    
    // Clear old data on page load
    allAssignments = [];
    mySubmissions = [];
    enrolledCourses = [];
    
    // First fetch active settings
    await fetchActiveSettings();
    
    updateProfileDisplay();
    setupSidebar();
    setupTheme();
    setupFileUpload();
    await fetchData();
    startPolling();
    
    // Setup logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    
    // Setup filters
    if (filterBtns.length) {
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFilter = btn.getAttribute('data-filter') || 
                    btn.textContent.toLowerCase().replace(' ', '');
                renderAssignments();
            });
        });
    }
    
    if (courseFilter) {
        courseFilter.addEventListener('change', (e) => {
            currentCourseFilter = e.target.value;
            renderAssignments();
        });
    }
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderAssignments();
        });
    }
    
    // Add manual refresh button if not exists
    const headerActions = document.querySelector('.header-actions');
    if (headerActions && !document.getElementById('refreshBtn')) {
        const refreshBtn = document.createElement('button');
        refreshBtn.id = 'refreshBtn';
        refreshBtn.className = 'btn-outline';
        refreshBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Refresh';
        refreshBtn.onclick = () => refreshPage();
        headerActions.appendChild(refreshBtn);
    }
    
    // Also add a "Check for Updates" button
    if (headerActions && !document.getElementById('checkUpdatesBtn')) {
        const checkBtn = document.createElement('button');
        checkBtn.id = 'checkUpdatesBtn';
        checkBtn.className = 'btn-primary';
        checkBtn.innerHTML = '<i class="fa-solid fa-bell"></i> Check Updates';
        checkBtn.onclick = () => checkForUpdates();
        headerActions.appendChild(checkBtn);
    }
    
    // Add session info display
    const sessionInfo = document.createElement('div');
    sessionInfo.className = 'session-info';
    sessionInfo.style.marginLeft = '15px';
    sessionInfo.style.fontSize = '0.85rem';
    sessionInfo.style.color = 'var(--text-light)';
    sessionInfo.innerHTML = `<i class="fa-regular fa-calendar-alt"></i> ${currentSession} ${currentSemester}`;
    const headerLeft = document.querySelector('.header-left');
    if (headerLeft && !document.getElementById('sessionInfoDisplay')) {
        sessionInfo.id = 'sessionInfoDisplay';
        headerLeft.appendChild(sessionInfo);
    }
    
    // Refresh deadlines every minute
    setInterval(() => {
        if (allAssignments.length > 0 && document.hasFocus()) {
            renderDeadlines();
        }
    }, 60000);
});

// Make functions global for inline event handlers
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
