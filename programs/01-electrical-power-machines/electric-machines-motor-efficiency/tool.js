/* Electric Machines — Induction-Motor Efficiency Challenge (AI for Engineering, v1.0, Y. Ajra)
   Students solve the equivalent circuit, then train an efficiency model η(f, T, k) and use it to pick the
   flux level k = V/(Vr·f/fr) of a variable-frequency drive over a 24-hour load cycle. */
(function (root) {
  'use strict';
  const C = root.Common;
  const POLES = 4, FR = 50, VR = 400 / Math.sqrt(3), K_MIN = 0.3, K_MAX = 1.1, MARGIN = 0.6;
  const KS = Array.from({ length: 81 }, (_, i) => +(K_MIN + i * 0.01).toFixed(2));

  function params(id) {
    const R = C.rng('AIENG|em|' + id);
    return {
      R1: C.roundTo(R.uniform(0.25, 0.45), 0.01), R2: C.roundTo(R.uniform(0.20, 0.40), 0.01),
      X: C.roundTo(R.uniform(0.70, 1.00), 0.01),          // X1 = X2 at 50 Hz
      Xm: C.roundTo(R.uniform(18, 28), 0.5), Rc: C.roundTo(R.uniform(350, 500), 10),
      Pfw0: C.roundTo(R.uniform(80, 150), 5), s0: C.roundTo(R.uniform(0.012, 0.022), 0.001),
      kQ: C.roundTo(R.uniform(0.6, 0.8), 0.05),
      cycleSeed: Math.floor(R() * 1e9)
    };
  }
  // ---- motor physics (approximate equivalent circuit, magnetising branch at the terminals)
  function op(p, f, V, s) {
    const a = f / FR, X = 2 * p.X * a, ns = 120 * f / POLES, ws = 2 * Math.PI * ns / 60;
    const I2 = V / Math.hypot(p.R1 + p.R2 / s, X), Pag = 3 * I2 * I2 * p.R2 / s, T = Pag / ws;
    const n = ns * (1 - s), Pfw = p.Pfw0 * (n / 1500) ** 2, Pconv = Pag * (1 - s), Pout = Pconv - Pfw;
    const Rc = p.Rc * Math.sqrt(a), Pcore = 3 * V * V / Rc, Pcu1 = 3 * I2 * I2 * p.R1, Pin = Pcore + Pcu1 + Pag;
    return { ns, ws, I2, T, n, Pfw, Pout, Pcore, Pcu1, Pcu2: s * Pag, Pag, Pin, eta: 100 * Pout / Pin };
  }
  function tmax(p, f, V) { const a = f / FR, X = 2 * p.X * a, ws = 2 * Math.PI * (120 * f / POLES) / 60; return 3 * V * V / (2 * ws * (p.R1 + Math.hypot(p.R1, X))); }
  const smaxT = (p, f) => p.R2 / Math.hypot(p.R1, 2 * p.X * f / FR);
  // operating point for a load torque T at frequency f and flux level k (null if beyond the margin)
  function solve(p, f, T, k) {
    const V = k * VR * f / FR;
    if (T > MARGIN * tmax(p, f, V)) return null;
    let lo = 1e-5, hi = smaxT(p, f);
    for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (op(p, f, V, m).T < T) lo = m; else hi = m; }
    return op(p, f, V, (lo + hi) / 2);
  }
  const etaTrue = (p, f, T, k) => { const o = solve(p, f, T, k); return o ? o.eta : NaN; };
  const feasible = (p, f, T, k) => T <= MARGIN * tmax(p, f, k * VR * f / FR);

  // ---- sheets
  const sh1 = {
    id: 'circuit', title: 'Equivalent circuit at rated voltage', short: 'Torque, power, efficiency',
    lead: 'A 4-pole, 50 Hz, 400 V (Y) induction motor runs from the rated supply (230.9 V per phase) at the slip given in the parameter table. Use the approximate equivalent circuit (magnetising branch R<sub>c</sub> ∥ jX<sub>m</sub> at the terminals).',
    keys: [{ key: 'ns', label: 'Synchronous speed n<sub>s</sub>', unit: 'rpm' }, { key: 'I2', label: 'Rotor current I<sub>2</sub> (per phase)', unit: 'A' },
      { key: 'Tind', label: 'Induced torque T<sub>ind</sub>', unit: 'N·m' }, { key: 'Pout', label: 'Output power P<sub>out</sub>', unit: 'W' }, { key: 'eta', label: 'Efficiency η', unit: '%' }],
    answers: p => { const o = op(p, FR, VR, p.s0); return { ns: o.ns, I2: o.I2, Tind: o.T, Pout: o.Pout, eta: o.eta }; },
    solution: p => { const o = op(p, FR, VR, p.s0), f = x => C.fmt(x, 5);
      return `<p>n<sub>s</sub> = 120f/P = 120·50/4 = <b>${f(o.ns)} rpm</b>; ω<sub>s</sub> = ${f(o.ws)} rad/s; n = n<sub>s</sub>(1−s) = ${f(o.n)} rpm.</p>
        <p>I<sub>2</sub> = V/√[(R<sub>1</sub>+R<sub>2</sub>/s)² + (X<sub>1</sub>+X<sub>2</sub>)²] = 230.94/√[(${p.R1}+${p.R2}/${p.s0})² + ${f(2 * p.X)}²] = <b>${f(o.I2)} A</b></p>
        <p>P<sub>AG</sub> = 3I<sub>2</sub>²R<sub>2</sub>/s = ${f(o.Pag)} W; T<sub>ind</sub> = P<sub>AG</sub>/ω<sub>s</sub> = <b>${f(o.T)} N·m</b></p>
        <p>P<sub>conv</sub> = (1−s)P<sub>AG</sub> = ${f(o.Pag * (1 - p.s0))} W; P<sub>F&W</sub> = P<sub>fw0</sub>(n/1500)² = ${f(o.Pfw)} W; P<sub>out</sub> = <b>${f(o.Pout)} W</b></p>
        <p>P<sub>core</sub> = 3V²/R<sub>c</sub> = ${f(o.Pcore)} W; P<sub>SCL</sub> = 3I<sub>2</sub>²R<sub>1</sub> = ${f(o.Pcu1)} W; P<sub>in</sub> = P<sub>core</sub> + P<sub>SCL</sub> + P<sub>AG</sub> = ${f(o.Pin)} W; η = <b>${f(o.eta)} %</b></p>`; }
  };
  const sh2 = {
    id: 'flux', title: 'Maximum torque and flux reduction', short: 'Pull-out torque, core loss',
    lead: 'Still at 50 Hz. A drive can lower the voltage (and the flux) at light load to save core loss, but the pull-out torque falls with V². Use the same parameters.',
    keys: [{ key: 'sTmax', label: 'Slip at maximum torque s<sub>Tmax</sub>', unit: '—' }, { key: 'Tmax', label: 'Maximum (pull-out) torque at rated voltage', unit: 'N·m' },
      { key: 'Pcore', label: 'Core loss at rated voltage', unit: 'W' }, { key: 'TmaxK', label: 'Maximum torque when V is reduced to k·V<sub>rated</sub> (k from the table)', unit: 'N·m' }],
    answers: p => ({ sTmax: smaxT(p, FR), Tmax: tmax(p, FR, VR), Pcore: 3 * VR * VR / p.Rc, TmaxK: tmax(p, FR, p.kQ * VR) }),
    solution: p => { const f = x => C.fmt(x, 5), Z = Math.hypot(p.R1, 2 * p.X);
      return `<p>s<sub>Tmax</sub> = R<sub>2</sub>/√(R<sub>1</sub>² + (X<sub>1</sub>+X<sub>2</sub>)²) = ${p.R2}/${f(Z)} = <b>${f(smaxT(p, FR))}</b></p>
        <p>T<sub>max</sub> = 3V² / [2ω<sub>s</sub>(R<sub>1</sub> + √(R<sub>1</sub>² + (X<sub>1</sub>+X<sub>2</sub>)²))] = <b>${f(tmax(p, FR, VR))} N·m</b></p>
        <p>P<sub>core</sub> = 3V²/R<sub>c</sub> = <b>${f(3 * VR * VR / p.Rc)} W</b>; at k·V the pull-out torque scales with k²: ${p.kQ}² × T<sub>max</sub> = <b>${f(tmax(p, FR, p.kQ * VR))} N·m</b> (core loss also scales with k²).</p>`; }
  };

  // ---- dataset / ML
  const predictors = [{ name: 'f_Hz', unit: 'Hz', desc: 'drive output frequency', range: [20, 50] }, { name: 'T_Nm', unit: 'N·m', desc: 'load torque', range: [2, 60] }, { name: 'k', unit: '—', desc: 'flux level k = V/(V_rated·f/50)', range: [K_MIN, K_MAX] }];
  const axes = { f_Hz: C.linspace(20, 50, 7), T_Nm: C.linspace(2, 60, 30), k: C.linspace(K_MIN, K_MAX, 25) };
  function sample(R, p) { for (;;) { const f = R.uniform(20, 50), T = R.uniform(2, 60), k = R.uniform(K_MIN, K_MAX); if (feasible(p, f, T, k)) return [f, T, k]; } }
  function dataset(p, id, N) {
    const R = C.rng('AIENG|em|data|' + id), rows = [];
    for (let i = 0; i < N; i++) { const [f, T, k] = sample(R, p); rows.push([+f.toFixed(3), +T.toFixed(3), +k.toFixed(4), +(etaTrue(p, f, T, k) + 0.15 * R.normal()).toFixed(3)]); }
    return rows;
  }
  function hiddenTest(p, id) { const R = C.rng('AIENG|em|hidden|' + id), X = [], y = []; for (let i = 0; i < 2000; i++) { const x = sample(R, p); X.push(x); y.push(etaTrue(p, ...x)); } return { X, y }; }

  // ---- challenge: 24-hour pump/fan load cycle on a VFD
  function cycle(p, s) {
    const R = C.rng('AIENG|em|cycle|' + p.cycleSeed), H = 48, out = [];
    for (let i = 0; i < H; i++) {
      const h = i / 2, day = 0.5 - 0.5 * Math.cos(2 * Math.PI * (h - 3) / 24);           // demand 0 at 03:00, 1 at 15:00
      const frac = Math.min(1, Math.max(0.15, s.minLoad / 100 + (1 - s.minLoad / 100) * day + 0.06 * R.normal()));
      const f = 20 + 30 * Math.sqrt(frac), T = 30 * frac + 2;                      // speed ~ √flow, torque ~ flow (pump-like)
      out.push({ h, f, T });
    }
    return out;
  }
  function run(p, s, mode) {
    const cyc = cycle(p, s), tr = { t: [], T: [], f: [], k: [], k_ref: [], eta: [], eta_ref: [], P: [] };
    let E = 0, Eout = 0;
    for (const c of cyc) {
      const ks = KS.filter(k => feasible(p, c.f, c.T, k));
      const best = ks.reduce((b, k) => { const e = etaTrue(p, c.f, c.T, k); return e > b.e ? { k, e } : b; }, { k: 1, e: -1 });
      let k;
      if (mode === 'reference') k = best.k;
      else if (mode === 'conventional') k = 1.0;
      else k = ks.reduce((b, kk) => { const e = mode(c.f, c.T, kk); return e > b.e ? { k: kk, e } : b; }, { k: 1, e: -Infinity }).k;
      const o = solve(p, c.f, c.T, k), Pin = o.Pin;
      E += Pin * 0.5 / 1000; Eout += o.Pout * 0.5 / 1000;
      tr.t.push(c.h); tr.T.push(c.T); tr.f.push(c.f); tr.k.push(k); tr.k_ref.push(best.k); tr.eta.push(o.eta); tr.eta_ref.push(best.e); tr.P.push(Pin / 1000);
    }
    return { trace: tr, cost: E - Eout, metrics: { L: E - Eout, E, eta: 100 * Eout / E } };
  }
  function draw(ctx, W, H, p, tr, i) {
    const ink = '#0d2b55', acc = '#0b6bd3', gold = '#a8843a', cx = 140, cy = H / 2, r = 70, ang = (tr.t[i] * 2.2 * tr.f[i]) % (2 * Math.PI);
    ctx.lineWidth = 1.5; ctx.strokeStyle = ink; ctx.fillStyle = '#fff';
    ctx.strokeRect(cx - 90, cy - 60, 150, 120); for (let k = 0; k < 7; k++) { ctx.beginPath(); ctx.moveTo(cx - 80 + k * 20, cy - 60); ctx.lineTo(cx - 80 + k * 20, cy - 72); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(cx - 15, cy, 44, 0, 2 * Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 15, cy); ctx.lineTo(cx - 15 + 40 * Math.cos(ang), cy + 40 * Math.sin(ang)); ctx.stroke();
    ctx.strokeRect(cx + 60, cy - 8, 70, 16); ctx.beginPath(); ctx.arc(cx + 150, cy, 22, 0, 2 * Math.PI); ctx.stroke();
    ctx.fillStyle = ink; ctx.font = '600 12px IBM Plex Mono, monospace'; ctx.fillText('MOTOR', cx - 40, cy + 82); ctx.fillText('PUMP', cx + 132, cy + 40);
    const bar = (x, label, v, max, col, txt) => { const bh = H - 80, h = Math.max(0, Math.min(1, v / max)) * bh; ctx.strokeStyle = ink; ctx.strokeRect(x, 30, 34, bh); ctx.fillStyle = col; ctx.fillRect(x + 1, 30 + bh - h, 32, h); ctx.fillStyle = ink; ctx.font = '11px IBM Plex Mono, monospace'; ctx.fillText(label, x - 6, H - 30); ctx.fillText(txt, x - 6, H - 14); };
    const x0 = Math.max(360, W - 330);
    bar(x0, 'load T', tr.T[i], 60, '#c9d3e1', tr.T[i].toFixed(1) + ' N·m'); bar(x0 + 80, 'freq', tr.f[i], 50, '#c9d3e1', tr.f[i].toFixed(1) + ' Hz');
    bar(x0 + 160, 'flux k', tr.k[i], 1.1, acc, tr.k[i].toFixed(2)); bar(x0 + 240, 'eff. η', tr.eta[i] - 60, 40, gold, tr.eta[i].toFixed(1) + ' %');
    ctx.fillStyle = ink; ctx.font = '12px IBM Plex Mono, monospace'; ctx.fillText(`t = ${String(Math.floor(tr.t[i])).padStart(2, '0')}:${tr.t[i] % 1 ? '30' : '00'}   P_in = ${tr.P[i].toFixed(2)} kW`, 14, 20);
  }
  function sketchSVG(col, acc) {
    return `<g fill="none" stroke="${col}" stroke-width="1.5"><rect x="60" y="140" width="200" height="130" rx="6"/>${Array.from({ length: 9 }, (_, i) => `<line x1="${75 + i * 21}" y1="140" x2="${75 + i * 21}" y2="124"/>`).join('')}
      <circle cx="160" cy="205" r="48"/><circle cx="160" cy="205" r="10"/><rect x="260" y="196" width="70" height="18"/><circle cx="350" cy="205" r="26"/><rect x="40" y="270" width="240" height="16"/>
      <line x1="160" y1="205" x2="200" y2="185" stroke="${acc}"/><path d="M60 100 h60 l10 -14 l10 28 l10 -28 l10 14 h60" stroke="${acc}"/></g>
      <g font-family="IBM Plex Mono,monospace" font-size="12" fill="${col}"><text x="62" y="318">3-phase induction motor</text><text x="300" y="250">load</text><text x="62" y="80">VFD: f, V = k·V_r·f/50</text></g>`;
  }
  function systemHTML(p) {
    return `<p class="lead">A 4-pole, 50 Hz, 400 V (Y-connected) induction motor drives a pump through a variable-frequency drive (VFD). Your motor's parameters are unique to your ID.</p>
      <div class="grid2"><table class="spec"><tr><th>PARAMETER (per phase, at 50 Hz)</th><th>VALUE</th></tr>
      <tr><td>Stator resistance R<sub>1</sub></td><td class="num">${p.R1} Ω</td></tr><tr><td>Rotor resistance R<sub>2</sub>' (referred)</td><td class="num">${p.R2} Ω</td></tr>
      <tr><td>Leakage reactances X<sub>1</sub> = X<sub>2</sub>'</td><td class="num">${p.X} Ω each</td></tr><tr><td>Magnetising reactance X<sub>m</sub></td><td class="num">${p.Xm} Ω</td></tr>
      <tr><td>Core-loss resistance R<sub>c</sub></td><td class="num">${p.Rc} Ω</td></tr><tr><td>Friction & windage at 1500 rpm P<sub>fw0</sub> (∝ n²)</td><td class="num">${p.Pfw0} W</td></tr>
      <tr><td>Operating slip for task 1, s</td><td class="num">${p.s0}</td></tr><tr><td>Reduced-voltage ratio for task 2, k</td><td class="num">${p.kQ}</td></tr></table>
      <div><svg viewBox="0 0 420 340" style="width:100%">${sketchSVG('#0d2b55', '#1f5fa8')}</svg></div></div>
      <div class="msg info small">Approximate equivalent circuit: R<sub>c</sub> ∥ jX<sub>m</sub> across the terminals, then R<sub>1</sub> + jX<sub>1</sub> + R<sub>2</sub>/s + jX<sub>2</sub>. Reactances scale with f/50; core loss = 3V²/R<sub>c</sub>.</div>`;
  }

  root.TOOL = {
    id: 'em-motor-efficiency', courseLine: 'ELECTRIC MACHINES', title: 'Motor Efficiency Challenge', subtitle: 'Learning the efficiency map of an induction-motor drive',
    dept: 'FACULTY OF ENGINEERING · DEPARTMENT OF ELECTRICAL AND COMPUTER ENGINEERING', assessment: 'Electric Machines Technical Assessment',
    cover1: 'covering the induction-motor equivalent circuit, torque, losses and efficiency,', cover2: 'and a machine-learning efficiency model that sets the flux level of a VFD.',
    sketchLabel: 'INDUCTION MOTOR + VFD', sketchSVG, params, systemHTML, sheets: [sh1, sh2],
    ml: {
      title: 'Learning the efficiency map', task: 'regression', mode: 'grid', predictors, axes, defaultN: 4000, threshold: 0.98,
      response: { name: 'eta_pct', unit: '%', desc: 'measured motor efficiency', range: [40, 95] },
      explainHTML: () => 'At light load a motor running at full flux wastes core loss; lowering the voltage (flux level k) saves energy until copper loss and slip grow. The best k depends on frequency and load in a nonlinear way. Train a model η(f, T, k) from dynamometer data of <b>your</b> motor; the drive will use it to choose k every 30 minutes.',
      dataset, hiddenTest
    },
    challenge: {
      title: '24-hour pump cycle on a VFD', short: 'Energy over a day', convLabel: 'Conventional V/f (k = 1)', refLabel: 'Ideal flux (exact efficiency map)', indexLabel: 'Energy Saving Index', costLabel: 'energy lost in the motor [kWh]', xlabel: 'time [h]',
      settings: [{ key: 'minLoad', label: 'Night-time load', unit: '% of peak', default: 20, min: 15, max: 60, step: 5 }],
      describe: (p, s) => `The pump follows a daily demand profile (night-time load ${s.minLoad} % of peak). Every 30 minutes the drive sets the frequency from the demand and chooses the flux level k from 0.30 to 1.10, keeping the load below ${100 * MARGIN} % of the pull-out torque. <b>Conventional</b>: k = 1. <b>ML</b>: the k that maximises your model's predicted efficiency. The score uses the energy lost in the motor, computed with its true efficiency.`,
      run, draw, sceneHeight: 260, animSeconds: 7, minIndex: 60,
      metrics: [{ key: 'L', label: 'Energy lost', unit: 'kWh', d: 4 }, { key: 'E', label: 'Input energy', unit: 'kWh', d: 5 }, { key: 'eta', label: 'Daily efficiency', unit: '%', d: 4 }],
      plots: [{ title: 'flux level k', series: [{ key: 'k', label: 'chosen k', color: '#0d2b55' }, { key: 'k_ref', label: 'optimal k', color: '#a8843a', dash: [5, 3] }], ylim: [0.25, 1.15] },
        { title: 'efficiency η [%]', series: [{ key: 'eta', label: 'η', color: '#0d2b55' }, { key: 'eta_ref', label: 'best possible η', color: '#a8843a', dash: [5, 3] }] }]
    },
    _internal: { op, solve, etaTrue, tmax, feasible }
  };
})(typeof window !== 'undefined' ? window : globalThis);
