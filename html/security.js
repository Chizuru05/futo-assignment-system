// ===== PASSWORD STRENGTH CHECKER =====
const newPassword = document.getElementById('newPassword');
const strengthFill = document.getElementById('strengthFill');
const strengthText = document.getElementById('strengthText');
const reqLength = document.getElementById('req-length');
const reqUppercase = document.getElementById('req-uppercase');
const reqNumber = document.getElementById('req-number');
const reqSpecial = document.getElementById('req-special');

if (newPassword) {
    newPassword.addEventListener('input', checkPasswordStrength);
}

function checkPasswordStrength() {
    const password = newPassword.value;
    
    // Check requirements
    const hasLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    // Update requirement icons
    updateRequirement(reqLength, hasLength);
    updateRequirement(reqUppercase, hasUppercase);
    updateRequirement(reqNumber, hasNumber);
    updateRequirement(reqSpecial, hasSpecial);
    
    // Calculate strength percentage
    let strength = 0;
    if (hasLength) strength += 25;
    if (hasUppercase) strength += 25;
    if (hasNumber) strength += 25;
    if (hasSpecial) strength += 25;
    
    // Update strength bar
    if (strengthFill) {
        strengthFill.style.width = strength + '%';
        
        // Update color based on strength
        if (strength <= 25) {
            strengthFill.style.background = '#ef4444';
            if (strengthText) {
                strengthText.textContent = 'Weak';
                strengthText.style.color = '#ef4444';
            }
        } else if (strength <= 50) {
            strengthFill.style.background = '#f59e0b';
            if (strengthText) {
                strengthText.textContent = 'Fair';
                strengthText.style.color = '#f59e0b';
            }
        } else if (strength <= 75) {
            strengthFill.style.background = '#3b82f6';
            if (strengthText) {
                strengthText.textContent = 'Good';
                strengthText.style.color = '#3b82f6';
            }
        } else {
            strengthFill.style.background = '#2a7a4b';
            if (strengthText) {
                strengthText.textContent = 'Strong';
                strengthText.style.color = '#2a7a4b';
            }
        }
    }
}

function updateRequirement(element, met) {
    if (element) {
        const icon = element.querySelector('i');
        if (met) {
            icon.classList.remove('fa-circle');
            icon.classList.add('fa-circle-check');
            element.style.color = 'var(--success)';
        } else {
            icon.classList.remove('fa-circle-check');
            icon.classList.add('fa-circle');
            element.style.color = 'var(--text-light)';
        }
    }
}

// ===== PASSWORD TOGGLE VISIBILITY =====
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const button = input.nextElementSibling;
    const icon = button.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

window.togglePassword = togglePassword;

// ===== TWO-FACTOR AUTH TOGGLE =====
const twoFactorToggle = document.getElementById('twoFactorToggle');
const twofaSetup = document.getElementById('twofaSetup');

if (twoFactorToggle && twofaSetup) {
    twoFactorToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            twofaSetup.style.display = 'block';
            showToast('Two-factor authentication setup started', 'info');
        } else {
            twofaSetup.style.display = 'none';
            showToast('Two-factor authentication disabled', 'warning');
        }
    });
}

// ===== SAVE SECURITY SETTINGS =====
const saveSecurityBtn = document.getElementById('saveSecurityBtn');

if (saveSecurityBtn) {
    saveSecurityBtn.addEventListener('click', function(e) {
        e.preventDefault();
        
        const currentPwd = document.getElementById('currentPassword')?.value;
        const newPwd = document.getElementById('newPassword')?.value;
        const confirmPwd = document.getElementById('confirmPassword')?.value;
        
        // Validate if any password fields are filled
        if (currentPwd || newPwd || confirmPwd) {
            if (!currentPwd) {
                showToast('Please enter your current password', 'warning');
                return;
            }
            
            if (!newPwd) {
                showToast('Please enter a new password', 'warning');
                return;
            }
            
            if (!confirmPwd) {
                showToast('Please confirm your new password', 'warning');
                return;
            }
            
            if (newPwd !== confirmPwd) {
                showToast('New passwords do not match', 'warning');
                return;
            }
            
            if (newPwd.length < 8) {
                showToast('Password must be at least 8 characters long', 'warning');
                return;
            }
        }
        
        // Show loading state
        saveSecurityBtn.classList.add('loading');
        saveSecurityBtn.disabled = true;
        
        // Simulate API call
        setTimeout(() => {
            // Save settings to localStorage
            const securitySettings = {
                twoFactor: twoFactorToggle?.checked || false,
                emailNotif: document.getElementById('emailNotifToggle')?.checked || false,
                smsNotif: document.getElementById('smsNotifToggle')?.checked || false
            };
            
            localStorage.setItem('securitySettings', JSON.stringify(securitySettings));
            
            // Remove loading state
            saveSecurityBtn.classList.remove('loading');
            saveSecurityBtn.disabled = false;
            
            // Clear password fields
            if (document.getElementById('currentPassword')) {
                document.getElementById('currentPassword').value = '';
                document.getElementById('newPassword').value = '';
                document.getElementById('confirmPassword').value = '';
                
                // Reset strength meter
                if (strengthFill) strengthFill.style.width = '0%';
                if (strengthText) {
                    strengthText.textContent = 'Too weak';
                    strengthText.style.color = 'var(--text-light)';
                }
                
                // Reset requirements
                document.querySelectorAll('.password-requirements p').forEach(p => {
                    const icon = p.querySelector('i');
                    icon.classList.remove('fa-circle-check');
                    icon.classList.add('fa-circle');
                    p.style.color = 'var(--text-light)';
                });
            }
            
            showToast('Security settings saved successfully!', 'success');
            
            // Redirect back to settings after 1.5 seconds
            setTimeout(() => {
                window.location.href = 'settings.html';
            }, 1500);
        }, 1500);
    });
}

