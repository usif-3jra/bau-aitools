/* AI for Engineering — generic instructor control room (one per tool, same look as POWE445) */
import { createBackend } from './backend.js';
const C = window.Common, UI = window.UI, T = window.TOOL, esc = UI.esc;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const app = $('#app');
const A = { be: null, students: {}, cfg: C.mergeConfig(T, null), tab: 'wait', editing: false, live: false, lastSig: '' };
const fmtM = x => (Math.round(x * 10) / 10).toString();
const online = r => r.presence && Date.now() - r.presence.lastSeen < 75000;
const foot = `<div class="foot">${esc(T.courseLine)} · CONTROL ROOM · ${C.VERSION} · CREATED BY YOUSSEF AJRA</div>`;
const head = right => `<header class="topbar">${UI.logoHTML()}<div class="brand"><span class="course">${esc(T.courseLine)}</span><span class="title">Control Room — ${esc(T.title)}</span></div>${right || ''}</header>`;
document.title = `Control Room — ${T.title}`;

(async function boot() {
  try { A.be = await createBackend('admin', 'tools/' + T.id); } catch (e) { app.innerHTML = `<div class="login-wrap"><div class="msg bad">${esc(e.message)}</div></div>`; return; }
  (await A.be.adminResume()) ? start() : login();
})();
function login(err) {
  const local = A.be.mode === 'local';
  app.innerHTML = `${head()}<div class="login-wrap"><div class="sheet" style="width:min(460px,100%)"><div class="sheet-label">ADMIN ACCESS</div><h2>Instructor sign-in</h2>
    <p class="lead">${local ? 'Local demo mode: passcode from <code>shared/js/config.js</code>.' : 'Firebase account listed under <code>/admins</code>.'}</p>
    ${local ? '' : '<label>Email</label><input id="em" type="email"><div class="spacer"></div>'}<label>${local ? 'Passcode' : 'Password'}</label><input id="pw" type="password">
    <div class="spacer"></div><button class="btn primary" id="go">SIGN IN</button>${err ? `<div class="msg bad">${esc(err)}</div>` : ''}</div></div>${foot}`;
  const go = async () => { try { await A.be.adminSignIn(local ? '' : $('#em').value.trim(), $('#pw').value); start(); } catch (e) { login(e.message); } };
  $('#go').onclick = go; $('#pw').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
}
function start() {
  app.innerHTML = `${head(`<div class="who"><b>Dr. Youssef Ajra</b><span class="pill ${A.be.mode === 'local' ? 'warn' : 'ok'}">${A.be.mode === 'local' ? 'LOCAL DEMO' : 'FIREBASE LIVE'}</span> <button class="btn sm" id="out">Sign out</button></div>`)}
    <div class="admin-shell"><div class="cards" id="cards"></div><div class="row" style="margin:-6px 0 14px"><span class="mono small" id="live"></span><span class="grow"></span><button class="btn sm" id="refresh">⟳ Refresh</button></div>
    <div class="tabs" id="tabs"></div><section class="sheet" id="pane" style="margin-top:0"></section></div>${foot}`;
  $('#out').onclick = async () => { await A.be.adminSignOut(); location.reload(); };
  $('#refresh').onclick = () => refresh(true);
  A.be.watchConfig(c => { A.cfg = C.mergeConfig(T, c); if (!c) A.be.saveConfig(A.cfg).catch(() => {}); if (A.tab !== 'settings' || !A.editing) render(true); });
  subscribe();
  A.be.onAuthChange(uid => { if (!uid) setLive(false, 'Admin session ended. Sign in again.'); });
  setInterval(() => { cards(); updOnline(); }, 15000); setInterval(() => { if (!A.live) refresh(false); }, 20000);
}
function subscribe() { if (A.unsub) try { A.unsub(); } catch {} A.unsub = A.be.watchStudents(s => { A.students = s || {}; setLive(true); onData(); }, e => setLive(false, 'Live connection lost (' + (e.code || e.message) + '). Press Refresh.')); }
async function refresh(manual) { try { A.students = await A.be.getStudents(); setLive(true); subscribe(); onData(true); if (manual) UI.toast('Refreshed', 'ok'); } catch (e) { setLive(false, 'Refresh failed: ' + (e.code || e.message)); } }
function setLive(ok, msg) { A.live = ok; const el = $('#live'); if (el) el.innerHTML = ok ? `<span class="online on"></span>&nbsp; LIVE · updated ${new Date().toLocaleTimeString()}` : `<span class="online"></span>&nbsp; <span style="color:var(--bad)">${esc(msg)}</span>`; }
function onData(force) { const typing = document.activeElement && document.activeElement.classList.contains('ov'); if (A.tab === 'settings' || A.tab === 'key' || typing) { cards(); tabs(); } else render(force); }
const list = () => Object.entries(A.students).filter(([, r]) => r && r.profile).map(([uid, r]) => ({ uid, ...r, status: r.status || 'pending' }));
const dup = () => { const c = {}; list().forEach(r => { c[r.profile.id] = (c[r.profile.id] || 0) + 1; }); return c; };
const updOnline = () => $$('[data-online]').forEach(d => { const r = A.students[d.dataset.online]; d.classList.toggle('on', !!(r && online(r))); });
function cards() {
  const L = list(), card = (t, v) => `<div class="metric"><span>${t}</span><b>${v}</b></div>`;
  $('#cards').innerHTML = card('WAITING', L.filter(r => r.status === 'pending').length) + card('ADMITTED', L.filter(r => r.status === 'approved').length) + card('ONLINE NOW', L.filter(r => r.status === 'approved' && online(r)).length) +
    card('CHALLENGE PASSED', L.filter(r => r.work && r.work.results && r.work.results.sim && r.work.results.sim.correct).length) +
    card('SESSION', `<em class="pill ${A.cfg.sessionOpen ? 'ok' : 'bad'}" style="font-size:14px;font-style:normal">${A.cfg.sessionOpen ? 'OPEN' : 'CLOSED'}</em> <button class="btn sm" id="tog">${A.cfg.sessionOpen ? 'close' : 'open'}</button>`);
  $('#tog').onclick = () => A.be.saveConfig({ ...A.cfg, sessionOpen: !A.cfg.sessionOpen });
}
function tabs() {
  const t = [['wait', `Waiting room (${list().filter(r => r.status === 'pending').length})`], ['students', 'Students & marks'], ['board', 'Leaderboard'], ['settings', 'Settings & marks'], ['key', 'Answer key']];
  $('#tabs').innerHTML = t.map(([k, n]) => `<button class="tab ${A.tab === k ? 'active' : ''}" data-t="${k}">${n}</button>`).join('');
  $$('#tabs .tab').forEach(b => b.onclick = () => { A.tab = b.dataset.t; A.editing = false; render(true); });
}
function render(force) {
  cards(); tabs();
  const sig = A.tab + JSON.stringify(list().map(r => [r.uid, r.profile, r.status, A.tab === 'wait' ? 0 : r.work, r.overrides, r.presence && r.presence.stage])) + JSON.stringify(A.cfg);
  if (!force && sig === A.lastSig) { updOnline(); return; } A.lastSig = sig;
  const y = window.scrollY; ({ wait: paneWait, students: paneStudents, board: paneBoard, settings: paneSettings, key: paneKey })[A.tab]($('#pane')); window.scrollTo(0, y); updOnline();
}
function paneWait(el) {
  const d = dup(), P = list().filter(r => r.status === 'pending').sort((a, b) => a.profile.requestedAt - b.profile.requestedAt), R = list().filter(r => r.status === 'rejected');
  el.innerHTML = `<div class="sheet-label">WAITING ROOM</div><div class="row"><h2 class="grow">Students requesting access</h2>${P.length ? '<button class="btn ok" id="all">Accept all</button>' : ''}</div>
    ${P.length ? `<table class="adm"><tr><th>#</th><th>NAME</th><th>ID</th><th>REQUESTED</th><th></th></tr>${P.map((r, i) => `<tr><td class="num">${i + 1}</td><td>${esc(r.profile.name)}</td><td class="mono ${d[r.profile.id] > 1 ? 'dup' : ''}">${esc(r.profile.id)}${d[r.profile.id] > 1 ? ' <span class="pill bad">duplicate</span>' : ''}</td><td class="mono">${new Date(r.profile.requestedAt).toLocaleTimeString()}</td><td><button class="btn sm ok" data-a="${r.uid}">Accept</button> <button class="btn sm bad" data-r="${r.uid}">Reject</button></td></tr>`).join('')}</table>` : '<div class="msg info">No pending requests.</div>'}
    ${R.length ? `<h3>Rejected / removed</h3><table class="adm">${R.map(r => `<tr><td>${esc(r.profile.name)}</td><td class="mono">${esc(r.profile.id)}</td><td><button class="btn sm" data-a="${r.uid}">Admit</button> <button class="btn sm bad" data-del="${r.uid}">Delete</button></td></tr>`).join('')}</table>` : ''}`;
  $$('[data-a]', el).forEach(b => b.onclick = () => A.be.setStatus(b.dataset.a, 'approved'));
  $$('[data-r]', el).forEach(b => b.onclick = () => A.be.setStatus(b.dataset.r, 'rejected'));
  $$('[data-del]', el).forEach(b => b.onclick = () => { if (confirm('Delete this record?')) A.be.removeStudent(b.dataset.del); });
  if ($('#all', el)) $('#all', el).onclick = () => P.forEach(r => A.be.setStatus(r.uid, 'approved'));
}
function paneStudents(el) {
  const items = C.markItems(T), L = list().filter(r => r.status === 'approved').sort((a, b) => a.profile.name.localeCompare(b.profile.name)), d = dup();
  el.innerHTML = `<div class="sheet-label">STUDENTS & MARKS</div><div class="row"><h2 class="grow">Admitted students (${L.length})</h2><button class="btn" id="csv">⬇ Export results CSV</button></div>
    <p class="lead">Type in a cell to override that student's mark; clear it to return to the automatic mark (shown as the placeholder).</p>
    <div class="tbl-wrap"><table class="adm"><tr><th></th><th>NAME</th><th>ID</th><th>STAGE</th>${items.map(q => `<th title="${esc(q.label)}">${esc(q.key.toUpperCase())}<br>/${fmtM(A.cfg.weights[q.key] || 0)}</th>`).join('')}<th>TOTAL</th><th>%</th><th>INDEX</th><th></th></tr>
    ${L.map(r => { const res = (r.work && r.work.results) || {}, mk = C.computeMarks(T, res, r.overrides, A.cfg);
      return `<tr><td><span class="online" data-online="${r.uid}"></span></td><td>${esc(r.profile.name)}</td><td class="mono ${d[r.profile.id] > 1 ? 'dup' : ''}">${esc(r.profile.id)}</td><td class="num">${r.presence ? r.presence.stage || '—' : '—'}</td>
        ${mk.rows.map(q => `<td class="num" style="background:${q.done ? (q.correct ? '#eef8f3' : '#fdf0ee') : '#fff'}"><input class="ov" data-u="${r.uid}" data-k="${q.key}" value="${q.override ?? ''}" placeholder="${fmtM(q.auto)}"></td>`).join('')}
        <td class="num"><b>${fmtM(mk.earned)}</b></td><td class="num">${mk.pct.toFixed(1)}</td><td class="num">${res.sim && res.sim.bestIndex ? res.sim.bestIndex : '—'}</td>
        <td style="white-space:nowrap"><button class="btn sm" data-rep="${r.uid}">Report</button> <button class="btn sm" data-key="${esc(r.profile.id)}">Key</button> <button class="btn sm" data-reset="${r.uid}">Reset</button> <button class="btn sm bad" data-kick="${r.uid}">Remove</button></td></tr>`; }).join('') || `<tr><td colspan="${items.length + 8}" class="muted">No admitted students yet.</td></tr>`}</table></div>`;
  $$('input.ov', el).forEach(i => i.onchange = () => { const v = i.value.trim(); if (v !== '' && !isFinite(Number(v))) { i.value = ''; return; } A.be.setOverride(i.dataset.u, i.dataset.k, v === '' ? null : Number(v)); });
  $$('[data-rep]', el).forEach(b => b.onclick = () => window.Report.open(T, A.students[b.dataset.rep], A.cfg));
  $$('[data-key]', el).forEach(b => b.onclick = () => { A.tab = 'key'; render(true); $('#kid').value = b.dataset.key; $('#kgo').click(); });
  $$('[data-reset]', el).forEach(b => b.onclick = () => { if (confirm('Erase all work of this student?')) A.be.resetWork(b.dataset.reset); });
  $$('[data-kick]', el).forEach(b => b.onclick = () => { if (confirm('Remove this student?')) A.be.setStatus(b.dataset.kick, 'rejected'); });
  $('#csv', el).onclick = () => {
    const head = ['name', 'id', 'status', ...items.map(q => q.key), 'total', 'out_of', 'percent', 'ml_metric', 'ml_model', 'best_index', 'certificate'];
    const rows = list().map(r => { const res = (r.work && r.work.results) || {}, mk = C.computeMarks(T, res, r.overrides, A.cfg);
      return [r.profile.name, r.profile.id, r.status, ...mk.rows.map(q => q.earned), mk.earned, mk.total, mk.pct.toFixed(2), res.ml ? res.ml.text : '', res.ml ? res.ml.modelType : '', res.sim ? res.sim.bestIndex : '', r.work && r.work.cert ? r.work.cert.code : '']; });
    UI.download(`${T.id}_results_${new Date().toISOString().slice(0, 10)}.csv`, [head, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
  };
}
function paneBoard(el) {
  const L = list().filter(r => r.status === 'approved').map(r => { const res = (r.work && r.work.results) || {}; return { r, res, mk: C.computeMarks(T, res, r.overrides, A.cfg), ix: res.sim && res.sim.correct ? Number(res.sim.bestIndex || 0) : 0 }; }).sort((a, b) => b.ix - a.ix || b.mk.pct - a.mk.pct);
  el.innerHTML = `<div class="sheet-label">LEADERBOARD</div><h2>Best ${esc(T.challenge.indexLabel || 'Challenge Index')}</h2>
    <table class="adm"><tr><th>RANK</th><th>NAME</th><th>ID</th><th>INDEX</th><th>ML MODEL</th><th>ML METRIC</th><th>MARKS %</th></tr>
    ${L.map((x, i) => `<tr><td class="num"><b>${i + 1}</b></td><td>${esc(x.r.profile.name)}</td><td class="mono">${esc(x.r.profile.id)}</td><td class="num"><b>${x.ix ? x.ix.toFixed(1) : '—'}</b></td><td>${esc(x.res.ml ? x.res.ml.modelType : '')}</td><td class="num">${esc(x.res.ml ? x.res.ml.text : '—')}</td><td class="num">${x.mk.pct.toFixed(1)}</td></tr>`).join('')}</table>`;
}
function paneSettings(el) {
  const c = JSON.parse(JSON.stringify(A.cfg));
  const num = (path, label, step = 1, extra = '') => { const v = path.split('.').reduce((o, k) => o[k], c); return `<div><label>${label}</label><input type="number" step="${step}" data-p="${path}" value="${v}" ${extra}></div>`; };
  const cls = T.ml.task === 'classification';
  el.innerHTML = `<div class="sheet-label">SETTINGS & MARKS</div><h2>Challenge settings</h2><p class="lead">Changes apply live to every student of this tool.</p>
    <h3>Question weights (marks)</h3><div class="settings-grid">${C.markItems(T).map(q => num('weights.' + q.key, q.label, 0.5, 'min="0"')).join('')}</div>
    <h3>Attempts, tolerance, dataset</h3><div class="settings-grid">${num('attempts', 'Attempts per question', 1, 'min="1"')}${num('tolPct', 'Numeric tolerance (%)', 0.1)}${num('datasetN', T.ml.mode === 'browser' ? 'Rows per “Generate” click (200–3000)' : 'Dataset size N (3000–5000)', 100, 'min="3000" max="5000"')}
      ${num('mlThreshold', cls ? 'ML pass: minimum accuracy (0–1)' : 'ML pass: minimum R²', 0.001, 'min="0" max="1"')}${num('minIndex', 'Challenge pass: minimum index (0–100)', 1)}</div>
    <h3>Challenge conditions</h3><div class="settings-grid">${(T.challenge.settings || []).map(s => num('challenge.' + s.key, `${s.label}${s.unit ? ' (' + s.unit + ')' : ''}`, s.step || 1, `min="${s.min}" max="${s.max}"`)).join('')}</div>
    <h3>Other</h3><div class="settings-grid"><div><label><input type="checkbox" data-p="certRequiresPass" ${c.certRequiresPass ? 'checked' : ''}> Certificate requires a passed challenge</label></div><div><label><input type="checkbox" data-p="sessionOpen" ${c.sessionOpen ? 'checked' : ''}> Session open for sign-ins</label></div></div>
    <div class="row" style="margin-top:18px"><button class="btn primary" id="sv">SAVE SETTINGS</button><button class="btn" id="df">Restore defaults</button><span id="svm" class="mono small"></span></div>`;
  el.oninput = () => { A.editing = true; };
  $('#sv', el).onclick = async () => {
    $$('[data-p]', el).forEach(i => { const ks = i.dataset.p.split('.'); let o = c; for (let k = 0; k < ks.length - 1; k++) o = o[ks[k]]; o[ks.at(-1)] = i.type === 'checkbox' ? i.checked : Number(i.value); });
    c.datasetN = T.ml.mode === 'browser' ? Math.max(200, Math.min(3000, Math.round(c.datasetN))) : Math.max(3000, Math.min(5000, Math.round(c.datasetN))); await A.be.saveConfig(c); A.editing = false; $('#svm', el).textContent = 'saved ✓'; UI.toast('Settings saved', 'ok');
  };
  $('#df', el).onclick = async () => { if (confirm('Restore defaults?')) { await A.be.saveConfig({ ...C.defaultConfig(T), sessionOpen: A.cfg.sessionOpen }); A.editing = false; render(true); } };
}
function paneKey(el) {
  el.innerHTML = `<div class="sheet-label">ANSWER KEY</div><h2>Answer key for any student ID</h2><div class="row"><input id="kid" type="text" placeholder="20XXXXXXX" style="max-width:200px"><button class="btn primary" id="kgo">Show</button></div><div id="kout"></div>`;
  $('#kgo', el).onclick = () => {
    const v = C.validateId($('#kid', el).value); if (!v.ok) { $('#kout', el).innerHTML = `<div class="msg bad">${v.msg}</div>`; return; }
    const p = Object.assign(T.params(v.value), { _id: String(v.value) }), s = A.cfg.challenge, ref = T.challenge.run(p, s, 'reference'), conv = T.challenge.run(p, s, 'conventional');
    $('#kout', el).innerHTML = `<div class="spacer"></div>${T.systemHTML(p)}${T.sheets.map(sh => { const a = sh.answers(p); return `<h3>${esc(sh.title)}</h3><table class="spec">${sh.keys.map(k => `<tr><td>${k.label}</td><td class="num">${C.fmt(a[k.key], 6)}</td><td>${esc(k.unit || '')}</td></tr>`).join('')}</table>${sh.solution ? `<details><summary class="small">worked solution</summary>${sh.solution(p)}</details>` : ''}`; }).join('')}
      <h3>Challenge (current settings)</h3><table class="spec"><tr><th>RUN</th>${T.challenge.metrics.map(m => `<th>${esc(m.label)}</th>`).join('')}<th>${esc(T.challenge.costLabel || 'cost')}</th></tr>
      ${[[T.challenge.refLabel || 'Reference', ref], [T.challenge.convLabel, conv]].map(([n, r]) => `<tr><td>${esc(n)}</td>${T.challenge.metrics.map(m => `<td class="num">${C.fmt(r.metrics[m.key], 4)}</td>`).join('')}<td class="num">${C.fmt(r.cost, 5)}</td></tr>`).join('')}</table>
      <div class="row" style="margin-top:12px"><button class="btn" id="kds">⬇ Student dataset (CSV)</button></div>`;
    $('#kds', el).onclick = () => UI.download(`${T.id}_dataset_${v.value}.csv`, C.toCSV([...T.ml.predictors.map(x => x.name), T.ml.response.name], T.ml.dataset(p, v.value, A.cfg.datasetN)), 'text/csv');
  };
}
