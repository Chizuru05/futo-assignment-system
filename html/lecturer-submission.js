// lecturer-submission.js - submissions grouped by level > course > assignment

// ========== ROLE-SPECIFIC TOKEN ==========
function getAuthToken() {
    const userRole = localStorage.getItem('userRole');
    if (!userRole) return null;
    return localStorage.getItem(`${userRole}_token`) || localStorage.getItem('token');
}

// ========== CHECK AUTHENTICATION ==========
const token = getAuthToken();
const userRole = localStorage.getItem('userRole');

if (!token || userRole !== 'lecturer') {
    window.location.href = 'login.html';
}

// ========== STATE ==========
let submissionsData = [];
let assignmentsData = [];
let notificationsData = [];
let currentAIProcessing = false;
let currentAISubmissionId = null;
const editingIds = new Set();      // submissions unlocked via "Edit Grade"
const collapsedGroups = new Set(); // remembers which level/course groups the lecturer closed
let activeSubmissionId = null;
let currentSession = localStorage.getItem('currentSession') || '2025-2026';
let currentSemester = localStorage.getItem('currentSemester') || 'Harmattan';

// ========== DOM ==========
const totalSubmissionsEl = document.getElementById('totalSubmissions');
const pendingSubmissionsEl = document.getElementById('pendingSubmissions');
const gradedSubmissionsEl = document.getElementById('gradedSubmissions');
const completionRateEl = document.getElementById('completionRate');
const submissionsContainer = document.getElementById('submissionsContainer');
const levelFilter = document.getElementById('levelFilter');
const courseFilter = document.getElementById('courseFilter');
const assignmentFilter = document.getElementById('assignmentFilter');
const gradeStatusFilter = document.getElementById('gradeStatusFilter');
const filterCount = document.getElementById('filterCount');

// ========== HELPERS ==========
function authHeaders(json = false) {
    const h = { 'Authorization': `Bearer ${token}` };
    if (json) h['Content-Type'] = 'application/json';
    return h;
}

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getLetterGrade(percentage) {
    if (percentage >= 70) return 'A';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C';
    if (percentage >= 45) return 'D';
    if (percentage >= 40) return 'E';
    return 'F';
}

function timeAgo(dateStr) {
    const then = new Date(dateStr).getTime();
    if (isNaN(then)) return '';
    const secs = Math.floor((Date.now() - then) / 1000);
    if (secs < 60) return 'Just now';
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
    return new Date(dateStr).toLocaleDateString();
}

function updateSemesterDisplay() {
    const semesterDisplay = document.querySelector('.current-semester');
    if (semesterDisplay) {
        semesterDisplay.innerHTML = `<i class="fa-regular fa-calendar"></i> ${currentSession} ${currentSemester}`;
    }
}

// Level comes from assignment.level, which the backend attaches from the Course record.
// Example values: "400" or "400L". Anything else shows as Unassigned.
function getLevel(assignment) {
    const match = String(assignment.level ?? '').match(/\d{3}/);
    return match ? `${match[0]}L` : 'Unassigned';
}

function levelRank(level) {
    if (level === 'Unassigned') return 9999;
    return parseInt(level, 10) || 9998;
}

function getAssignmentFor(submission) {
    return assignmentsData.find(a => a._id === submission.assignmentId?._id);
}

// Every submission that has a matching assignment, with its level attached
function getAllRows() {
    return submissionsData
        .map(submission => {
            const assignment = getAssignmentFor(submission);
            return assignment ? { submission, assignment, level: getLevel(assignment) } : null;
        })
        .filter(Boolean);
}

// Rows that pass the current filters
function getFilteredRows() {
    const level = levelFilter?.value || 'all';
    const course = courseFilter?.value || 'all';
    const assignmentId = assignmentFilter?.value || 'all';
    const status = gradeStatusFilter?.value || 'all';

    return getAllRows().filter(r =>
        (level === 'all' || r.level === level) &&
        (course === 'all' || r.assignment.course === course) &&
        (assignmentId === 'all' || r.assignment._id === assignmentId) &&
        (status === 'all' || r.submission.status === status)
    );
}

function countsOf(rows) {
    const total = rows.length;
    const graded = rows.filter(r => r.submission.status === 'graded').length;
    return { total, graded, pending: total - graded };
}

function countPills(counts) {
    return `
        <span class="pill">${counts.total} submission${counts.total === 1 ? '' : 's'}</span>
        <span class="pill pending">${counts.pending} to grade</span>
        <span class="pill graded">${counts.graded} graded</span>
    `;
}

// Re-fills a select while keeping the current choice if it still exists
function fillSelect(select, options, allLabel) {
    if (!select) return;
    const previous = select.value;
    select.innerHTML = `<option value="all">${escapeHtml(allLabel)}</option>` +
        options.map(o => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join('');
    const stillValid = previous === 'all' || options.some(o => o.value === previous);
    select.value = stillValid ? previous : 'all';
}

// Level -> course -> assignment cascade for the three filter selects
function refreshFilterOptions() {
    const levels = [...new Set(assignmentsData.map(getLevel))]
        .sort((a, b) => levelRank(a) - levelRank(b));
    fillSelect(levelFilter, levels.map(l => ({ value: l, label: l })), 'All levels');

    const level = levelFilter.value;
    const inLevel = assignmentsData.filter(a => level === 'all' || getLevel(a) === level);

    const courses = [...new Set(inLevel.map(a => a.course).filter(Boolean))].sort();
    fillSelect(courseFilter, courses.map(c => ({ value: c, label: c })), 'All courses');

    const course = courseFilter.value;
    const inCourse = inLevel.filter(a => course === 'all' || a.course === course);
    fillSelect(
        assignmentFilter,
        inCourse.map(a => ({ value: a._id, label: `${a.title} (${a.totalMarks} marks)` })),
        'All assignments'
    );
}

// ========== LOAD ASSIGNMENTS ==========
async function loadAssignments() {
    try {
        const response = await fetch(`${API_URL}/api/assignments/lecturer`, { headers: authHeaders() });
        const data = await response.json();
        if (data.success) {
            assignmentsData = data.assignments || [];
            refreshFilterOptions();
        }
    } catch (error) {
        console.error('Error loading assignments:', error);
        showToast('Failed to load assignments', 'danger');
    }
}

// ========== LOAD SUBMISSIONS ==========
async function loadSubmissions() {
    try {
        currentSession = localStorage.getItem('currentSession') || '2025-2026';
        currentSemester = localStorage.getItem('currentSemester') || 'Harmattan';
        updateSemesterDisplay();

        const response = await fetch(
            `${API_URL}/api/submissions/lecturer/all?session=${encodeURIComponent(currentSession)}&semester=${encodeURIComponent(currentSemester)}`,
            { headers: authHeaders() }
        );
        const data = await response.json();

        submissionsData = data.success ? (data.submissions || []) : [];
        updateStats();
        renderSubmissions();
        if (!data.success) showToast(data.message || 'No submissions found', 'info');
    } catch (error) {
        console.error('Error loading submissions:', error);
        showToast('Failed to load submissions', 'danger');
        renderSubmissions();
    }
}

function updateStats() {
    const total = submissionsData.length;
    const graded = submissionsData.filter(s => s.status === 'graded').length;
    const pending = total - graded;
    const rate = total > 0 ? Math.round((graded / total) * 100) : 0;

    if (totalSubmissionsEl) totalSubmissionsEl.textContent = total;
    if (pendingSubmissionsEl) pendingSubmissionsEl.textContent = pending;
    if (gradedSubmissionsEl) gradedSubmissionsEl.textContent = graded;
    if (completionRateEl) completionRateEl.textContent = `${rate}%`;
}

// ========== NOTIFICATIONS ==========
const READ_KEY = 'lecturerReadNotifs';

function getReadSet() {
    try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]')); }
    catch { return new Set(); }
}

