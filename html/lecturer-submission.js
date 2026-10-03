// lecturer-submission.js - FIXED VERSION v2
// Fixes: (1) real notifications, (2) AI re-grade after Edit Grade, (3) file preview/download

// ========== ROLE-SPECIFIC TOKEN FUNCTION ==========
function getAuthToken() {
    const userRole = localStorage.getItem('userRole');
    if (!userRole) return null;
    return localStorage.getItem(`${userRole}_token`) || localStorage.getItem('token');
}

// ========== CHECK AUTHENTICATION ==========
const token = getAuthToken();
const userRole = localStorage.getItem('userRole');
const userName = localStorage.getItem('fullName') || localStorage.getItem('userName') || 'Lecturer';

if (!token || userRole !== 'lecturer') {
    window.location.href = 'login.html';
}

// Global variables
let submissionsData = [];
let assignmentsData = [];
let notificationsData = [];
let currentAIProcessing = false;
let currentAISubmissionId = null;
let currentAIData = null;
const editingIds = new Set(); // submissions the lecturer unlocked via "Edit Grade"
let currentSession = localStorage.getItem('currentSession') || '2025-2026';
let currentSemester = localStorage.getItem('currentSemester') || 'Harmattan';

// DOM Elements
const totalSubmissionsEl = document.getElementById('totalSubmissions');
const pendingSubmissionsEl = document.getElementById('pendingSubmissions');
const gradedSubmissionsEl = document.getElementById('gradedSubmissions');
const completionRateEl = document.getElementById('completionRate');
const submissionsContainer = document.getElementById('submissionsContainer');
const assignmentFilter = document.getElementById('assignmentFilter');
const gradeStatusFilter = document.getElementById('gradeStatusFilter');
const aiGradeAllBtn = document.getElementById('aiGradeAllBtn');

function authHeaders(json = false) {
    const h = { 'Authorization': `Bearer ${token}` };
    if (json) h['Content-Type'] = 'application/json';
    return h;
}

// Update semester display
function updateSemesterDisplay() {
    const semesterDisplay = document.querySelector('.current-semester');
    if (semesterDisplay) {
        semesterDisplay.innerHTML = `<i class="fa-regular fa-calendar"></i> ${currentSession} ${currentSemester}`;
    }
}

