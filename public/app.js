let me = null, authMode = 'login';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const modal = id => bootstrap.Modal.getOrCreateInstance($(id));
const alertHtml = (m, t = 'danger') => `<div class="alert alert-${t} py-2">${esc(m)}</div>`;
function flash(m, t = 'success') { window.scrollTo({ top: 0, behavior: 'smooth' }); $('alertBox').innerHTML = alertHtml(m, t); setTimeout(() => $('alertBox').innerHTML = '', 3500); }

async function api(url, method = 'GET', body) {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

function renderNav() {
  $('navRight').innerHTML = me
    ? `<span class="text-white-50 d-none d-md-inline">Hi, ${esc(me.name)} (${me.role})</span>
       ${me.role === 'student' ? '<button class="btn btn-sm btn-sc" onclick="scShow(\'upload\')">Upload note</button>' : ''}
       <button class="btn btn-sm btn-outline-light" onclick="scShow('dash')">${me.role === 'admin' ? 'Admin panel' : 'My uploads'}</button>
       <button class="btn btn-sm btn-outline-light" onclick="scLogout()">Log out</button>`
    : `<button class="btn btn-sm btn-outline-light" onclick="scOpenAuth('login')">Log in</button>
       <button class="btn btn-sm btn-sc" onclick="scOpenAuth('register')">Sign up</button>`;
}
function scShow(v) {
  if ((v === 'dash' || v === 'upload') && !me) return scOpenAuth('login');
  ['browse', 'dash', 'upload'].forEach(x => $('view-' + x).classList.toggle('d-none', x !== v));
  if (v === 'browse') scLoadNotes();
  if (v === 'dash') scLoadDash();
}

// ---------- Auth ----------
function scOpenAuth(m) { authMode = m; scApplyAuth(); $('authAlert').innerHTML = ''; modal('authModal').show(); }
function scToggleAuth() { authMode = authMode === 'login' ? 'register' : 'login'; scApplyAuth(); }
function scApplyAuth() {
  const reg = authMode === 'register';
  $('regOnly').classList.toggle('d-none', !reg);
  $('authTitle').textContent = $('authBtn').textContent = reg ? 'Create account' : 'Log in';
  $('authSwitch').textContent = reg ? 'Already have an account? Log in' : 'New here? Create an account';
}
async function scSubmitAuth() {
  try {
    const body = { email: $('a_email').value, password: $('a_pass').value };
    if (authMode === 'register') Object.assign(body, { name: $('a_name').value, role: $('a_role').value });
    me = await api('/api/' + authMode, 'POST', body);
    modal('authModal').hide(); renderNav(); scShow('browse'); flash(`Welcome, ${me.name}!`);
  } catch (e) { $('authAlert').innerHTML = alertHtml(e.message); }
}
async function scLogout() { await api('/api/logout', 'POST'); me = null; renderNav(); scShow('browse'); }

// ---------- Browse ----------
const starsRow = (n, canRate) => `<span class="stars">${[1, 2, 3, 4, 5].map(i =>
  `<button ${canRate ? `onclick="scRate('${n._id}',${i})"` : 'disabled'} class="${i <= Math.round(n.avgRating) ? 'on' : ''}" aria-label="${i} star">&#9733;</button>`).join('')}</span>
  <span class="small text-muted">${n.ratingCount ? n.avgRating + ' (' + n.ratingCount + ')' : 'No ratings yet'}</span>`;

async function scLoadNotes() {
  const list = await api(`/api/notes?q=${encodeURIComponent($('q').value)}&semester=${$('sem').value}`);
  $('noteList').innerHTML = list.length ? list.map(n => `
    <div class="col-md-6"><div class="card sc-card h-100"><div class="card-body d-flex flex-column">
      <h5 class="mb-1">${esc(n.title)}</h5>
      <div class="text-muted small mb-2">${esc(n.subject)} - Semester ${n.semester} - by ${n.uploader ? esc(n.uploader.name) : 'unknown'}</div>
      <p class="flex-grow-1 mb-2">${esc(n.description) || '<span class="text-muted">No description.</span>'}</p>
      <div class="mb-2">${starsRow(n, me && me.role === 'student')}</div>
      <div class="d-flex justify-content-between align-items-center">
        <span class="small text-muted">${n.downloads} download(s)</span>
        ${me ? `<a class="btn btn-sm btn-sc" href="/api/notes/${n._id}/download">Download</a>` : '<span class="small text-muted">Log in to download</span>'}
      </div>
    </div></div></div>`).join('')
    : '<div class="col-12"><div class="alert alert-light border">No notes found yet. Try another search, or upload the first one.</div></div>';
}
async function scRate(id, stars) {
  try { await api(`/api/notes/${id}/rate`, 'POST', { stars }); scLoadNotes(); flash('Thanks for rating.'); }
  catch (e) { flash(e.message, 'danger'); }
}

// ---------- Upload (file needs FormData, not JSON) ----------
async function scUpload() {
  const f = $('u_file').files[0];
  if (!f) return $('upAlert').innerHTML = alertHtml('Choose a file to upload.');
  const fd = new FormData();
  fd.append('title', $('u_title').value); fd.append('subject', $('u_subject').value);
  fd.append('semester', $('u_sem').value); fd.append('description', $('u_desc').value); fd.append('file', f);
  try {
    const r = await fetch('/api/notes', { method: 'POST', body: fd });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Upload failed.');
    ['u_title', 'u_subject', 'u_sem', 'u_desc', 'u_file'].forEach(i => $(i).value = '');
    $('upAlert').innerHTML = ''; scShow('dash'); flash('Uploaded. It will appear after an admin approves it.');
  } catch (e) { $('upAlert').innerHTML = alertHtml(e.message); }
}

// ---------- Dashboard ----------
async function scApprove(id) { await api(`/api/notes/${id}/approve`, 'POST'); scLoadDash(); flash('Note approved.'); }
async function scRemove(id) { if (!confirm('Delete this note permanently?')) return; await api('/api/notes/' + id, 'DELETE'); scLoadDash(); }

async function scLoadDash() {
  const d = await api('/api/dashboard');
  if (me.role === 'student') {
    $('view-dash').innerHTML = '<h4 class="mb-3">My uploads</h4>' + (d.notes.length ? d.notes.map(n => `
      <div class="card sc-card mb-2"><div class="card-body d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div><strong>${esc(n.title)}</strong> <span class="badge badge-${n.status}">${n.status === 'pending' ? 'waiting for approval' : 'approved'}</span>
          <div class="text-muted small">${esc(n.subject)} - Semester ${n.semester} - ${n.downloads} download(s) - ${n.ratingCount ? n.avgRating + ' stars' : 'no ratings'}</div></div>
        <button class="btn btn-sm btn-outline-danger" onclick="scRemove('${n._id}')">Delete</button>
      </div></div>`).join('') : '<div class="alert alert-light border">You have not uploaded any notes yet.</div>');
    return;
  }
  $('view-dash').innerHTML = `<h4 class="mb-3">Admin panel</h4>
    <div class="row g-3 mb-4">
      <div class="col-md-4"><div class="card sc-card"><div class="card-body"><div class="stat">${d.pending.length}</div>Notes waiting for approval</div></div></div>
      <div class="col-md-4"><div class="card sc-card"><div class="card-body"><div class="stat">${d.totalNotes}</div>Approved notes</div></div></div>
      <div class="col-md-4"><div class="card sc-card"><div class="card-body"><div class="stat">${d.totalUsers}</div>Students</div></div></div>
    </div><h5>Waiting for approval</h5>` + (d.pending.length ? d.pending.map(n => `
      <div class="card sc-card mb-2"><div class="card-body d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div><strong>${esc(n.title)}</strong><div class="text-muted small">${esc(n.subject)} - Semester ${n.semester} - by ${n.uploader ? esc(n.uploader.name) : 'unknown'} - ${esc(n.originalName)}</div></div>
        <div class="d-flex gap-2"><a class="btn btn-sm btn-outline-secondary" href="/api/notes/${n._id}/download">Check file</a>
          <button class="btn btn-sm btn-sc" onclick="scApprove('${n._id}')">Approve</button>
          <button class="btn btn-sm btn-outline-danger" onclick="scRemove('${n._id}')">Reject and delete</button></div>
      </div></div>`).join('') : '<div class="alert alert-light border">Nothing waiting. New uploads will show up here.</div>');
}

(async () => { me = await api('/api/me'); renderNav(); scLoadNotes(); })();
