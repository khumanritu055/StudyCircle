/* StudyCircle: sidebar with Home, Browse notes, About + account links */
window.SITE_CFG = {
  show: 'scShow', hero: '.sc-hero', home: 'home',
  pages: {
    home: `<div class="sc-card p-4 p-lg-5 mb-3"><h1 class="fw-bold">Good notes should not stay in one notebook.</h1>
        <p class="lead text-muted mt-2">Find notes by subject and semester, rate what helped you, and share your own so the next batch has it easier.</p>
        <div class="d-flex gap-2 flex-wrap mt-3"><button class="btn btn-sc btn-lg" onclick="scShow('browse')">Browse notes</button>
          <button class="btn btn-lg btn-ghost w-auto" onclick="scShow('upload')">Upload a note</button></div></div>
      <div class="row g-3">
        <div class="col-md-4"><div class="sc-card p-3 h-100"><h6>1. Search</h6><p class="mb-0 text-muted">Filter by subject or semester.</p></div></div>
        <div class="col-md-4"><div class="sc-card p-3 h-100"><h6>2. Rate</h6><p class="mb-0 text-muted">Give 1 to 5 stars so the best notes rise to the top.</p></div></div>
        <div class="col-md-4"><div class="sc-card p-3 h-100"><h6>3. Share</h6><p class="mb-0 text-muted">Upload yours. An admin checks it before it goes live.</p></div></div></div>`,
    about: `<div class="sc-card p-4"><h2>About StudyCircle</h2>
      <p class="mt-3">StudyCircle is a student notes sharing platform built as a college project. Students upload notes, an admin approves them, and everyone can download and rate the approved ones.</p>
      <p>It is built with HTML, CSS, JavaScript, Bootstrap, Node.js and MongoDB.</p>
      <p class="text-muted mb-0">Developed by Khuman Ritu.</p></div>`
  },
  nav() {
    const L = (p, t) => `<button class="nl" data-page="${p}" onclick="scShow('${p}')">${t}</button>`;
    const acct = me
      ? `<div class="who px-2 mt-3 mb-1">Signed in as ${esc(me.name)}</div>
         ${me.role === 'student' ? L('upload', 'Upload note') : ''}
         ${L('dash', me.role === 'admin' ? 'Admin panel' : 'My uploads')}
         <button class="btn-ghost mt-2" onclick="scOpenAuth('login')">Switch account</button>
         <button class="btn-ghost mt-2" onclick="scLogout()">Log out</button>`
      : `<button class="btn-ghost mt-3" onclick="scOpenAuth('login')">Log in</button>
         <button class="btn btn-sm btn-sc mt-2 w-100" onclick="scOpenAuth('register')">Sign up</button>`;
    return `${L('home', 'Home')}${L('browse', 'Browse notes')}${L('about', 'About')}${acct}`;
  }
};

/* ---- page engine: extra pages, nav, back button (shared logic) ---- */
(function () {
  const C = window.SITE_CFG, orig = window[C.show], stack = [], PROTECTED = ['dash', 'upload', 'post', 'create'];
  let current = null;
  const main = document.querySelector('main');
  Object.entries(C.pages).forEach(([id, html]) => {
    const s = document.createElement('section');
    s.id = 'view-' + id; s.className = 'site-page d-none'; s.innerHTML = html;
    main.appendChild(s);
  });
  const bar = document.createElement('div');
  bar.id = 'backBar'; bar.className = 'd-none mb-3';
  bar.innerHTML = '<button class="back-btn" onclick="goBack()">&larr; Back</button>';
  $('alertBox').after(bar);
  const hero = document.querySelector(C.hero);
  function setActive(v) { document.querySelectorAll('[data-page]').forEach(e => e.classList.toggle('active', e.dataset.page === v)); }
  window[C.show] = function (v, fromBack) {
    const isPage = !!C.pages[v];
    if (!isPage && PROTECTED.includes(v) && !me) return orig(v);       // asks the user to log in
    if (!fromBack && current && current !== v) stack.push(current);
    current = v;
    document.querySelectorAll('.site-page').forEach(s => s.classList.toggle('d-none', s.id !== 'view-' + v));
    if (isPage) ['browse', 'dash', 'upload', 'post', 'create'].forEach(x => { const e = $('view-' + x); if (e) e.classList.add('d-none'); });
    else orig(v);
    if (hero) hero.classList.toggle('d-none', v !== 'browse');
    bar.classList.toggle('d-none', v === C.home || v === 'browse');
    setActive(v); window.scrollTo(0, 0);
  };
  window.goBack = function () { window[C.show](stack.pop() || C.home, true); };
  window.renderNav = function () { $('navRight').innerHTML = C.nav(); setActive(current); };
  window[C.show](C.home);
})();