// ========== LOAD ASSIGNMENTS ==========
async function loadAssignments() {
    try {
        const response = await fetch(`${API_URL}/api/assignments/lecturer`, { headers: authHeaders() });
        const data = await response.json();

        if (data.success && assignmentFilter) {
            assignmentsData = data.assignments || [];
            assignmentFilter.innerHTML = '<option value="all">All Assignments</option>';
            assignmentsData.forEach(assignment => {
                const option = document.createElement('option');
                option.value = assignment._id;
                option.textContent = `${assignment.course} - ${assignment.title} (${assignment.totalMarks} marks)`;
                assignmentFilter.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading assignments:', error);
        showToast('Failed to load assignments', 'danger');
    }
}

// ========== LOAD SUBMISSIONS ==========
async function loadSubmissions() {
    try {
        showToast('Loading submissions...', 'info');

        currentSession = localStorage.getItem('currentSession') || '2025-2026';
        currentSemester = localStorage.getItem('currentSemester') || 'Harmattan';
        updateSemesterDisplay();

        const response = await fetch(`${API_URL}/api/submissions/lecturer/all?session=${currentSession}&semester=${currentSemester}`, {
            headers: authHeaders()
        });
        const data = await response.json();

        if (data.success) {
            submissionsData = data.submissions || [];
            updateStats();
            renderSubmissions();
            showToast(`Loaded ${submissionsData.length} submissions`, 'success');
        } else {
            submissionsData = [];
            renderSubmissions();
            showToast(data.message || 'No submissions found', 'info');
        }
    } catch (error) {
        console.error('Error loading submissions:', error);
        showToast('Failed to load submissions', 'danger');
        renderSubmissions();
    }
}

function updateStats() {
    const total = submissionsData.length;
    const pending = submissionsData.filter(s => s.status !== 'graded').length;
    const graded = submissionsData.filter(s => s.status === 'graded').length;
    const rate = total > 0 ? Math.round((graded / total) * 100) : 0;

    if (totalSubmissionsEl) totalSubmissionsEl.textContent = total;
    if (pendingSubmissionsEl) pendingSubmissionsEl.textContent = pending;
    if (gradedSubmissionsEl) gradedSubmissionsEl.textContent = graded;
    if (completionRateEl) completionRateEl.textContent = `${rate}%`;
}

// ========== NOTIFICATIONS (REAL DATA) ==========
const READ_KEY = 'lecturerReadNotifs';

function getReadSet() {
    try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]')); }
    catch { return new Set(); }
}
function saveReadSet(set) {
    try { localStorage.setItem(READ_KEY, JSON.stringify([...set].slice(-300))); } catch {}
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

// Fallback: build notifications from real submission data
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
    // 1) Try a real notifications endpoint
    try {
        const res = await fetch(`${API_URL}/api/notifications`, { headers: authHeaders() });
        if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.notifications)) {
                notificationsData = data.notifications.map(n => ({
                    id: n._id,
                    submissionId: n.submissionId || n.relatedId || null,
                    message: escapeHtml(n.message || n.title || 'New notification'),
                    createdAt: n.createdAt,
                    read: !!(n.read || n.isRead),
                    local: false
                }));
                renderNotifications();
                return;
            }
        }
    } catch (e) {
        console.warn('Notifications endpoint unavailable, using submissions instead');
    }
    // 2) Fallback to submissions
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
            <div class="notif-item ${n.read ? '' : 'unread'}" data-notif-id="${n.id}" data-submission-id="${n.submissionId || ''}" style="cursor:pointer;">
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
    document.getElementById('notifPanel')?.classList.add('show');
    if (submissionId) {
        if (assignmentFilter) assignmentFilter.value = 'all';
        if (gradeStatusFilter) gradeStatusFilter.value = 'all';
        const card = document.querySelector(`.submission-card[data-submission-id="${submissionId}"]`);
        if (card) {
            document.getElementById('notifPanel')?.classList.remove('show');
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card.style.outline = '2px solid var(--primary)';
            setTimeout(() => (card.style.outline = ''), 2000);
        }
    }
}

