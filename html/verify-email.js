const params = new URLSearchParams(window.location.search);
const email = params.get('email');

const verifySubtext = document.getElementById('verifySubtext');
const verifyForm = document.getElementById('verifyForm');
const otpInput = document.getElementById('otpInput');
const verifyBtn = document.getElementById('verifyBtn');
const resendLink = document.getElementById('resendLink');

if (!email) {
    window.location.href = 'signup.html';
} else {
    verifySubtext.textContent = `Enter the 6-digit code sent to ${email}`;
}

function showToast(message, type = 'success') {
    let container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.style.cssText = `padding:12px 20px;border-radius:8px;color:white;margin-bottom:10px;
        background:${type === 'success' ? '#2a7a4b' : type === 'error' ? '#ef4444' : '#3b82f6'};`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

verifyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const otp = otpInput.value.trim();

    if (otp.length !== 6) {
        document.getElementById('otpError').textContent = 'Enter the full 6-digit code';
        return;
    }

    verifyBtn.disabled = true;
    verifyBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';

    try {
        const response = await fetch(`${API_URL}/api/auth/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp })
        });
        const data = await response.json();

        if (data.success) {
            if (data.requiresApproval) {
                showToast('Email verified! Awaiting admin approval.', 'success');
                setTimeout(() => window.location.href = 'pending-approval.html', 2000);
            } else {
                showToast('Email verified! Redirecting...', 'success');
                setTimeout(() => window.location.href = 'login.html', 1500);
            }
        } else {
            showToast(data.message || 'Verification failed', 'error');
            verifyBtn.disabled = false;
            verifyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Verify Email';
        }
    } catch (error) {
        showToast('Cannot connect to server', 'error');
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Verify Email';
    }
});

resendLink.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
        const response = await fetch(`${API_URL}/api/auth/resend-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await response.json();
        showToast(data.message, data.success ? 'success' : 'error');
    } catch (error) {
        showToast('Cannot connect to server', 'error');
    }
});