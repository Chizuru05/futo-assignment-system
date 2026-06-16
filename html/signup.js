// signup.js


// Role switching
let currentRole = 'student';

document.getElementById('studentRoleBtn').addEventListener('click', () => {
    currentRole = 'student';
    document.getElementById('studentRoleBtn').classList.add('active');
    document.getElementById('lecturerRoleBtn').classList.remove('active');
    document.getElementById('adminRoleBtn').classList.remove('active');
    document.getElementById('studentForm').classList.add('active');
    document.getElementById('lecturerForm').classList.remove('active');
    document.getElementById('adminForm').classList.remove('active');
    resetForm('student');
});

document.getElementById('lecturerRoleBtn').addEventListener('click', () => {
    currentRole = 'lecturer';
    document.getElementById('lecturerRoleBtn').classList.add('active');
    document.getElementById('studentRoleBtn').classList.remove('active');
    document.getElementById('adminRoleBtn').classList.remove('active');
    document.getElementById('lecturerForm').classList.add('active');
    document.getElementById('studentForm').classList.remove('active');
    document.getElementById('adminForm').classList.remove('active');
    resetForm('lecturer');
});

document.getElementById('adminRoleBtn').addEventListener('click', () => {
    currentRole = 'admin';
    document.getElementById('adminRoleBtn').classList.add('active');
    document.getElementById('studentRoleBtn').classList.remove('active');
    document.getElementById('lecturerRoleBtn').classList.remove('active');
    document.getElementById('adminForm').classList.add('active');
    document.getElementById('studentForm').classList.remove('active');
    document.getElementById('lecturerForm').classList.remove('active');
    resetForm('admin');
});

// Password toggle for all forms
document.querySelectorAll('.password-toggle').forEach(btn => {
    btn.addEventListener('click', function() {
        const targetId = this.getAttribute('data-target');
        const input = document.getElementById(targetId);
        const icon = this.querySelector('i');
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    });
});

// ============ STUDENT FORM ============
let studentStep = 0;
const studentSteps = document.querySelectorAll('#studentForm .form-step');
const studentProgress = document.querySelectorAll('#studentForm .progress-step');

function showStudentStep(step) {
    studentSteps.forEach((s, i) => s.classList.toggle('active', i === step));
    studentProgress.forEach((p, i) => {
        p.classList.toggle('active', i === step);
        if (i < step) p.classList.add('completed');
        else p.classList.remove('completed');
    });
    document.getElementById('studentPrevBtn').disabled = step === 0;
    const isLast = step === studentSteps.length - 1;
    document.getElementById('studentNextBtn').style.display = isLast ? 'none' : 'flex';
    document.getElementById('studentSubmitBtn').style.display = isLast ? 'flex' : 'none';
}

document.getElementById('studentNextBtn').addEventListener('click', () => {
    if (validateStudentStep(studentStep)) {
        if (studentStep < studentSteps.length - 1) {
            studentStep++;
            showStudentStep(studentStep);
        }
    }
});

document.getElementById('studentPrevBtn').addEventListener('click', () => {
    if (studentStep > 0) {
        studentStep--;
        showStudentStep(studentStep);
    }
});

function validateStudentStep(step) {
    if (step === 0) {
        const matric = document.getElementById('studentMatric').value;
        const name = document.getElementById('studentName').value;
        const email = document.getElementById('studentEmail').value;
        const level = document.getElementById('studentLevel').value;
        let valid = true;
        if (!matric) { showError('studentMatricError', 'Matric number required'); valid = false; }
        if (!name) { showError('studentNameError', 'Full name required'); valid = false; }
        if (!email) { showError('studentEmailError', 'Email required'); valid = false; }
        if (!level) { showError('studentLevelError', 'Level required'); valid = false; }
        return valid;
    } else if (step === 1) {
        const password = document.getElementById('studentPassword').value;
        const confirm = document.getElementById('studentConfirmPassword').value;
        const terms = document.getElementById('studentTerms').checked;
        let valid = true;
        if (password.length < 8) { showError('studentPasswordError', 'Password must be at least 8 characters'); valid = false; }
        if (password !== confirm) { showError('studentConfirmError', 'Passwords do not match'); valid = false; }
        if (!terms) { showToast('Please accept the Terms and Conditions', 'warning'); valid = false; }
        return valid;
    }
    return true;
}