function saveReadSet(set) {
    try { localStorage.setItem(READ_KEY, JSON.stringify([...set].slice(-300))); } catch {}
}

function buildNotificationsFromSubmissions() {
    const read = getReadSet();
    return submissionsData
        .filter(s => s.status !== 'graded')
        .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
        .slice(0, 20)
        .map(s => {
            const id = `sub-${s._id}`;
            return {
                id,
                submissionId: s._id,
                message: `<strong>${escapeHtml(s.studentName)}</strong> submitted ${escapeHtml(s.assignmentId?.title || 'an assignment')}`,
                createdAt: s.submittedAt,
                read: read.has(id),
                local: true
            };
        });
}

async function loadNotifications() {
    // The backend has no /api/notifications route, so build notifications from submissions
    notificationsData = buildNotificationsFromSubmissions();
    renderNotifications();
}

function renderNotifications() {
    const panel = document.getElementById('notifPanel');
    const badge = document.getElementById('notifCount');
    if (!panel) return;

    const unread = notificationsData.filter(n => !n.read).length;
    if (badge) {
        badge.textContent = unread > 99 ? '99+' : unread;
        badge.style.display = unread > 0 ? '' : 'none';
    }

    const items = notificationsData.length === 0
        ? `<div style="padding:1.5rem;text-align:center;color:var(--text-light);font-size:0.85rem;">
               <i class="fa-regular fa-bell-slash" style="font-size:1.5rem;display:block;margin-bottom:0.5rem;"></i>
               No notifications yet
           </div>`
        : notificationsData.map(n => `
            <div class="notif-item ${n.read ? '' : 'unread'}" data-notif-id="${escapeHtml(n.id)}" data-submission-id="${escapeHtml(n.submissionId || '')}" style="cursor:pointer;">
                <i class="fa-regular fa-file-pdf" style="color:#2a7a4b;"></i>
                <div>
                    <p>${n.message}</p>
                    <small>${timeAgo(n.createdAt)}</small>
                </div>
            </div>`).join('');

    panel.innerHTML = `
        <div class="notif-header">
            <h4>Notifications</h4>
            <span id="markAllRead">Mark all as read</span>
        </div>
        <div style="max-height:360px;overflow-y:auto;">${items}</div>
    `;

    panel.querySelector('#markAllRead')?.addEventListener('click', markAllNotificationsRead);
    panel.querySelectorAll('.notif-item').forEach(el => {
        el.addEventListener('click', () => openNotification(el.dataset.notifId, el.dataset.submissionId));
    });
}

function markNotificationRead(id) {
    const n = notificationsData.find(x => String(x.id) === String(id));
    if (!n || n.read) return;
    n.read = true;
    if (n.local) {
        const set = getReadSet();
        set.add(n.id);
        saveReadSet(set);
    } else {
        fetch(`${API_URL}/api/notifications/${n.id}/read`, { method: 'PUT', headers: authHeaders() }).catch(() => {});
    }
}

function markAllNotificationsRead() {
    const set = getReadSet();
    notificationsData.forEach(n => {
        n.read = true;
        if (n.local) set.add(n.id);
    });
    saveReadSet(set);
    if (notificationsData.some(n => !n.local)) {
        fetch(`${API_URL}/api/notifications/read-all`, { method: 'PUT', headers: authHeaders() }).catch(() => {});
    }
    renderNotifications();
}

function openNotification(id, submissionId) {
    markNotificationRead(id);
    renderNotifications();
    if (!submissionId) return;

    // Clear filters so the submission is on the page, then rebuild the groups
    levelFilter.value = 'all';
    courseFilter.value = 'all';
    assignmentFilter.value = 'all';
    gradeStatusFilter.value = 'all';
    refreshFilterOptions();
    renderSubmissions();

    const card = document.querySelector(`.submission-card[data-submission-id="${submissionId}"]`);
    if (!card) return;

    // Open every collapsed level/course group above the card
    let el = card.parentElement;
    while (el && el !== submissionsContainer) {
        if (el.tagName === 'DETAILS') {
            el.open = true;
            collapsedGroups.delete(el.dataset.key);
        }
        el = el.parentElement;
    }

    document.getElementById('notifPanel')?.classList.remove('show');
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.style.outline = '2px solid var(--primary)';
    setTimeout(() => (card.style.outline = ''), 2000);
}

// ========== GROUPED RENDERING ==========
// Builds: level -> course -> assignment -> rows
function buildTree(rows) {
    const levels = new Map();

    for (const row of rows) {
        const level = row.level;
        const course = row.assignment.course || 'Unnamed course';
        const assignmentId = row.assignment._id;

        if (!levels.has(level)) levels.set(level, new Map());
        const courses = levels.get(level);

        if (!courses.has(course)) courses.set(course, new Map());
        const assignments = courses.get(course);

        if (!assignments.has(assignmentId)) {
            assignments.set(assignmentId, { assignment: row.assignment, rows: [] });
        }
        assignments.get(assignmentId).rows.push(row);
    }

    return [...levels.entries()]
        .sort((a, b) => levelRank(a[0]) - levelRank(b[0]))
        .map(([level, courses]) => ({
            level,
            courses: [...courses.entries()]
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([course, assignments]) => ({
                    course,
                    assignments: [...assignments.values()]
                        .sort((a, b) => String(a.assignment.title).localeCompare(String(b.assignment.title)))
                }))
        }));
}

