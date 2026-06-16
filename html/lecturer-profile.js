// lecturer-profile.js


// FIXED: Use role-specific token
function getAuthToken() {
    const userRole = localStorage.getItem('userRole');
    if (!userRole) return null;
    return localStorage.getItem(`${userRole}_token`) || localStorage.getItem('token');
}

const token = getAuthToken();
const userRole = localStorage.getItem('userRole');

if (!token) window.location.href = 'login.html';
if (userRole !== 'lecturer') window.location.href = 'student-dashboard.html';

const profileImage = document.getElementById('profileImage');
const displayName = document.getElementById('displayName');
const displayStaffId = document.getElementById('displayStaffId');
const displayDepartment = document.getElementById('displayDepartment');
const fullNameSpan = document.getElementById('fullName');
const staffIdSpan = document.getElementById('staffId');
const dobSpan = document.getElementById('dob');
const genderSpan = document.getElementById('gender');
const nationalitySpan = document.getElementById('nationality');
const maritalStatusSpan = document.getElementById('maritalStatus');
const emailSpan = document.getElementById('email');
const altEmailSpan = document.getElementById('altEmail');
const phoneSpan = document.getElementById('phone');
const departmentSpan = document.getElementById('department');
const facultySpan = document.getElementById('faculty');
const rankSpan = document.getElementById('rank');
const specializationSpan = document.getElementById('specialization');
const bioSpan = document.getElementById('bio');
const researchSpan = document.getElementById('research');

const editBtn = document.getElementById('editProfileBtn');
const formActions = document.getElementById('formActions');
const cancelBtn = document.getElementById('cancelEditBtn');
const saveBtn = document.getElementById('saveProfileBtn');
const avatarEditBtn = document.getElementById('avatarEditBtn');
const avatarInput = document.getElementById('avatarInput');

let originalValues = {};

async function fetchProfile() {
    try {
        showToast('Loading profile...', 'info');
        const response = await fetch(`${API_URL}/api/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            updateDisplayValues(data.user);
        } else {
            showToast(data.message || 'Failed to load profile', 'danger');
            useLocalStorageFallback();
        }
    } catch (error) {
        console.error('Error fetching profile:', error);
        showToast('Failed to connect to server', 'danger');
        useLocalStorageFallback();
    }
}

function useLocalStorageFallback() {
    updateDisplayValues({
        fullName: localStorage.getItem('fullName') || 'Dr. Lecturer',
        staffId: localStorage.getItem('staffId') || 'STAFF/2024/001',
        email: localStorage.getItem('email') || 'lecturer@futo.edu.ng',
        department: localStorage.getItem('department') || 'Information Technology',
        rank: localStorage.getItem('rank') || 'Senior Lecturer',
        faculty: 'Computing',
        nationality: 'Nigerian'
    });
}

function updateDisplayValues(user) {
    if (displayName) displayName.textContent = user.fullName || 'Lecturer';
    if (displayStaffId) displayStaffId.textContent = user.staffId || 'N/A';
    if (displayDepartment) displayDepartment.textContent = user.department || 'Information Technology';
    if (fullNameSpan) fullNameSpan.textContent = user.fullName || 'N/A';
    if (staffIdSpan) staffIdSpan.textContent = user.staffId || 'N/A';
    if (dobSpan) dobSpan.textContent = user.dob || 'Not set';
    if (genderSpan) genderSpan.textContent = user.gender || 'Not set';
    if (nationalitySpan) nationalitySpan.textContent = user.nationality || 'Nigerian';
    if (maritalStatusSpan) maritalStatusSpan.textContent = user.maritalStatus || 'Not set';
    if (emailSpan) emailSpan.textContent = user.email || 'N/A';
    if (altEmailSpan) altEmailSpan.textContent = user.altEmail || 'Not set';
    if (phoneSpan) phoneSpan.textContent = user.phone || 'Not set';
    if (departmentSpan) departmentSpan.textContent = user.department || 'Information Technology';
    if (facultySpan) facultySpan.textContent = user.faculty || 'Computing';
    if (rankSpan) rankSpan.textContent = user.rank || 'Senior Lecturer';
    if (specializationSpan) specializationSpan.textContent = user.specialization || 'Not set';
    if (bioSpan) bioSpan.textContent = user.bio || 'No bio provided';
    if (researchSpan) researchSpan.textContent = user.research || 'Not set';

    if (profileImage) {
        if (user.profilePic) {
            profileImage.src = user.profilePic;
        } else if (user.fullName) {
            profileImage.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=2a7a4b&color=fff&size=120`;
        }
    }

    // Populate edit inputs
    const map = {
        editFullName: user.fullName,
        editDob: user.dob,
        editNationality: user.nationality || 'Nigerian',
        editAltEmail: user.altEmail,
        editPhone: user.phone,
        editSpecialization: user.specialization,
        editBio: user.bio,
        editResearch: user.research
    };
    for (const [id, val] of Object.entries(map)) {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    }

    const editGender = document.getElementById('editGender');
    if (editGender) editGender.value = user.gender || '';

    const editMaritalStatus = document.getElementById('editMaritalStatus');
    if (editMaritalStatus) editMaritalStatus.value = user.maritalStatus || '';

    const editDepartment = document.getElementById('editDepartment');
    if (editDepartment) editDepartment.value = user.department || 'Information Technology';

    const editFaculty = document.getElementById('editFaculty');
    if (editFaculty) editFaculty.value = user.faculty || 'Computing';

    const editRank = document.getElementById('editRank');
    if (editRank) editRank.value = user.rank || 'Senior Lecturer';
}

