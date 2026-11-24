/* Civil — Traffic Signal Split Optimizer (AI for Engineering, v1.0, Y. Ajra)
   Two-phase signalised intersection. Students apply Webster's method, then train a delay model from
   simulated traffic and use it to set the green split hour by hour over a day. */
(function (root) {
  'use strict';
  const C = root.Common;
  const CYCLE = 90, LOST = 10, SPLITS = Array.from({ length: 41 }, (_, i) => +(0.2 + i * 0.015).toFixed(3));

  function params(id) {
    const R = C.rng('AIENG|trf|' + id);
    return { n1: R() < 0.5 ? 2 : 3, n2: 1, s1: C.roundTo(R.uniform(1700, 1900), 50), s2: C.roundTo(R.uniform(1400, 1700), 50), q1: C.roundTo(R.uniform(600, 900), 10), q2: C.roundTo(R.uniform(300, 550), 10),
      L: LOST, peak1: R.uniform(0.95, 1.15), peak2: R.uniform(0.85, 1.1), seed: Math.floor(R() * 1e9) };
  }
  // HCM-2000 delay (uniform + incremental, T = 0.25 h) for each phase; works beyond saturation
  function hourDelay(p, q1, q2, split) {
    const G = CYCLE - LOST, g = [G * split, G * (1 - split)], q = [q1, q2], s = [p.s1, p.s2], n = [p.n1, p.n2], T = 0.25; let tot = 0, veh = 0;
    for (let i = 0; i < 2; i++) {
      const lam = g[i] / CYCLE, c = s[i] * lam, X = q[i] / c;
      const d1 = 0.5 * CYCLE * (1 - lam) ** 2 / (1 - Math.min(1, X) * lam);
      const d2 = 900 * T * ((X - 1) + Math.sqrt((X - 1) ** 2 + 8 * 0.5 * X / (c * T)));
      tot += n[i] * q[i] * Math.min(600, d1 + d2); veh += n[i] * q[i];
    }
    return { avg: tot / veh, vehHours: tot / 3600 };
  }
  function webster(p, q1, q2) {
    const y1 = q1 / p.s1, y2 = q2 / p.s2, Y = y1 + y2, C0 = (1.5 * LOST + 5) / (1 - Y), g1 = (C0 - LOST) * y1 / Y, g2 = (C0 - LOST) * y2 / Y;
    return { y1, y2, Y, C0, g1, g2, split: y1 / Y };
  }
  const sh1 = {
    id: 'webster', title: "Webster's optimum cycle", short: 'Flow ratios, cycle, greens',
    lead: 'Use the design-hour flows and saturation flows of your intersection (two phases, total lost time L = 10 s). Webster: C<sub>0</sub> = (1.5L + 5)/(1 − Y), effective greens in proportion to the critical flow ratios.',
    keys: [{ key: 'Y', label: 'Sum of critical flow ratios Y = q<sub>1</sub>/s<sub>1</sub> + q<sub>2</sub>/s<sub>2</sub>', unit: '—' }, { key: 'C0', label: 'Optimum cycle length C<sub>0</sub>', unit: 's' },
      { key: 'g1', label: 'Effective green, phase 1 (main street)', unit: 's' }, { key: 'g2', label: 'Effective green, phase 2 (side street)', unit: 's' }],
    answers: p => { const w = webster(p, p.q1, p.q2); return { Y: w.Y, C0: w.C0, g1: w.g1, g2: w.g2 }; },
    solution: p => { const w = webster(p, p.q1, p.q2), f = x => C.fmt(x, 5);
      return `<p>y<sub>1</sub> = ${p.q1}/${p.s1} = ${f(w.y1)}, y<sub>2</sub> = ${p.q2}/${p.s2} = ${f(w.y2)}, Y = <b>${f(w.Y)}</b></p><p>C<sub>0</sub> = (1.5·10 + 5)/(1 − ${f(w.Y)}) = <b>${f(w.C0)} s</b></p><p>g<sub>1</sub> = (C<sub>0</sub> − L)y<sub>1</sub>/Y = <b>${f(w.g1)} s</b>, g<sub>2</sub> = <b>${f(w.g2)} s</b></p>`; }
  };
  const sh2 = {
    id: 'delay', title: 'Degree of saturation and uniform delay', short: 'Webster delay terms',
    lead: `The city runs a fixed cycle C = ${CYCLE} s (L = ${LOST} s). With Webster's split of the effective green (${CYCLE - LOST} s in proportion to y<sub>1</sub>, y<sub>2</sub>), evaluate phase 1 (main street). Green ratio λ = g/C, degree of saturation x = q/(λs), uniform delay d<sub>u</sub> = C(1 − λ)²/[2(1 − λx)].`,
    keys: [{ key: 'lam1', label: 'Green ratio λ<sub>1</sub>', unit: '—' }, { key: 'x1', label: 'Degree of saturation x<sub>1</sub>', unit: '—' }, { key: 'du1', label: 'Uniform delay d<sub>u1</sub>', unit: 's/veh' }],
    answers: p => { const w = webster(p, p.q1, p.q2), lam = (CYCLE - LOST) * w.split / CYCLE, x = p.q1 / (lam * p.s1); return { lam1: lam, x1: x, du1: CYCLE * (1 - lam) ** 2 / (2 * (1 - lam * x)) }; },
    solution: p => { const w = webster(p, p.q1, p.q2), lam = (CYCLE - LOST) * w.split / CYCLE, x = p.q1 / (lam * p.s1), f = v => C.fmt(v, 5);
      return `<p>g<sub>1</sub> = 80·y<sub>1</sub>/Y = ${f(80 * w.split)} s, λ<sub>1</sub> = g<sub>1</sub>/C = <b>${f(lam)}</b>; x<sub>1</sub> = q<sub>1</sub>/(λ<sub>1</sub>s<sub>1</sub>) = <b>${f(x)}</b>; d<sub>u1</sub> = 90(1−λ)²/[2(1−λx)] = <b>${f(CYCLE * (1 - lam) ** 2 / (2 * (1 - lam * x)))} s/veh</b></p>`; }
  };
  const predictors = [{ name: 'q_main', unit: 'veh/h', desc: 'main-street flow per lane (phase 1)', range: [200, 1300] }, { name: 'q_side', unit: 'veh/h', desc: 'side-street flow per lane (phase 2)', range: [100, 900] }, { name: 'split', unit: '—', desc: 'share of the effective green given to phase 1', range: [0.2, 0.8] }];
  const axes = { q_main: C.linspace(200, 1300, 23), q_side: C.linspace(100, 900, 17), split: C.linspace(0.2, 0.8, 25) };
  const sample = R => [R.uniform(200, 1300), R.uniform(100, 900), R.uniform(0.2, 0.8)];
  function dataset(p, id, N) { const R = C.rng('AIENG|trf|data|' + id), rows = []; for (let i = 0; i < N; i++) { const x = sample(R); rows.push([+x[0].toFixed(1), +x[1].toFixed(1), +x[2].toFixed(4), +(Math.log10(hourDelay(p, ...x).avg) + 0.02 * R.normal()).toFixed(4)]); } return rows; }
  function hiddenTest(p, id) { const R = C.rng('AIENG|trf|hidden|' + id), X = [], y = []; for (let i = 0; i < 2000; i++) { const x = sample(R); X.push(x); y.push(Math.log10(hourDelay(p, ...x).avg)); } return { X, y }; }

  function demand(p, s) {
    const out = [];
    for (let h = 0; h < 24; h++) {
      const am = Math.exp(-((h - 8) ** 2) / 3), pm = Math.exp(-((h - 17.5) ** 2) / 4), base = 0.25 + 0.35 * Math.exp(-((h - 13) ** 2) / 20);
      out.push({ h, q1: Math.min(1300, p.q1 * s.demand / 100 * (base + p.peak1 * (0.9 * am + 0.7 * pm))), q2: Math.min(900, p.q2 * s.demand / 100 * (base + p.peak2 * (0.5 * am + 1.0 * pm))) });
    }
    return out;
  }
  function run(p, s, mode) {
    const tr = { t: [], split: [], split_ref: [], d: [], q1: [], q2: [] }; let vh = 0, veh = 0;
    for (const h of demand(p, s)) {
      const truth = sp => hourDelay(p, h.q1, h.q2, sp);
      const best = SPLITS.reduce((b, sp) => { const d = truth(sp).avg; return d < b.d ? { sp, d } : b; }, { sp: 0.5, d: Infinity });
      let sp; if (mode === 'reference') sp = best.sp; else if (mode === 'conventional') sp = webster(p, h.q1, h.q2).split;
      else sp = SPLITS.reduce((b, x) => { const d = mode(h.q1, h.q2, x); return d < b.d ? { sp: x, d } : b; }, { sp: 0.5, d: Infinity }).sp;
      sp = Math.max(0.2, Math.min(0.8, sp)); const r = truth(sp);
      vh += r.vehHours; veh += p.n1 * h.q1 + p.n2 * h.q2;
      tr.t.push(h.h); tr.split.push(sp); tr.split_ref.push(best.sp); tr.d.push(r.avg); tr.q1.push(h.q1); tr.q2.push(h.q2);
    }
    return { trace: tr, cost: vh, metrics: { vh, avg: 3600 * vh / veh, worst: Math.max(...tr.d) } };
  }
  function draw(ctx, W, H, p, tr, i) {
    const ink = '#0d2b55', cx = 230, cy = H / 2, rw = 60, sp = tr.split[i], ph = (performance.now() / 1000 * 8) % CYCLE, g1 = (CYCLE - LOST) * sp, on1 = ph < g1, on2 = ph >= g1 + 5 && ph < CYCLE - 5;
    ctx.fillStyle = '#eef1f6'; ctx.fillRect(0, cy - rw / 2, W * 0.6, rw); ctx.fillRect(cx - rw / 2, 0, rw, H);
    ctx.strokeStyle = ink; ctx.lineWidth = 1.2; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W * 0.6, cy); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke(); ctx.setLineDash([]);
    const light = (x, y, g) => { ctx.fillStyle = '#fff'; ctx.strokeRect(x, y, 16, 34); ctx.fillStyle = g ? '#0f7a55' : '#c9d3e1'; ctx.beginPath(); ctx.arc(x + 8, y + 25, 6, 0, 7); ctx.fill(); ctx.fillStyle = g ? '#c9d3e1' : '#b8322a'; ctx.beginPath(); ctx.arc(x + 8, y + 9, 6, 0, 7); ctx.fill(); };
    light(cx - rw / 2 - 24, cy + rw / 2 + 4, on1); light(cx + rw / 2 + 8, cy - rw / 2 - 40, on2);
    const n1 = Math.min(14, Math.round(tr.d[i] / 8 * tr.q1[i] / 800)), n2 = Math.min(6, Math.round(tr.d[i] / 8 * tr.q2[i] / 600));
    ctx.fillStyle = '#0b6bd3'; for (let k = 0; k < n1; k++) ctx.fillRect(cx - rw / 2 - 26 - k * 16, cy + 6, 12, 8);
    ctx.fillStyle = '#a8843a'; for (let k = 0; k < n2; k++) ctx.fillRect(cx - 14, cy + rw / 2 + 6 + k * 16, 8, 12);
    ctx.fillStyle = ink; ctx.font = '12px IBM Plex Mono, monospace'; const x0 = W * 0.62;
    ctx.fillText(`hour ${String(tr.t[i]).padStart(2, '0')}:00`, x0, 40); ctx.fillText(`main  ${tr.q1[i].toFixed(0)} veh/h`, x0, 64); ctx.fillText(`side  ${tr.q2[i].toFixed(0)} veh/h`, x0, 84);
    ctx.fillText(`green split  ${(100 * sp).toFixed(1)} % main`, x0, 112); ctx.fillText(`avg delay  ${tr.d[i].toFixed(1)} s/veh`, x0, 132);
  }
  function sketchSVG(col, acc) {
    return `<g fill="none" stroke="${col}" stroke-width="1.5"><path d="M20 160 h150 v-140 M250 20 v140 h150 M20 240 h150 v140 M250 380 v-140 h150"/><path d="M20 200 h380 M210 20 v360" stroke-dasharray="10 8" stroke="${acc}"/>
      <rect x="140" y="250" width="14" height="30"/><rect x="262" y="120" width="14" height="30"/><rect x="60" y="208" width="26" height="14"/><rect x="96" y="208" width="26" height="14"/><rect x="218" y="300" width="14" height="26"/></g>
      <g font-family="IBM Plex Mono,monospace" font-size="12" fill="${col}"><text x="24" y="150">main street</text><text x="260" y="340">side street</text></g>`;
  }
  function systemHTML(p) {
    return `<p class="lead">A two-phase signalised intersection: phase 1 serves the main street, phase 2 the side street. Flows and saturation flows are unique to your ID.</p>
      <div class="grid2"><table class="spec"><tr><th>QUANTITY</th><th>MAIN (1)</th><th>SIDE (2)</th></tr>
      <tr><td>Through lanes</td><td class="num">${p.n1}</td><td class="num">${p.n2}</td></tr><tr><td>Design-hour flow q (per lane)</td><td class="num">${p.q1} veh/h</td><td class="num">${p.q2} veh/h</td></tr><tr><td>Saturation flow s</td><td class="num">${p.s1} veh/h</td><td class="num">${p.s2} veh/h</td></tr>
      <tr><td>Total lost time L</td><td class="num" colspan="2">${LOST} s per cycle</td></tr><tr><td>Operating cycle (city policy)</td><td class="num" colspan="2">${CYCLE} s</td></tr></table>
      <div><svg viewBox="0 0 420 400" style="width:100%">${sketchSVG('#0d2b55', '#1f5fa8')}</svg></div></div>`;
  }
  root.TOOL = {
    id: 'civ-traffic-signal', courseLine: 'CIVIL ENGINEERING · TRANSPORTATION ENGINEERING', title: 'Traffic Signal Challenge', subtitle: 'Learning intersection delay to set green splits through the day',
    dept: 'FACULTY OF ENGINEERING · DEPARTMENT OF CIVIL AND ENVIRONMENTAL ENGINEERING', assessment: 'Transportation Engineering Technical Assessment',
    cover1: "covering flow ratios, Webster's optimum cycle and signal delay,", cover2: 'and a machine-learning delay model that sets the green split hour by hour.',
    sketchLabel: 'SIGNALISED INTERSECTION', sketchSVG, params, systemHTML, sheets: [sh1, sh2],
    ml: {
      title: 'Learning intersection delay', task: 'regression', mode: 'grid', predictors, axes, defaultN: 4000, threshold: 0.98,
      response: { name: 'log10_delay', unit: 'log10(s/veh)', desc: 'log10 of the measured average delay per vehicle, all lanes (field survey, ±5 %)', range: [0, 2.5] },
      explainHTML: p => `Webster's split gives each phase green in proportion to its critical lane flow ratio. It ignores that the main street carries ${p.n1} lanes of traffic and the side street one, and it is inaccurate near saturation in the peaks.`+" Train a model of the average delay from simulated hours of traffic at your intersection; the controller will use it to choose the split every hour. The data are field delay surveys at many flow and split combinations (±5 % measurement noise).",
      dataset, hiddenTest
    },
    challenge: {
      title: 'A full day at your intersection', short: 'Vehicle-hours of delay', convLabel: "Webster's split", refLabel: 'Best split every hour (simulation search)', indexLabel: 'Delay Reduction Index', costLabel: 'total vehicle-hours of delay', xlabel: 'hour of the day',
      settings: [{ key: 'demand', label: 'Demand level', unit: '% of design', default: 100, min: 70, max: 130, step: 5 }],
      describe: (p, s) => `24 hours of demand with morning and evening peaks (${s.demand} % of the design level). The cycle stays at ${CYCLE} s; each hour the green split between the two phases is set. <b>Conventional</b>: Webster's split y<sub>1</sub>/Y. <b>ML</b>: the split (0.20–0.80) that minimises your predicted delay. Scored by the total vehicle-hours of delay (HCM delay model of the real intersection).`,
      run, draw, sceneHeight: 260, animSeconds: 8, minIndex: 40,
      metrics: [{ key: 'vh', label: 'Total delay', unit: 'veh·h', d: 5 }, { key: 'avg', label: 'Average delay', unit: 's/veh', d: 4 }, { key: 'worst', label: 'Worst hour', unit: 's/veh', d: 4 }],
      plots: [{ title: 'green split of phase 1', series: [{ key: 'split', label: 'chosen split', color: '#0d2b55' }, { key: 'split_ref', label: 'best split', color: '#a8843a', dash: [5, 3] }], ylim: [0.15, 0.85] },
        { title: 'average delay per hour [s/veh]', series: [{ key: 'd', label: 'delay', color: '#0b6bd3' }] }]
    },
    _internal: { hourDelay, webster }
  };
})(typeof window !== 'undefined' ? window : globalThis);