function renderSubmissions() {
    if (!submissionsContainer) return;

    const rows = getFilteredRows();
    const totalAll = getAllRows().length;
    if (filterCount) filterCount.textContent = `Showing ${rows.length} of ${totalAll}`;
    updateAIBar(rows);

    if (rows.length === 0) {
        submissionsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fa-regular fa-folder-open"></i>
                <p>No submissions match these filters</p>
                <p style="font-size:0.85rem;">Try clearing the filters, or check that students have submitted for ${escapeHtml(currentSession)} ${escapeHtml(currentSemester)}</p>
            </div>`;
        return;
    }

    submissionsContainer.innerHTML = '';

    for (const levelNode of buildTree(rows)) {
        const levelRows = levelNode.courses.flatMap(c => c.assignments.flatMap(a => a.rows));
        const levelKey = `L:${levelNode.level}`;

        const levelEl = document.createElement('details');
        levelEl.className = 'level-group';
        levelEl.dataset.key = levelKey;
        levelEl.open = !collapsedGroups.has(levelKey);
        levelEl.innerHTML = `
            <summary class="group-summary">
                <i class="fa-solid fa-chevron-right group-chevron"></i>
                <span class="group-title">${escapeHtml(levelNode.level)}</span>
                <div class="group-pills">${countPills(countsOf(levelRows))}</div>
            </summary>
            <div class="group-body"></div>`;
        const levelBody = levelEl.querySelector('.group-body');

        for (const courseNode of levelNode.courses) {
            const courseRows = courseNode.assignments.flatMap(a => a.rows);
            const courseKey = `C:${levelNode.level}|${courseNode.course}`;
            const counts = countsOf(courseRows);

            const courseEl = document.createElement('details');
            courseEl.className = 'course-group';
            courseEl.dataset.key = courseKey;
            courseEl.open = !collapsedGroups.has(courseKey);
            courseEl.innerHTML = `
                <summary class="group-summary">
                    <i class="fa-solid fa-chevron-right group-chevron"></i>
                    <span class="group-title">${escapeHtml(courseNode.course)}</span>
                    <div class="group-pills">${countPills(counts)}</div>
                    ${counts.pending > 0 ? `
                        <button type="button" class="btn-ai-small course-ai-btn">
                            <i class="fa-solid fa-robot"></i> AI Grade ${counts.pending} Pending in ${escapeHtml(courseNode.course)}
                        </button>` : ''}
                </summary>
                <div class="group-body"></div>`;

            // Attach the handler in JS, so course names with quotes can't break the page
            const courseBtn = courseEl.querySelector('.course-ai-btn');
            if (courseBtn) {
                courseBtn.addEventListener('click', (e) => {
                    e.preventDefault();   // stop the <summary> from toggling the group
                    e.stopPropagation();
                    aiGradeCoursePending(courseNode.course);
                });
            }

            const courseBody = courseEl.querySelector('.group-body');
            for (const assignmentNode of courseNode.assignments) {
                courseBody.appendChild(buildAssignmentGroup(assignmentNode.assignment, assignmentNode.rows));
            }

            levelBody.appendChild(courseEl);
        }

        submissionsContainer.appendChild(levelEl);
    }

    bindScoreInputs();
    setBatchButtonsDisabled(isJobActive());
}

function buildAssignmentGroup(assignment, rows) {
    const counts = countsOf(rows);
    const wrapper = document.createElement('div');
    wrapper.className = 'assignment-group';

    const dueText = assignment.dueDateISO
        ? `Due: ${escapeHtml(assignment.dueDateISO)}${assignment.dueTime ? ' ' + escapeHtml(assignment.dueTime) : ''}`
        : '';

    wrapper.innerHTML = `
        <div class="assignment-group-header">
            <div>
                <h4>${escapeHtml(assignment.title)}</h4>
                <small>${escapeHtml(assignment.totalMarks ?? '')} marks ${dueText ? '· ' + dueText : ''}</small>
            </div>
            <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
                <div class="group-pills">${countPills(counts)}</div>
                ${counts.pending > 0 ? `
                    <button class="btn-ai-small" onclick="aiGradeAssignmentPending('${assignment._id}')">
                        <i class="fa-solid fa-robot"></i> AI Grade ${counts.pending} Pending
                    </button>` : ''}
            </div>
        </div>`;

    for (const row of rows) {
        wrapper.appendChild(createSubmissionCard(row.submission, assignment));
    }
    return wrapper;
}

// Remember which groups the lecturer closed, so re-renders don't reopen them
function setupGroupMemory() {
    submissionsContainer.addEventListener('toggle', (e) => {
        const el = e.target;
        if (!el.dataset || !el.dataset.key) return;
        if (el.open) collapsedGroups.delete(el.dataset.key);
        else collapsedGroups.add(el.dataset.key);
    }, true);
}

function createSubmissionCard(submission, assignment) {
    const dueDate = new Date(`${assignment.dueDateISO} ${assignment.dueTime}`);
    const submittedDate = new Date(submission.submittedAt);
    const isLate = submittedDate > dueDate;
    const isGraded = submission.status === 'graded';

    // Show the AI draft when the lecturer has not saved any scores yet
    const hasSavedScores = Object.keys(submission.scores || {}).length > 0;
    const hasAIDraft = !isGraded && Object.keys(submission.aiScores || {}).length > 0;
    const useAIDraft = hasAIDraft && !hasSavedScores;
    const scoreSource = useAIDraft ? submission.aiScores : (submission.scores || {});
    const feedbackText = useAIDraft ? (submission.aiFeedback || '') : (submission.feedback || '');

    const card = document.createElement('div');
    card.className = `submission-card ${isGraded ? 'graded' : 'pending'}`;
    card.dataset.submissionId = submission._id;

    let rubricHtml = '';
    let totalScore = 0;
    let maxTotal = 0;

    (assignment.rubric || []).forEach(criterion => {
        const savedScore = scoreSource[criterion.name] || 0;
        totalScore += savedScore;
        maxTotal += criterion.maxScore;

        rubricHtml += `
            <div class="rubric-item">
                <div class="rubric-info">
                    <span class="criterion-name">${escapeHtml(criterion.name)}</span>
                    <span class="criterion-max">Max: ${criterion.maxScore} pts</span>
                </div>
                <div class="rubric-score">
                    <input type="number" class="score-input" value="${savedScore}" min="0" max="${criterion.maxScore}" step="1" data-max="${criterion.maxScore}" data-criterion="${escapeHtml(criterion.name)}" ${isGraded ? 'disabled' : ''}>
                    <span>/ ${criterion.maxScore}</span>
                </div>
            </div>`;
    });

    const percentage = maxTotal > 0 ? (totalScore / maxTotal) * 100 : 0;
    const gradeLetter = getLetterGrade(percentage);
    const safeName = escapeHtml(submission.studentName);
    const safeTitle = escapeHtml(assignment.title);

    card.innerHTML = `
        <div class="submission-header">
            <div class="student-info">
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(submission.studentName || '')}&background=2a7a4b&color=fff&size=45" alt="student">
                <div>
                    <h3>${safeName}</h3>
                    <p>${escapeHtml(submission.matricNumber)}</p>
                </div>
            </div>
            <div class="assignment-info">
                <span class="assignment-title">${safeTitle}</span>
                <span class="course-name">${escapeHtml(assignment.course)}</span>
            </div>
            <div class="submission-meta">
                <span class="submitted-date">Submitted: ${submittedDate.toLocaleString()}</span>
                <span class="status-badge ${isLate ? 'late' : 'on-time'}">${isLate ? 'Late' : 'On Time'}</span>
                <span class="grade-badge ${isGraded ? 'graded' : 'pending'}">${isGraded ? 'Graded' : 'Pending'}</span>
                ${useAIDraft ? '<span class="pill pending">AI draft: review before releasing</span>' : ''}
            </div>
        </div>
        <div class="submission-body">
            <div class="file-section">
                <h4><i class="fa-regular fa-file"></i> Submitted Files</h4>
                <div class="file-list">
                    ${(submission.files || []).map((file, idx) => `
                        <div class="file-item">
                            <div class="file-info">
                                <i class="fa-regular ${file.name?.toLowerCase().endsWith('.pdf') ? 'fa-file-pdf' : 'fa-file'}"></i>
                                <span>${escapeHtml(file.name || `File ${idx + 1}`)}</span>
                                <span class="file-size">(${escapeHtml(String(file.size || '0 KB'))})</span>
                            </div>
                            <div class="file-actions">
                                <button class="btn-icon" onclick="viewFile('${submission._id}', ${idx})" title="Preview">
                                    <i class="fa-regular fa-eye"></i>
                                </button>
                                <button class="btn-icon" onclick="downloadFile('${submission._id}', ${idx})" title="Download">
                                    <i class="fa-solid fa-download"></i>
                                </button>
                            </div>
                        </div>`).join('')}
                </div>
            </div>
            <div class="grading-section">
                <h4><i class="fa-solid fa-ruler"></i> Grading Criteria (${escapeHtml(assignment.totalMarks)} marks total)</h4>
                <div class="rubric-items">${rubricHtml}</div>
                <div class="total-score">
                    <span>Total Score:</span>
                    <strong class="total-value">${totalScore}</strong>
                    <span>/ ${maxTotal}</span>
                    <span class="grade-letter">${gradeLetter}</span>
                </div>
            </div>
            <div class="feedback-section">
                <h4><i class="fa-regular fa-message"></i> Feedback</h4>
                ${isGraded
                    ? `<div class="feedback-display">${escapeHtml(submission.feedback || 'No feedback provided')}</div>`
                    : `<textarea class="feedback-input" rows="3" placeholder="Provide feedback...">${escapeHtml(feedbackText)}</textarea>`
                }
            </div>
        </div>
        <div class="submission-actions">
            ${!isGraded ? `
                <button class="ai-grade-btn" onclick="aiGradeSubmission('${submission._id}', '${safeName}', '${safeTitle}')">
                    <i class="fa-solid fa-robot"></i> AI Grade
                </button>
                <button class="btn-secondary" onclick="saveDraft('${submission._id}')">
                    <i class="fa-regular fa-floppy-disk"></i> Save Draft
                </button>
                <button class="btn-primary" onclick="releaseGrade('${submission._id}')">
                    <i class="fa-regular fa-paper-plane"></i> Release Grade
                </button>
            ` : `
                <button class="btn-secondary" onclick="editGrade('${submission._id}')">
                    <i class="fa-solid fa-pen"></i> Edit Grade
                </button>
                <button class="btn-primary" onclick="notifyStudent('${submission._id}')">
                    <i class="fa-regular fa-bell"></i> Notify Student
                </button>
            `}
        </div>`;

    return card;
}

function bindScoreInputs() {
    document.querySelectorAll('.score-input:not([disabled])').forEach(input => {
        input.removeEventListener('input', handleScoreInput);
        input.addEventListener('input', handleScoreInput);
    });
}

function handleScoreInput(e) {
    const input = e.target;
    const max = parseInt(input.getAttribute('data-max'));
    let val = parseInt(input.value);
    if (isNaN(val)) val = 0;
    if (val < 0) val = 0;
    if (val > max) {
        input.value = max;
        showToast(`Score cannot exceed ${max} points`, 'warning');
    }
    updateTotalForCard(input.closest('.submission-card'));
}

function updateTotalForCard(card) {
    const inputs = card.querySelectorAll('.score-input:not([disabled])');
    let total = 0, maxTotal = 0;
    inputs.forEach(input => {
        total += parseInt(input.value) || 0;
        maxTotal += parseInt(input.getAttribute('data-max')) || 0;
    });
    const totalSpan = card.querySelector('.total-value');
    const gradeSpan = card.querySelector('.grade-letter');
    if (totalSpan) {
        totalSpan.textContent = total;
        const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
        if (gradeSpan) gradeSpan.textContent = getLetterGrade(pct);
    }
}

// ========== DRAFTS & RELEASE ==========
function collectCardGrades(card) {
    const scores = {};
    card.querySelectorAll('.score-input').forEach(input => {
        const criterionName = input.closest('.rubric-item')?.querySelector('.criterion-name')?.textContent;
        if (criterionName) scores[criterionName] = parseInt(input.value) || 0;
    });
    const feedback = card.querySelector('.feedback-input')?.value || '';
    const totalScore = parseInt(card.querySelector('.total-value')?.textContent) || 0;
    return { scores, feedback, totalScore };
}

function saveDraft(submissionId) {
    const submission = submissionsData.find(s => s._id === submissionId);
    const card = document.querySelector(`.submission-card[data-submission-id="${submissionId}"]`);
    if (!submission || !card) return;

    const { scores, feedback } = collectCardGrades(card);
    submission.scores = scores;
    submission.feedback = feedback;
    showToast('Draft saved', 'success');
}

function releaseGrade(submissionId) {
    activeSubmissionId = submissionId;
    const submission = submissionsData.find(s => s._id === submissionId);
    const card = document.querySelector(`.submission-card[data-submission-id="${submissionId}"]`);
    if (!card) return;

    const totalScore = card.querySelector('.total-value')?.textContent || '0';
    const gradeLetter = card.querySelector('.grade-letter')?.textContent || '';
    const maxTotal = Array.from(card.querySelectorAll('.score-input'))
        .reduce((sum, input) => sum + (parseInt(input.getAttribute('data-max')) || 0), 0);

    const modalBody = document.getElementById('gradingModalBody');
    if (modalBody) {
        modalBody.innerHTML = `
            <p>Release grade for <strong>${escapeHtml(submission?.studentName)}</strong>?</p>
            <p><strong>Score:</strong> ${totalScore}/${maxTotal} (${gradeLetter})</p>
            <p class="note">This action will notify the student and cannot be undone.</p>`;
    }
    document.getElementById('gradingModal')?.classList.add('show');
}

function closeGradingModal() {
    document.getElementById('gradingModal')?.classList.remove('show');
    activeSubmissionId = null;
}

document.getElementById('confirmReleaseBtn')?.addEventListener('click', async () => {
    if (!activeSubmissionId) return;

    const submissionId = activeSubmissionId;
    const submission = submissionsData.find(s => s._id === submissionId);
    const card = document.querySelector(`.submission-card[data-submission-id="${submissionId}"]`);
    if (!submission || !card) return;

    const { scores, feedback, totalScore } = collectCardGrades(card);
    const confirmBtn = document.getElementById('confirmReleaseBtn');
    const originalText = confirmBtn?.innerHTML || 'Release Grade';
    if (confirmBtn) {
        confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Releasing...';
        confirmBtn.disabled = true;
    }

    try {
        const response = await fetch(`${API_URL}/api/submissions/${submissionId}/grade`, {
            method: 'PUT',
            headers: authHeaders(true),
            body: JSON.stringify({ scores, feedback, totalScore })
        });
        const data = await response.json();

        if (data.success) {
            editingIds.delete(submissionId);
            showToast(`Grade released for ${submission.studentName}`, 'success');
            await loadSubmissions();
            loadNotifications();
        } else {
            showToast(data.message || 'Failed to release grade', 'danger');
        }
    } catch (error) {
        console.error('Release grade error:', error);
        showToast('Failed to release grade. Check console for details.', 'danger');
    } finally {
        if (confirmBtn) {
            confirmBtn.innerHTML = originalText;
            confirmBtn.disabled = false;
        }
        closeGradingModal();
    }
});

// ========== EDIT GRADE & NOTIFY ==========
function editGrade(submissionId) {
    const submission = submissionsData.find(s => s._id === submissionId);
    if (!submission) return;
    submission.status = 'pending';
    editingIds.add(submissionId);
    updateStats();
    renderSubmissions();
    showToast('Editing mode enabled - you can now modify grades or re-run AI grading', 'info');
}

async function notifyStudent(submissionId) {
    const submission = submissionsData.find(s => s._id === submissionId);
    if (!submission) return;

    showToast(`Sending notification to ${submission.studentName}...`, 'info');
    try {
        const response = await fetch(`${API_URL}/api/submissions/${submissionId}/notify`, {
            method: 'POST',
            headers: authHeaders()
        });
        const data = await response.json();
        if (data.success) {
            showToast(`Email sent to ${submission.studentName}`, 'success');
        } else {
            showToast(data.message || 'Failed to send email', 'danger');
        }
    } catch (error) {
        showToast('Failed to send notification', 'danger');
    }
}

// ========== AI GRADING: ONE SUBMISSION ==========
async function aiGradeSubmission(submissionId, studentName, assignmentTitle) {
    if (currentAIProcessing) {
        showToast('AI is already processing', 'warning');
        return;
    }

    currentAIProcessing = true;
    currentAISubmissionId = submissionId;

    const btn = document.querySelector(`.submission-card[data-submission-id="${submissionId}"] .ai-grade-btn`);
    const originalText = btn?.innerHTML || '';
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> AI Grading...';
        btn.disabled = true;
    }

    showToast(`AI grading ${studentName}...`, 'info');

    try {
        const regrade = editingIds.has(submissionId);
        const response = await fetch(`${API_URL}/api/ai-grade/submission/${submissionId}`, {
            method: 'POST',
            headers: authHeaders(true),
            body: JSON.stringify({ regrade, force: regrade })
        });
        const data = await response.json();

        if (data.success) {
            showToast('AI grading complete!', 'success');
            updateCardWithAIGrades(submissionId, data.aiResult);
            showAISummary(submissionId, studentName, assignmentTitle, data.aiResult);
        } else {
            showToast(data.message || 'AI grading failed', 'danger');
        }
    } catch (error) {
        console.error('AI error:', error);
        showToast('AI service error: ' + error.message, 'danger');
    } finally {
        currentAIProcessing = false;
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
}

function updateCardWithAIGrades(submissionId, aiResult) {
    const card = document.querySelector(`.submission-card[data-submission-id="${submissionId}"]`);
    if (!card || !aiResult) return;

    if (aiResult.scores) {
        for (const [criterion, score] of Object.entries(aiResult.scores)) {
            for (const input of card.querySelectorAll('.score-input')) {
                const name = input.closest('.rubric-item')?.querySelector('.criterion-name')?.textContent;
                if (name === criterion) {
                    input.value = score;
                    input.dispatchEvent(new Event('input'));
                    break;
                }
            }
        }
    }
    const feedback = card.querySelector('.feedback-input');
    if (feedback && aiResult.feedback) feedback.value = aiResult.feedback;
}

function showAISummary(submissionId, studentName, assignmentTitle, aiResult) {
    const modal = document.getElementById('aiSummaryModal');
    const modalBody = document.getElementById('aiSummaryModalBody');
    if (!modal || !modalBody) return;

    const maxScores = aiResult.maxScores || {};
    let maxTotal = Object.values(maxScores).reduce((sum, m) => sum + (Number(m) || 0), 0);

    if (maxTotal <= 0) {
        const sub = submissionsData.find(s => s._id === submissionId);
        const assignment = getAssignmentFor(sub || {});
        maxTotal = Number(assignment?.totalMarks) || 100;
    }

    const totalScore = Number(aiResult.totalScore) || 0;
    const percentage = maxTotal > 0 ? Math.round((totalScore / maxTotal) * 100) : 0;

    let rubricHtml = '';
    if (aiResult.scores && aiResult.criterionFeedback) {
        rubricHtml = '<table class="rubric-summary-table"><thead><tr><th>Criterion</th><th>Score</th><th>Max</th><th>Justification</th></tr></thead><tbody>';
        for (const [criterion, score] of Object.entries(aiResult.scores)) {
            const max = maxScores[criterion] ?? '?';
            rubricHtml += `<tr><td>${escapeHtml(criterion)}</td><td><span class="score-badge">${score}</span></td><td>/${max}</td><td>${escapeHtml(aiResult.criterionFeedback?.[criterion] || '')}</td></tr>`;
        }
        rubricHtml += '</tbody></table>';
    }

    modalBody.innerHTML = `
        <div class="ai-summary-header">
            <div class="ai-icon"><i class="fa-solid fa-robot"></i></div>
            <div><h3>AI Grading Summary</h3><p>${escapeHtml(studentName)} - ${escapeHtml(assignmentTitle)}</p></div>
        </div>
        <div class="ai-score-section">
            <div class="total-score-circle">
                <span class="score">${totalScore}</span>
                <span class="total">/${maxTotal}</span>
                <span class="percentage">${percentage}%</span>
            </div>
            <div class="grade-letter">${getLetterGrade(percentage)}</div>
        </div>
        <div class="ai-rubric-section">
            <h4>Rubric Breakdown</h4>
            ${rubricHtml || '<p>No rubric data available</p>'}
        </div>
        <div class="ai-feedback-section">
            <h4>Feedback</h4>
            <div class="feedback-content">${escapeHtml(aiResult.feedback || 'No feedback generated.')}</div>
        </div>
        <div class="ai-actions">
            <button class="btn-secondary" onclick="closeAISummaryModal()">Cancel</button>
            <button class="btn-primary" onclick="acceptAIGrades()">Accept &amp; Release Grade</button>
        </div>`;
    modal.classList.add('show');
}

function closeAISummaryModal() {
    document.getElementById('aiSummaryModal')?.classList.remove('show');
    currentAISubmissionId = null;
}

async function acceptAIGrades() {
    if (!currentAISubmissionId) return;

    const submissionId = currentAISubmissionId;
    const card = document.querySelector(`.submission-card[data-submission-id="${submissionId}"]`);
    if (!card) return;

    const { scores, feedback, totalScore } = collectCardGrades(card);

    try {
        const response = await fetch(`${API_URL}/api/submissions/${submissionId}/grade`, {
            method: 'PUT',
            headers: authHeaders(true),
            body: JSON.stringify({ scores, feedback, totalScore })
        });
        const data = await response.json();
        if (data.success) {
            editingIds.delete(submissionId);
            showToast('Grade accepted and released!', 'success');
            closeAISummaryModal();
            await loadSubmissions();
            loadNotifications();
        } else {
            showToast(data.message || 'Failed to release grade', 'danger');
        }
    } catch (error) {
        showToast('Failed to release grade', 'danger');
    }
}

// ========== AI GRADING: BATCH (server-side, saves drafts only) ==========
// The server grades in the background and saves AI results as drafts.
// Nothing is released or emailed from here. The lecturer releases each grade on its card.
const ACTIVE_JOB_KEY = 'activeAIGradingJob';
let jobPollTimer = null;

function isJobActive() {
    return !!localStorage.getItem(ACTIVE_JOB_KEY);
}

function setBatchButtonsDisabled(disabled) {
    document.querySelectorAll('.btn-ai-small').forEach(b => { b.disabled = disabled; });
}

// Asks the server to start a job, then follows its progress
async function startBatch(url, body, pendingCount, label) {
    if (isJobActive()) {
        showToast('A grading job is already running. Wait for it to finish.', 'warning');
        return;
    }
    if (pendingCount === 0) {
        showToast('No pending submissions to grade here', 'info');
        return;
    }
    if (!confirm(`AI-grade ${pendingCount} pending submission(s) for ${label}?\n\nResults are saved as drafts. Nothing is released or emailed until you release each grade.`)) return;

    try {
        const res = await fetch(`${API_URL}${url}`, {
            method: 'POST',
            headers: authHeaders(true),
            body: JSON.stringify(body)
        });
        const data = await res.json();

        if (data.jobId) {
            localStorage.setItem(ACTIVE_JOB_KEY, data.jobId);
            followJob(data.jobId);
        }

        if (res.status === 202) {
            showToast(`${data.message}. You can leave this page; it keeps running.`, 'info', 5000);
        } else if (!data.jobId) {
            showToast(data.message || 'Nothing needed grading', 'info');
        } else {
            showToast(data.message || 'Could not start grading', 'danger');
        }
    } catch (e) {
        showToast('Could not start grading: ' + e.message, 'danger');
    }
}

// Polls the server every 3 seconds and updates the progress banner
function followJob(jobId) {
    clearInterval(jobPollTimer);
    setBatchButtonsDisabled(true);

    const stop = () => { clearInterval(jobPollTimer); jobPollTimer = null; };

    const tick = async () => {
        try {
            const res = await fetch(`${API_URL}/api/ai-grade/jobs/${jobId}`, { headers: authHeaders() });
            const data = await res.json();

            if (!data.success) {
                stop();
                localStorage.removeItem(ACTIVE_JOB_KEY);
                renderJobBanner(null);
                setBatchButtonsDisabled(false);
                showToast('Grading job not found. If the server restarted, check the submissions again.', 'warning', 6000);
                return;
            }

            renderJobBanner(data.job);

            if (data.job.status === 'finished') {
                stop();
                localStorage.removeItem(ACTIVE_JOB_KEY);
                setBatchButtonsDisabled(false);
                showToast(
                    `AI grading finished: ${data.job.graded} drafted, ${data.job.failed} failed`,
                    data.job.failed ? 'warning' : 'success',
                    6000
                );
                await loadSubmissions();
            }
        } catch (err) {
            console.warn('Grading progress check failed, will retry:', err.message);
        }
    };

    tick();
    jobPollTimer = setInterval(tick, 3000);
}

// Shows progress, and lists failed students with their reasons
function renderJobBanner(job) {
    let banner = document.getElementById('aiJobBanner');
    if (!job) {
        banner?.remove();
        return;
    }

    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'aiJobBanner';
        banner.style.cssText = 'background:var(--white);border:1px solid var(--border);border-radius:16px;padding:1rem 1.25rem;margin-bottom:1.5rem;';
        document.querySelector('.ai-action-bar')?.after(banner);
    }

    const finished = job.status === 'finished';
    const pct = job.total ? Math.round((job.done / job.total) * 100) : 100;
    const failures = job.failures.length
        ? `<details style="margin-top:.6rem;">
               <summary>${job.failed} failed (click to see)</summary>
               <ul style="margin:.5rem 0 0 1.2rem;">
                   ${job.failures.map(f => `<li>${escapeHtml(f.studentName)}: ${escapeHtml(f.reason)}</li>`).join('')}
               </ul>
           </details>`
        : '';

    banner.innerHTML = `
        <div><strong>${finished ? 'AI grading finished' : 'AI grading in progress'}</strong> · ${escapeHtml(job.label)}</div>
        <div style="font-size:.85rem;color:var(--text-light);margin-top:.3rem;">
            ${job.done}/${job.total} done · ${job.graded} drafted · ${job.failed} failed
        </div>
        <div style="height:6px;background:var(--border);border-radius:6px;margin-top:.6rem;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:var(--primary);transition:width .3s;"></div>
        </div>
        ${failures}
        ${finished ? '<button type="button" class="btn-secondary job-dismiss" style="margin-top:.6rem;">Dismiss</button>' : ''}`;

    banner.querySelector('.job-dismiss')?.addEventListener('click', () => banner.remove());
}

// Button in the top bar: grades the pending submissions the filters show
function aiGradeAllPending() {
    const ids = getFilteredRows()
        .filter(r => r.submission.status !== 'graded')
        .map(r => r.submission._id);
    startBatch('/api/ai-grade/submissions', { submissionIds: ids }, ids.length, 'the filtered list');
}

// Button on each assignment: grades that assignment's pending submissions
function aiGradeAssignmentPending(assignmentId) {
    const assignment = assignmentsData.find(a => a._id === assignmentId);
    const count = submissionsData.filter(s =>
        s.assignmentId?._id === assignmentId && s.status !== 'graded'
    ).length;
    startBatch(`/api/ai-grade/assignment/${assignmentId}`, {}, count, assignment?.title || 'this assignment');
}

// Button on each course: grades every pending submission in that course
function aiGradeCoursePending(course) {
    const count = getAllRows().filter(r =>
        r.assignment.course === course && r.submission.status !== 'graded'
    ).length;
    startBatch(
        '/api/ai-grade/course',
        { course, session: currentSession, semester: currentSemester },
        count,
        `course ${course}`
    );
}

// Updates the top bar so it shows how many pending submissions it will grade
function updateAIBar(rows) {
    const btn = document.getElementById('aiGradeAllBtn');
    if (!btn) return;
    const pending = rows.filter(r => r.submission.status !== 'graded').length;
    btn.innerHTML = `<i class="fa-solid fa-robot"></i> AI Grade ${pending} Pending (shown)`;
    btn.disabled = pending === 0 || isJobActive();
}

// ========== FILTERS ==========
function onLevelChange() {
    refreshFilterOptions();
    renderSubmissions();
}

function onCourseChange() {
    refreshFilterOptions();
    renderSubmissions();
}

function onOtherFilterChange() {
    renderSubmissions();
}

function clearFilters() {
    if (levelFilter) levelFilter.value = 'all';
    if (courseFilter) courseFilter.value = 'all';
    if (assignmentFilter) assignmentFilter.value = 'all';
    if (gradeStatusFilter) gradeStatusFilter.value = 'all';
    refreshFilterOptions();
    renderSubmissions();
}

// ========== FILE PREVIEW / DOWNLOAD ==========
const MIME_BY_EXT = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    txt: 'text/plain',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    zip: 'application/zip'
};
const PREVIEWABLE_EXT = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'txt'];

function getFileMeta(submissionId, fileIndex) {
    const sub = submissionsData.find(s => s._id === submissionId);
    const file = sub?.files?.[fileIndex];
    const name = file?.name || `submission_file_${Number(fileIndex) + 1}`;
    const ext = (name.split('.').pop() || '').toLowerCase();
    return { name, ext, mime: MIME_BY_EXT[ext] || 'application/octet-stream' };
}

async function fetchSubmissionFile(submissionId, fileIndex) {
    const meta = getFileMeta(submissionId, fileIndex);
    const response = await fetch(`${API_URL}/api/submissions/${submissionId}/download/${fileIndex}`, {
        headers: authHeaders()
    });

    if (!response.ok) {
        let msg = response.statusText || 'Request failed';
        try { msg = (await response.json()).message || msg; } catch {}
        throw new Error(`${response.status} - ${msg}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        const json = await response.json();
        const remoteUrl = json.url || json.fileUrl || json.file?.url;
        if (!remoteUrl) throw new Error(json.message || 'Server did not return a file');
        return { url: remoteUrl, downloadUrl: json.downloadUrl || remoteUrl, revoke: false, meta };
    }

    const raw = await response.blob();
    const type = raw.type && raw.type !== 'application/octet-stream' ? raw.type : meta.mime;
    const blobUrl = URL.createObjectURL(new Blob([raw], { type }));
    return { url: blobUrl, downloadUrl: blobUrl, revoke: true, meta };
}

