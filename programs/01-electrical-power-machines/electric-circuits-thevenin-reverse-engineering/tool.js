/* POWE211 / POWE212 Electric Circuits — Circuit Reverse-Engineering Challenge (AI for Engineering, v1.0, Y. Ajra)
   Students estimate the Thevenin equivalent (Vth, Rth) of sealed two-terminal DC networks from two load tests.
   Everything runs in the browser: bench experiments, dataset, training of several regression models, evaluation,
   and a final batch of hidden networks measured with real (non-ideal) bench meters. No MATLAB needed. */
(function (root) {
  'use strict';
  const C = root.Common;
  const E12 = [1, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];
  const LOADS = [...[100, 1000].flatMap(d => E12.map(m => Math.round(m * d))), 10000];
  const VTH = [2, 15], RTH = [20, 2000], NHID = 500, MIN_MANUAL = 3, STD = [470, 2200];
  const ohm = r => r >= 1000 ? +(r / 1000).toFixed(2) + ' kΩ' : Math.round(r) + ' Ω';
  const sig3 = x => C.sig(x, 3);

  /* ---------- per-student data ---------- */
  function params(id) {
    const R = C.rng('AIENG|cir|' + id), pick = a => R.pick(a);
    const kE = (lo, hi) => LOADS.filter(v => v >= lo && v <= hi);
    const p = { Vs: pick([9, 10, 12, 15, 18, 24]), R1: pick(kE(1000, 4700)), R2: pick(kE(2200, 10000)), R3: pick(kE(100, 2200)) };
    p.RLa = pick(kE(470, 2200)); p.RLb = pick(kE(3300, 10000));
    // sheet 3: a reading taken with a non-ideal ammeter
    p.RAx = pick([10, 15, 22, 33]); p.V3 = C.roundTo(R.uniform(6, 12), 0.5); p.R3th = pick(kE(150, 680)); p.RLc = pick(kE(220, 820)); p.RLd = pick(kE(1500, 4700));
    const rd = RL => { const I = p.V3 / (p.R3th + p.RAx + RL); return { V: C.roundTo(I * RL, 0.001), I: C.roundTo(I * 1000, 0.001) }; };
    p.rc = rd(p.RLc); p.rd = rd(p.RLd);
    // hidden bench imperfections (never shown to the student)
    p.bench = { RA: C.roundTo(R.uniform(15, 25), 0.1), gv: 1 + (R() < 0.5 ? -1 : 1) * 0.025, gi: 1 + (R() < 0.5 ? -1 : 1) * 0.02 };
    p.seed = Math.floor(R() * 1e9);
    return p;
  }
  const thev = p => { const par = p.R1 * p.R2 / (p.R1 + p.R2); return { Vth: p.Vs * p.R2 / (p.R1 + p.R2), Rth: par + p.R3 }; };
  function network(R) { return { Vth: R.uniform(VTH[0], VTH[1]), Rth: Math.exp(R.uniform(Math.log(RTH[0]), Math.log(RTH[1]))) }; }
  function loadPair(R) {
    for (;;) { const a = R.pick(LOADS), b = R.pick(LOADS); if (Math.max(a, b) / Math.min(a, b) >= 1.5) return [Math.min(a, b), Math.max(a, b)]; }
  }
  // one bench reading: ammeter (burden RA) in series with the load, voltmeter across the load; 3-digit meters
  function measure(p, net, RL, R, noise) {
    const b = p.bench, I = net.Vth / (net.Rth + b.RA + RL), V = I * RL;
    return { V: sig3(b.gv * V * (1 + noise * R.normal())), I: sig3(b.gi * I * (1 + noise * R.normal())) };
  }
  function row(p, net, RL1, RL2, R, noise) {
    const m1 = measure(p, net, RL1, R, noise), m2 = measure(p, net, RL2, R, noise);
    return [RL1, m1.V, m1.I, RL2, m2.V, m2.I, +net.Vth.toFixed(4), +net.Rth.toFixed(3)];
  }
  function genRows(p, id, n, noise) {
    const out = [];
    for (let i = 0; i < n; i++) { const R = C.rng(`AIENG|cir|gen|${id}|${i}`), net = network(R), [a, b] = loadPair(R); out.push(row(p, net, a, b, R, noise)); }
    return out;
  }
  // two-point (textbook) estimate from V = Vth − I·Rth
  function twoPoint(x) {
    const [, V1, I1, , V2, I2] = x, d = I2 - I1;
    if (!d) return { Vth: NaN, Rth: NaN };
    const Rth = (V1 - V2) / d; return { Vth: V1 + I1 * Rth, Rth };
  }
  const FEATS = {
    raw: { label: 'Measurements only (6 features)', f: x => x.slice(0, 6) },
    phys: { label: 'Measurements + circuit-theory features (9)', f: x => { const t = twoPoint(x), c = (v, a, b) => isFinite(v) ? Math.max(a, Math.min(b, v)) : 0; return [...x.slice(0, 6), c(t.Vth, 0, 40), c(t.Rth, -1000, 10000), Math.abs(Math.log(Math.max(x[2], 1e-7) / Math.max(x[5], 1e-7)))]; } }
  };
  function trainPair(type, feats, rows, seed) {
    const F = FEATS[feats].f, X = rows.map(F);
    const mV = root.ML.fit(type, X, rows.map(r => r[6]), { seed: seed + '|V' }), mR = root.ML.fit(type, X, rows.map(r => r[7]), { seed: seed + '|R' });
    const f = x => { const z = F(x); return [mV(z), mR(z)]; };
    return f;
  }
  function labRows(p, id, lab, noise) { return [...(lab.manual || []).map(m => m.slice(0, 8)), ...genRows(p, id, lab.gen || 0, noise)]; }
  const splitOf = (n, id) => root.ML.split(n, 0.2, id + '|' + n);
  function buildModel(j, p, id) {
    if (j.format !== 'AIENG-BROWSER-v1' || j.toolId !== 'cir-thevenin') throw new Error('Not a model of this tool.');
    if (String(j.studentId) !== String(id)) throw new Error('This model belongs to another student ID.');
    const rows = labRows(p, id, j, j.noise), sp = splitOf(rows.length, id), m = trainPair(j.model, j.features, sp.train.map(i => rows[i]), id);
    m.meta = j; m.noise = j.noise; return m;
  }
  function hiddenSet(p, id, noise) {
    const out = [];
    for (let i = 0; i < NHID; i++) { const R = C.rng(`AIENG|cir|hidden|${id}|${i}`), net = network(R), [a, b] = loadPair(R); out.push(row(p, net, a, b, R, noise)); }
    return out;
  }
  function validate(model, p, id) {
    const H = hiddenSet(p, id, model.noise ?? 0.01), P = H.map(x => model(x.slice(0, 6)));
    const mv = root.ML.metrics(H.map(r => r[6]), P.map(q => q[0])), mr = root.ML.metrics(H.map(r => r[7]), P.map(q => q[1]));
    return { value: Math.min(mv.r2, mr.r2), label: 'R² (lower of Vth, Rth)', text: `Vth ${mv.r2.toFixed(4)} · Rth ${mr.r2.toFixed(4)}` };
  }

  /* ---------- sheets ---------- */
  const sh1 = {
    id: 'thevenin', title: 'Thevenin equivalent of the practice circuit', short: 'Vth, Rth, IN, Pmax',
    lead: p => `The practice network of your bench (drawn on sheet 01) contains V<sub>s</sub> = ${p.Vs} V, R<sub>1</sub> = ${ohm(p.R1)}, R<sub>2</sub> = ${ohm(p.R2)} and R<sub>3</sub> = ${ohm(p.R3)}. Find its Thevenin and Norton equivalents seen from terminals a–b, and the maximum power it can deliver to a load.`,
    keys: [{ key: 'Vth', label: 'Thevenin voltage V<sub>th</sub>', unit: 'V' }, { key: 'Rth', label: 'Thevenin resistance R<sub>th</sub>', unit: 'Ω' }, { key: 'IN', label: 'Norton current I<sub>N</sub>', unit: 'mA' }, { key: 'Pmax', label: 'Maximum power to a load P<sub>max</sub>', unit: 'mW' }],
    answers: p => { const t = thev(p); return { Vth: t.Vth, Rth: t.Rth, IN: 1000 * t.Vth / t.Rth, Pmax: 1000 * t.Vth * t.Vth / (4 * t.Rth) }; },
    solution: p => { const t = thev(p); return `<p>Open circuit: no current in R<sub>3</sub>, so V<sub>th</sub> = V<sub>s</sub>·R<sub>2</sub>/(R<sub>1</sub>+R<sub>2</sub>) = <b>${C.fmt(t.Vth, 5)} V</b>. Source killed: R<sub>th</sub> = R<sub>1</sub>∥R<sub>2</sub> + R<sub>3</sub> = <b>${C.fmt(t.Rth, 5)} Ω</b>. I<sub>N</sub> = V<sub>th</sub>/R<sub>th</sub> = <b>${C.fmt(1000 * t.Vth / t.Rth, 5)} mA</b>. Maximum power when R<sub>L</sub> = R<sub>th</sub>: P<sub>max</sub> = V<sub>th</sub>²/(4R<sub>th</sub>) = <b>${C.fmt(1000 * t.Vth * t.Vth / (4 * t.Rth), 5)} mW</b>.</p>`; }
  };
  const sh2 = {
    id: 'loadtests', title: 'Two load tests with ideal meters', short: 'Load-line readings',
    lead: p => `Connect the practice network to R<sub>L1</sub> = ${ohm(p.RLa)}, then to R<sub>L2</sub> = ${ohm(p.RLb)}. With ideal meters, I = V<sub>th</sub>/(R<sub>th</sub> + R<sub>L</sub>) and V = I·R<sub>L</sub>. Give the readings of both tests. (Worked example: V<sub>th</sub> = 9 V, R<sub>th</sub> = 1 kΩ, R<sub>L</sub> = 1 kΩ → I = 4.5 mA, V = 4.5 V.)`,
    keys: [{ key: 'I1', label: 'Test 1 current I<sub>1</sub>', unit: 'mA' }, { key: 'V1', label: 'Test 1 voltage V<sub>1</sub>', unit: 'V' }, { key: 'I2', label: 'Test 2 current I<sub>2</sub>', unit: 'mA' }, { key: 'V2', label: 'Test 2 voltage V<sub>2</sub>', unit: 'V' }],
    answers: p => { const t = thev(p), I1 = t.Vth / (t.Rth + p.RLa), I2 = t.Vth / (t.Rth + p.RLb); return { I1: 1000 * I1, V1: I1 * p.RLa, I2: 1000 * I2, V2: I2 * p.RLb }; },
    solution: p => { const a = sh2.answers(p); return `<p>Test 1: I<sub>1</sub> = <b>${C.fmt(a.I1, 5)} mA</b>, V<sub>1</sub> = <b>${C.fmt(a.V1, 5)} V</b>. Test 2: I<sub>2</sub> = <b>${C.fmt(a.I2, 5)} mA</b>, V<sub>2</sub> = <b>${C.fmt(a.V2, 5)} V</b>. Both points lie on the load line V = V<sub>th</sub> − I·R<sub>th</sub>: two distinct points are enough to recover V<sub>th</sub> and R<sub>th</sub>.</p>`; }
  };
  const sh3 = {
    id: 'realmeters', title: 'Two-point estimate with a real ammeter', short: 'Two-point formula, meter loading',
    lead: p => `A sealed network is tested on a bench whose ammeter has an internal (burden) resistance R<sub>A</sub> = ${p.RAx} Ω in series with the load; the voltmeter is across the load only. Readings: test 1 (R<sub>L</sub> = ${ohm(p.RLc)}) V<sub>1</sub> = ${p.rc.V} V, I<sub>1</sub> = ${p.rc.I} mA; test 2 (R<sub>L</sub> = ${ohm(p.RLd)}) V<sub>2</sub> = ${p.rd.V} V, I<sub>2</sub> = ${p.rd.I} mA. Apply the two-point formulas R<sub>th</sub> = (V<sub>1</sub> − V<sub>2</sub>)/(I<sub>2</sub> − I<sub>1</sub>), V<sub>th</sub> = V<sub>1</sub> + I<sub>1</sub>R<sub>th</sub>, then correct for the ammeter.`,
    keys: [{ key: 'Rtp', label: 'R<sub>th</sub> from the two-point formula', unit: 'Ω' }, { key: 'Vtp', label: 'V<sub>th</sub> from the two-point formula', unit: 'V' }, { key: 'Rcor', label: 'R<sub>th</sub> corrected for the ammeter burden', unit: 'Ω' }],
    answers: p => { const R = (p.rc.V - p.rd.V) / ((p.rd.I - p.rc.I) / 1000); return { Rtp: R, Vtp: p.rc.V + p.rc.I / 1000 * R, Rcor: R - p.RAx }; },
    solution: p => { const a = sh3.answers(p); return `<p>R<sub>th,2pt</sub> = (${p.rc.V} − ${p.rd.V})/((${p.rd.I} − ${p.rc.I})×10⁻³) = <b>${C.fmt(a.Rtp, 5)} Ω</b>; V<sub>th</sub> = ${p.rc.V} + ${p.rc.I}×10⁻³·R<sub>th,2pt</sub> = <b>${C.fmt(a.Vtp, 5)} V</b>. Because the voltmeter sees only the load, the ammeter resistance behaves as part of the source: the formula returns R<sub>th</sub> + R<sub>A</sub>, so R<sub>th</sub> = <b>${C.fmt(a.Rcor, 5)} Ω</b>. Real meters also have small gain errors that nobody tells you — this is where data can help.</p>`; }
  };

  /* ---------- drawings ---------- */
  function practiceSVG(p) {
    const k = '#0d2b55', a = '#1f5fa8', res = (x, y, v) => v ? `<path d="M${x} ${y} h8 l4 -7 l8 14 l8 -14 l8 14 l8 -14 l4 7 h8" fill="none" stroke="${k}" stroke-width="1.6"/>` : `<path d="M${x} ${y} v8 l-7 4 l14 8 l-14 8 l14 8 l-14 8 l7 4 v8" fill="none" stroke="${k}" stroke-width="1.6"/>`;
    return `<svg viewBox="0 0 430 220" style="width:100%"><g stroke="${k}" stroke-width="1.6" fill="none">
      <path d="M40 60 h30"/>${res(70, 60, 1)}<path d="M126 60 h64"/>${res(190, 60, 1)}<path d="M246 60 h84"/><path d="M160 60 v40"/>${res(160, 100, 0)}<path d="M160 156 v24"/>
      <path d="M40 60 v40"/><circle cx="40" cy="120" r="18"/><path d="M40 138 v42 h290"/><text x="34" y="116" stroke="none" fill="${k}" font-size="13">+</text><text x="35" y="132" stroke="none" fill="${k}" font-size="13">−</text>
      <circle cx="334" cy="60" r="4" fill="#fff"/><circle cx="334" cy="180" r="4" fill="#fff"/></g>
      <g font-family="IBM Plex Mono,monospace" font-size="11.5" fill="${k}"><text x="4" y="124">V<tspan font-size="9">s</tspan></text><text x="78" y="44">R1 = ${ohm(p.R1)}</text><text x="196" y="44">R3 = ${ohm(p.R3)}</text>
      <text x="176" y="132">R2 = ${ohm(p.R2)}</text><text x="4" y="210">Vs = ${p.Vs} V</text><text x="344" y="64">a</text><text x="344" y="184">b</text></g>
      <path d="M370 70 v100" stroke="${a}" stroke-dasharray="4 4"/><text x="376" y="124" font-family="IBM Plex Mono,monospace" font-size="11" fill="${a}">load</text></svg>`;
  }
  function sketchSVG(col, acc) {
    return `<g fill="none" stroke="${col}" stroke-width="1.5"><rect x="40" y="110" width="120" height="120" rx="6"/><path d="M60 150 h80 M60 190 h80" stroke-dasharray="4 4"/>
      <path d="M160 140 h60"/><circle cx="240" cy="140" r="18"/><path d="M258 140 h50 v20 l-8 4 l16 8 l-16 8 l16 8 l-16 8 l8 4 v20 h-148"/><circle cx="350" cy="190" r="18"/><path d="M308 150 h42 v22 M350 208 v20 h-42"/>
      <path d="M300 60 l10 -10 l10 20 l10 -20 l10 20 l10 -10" stroke="${acc}"/></g>
      <g font-family="IBM Plex Mono,monospace" font-size="12" fill="${col}"><text x="60" y="175">? ? ?</text><text x="234" y="145">A</text><text x="344" y="195">V</text><text x="40" y="255">sealed network</text><text x="320" y="245">R<tspan font-size="9">L</tspan></text></g>`;
  }
  function systemHTML(p) {
    return `<p class="lead">A sealed two-terminal DC network can be replaced, as seen from its terminals, by its Thevenin equivalent: a source V<sub>th</sub> in series with R<sub>th</sub>. You will find V<sub>th</sub> and R<sub>th</sub> of unknown networks from two load tests — first by circuit theory, then with a model you train yourself in this page, and finally on a batch of hidden networks measured with the bench's real meters.</p>
      <div class="grid2"><div><h3>Your practice circuit</h3>${practiceSVG(p)}</div>
      <div><h3>The test bench</h3><table class="spec"><tr><th>ITEM</th><th>DETAIL</th></tr><tr><td>Load resistors</td><td>E12 values ${ohm(LOADS[0])} … ${ohm(LOADS[LOADS.length - 1])}</td></tr>
      <tr><td>Ammeter</td><td>in series with the load, 3-digit display</td></tr><tr><td>Voltmeter</td><td>across the load, 3-digit display</td></tr><tr><td>Unknown networks</td><td>V<sub>th</sub> ${VTH[0]}–${VTH[1]} V, R<sub>th</sub> ${RTH[0]} Ω – ${ohm(RTH[1])}</td></tr>
      <tr><td>Features (inputs)</td><td class="mono">RL1, V1, I1, RL2, V2, I2</td></tr><tr><td>Targets (answers)</td><td class="mono">Vth, Rth</td></tr></table></div></div>`;
  }

  /* ---------- in-browser ML lab (stage 4) ---------- */
  function renderLab(el, api) {
    const { p, id, cfg, esc, UI } = api, ML = root.ML, noise = (cfg.challenge.noise ?? 1) / 100, NG = Math.max(200, Math.min(3000, Number(cfg.datasetN) || 1000));
    const lab = { manual: ((api.work.lab || {}).manual || []).map(r => r.slice()), gen: (api.work.lab || {}).gen || 0 };
    const L = { net: 0, t1: null, t2: null, results: {}, sel: null, tgt: 0 };
    const practice = k => { const R = C.rng(`AIENG|cir|practice|${id}|${k}`); return { Vth: C.roundTo(R.uniform(3, 14), 0.5), Rth: R.pick(LOADS.filter(v => v >= 47 && v <= 1800)) }; };
    const benchRead = (k, RL, t) => { const R = C.rng(`AIENG|cir|bench|${id}|${k}|${RL}|${t}`); return measure(p, practice(k), RL, R, noise); };
    const persist = () => api.save({ 'lab/manual': lab.manual, 'lab/gen': lab.gen });
    const rows = () => labRows(p, id, lab, noise);
    const opt = v => LOADS.map(r => `<option value="${r}" ${r === v ? 'selected' : ''}>${ohm(r)}</option>`).join('');
    const thr = cfg.mlThreshold;
    el.innerHTML = `<section class="sheet"><div class="sheet-label">SHEET ${api.idx + 1} — MACHINE LEARNING LAB</div><h2>Reverse-engineering with data</h2>
      <p class="lead">Everything in this stage runs in your browser. <b>1</b> run load tests on practice networks whose answers are known, <b>2</b> build a dataset (each row = one network tested with two loads), <b>3</b> train and compare regression models against the two-point formula, <b>4</b> submit your best model. Pass mark: R² ≥ ${thr} for both V<sub>th</sub> and R<sub>th</sub> on ${NHID} hidden networks.</p>
      <h3>1 · Bench — practice networks</h3>
      <div class="grid2"><div><canvas id="bc" style="width:100%"></canvas></div><div>
        <div class="row"><label class="small">Practice network <select class="btn" id="pn">${[0, 1, 2, 3, 4, 5].map(k => `<option value="${k}">#${k + 1} · Vth ${practice(k).Vth} V · Rth ${ohm(practice(k).Rth)}</option>`).join('')}</select></label></div>
        <div class="row"><label class="small">R<sub>L1</sub> <select class="btn" id="r1">${opt(1000)}</select></label><button class="btn" id="t1">▶ RUN TEST 1</button></div>
        <div class="row"><label class="small">R<sub>L2</sub> <select class="btn" id="r2">${opt(4700)}</select></label><button class="btn" id="t2">▶ RUN TEST 2</button></div>
        <div id="bmsg" class="small"></div><div class="row"><button class="btn primary" id="add" disabled>＋ ADD ROW TO DATASET</button></div>
        <p class="small muted">Features (inputs, blue) are what you can measure; targets (answers, gold) are known only for practice networks. A model learns the link between them.</p></div></div>
      <h3>2 · Dataset</h3><div id="ds"></div>
      <h3>3 · Train and compare</h3>
      <div class="row"><b class="small">Features:</b>${Object.entries(FEATS).map(([k, f], i) => `<label class="small"><input type="radio" name="fs" value="${k}" ${i === 0 ? 'checked' : ''}> ${f.label}</label>`).join('')}</div>
      <div class="row"><b class="small">Models:</b>${Object.entries(ML.MODELS).map(([k, m]) => `<label class="small" title="${m.note}"><input type="checkbox" data-m="${k}" ${k === 'linear' || k === 'forest' ? 'checked' : ''}> ${m.name}</label>`).join('')}</div>
      <div class="row"><button class="btn primary" id="train">▶ TRAIN SELECTED MODELS</button><span class="small muted" id="tmsg"></span></div>
      <div id="cmp"></div><div id="insp"></div>
      <h3>4 · Submit your model</h3><div id="sub"></div><div id="mlres"></div>
      <div class="row" style="margin-top:12px"><span class="grow"></span><span id="nx">${api.nextBtn()}</span></div></section>`;
    const $ = s => el.querySelector(s);
    // bench drawing with a short current animation
    let anim = null;
    function drawBench(k, RL, rd, phase) {
      const cv = $('#bc'), dpr = window.devicePixelRatio || 1, W = cv.clientWidth || 420, H = 230; cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + 'px';
      const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      const ink = '#0d2b55', net = practice(k); ctx.strokeStyle = ink; ctx.lineWidth = 1.6; ctx.font = '12px IBM Plex Mono, monospace'; ctx.fillStyle = ink;
      ctx.strokeRect(20, 40, 130, 150); ctx.fillText(`network #${k + 1}`, 34, 32); ctx.fillText(`Vth = ${net.Vth} V`, 32, 105); ctx.fillText(`Rth = ${ohm(net.Rth)}`, 32, 125);
      ctx.beginPath(); ctx.moveTo(150, 70); ctx.lineTo(W - 60, 70); ctx.lineTo(W - 60, 95); ctx.moveTo(W - 60, 165); ctx.lineTo(W - 60, 180); ctx.lineTo(150, 180); ctx.stroke();
      ctx.beginPath(); ctx.arc(215, 70, 16, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke(); ctx.fillStyle = ink; ctx.fillText('A', 211, 74);
      ctx.strokeRect(W - 70, 95, 20, 70); ctx.fillText(RL ? ohm(RL) : 'R_L', W - 50 + 6, 135);
      ctx.beginPath(); ctx.moveTo(W - 60, 88); ctx.lineTo(W - 120, 88); ctx.lineTo(W - 120, 112); ctx.moveTo(W - 120, 148); ctx.lineTo(W - 120, 172); ctx.lineTo(W - 60, 172); ctx.stroke();
      ctx.beginPath(); ctx.arc(W - 120, 130, 16, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke(); ctx.fillStyle = ink; ctx.fillText('V', W - 124, 134);
      if (phase !== undefined) { ctx.fillStyle = '#0b6bd3'; const per = 2 * (W - 210) + 220; for (let q = 0; q < 10; q++) { let s = ((q / 10 + phase) % 1) * per, x, y; if (s < W - 210) { x = 150 + s; y = 70; } else if (s < W - 210 + 110) { x = W - 60; y = 70 + (s - (W - 210)); } else if (s < 2 * (W - 210) + 110) { x = W - 60 - (s - (W - 210) - 110); y = 180; } else { x = 150; y = 180 - (s - 2 * (W - 210) - 110); } ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill(); } }
      if (rd) { ctx.fillStyle = '#0f7a55'; ctx.font = '600 13px IBM Plex Mono, monospace'; ctx.fillText(`I = ${rd.I * 1000 >= 1 ? (rd.I * 1000).toPrecision(3) : (rd.I * 1000).toPrecision(3)} mA`, 190, 30); ctx.fillText(`V = ${rd.V} V`, W - 170, 215); }
    }
    function runTest(t) {
      const k = L.net, RL = Number($(t === 1 ? '#r1' : '#r2').value), rd = benchRead(k, RL, t), t0 = performance.now();
      if (anim) cancelAnimationFrame(anim);
      const step = () => { const e = (performance.now() - t0) / 900; drawBench(k, RL, e >= 1 ? rd : null, e); if (e < 1) anim = requestAnimationFrame(step); else drawBench(k, RL, rd); };
      anim = requestAnimationFrame(step);
      L['t' + t] = { RL, ...rd }; benchMsg();
    }
    function benchMsg() {
      const a = L.t1, b = L.t2; let h = '';
      if (a) h += `Test 1: R<sub>L1</sub> = ${ohm(a.RL)} → I<sub>1</sub> = ${(a.I * 1000).toPrecision(3)} mA, V<sub>1</sub> = ${a.V} V<br>`;
      if (b) h += `Test 2: R<sub>L2</sub> = ${ohm(b.RL)} → I<sub>2</sub> = ${(b.I * 1000).toPrecision(3)} mA, V<sub>2</sub> = ${b.V} V<br>`;
      let ok = !!(a && b);
      if (ok && Math.max(a.RL, b.RL) / Math.min(a.RL, b.RL) < 1.5) { h += '<div class="msg warn small">The two loads are too similar: the two operating points almost coincide and the estimate becomes unreliable. Choose clearly different loads.</div>'; ok = false; }
      $('#bmsg').innerHTML = h; $('#add').disabled = !ok;
    }
    $('#pn').onchange = e => { L.net = +e.target.value; L.t1 = L.t2 = null; benchMsg(); drawBench(L.net, null, null); };
    $('#t1').onclick = () => runTest(1); $('#t2').onclick = () => runTest(2);
    $('#add').onclick = () => { const a = L.t1, b = L.t2, net = practice(L.net); lab.manual.push([a.RL, a.V, a.I, b.RL, b.V, b.I, net.Vth, net.Rth, L.net + 1]); L.t1 = L.t2 = null; benchMsg(); persist(); L.results = {}; dataset(); compare(); };
    // dataset view
    function dataset() {
      const all = rows(), nm = lab.manual.length, canGen = nm >= MIN_MANUAL;
      const th = '<tr><th></th><th class="f">RL1 [Ω]</th><th class="f">V1 [V]</th><th class="f">I1 [mA]</th><th class="f">RL2 [Ω]</th><th class="f">V2 [V]</th><th class="f">I2 [mA]</th><th class="g">Vth [V]</th><th class="g">Rth [Ω]</th><th></th></tr>';
      const tr = (r, i, src) => `<tr><td class="mono small">${src}</td>${[r[0], r[1], 1000 * r[2], r[3], r[4], 1000 * r[5], r[6], r[7]].map(v => `<td class="num">${C.fmt(v, 4)}</td>`).join('')}<td>${src.startsWith('M') ? `<button class="btn sm" data-del="${i}">✕</button>` : ''}</td></tr>`;
      $('#ds').innerHTML = `<style>#ds th.f{color:#0b6bd3}#ds th.g{color:#a8843a}</style>
        <p class="small">${nm} manual row(s) from the bench${nm < MIN_MANUAL ? ` — make at least ${MIN_MANUAL} before generating more` : ''} · ${lab.gen} generated row(s) · <b>${all.length}</b> rows in total.</p>
        <div class="tbl-wrap" style="max-height:260px;overflow:auto"><table class="spec">${th}${lab.manual.map((r, i) => tr(r, i, 'M' + (i + 1) + ' net#' + (r[8] || '?'))).join('')}${all.slice(nm, nm + 8).map((r, i) => tr(r, i, 'G' + (i + 1))).join('')}${lab.gen > 8 ? `<tr><td colspan="10" class="small muted">… ${lab.gen - 8} more generated rows (download the CSV to inspect all of them)</td></tr>` : ''}</table></div>
        <div class="row" style="margin-top:8px"><button class="btn primary" id="gen" ${canGen && lab.gen + NG <= 3000 ? '' : 'disabled'}>＋ GENERATE ${NG} MORE EXAMPLES</button><button class="btn" id="clr" ${lab.gen ? '' : 'disabled'}>CLEAR GENERATED</button><button class="btn" id="csv" ${all.length ? '' : 'disabled'}>⬇ DATASET (CSV)</button></div>
        <p class="small muted">Generated rows come from random networks (V<sub>th</sub> ${VTH[0]}–${VTH[1]} V, R<sub>th</sub> ${RTH[0]} Ω – ${ohm(RTH[1])}) tested on the same bench with two random, clearly different loads — exactly like your manual rows.</p>`;
      el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { lab.manual.splice(+b.dataset.del, 1); persist(); L.results = {}; dataset(); compare(); });
      $('#gen').onclick = () => { lab.gen = Math.min(3000, lab.gen + NG); persist(); L.results = {}; dataset(); compare(); };
      $('#clr').onclick = () => { lab.gen = 0; persist(); L.results = {}; dataset(); compare(); };
      $('#csv').onclick = () => UI.download(`cir-thevenin_dataset_${id}.csv`, C.toCSV(['source', 'RL1_ohm', 'V1_V', 'I1_A', 'RL2_ohm', 'V2_V', 'I2_A', 'Vth_V', 'Rth_ohm'], all.map((r, i) => [i < nm ? 'manual' : 'generated', ...r.slice(0, 8)])), 'text/csv');
    }
    // training and comparison
    function compare() {
      const keys = Object.keys(L.results);
      if (!keys.length) { $('#cmp').innerHTML = ''; $('#insp').innerHTML = ''; subPanel(); return; }
      const ref = L.ref, cell = (m, d) => `<td class="num">${C.fmt(m.r2, 4)}</td><td class="num">${C.fmt(m.rmse, d)}</td><td class="num">${C.fmt(m.mae, d)}</td><td class="num">${m.mape === null ? '—' : C.fmt(m.mape, 3)}</td>`;
      const line = (name, r, key) => `<tr ${key ? `data-k="${key}" style="cursor:pointer"` : ''}><td>${name}</td>${cell(r.mv, 4)}${cell(r.mr, 4)}</tr>`;
      $('#cmp').innerHTML = `<p class="small">Same ${L.nTest} held-out test rows for every model (trained on the other ${L.nTrain}). Click a row to inspect it. RMSE and MAE are in V for V<sub>th</sub> and in Ω for R<sub>th</sub> — they cannot be compared with each other. R² can be negative when a model does worse than always predicting the mean.</p>
        <div class="tbl-wrap"><table class="spec"><tr><th rowspan="2">MODEL</th><th colspan="4">V<sub>th</sub> ESTIMATION</th><th colspan="4">R<sub>th</sub> ESTIMATION</th></tr><tr><th>R²</th><th>RMSE [V]</th><th>MAE [V]</th><th>MAPE [%]</th><th>R²</th><th>RMSE [Ω]</th><th>MAE [Ω]</th><th>MAPE [%]</th></tr>
        ${line('<i>Two-point formula (circuit theory, no ML)</i>', ref, 'ref')}${keys.map(k => line(L.results[k].name, L.results[k], k)).join('')}</table></div>`;
      el.querySelectorAll('#cmp [data-k]').forEach(r => r.onclick = () => { L.sel = r.dataset.k; inspect(); });
      inspect(); subPanel();
    }
    function inspect() {
      const r = L.sel && (L.sel === 'ref' ? L.ref : L.results[L.sel]); if (!r) { $('#insp').innerHTML = ''; return; }
      const k = L.tgt, y = L.yTest.map(q => q[6 + k]), yh = r.pred.map(q => q[k]), e = yh.map((v, i) => v - y[i]), u = k ? 'Ω' : 'V', name = k ? 'Rth' : 'Vth';
      $('#insp').innerHTML = `<div class="row" style="margin-top:10px"><b>${esc(r.name)}</b><span class="grow"></span><button class="btn sm ${k ? '' : 'primary'}" data-t="0">Vth</button><button class="btn sm ${k ? 'primary' : ''}" data-t="1">Rth</button></div>
        <div class="grid3"><canvas id="p1"></canvas><canvas id="p2"></canvas><canvas id="p3"></canvas></div>
        <div class="tbl-wrap" style="max-height:200px;overflow:auto;margin-top:8px"><table class="spec"><tr><th>TEST ROW</th><th>ACTUAL [${u}]</th><th>PREDICTED [${u}]</th><th>ERROR [${u}]</th><th>|ERROR| [${u}]</th></tr>
        ${y.slice(0, 25).map((v, i) => `<tr><td class="mono">${i + 1}</td><td class="num">${C.fmt(v, 4)}</td><td class="num">${C.fmt(yh[i], 4)}</td><td class="num">${C.fmt(e[i], 3)}</td><td class="num">${C.fmt(Math.abs(e[i]), 3)}</td></tr>`).join('')}</table></div>`;
      el.querySelectorAll('#insp [data-t]').forEach(b => b.onclick = () => { L.tgt = +b.dataset.t; inspect(); });
      const lim = k ? [0, RTH[1] * 1.1] : [0, VTH[1] * 1.1], cl = v => Math.max(lim[0] - (lim[1] - lim[0]), Math.min(2 * lim[1], v));
      ML.scatter($('#p1'), y, yh.map(cl), { title: `actual vs predicted ${name}`, xlabel: `actual [${u}]`, xr: lim, yr: lim, ref: 'diag' });
      const er = Math.max(...e.map(Math.abs).sort((a, b) => a - b).slice(0, Math.floor(e.length * 0.98))) * 1.2 || 1;
      ML.scatter($('#p2'), yh.map(cl), e, { title: 'residual vs predicted', xlabel: `predicted [${u}]`, xr: lim, yr: [-er, er], ref: 'zero' });
      ML.hist($('#p3'), e.map(v => Math.max(-er, Math.min(er, v))), { title: 'residual distribution', xlabel: `error [${u}]` });
    }
    $('#train').onclick = () => {
      const types = [...el.querySelectorAll('[data-m]:checked')].map(x => x.dataset.m), fs = el.querySelector('[name=fs]:checked').value, all = rows();
      if (all.length < 50) { $('#tmsg').textContent = 'Build a dataset of at least 50 rows first (generate examples).'; return; }
      if (!types.length) { $('#tmsg').textContent = 'Select at least one model.'; return; }
      $('#tmsg').textContent = 'Training… (a few seconds)'; $('#train').disabled = true;
      setTimeout(() => {
        const sp = splitOf(all.length, id), tr = sp.train.map(i => all[i]), te = sp.test.map(i => all[i]);
        L.yTest = te; L.nTest = te.length; L.nTrain = tr.length;
        const met = pred => ({ pred, mv: ML.metrics(te.map(r => r[6]), pred.map(q => q[0])), mr: ML.metrics(te.map(r => r[7]), pred.map(q => q[1])) });
        L.ref = { name: 'Two-point formula', ...met(te.map(x => { const t = twoPoint(x); return [isFinite(t.Vth) ? t.Vth : 0, isFinite(t.Rth) ? t.Rth : 0]; })) };
        for (const t of types) { const f = trainPair(t, fs, tr, id); L.results[t + '|' + fs] = { name: `${ML.MODELS[t].name} · ${fs === 'raw' ? 'measurements' : 'measurements + circuit features'}`, type: t, fs, ...met(te.map(f)) }; L.sel = t + '|' + fs; }
        $('#tmsg').textContent = ''; $('#train').disabled = false; compare();
      }, 30);
    };
    function subPanel() {
      const keys = Object.keys(L.results), r = api.res('ml');
      $('#sub').innerHTML = keys.length ? `<div class="row"><select class="btn" id="pick">${keys.map(k => `<option value="${k}" ${k === L.sel ? 'selected' : ''}>${esc(L.results[k].name)}</option>`).join('')}</select><button class="btn accent" id="go">SUBMIT FOR VALIDATION</button></div>
        <p class="small muted">The submitted model is re-trained from your dataset and tested on ${NHID} hidden networks it has never seen.</p>` : `<p class="small muted">Train at least one model first.</p>`;
      if (r.done && !$('#mlres').innerHTML) $('#mlres').innerHTML = `<div class="msg ${r.correct ? 'ok' : 'info'}">Last submission: ${esc(r.modelType || '')} — ${esc(r.text || '')}${r.correct ? ' ✔ passed' : ''}.</div>`;
      if (!keys.length) return;
      $('#go').onclick = async () => {
        const k = $('#pick').value, R = L.results[k];
        const j = { format: 'AIENG-BROWSER-v1', toolId: 'cir-thevenin', studentId: id, modelType: R.name, model: R.type, features: R.fs, manual: lab.manual.map(x => x.slice(0, 8)), gen: lab.gen, noise };
        $('#mlres').innerHTML = '<div class="msg info">Validating on hidden networks…</div>';
        setTimeout(async () => {
          try {
            const o = await api.recordModel(j);
            $('#mlres').innerHTML = `<div class="grid3" style="margin-top:12px"><div class="metric"><span>MODEL</span><b style="font-size:14px">${esc(R.name)}</b></div><div class="metric"><span>HIDDEN-TEST R²</span><b style="font-size:16px">${esc(o.v.text)}</b></div><div class="metric"><span>PASS MARK</span><b>R² ≥ ${thr}</b></div></div>
              <div class="msg ${o.pass ? 'ok' : 'warn'}">${o.pass ? `✔ Validation passed — ${api.fmtM(o.marks)} marks. This model will be used in the challenge.` : 'Below the pass mark. Compare the models with the two-point formula: which features does a model need to do as well as circuit theory?'}</div>`;
            $('#nx').innerHTML = api.nextBtn(); api.wireNext();
          } catch (e) { $('#mlres').innerHTML = `<div class="msg bad">✘ ${esc(e.message)}</div>`; }
        }, 30);
      };
    }
    drawBench(0, null, null); dataset(); compare(); api.wireNext();
  }
  function reportHTML(p, rec) {
    const lab = (rec.work && rec.work.lab) || {}, m = lab.model;
    return `<p>Dataset built by the student: ${(lab.manual || []).length} manual bench row(s) + ${lab.gen || 0} generated row(s).${m ? ` Submitted model: ${m.modelType} (features: ${FEATS[m.features] ? FEATS[m.features].label : m.features}).` : ''}</p>`;
  }

  /* ---------- challenge ---------- */
  function modules(p, s) {
    const n = s.modules || 100, R = C.rng(`AIENG|cir|modules|${p.seed}`), out = [];
    for (let i = 0; i < n; i++) out.push(network(R));
    return out;
  }
  function run(p, s, mode) {
    const std = mode === 'conventional', nets = modules(p, s), noise = (s.noise ?? 1) / 100, RL1 = std ? STD[0] : Number(s.RL1 || STD[0]), RL2 = std ? STD[1] : Number(s.RL2 || STD[1]);
    const res = nets.map((net, i) => {
      const R = C.rng(`AIENG|cir|chmeas|${p.seed}|${i}|${RL1}|${RL2}`), x = row(p, net, RL1, RL2, R, noise);
      let est;
      if (mode === 'reference') est = [net.Vth, net.Rth];
      else if (mode === 'conventional') { const t = twoPoint(x); est = [t.Vth, t.Rth]; }
      else est = mode(x.slice(0, 6));
      const eV = isFinite(est[0]) ? Math.min(1, Math.abs(est[0] - net.Vth) / net.Vth) : 1, eR = isFinite(est[1]) ? Math.min(1, Math.abs(est[1] - net.Rth) / net.Rth) : 1;
      return { net, x, est, eV, eR };
    }).sort((a, b) => a.net.Rth - b.net.Rth);
    const n = res.length, tr = { t: [], Rt: [], Re: [], Vt: [], Ve: [], e: [], x: [] };
    res.forEach((r, i) => { tr.t.push(i + 1); tr.Rt.push(r.net.Rth); tr.Re.push(isFinite(r.est[1]) ? r.est[1] : 0); tr.Vt.push(r.net.Vth); tr.Ve.push(isFinite(r.est[0]) ? r.est[0] : 0); tr.e.push(50 * (r.eV + r.eR)); tr.x.push(r.x.slice(0, 6)); });
    const mean = a => a.reduce((u, v) => u + v, 0) / n, eV = 100 * mean(res.map(r => r.eV)), eR = 100 * mean(res.map(r => r.eR));
    const cost = (eV + eR) / 2;
    return { trace: tr, cost, metrics: { err: cost, errV: eV, errR: eR, within: 100 * res.filter(r => r.eV < 0.05 && r.eR < 0.05).length / n } };
  }
  function draw(ctx, W, H, p, tr, i) {
    const ink = '#0d2b55', x = tr.x[i] || [0, 0, 0, 0, 0, 0];
    ctx.strokeStyle = ink; ctx.lineWidth = 1.6; ctx.fillStyle = ink; ctx.font = '12px IBM Plex Mono, monospace';
    ctx.strokeRect(20, 40, 120, 130); ctx.fillText(`module ${tr.t[i]} / ${tr.t.length}`, 20, 30); ctx.fillText('sealed', 50, 100); ctx.fillText('? ? ?', 52, 120);
    ctx.beginPath(); ctx.moveTo(140, 70); ctx.lineTo(260, 70); ctx.moveTo(140, 150); ctx.lineTo(260, 150); ctx.stroke(); ctx.strokeRect(250, 85, 20, 50);
    ctx.fillText(`test 1: ${ohm(x[0])} → ${(x[2] * 1000).toPrecision(3)} mA, ${x[1]} V`, 300, 70); ctx.fillText(`test 2: ${ohm(x[3])} → ${(x[5] * 1000).toPrecision(3)} mA, ${x[4]} V`, 300, 92);
    ctx.font = '600 13px IBM Plex Mono, monospace';
    ctx.fillText(`estimate: Vth ${tr.Ve[i].toFixed(2)} V · Rth ${tr.Re[i].toFixed(0)} Ω`, 300, 126);
    ctx.fillStyle = '#0f7a55'; ctx.fillText(`true:     Vth ${tr.Vt[i].toFixed(2)} V · Rth ${tr.Rt[i].toFixed(0)} Ω`, 300, 148);
    ctx.fillStyle = tr.e[i] < 5 ? '#0f7a55' : '#b8322a'; ctx.fillText(`error ${tr.e[i].toFixed(1)} %`, 300, 172);
  }
  const loadOpts = LOADS.map(v => ({ value: v, label: ohm(v) }));

  root.TOOL = {
    id: 'cir-thevenin', courseLine: 'POWE211 · POWE212 ELECTRIC CIRCUITS', title: 'Circuit Reverse-Engineering Challenge', subtitle: 'Estimating the Thevenin equivalent of sealed networks from load tests',
    dept: 'FACULTY OF ENGINEERING · DEPARTMENT OF ELECTRICAL AND COMPUTER ENGINEERING', assessment: 'Electric Circuits Technical Assessment',
    cover1: 'covering Thevenin and Norton equivalents, load tests, meter loading,', cover2: 'and machine-learning models trained in the browser to reverse-engineer sealed networks.',
    sketchLabel: 'BLACK-BOX TEST BENCH', sketchSVG, params, systemHTML, sheets: [sh1, sh2, sh3],
    weights: { ml: 25, sim: 25 },
    ml: {
      title: 'Reverse-engineering with data', task: 'regression', mode: 'browser', defaultN: 1000, threshold: 0.98, stageDesc: 'Bench · dataset · training',
      toolText: 'Trained in the browser (AI-for-Engineering ML library): linear, polynomial, k-NN, decision tree, random forest; 80/20 split',
      predictors: [{ name: 'RL1_ohm', unit: 'Ω', desc: 'load of test 1' }, { name: 'V1_V', unit: 'V', desc: 'voltage reading, test 1' }, { name: 'I1_A', unit: 'A', desc: 'current reading, test 1' },
        { name: 'RL2_ohm', unit: 'Ω', desc: 'load of test 2' }, { name: 'V2_V', unit: 'V', desc: 'voltage reading, test 2' }, { name: 'I2_A', unit: 'A', desc: 'current reading, test 2' }],
      response: { name: 'Vth_V,Rth_ohm', unit: 'V, Ω', desc: 'Thevenin voltage and resistance' },
      explainHTML: () => 'Each dataset row is one network tested with two loads: six measured features and two targets (V<sub>th</sub>, R<sub>th</sub>). The student ran bench tests, generated more examples, trained and compared regression models against the two-point formula, and submitted one model, validated on 500 hidden networks.',
      dataset: (p, id, N) => genRows(p, id, Math.min(N, 3000), 0.01), renderLab, buildModel, validate, reportHTML
    },
    challenge: {
      title: 'Production test: sealed modules', short: 'Black-box batch', convLabel: 'Two-point formula, standard fixture 470 Ω / 2.2 kΩ', refLabel: 'True values', indexLabel: 'Estimation Index', costLabel: 'mean estimation error [%]', xlabel: 'module (sorted by Rth)',
      settings: [{ key: 'noise', label: 'Meter noise (1σ)', unit: '%', default: 1, min: 0, max: 5, step: 0.5 }, { key: 'modules', label: 'Modules in the batch', unit: '', default: 100, min: 20, max: 300, step: 10 }],
      inputs: [{ key: 'RL1', label: 'Fixture load R<sub>L1</sub>', options: loadOpts, default: 470 }, { key: 'RL2', label: 'Fixture load R<sub>L2</sub>', options: loadOpts, default: 2200 }],
      inputsNote: (p, s) => Math.max(s.RL1, s.RL2) / Math.min(s.RL1, s.RL2) < 1.5 ? '<div class="msg warn small">Loads too similar — the two operating points nearly coincide.</div>' : '',
      describe: (p, s) => `A batch of ${s.modules || 100} sealed modules is tested on the bench. The bench meters are real: the ammeter adds its own resistance and both meters have small calibration errors you are not told. <b>Conventional</b>: the lab's standard procedure — fixture loads 470 Ω and 2.2 kΩ and the textbook two-point formula. <b>ML</b>: your submitted model, with the two fixture loads <i>you</i> choose below (now R<sub>L1</sub> = ${ohm(s.RL1 || STD[0])}, R<sub>L2</sub> = ${ohm(s.RL2 || STD[1])}) — choosing loads that give clearly different operating points matters. True values are revealed after the run; the score is the mean relative error of V<sub>th</sub> and R<sub>th</sub>.`,
      run, draw, sceneHeight: 200, animSeconds: 8, minIndex: 40,
      metrics: [{ key: 'err', label: 'Mean error', unit: '%', d: 4 }, { key: 'errV', label: 'Vth error', unit: '%', d: 4 }, { key: 'errR', label: 'Rth error', unit: '%', d: 4 }, { key: 'within', label: 'Modules within 5 %', unit: '%', d: 3 }],
      plots: [{ title: 'Rth [Ω] — true vs estimated', series: [{ key: 'Rt', label: 'true Rth', color: '#0d2b55' }, { key: 'Re', label: 'estimated Rth', color: '#a8843a', dash: [4, 3] }] },
        { title: 'error per module [%]', series: [{ key: 'e', label: 'error', color: '#b8322a' }] }]
    },
    _internal: { genRows, twoPoint, trainPair, FEATS, hiddenSet, labRows, splitOf }
  };
})(typeof window !== 'undefined' ? window : globalThis);
