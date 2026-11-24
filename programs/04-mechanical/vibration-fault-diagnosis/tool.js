/* Mechanical — Vibration-Based Fault Diagnosis (AI for Engineering, v1.0, Y. Ajra)
   A plant of motor-driven pumps is surveyed with an accelerometer. Students compute shaft and bearing defect
   frequencies and vibration severity, then train a classifier that diagnoses each machine from spectral features.
   The diagnoses drive the maintenance decisions of one survey round, scored by the maintenance cost. */
(function (root) {
  'use strict';
  const C = root.Common;
  const CLASSES = ['Healthy', 'Unbalance', 'Misalignment', 'OuterRace', 'InnerRace'];
  const PRIOR = [0.4, 0.15, 0.15, 0.15, 0.15];
  const NCH = 80, NHID = 1500;

  function params(id) {
    const R = C.rng('AIENG|mec|' + id);
    const p = { N: C.roundTo(R.uniform(1200, 3000), 10), nb: R.pick([8, 9, 10, 11, 12]), d: C.roundTo(R.uniform(7, 12), 0.5), D: C.roundTo(R.uniform(38, 60), 1),
      X: C.roundTo(R.uniform(15, 45), 1), U: C.roundTo(R.uniform(150, 600), 10), seed: Math.floor(R() * 1e9) };
    p.fr = p.N / 60; return p;
  }
  const bearing = p => { const r = p.d / p.D, h = p.nb / 2 * p.fr; return { BPFO: h * (1 - r), BPFI: h * (1 + r), BSF: p.D / (2 * p.d) * p.fr * (1 - r * r), FTF: p.fr / 2 * (1 - r) }; };

  // one survey measurement → 7 spectral features (velocity in mm/s RMS, envelope in g)
  function measure(R, cls, sev) {
    const ln = s => Math.exp(s * R.normal());
    let A1 = 0.8 * ln(0.35), A2 = 0.25 * ln(0.4), ax = 0.25 * ln(0.3), eo = 0.02 * ln(0.5), ei = 0.02 * ln(0.5), k = 3 + 0.25 * Math.abs(R.normal());
    if (cls === 1) { A1 += 3.2 * sev * ln(0.25); }
    if (cls === 2) { A2 += 2.0 * sev * ln(0.3); A1 += 0.9 * sev * ln(0.3); ax += 0.55 * sev * ln(0.3); }
    if (cls === 3) { eo += 0.16 * sev * ln(0.35); k += 3.0 * sev * sev * ln(0.4); A1 += 0.2 * sev; }
    if (cls === 4) { ei += 0.12 * sev * ln(0.35); eo += 0.03 * sev * ln(0.5); k += 2.2 * sev * sev * ln(0.4); A1 += 0.2 * sev; }
    const rms = Math.sqrt(A1 * A1 + A2 * A2 + 0.3 * 0.3 + 40 * (eo * eo + ei * ei)) * ln(0.05);
    return [rms, k, A1, A2, ax / Math.max(0.2, A1), eo, ei].map(v => +v.toFixed(4));
  }
  function draws(tag, n) {
    const R = C.rng('AIENG|mec|' + tag), X = [], y = [];
    for (let i = 0; i < n; i++) {
      let u = R(), c = 0; while (c < 4 && u > PRIOR[c]) { u -= PRIOR[c]; c++; }
      X.push(measure(R, c, R.uniform(0.15, 1))); y.push(CLASSES[c]);
    }
    return { X, y };
  }
  // conventional diagnosis: the rule chart a technician would follow
  function rule(x) {
    const [rms, k, A1, A2, ax, eo, ei] = x;
    if (k > 4) return eo >= ei ? 'OuterRace' : 'InnerRace';
    if (A2 > 0.5 * A1 && A1 > 1.2) return 'Misalignment';
    if (rms > 2.8) return 'Unbalance';
    return 'Healthy';
  }

  const sh1 = {
    id: 'bearing', title: 'Shaft and bearing defect frequencies', short: 'Defect frequencies',
    lead: 'The pump runs at N rpm on a deep-groove ball bearing (contact angle 0°) with n<sub>b</sub> balls of diameter d on pitch diameter D. With f<sub>r</sub> = N/60: BPFO = (n<sub>b</sub>/2) f<sub>r</sub>(1 − d/D), BPFI = (n<sub>b</sub>/2) f<sub>r</sub>(1 + d/D), BSF = (D/2d) f<sub>r</sub>(1 − (d/D)²), FTF = (f<sub>r</sub>/2)(1 − d/D).',
    keys: [{ key: 'fr', label: 'Shaft frequency f<sub>r</sub>', unit: 'Hz' }, { key: 'BPFO', label: 'Outer-race defect frequency BPFO', unit: 'Hz' }, { key: 'BPFI', label: 'Inner-race defect frequency BPFI', unit: 'Hz' }, { key: 'BSF', label: 'Ball spin frequency BSF', unit: 'Hz' }, { key: 'FTF', label: 'Cage frequency FTF', unit: 'Hz' }],
    answers: p => ({ fr: p.fr, ...bearing(p) }),
    solution: p => { const b = bearing(p); return `<p>f<sub>r</sub> = ${p.N}/60 = <b>${C.fmt(p.fr, 5)} Hz</b>, d/D = ${p.d}/${p.D} = ${C.fmt(p.d / p.D, 4)}. BPFO = <b>${C.fmt(b.BPFO, 5)} Hz</b>, BPFI = <b>${C.fmt(b.BPFI, 5)} Hz</b>, BSF = <b>${C.fmt(b.BSF, 5)} Hz</b>, FTF = <b>${C.fmt(b.FTF, 5)} Hz</b>. A peak at BPFO in the envelope spectrum points to an outer-race defect; BPFI (with f<sub>r</sub> sidebands) to the inner race.</p>`; }
  };
  const sh2 = {
    id: 'severity', title: 'Vibration severity and unbalance force', short: 'Severity, unbalance',
    lead: 'The 1× (running-speed) vibration of the bearing housing has a peak displacement X. For a harmonic motion x = X sin ωt: velocity peak = ωX, acceleration peak = ω²X, and velocity RMS = ωX/√2. The rotor carries a residual unbalance U (g·mm); the rotating force is F = U ω².',
    keys: [{ key: 'vrms', label: 'Velocity RMS at 1×', unit: 'mm/s' }, { key: 'apk', label: 'Acceleration peak at 1×', unit: 'm/s²' }, { key: 'F', label: 'Unbalance force F', unit: 'N' }],
    answers: p => { const w = 2 * Math.PI * p.fr; return { vrms: w * p.X * 1e-3 / Math.SQRT2, apk: w * w * p.X * 1e-6, F: p.U * 1e-6 * w * w }; },
    solution: p => { const w = 2 * Math.PI * p.fr; return `<p>ω = 2π·${C.fmt(p.fr, 4)} = ${C.fmt(w, 5)} rad/s, X = ${p.X} µm. v<sub>rms</sub> = ωX/√2 = <b>${C.fmt(w * p.X * 1e-3 / Math.SQRT2, 5)} mm/s</b>; a<sub>pk</sub> = ω²X = <b>${C.fmt(w * w * p.X * 1e-6, 5)} m/s²</b>; F = Uω² = ${p.U}×10⁻⁶·${C.fmt(w, 5)}² = <b>${C.fmt(p.U * 1e-6 * w * w, 5)} N</b>. ISO 10816 judges machine condition from the velocity RMS (a few mm/s is the usual alarm zone for medium pumps).</p>`; }
  };

  const predictors = [
    { name: 'rms_v_mms', unit: 'mm/s', desc: 'overall velocity RMS (10–1000 Hz)', range: [0, 8] }, { name: 'kurtosis', unit: '—', desc: 'kurtosis of the acceleration signal', range: [2.5, 12] },
    { name: 'A1x_mms', unit: 'mm/s', desc: 'velocity amplitude at 1× running speed', range: [0, 7] }, { name: 'A2x_mms', unit: 'mm/s', desc: 'velocity amplitude at 2× running speed', range: [0, 5] },
    { name: 'axial_ratio', unit: '—', desc: 'axial / radial 1× amplitude', range: [0, 2] }, { name: 'env_bpfo_g', unit: 'g', desc: 'envelope-spectrum amplitude at BPFO', range: [0, 0.4] },
    { name: 'env_bpfi_g', unit: 'g', desc: 'envelope-spectrum amplitude at BPFI', range: [0, 0.4] }];
  const dataset = (p, id, N) => { const d = draws('data|' + id, N); return d.X.map((x, i) => [...x, d.y[i]]); };
  const cache = {};
  function predictSet(p, id) {
    if (cache[id]) return cache[id];
    const h = draws('hidden|' + id, NHID), c = draws('survey|' + p.seed, NCH), R = C.rng('AIENG|mec|mix|' + id);
    const rows = [...h.X.map((x, i) => ({ x, y: h.y[i], hid: true })), ...c.X.map((x, i) => ({ x, y: c.y[i], hid: false, k: i }))];
    for (let i = rows.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [rows[i], rows[j]] = [rows[j], rows[i]]; }
    const ids = rows.map((_, i) => 'R' + String(i + 1).padStart(4, '0'));
    return (cache[id] = { ids, X: rows.map(r => r.x), y: rows.map(r => r.y), hidden: rows.map(r => r.hid), survey: rows.map((r, i) => r.hid ? null : { k: r.k, i }).filter(Boolean).sort((a, b) => a.k - b.k).map(o => o.i) });
  }
  function cost(t, d, s) { if (t === 'Healthy') return d === 'Healthy' ? 0 : s.inspect; if (d === 'Healthy') return s.breakdown; return d === t ? s.repair : 2 * s.repair; }

  function run(p, s, mode) {
    const set = predictSet(p, p._id), out = { t: [], cost: [], err: [], truth: [], diag: [] };
    let tot = 0, err = 0, miss = 0, fa = 0, wrong = 0;
    set.survey.forEach((i, k) => {
      const t = set.y[i], d = mode === 'reference' ? t : mode === 'conventional' ? rule(set.X[i]) : mode(set.ids[i]);
      if (d === undefined || d === null) throw new Error('Your prediction file has no diagnosis for survey machine ' + set.ids[i] + '. Export it from this page\'s spec file.');
      const dd = String(d); tot += cost(t, dd, s);
      if (dd !== t) { err++; if (t === 'Healthy') fa++; else if (dd === 'Healthy') miss++; else wrong++; }
      out.t.push(k + 1); out.cost.push(tot); out.err.push(err); out.truth.push(t); out.diag.push(dd);
    });
    return { trace: out, cost: tot, metrics: { cost: tot, missed: miss, falseAlarms: fa, wrongType: wrong, accuracy: 100 * (1 - err / NCH) } };
  }
  const COL = { Healthy: '#0f7a55', Unbalance: '#1f5fa8', Misalignment: '#7a4fb0', OuterRace: '#a8843a', InnerRace: '#b8322a' };
  function draw(ctx, W, H, p, tr, i) {
    const cols = 16, cw = Math.min(44, (W - 220) / cols), ink = '#0d2b55';
    for (let k = 0; k < tr.t.length; k++) {
      const x = 20 + (k % cols) * cw, y = 20 + Math.floor(k / cols) * (cw + 4);
      ctx.strokeStyle = '#c9d3e1'; ctx.lineWidth = 1; ctx.strokeRect(x, y, cw - 6, cw - 6);
      if (k <= i) { const ok = tr.truth[k] === tr.diag[k]; ctx.fillStyle = ok ? (tr.truth[k] === 'Healthy' ? '#d7efe5' : '#dfe8f6') : '#f6d9d6'; ctx.fillRect(x + 1, y + 1, cw - 8, cw - 8);
        ctx.fillStyle = COL[tr.truth[k]]; ctx.beginPath(); ctx.arc(x + (cw - 6) / 2, y + (cw - 6) / 2, 5, 0, 7); ctx.fill(); }
      if (k === i) { ctx.strokeStyle = ink; ctx.lineWidth = 2.5; ctx.strokeRect(x - 2, y - 2, cw - 2, cw - 2); }
    }
    const x0 = W - 190; ctx.fillStyle = ink; ctx.font = '600 13px IBM Plex Mono, monospace'; ctx.fillText(`Machine ${tr.t[i]} / ${tr.t.length}`, x0, 34);
    ctx.font = '12px IBM Plex Mono, monospace'; ctx.fillText('true:  ' + tr.truth[i], x0, 58); ctx.fillText('diag.: ' + tr.diag[i], x0, 76);
    ctx.fillStyle = tr.truth[i] === tr.diag[i] ? '#0f7a55' : '#b8322a'; ctx.fillText(tr.truth[i] === tr.diag[i] ? '✔ correct' : '✘ wrong', x0, 96);
    ctx.fillStyle = ink; ctx.fillText(`cost so far: ${tr.cost[i].toFixed(0)} k$`, x0, 122);
    CLASSES.forEach((c, k) => { ctx.fillStyle = COL[c]; ctx.beginPath(); ctx.arc(x0 + 5, 146 + 16 * k, 5, 0, 7); ctx.fill(); ctx.fillStyle = ink; ctx.fillText(c, x0 + 16, 150 + 16 * k); });
  }
  function sketchSVG(col, acc) {
    return `<g fill="none" stroke="${col}" stroke-width="1.5"><rect x="40" y="150" width="130" height="90" rx="6"/><path d="M60 150 v-14 h90 v14 M40 240 h130" /><path d="M170 195 h60"/><circle cx="240" cy="195" r="12"/>
      <path d="M252 195 h20"/><path d="M272 150 h60 a45 45 0 0 1 0 90 h-60 z"/><path d="M300 150 v-40 h50"/><path d="M30 255 h330"/>
      <rect x="225" y="160" width="16" height="12" fill="${acc}" stroke="${acc}"/><path d="M233 160 q10 -40 60 -60" stroke="${acc}" stroke-dasharray="5 4"/>
      <path d="M300 90 l8 -10 l8 20 l8 -30 l8 30 l8 -20 l8 10" stroke="${acc}"/></g>
      <g font-family="IBM Plex Mono,monospace" font-size="12" fill="${col}"><text x="70" y="275">motor</text><text x="290" y="275">pump</text><text x="170" y="150">accelerometer</text></g>`;
  }
  function systemHTML(p) {
    const b = bearing(p);
    return `<p class="lead">A plant runs motor-driven centrifugal pumps. A technician records the bearing-housing vibration of every pump once per survey round; each recording is reduced to seven spectral features. Your task is to turn those features into a diagnosis.</p>
      <div class="grid2"><table class="spec"><tr><th>QUANTITY</th><th>VALUE</th></tr><tr><td>Running speed N</td><td class="num">${p.N} rpm</td></tr><tr><td>Number of balls n<sub>b</sub></td><td class="num">${p.nb}</td></tr>
      <tr><td>Ball diameter d</td><td class="num">${p.d} mm</td></tr><tr><td>Pitch diameter D</td><td class="num">${p.D} mm</td></tr><tr><td>1× displacement X (peak)</td><td class="num">${p.X} µm</td></tr>
      <tr><td>Residual unbalance U</td><td class="num">${p.U} g·mm</td></tr><tr><td>Fault classes</td><td>${CLASSES.join(', ')}</td></tr></table>
      <div><svg viewBox="0 0 400 300" style="width:100%">${sketchSVG('#0d2b55', '#1f5fa8')}</svg></div></div>`;
  }
  const P0 = params; // keep the student id with the parameters so the challenge can find its survey rows
  root.TOOL = {
    id: 'mec-vibration-diagnosis', courseLine: 'MECHANICAL VIBRATIONS', title: 'Vibration Diagnosis Challenge', subtitle: 'Diagnosing rotating-machine faults from vibration features',
    dept: 'FACULTY OF ENGINEERING · DEPARTMENT OF MECHANICAL ENGINEERING', assessment: 'Mechanical Vibrations Technical Assessment',
    cover1: 'covering bearing defect frequencies, vibration severity, unbalance force,', cover2: 'and a machine-learning classifier that diagnoses pump faults.',
    sketchLabel: 'MOTOR–PUMP SET', sketchSVG, systemHTML, sheets: [sh1, sh2],
    params: id => Object.assign(P0(id), { _id: String(id) }),
    ml: {
      title: 'Diagnosing the fault class', task: 'classification', mode: 'predict', predictors, defaultN: 4000, threshold: 0.87,
      response: { name: 'condition', unit: '', desc: 'machine condition: ' + CLASSES.join(' / '), classes: CLASSES },
      explainHTML: () => 'The technician\'s rule chart (kurtosis above 4 → bearing; 2× above half of 1× → misalignment; overall RMS above 2.8 mm/s → unbalance; otherwise healthy) misses early bearing defects and confuses mixed symptoms. Train a classifier on labelled survey records from your plant, then predict the condition of every unlabelled record in the spec file (hidden test records and this round\'s survey).',
      dataset, predictSet
    },
    challenge: {
      title: 'One survey round: 80 pumps', short: 'Maintenance cost', convLabel: 'Technician rule chart', refLabel: 'Perfect diagnosis', indexLabel: 'Maintenance Index', costLabel: 'maintenance cost [k$]', xlabel: 'machine',
      settings: [{ key: 'breakdown', label: 'Cost of a missed fault (breakdown)', unit: 'k$', default: 20, min: 5, max: 60, step: 1 },
        { key: 'repair', label: 'Cost of a planned repair', unit: 'k$', default: 3, min: 1, max: 10, step: 0.5 }, { key: 'inspect', label: 'Cost of a false alarm (needless stop)', unit: 'k$', default: 2, min: 0.5, max: 10, step: 0.5 }],
      describe: (p, s) => `Each pump of the survey is diagnosed and acted on: <i>Healthy</i> → keep running; a fault → stop and repair it. A missed fault costs a breakdown (${s.breakdown} k$), a planned repair ${s.repair} k$, a wrong fault type two repairs, a false alarm ${s.inspect} k$. <b>Conventional</b>: the technician's rule chart. <b>ML</b>: your classifier's diagnoses. Scored by the total maintenance cost.`,
      run, draw, sceneHeight: 240, animSeconds: 8, minIndex: 60,
      metrics: [{ key: 'cost', label: 'Maintenance cost', unit: 'k$', d: 4 }, { key: 'accuracy', label: 'Correct diagnoses', unit: '%', d: 4 }, { key: 'missed', label: 'Missed faults', unit: '', d: 3 }, { key: 'falseAlarms', label: 'False alarms', unit: '', d: 3 }, { key: 'wrongType', label: 'Wrong fault type', unit: '', d: 3 }],
      plots: [{ title: 'cumulative maintenance cost [k$]', series: [{ key: 'cost', label: 'cost', color: '#0d2b55' }] }, { title: 'cumulative wrong diagnoses', series: [{ key: 'err', label: 'errors', color: '#b8322a' }] }]
    },
    _internal: { rule, bearing, CLASSES }
  };
})(typeof window !== 'undefined' ? window : globalThis);