async function viewFile(submissionId, fileIndex) {
    const meta = getFileMeta(submissionId, fileIndex);

    if (!PREVIEWABLE_EXT.includes(meta.ext)) {
        showToast(`.${meta.ext || 'this'} files can't be previewed in the browser - downloading instead`, 'info');
        return downloadFile(submissionId, fileIndex);
    }

    // Open the tab inside the click so the popup blocker doesn't block it
    const win = window.open('', '_blank');
    if (win) win.document.write('<p style="font-family:sans-serif;padding:2rem;">Loading file...</p>');

    try {
        showToast('Loading file preview...', 'info');
        const file = await fetchSubmissionFile(submissionId, fileIndex);

        if (win) {
            win.location.href = file.url;
        } else {
            await downloadFile(submissionId, fileIndex);
            return;
        }
        if (file.revoke) setTimeout(() => URL.revokeObjectURL(file.url), 5 * 60 * 1000);
    } catch (error) {
        console.error('Preview error:', error);
        if (win) win.close();
        showToast(`Preview failed: ${error.message}`, 'danger', 5000);
    }
}

async function downloadFile(submissionId, fileIndex) {
    try {
        showToast('Downloading file...', 'info');
        const file = await fetchSubmissionFile(submissionId, fileIndex);

        const a = document.createElement('a');
        a.href = file.downloadUrl || file.url;
        a.download = file.meta.name;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        if (file.revoke) setTimeout(() => URL.revokeObjectURL(file.url), 60 * 1000);
        showToast('Download started', 'success');
    } catch (error) {
        console.error('Download error:', error);
        showToast(`Download failed: ${error.message}`, 'danger', 5000);
    }
}

