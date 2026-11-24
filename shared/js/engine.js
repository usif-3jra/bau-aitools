/* AI for Engineering — generic student application. Each tool defines window.TOOL (see shared/README.md). */
import { createBackend } from './backend.js';
const C = window.Common, UI = window.UI, T = window.TOOL, esc = UI.esc;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const app = $('#app');
const S = { be: null, uid: null, rec: null, cfg: C.mergeConfig(T, null), p: null, view: null, stage: 0, unsub: null, hb: null, anim: null };
const work = () => (S.rec && S.rec.work) || {};
const res = k => ((work().results || {})[k]) || {};
const fmtM = x => (Math.round(x * 10) / 10).toString();
const STAGES = [
  ...T.sheets.map(sh => ({ kind: 'sheet', sheet: sh, t: sh.title, d: sh.short || 'Engineering foundation' })),
  { kind: 'ml', t: 'ML model', d: T.ml.stageDesc || 'Dataset · training · export' },
  { kind: 'challenge', t: 'Challenge', d: T.challenge.short || 'Model vs conventional' },
  { kind: 'results', t: 'Results', d: 'Marks · certificate · report' }
];
const stageKeys = st => st.kind === 'sheet' ? st.sheet.keys.map(k => k.key) : st.kind === 'ml' ? ['ml'] : st.kind === 'challenge' ? ['sim'] : [];
const stageDone = i => STAGES[i].kind !== 'results' && stageKeys(STAGES[i]).every(k => res(k).done);
const unlocked = i => { for (let j = 0; j < i; j++) if (!stageDone(j)) return false; return true; };
const save = patch => S.be.saveWork(S.uid, patch).catch(e => UI.toast('Save failed: ' + e.message, 'bad'));
const footer = () => `<div class="foot">${esc(T.courseLine)} · ${C.VERSION} · CREATED BY YOUSSEF AJRA</div>`;
const head = (right = '') => `<header class="topbar">${UI.logoHTML()}<div class="brand"><span class="course">${esc(T.courseLine)}</span><span class="title">${esc(T.title)}</span></div>${right}</header>`;
document.title = `${T.courseLine} — ${T.title}`;

(async function boot() {
  try { S.be = await createBackend('student', 'tools/' + T.id); }
  catch (e) { app.innerHTML = `<div class="login-wrap"><div class="msg bad">Could not connect: ${esc(e.message)}</div></div>`; return; }
  S.be.watchConfig(c => { S.cfg = C.mergeConfig(T, c); if (S.view === 'login') renderLogin(); if (S.view === 'main') chrome(); });
  const uid = await S.be.studentResume();
  uid ? attach(uid) : renderLogin();
})();
function attach(uid) {
  S.uid = uid; if (S.unsub) S.unsub();
  S.unsub = S.be.watchStudent(uid, rec => {
    const prev = S.rec && S.rec.status; S.rec = rec;
    if (!rec || !rec.profile) return renderLogin();
    if (!S.p || S.p._id !== rec.profile.id) { S.p = T.params(rec.profile.id); S.p._id = String(rec.profile.id); }
    const st = rec.status || 'pending';
    if (st === 'approved') { if (S.view !== 'main' || prev !== 'approved') renderMain(); else chrome(); }
    else if (st === 'rejected') renderRejected(); else renderWaiting();
  });
  clearInterval(S.hb); S.hb = setInterval(() => S.be.heartbeat(S.uid, S.view === 'main' ? S.stage + 1 : 0).catch(() => {}), 30000);
  S.be.heartbeat(S.uid, 0).catch(() => {});
}