// ===== SESSION MANAGEMENT =====
function removeSession(device) {
    showConfirm(
        'Remove Device',
        `Are you sure you want to remove ${device} from your active sessions?`,
        () => {
            showToast(`${device} has been logged out`, 'success');
        }
    );
}

function logoutAllDevices() {
    showConfirm(
        'Log Out All Devices',
        'This will log you out from all other devices. Your current session will remain active. Continue?',
        () => {
            showToast('All other devices have been logged out', 'success');
        }
    );
}

window.removeSession = removeSession;
window.logoutAllDevices = logoutAllDevices;

// ===== TOAST NOTIFICATION SYSTEM =====
const toastContainer = document.getElementById('toastContainer');

// Create toast container if it doesn't exist
if (!toastContainer) {
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
}

function showToast(message, type = 'success', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-circle-check';
    let title = 'Success';
    
    if (type === 'warning') {
        icon = 'fa-triangle-exclamation';
        title = 'Warning';
    } else if (type === 'danger') {
        icon = 'fa-circle-exclamation';
        title = 'Error';
    } else if (type === 'info') {
        icon = 'fa-circle-info';
        title = 'Info';
    }
    
    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fa-solid fa-times"></i>
        </button>
    `;
    
    container.appendChild(toast);
    
    // Auto remove after duration
    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }
    }, duration);
}

window.showToast = showToast;

// ===== CONFIRM MODAL =====
const confirmModal = document.getElementById('confirmModal');
const confirmTitle = document.getElementById('confirmTitle');
const confirmMessage = document.getElementById('confirmMessage');
const confirmActionBtn = document.getElementById('confirmActionBtn');
let confirmCallback = null;

function showConfirm(title, message, callback, type = 'warning') {
    if (confirmTitle) confirmTitle.textContent = title;
    if (confirmMessage) confirmMessage.textContent = message;
    
    confirmCallback = callback;
    
    if (confirmActionBtn) {
        confirmActionBtn.onclick = () => {
            if (confirmCallback) confirmCallback();
            closeConfirm();
        };
        
        if (type === 'danger') {
            confirmActionBtn.style.background = '#ef4444';
        } else {
            confirmActionBtn.style.background = 'var(--primary)';
        }
    }
    
    if (confirmModal) confirmModal.classList.add('show');
}

function closeConfirm() {
    if (confirmModal) confirmModal.classList.remove('show');
}

window.showConfirm = showConfirm;
window.closeConfirm = closeConfirm;

// Close modal when clicking outside
if (confirmModal) {
    confirmModal.addEventListener('click', (e) => {
        if (e.target === confirmModal) {
            closeConfirm();
        }
    });
}

// ===== LOAD SAVED SETTINGS =====
document.addEventListener('DOMContentLoaded', () => {
    // Load saved security settings
    const savedSettings = localStorage.getItem('securitySettings');
    
    if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        
        if (document.getElementById('twoFactorToggle')) {
            document.getElementById('twoFactorToggle').checked = settings.twoFactor || false;
            if (settings.twoFactor && twofaSetup) {
                twofaSetup.style.display = 'block';
            }
        }
        
        if (document.getElementById('emailNotifToggle')) {
            document.getElementById('emailNotifToggle').checked = settings.emailNotif !== false;
        }
        
        if (document.getElementById('smsNotifToggle')) {
            document.getElementById('smsNotifToggle').checked = settings.smsNotif || false;
        }
    }
    
    console.log('Security page initialized');
});

// ===== ADD ANIMATION STYLES =====
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .loading {
        position: relative;
        pointer-events: none;
        opacity: 0.7;
    }
    
    .loading::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 20px;
        height: 20px;
        margin: -10px 0 0 -10px;
        border: 2px solid var(--primary-light);
        border-top-color: white;
        border-radius: 50%;
        animation: spinner 0.6s linear infinite;
    }
    
    @keyframes spinner {
        to {
            transform: rotate(360deg);
        }
    }
`;
document.head.appendChild(style);