function toggleEditMode(isEditing) {
    document.querySelectorAll('.info-value').forEach(el => {
        el.style.display = isEditing ? 'none' : 'block';
    });
    document.querySelectorAll('.edit-input').forEach(el => {
        if (!el.hasAttribute('readonly') && el.id !== 'editStaffId') {
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
        showToast('Edit mode enabled', 'info');
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
        const allowed = ['fullName', 'dob', 'gender', 'nationality', 'maritalStatus', 'altEmail', 'phone', 'department', 'faculty', 'rank', 'specialization', 'bio', 'research'];

        document.querySelectorAll('.edit-input').forEach(input => {
            if (input.hasAttribute('readonly') || input.disabled || input.id === 'editStaffId') return;
            const rawId = input.id.replace('edit', '');
            const key = rawId.charAt(0).toLowerCase() + rawId.slice(1);
            if (allowed.includes(key) && input.type !== 'file') {
                updates[key] = input.value;
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
                showToast(data.message || 'Failed to update profile', 'danger');
            }
        } catch (error) {
            console.error('Save error:', error);
            showToast('Failed to save profile', 'danger');
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
        if (file.size > 5 * 1024 * 1024) { showToast('Image must be less than 5MB', 'warning'); return; }
        if (!file.type.match('image.*')) { showToast('Please select an image file', 'warning'); return; }

        if (avatarEditBtn) {
            avatarEditBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            avatarEditBtn.disabled = true;
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
                const reader = new FileReader();
                reader.onload = (e) => { profileImage.src = e.target.result; };
                reader.readAsDataURL(file);
                showToast('Profile picture updated!', 'success');
            }
        } catch (error) {
            showToast('Failed to upload image', 'danger');
        } finally {
            if (avatarEditBtn) {
                avatarEditBtn.innerHTML = '<i class="fa-solid fa-camera"></i>';
                avatarEditBtn.disabled = false;
            }
        }
        avatarInput.value = '';
    });
}

function showToast(message, type = 'success', duration = 3000) {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        container.id = 'toastContainer';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: 'fa-check-circle', danger: 'fa-exclamation-circle', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };
    toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.success}"></i><div class="toast-content"><div class="toast-message">${message}</div></div><button class="toast-close" onclick="this.parentElement.remove()">Ã—</button>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
}

function logout() {
    localStorage.clear();
    window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', () => {
    fetchProfile();

    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark');
            localStorage.setItem('futoTheme', document.body.classList.contains('dark') ? 'dark' : 'light');
        });
        if (localStorage.getItem('futoTheme') === 'dark') document.body.classList.add('dark');
    }

    const logoutLink = document.querySelector('.logout-link');
    if (logoutLink) logoutLink.addEventListener('click', (e) => { e.preventDefault(); logout(); });
});

window.showToast = showToast;
window.logout = logout;
