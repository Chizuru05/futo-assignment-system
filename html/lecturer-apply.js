// lecturer-apply.js - Lecturer Application Form
console.log('lecturer-apply.js loaded, API_URL:', API_URL);

const applyForm = document.getElementById('applyForm');
const submitBtn = document.getElementById('submitBtn');
const toastContainer = document.getElementById('toastContainer');

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

function validateForm() {
    let isValid = true;

    if (!validateField('fullName', 'fullNameError', 'Full name is required')) {
        isValid = false;
    }

    const email = document.getElementById('email').value.trim();
    if (!email) {
        document.getElementById('email').classList.add('error');
        document.getElementById('emailError').textContent = 'Email is required';
        isValid = false;
    } else if (!validateEmail(email)) {
        document.getElementById('email').classList.add('error');
        document.getElementById('emailError').textContent = 'Please enter a valid email address';
        isValid = false;
    } else {
        document.getElementById('email').classList.remove('error');
        document.getElementById('emailError').textContent = '';
    }

    if (!validateField('staffId', 'staffIdError', 'Staff ID is required')) {
        isValid = false;
    }

    if (!validateField('department', 'departmentError', 'Please select your department')) {
        isValid = false;
    }

    if (!validateField('rank', 'rankError', 'Please select your academic rank')) {
        isValid = false;
    }

    const password = document.getElementById('password').value;
    if (!password) {
        document.getElementById('password').classList.add('error');
        document.getElementById('passwordError').textContent = 'Password is required';
        isValid = false;
    } else if (!validatePassword(password)) {
        document.getElementById('password').classList.add('error');
        document.getElementById('passwordError').textContent = 'Password must be at least 8 characters with uppercase, lowercase, and a number';
        isValid = false;
    } else {
        document.getElementById('password').classList.remove('error');
        document.getElementById('passwordError').textContent = '';
    }

    const confirmPassword = document.getElementById('confirmPassword').value;
    if (!confirmPassword) {
        document.getElementById('confirmPassword').classList.add('error');
        document.getElementById('confirmPasswordError').textContent = 'Please confirm your password';
        isValid = false;
    } else if (password !== confirmPassword) {
        document.getElementById('confirmPassword').classList.add('error');
        document.getElementById('confirmPasswordError').textContent = 'Passwords do not match';
        isValid = false;
    } else {
        document.getElementById('confirmPassword').classList.remove('error');
        document.getElementById('confirmPasswordError').textContent = '';
    }

    const terms = document.getElementById('terms');
    if (!terms.checked) {
        document.getElementById('termsError').textContent = 'You must accept the Terms and Conditions';
        isValid = false;
    } else {
        document.getElementById('termsError').textContent = '';
    }

    return isValid;
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info';
    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">×</button>
    `;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

applyForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!validateForm()) {
        showToast('Please fix all errors before submitting.', 'error');
        return;
    }

    const formData = {
        fullName: document.getElementById('fullName').value.trim(),
        email: document.getElementById('email').value.trim(),
        staffId: document.getElementById('staffId').value.trim(),
        department: document.getElementById('department').value,
        rank: document.getElementById('rank').value,
        specialization: document.getElementById('specialization').value.trim(),
        password: document.getElementById('password').value,
        role: 'lecturer',
        status: 'pending'
    };

    submitBtn.disabled = true;
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';

    try {
        const response = await fetch(`${API_URL}/api/auth/lecturer-apply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (data.success) {
            showToast('Application submitted successfully! You will be notified once approved.', 'success');
            applyForm.reset();
            document.querySelectorAll('.form-group input, .form-group select').forEach(el => {
                el.classList.remove('error');
            });
            document.querySelectorAll('.error-message').forEach(el => {
                el.textContent = '';
            });
            setTimeout(() => {
                window.location.href = 'pending-approval.html';
            }, 3000);
        } else {
            showToast(data.message || 'Application submission failed. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Application error:', error);
        showToast('Cannot connect to server. Please check your connection.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
});

document.querySelectorAll('.form-group input, .form-group select').forEach(field => {
    field.addEventListener('input', () => {
        field.classList.remove('error');
        const errorId = field.id + 'Error';
        const errorEl = document.getElementById(errorId);
        if (errorEl) errorEl.textContent = '';
    });
});