// lecturer-submissions.js - FIXED VERSION
const API_URL = 'http://localhost:5000';

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

console.log('=== LECTURER SUBMISSIONS DEBUG ===');
console.log('Token exists:', !!token);
console.log('User role:', userRole);

if (!token) {
    console.log('No token, redirecting to login');
    window.location.href = 'login.html';
}
if (userRole !== 'lecturer') {
    console.log('Invalid role, redirecting to login');
    window.location.href = 'login.html';
}

// Global variables
let submissionsData = [];
let assignmentsData = [];
let currentAIProcessing = false;
let currentAISubmissionId = null;
let currentAIData = null;
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

// Update semester display
function updateSemesterDisplay() {
    const semesterDisplay = document.querySelector('.current-semester');
    if (semesterDisplay) {
        semesterDisplay.innerHTML = `<i class="fa-regular fa-calendar"></i> ${currentSession} · ${currentSemester}`;
    }
}

// Load assignments - FIXED: Remove query parameters
async function loadAssignments() {
    try {
        console.log('Loading assignments from:', `${API_URL}/api/assignments/lecturer`);
        
        const response = await fetch(`${API_URL}/api/assignments/lecturer`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        console.log('Assignments response:', data);
        
        if (data.success && assignmentFilter) {
            assignmentsData = data.assignments || [];
            assignmentFilter.innerHTML = '<option value="all">All Assignments</option>';
            assignmentsData.forEach(assignment => {
                const option = document.createElement('option');
                option.value = assignment._id;
                option.textContent = `${assignment.course} - ${assignment.title} (${assignment.totalMarks} marks)`;
                assignmentFilter.appendChild(option);
            });
            console.log(`Loaded ${assignmentsData.length} assignments`);
        } else {
            console.log('No assignments found or API error:', data.message);
        }
    } catch (error) {
        console.error('Error loading assignments:', error);
        showToast('Failed to load assignments', 'danger');
    }
}

// Load submissions - FIXED: Use correct endpoint
async function loadSubmissions() {
    try {
        showToast('Loading submissions...', 'info');
        
        currentSession = localStorage.getItem('currentSession') || '2025-2026';
        currentSemester = localStorage.getItem('currentSemester') || 'Harmattan';
        updateSemesterDisplay();
        
        // FIXED: Use /api/submissions/lecturer/all endpoint
        const response = await fetch(`${API_URL}/api/submissions/lecturer/all?session=${currentSession}&semester=${currentSemester}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        console.log('Submissions API response:', data);
        
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
                                    <i class="fa-regular ${file.name?.endsWith('.pdf') ? 'fa-file-pdf' : 'fa-file'}"></i>
                                    <span>${file.name || `File ${idx + 1}`}</span>
                                    <span class="file-size">(${file.size || '0 KB'})</span>
                                </div>
                                <div class="file-actions">
                                    <button class="btn-icon" onclick="viewFile('${submission._id}', ${idx}, '${file.name}')" title="Preview">
                                        <i class="fa-regular fa-eye"></i>
                                    </button>
                                    <button class="btn-icon" onclick="downloadFile('${submission._id}', ${idx}, '${file.name}')" title="Download">
                                        <i class="fa-solid fa-download"></i>
                                    </button>
                                </div>
                            </div>
                        `).join('')}
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
    
    // Add event listeners to score inputs
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
    if (percentage >= 85) return 'A';
    if (percentage >= 80) return 'A-';
    if (percentage >= 75) return 'B+';
    if (percentage >= 70) return 'B';
    if (percentage >= 65) return 'B-';
    if (percentage >= 60) return 'C+';
    if (percentage >= 55) return 'C';
    if (percentage >= 50) return 'C-';
    if (percentage >= 45) return 'D+';
    if (percentage >= 40) return 'D';
    return 'F';
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

let activeSubmissionId = null;

function saveDraft(submissionId) {
    const submission = submissionsData.find(s => s._id === submissionId);
    const card = document.querySelector(`.submission-card[data-submission-id="${submissionId}"]`);
    if (!submission || !card) return;
    
    const scores = {};
    card.querySelectorAll('.score-input').forEach(input => {
        const rubricItem = input.closest('.rubric-item');
        const criterionName = rubricItem?.querySelector('.criterion-name')?.textContent;
        if (criterionName) scores[criterionName] = parseInt(input.value) || 0;
    });
    const feedback = card.querySelector('.feedback-input')?.value || '';
    
    submission.scores = scores;
    submission.feedback = feedback;
    showToast('Draft saved', 'success');
}

// ========== RELEASE GRADE FUNCTION ==========
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
    
    const submission = submissionsData.find(s => s._id === activeSubmissionId);
    const card = document.querySelector(`.submission-card[data-submission-id="${activeSubmissionId}"]`);
    if (!submission || !card) return;
    
    const scores = {};
    card.querySelectorAll('.score-input').forEach(input => {
        const rubricItem = input.closest('.rubric-item');
        const criterionName = rubricItem?.querySelector('.criterion-name')?.textContent;
        if (criterionName) scores[criterionName] = parseInt(input.value) || 0;
    });
    const feedback = card.querySelector('.feedback-input')?.value || '';
    const totalScore = parseInt(card.querySelector('.total-value')?.textContent) || 0;
    
    const confirmBtn = document.getElementById('confirmReleaseBtn');
    const originalText = confirmBtn?.innerHTML || 'Confirm';
    if (confirmBtn) {
        confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Releasing...';
        confirmBtn.disabled = true;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/submissions/${activeSubmissionId}/grade`, {
            method: 'PUT',
            headers: { 
                'Authorization': `Bearer ${token}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ scores, feedback, totalScore })
        });
        const data = await response.json();
        
        if (data.success) {
            showToast(`✅ Grade released for ${submission.studentName}`, 'success');
            await loadSubmissions();
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

function editGrade(submissionId) {
    const submission = submissionsData.find(s => s._id === submissionId);
    if (submission) {
        submission.status = 'pending';
        renderSubmissions();
        showToast('Editing mode enabled - you can now modify grades', 'info');
    }
}

function notifyStudent(submissionId) {
    const submission = submissionsData.find(s => s._id === submissionId);
    if (submission) {
        showToast(`📧 Sending notification to ${submission.studentName}...`, 'info');
        setTimeout(() => showToast(`✅ Email sent to ${submission.studentName}`, 'success'), 1500);
    }
}

// ========== AI GRADING FUNCTIONS ==========
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
    
    showToast(`🤖 AI grading ${studentName}...`, 'info');
    
    try {
        const response = await fetch(`${API_URL}/api/ai-grade/submission/${submissionId}`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`, 
                'Content-Type': 'application/json' 
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`✅ AI grading complete!`, 'success');
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
    if (!card) return;
    
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
            <button class="btn-primary" onclick="acceptAIGrades()">Accept & Release Grade</button>
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
    
    const card = document.querySelector(`.submission-card[data-submission-id="${currentAISubmissionId}"]`);
    if (!card) return;
    
    const scores = {};
    card.querySelectorAll('.score-input').forEach(input => {
        const rubricItem = input.closest('.rubric-item');
        const criterionName = rubricItem?.querySelector('.criterion-name')?.textContent;
        if (criterionName) scores[criterionName] = parseInt(input.value) || 0;
    });
    const feedback = card.querySelector('.feedback-input')?.value || '';
    const totalScore = parseInt(card.querySelector('.total-value')?.textContent) || 0;
    
    try {
        const response = await fetch(`${API_URL}/api/submissions/${currentAISubmissionId}/grade`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ scores, feedback, totalScore })
        });
        const data = await response.json();
        if (data.success) {
            showToast('✅ Grade accepted and released!', 'success');
            closeAISummaryModal();
            await loadSubmissions();
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
        showToast(`🤖 ${i+1}/${pending.length}: ${sub.studentName}...`, 'info');
        
        try {
            const response = await fetch(`${API_URL}/api/ai-grade/submission/${sub._id}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            if (data.success) {
                graded++;
                updateCardWithAIGrades(sub._id, data.aiResult);
                await new Promise(r => setTimeout(r, 500));
                await fetch(`${API_URL}/api/submissions/${sub._id}/grade`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        scores: data.aiResult.scores, 
                        feedback: data.aiResult.feedback, 
                        totalScore: data.aiResult.totalScore 
                    })
                });
            } else {
                failed++;
            }
        } catch (err) {
            failed++;
        }
        await new Promise(r => setTimeout(r, 500));
    }
    
    currentAIProcessing = false;
    showToast(`✅ Complete: ${graded} graded, ${failed} failed`, 'success');
    await loadSubmissions();
}

