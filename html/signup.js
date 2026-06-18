// signup.js - Student Only Signup
console.log('signup.js loaded, API_URL:', API_URL);

// DOM Elements
const studentForm = document.getElementById('studentForm');
const studentSubmitBtn = document.getElementById('studentSubmitBtn');

// Password toggle
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

// Step Navigation
let currentStep = 0;
const steps = document.querySelectorAll('.form-step');
const progressSteps = document.querySelectorAll('.progress-step');
const progressFill = document.querySelector('.progress-fill');
const nextBtn = document.getElementById('studentNextBtn');
const prevBtn = document.getElementById('studentPrevBtn');

function showStep(step) {
    steps.forEach((s, i) => {
        s.classList.toggle('active', i === step);
    });
    progressSteps.forEach((p, i) => {
        p.classList.toggle('active', i === step);
        if (i < step) p.classList.add('completed');
        else p.classList.remove('completed');
    });
    const progressPercent = ((step + 1) / steps.length) * 100;
    progressFill.style.width = progressPercent + '%';
    prevBtn.style.display = step === 0 ? 'none' : 'inline-flex';
    nextBtn.style.display = step === steps.length - 1 ? 'none' : 'inline-flex';
    studentSubmitBtn.style.display = step === steps.length - 1 ? 'inline-flex' : 'none';
}

nextBtn.addEventListener('click', () => {
    if (validateStep(currentStep)) {
        if (currentStep < steps.length - 1) {
            currentStep++;
            showStep(currentStep);
        }
    }
});

prevBtn.addEventListener('click', () => {
    if (currentStep > 0) {
        currentStep--;
        showStep(currentStep);
    }
});

