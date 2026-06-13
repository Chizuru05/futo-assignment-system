// API_URL is defined in api-config.js (loaded globally)
if (typeof API_URL === 'undefined') {
    console.warn('API_URL not defined in student-profile.js, using fallback');
    var API_URL = 'https://futo-assignment-system-api.onrender.com';
}
console.log('student-profile.js loaded with API_URL:', API_URL);
// student-profile.js


// FIXED: Use role-specific token
function getAuthToken() {
    const userRole = localStorage.getItem('userRole');
    if (!userRole) return null;
    return localStorage.getItem(`${userRole}_token`) || localStorage.getItem('token');
}

const token = getAuthToken();
const userRole = localStorage.getItem('userRole');

if (!token) window.location.href = 'login.html';
if (userRole !== 'student') window.location.href = 'lecturer-dashboard.html';

// DOM Elements
const profileImage = document.getElementById('profileImage');
const displayName = document.getElementById('displayName');
const displayMatric = document.getElementById('displayMatric');
const displayDepartment = document.getElementById('displayDepartment');
const displayLevel = document.getElementById('displayLevel');
const fullNameSpan = document.getElementById('fullName');
const matricNumberSpan = document.getElementById('matricNumber');
const dobSpan = document.getElementById('dob');
const genderSpan = document.getElementById('gender');
const nationalitySpan = document.getElementById('nationality');
const stateOfOriginSpan = document.getElementById('stateOfOrigin');
const lgaSpan = document.getElementById('lga');
const emailSpan = document.getElementById('email');
const personalEmailSpan = document.getElementById('personalEmail');
const phoneSpan = document.getElementById('phone');
const addressSpan = document.getElementById('address');
const departmentSpan = document.getElementById('department');
const facultySpan = document.getElementById('faculty');
const levelSpan = document.getElementById('level');
const admissionSessionSpan = document.getElementById('admissionSession');
const currentSessionSpan = document.getElementById('currentSession');
const semesterSpan = document.getElementById('semester');
const guardianNameSpan = document.getElementById('guardianName');
const guardianRelationSpan = document.getElementById('guardianRelation');
const guardianPhoneSpan = document.getElementById('guardianPhone');
const guardianEmailSpan = document.getElementById('guardianEmail');
const guardianAddressSpan = document.getElementById('guardianAddress');

const editBtn = document.getElementById('editProfileBtn');
const formActions = document.getElementById('formActions');
const cancelBtn = document.getElementById('cancelEditBtn');
const saveBtn = document.getElementById('saveProfileBtn');
const avatarEditBtn = document.getElementById('avatarEditBtn');
const avatarInput = document.getElementById('avatarInput');

let originalValues = {};