/* ---------------------------------------------------------------- access */
function renderLogin() {
  S.view = 'login'; const open = S.cfg.sessionOpen !== false;
  app.innerHTML = `${head()}<div class="login-wrap"><div class="login-card"><div class="sheet-label">SHEET 00 — ACCESS</div>
    <div class="art"><div class="mono small muted">FIG. 0 — ${esc(T.sketchLabel || 'SYSTEM')}</div>
      <svg viewBox="0 0 420 400" style="width:100%;height:auto">${T.sketchSVG ? T.sketchSVG('#0d2b55', '#1f5fa8') : ''}</svg>
      <div class="small muted">${esc(T.subtitle)}</div></div>
    <div class="form"><div class="login-head">${UI.logoHTML()}<div><div class="mono small muted">${esc(T.courseLine)}</div><h1>Technical Assessment</h1></div></div>
      <p class="muted" style="margin:0">Sign in with your full name and university ID. The instructor admits each student from the control room.</p>
      <div><label for="fn">Full name (first · father · family)</label><input id="fn" type="text" autocomplete="name"><div class="hint" id="fnh"></div></div>
      <div><label for="sid">Student ID</label><input id="sid" type="text" inputmode="numeric" maxlength="9" placeholder="20XXXXXXX"><div class="hint" id="sidh"></div></div>
      <button class="btn primary" id="go" ${open ? '' : 'disabled'}>REQUEST ACCESS →</button>
      ${open ? '' : '<div class="msg warn">The session is closed. Wait for the instructor to open it.</div>'}
      ${S.be && S.be.mode === 'local' ? '<div class="msg info small">Local demo mode: data stays in this browser.</div>' : ''}<div id="lerr"></div></div></div></div>${footer()}`;
  const fn = $('#fn'), sid = $('#sid');
  const v = () => {
    const a = C.validateName(fn.value), b = C.validateId(sid.value);
    fn.classList.toggle('invalid', !!fn.value && !a.ok); fn.classList.toggle('valid', a.ok); sid.classList.toggle('invalid', !!sid.value && !b.ok); sid.classList.toggle('valid', b.ok);
    $('#fnh').textContent = fn.value && !a.ok ? a.msg : ''; $('#fnh').className = 'hint err'; $('#sidh').textContent = sid.value && !b.ok ? b.msg : ''; $('#sidh').className = 'hint err';
    return a.ok && b.ok ? { name: a.value, id: b.value } : null;
  };
  sid.oninput = () => { sid.value = sid.value.replace(/\D/g, '').slice(0, 9); v(); }; fn.oninput = v;
  const go = async () => {
    const ok = v(); if (!ok) { $('#lerr').innerHTML = '<div class="msg bad">Check the highlighted fields.</div>'; return; }
    $('#go').disabled = true;
    try { const uid = await S.be.studentSignIn(); await S.be.requestAccess(uid, { name: ok.name, id: ok.id, requestedAt: Date.now() }); attach(uid); }
    catch (e) { $('#go').disabled = false; $('#lerr').innerHTML = `<div class="msg bad">${esc(e.message)}</div>`; }
  };
  $('#go').onclick = go; [fn, sid].forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') go(); }));
}
function renderWaiting() {
  S.view = 'waiting'; const pr = S.rec.profile;
  app.innerHTML = `${head()}<div class="login-wrap"><div class="sheet" style="max-width:600px;width:100%"><div class="sheet-label">SHEET 00 — WAITING ROOM</div>
    <h2><span class="wait-dot"></span>Waiting for instructor approval</h2><p class="lead">Keep this page open — it opens automatically as soon as you are accepted.</p>
    <dl class="kv"><dt>NAME</dt><dd>${esc(pr.name)}</dd><dt>ID</dt><dd>${esc(pr.id)}</dd></dl><div class="spacer"></div><button class="btn sm" id="chg">Wrong details? Sign out</button></div></div>${footer()}`;
  $('#chg').onclick = signOut;
}
function renderRejected() {
  S.view = 'rejected';
  app.innerHTML = `${head()}<div class="login-wrap"><div class="sheet" style="max-width:560px"><h2>Access not granted</h2><p class="lead">Check your name and ID with the instructor, then sign in again.</p><button class="btn" id="chg">Sign out</button></div></div>${footer()}`;
  $('#chg').onclick = signOut;
}
async function signOut() { if (S.unsub) S.unsub(); S.unsub = null; S.rec = null; clearInterval(S.hb); await S.be.studentSignOut(); renderLogin(); }