// Validation Functions
function validateField(id, errorId, message) {
    const field = document.getElementById(id);
    const error = document.getElementById(errorId);
    if (!field.value.trim()) {
        field.classList.add('error');
        error.textContent = message;
        return false;
    } else {
        field.classList.remove('error');
        error.textContent = '';
        return true;
    }
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePassword(password) {
    return password.length >= 8 && 
           /[a-z]/.test(password) && 
           /[A-Z]/.test(password) && 
           /[0-9]/.test(password);
}

// ========== MATRIC NUMBER VALIDATION - FIXED ==========
function validateMatric(matric) {
    // Format: Year (4 digits) + Department code (2 digits) + Number (5+ digits)
    // Must end with 2 for Information Technology department
    // Example: 20211263362 (2021 + 12 + 63362)
    
    // Must be at least 11 digits
    if (matric.length < 11) {
        return { valid: false, message: 'Matric number must be at least 11 digits (e.g., 20211263362)' };
    }
    
    // Must be all numbers
    if (!/^[0-9]+$/.test(matric)) {
        return { valid: false, message: 'Matric number must contain only numbers' };
    }
    
    // Check if it ends with 2 (IT department identifier)
    if (!matric.endsWith('2')) {
        return { valid: false, message: 'Invalid matric number. Must end with 2 for IT department' };
    }
    
    // Extract year (first 4 digits)
    const year = parseInt(matric.substring(0, 4));
    const currentYear = new Date().getFullYear();
    
    if (year < 2010 || year > currentYear) {
        return { valid: false, message: `Invalid admission year. Must be between 2010 and ${currentYear}` };
    }
    
    return { valid: true, message: '' };
}

function validateStep(step) {
    if (step === 0) {
        let isValid = true;

        // Registration Number - FIXED
        const matric = document.getElementById('studentMatric');
        const matricValue = matric.value.trim();
        if (!matricValue) {
            matric.classList.add('error');
            document.getElementById('studentMatricError').textContent = 'Registration number required';
            isValid = false;
        } else {
            const result = validateMatric(matricValue);
            if (!result.valid) {
                matric.classList.add('error');
                document.getElementById('studentMatricError').textContent = result.message;
                isValid = false;
            } else {
                matric.classList.remove('error');
                document.getElementById('studentMatricError').textContent = '';
            }
        }

        // Full Name
        if (!validateField('studentName', 'studentNameError', 'Full name required')) {
            isValid = false;
        }

        // Email
        const email = document.getElementById('studentEmail').value.trim();
        if (!email) {
            document.getElementById('studentEmail').classList.add('error');
            document.getElementById('studentEmailError').textContent = 'Email required';
            isValid = false;
        } else if (!validateEmail(email)) {
            document.getElementById('studentEmail').classList.add('error');
            document.getElementById('studentEmailError').textContent = 'Please enter a valid email address';
            isValid = false;
        } else {
            document.getElementById('studentEmail').classList.remove('error');
            document.getElementById('studentEmailError').textContent = '';
        }

        // Level
        if (!validateField('studentLevel', 'studentLevelError', 'Please select your level')) {
            isValid = false;
        }

        return isValid;
    } else if (step === 1) {
        let isValid = true;

        // Password
        const password = document.getElementById('studentPassword').value;
        if (!password) {
            document.getElementById('studentPassword').classList.add('error');
            document.getElementById('studentPasswordError').textContent = 'Password required';
            isValid = false;
        } else if (!validatePassword(password)) {
            document.getElementById('studentPassword').classList.add('error');
            document.getElementById('studentPasswordError').textContent = 'Password must be at least 8 characters with uppercase, lowercase, and a number';
            isValid = false;
        } else {
            document.getElementById('studentPassword').classList.remove('error');
            document.getElementById('studentPasswordError').textContent = '';
        }

        // Confirm Password
        const confirm = document.getElementById('studentConfirmPassword').value;
        if (!confirm) {
            document.getElementById('studentConfirmPassword').classList.add('error');
            document.getElementById('studentConfirmError').textContent = 'Please confirm your password';
            isValid = false;
        } else if (password !== confirm) {
            document.getElementById('studentConfirmPassword').classList.add('error');
            document.getElementById('studentConfirmError').textContent = 'Passwords do not match';
            isValid = false;
        } else {
            document.getElementById('studentConfirmPassword').classList.remove('error');
            document.getElementById('studentConfirmError').textContent = '';
        }

        return isValid;
    }
    return true;
}

// Toast Notification
function showToast(message, type = 'success') {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:10px;';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.style.cssText = `
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 10px;
        animation: slideIn 0.3s ease;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        background: ${type === 'success' ? '#2a7a4b' : type === 'error' ? '#ef4444' : '#3b82f6'};
        min-width: 250px;
    `;
    const icon = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info';
    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" style="background:none;border:none;color:white;font-size:20px;cursor:pointer;margin-left:auto;">×</button>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Submit Form
studentForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!validateStep(1)) return;

    const studentData = {
        fullName: document.getElementById('studentName').value.trim(),
        email: document.getElementById('studentEmail').value.trim(),
        password: document.getElementById('studentPassword').value,
        role: 'student',
        matricNumber: document.getElementById('studentMatric').value.trim(),
        level: document.getElementById('studentLevel').value,
        department: 'Information Technology',
        status: 'active'
    };

    studentSubmitBtn.disabled = true;
    const originalText = studentSubmitBtn.innerHTML;
    studentSubmitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating account...';

    try {
        const response = await fetch(`${API_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(studentData)
        });

        const data = await response.json();

        if (data.success) {
            showToast('Student account created successfully!', 'success');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        } else {
            showToast(data.message || 'Registration failed', 'error');
            studentSubmitBtn.disabled = false;
            studentSubmitBtn.innerHTML = originalText;
        }
    } catch (error) {
        console.error('Registration error:', error);
        showToast('Cannot connect to server. Make sure backend is running.', 'error');
        studentSubmitBtn.disabled = false;
        studentSubmitBtn.innerHTML = originalText;
    }
});

// Real-time validation on input
document.querySelectorAll('.form-group input, .form-group select').forEach(field => {
    field.addEventListener('input', () => {
        field.classList.remove('error');
        const errorId = field.id + 'Error';
        const errorEl = document.getElementById(errorId);
        if (errorEl) errorEl.textContent = '';
    });
});

// Initialize
showStep(0);

// Add styles for animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0%); opacity: 1; }
    }
`;
document.head.appendChild(style);