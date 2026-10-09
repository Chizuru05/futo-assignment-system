// admin-onboard.js - add one student, or import a list (paste or file)

function getAuthToken() {
    const role = localStorage.getItem('userRole');
    if (!role) return null;
    return localStorage.getItem(`${role}_token`) || localStorage.getItem('token');
}

const token = getAuthToken();
if (!token || localStorage.getItem('userRole') !== 'admin') {
    window.location.href = 'admin-login.html';
}

const LEVELS = ['100', '200', '300', '400', '500'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let previewRows = [];

const $ = id => document.getElementById(id);

// ========== HELPERS ==========
function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function showMsg(el, text, type) {
    el.innerHTML = `<div class="ob-msg ${type}">${escapeHtml(text)}</div>`;
}

function showToast(message, type = 'success') {
    let container = document.getElementById('adToastContainer') || document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ========== ADD ONE ==========
$('oneForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const body = {
        matricNumber: $('oneMatric').value.trim(),
        fullName: $('oneName').value.trim(),
        level: $('oneLevel').value,
        email: $('oneEmail').value.trim().toLowerCase()
    };

    const btn = $('oneBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating...';

    try {
        const res = await fetch(`${API_URL}/api/onboard/students`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });
        const data = await res.json().catch(() => ({}));

        if (data.success) {
            showMsg($('oneMsg'),
                `${body.fullName} was created. Login with ${body.matricNumber}, password ${body.matricNumber}.`, 'ok');
            $('oneForm').reset();
            showToast('Student account created');
        } else {
            const type = res.status === 409 ? 'warn' : 'err';
            showMsg($('oneMsg'), data.message || 'Could not create the account.', type);
        }
    } catch (err) {
        console.error(err);
        showMsg($('oneMsg'), 'Cannot connect to the server.', 'err');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-plus"></i> Create account';
    }
});

// ========== PARSING ==========
// Splits one line. Tab-separated if the line has tabs, otherwise comma-separated
// with support for "quoted, text".
function splitRow(line, delim) {
    if (delim === '\t') return line.split('\t').map(s => s.trim());
    const out = [];
    let cur = '';
    let quoted = false;
    for (const ch of line) {
        if (ch === '"') quoted = !quoted;
        else if (ch === ',' && !quoted) { out.push(cur.trim()); cur = ''; }
        else cur += ch;
    }
    out.push(cur.trim());
    return out;
}

function checkRow(r, seen) {
    if (!r.matricNumber) return 'Missing matric number';
    if (!r.fullName) return 'Missing full name';
    if (!LEVELS.includes(r.level)) return 'Level must be 100 to 500';
    if (r.email && !EMAIL_RE.test(r.email)) return 'Invalid email';
    if (seen.has(r.matricNumber)) return 'Repeated in this list';
    seen.add(r.matricNumber);
    return null;
}

function parseList(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return [];

    const delim = lines[0].includes('\t') ? '\t' : ',';
    let table = lines.map(l => splitRow(l, delim));
    let offset = 0;

    // Default column order: matric, name, level, email
    let cols = { matric: 0, name: 1, level: 2, email: 3 };

    // If the first row is a header, find columns by name
    const head = table[0].map(h => h.toLowerCase());
    if (head.some(h => h.includes('matric'))) {
        const find = (...keys) => head.findIndex(h => keys.some(k => h.includes(k)));
        cols = {
            matric: find('matric'),
            name: find('name'),
            level: find('level'),
            email: find('email')
        };
        table = table.slice(1);
        offset = 1;
    }

    const cell = (row, i) => (i >= 0 ? (row[i] || '') : '');
    const seen = new Set();

    return table.map((row, idx) => {
        const r = {
            line: idx + 1 + offset,
            matricNumber: cell(row, cols.matric).replace(/"/g, '').trim(),
            fullName: cell(row, cols.name).replace(/"/g, '').trim(),
            level: cell(row, cols.level).replace(/[^0-9]/g, ''),
            email: cell(row, cols.email).replace(/"/g, '').trim().toLowerCase()
        };
        r.error = checkRow(r, seen);
        return r;
    });
}

// ========== PREVIEW ==========
function renderPreview() {
    previewRows = parseList($('listInput').value);

    const ready = previewRows.filter(r => !r.error).length;
    const attention = previewRows.length - ready;

    $('statDetected').textContent = previewRows.length;
    $('statReady').textContent = ready;
    $('statAttention').textContent = attention;

    if (previewRows.length === 0) {
        $('previewWrap').classList.add('hidden');
        showMsg($('importMsg'), 'Paste a list or choose a file first.', 'warn');
        return;
    }

    $('importMsg').innerHTML = '';
    $('previewWrap').classList.remove('hidden');
    $('previewSummary').innerHTML =
        `${previewRows.length} row${previewRows.length !== 1 ? 's' : ''} found: ` +
        `<span style="color:#2a7a4b;">${ready} ready</span>` +
        (attention ? `, <span style="color:#b91c1c;">${attention} need attention</span>` : '');

    $('previewBody').innerHTML = previewRows.map((r, i) => `
        <tr>
            <td>${i + 1}</td>
            <td><span class="matric-number">${escapeHtml(r.matricNumber || '—')}</span></td>
            <td>${escapeHtml(r.fullName || '—')}</td>
            <td>${escapeHtml(r.level || '—')}</td>
            <td>${escapeHtml(r.email || '—')}</td>
            <td>${r.error
                ? `<span class="ob-pill bad">${escapeHtml(r.error)}</span>`
                : `<span class="ob-pill ok">Ready</span>`}</td>
        </tr>`).join('');

    $('importCount').textContent = ready;
    $('importBtn').disabled = ready === 0;
}

$('previewBtn').addEventListener('click', renderPreview);

// ========== FILE INPUT / DROP ==========
function readFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        $('listInput').value = reader.result;
        renderPreview();
    };
    reader.readAsText(file);
}

const dropzone = $('dropzone');
$('browseLink').addEventListener('click', () => $('fileInput').click());
dropzone.addEventListener('click', () => $('fileInput').click());
$('fileInput').addEventListener('change', e => readFile(e.target.files[0]));

['dragenter', 'dragover'].forEach(evt => dropzone.addEventListener(evt, e => {
    e.preventDefault();
    dropzone.classList.add('drag');
}));
['dragleave', 'drop'].forEach(evt => dropzone.addEventListener(evt, e => {
    e.preventDefault();
    dropzone.classList.remove('drag');
}));
dropzone.addEventListener('drop', e => readFile(e.dataTransfer.files[0]));

// ========== IMPORT ==========
$('importBtn').addEventListener('click', async () => {
    const ready = previewRows.filter(r => !r.error);
    if (ready.length === 0) return;

    if (!confirm(`Create ${ready.length} student account(s)? Each password will be the matric number.`)) return;

    const btn = $('importBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Importing...';

    try {
        const res = await fetch(`${API_URL}/api/onboard/students/bulk`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                students: ready.map(r => ({
                    matricNumber: r.matricNumber,
                    fullName: r.fullName,
                    level: r.level,
                    email: r.email
                }))
            })
        });
        const data = await res.json().catch(() => ({}));

        if (!data.success) {
            showMsg($('importMsg'), data.message || 'Import failed.', 'err');
            return;
        }

        renderImportResult(data);
        $('listInput').value = '';
        $('fileInput').value = '';
        previewRows = [];
        $('previewWrap').classList.add('hidden');
        $('statDetected').textContent = 0;
        $('statReady').textContent = 0;
        $('statAttention').textContent = 0;
    } catch (err) {
        console.error(err);
        showMsg($('importMsg'), 'Cannot connect to the server.', 'err');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-file-import"></i> Import <span id="importCount">0</span> students`;
    }
});