/* ---------------------------------------------------------------- shell */
function renderMain() {
  S.view = 'main'; const pr = S.rec.profile;
  app.innerHTML = `${head(`<div class="who"><b>${esc(pr.name)}</b><span class="mono">${esc(pr.id)}</span> <span class="pill ok">ADMITTED</span></div>`)}
    <div class="shell"><nav class="stepper" id="stepper"></nav><main id="stage"></main></div>
    <div class="titleblock"><div><span>PROJECT</span>${esc(T.title.toUpperCase())}</div><div><span>COURSE</span>${esc(T.courseLine)}</div><div><span>CREATED BY</span>YOUSSEF AJRA</div><div><span>REV</span>${C.VERSION}</div><div><span>SHEET</span><b id="sheetno"></b></div></div>${footer()}`;
  let t = 0; for (let i = 0; i < STAGES.length; i++) if (unlocked(i)) t = i;
  S.stage = t; chrome(); go(t);
}
function chrome() {
  if (S.view !== 'main') return;
  const mk = C.computeMarks(T, work().results, S.rec.overrides, S.cfg);
  $('#stepper').innerHTML = STAGES.map((s, i) => { const lk = !unlocked(i), dn = stageDone(i);
    return `<button class="step ${S.stage === i ? 'active' : ''} ${lk ? 'locked' : ''} ${dn ? 'done' : ''}" data-n="${i}" ${lk ? 'disabled' : ''}><span class="num">${dn ? '✓' : i + 1}</span><span>${esc(s.t)}<small>${esc(s.d)}</small></span></button>`; }).join('') +
    `<div class="scorebox"><div class="muted">MARKS</div><div class="big">${fmtM(mk.earned)} / ${fmtM(mk.total)}</div><div>${mk.pct.toFixed(1)} %</div><div class="bar"><i style="width:${mk.pct}%"></i></div>
     <button class="btn sm" id="sbrep" style="margin-top:10px;width:100%;justify-content:center">⬇ Full report (PDF)</button><div class="small muted" style="margin-top:8px">Your system is generated from your ID.</div></div>`;
  $$('#stepper .step').forEach(b => b.onclick = () => { if (!b.disabled) go(+b.dataset.n); });
  $('#sbrep').onclick = openReport; $('#sheetno').textContent = `${S.stage + 1} / ${STAGES.length}`;
}
function go(i) {
  if (!unlocked(i)) return; if (S.anim) cancelAnimationFrame(S.anim);
  S.stage = i; chrome(); S.be.heartbeat(S.uid, i + 1).catch(() => {});
  const st = STAGES[i], el = $('#stage');
  ({ sheet: renderSheet, ml: renderML, challenge: renderChallenge, results: renderResults })[st.kind](el, st, i);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
const nextBtn = i => (i < STAGES.length && unlocked(i)) ? `<button class="btn accent" data-next="${i}">Continue to stage ${i + 1} →</button>` : '';
const wireNext = el => $$('[data-next]', el).forEach(b => b.onclick = () => go(+b.dataset.next));
function openReport() { window.Report.open(T, S.rec, S.cfg); }

/* ---------------------------------------------------------------- question sheets */
function renderSheet(el, st, idx) {
  const sh = st.sheet, ans = sh.answers(S.p), att = S.cfg.attempts || 3;
  el.innerHTML = `${idx === 0 ? `<section class="sheet"><div class="sheet-label">SHEET 01 — THE SYSTEM</div><h2>${esc(T.title)}</h2>${T.systemHTML(S.p)}</section>` : ''}
    <section class="sheet"><div class="sheet-label">TASK ${idx + 1} — ${esc(sh.title.toUpperCase())}</div><h2>${esc(sh.title)}</h2><p class="lead">${typeof sh.lead === 'function' ? sh.lead(S.p) : sh.lead}</p>
    <div class="tbl-wrap"><table class="spec"><tr><th>#</th><th>QUANTITY</th><th>YOUR ANSWER</th><th>UNIT</th><th>STATUS</th></tr>
    ${sh.keys.map((k, n) => { const r = res(k.key), left = att - (r.attempts || 0);
      return `<tr><td class="mono">${n + 1}</td><td>${k.label}</td><td><input type="text" data-k="${k.key}" value="${r.answer ?? ''}" ${r.done ? 'disabled' : ''} style="max-width:170px"></td><td class="mono small">${esc(k.unit || '—')}</td>
        <td>${r.done ? (r.correct ? `<span class="pill ok">✔ +${fmtM(S.cfg.weights[k.key] || 0)}</span>` : `<span class="pill bad">✘ answer ${esc(C.fmt(ans[k.key], 5))}</span>`) : `<span class="mono small muted">${left} attempt(s) left</span>`}</td></tr>`; }).join('')}
    </table></div><p class="small muted">Tolerance ±${S.cfg.tolPct}% of the exact value. Use a dot for decimals; scientific notation (1.2e3) is accepted.</p>
    <div class="row" style="margin-top:12px"><button class="btn primary" id="sub" ${stageDone(idx) ? 'disabled' : ''}>SUBMIT ANSWERS</button><span class="grow"></span>${nextBtn(idx + 1)}</div><div id="msg"></div></section>`;
  $('#sub', el).onclick = async () => {
    const patch = {}; let wrong = 0, empty = 0;
    for (const k of sh.keys) {
      const r = res(k.key); if (r.done) continue;
      const v = C.parseNum($(`input[data-k="${k.key}"]`, el).value); if (!isFinite(v)) { empty++; continue; }
      const ok = C.near(v, ans[k.key], k.tolPct ?? S.cfg.tolPct), a = (r.attempts || 0) + 1;
      if (!ok) wrong++;
      patch['results/' + k.key] = { done: ok || a >= att, correct: ok, attempts: a, answer: v, at: Date.now() };
    }
    if (!Object.keys(patch).length) { $('#msg', el).innerHTML = '<div class="msg warn">Enter at least one answer.</div>'; return; }
    await save(patch); renderSheet(el, st, idx); chrome();
    $('#msg', el).innerHTML = wrong ? `<div class="msg bad">${wrong} answer(s) not within tolerance — check them and resubmit.</div>` : `<div class="msg ok">Saved.${empty ? ` ${empty} still empty.` : ''}</div>`;
  };
  wireNext(el);
}

/* ---------------------------------------------------------------- ML stage */
const modelKey = () => `aieng_model_${T.id}_${S.rec.profile.id}`;
function buildModel(j) {
  if (T.ml.mode === 'browser') { const k = JSON.stringify(j); if (S.mcache && S.mcache.k === k) return S.mcache.m; const m = T.ml.buildModel(j, S.p, S.rec.profile.id); S.mcache = { k, m }; return m; }
  if (j.format !== 'AIENG-MODEL-v1') throw new Error('Not an AI-for-Engineering model file. Export it with exportForWeb.m.');
  if (j.toolId !== T.id) throw new Error(`This model belongs to tool "${j.toolId}".`);
  if (String(j.studentId) !== String(S.rec.profile.id)) throw new Error(`This model was exported for ID ${j.studentId}. Use your own dataset and spec file.`);
  return T.ml.mode === 'grid' ? C.makeGridModel(j, T.ml.predictors.map(p => p.name)) : C.makePredModel(j);
}
function loadModel() { try { const j = (T.ml.mode === 'browser' && work().lab && work().lab.model) || JSON.parse(localStorage.getItem(modelKey())); return j ? buildModel(j) : null; } catch (e) { console.warn(e); return null; } }
function validate(model) {
  const ml = T.ml, p = S.p, id = S.rec.profile.id;
  if (ml.validate) return ml.validate(model, p, id);
  let y, yh;
  if (ml.mode === 'grid') { const h = ml.hiddenTest(p, id); y = h.y; yh = h.X.map(x => model(...x)); }
  else { const set = ml.predictSet(p, id), idx = set.ids.map((_, i) => i).filter(i => set.hidden[i]); y = idx.map(i => set.y[i]); yh = idx.map(i => model(set.ids[i])); if (yh.some(v => v === undefined)) throw new Error('The prediction file is missing rows — export it from the spec file of this page.'); }
  if (ml.task === 'classification') { const a = C.accuracy(y, yh); return { value: a, label: 'Accuracy', text: (100 * a).toFixed(2) + ' %' }; }
  const m = C.r2rmse(y, yh.map(Number)); return { value: m.r2, label: 'R²', text: m.r2.toFixed(4), rmse: m.rmse };
}
/* validate a model, keep it, and record the ML result (shared by the upload and the in-browser lab) */
async function recordModel(j) {
  const model = buildModel(j), v = validate(model);
  try { localStorage.setItem(modelKey(), JSON.stringify(j)); } catch { /* storage full: Firebase copy is used */ }
  const prev = res('ml'), best = !prev.done || v.value > (prev.value ?? -Infinity), pass = v.value >= S.cfg.mlThreshold;
  const patch = { 'results/ml': { done: true, correct: !!(prev.correct || pass), value: best ? v.value : prev.value, text: best ? v.text : prev.text, label: v.label, rmse: best ? (v.rmse ?? null) : (prev.rmse ?? null), modelType: j.modelType || 'unknown', attempts: (prev.attempts || 0) + 1, at: Date.now() } };
  if (T.ml.mode === 'browser') patch['lab/model'] = j;
  await save(patch); chrome();
  return { v, model, pass, marks: res('ml').correct ? S.cfg.weights.ml : 0 };
}
function renderML(el, st, idx) {
  if (T.ml.renderLab) return T.ml.renderLab(el, { p: S.p, id: S.rec.profile.id, cfg: S.cfg, work: work(), res, save, recordModel: j => recordModel(j), nextBtn: () => nextBtn(idx + 1), wireNext: () => wireNext(el), idx, C, UI, esc, fmtM });
  const ml = T.ml, p = S.p, id = S.rec.profile.id, N = Math.max(3000, Math.min(5000, Number(S.cfg.datasetN) || 4000)), r = res('ml');
  const learner = ml.task === 'classification' ? 'Classification Learner' : 'Regression Learner';
  const thrTxt = ml.task === 'classification' ? `accuracy ≥ ${(100 * S.cfg.mlThreshold).toFixed(1)} %` : `R² ≥ ${S.cfg.mlThreshold}`;
  el.innerHTML = `<section class="sheet"><div class="sheet-label">SHEET ${idx + 1} — MACHINE LEARNING</div><h2>${esc(ml.title || 'The ML model')}</h2><p class="lead">${ml.explainHTML(p)}</p>
    <h3>Dataset</h3><table class="spec"><tr><th>ROLE</th><th>CSV COLUMN</th><th>MEANING</th><th>UNIT</th><th>RANGE</th></tr>
    ${ml.predictors.map(v => `<tr><td>feature</td><td class="mono">${v.name}</td><td>${v.desc}</td><td>${esc(v.unit || '—')}</td><td class="mono">${v.range ? v.range.join(' … ') : ''}</td></tr>`).join('')}
    <tr><td><b>label</b></td><td class="mono"><b>${ml.response.name}</b></td><td>${ml.response.desc}</td><td>${esc(ml.response.unit || '—')}</td><td class="mono">${ml.response.range ? ml.response.range.join(' … ') : (ml.response.classes || []).join(', ')}</td></tr></table>
    <div class="row" style="margin-top:12px"><button class="btn primary" id="dl">⬇ DATASET (${N} rows, CSV)</button><button class="btn" id="spec">⬇ EXPORT SPEC (JSON)</button><a class="btn" href="${window.SHARED || '../../../shared/'}matlab/exportForWeb.m" download>⬇ exportForWeb.m</a></div>
    <h3>Procedure in MATLAB</h3><ol class="steps-list">
      <li><code>data = readtable('${T.id}_dataset_${esc(id)}.csv');</code></li>
      <li>Apps → <b>${learner}</b> → New Session → from workspace <code>data</code>; response <code>${ml.response.name}</code>; 5-fold cross-validation.</li>
      <li>Train <b>All</b> model types, compare the validation ${ml.task === 'classification' ? 'accuracy and confusion matrix' : 'RMSE and R²'}, and decide which model is best.</li>
      <li>Export the best model to the workspace as <code>trainedModel</code>.</li>
      <li>With <code>exportForWeb.m</code> and the spec file in the current folder: <code>exportForWeb(trainedModel, '${T.id}_spec_${esc(id)}.json')</code></li>
      <li>Upload the file it writes (<code>${T.id}_model_${esc(id)}.json</code>) below.</li></ol>
    <h3>Upload trained model</h3><div class="row"><input type="file" id="mf" accept=".json" class="btn"><span class="mono small muted">pass mark: ${thrTxt} on a hidden test set</span></div>
    <div id="mlres"></div><div class="row" style="margin-top:12px"><span class="grow"></span>${nextBtn(idx + 1)}</div></section>`;
  $('#dl', el).onclick = () => UI.download(`${T.id}_dataset_${id}.csv`, C.toCSV([...ml.predictors.map(v => v.name), ml.response.name], ml.dataset(p, id, N)), 'text/csv');
  $('#spec', el).onclick = () => {
    const spec = { format: 'AIENG-SPEC-v1', toolId: T.id, studentId: id, mode: ml.mode, task: ml.task, predictors: ml.predictors.map(v => v.name) };
    if (ml.mode === 'grid') spec.axes = ml.axes; else { const s = ml.predictSet(p, id); spec.ids = s.ids; spec.X = s.X; }
    UI.download(`${T.id}_spec_${id}.json`, JSON.stringify(spec), 'application/json');
  };
  const show = (v, model, type) => {
    const ok = v.value >= S.cfg.mlThreshold;
    $('#mlres', el).innerHTML = `<div class="grid3" style="margin-top:12px"><div class="metric"><span>MODEL</span><b style="font-size:15px">${esc(type || '—')}</b></div><div class="metric"><span>${v.label} (HIDDEN TEST)</span><b>${v.text}</b></div><div class="metric"><span>${v.rmse !== undefined ? 'RMSE' : 'THRESHOLD'}</span><b>${v.rmse !== undefined ? C.fmt(v.rmse, 4) : thrTxt}</b></div></div>
      <div class="msg ${ok ? 'ok' : 'warn'}">${ok ? `✔ Validation passed${res('ml').correct ? ` — ${fmtM(S.cfg.weights.ml)} marks.` : '.'}` : `Below the pass mark (${thrTxt}). You can still use it in the challenge, but compare more model types for the marks.`}</div>`;
  };
  if (r.done) show({ value: r.value, label: r.label, text: r.text, rmse: r.rmse }, null, r.modelType);
  $('#mf', el).onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const j = JSON.parse(await f.text()), { v, model } = await recordModel(j);
      show(v, model, j.modelType);
      if (!$('[data-next]', el) && unlocked(idx + 1)) { $('#mlres', el).insertAdjacentHTML('beforeend', `<div class="row" style="margin-top:10px">${nextBtn(idx + 1)}</div>`); wireNext(el); }
    } catch (err) { $('#mlres', el).innerHTML = `<div class="msg bad">✘ ${esc(err.message)}</div>`; }
  };
  wireNext(el);
}

