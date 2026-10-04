// admin-profile.js

function getAuthToken() {
    var role = localStorage.getItem('userRole');
    if (!role) return null;
    return localStorage.getItem(role + '_token') || localStorage.getItem('token');
}

var token = getAuthToken();
var userRole = localStorage.getItem('userRole');
var authorized = !!token && userRole === 'admin';

if (!authorized) {
    window.location.href = 'login.html';
}

var profile = null;
var PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
var EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var MAX_ORIGINAL_MB = 15; // before browser-side resizing

function $(id) { return document.getElementById(id); }

function authHeaders(json) {
    var h = { Authorization: 'Bearer ' + token };
    if (json) h['Content-Type'] = 'application/json';
    return h;
}

function fetchWithTimeout(url, options, timeoutMs) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, timeoutMs || 30000);
    return fetch(url, Object.assign({}, options, { signal: controller.signal }))
        .finally(function () { clearTimeout(timer); });
}

function avatarFallback(name, size) {
    return 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name || 'Admin') +
        '&background=2a7a4b&color=fff&size=' + size;
}

function showToast(message, type) {
    type = type || 'success';
    var container = $('adToastContainer');
    if (!container) return;
    var toast = document.createElement('div');
    toast.className = 'ad-toast ad-' + type;
    var icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
    toast.innerHTML = '<i class="fa-solid ' + icon + '"></i><span></span><button class="ad-toast-close">&times;</button>';
    toast.querySelector('span').textContent = message; // textContent: no HTML injection
    toast.querySelector('button').addEventListener('click', function () { toast.remove(); });
    container.appendChild(toast);
    setTimeout(function () { toast.remove(); }, 4000);
}

async function readJson(response) {
    try { return await response.json(); } catch (e) { return {}; }
}

// ========== LOAD + RENDER ==========
async function loadSession() {
    try {
        var res = await fetchWithTimeout(API_URL + '/api/settings', { headers: authHeaders() }, 15000);
        var data = await readJson(res);
        if (data.success) {
            $('adSidebarSession').textContent = data.settings.activeSession + ' ' + data.settings.activeSemester;
        }
    } catch (e) { /* non-critical */ }
}

async function loadProfile() {
    try {
        var res = await fetchWithTimeout(API_URL + '/api/admin-profile', { headers: authHeaders() }, 40000);
        var data = await readJson(res);
        if (res.ok && data.success) {
            renderProfile(data.user);
        } else {
            showToast(data.message || 'Could not load your profile', 'danger');
        }
    } catch (error) {
        showToast(error.name === 'AbortError'
            ? 'Server took too long to respond. Refresh in a moment.'
            : 'Could not connect to the server', 'danger');
    }
}

