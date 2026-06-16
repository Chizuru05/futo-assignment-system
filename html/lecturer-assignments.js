// lecturer-assignments.js - UPDATED with active settings


// ========== TOKEN FUNCTION ==========
function getAuthToken() {
    const userRole = localStorage.getItem('userRole');
    if (!userRole) return null;
    return localStorage.getItem(`${userRole}_token`) || localStorage.getItem('token');
}

const token = getAuthToken();
const userRole = localStorage.getItem('userRole');

console.log('=== LECTURER ASSIGNMENTS ===');
console.log('Token exists:', !!token);
console.log('User role:', userRole);

if (!token || userRole !== 'lecturer') {
    window.location.href = 'login.html';
}

let currentSession = '';
let currentSemester = '';
let registeredCourses = [];
let allAssignments = [];

// DOM Elements
const existingAssignmentsDiv = document.getElementById('existingAssignments');
const courseSelect = document.getElementById('course');
const rubricList = document.getElementById('rubricList');
const addCriterionBtn = document.getElementById('addCriterionBtn');
const totalMarksInput = document.getElementById('totalMarks');
const rubricTotalSpan = document.getElementById('rubricTotal');
const totalMatchStatus = document.getElementById('totalMatchStatus');
const dueDateInput = document.getElementById('dueDate');
const form = document.getElementById('assignmentForm');

// Set default due date (14 days from now)
const today = new Date();
const twoWeeks = new Date(today);
twoWeeks.setDate(today.getDate() + 14);
if (dueDateInput) {
    dueDateInput.value = twoWeeks.toISOString().split('T')[0];
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
            
            // Update display
            const sessionInfo = document.getElementById('sessionInfo');
            if (sessionInfo) {
                sessionInfo.textContent = `${currentSession} ${currentSemester}`;
            }
            
            console.log('Active settings loaded:', currentSession, currentSemester);
        }
    } catch (error) {
        console.error('Error fetching active settings:', error);
        // Fallback to localStorage
        currentSession = localStorage.getItem('currentSession') || '2025-2026';
        currentSemester = localStorage.getItem('currentSemester') || 'Harmattan';
    }
}