// ========== RENDER SUBMISSIONS ==========
function renderSubmissions() {
    if (!submissionsContainer) return;

    const assignmentId = assignmentFilter?.value || 'all';
    const gradeStatus = gradeStatusFilter?.value || 'all';

    let filtered = [...submissionsData];

    if (assignmentId !== 'all') {
        filtered = filtered.filter(s => s.assignmentId?._id === assignmentId);
    }
    if (gradeStatus !== 'all') {
        filtered = filtered.filter(s => s.status === gradeStatus);
    }

    if (filtered.length === 0) {
        submissionsContainer.innerHTML = `
            <div class="loading-message">
                <i class="fa-regular fa-folder-open" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                <p>No submissions found for ${currentSession} ${currentSemester}</p>
                <p style="font-size: 0.85rem;">Make sure you have registered courses for this semester</p>
            </div>
        `;
        return;
    }

    submissionsContainer.innerHTML = '';

    for (const submission of filtered) {
        const assignment = assignmentsData.find(a => a._id === submission.assignmentId?._id);
        if (!assignment) continue;

        const dueDate = new Date(`${assignment.dueDateISO} ${assignment.dueTime}`);
        const submittedDate = new Date(submission.submittedAt);
        const isLate = submittedDate > dueDate;

        const card = document.createElement('div');
        card.className = `submission-card ${submission.status === 'graded' ? 'graded' : 'pending'}`;
        card.dataset.submissionId = submission._id;

        let rubricHtml = '';
        let totalScore = 0;
        let maxTotal = 0;

        if (assignment.rubric?.length > 0) {
            assignment.rubric.forEach(criterion => {
                const savedScore = submission.scores?.[criterion.name] || 0;
                totalScore += savedScore;
                maxTotal += criterion.maxScore;

                rubricHtml += `
                    <div class="rubric-item">
                        <div class="rubric-info">
                            <span class="criterion-name">${escapeHtml(criterion.name)}</span>
                            <span class="criterion-max">Max: ${criterion.maxScore} pts</span>
                        </div>
                        <div class="rubric-score">
                            <input type="number" class="score-input" value="${savedScore}" min="0" max="${criterion.maxScore}" step="1" data-max="${criterion.maxScore}" data-criterion="${escapeHtml(criterion.name)}" ${submission.status === 'graded' ? 'disabled' : ''}>
                            <span>/ ${criterion.maxScore}</span>
                        </div>
                    </div>
                `;
            });
        }

        const percentage = maxTotal > 0 ? (totalScore / maxTotal) * 100 : 0;
        const gradeLetter = getLetterGrade(percentage);

        card.innerHTML = `
            <div class="submission-header">
                <div class="student-info">
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(submission.studentName)}&background=2a7a4b&color=fff&size=45" alt="student">
                    <div>
                        <h3>${escapeHtml(submission.studentName)}</h3>
                        <p>${submission.matricNumber}</p>
                    </div>
                </div>
                <div class="assignment-info">
                    <span class="assignment-title">${escapeHtml(assignment.title)}</span>
                    <span class="course-name">${assignment.course}</span>
                </div>
                <div class="submission-meta">
                    <span class="submitted-date">Submitted: ${new Date(submission.submittedAt).toLocaleString()}</span>
                    <span class="status-badge ${isLate ? 'late' : 'on-time'}">${isLate ? 'Late' : 'On Time'}</span>
                    <span class="grade-badge ${submission.status === 'graded' ? 'graded' : 'pending'}">${submission.status === 'graded' ? 'Graded' : 'Pending'}</span>
                </div>
            </div>
            <div class="submission-body">
                <div class="file-section">
                    <h4><i class="fa-regular fa-file"></i> Submitted Files</h4>
                    <div class="file-list">
                        ${submission.files?.map((file, idx) => `
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
                            </div>
                        `).join('') || ''}
                    </div>
                </div>
                <div class="grading-section">
                    <h4><i class="fa-solid fa-ruler"></i> Grading Criteria (${assignment.totalMarks} marks total)</h4>
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
                    ${submission.status === 'graded'
                        ? `<div class="feedback-display">${escapeHtml(submission.feedback || 'No feedback provided')}</div>`
                        : `<textarea class="feedback-input" rows="3" placeholder="Provide feedback...">${escapeHtml(submission.feedback || '')}</textarea>`
                    }
                </div>
            </div>
            <div class="submission-actions">
                ${submission.status !== 'graded' ? `
                    <button class="ai-grade-btn" onclick="aiGradeSubmission('${submission._id}', '${escapeHtml(submission.studentName)}', '${escapeHtml(assignment.title)}')">
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
            </div>
        `;

        submissionsContainer.appendChild(card);
    }

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

function getLetterGrade(percentage) {
    if (percentage >= 70) return 'A';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C';
    if (percentage >= 45) return 'D';
    if (percentage >= 40) return 'E';
    return 'F';
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

let activeSubmissionId = null;

function collectCardGrades(card) {
    const scores = {};
    card.querySelectorAll('.score-input').forEach(input => {
        const rubricItem = input.closest('.rubric-item');
        const criterionName = rubricItem?.querySelector('.criterion-name')?.textContent;
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

// ========== RELEASE GRADE ==========
function releaseGrade(submissionId) {
    activeSubmissionId = submissionId;
    const submission = submissionsData.find(s => s._id === submissionId);
    const card = document.querySelector(`.submission-card[data-submission-id="${submissionId}"]`);
    if (!card) return;

    const totalScore = card.querySelector('.total-value')?.textContent || '0';
    const gradeLetter = card.querySelector('.grade-letter')?.textContent || '';
    const maxTotal = Array.from(card.querySelectorAll('.score-input')).reduce((sum, input) => sum + (parseInt(input.getAttribute('data-max')) || 0), 0);

    const modalBody = document.getElementById('gradingModalBody');
    if (modalBody) {
        modalBody.innerHTML = `
            <p>Release grade for <strong>${escapeHtml(submission?.studentName)}</strong>?</p>
            <p><strong>Score:</strong> ${totalScore}/${maxTotal} (${gradeLetter})</p>
            <p class="note">This action will notify the student and cannot be undone.</p>
        `;
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

// ========== EDIT GRADE ==========
function editGrade(submissionId) {
    const submission = submissionsData.find(s => s._id === submissionId);
    if (submission) {
        submission.status = 'pending';
        editingIds.add(submissionId); // remember so AI re-grade is allowed
        renderSubmissions();
        updateStats();
        showToast('Editing mode enabled - you can now modify grades or re-run AI grading', 'info');
    }
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

// ========== AI GRADING ==========
async function aiGradeSubmission(submissionId, studentName, assignmentTitle) {
    if (currentAIProcessing) {
        showToast('AI is already processing', 'warning');
        return;
    }

    currentAIProcessing = true;
    currentAISubmissionId = submissionId;

    const btn = document.querySelector(`.ai-grade-btn[onclick*="${submissionId}"]`);
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
            // regrade flag tells the backend it's OK to grade an already-graded submission
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
            const inputs = card.querySelectorAll('.score-input');
            for (const input of inputs) {
                const criterionSpan = input.closest('.rubric-item')?.querySelector('.criterion-name');
                if (criterionSpan && criterionSpan.textContent === criterion) {
                    input.value = score;
                    input.dispatchEvent(new Event('input'));
                    break;
                }
            }
        }
    }
    const feedback = card.querySelector('.feedback-input');
    if (feedback && aiResult.feedback) {
        feedback.value = aiResult.feedback;
    }
}

function showAISummary(submissionId, studentName, assignmentTitle, aiResult) {
    const modal = document.getElementById('aiSummaryModal');
    const modalBody = document.getElementById('aiSummaryModalBody');
    if (!modal || !modalBody) return;

    let rubricHtml = '';
    if (aiResult.scores && aiResult.criterionFeedback) {
        rubricHtml = '<table class="rubric-summary-table"><thead><tr><th>Criterion</th><th>Score</th><th>Max</th><th>Justification</th></tr></thead><tbody>';
        for (const [criterion, score] of Object.entries(aiResult.scores)) {
            const max = aiResult.maxScores?.[criterion] || '?';
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
                <span class="score">${aiResult.totalScore || 0}</span>
                <span class="total">/100</span>
                <span class="percentage">${Math.round((aiResult.totalScore || 0))}%</span>
            </div>
            <div class="grade-letter">${getLetterGrade(aiResult.totalScore || 0)}</div>
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
        </div>
    `;
    modal.classList.add('show');
}

function closeAISummaryModal() {
    document.getElementById('aiSummaryModal')?.classList.remove('show');
    currentAIData = null;
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

async function aiGradeAllPending() {
    if (currentAIProcessing) {
        showToast('AI already processing', 'warning');
        return;
    }

    const pending = submissionsData.filter(s => s.status !== 'graded');
    if (pending.length === 0) {
        showToast('No pending submissions', 'info');
        return;
    }

    if (!confirm(`Grade ${pending.length} submissions? This may take a minute.`)) return;

    currentAIProcessing = true;
    let graded = 0, failed = 0;

    for (let i = 0; i < pending.length; i++) {
        const sub = pending[i];
        showToast(`${i + 1}/${pending.length}: ${sub.studentName}...`, 'info');

        try {
            const regrade = editingIds.has(sub._id);
            const response = await fetch(`${API_URL}/api/ai-grade/submission/${sub._id}`, {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify({ regrade, force: regrade })
            });
            const data = await response.json();
            if (data.success) {
                graded++;
                updateCardWithAIGrades(sub._id, data.aiResult);
                await new Promise(r => setTimeout(r, 500));
                await fetch(`${API_URL}/api/submissions/${sub._id}/grade`, {
                    method: 'PUT',
                    headers: authHeaders(true),
                    body: JSON.stringify({
                        scores: data.aiResult.scores,
                        feedback: data.aiResult.feedback,
                        totalScore: data.aiResult.totalScore
                    })
                });
                editingIds.delete(sub._id);
            } else {
                failed++;
            }
        } catch (err) {
            failed++;
        }
        await new Promise(r => setTimeout(r, 500));
    }

    currentAIProcessing = false;
    showToast(`Complete: ${graded} graded, ${failed} failed`, 'success');
    await loadSubmissions();
    loadNotifications();
}

function applyFilters() { renderSubmissions(); showToast('Filters applied', 'success'); }
function clearFilters() {
    if (assignmentFilter) assignmentFilter.value = 'all';
    if (gradeStatusFilter) gradeStatusFilter.value = 'all';
    renderSubmissions();
    showToast('Filters cleared', 'success');
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

// Returns { url, revoke } - handles both raw file responses and JSON { url } responses (e.g. Cloudinary)
// Returns { url, downloadUrl, revoke, meta } - handles JSON { url } responses and raw file responses
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

    // Word/PowerPoint/Excel can't be previewed in a browser tab - download instead
    if (!PREVIEWABLE_EXT.includes(meta.ext)) {
        showToast(`.${meta.ext || 'this'} files can't be previewed in the browser - downloading instead`, 'info');
        return downloadFile(submissionId, fileIndex);
    }

    // Open the tab inside the click so the popup blocker doesn't kill it
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
                <div class="modal-header">
                    <h3>Export Results</h3>
                </div>
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

    // Pick the course: from the assignment filter, the only course, or ask
    let course;
    const selectedAssignment = assignmentsData.find(a => a._id === assignmentFilter?.value);
    if (selectedAssignment) course = selectedAssignment.course;
    else if (courses.length === 1) course = courses[0];
    else course = await pickCourseModal(courses);
    if (!course) return;

    // Warn about ungraded work
    const pending = submissionsData.filter(s =>
        s.assignmentId?.course === course && s.status !== 'graded'
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

// ========== TOAST NOTIFICATION ==========
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
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : type === 'danger' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i><span>${escapeHtml(message)}</span><button class="toast-close" onclick="this.parentElement.remove()">&times;</button>`;
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
    const sidebar = document.getElementById('sidebar'), sidebarToggle = document.getElementById('sidebarToggle'), menuBtn = document.getElementById('menuBtn');
    if (sidebarToggle) sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('collapsed'));
    if (menuBtn) menuBtn.addEventListener('click', () => sidebar.classList.toggle('show'));
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 1024 && sidebar && menuBtn && !sidebar.contains(e.target) && !menuBtn.contains(e.target)) sidebar.classList.remove('show');
    });

    // Notification panel toggle
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

    document.querySelector('.logout-link')?.addEventListener('click', (e) => { e.preventDefault(); logout(); });
}

function logout() {
    localStorage.clear();
    window.location.href = 'login.html';
}

// ========== INITIALIZE ==========
document.addEventListener('DOMContentLoaded', async () => {
    initUI();
    // Clear the hard-coded mock badge/panel right away
    const badge = document.getElementById('notifCount');
    if (badge) badge.style.display = 'none';
    await loadAssignments();
    await loadSubmissions();
    await loadNotifications();
    setInterval(loadNotifications, 60000);
});

// Make functions global
window.saveDraft = saveDraft;
window.releaseGrade = releaseGrade;
window.closeGradingModal = closeGradingModal;
window.editGrade = editGrade;
window.notifyStudent = notifyStudent;
window.viewFile = viewFile;
window.downloadFile = downloadFile;
window.downloadAllSubmissions = downloadAllSubmissions;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.aiGradeSubmission = aiGradeSubmission;
window.aiGradeAllPending = aiGradeAllPending;
window.closeAISummaryModal = closeAISummaryModal;
window.acceptAIGrades = acceptAIGrades;
window.showToast = showToast;
window.logout = logout;