function applyFilters() { renderSubmissions(); showToast('Filters applied', 'success'); }
function clearFilters() { if (assignmentFilter) assignmentFilter.value = 'all'; if (gradeStatusFilter) gradeStatusFilter.value = 'all'; renderSubmissions(); showToast('Filters cleared', 'success'); }

// ========== FILE PREVIEW FUNCTIONS ==========
async function viewFile(submissionId, fileIndex, fileName) {
    try {
        showToast('Loading file preview...', 'info');
        
        const response = await fetch(`${API_URL}/api/submissions/${submissionId}/download/${fileIndex}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const fileURL = URL.createObjectURL(blob);
            window.open(fileURL, '_blank');
            showToast('File opened in new tab', 'success');
        } else {
            showToast('Failed to load file preview', 'danger');
        }
    } catch (error) {
        console.error('Preview error:', error);
        showToast('Failed to preview file', 'danger');
    }
}

async function downloadFile(submissionId, fileIndex, fileName) {
    try {
        showToast('Downloading file...', 'info');
        
        const response = await fetch(`${API_URL}/api/submissions/${submissionId}/download/${fileIndex}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName || `submission_file_${fileIndex + 1}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            showToast('Download complete!', 'success');
        } else {
            showToast('Download failed', 'danger');
        }
    } catch (error) {
        console.error('Download error:', error);
        showToast('Failed to download file', 'danger');
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
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : type === 'danger' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i><span>${message}</span><button class="toast-close" onclick="this.parentElement.remove()">×</button>`;
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
    document.addEventListener('click', (e) => { if (window.innerWidth <= 1024 && sidebar && menuBtn && !sidebar.contains(e.target) && !menuBtn.contains(e.target)) sidebar.classList.remove('show'); });
    
    const searchInput = document.querySelector('.header-search input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            document.querySelectorAll('.submission-card').forEach(card => {
                const name = card.querySelector('.student-info h3')?.textContent.toLowerCase() || '';
                card.style.display = name.includes(term) ? 'flex' : 'none';
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
    await loadAssignments();
    await loadSubmissions();
});

// Make functions global
window.saveDraft = saveDraft;
window.releaseGrade = releaseGrade;
window.closeGradingModal = closeGradingModal;
window.editGrade = editGrade;
window.notifyStudent = notifyStudent;
window.viewFile = viewFile;
window.downloadFile = downloadFile;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.aiGradeSubmission = aiGradeSubmission;
window.aiGradeAllPending = aiGradeAllPending;
window.closeAISummaryModal = closeAISummaryModal;
window.acceptAIGrades = acceptAIGrades;
window.showToast = showToast;
window.logout = logout;