document.getElementById('studentSubmitBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    if (!validateStudentStep(1)) return;
    
    const data = {
        fullName: document.getElementById('studentName').value,
        email: document.getElementById('studentEmail').value,
        password: document.getElementById('studentPassword').value,
        role: 'student',
        matricNumber: document.getElementById('studentMatric').value,
        level: document.getElementById('studentLevel').value
    };
    await registerUser(data, 'student');
});

// ============ LECTURER FORM ============
let lecturerStep = 0;
const lecturerSteps = document.querySelectorAll('#lecturerForm .form-step');
const lecturerProgress = document.querySelectorAll('#lecturerForm .progress-step');

function showLecturerStep(step) {
    lecturerSteps.forEach((s, i) => s.classList.toggle('active', i === step));
    lecturerProgress.forEach((p, i) => {
        p.classList.toggle('active', i === step);
        if (i < step) p.classList.add('completed');
        else p.classList.remove('completed');
    });
    document.getElementById('lecturerPrevBtn').disabled = step === 0;
    const isLast = step === lecturerSteps.length - 1;
    document.getElementById('lecturerNextBtn').style.display = isLast ? 'none' : 'flex';
    document.getElementById('lecturerSubmitBtn').style.display = isLast ? 'flex' : 'none';
}

document.getElementById('lecturerNextBtn').addEventListener('click', () => {
    if (validateLecturerStep(lecturerStep)) {
        if (lecturerStep < lecturerSteps.length - 1) {
            lecturerStep++;
            showLecturerStep(lecturerStep);
        }
    }
});

document.getElementById('lecturerPrevBtn').addEventListener('click', () => {
    if (lecturerStep > 0) {
        lecturerStep--;
        showLecturerStep(lecturerStep);
    }
});

function validateLecturerStep(step) {
    if (step === 0) {
        const staffId = document.getElementById('lecturerStaffId').value;
        const name = document.getElementById('lecturerName').value;
        const email = document.getElementById('lecturerEmail').value;
        const rank = document.getElementById('lecturerRank').value;
        let valid = true;
        if (!staffId) { showError('lecturerStaffIdError', 'Staff ID required'); valid = false; }
        if (!name) { showError('lecturerNameError', 'Full name required'); valid = false; }
        if (!email) { showError('lecturerEmailError', 'Email required'); valid = false; }
        if (!rank) { showError('lecturerRankError', 'Rank required'); valid = false; }
        return valid;
    } else if (step === 1) {
        const password = document.getElementById('lecturerPassword').value;
        const confirm = document.getElementById('lecturerConfirmPassword').value;
        const terms = document.getElementById('lecturerTerms').checked;
        let valid = true;
        if (password.length < 8) { showError('lecturerPasswordError', 'Password must be at least 8 characters'); valid = false; }
        if (password !== confirm) { showError('lecturerConfirmError', 'Passwords do not match'); valid = false; }
        if (!terms) { showToast('Please accept the Terms and Conditions', 'warning'); valid = false; }
        return valid;
    }
    return true;
}

document.getElementById('lecturerSubmitBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    if (!validateLecturerStep(1)) return;
    
    const data = {
        fullName: document.getElementById('lecturerName').value,
        email: document.getElementById('lecturerEmail').value,
        password: document.getElementById('lecturerPassword').value,
        role: 'lecturer',
        staffId: document.getElementById('lecturerStaffId').value,
        rank: document.getElementById('lecturerRank').value
    };
    await registerUser(data, 'lecturer');
});

// ============ ADMIN FORM ============
let adminStep = 0;
const adminSteps = document.querySelectorAll('#adminForm .form-step');
const adminProgress = document.querySelectorAll('#adminForm .progress-step');