// ========== FETCH REGISTERED COURSES ==========
async function fetchRegisteredCourses() {
    if (!courseSelect) return;
    
    try {
        courseSelect.innerHTML = '<option value="">Loading courses...</option>';
        
        const response = await fetch(`${API_URL}/api/lecturer/my-courses?session=${currentSession}&semester=${currentSemester}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (data.success && data.courses && data.courses.length > 0) {
            registeredCourses = data.courses;
            courseSelect.innerHTML = '<option value="">-- Select a course --</option>';
            registeredCourses.forEach(course => {
                const option = document.createElement('option');
                option.value = course.courseCode;
                option.textContent = `${course.courseCode} - ${course.courseTitle} (${course.level} Level)`;
                courseSelect.appendChild(option);
            });
        } else {
            courseSelect.innerHTML = '<option value="">No courses registered for current session. Please register first.</option>';
        }
    } catch (error) {
        console.error('Error fetching courses:', error);
        courseSelect.innerHTML = '<option value="">Error loading courses</option>';
    }
}

// ========== VIEW SUBMISSIONS ==========
function viewSubmissions(assignmentId) {
    window.location.href = `lecturer-submissions.html?assignment=${assignmentId}`;
}

// ========== LOAD EXISTING ASSIGNMENTS ==========
async function loadExistingAssignments() {
    if (!existingAssignmentsDiv) return;
    
    try {
        existingAssignmentsDiv.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i> Loading assignments...</div>';
        
        const response = await fetch(`${API_URL}/api/assignments/lecturer`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        console.log('Assignments API response:', data);
        
        let assignments = [];
        if (data.success && data.assignments) {
            assignments = data.assignments;
        }
        
        allAssignments = assignments;
        console.log(`Found ${assignments.length} assignments for ${currentSession} ${currentSemester}`);
        
        if (assignments.length === 0) {
            existingAssignmentsDiv.innerHTML = `<div class="empty-state">No assignments created yet for ${currentSession} ${currentSemester}. Create your first assignment above!</div>`;
            return;
        }
        
        existingAssignmentsDiv.innerHTML = assignments.map(assignment => `
            <div class="existing-assignment-item" data-id="${assignment._id}">
                <div class="assignment-info">
                    <div class="assignment-course">${assignment.course}</div>
                    <div class="assignment-title">${escapeHtml(assignment.title)}</div>
                    <div class="assignment-meta">Due: ${assignment.dueDate || 'N/A'} | ${assignment.totalMarks || 0} marks</div>
                    <div class="assignment-session-badge">${assignment.session || currentSession} ${assignment.semester || currentSemester}</div>
                </div>
                <div class="assignment-actions">
                    <button class="btn-icon" onclick="viewSubmissions('${assignment._id}')" title="View Submissions">
                        <i class="fa-regular fa-file"></i>
                    </button>
                    <button class="btn-icon" onclick="editAssignment('${assignment._id}')" title="Edit Assignment">
                        <i class="fa-regular fa-pen-to-square"></i>
                    </button>
                    <button class="btn-icon danger" onclick="deleteAssignment('${assignment._id}', '${escapeHtml(assignment.title)}')" title="Delete Assignment">
                        <i class="fa-regular fa-trash-can"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading assignments:', error);
        existingAssignmentsDiv.innerHTML = '<div class="empty-state">Failed to load assignments. Please refresh the page.</div>';
    }
}

// ========== EDIT ASSIGNMENT ==========
async function editAssignment(assignmentId) {
    try {
        const response = await fetch(`${API_URL}/api/assignments/${assignmentId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (data.success && data.assignment) {
            const assignment = data.assignment;
            
            courseSelect.value = assignment.course;
            document.getElementById('title').value = assignment.title;
            document.getElementById('dueDate').value = assignment.dueDateISO;
            document.getElementById('dueTime').value = assignment.dueTime;
            totalMarksInput.value = assignment.totalMarks;
            document.getElementById('description').value = assignment.description || '';
            document.getElementById('allowMultiple').checked = assignment.allowMultiple !== false;
            document.getElementById('allowLate').checked = assignment.allowLate !== false;
            
            if (assignment.rubric && assignment.rubric.length > 0) {
                rubricList.innerHTML = '';
                assignment.rubric.forEach(criterion => {
                    addRubricItem(criterion.name, criterion.maxScore);
                });
                updateRubricTotal();
            }
            
            const submitBtn = document.getElementById('submitBtn');
            submitBtn.innerHTML = '<i class="fa-solid fa-save"></i> Update Assignment';
            submitBtn.onclick = () => updateAssignment(assignmentId);
            
            showToast('Edit mode enabled. Update the assignment and click Update.', 'info');
            document.querySelector('.form-card').scrollIntoView({ behavior: 'smooth' });
        }
    } catch (error) {
        console.error('Error loading assignment for edit:', error);
        showToast('Failed to load assignment details', 'danger');
    }
}

async function updateAssignment(assignmentId) {
    const courseCode = courseSelect.value;
    const title = document.getElementById('title').value;
    const dueDateVal = document.getElementById('dueDate').value;
    const dueTimeVal = document.getElementById('dueTime').value;
    const totalMarks = parseInt(totalMarksInput.value) || 0;
    const description = document.getElementById('description').value;
    const allowMultiple = document.getElementById('allowMultiple')?.checked || true;
    const allowLate = document.getElementById('allowLate')?.checked || true;
    
    const rubric = [];
    document.querySelectorAll('.rubric-item').forEach(item => {
        const name = item.querySelector('.criterion-name')?.value;
        const maxScore = parseInt(item.querySelector('.criterion-max')?.value) || 0;
        if (name && name.trim() && maxScore > 0) {
            rubric.push({ name: name.trim(), maxScore });
        }
    });
    
    const dueDateObj = new Date(dueDateVal);
    const formattedDueDate = dueDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    const assignmentData = {
        course: courseCode,
        title: title.trim(),
        description: description.trim(),
        dueDate: formattedDueDate,
        dueDateISO: dueDateVal,
        dueTime: dueTimeVal,
        totalMarks: totalMarks,
        rubric: rubric,
        allowMultipleFiles: allowMultiple,
        allowLateSubmissions: allowLate,
        session: currentSession,
        semester: currentSemester
    };
    
    const submitBtn = document.getElementById('submitBtn');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';
    
    try {
        const response = await fetch(`${API_URL}/api/assignments/${assignmentId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(assignmentData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`âœ… Assignment updated successfully!`, 'success');
            resetToCreateMode();
            loadExistingAssignments();
        } else {
            showToast(data.message || 'Failed to update assignment', 'danger');
        }
    } catch (error) {
        console.error('Error updating assignment:', error);
        showToast('Failed to update assignment', 'danger');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

// ========== DELETE ASSIGNMENT ==========
async function deleteAssignment(assignmentId, assignmentTitle) {
    if (!confirm(`Are you sure you want to delete "${assignmentTitle}"? This action cannot be undone.`)) return;
    
    try {
        const response = await fetch(`${API_URL}/api/assignments/${assignmentId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`âœ… Assignment deleted successfully!`, 'success');
            loadExistingAssignments();
        } else {
            showToast(data.message || 'Failed to delete assignment', 'danger');
        }
    } catch (error) {
        console.error('Error deleting assignment:', error);
        showToast('Failed to delete assignment', 'danger');
    }
}

// ========== CREATE ASSIGNMENT ==========
async function createAssignment(e) {
    e.preventDefault();
    
    const courseCode = courseSelect.value;
    const title = document.getElementById('title').value;
    const dueDateVal = document.getElementById('dueDate').value;
    const dueTimeVal = document.getElementById('dueTime').value;
    const totalMarks = parseInt(totalMarksInput.value) || 0;
    const description = document.getElementById('description').value;
    const allowMultiple = document.getElementById('allowMultiple')?.checked || true;
    const allowLate = document.getElementById('allowLate')?.checked || true;
    
    if (!courseCode) {
        showToast('Please select a course', 'warning');
        return;
    }
    
    if (!title) {
        showToast('Please enter assignment title', 'warning');
        return;
    }
    
    if (!dueDateVal || !dueTimeVal) {
        showToast('Please select due date and time', 'warning');
        return;
    }
    
    if (totalMarks <= 0 || totalMarks > 100) {
        showToast('Please set total marks between 1 and 100', 'warning');
        return;
    }
    
    const rubric = [];
    let rubricTotal = 0;
    document.querySelectorAll('.rubric-item').forEach(item => {
        const name = item.querySelector('.criterion-name')?.value;
        const maxScore = parseInt(item.querySelector('.criterion-max')?.value) || 0;
        if (name && name.trim() && maxScore > 0) {
            rubric.push({ name: name.trim(), maxScore });
            rubricTotal += maxScore;
        }
    });
    
    if (rubric.length === 0) {
        showToast('Please add at least one rubric criterion', 'warning');
        return;
    }
    
    if (rubricTotal !== totalMarks) {
        showToast(`Rubric total (${rubricTotal}) does not match total marks (${totalMarks})`, 'warning');
        return;
    }
    
    const dueDateObj = new Date(dueDateVal);
    const formattedDueDate = dueDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    const assignmentData = {
        course: courseCode,
        courseName: courseCode,
        title: title.trim(),
        description: description.trim(),
        dueDate: formattedDueDate,
        dueDateISO: dueDateVal,
        dueTime: dueTimeVal,
        totalMarks: totalMarks,
        rubric: rubric,
        allowMultipleFiles: allowMultiple,
        allowLateSubmissions: allowLate,
        session: currentSession,
        semester: currentSemester
    };
    
    const submitBtn = document.getElementById('submitBtn');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating...';
    
    try {
        const response = await fetch(`${API_URL}/api/assignments`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(assignmentData)
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showToast(`âœ… Assignment "${title}" created successfully for ${currentSession} ${currentSemester}!`, 'success');
            
            form.reset();
            if (dueDateInput) dueDateInput.value = new Date(Date.now() + 14*24*60*60*1000).toISOString().split('T')[0];
            document.getElementById('dueTime').value = '23:59';
            document.getElementById('allowMultiple').checked = true;
            document.getElementById('allowLate').checked = true;
            totalMarksInput.value = '100';
            
            rubricList.innerHTML = '';
            addRubricItem('Criterion 1', 50);
            addRubricItem('Criterion 2', 30);
            addRubricItem('Criterion 3', 20);
            updateRubricTotal();
            
            loadExistingAssignments();
        } else {
            showToast(data.message || 'Failed to create assignment', 'danger');
        }
    } catch (error) {
        console.error('Error creating assignment:', error);
        showToast('Failed to connect to server. Make sure backend is running.', 'danger');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

function resetToCreateMode() {
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.innerHTML = '<i class="fa-solid fa-save"></i> Create Assignment';
    submitBtn.onclick = createAssignment;
    
    form.reset();
    if (dueDateInput) dueDateInput.value = twoWeeks.toISOString().split('T')[0];
    document.getElementById('dueTime').value = '23:59';
    document.getElementById('allowMultiple').checked = true;
    document.getElementById('allowLate').checked = true;
    totalMarksInput.value = '100';
    
    rubricList.innerHTML = '';
    addRubricItem('Criterion 1', 50);
    addRubricItem('Criterion 2', 30);
    addRubricItem('Criterion 3', 20);
    updateRubricTotal();
}

// ===== RUBRIC FUNCTIONS =====
function addRubricItem(name = '', maxScore = 10) {
    const newItem = document.createElement('div');
    newItem.className = 'rubric-item';
    newItem.innerHTML = `
        <div class="rubric-criterion">
            <input type="text" class="criterion-name" placeholder="Criterion name" value="${escapeHtml(name)}">
            <div class="criterion-score">
                <input type="number" class="criterion-max" placeholder="Max" value="${maxScore}" min="1" max="100" step="1">
                <span>pts</span>
            </div>
            <button type="button" class="remove-criterion" title="Remove criterion">
                <i class="fa-solid fa-trash-alt"></i>
            </button>
        </div>
    `;
    rubricList.appendChild(newItem);
    attachRubricEventListeners();
    updateRubricTotal();
}

function updateRubricTotal() {
    let total = 0;
    document.querySelectorAll('.criterion-max').forEach(input => {
        total += parseInt(input.value) || 0;
    });
    if (rubricTotalSpan) rubricTotalSpan.textContent = total;
    
    const assignmentTotal = parseInt(totalMarksInput.value) || 0;
    if (total === assignmentTotal && total > 0) {
        totalMatchStatus.textContent = 'âœ“ Matches total marks';
        totalMatchStatus.className = 'status-badge success';
    } else {
        totalMatchStatus.textContent = `âš ï¸ Does not match total marks (${total}/${assignmentTotal})`;
        totalMatchStatus.className = 'status-badge warning';
    }
}

function attachRubricEventListeners() {
    document.querySelectorAll('.remove-criterion').forEach(btn => {
        btn.removeEventListener('click', handleRemoveCriterion);
        btn.addEventListener('click', handleRemoveCriterion);
    });
    
    document.querySelectorAll('.criterion-max').forEach(input => {
        input.removeEventListener('input', updateRubricTotal);
        input.addEventListener('input', updateRubricTotal);
    });
}

function handleRemoveCriterion(e) {
    const item = e.currentTarget.closest('.rubric-item');
    if (item && document.querySelectorAll('.rubric-item').length > 1) {
        item.remove();
        updateRubricTotal();
    } else {
        showToast('You must have at least one rubric criterion', 'warning');
    }
}

// ===== UTILITY FUNCTIONS =====
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function showToast(message, type = 'success') {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999;';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    const colors = { success: '#2a7a4b', danger: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };
    toast.style.cssText = `background: white; border-radius: 8px; padding: 12px 20px; margin-bottom: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: flex; align-items: center; gap: 10px; border-left: 4px solid ${colors[type] || colors.success};`;
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i><span>${message}</span><button onclick="this.parentElement.remove()" style="background: none; border: none; font-size: 1.2rem; cursor: pointer;">Ã—</button>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ===== INITIALIZE =====
if (addCriterionBtn) {
    addCriterionBtn.addEventListener('click', () => addRubricItem());
}

if (totalMarksInput) {
    totalMarksInput.addEventListener('input', updateRubricTotal);
}

if (form) {
    form.addEventListener('submit', createAssignment);
}

attachRubricEventListeners();
updateRubricTotal();

document.addEventListener('DOMContentLoaded', async () => {
    await fetchActiveSettings();
    await fetchRegisteredCourses();
    await loadExistingAssignments();
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.clear();
            window.location.href = 'login.html';
        });
    }
    
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const menuBtn = document.getElementById('menuBtn');
    if (sidebarToggle) sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('collapsed'));
    if (menuBtn) menuBtn.addEventListener('click', () => sidebar.classList.toggle('show'));
    
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark');
            localStorage.setItem('futoTheme', document.body.classList.contains('dark') ? 'dark' : 'light');
        });
        if (localStorage.getItem('futoTheme') === 'dark') document.body.classList.add('dark');
    }
});

// Make functions global
window.deleteAssignment = deleteAssignment;
window.viewSubmissions = viewSubmissions;
window.editAssignment = editAssignment;
window.showToast = showToast;