function renderProfile(user) {
    profile = user;

    var name = user.fullName || 'Administrator';
    $('pfDisplayName').textContent = name;
    $('pfAvatar').src = user.profilePic || avatarFallback(name, 200);

    $('pfFactEmail').textContent = user.email || '-';
    $('pfFactDept').textContent = user.department || '-';
    $('pfFactStatus').textContent = 'Role: Administrator' + (user.status ? ' (' + user.status + ')' : '');
    $('pfFactSince').textContent = user.createdAt
        ? 'Member since ' + new Date(user.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        : '-';

    $('pfFullName').value = user.fullName || '';
    $('pfEmail').value = user.email || '';
    $('pfPhone').value = user.phone || '';
    $('pfAltEmail').value = user.altEmail || '';
    $('pfDepartment').value = user.department || '';
    $('pfFaculty').value = user.faculty || '';
    $('pfGender').value = user.gender || '';
    $('pfDob').value = user.dob || '';
    $('pfNationality').value = user.nationality || '';
    $('pfBio').value = user.bio || '';
    $('pfBioCount').textContent = ($('pfBio').value || '').length;

    // Keep the sidebar/header and other admin pages in sync
    localStorage.setItem('fullName', name);
    localStorage.setItem('adminProfilePic', user.profilePic || '');
    if (window.adminAvatar) window.adminAvatar.apply(user.profilePic || '');
}

// ========== SAVE PROFILE ==========
async function saveProfile(e) {
    e.preventDefault();

    var fullName = $('pfFullName').value.trim();
    var altEmail = $('pfAltEmail').value.trim();
    var dob = $('pfDob').value;

    if (fullName.length < 2) { showToast('Full name must be at least 2 characters', 'warning'); return; }
    if (altEmail && !EMAIL_RULE.test(altEmail)) { showToast('Enter a valid alternative email', 'warning'); return; }
    if (dob && new Date(dob) > new Date()) { showToast('Date of birth cannot be in the future', 'warning'); return; }

    var btn = $('pfSaveBtn');
    var original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

    try {
        var res = await fetchWithTimeout(API_URL + '/api/admin-profile', {
            method: 'PUT',
            headers: authHeaders(true),
            body: JSON.stringify({
                fullName: fullName,
                phone: $('pfPhone').value.trim(),
                altEmail: altEmail,
                department: $('pfDepartment').value.trim(),
                faculty: $('pfFaculty').value.trim(),
                gender: $('pfGender').value,
                dob: dob,
                nationality: $('pfNationality').value.trim(),
                bio: $('pfBio').value.trim()
            })
        }, 30000);
        var data = await readJson(res);

        if (res.ok && data.success) {
            renderProfile(data.user);
            showToast('Profile updated successfully');
        } else {
            showToast(data.message || 'Failed to update profile', 'danger');
        }
    } catch (error) {
        showToast('Failed to update profile. Check your connection.', 'danger');
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

// ========== PROFILE PICTURE ==========
// Shrinks big phone photos in the browser first (saves data and upload time)
function resizeImage(file, maxSize) {
    return new Promise(function (resolve) {
        var img = new Image();
        var url = URL.createObjectURL(file);
        img.onload = function () {
            var scale = Math.min(1, maxSize / Math.max(img.width, img.height));
            var w = Math.round(img.width * scale);
            var h = Math.round(img.height * scale);
            var canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            canvas.toBlob(function (blob) {
                URL.revokeObjectURL(url);
                resolve(blob && blob.size < file.size ? { blob: blob, name: 'profile.jpg' } : { blob: file, name: file.name });
            }, 'image/jpeg', 0.85);
        };
        img.onerror = function () {
            URL.revokeObjectURL(url);
            resolve({ blob: file, name: file.name });
        };
        img.src = url;
    });
}

function setAvatarBusy(busy) {
    $('pfAvatarWrap').classList.toggle('pf-busy', busy);
    $('pfUploadBtn').disabled = busy;
    $('pfRemoveBtn').disabled = busy;
    $('pfAvatarBtn').disabled = busy;
}

async function handleAvatarSelected() {
    var input = $('pfAvatarInput');
    var file = input.files && input.files[0];
    input.value = ''; // allows picking the same file again later
    if (!file) return;

    if (['image/jpeg', 'image/png', 'image/webp'].indexOf(file.type) === -1) {
        showToast('Please choose a JPG, PNG or WebP image', 'warning');
        return;
    }
    if (file.size > MAX_ORIGINAL_MB * 1024 * 1024) {
        showToast('That image is too large. Choose one under ' + MAX_ORIGINAL_MB + 'MB', 'warning');
        return;
    }

    setAvatarBusy(true);
    try {
        var prepared = await resizeImage(file, 600);
        var formData = new FormData();
        formData.append('avatar', prepared.blob, prepared.name);

        var res = await fetchWithTimeout(API_URL + '/api/admin-profile/picture', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + token }, // browser sets the multipart boundary
            body: formData
        }, 60000);
        var data = await readJson(res);

        if (res.ok && data.success) {
            profile.profilePic = data.profilePic;
            renderProfile(profile);
            showToast('Profile picture updated');
        } else {
            showToast(data.message || 'Failed to upload picture', 'danger');
        }
    } catch (error) {
        showToast(error.name === 'AbortError' ? 'Upload timed out. Try again.' : 'Failed to upload picture', 'danger');
    } finally {
        setAvatarBusy(false);
    }
}

async function removeAvatar() {
    if (!profile || !profile.profilePic) {
        showToast('You have no profile picture to remove', 'info');
        return;
    }
    if (!confirm('Remove your profile picture?')) return;

    setAvatarBusy(true);
    try {
        var res = await fetchWithTimeout(API_URL + '/api/admin-profile/picture', {
            method: 'DELETE',
            headers: authHeaders()
        }, 30000);
        var data = await readJson(res);

        if (res.ok && data.success) {
            profile.profilePic = '';
            renderProfile(profile);
            showToast('Profile picture removed');
        } else {
            showToast(data.message || 'Failed to remove picture', 'danger');
        }
    } catch (error) {
        showToast('Failed to remove picture', 'danger');
    } finally {
        setAvatarBusy(false);
    }
}

// ========== PASSWORD ==========
async function changePassword(e) {
    e.preventDefault();

    var current = $('pfCurrentPassword').value;
    var next = $('pfNewPassword').value;
    var confirmPw = $('pfConfirmPassword').value;

    if (!current) { showToast('Enter your current password', 'warning'); return; }
    if (!PASSWORD_RULE.test(next)) {
        showToast('New password needs 8+ characters with uppercase, lowercase and a number', 'warning');
        return;
    }
    if (next !== confirmPw) { showToast('New passwords do not match', 'warning'); return; }
    if (next === current) { showToast('New password must be different from the current one', 'warning'); return; }

    var btn = $('pfPasswordBtn');
    var original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';

    try {
        var res = await fetchWithTimeout(API_URL + '/api/admin-profile/password', {
            method: 'PUT',
            headers: authHeaders(true),
            body: JSON.stringify({ currentPassword: current, newPassword: next })
        }, 30000);
        var data = await readJson(res);

        if (res.ok && data.success) {
            $('pfPasswordForm').reset();
            showToast('Password changed successfully');
        } else {
            showToast(data.message || 'Failed to change password', 'danger');
        }
    } catch (error) {
        showToast('Failed to change password. Check your connection.', 'danger');
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

function togglePasswordVisibility(button) {
    var input = $(button.getAttribute('data-target'));
    var icon = button.querySelector('i');
    if (!input) return;
    var show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    icon.className = show ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
}

// ========== NAV, SIDEBAR, THEME ==========
function logout() {
    localStorage.clear();
    window.location.href = 'login.html';
}

function initNav() {
    // Dashboard/Courses/Lecturers/Students all live inside admin-dashboard.html
    document.querySelectorAll('.ad-nav-link[data-go]').forEach(function (link) {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            var page = link.getAttribute('data-go');
            if (page === 'dashboard') localStorage.removeItem('adminPage');
            else localStorage.setItem('adminPage', page);
            window.location.href = 'admin-dashboard.html';
        });
    });

    $('adLogoutLink').addEventListener('click', function (e) { e.preventDefault(); logout(); });
}

function initSidebar() {
    var sidebar = $('adSidebar');
    var toggle = $('adSidebarToggle');
    var menuBtn = $('adMenuBtn');

    if (toggle) {
        toggle.addEventListener('click', function () {
            if (window.innerWidth <= 1024) sidebar.classList.remove('ad-show');
            else sidebar.classList.toggle('ad-collapsed');
        });
    }
    if (menuBtn) menuBtn.addEventListener('click', function () { sidebar.classList.toggle('ad-show'); });

    document.addEventListener('click', function (e) {
        if (window.innerWidth <= 1024 && sidebar && menuBtn && !sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
            sidebar.classList.remove('ad-show');
        }
    });
}

function initDarkMode() {
    var themeToggle = $('adThemeToggle');
    if (localStorage.getItem('futoTheme') === 'dark') document.body.classList.add('dark');
    if (themeToggle) {
        themeToggle.addEventListener('click', function () {
            document.body.classList.toggle('dark');
            localStorage.setItem('futoTheme', document.body.classList.contains('dark') ? 'dark' : 'light');
        });
    }
}

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', function () {
    if (!authorized) return;

    initDarkMode();
    initSidebar();
    initNav();

    $('pfProfileForm').addEventListener('submit', saveProfile);
    $('pfPasswordForm').addEventListener('submit', changePassword);
    $('pfResetBtn').addEventListener('click', function () { if (profile) renderProfile(profile); });
    $('pfBio').addEventListener('input', function () { $('pfBioCount').textContent = $('pfBio').value.length; });

    $('pfAvatarBtn').addEventListener('click', function () { $('pfAvatarInput').click(); });
    $('pfUploadBtn').addEventListener('click', function () { $('pfAvatarInput').click(); });
    $('pfAvatarInput').addEventListener('change', handleAvatarSelected);
    $('pfRemoveBtn').addEventListener('click', removeAvatar);

    document.querySelectorAll('.ad-password-toggle[data-target]').forEach(function (btn) {
        btn.addEventListener('click', function () { togglePasswordVisibility(btn); });
    });

    loadSession();
    loadProfile();
});

window.logout = logout;