function showAdminStep(step) {
    adminSteps.forEach((s, i) => s.classList.toggle('active', i === step));
    adminProgress.forEach((p, i) => {
        p.classList.toggle('active', i === step);
        if (i < step) p.classList.add('completed');
        else p.classList.remove('completed');
    });
    document.getElementById('adminPrevBtn').disabled = step === 0;
    const isLast = step === adminSteps.length - 1;
    document.getElementById('adminNextBtn').style.display = isLast ? 'none' : 'flex';
    document.getElementById('adminSubmitBtn').style.display = isLast ? 'flex' : 'none';
}

document.getElementById('adminNextBtn').addEventListener('click', () => {
    if (validateAdminStep(adminStep)) {
        if (adminStep < adminSteps.length - 1) {
            adminStep++;
            showAdminStep(adminStep);
        }
    }
});

document.getElementById('adminPrevBtn').addEventListener('click', () => {
    if (adminStep > 0) {
        adminStep--;
        showAdminStep(adminStep);
    }
});

function validateAdminStep(step) {
    if (step === 0) {
        const name = document.getElementById('adminName').value;
        const email = document.getElementById('adminEmail').value;
        let valid = true;
        if (!name) { showError('adminNameError', 'Full name required'); valid = false; }
        if (!email) { showError('adminEmailError', 'Email required'); valid = false; }
        return valid;
    } else if (step === 1) {
        const password = document.getElementById('adminPassword').value;
        const confirm = document.getElementById('adminConfirmPassword').value;
        const terms = document.getElementById('adminTerms').checked;
        let valid = true;
        if (password.length < 8) { showError('adminPasswordError', 'Password must be at least 8 characters'); valid = false; }
        if (password !== confirm) { showError('adminConfirmError', 'Passwords do not match'); valid = false; }
        if (!terms) { showToast('Please accept the Terms and Conditions', 'warning'); valid = false; }
        return valid;
    }
    return true;
}

document.getElementById('adminSubmitBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    if (!validateAdminStep(1)) return;
    
    const data = {
        fullName: document.getElementById('adminName').value,
        email: document.getElementById('adminEmail').value,
        password: document.getElementById('adminPassword').value,
        role: 'admin',
        department: document.getElementById('adminDepartment').value
    };
    await registerUser(data, 'admin');
});

// ============ REGISTER USER FUNCTION ============
async function registerUser(userData, role) {
    const submitBtn = document.getElementById(`${role}SubmitBtn`);
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating account...';
    
    try {
        const response = await fetch(`${API_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`${role.charAt(0).toUpperCase() + role.slice(1)} account created successfully!`, 'success');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        } else {
            showToast(data.message || 'Registration failed', 'danger');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    } catch (error) {
        console.error('Registration error:', error);
        showToast('Cannot connect to server. Make sure backend is running.', 'danger');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

// ============ HELPER FUNCTIONS ============
function showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) el.textContent = message;
    setTimeout(() => {
        if (el) el.textContent = '';
    }, 3000);
}

function showToast(message, type = 'success') {
    let container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i><span>${message}</span><button onclick="this.parentElement.remove()">Ã—</button>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function resetForm(role) {
    if (role === 'student') {
        studentStep = 0;
        showStudentStep(0);
        document.getElementById('studentForm').reset();
        clearErrors('student');
    } else if (role === 'lecturer') {
        lecturerStep = 0;
        showLecturerStep(0);
        document.getElementById('lecturerForm').reset();
        clearErrors('lecturer');
    } else if (role === 'admin') {
        adminStep = 0;
        showAdminStep(0);
        document.getElementById('adminForm').reset();
        clearErrors('admin');
        document.getElementById('adminDepartment').value = 'Information Technology';
    }
}

function clearErrors(role) {
    document.querySelectorAll(`#${role}Form .error-message`).forEach(el => el.textContent = '');
}

// Initialize
showStudentStep(0);
showLecturerStep(0);
showAdminStep(0);