function renderImportResult(data) {
    const s = data.summary;
    const problems = data.results.filter(r => r.status !== 'created');

    const list = problems.length
        ? `<div class="ob-scroll" style="margin-top:1rem;">
               <table class="data-table">
                   <thead><tr><th>Line</th><th>Matric</th><th>Result</th></tr></thead>
                   <tbody>
                       ${problems.map(r => `
                           <tr>
                               <td>${r.line}</td>
                               <td><span class="matric-number">${escapeHtml(r.matricNumber)}</span></td>
                               <td><span class="ob-pill ${r.status === 'skipped' ? 'warn' : 'bad'}">${escapeHtml(r.message)}</span></td>
                           </tr>`).join('')}
                   </tbody>
               </table>
           </div>`
        : '';

    $('importMsg').innerHTML = `
        <div class="ob-msg ok" style="margin-top:1.2rem;">
            <div class="ob-summary">
                <span class="ob-pill ok">${s.created} created</span>
                <span class="ob-pill warn">${s.skipped} already existed</span>
                <span class="ob-pill bad">${s.errors} errors</span>
            </div>
            Accounts were created with the matric number as the password.
        </div>
        ${list}`;
}

// ========== TABS ==========
document.querySelectorAll('.ob-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.ob-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        $('panelOne').classList.toggle('hidden', tab.dataset.tab !== 'one');
        $('panelList').classList.toggle('hidden', tab.dataset.tab !== 'list');
    });
});

// ========== SIDEBAR, THEME, SESSION ==========
function setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const menuBtn = document.getElementById('menuBtn');

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            if (window.innerWidth <= 1024) sidebar.classList.remove('show');
            else sidebar.classList.toggle('collapsed');
        });
    }
    if (menuBtn) menuBtn.addEventListener('click', () => sidebar.classList.toggle('show'));

    document.addEventListener('click', e => {
        if (window.innerWidth <= 1024 && !sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
            sidebar.classList.remove('show');
        }
    });

    if (window.innerWidth <= 1024) sidebar.classList.remove('collapsed');
}

function setupTheme() {
    if (localStorage.getItem('futoTheme') === 'dark') document.body.classList.add('dark');
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark');
            localStorage.setItem('futoTheme', document.body.classList.contains('dark') ? 'dark' : 'light');
        });
    }
}

async function loadSession() {
    try {
        const res = await fetch(`${API_URL}/api/settings`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            $('sidebarSession').textContent = `${data.settings.activeSession} ${data.settings.activeSemester}`;
        }
    } catch (err) {
        $('sidebarSession').textContent = '2025-2026 Harmattan';
    }
}

document.getElementById('logoutBtn').addEventListener('click', e => {
    e.preventDefault();
    localStorage.clear();
    window.location.href = 'login.html';
});

document.addEventListener('DOMContentLoaded', () => {
    const name = localStorage.getItem('fullName');
    if (name) $('adminName').textContent = name;
    setupSidebar();
    setupTheme();
    loadSession();
});