/* ---------------------------------------------------------------- challenge */
function renderChallenge(el, st, idx) {
  const ch = T.challenge, p = S.p, model = loadModel(), r = res('sim');
  S.chIn = Object.assign(Object.fromEntries((ch.inputs || []).map(f => [f.key, f.default])), (r.settings && ch.inputs) ? Object.fromEntries(ch.inputs.map(f => [f.key, r.settings[f.key] ?? f.default])) : {}, S.chIn || {});
  let s = { ...S.cfg.challenge, ...S.chIn };
  el.innerHTML = `<section class="sheet"><div class="sheet-label">SHEET ${idx + 1} — CHALLENGE</div><h2>${esc(ch.title)}</h2><p class="lead" id="chdesc">${ch.describe(p, s)}</p>
    ${ch.inputs ? `<div class="row">${ch.inputs.map(f => `<label class="small">${f.label} <select class="btn" data-in="${f.key}">${f.options.map(o => `<option value="${o.value}" ${String(o.value) === String(s[f.key]) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>`).join('')}<span id="innote"></span></div>` : ''}
    <div class="row"><button class="btn" id="rc">▶ RUN ${esc(ch.convLabel.toUpperCase())}</button><button class="btn accent" id="rm" ${model ? '' : 'disabled'}>▶ RUN WITH ML MODEL</button>${model ? `<span class="mono small muted">model: ${esc(model.meta.modelType || '')}</span>` : '<span class="msg warn small">Upload a model in the ML stage first.</span>'}</div>
    ${ch.draw ? '<div class="spacer"></div><div class="canvas-wrap"><canvas id="cv"></canvas></div>' : ''}
    <div class="grid2" style="margin-top:12px">${ch.plots.map((_, i) => `<div><canvas id="pl${i}"></canvas><div class="legend" id="lg${i}"></div></div>`).join('')}</div>
    <div id="out"></div><div class="row" style="margin-top:12px"><span class="grow"></span>${nextBtn(idx + 1)}</div></section>`;
  const cv = $('#cv', el);
  const drawFrame = (trace, i) => {
    if (!cv) return; const dpr = window.devicePixelRatio || 1, w = cv.clientWidth || 800, h = ch.sceneHeight || 300;
    cv.width = w * dpr; cv.height = h * dpr; cv.style.height = h + 'px'; const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    ch.draw(ctx, w, h, p, trace, i, s);
  };
  const plots = (runs, upto) => ch.plots.forEach((pl, k) => {
    const series = []; const legend = [];
    runs.forEach(({ run, tag, dash }) => pl.series.forEach(sr => { if (!run.trace[sr.key]) return; series.push({ data: run.trace[sr.key], color: sr.color, dash: dash || sr.dash, width: tag === 'conv' ? 1.2 : 1.8 }); }));
    pl.series.forEach(sr => legend.push(`<span><i style="border-color:${sr.color};${sr.dash ? 'border-top-style:dashed' : ''}"></i>${esc(sr.label)}</span>`));
    if (runs.length > 1) legend.push('<span>thin dotted = conventional</span>');
    UI.plot($('#pl' + k, el), runs[0].run.trace.t, series, { height: 210, title: pl.title, upto, ylim: pl.ylim });
    $('#lg' + k, el).innerHTML = legend.join('');
  });
  const metricsTable = (rows) => `<div class="tbl-wrap"><table class="spec"><tr><th>RUN</th>${ch.metrics.map(m => `<th>${esc(m.label)}${m.unit ? ' [' + esc(m.unit) + ']' : ''}</th>`).join('')}<th>INDEX</th></tr>
    ${rows.map(([name, run, ix]) => `<tr><td>${name}</td>${ch.metrics.map(m => `<td class="num">${run ? esc(C.fmt(run.metrics[m.key], m.d || 4)) : '—'}</td>`).join('')}<td class="num">${ix ?? '—'}</td></tr>`).join('')}</table></div>`;
  const animate = (runs, after) => {
    if (S.anim) cancelAnimationFrame(S.anim);
    const tr = runs[0].run.trace, n = tr.t.length, dur = ch.animSeconds || 8, t0 = performance.now();
    const step = () => { const i = Math.min(n - 1, Math.floor((performance.now() - t0) / 1000 / dur * n)); if (i % 2 === 0 || i === n - 1) { drawFrame(tr, i); plots(runs, i); } if (i < n - 1) S.anim = requestAnimationFrame(step); else after && after(); };
    S.anim = requestAnimationFrame(step);
  };
  let ref = ch.run(p, s, 'reference'), conv = ch.run(p, s, 'conventional');
  const note = () => { if ($('#innote', el)) $('#innote', el).innerHTML = ch.inputsNote ? ch.inputsNote(p, s) : ''; };
  $$('[data-in]', el).forEach(x => x.onchange = () => { const f = ch.inputs.find(q => q.key === x.dataset.in); S.chIn[f.key] = typeof f.default === 'number' ? Number(x.value) : x.value; s = { ...S.cfg.challenge, ...S.chIn }; ref = ch.run(p, s, 'reference'); conv = ch.run(p, s, 'conventional'); $('#chdesc', el).innerHTML = ch.describe(p, s); note(); drawFrame(conv.trace, 0); plots([{ run: conv, tag: 'conv' }], 0); $('#out', el).innerHTML = ''; });
  note();
  $('#rc', el).onclick = () => { animate([{ run: conv, tag: 'conv' }]); $('#out', el).innerHTML = `<h3>${esc(ch.convLabel)}</h3>${metricsTable([[esc(ch.refLabel || 'Reference (ideal)'), ref, '100'], [esc(ch.convLabel), conv, '0']])}`; };
  $('#rm', el).onclick = async () => {
    let run; try { run = ch.run(p, s, model); } catch (e) { $('#out', el).innerHTML = `<div class="msg bad">${esc(e.message)}</div>`; return; }
    const ix = run.failed ? 0 : C.captureIndex(conv.cost, run.cost, ref.cost), pass = !run.failed && ix >= S.cfg.minIndex, prev = res('sim');
    const mm = Object.fromEntries(ch.metrics.map(m => [m.key, run.metrics[m.key] ?? null]));
    const rec = { done: true, correct: !!(prev.correct || pass), lastIndex: +ix.toFixed(1), bestIndex: Math.max(prev.bestIndex || 0, pass ? +ix.toFixed(1) : 0), runs: (prev.runs || 0) + 1,
      lastMetrics: mm, trace: C.packTrace(run.trace), settings: s, model: model.meta.modelType || '', at: Date.now() };
    rec.best = pass && ix >= (prev.bestIndex || 0) ? { metrics: mm, trace: rec.trace, index: +ix.toFixed(1) } : (prev.best || null);
    await save({ 'results/sim': rec }); chrome();
    animate([{ run }, { run: conv, tag: 'conv', dash: [2, 3] }]);
    $('#out', el).innerHTML = `<h3>Result with your ML model</h3>${metricsTable([[esc(ch.refLabel || 'Reference (ideal)'), ref, '100'], ['<b>With your ML model</b>', run, ix.toFixed(1)], [esc(ch.convLabel), conv, '0']])}
      <div class="msg ${pass ? 'ok' : 'bad'}">${run.failed ? '✘ ' + esc(run.failMsg || 'Run failed.') : pass ? `✔ Challenge passed (index ${ix.toFixed(1)} ≥ ${S.cfg.minIndex})${res('sim').correct ? ` — ${fmtM(S.cfg.weights.sim)} marks` : ''}.` : `✘ Index ${ix.toFixed(1)} is below ${S.cfg.minIndex}. Improve the model and run again.`}</div>
      <p class="small muted">${esc(T.challenge.indexLabel || 'Challenge Index')}: 100 = as good as the ideal reference, 0 = no better than the conventional method.</p>`;
    if (!$('[data-next]', el) && unlocked(idx + 1)) { $('#out', el).insertAdjacentHTML('beforeend', `<div class="row">${nextBtn(idx + 1)}</div>`); wireNext(el); }
  };
  drawFrame(conv.trace, 0); plots([{ run: conv, tag: 'conv' }], 0);
  if (r.done) $('#out', el).innerHTML = `<div class="msg ${r.correct ? 'ok' : 'info'}">Last run: index ${r.lastIndex} · best passing ${r.bestIndex || 0} · ${r.runs} run(s).</div>`;
  wireNext(el);
}

/* ---------------------------------------------------------------- results */
function renderResults(el, st, idx) {
  const mk = C.computeMarks(T, work().results, S.rec.overrides, S.cfg), sim = res('sim'), ok = !S.cfg.certRequiresPass || sim.correct, cert = work().cert;
  el.innerHTML = `<section class="sheet"><div class="sheet-label">SHEET ${idx + 1} — RESULTS</div><h2>Marks summary</h2>
    <div class="tbl-wrap"><table class="spec"><tr><th>#</th><th>ITEM</th><th>STATUS</th><th>MARK</th></tr>
    ${mk.rows.map((r, i) => `<tr><td class="mono">${i + 1}</td><td>${r.label}</td><td>${r.done ? (r.correct ? '<span class="pill ok">correct</span>' : '<span class="pill bad">incorrect</span>') : '<span class="pill warn">pending</span>'}${r.override !== null ? ' <span class="pill info">adjusted</span>' : ''}</td><td class="num">${fmtM(r.earned)} / ${fmtM(r.weight)}</td></tr>`).join('')}
    <tr><td></td><td><b>Total</b></td><td></td><td class="num"><b>${fmtM(mk.earned)} / ${fmtM(mk.total)} (${mk.pct.toFixed(1)} %)</b></td></tr></table></div>
    <div class="row" style="margin-top:16px">${ok ? `<button class="btn primary" id="gen">${cert ? 'VIEW CERTIFICATE' : 'CLAIM CERTIFICATE'}</button>` : '<div class="msg warn">The certificate requires a passed challenge.</div>'}
      <button class="btn hidden" id="prt">🖶 PRINT / SAVE CERTIFICATE</button><button class="btn accent" id="rep">⬇ DOWNLOAD FULL REPORT (PDF)</button></div></section>
    <section class="sheet hidden" id="cs"><div class="sheet-label">CERTIFICATE</div><div id="certificate"></div></section>`;
  const showCert = async c => {
    const logo = await UI.resolveLogo();
    $('#certificate', el).innerHTML = UI.certificateSVG({ name: S.rec.profile.name, id: S.rec.profile.id, pct: mk.pct, date: new Date(c.issuedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), code: c.code, index: sim.bestIndex, logo,
      dept: T.dept, courseLine: T.courseLine, assessment: T.assessment || 'AI-Integrated Technical Assessment', subtitle: T.subtitle, cover1: T.cover1, cover2: T.cover2, footer: T.title.toUpperCase(), seal: T.seal || (T.courseLine + ' · TECHNICAL ASSESSMENT ·'), indexLabel: (T.challenge.indexLabel || 'Challenge Index').toUpperCase(), sketch: T.sketchSVG ? T.sketchSVG('#1c1c1c', '#777') : '', sketchLabel: T.sketchLabel });
    $('#cs', el).classList.remove('hidden'); $('#prt', el).classList.remove('hidden');
  };
  if ($('#gen', el)) $('#gen', el).onclick = async () => {
    let c = work().cert; if (!c) { const at = Date.now(); c = { issuedAt: at, code: C.certCode(T.id, S.rec.profile.id, S.rec.profile.name, mk.pct, new Date(at).toISOString().slice(0, 10)), pct: mk.pct }; await save({ cert: c }); }
    showCert(c);
  };
  $('#prt', el).onclick = () => window.print(); $('#rep', el).onclick = openReport;
}