async function fetchProfile() {
    try {
        const response = await fetch(`${API_URL}/api/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            const user = data.user;
            updateDisplayValues(user);
            populateEditInputs(user);
        } else {
            showToast('Failed to load profile', 'danger');
        }
    } catch (error) {
        console.error('Error fetching profile:', error);
        showToast('Failed to connect to server', 'danger');
    }
}

function updateDisplayValues(user) {
    if (displayName) displayName.textContent = user.fullName || 'Student';
    if (displayMatric) displayMatric.textContent = user.matricNumber || 'N/A';
    if (displayDepartment) displayDepartment.textContent = user.department || 'Information Technology';
    if (displayLevel) displayLevel.textContent = user.level || 'N/A';

    if (fullNameSpan) fullNameSpan.textContent = user.fullName || 'N/A';
    if (matricNumberSpan) matricNumberSpan.textContent = user.matricNumber || 'N/A';
    if (dobSpan) dobSpan.textContent = user.dob || 'Not set';
    if (genderSpan) genderSpan.textContent = user.gender || 'Not set';
    if (nationalitySpan) nationalitySpan.textContent = user.nationality || 'Nigerian';
    if (stateOfOriginSpan) stateOfOriginSpan.textContent = user.stateOfOrigin || 'Not set';
    if (lgaSpan) lgaSpan.textContent = user.lga || 'Not set';
    if (emailSpan) emailSpan.textContent = user.email || 'N/A';
    if (personalEmailSpan) personalEmailSpan.textContent = user.personalEmail || 'Not set';
    if (phoneSpan) phoneSpan.textContent = user.phone || 'Not set';
    if (addressSpan) addressSpan.textContent = user.address || 'Not set';
    if (departmentSpan) departmentSpan.textContent = user.department || 'Information Technology';
    if (facultySpan) facultySpan.textContent = user.faculty || 'Computing';
    if (levelSpan) levelSpan.textContent = user.level || 'N/A';
    if (admissionSessionSpan) admissionSessionSpan.textContent = user.admissionSession || 'N/A';
    if (currentSessionSpan) currentSessionSpan.textContent = localStorage.getItem('currentSession') || '2025-2026';
    if (semesterSpan) semesterSpan.textContent = localStorage.getItem('currentSemester') || 'Harmattan';
    if (guardianNameSpan) guardianNameSpan.textContent = user.guardianName || 'Not set';
    if (guardianRelationSpan) guardianRelationSpan.textContent = user.guardianRelation || 'Not set';
    if (guardianPhoneSpan) guardianPhoneSpan.textContent = user.guardianPhone || 'Not set';
    if (guardianEmailSpan) guardianEmailSpan.textContent = user.guardianEmail || 'Not set';
    if (guardianAddressSpan) guardianAddressSpan.textContent = user.guardianAddress || 'Not set';
}

function populateEditInputs(user) {
    const fields = {
        editFullName: user.fullName || '',
        editDob: user.dob || '',
        editNationality: user.nationality || 'Nigerian',
        editStateOfOrigin: user.stateOfOrigin || '',
        editLga: user.lga || '',
        editPersonalEmail: user.personalEmail || '',
        editPhone: user.phone || '',
        editAddress: user.address || '',
        editGuardianName: user.guardianName || '',
        editGuardianRelation: user.guardianRelation || '',
        editGuardianPhone: user.guardianPhone || '',
        editGuardianEmail: user.guardianEmail || '',
        editGuardianAddress: user.guardianAddress || ''
    };

    for (const [id, value] of Object.entries(fields)) {
        const el = document.getElementById(id);
        if (el) el.value = value;
    }

    const editGender = document.getElementById('editGender');
    if (editGender) editGender.value = user.gender || 'Female';

    const editDepartment = document.getElementById('editDepartment');
    if (editDepartment) editDepartment.value = user.department || 'Information Technology';

    const editFaculty = document.getElementById('editFaculty');
    if (editFaculty) editFaculty.value = user.faculty || 'Computing';

    const editLevel = document.getElementById('editLevel');
    if (editLevel) editLevel.value = user.level || '400';
}

function toggleEditMode(isEditing) {
    document.querySelectorAll('.info-value').forEach(el => {
        el.style.display = isEditing ? 'none' : 'block';
    });
    document.querySelectorAll('.edit-input').forEach(el => {
        if (!el.hasAttribute('readonly')) {
            el.style.display = isEditing ? 'block' : 'none';
        }
    });
    if (formActions) formActions.style.display = isEditing ? 'flex' : 'none';
    if (editBtn) {
        editBtn.innerHTML = isEditing
            ? '<i class="fa-regular fa-pen-to-square"></i> Editing...'
            : '<i class="fa-regular fa-pen-to-square"></i> Edit Profile';
        editBtn.disabled = isEditing;
    }
}

if (editBtn) {
    editBtn.addEventListener('click', () => {
        document.querySelectorAll('.info-value').forEach(el => {
            if (el.id) originalValues[el.id] = el.textContent;
        });
        toggleEditMode(true);
        showToast('You can now edit your profile', 'info');
    });
}

if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
        Object.keys(originalValues).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = originalValues[id];
        });
        toggleEditMode(false);
        showToast('Changes discarded', 'info');
    });
}

if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
        const updates = {};

        document.querySelectorAll('.edit-input').forEach(input => {
            if (input.hasAttribute('readonly') || input.disabled) return;
            const rawId = input.id.replace('edit', '');
            const key = rawId.charAt(0).toLowerCase() + rawId.slice(1);
            if (input.type !== 'file') {
                let value = input.value;
                if (input.type === 'date' && value) {
                    const date = new Date(value);
                    value = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                }
                updates[key] = value;
            }
        });

        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        }

        try {
            const response = await fetch(`${API_URL}/api/profile`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updates)
            });
            const data = await response.json();

            if (data.success) {
                showToast('Profile updated successfully!', 'success');
                toggleEditMode(false);
                await fetchProfile();
            } else {
                showToast(data.message || 'Update failed', 'danger');
            }
        } catch (error) {
            console.error('Update error:', error);
            showToast('Failed to update profile', 'danger');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Save Changes';
            }
        }
    });
}

if (avatarEditBtn && avatarInput) {
    avatarEditBtn.addEventListener('click', () => avatarInput.click());
    avatarInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            showToast('Image must be less than 5MB', 'warning');
            return;
        }
        if (!file.type.match('image.*')) {
            showToast('Please select an image file', 'warning');
            return;
        }

        const formData = new FormData();
        formData.append('profilePic', file);

        try {
            const response = await fetch(`${API_URL}/api/profile/picture`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const data = await response.json();
            if (data.success && profileImage) {
                profileImage.src = URL.createObjectURL(file);
                showToast('Profile picture updated!', 'success');
            }
        } catch (error) {
            showToast('Failed to upload image', 'danger');
        }
    });
}

function showToast(message, type = 'success') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: 'fa-check-circle', danger: 'fa-exclamation-circle', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };
    toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.success}"></i><span>${message}</span><button class="toast-close" onclick="this.parentElement.remove()">×</button>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function logout() {
    localStorage.clear();
    window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', () => {
    fetchProfile();

    const logoutLink = document.querySelector('.logout-link');
    if (logoutLink) logoutLink.addEventListener('click', (e) => { e.preventDefault(); logout(); });

    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark');
            localStorage.setItem('futoTheme', document.body.classList.contains('dark') ? 'dark' : 'light');
        });
        if (localStorage.getItem('futoTheme') === 'dark') document.body.classList.add('dark');
    }
});

window.showToast = showToast;
window.logout = logout;