// ========== EXPORT RESULTS TO EXCEL ==========
function pickCourseModal(courses) {
    return new Promise(resolve => {
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header"><h3>Export Results</h3></div>
                <div class="modal-body">
                    <p style="margin-bottom:0.8rem;">Choose the course to export:</p>
                    <select id="exportCourseSelect" class="filter-select" style="width:100%;">
                        ${courses.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
                    </select>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" id="exportCancel">Cancel</button>
                    <button class="btn-primary" id="exportConfirm"><i class="fa-solid fa-file-excel"></i> Export</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        const done = (value) => { modal.remove(); resolve(value); };
        modal.querySelector('#exportCancel').onclick = () => done(null);
        modal.querySelector('#exportConfirm').onclick = () => done(modal.querySelector('#exportCourseSelect').value);
    });
}

async function downloadAllSubmissions() {
    const courses = [...new Set(assignmentsData.map(a => a.course).filter(Boolean))].sort();
    if (courses.length === 0) {
        showToast('No courses found to export', 'warning');
        return;
    }

    // Course from the filter, the only course, or ask
    let course;
    if (courseFilter?.value && courseFilter.value !== 'all') course = courseFilter.value;
    else if (courses.length === 1) course = courses[0];
    else course = await pickCourseModal(courses);
    if (!course) return;

    const pending = submissionsData.filter(s =>
        getAssignmentFor(s)?.course === course && s.status !== 'graded'
    ).length;
    if (pending > 0 && !confirm(`${pending} submission(s) for ${course} are not graded yet and will show as "Pending". Export anyway?`)) {
        return;
    }

    try {
        showToast('Preparing Excel file...', 'info');
        const url = `${API_URL}/api/submissions/lecturer/export?course=${encodeURIComponent(course)}&session=${encodeURIComponent(currentSession)}&semester=${encodeURIComponent(currentSemester)}`;
        const response = await fetch(url, { headers: authHeaders() });

        if (!response.ok) {
            let msg = response.statusText || 'Request failed';
            try { msg = (await response.json()).message || msg; } catch {}
            throw new Error(`${response.status} - ${msg}`);
        }

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${course}_Results_${currentSession}_${currentSemester}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60 * 1000);
        showToast('Excel file downloaded', 'success');
    } catch (error) {
        console.error('Export error:', error);
        showToast(`Export failed: ${error.message}`, 'danger', 5000);
    }
}

