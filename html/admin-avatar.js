// admin-avatar.js - shows the admin's real photo/name in the sidebar + header on every admin page
(function () {
    if (localStorage.getItem('userRole') !== 'admin') return;

    var onProfilePage = /admin-profile\.html$/.test(window.location.pathname);

    function token() {
        return localStorage.getItem('admin_token') || localStorage.getItem('token');
    }

    function fallback(name, size) {
        return 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name || 'Admin') +
            '&background=2a7a4b&color=fff&size=' + size;
    }

    function apply(pic) {
        var name = localStorage.getItem('fullName') || 'Admin';
        document.querySelectorAll('.ad-avatar img').forEach(function (img) { img.src = pic || fallback(name, 70); });
        document.querySelectorAll('.ad-header-profile img').forEach(function (img) { img.src = pic || fallback(name, 40); });
        var nameEl = document.getElementById('adAdminName');
        if (nameEl) nameEl.textContent = name;
    }

    function makeClickable() {
        if (onProfilePage) return;
        ['.ad-avatar', '.ad-header-profile'].forEach(function (selector) {
            document.querySelectorAll(selector).forEach(function (el) {
                el.style.cursor = 'pointer';
                el.title = 'My profile';
                el.addEventListener('click', function () { window.location.href = 'admin-profile.html'; });
            });
        });
    }

    function refreshFromServer() {
        if (typeof API_URL === 'undefined' || !token()) return;
        fetch(API_URL + '/api/admin-profile', { headers: { Authorization: 'Bearer ' + token() } })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (!data.success) return;
                localStorage.setItem('fullName', data.user.fullName || '');
                localStorage.setItem('adminProfilePic', data.user.profilePic || '');
                apply(data.user.profilePic);
            })
            .catch(function () { /* keep cached picture */ });
    }

    window.adminAvatar = { apply: apply };

    document.addEventListener('DOMContentLoaded', function () {
        apply(localStorage.getItem('adminProfilePic'));
        makeClickable();
        if (!onProfilePage) refreshFromServer();
    });
})();