// ========== TOAST ==========
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
    const icon = type === 'success' ? 'fa-check-circle' : type === 'danger' ? 'fa-exclamation-circle' : 'fa-info-circle';
    toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${escapeHtml(message)}</span><button class="toast-close" onclick="this.parentElement.remove()">&times;</button>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
}

// ========== UI INITIALIZATION ==========
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
            if (!notifPanel.contains(e.target) && !notifBtn.contains(e.target)) notifPanel.classList.remove('show');
        });
    }

    // Header search: filters student cards by name
    const searchInput = document.querySelector('.header-search input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            document.querySelectorAll('.submission-card').forEach(card => {
                const name = card.querySelector('.student-info h3')?.textContent.toLowerCase() || '';
                card.style.display = name.includes(term) ? '' : 'none';
            });
        });
    }

    // Filter changes
    levelFilter?.addEventListener('change', onLevelChange);
    courseFilter?.addEventListener('change', onCourseChange);
    assignmentFilter?.addEventListener('change', onOtherFilterChange);
    gradeStatusFilter?.addEventListener('change', onOtherFilterChange);

    document.querySelector('.logout-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });
}

function logout() {
    localStorage.clear();
    window.location.href = 'login.html';
}

// ========== INITIALIZE ==========
document.addEventListener('DOMContentLoaded', async () => {
    if (!token || userRole !== 'lecturer') return;

    initUI();
    setupGroupMemory();
    await loadAssignments();
    await loadSubmissions();
    await loadNotifications();
    setInterval(loadNotifications, 60000);

    // Resume following a grading job that was running before the page was reloaded
    const savedJob = localStorage.getItem(ACTIVE_JOB_KEY);
    if (savedJob) followJob(savedJob);
});

// Make functions available to inline onclick handlers
window.saveDraft = saveDraft;
window.releaseGrade = releaseGrade;
window.closeGradingModal = closeGradingModal;
window.editGrade = editGrade;
window.notifyStudent = notifyStudent;
window.viewFile = viewFile;
window.downloadFile = downloadFile;
window.downloadAllSubmissions = downloadAllSubmissions;
window.clearFilters = clearFilters;
window.aiGradeSubmission = aiGradeSubmission;
window.aiGradeAllPending = aiGradeAllPending;
window.aiGradeAssignmentPending = aiGradeAssignmentPending;
window.aiGradeCoursePending = aiGradeCoursePending;
window.closeAISummaryModal = closeAISummaryModal;
window.acceptAIGrades = acceptAIGrades;
window.showToast = showToast;
window.logout = logout;