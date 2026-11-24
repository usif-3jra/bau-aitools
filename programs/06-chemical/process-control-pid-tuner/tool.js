/* Chemical — Process-Control PI Tuner (AI for Engineering, v1.0, Y. Ajra)
   FOPDT process loops. Students compute Ziegler–Nichols and SIMC settings, then train a model of the
   closed-loop cost J(θ/τ, λ/θ, noise) and use it to choose the SIMC tuning λ for six plant loops. */
(function (root) {
  'use strict';
  const C = root.Common;
  const DT = 0.01, TEND = 30, TDIST = 15, LAMS = Array.from({ length: 57 }, (_, i) => +(0.2 + i * 0.05).toFixed(2)); // λ/θ candidates
  const NOISE = (() => { const R = C.rng('AIENG|pid|noise'), a = []; for (let i = 0; i < Math.ceil(TEND / 0.1) + 2; i++) a.push(R.normal()); return a; })();

  function params(id) {
    const R = C.rng('AIENG|pid|' + id);
    const p = { K: C.roundTo(R.uniform(0.5, 2.5), 0.05), tau: C.roundTo(R.uniform(5, 20), 0.5), theta: C.roundTo(R.uniform(1, 6), 0.25), lamQ: 1 };
    p.loops = [{ name: 'Your reactor loop (TC-101)', r: p.theta / p.tau, sig: C.roundTo(R.uniform(0.01, 0.06), 0.005) }];
    const names = ['Feed flow FC-102', 'Level LC-103', 'Jacket temp. TC-104', 'Pressure PC-105', 'Composition AC-106'];
    names.forEach(n => p.loops.push({ name: n, r: C.roundTo(R.uniform(0.05, 1.2), 0.01), sig: C.roundTo(R.uniform(0, 0.1), 0.005) }));
    return p;
  }
  // normalised loop: τ = 1, K = 1, θ = r; SIMC PI with λ = lr·θ; setpoint step at 0, load step (−0.5) at TDIST
  function simLoop(r, lr, sig, keep) {
    const lam = lr * r, Kc = 1 / (lam + r), Ti = Math.min(1, 4 * (lam + r)), nd = Math.max(1, Math.round(r / DT));
    const buf = new Array(nd).fill(0); let y = 0, I = 0, iae = 0, tv = 0, uPrev = 0, bi = 0;
    const tr = keep ? { t: [], y: [], sp: [], u: [] } : null;
    for (let k = 0, N = Math.round(TEND / DT); k < N; k++) {
      const t = k * DT, sp = 1, ym = y + sig * NOISE[Math.floor(t / 0.1)], e = sp - ym;
      I += Kc / Ti * e * DT; let u = Kc * e + I; u = Math.max(-3, Math.min(5, u));
      tv += Math.abs(u - uPrev); uPrev = u;
      const uDel = buf[bi]; buf[bi] = u; bi = (bi + 1) % nd;
      const d = t >= TDIST ? -0.5 : 0;
      y += DT * (-y + uDel + d); iae += Math.abs(sp - y) * DT;
      if (keep && k % 10 === 0) { tr.t.push(t); tr.y.push(y); tr.sp.push(sp); tr.u.push(u); }
    }
    const cost = Math.min(60, iae + 0.5 * tv);
    return { J: Math.log10(cost), cost, iae, tv, tr };
  }
  const bestLam = (r, sig) => LAMS.reduce((b, l) => { const J = simLoop(r, l, sig).J; return J < b.J ? { l, J } : b; }, { l: 1, J: Infinity });

  const sh1 = {
    id: 'zn', title: 'Ziegler–Nichols reaction-curve tuning', short: 'Classical PID settings',
    lead: 'Your reactor temperature loop TC-101 behaves as a first-order-plus-dead-time (FOPDT) process G(s) = K e<sup>−θs</sup>/(τs + 1) with the parameters in the table (time in minutes). Compute the Ziegler–Nichols open-loop (reaction-curve) PID settings.',
    keys: [{ key: 'KcZN', label: 'Controller gain K<sub>c</sub> = 1.2τ/(Kθ)', unit: '—' }, { key: 'TiZN', label: 'Integral time T<sub>i</sub> = 2θ', unit: 'min' }, { key: 'TdZN', label: 'Derivative time T<sub>d</sub> = 0.5θ', unit: 'min' }],
    answers: p => ({ KcZN: 1.2 * p.tau / (p.K * p.theta), TiZN: 2 * p.theta, TdZN: 0.5 * p.theta }),
    solution: p => `<p>K<sub>c</sub> = 1.2τ/(Kθ) = 1.2·${p.tau}/(${p.K}·${p.theta}) = <b>${C.fmt(1.2 * p.tau / (p.K * p.theta), 5)}</b>; T<sub>i</sub> = 2θ = <b>${2 * p.theta} min</b>; T<sub>d</sub> = 0.5θ = <b>${0.5 * p.theta} min</b>. Z–N settings are aggressive (quarter-decay ratio) and amplify measurement noise.</p>`
  };
  const sh2 = {
    id: 'simc', title: 'SIMC (IMC) PI tuning', short: 'Model-based PI settings',
    lead: 'The SIMC rule gives a PI controller from one tuning knob, the closed-loop time constant λ: K<sub>c</sub> = τ/(K(λ + θ)), T<sub>i</sub> = min(τ, 4(λ + θ)). The usual default is λ = θ.',
    keys: [{ key: 'KcS', label: 'K<sub>c</sub> with λ = θ', unit: '—' }, { key: 'TiS', label: 'T<sub>i</sub> with λ = θ', unit: 'min' }, { key: 'ratio', label: 'Dead-time ratio θ/τ of TC-101', unit: '—' }],
    answers: p => ({ KcS: p.tau / (p.K * 2 * p.theta), TiS: Math.min(p.tau, 8 * p.theta), ratio: p.theta / p.tau }),
    solution: p => `<p>K<sub>c</sub> = τ/(K(λ+θ)) = ${p.tau}/(${p.K}·${2 * p.theta}) = <b>${C.fmt(p.tau / (p.K * 2 * p.theta), 5)}</b>; T<sub>i</sub> = min(${p.tau}, 4·${2 * p.theta}) = <b>${Math.min(p.tau, 8 * p.theta)} min</b>; θ/τ = <b>${C.fmt(p.theta / p.tau, 5)}</b>. In normalised time (t/τ) the closed-loop response depends only on θ/τ and λ/θ — the gain K cancels.</p>`
  };

  const predictors = [{ name: 'theta_over_tau', unit: '—', desc: 'dead-time ratio θ/τ', range: [0.05, 1.2] }, { name: 'lambda_over_theta', unit: '—', desc: 'SIMC tuning ratio λ/θ', range: [0.2, 3] }, { name: 'noise', unit: '—', desc: 'measurement-noise std (fraction of the setpoint step)', range: [0, 0.1] }];
  const axes = { theta_over_tau: C.linspace(0.05, 1.2, 24), lambda_over_theta: C.linspace(0.2, 3, 29), noise: C.linspace(0, 0.1, 11) };
  const sample = R => [R.uniform(0.05, 1.2), R.uniform(0.2, 3), R.uniform(0, 0.1)];
  function dataset(p, id, N) { const R = C.rng('AIENG|pid|data|' + id), rows = []; for (let i = 0; i < N; i++) { const x = sample(R); rows.push([+x[0].toFixed(4), +x[1].toFixed(4), +x[2].toFixed(4), +(simLoop(...x).J + 0.01 * R.normal()).toFixed(4)]); } return rows; }
  function hiddenTest(p, id) { const R = C.rng('AIENG|pid|hidden|' + id), X = [], y = []; for (let i = 0; i < 1500; i++) { const x = sample(R); X.push(x); y.push(simLoop(...x).J); } return { X, y }; }

  function run(p, s, mode) {
    let total = 0; const per = [];
    p.loops.forEach((L, i) => {
      const sig = Math.min(0.1, L.sig * s.noiseScale / 100);
      let lr; if (mode === 'conventional') lr = 1; else if (mode === 'reference') lr = bestLam(L.r, sig).l;
      else lr = LAMS.reduce((b, l) => { const J = mode(L.r, l, sig); return J < b.J ? { l, J } : b; }, { l: 1, J: Infinity }).l;
      const res = simLoop(L.r, lr, sig, i === 0); total += res.cost; per.push({ lr, ...res });
    });
    const m = per[0], bl = bestLam(p.loops[0].r, Math.min(0.1, p.loops[0].sig * s.noiseScale / 100)).l, rb = simLoop(p.loops[0].r, bl, Math.min(0.1, p.loops[0].sig * s.noiseScale / 100), true);
    const tr = { t: m.tr.t.map(x => x * p.tau), y: m.tr.y, sp: m.tr.sp, y_best: rb.tr.y, u: m.tr.u };
    return { trace: tr, cost: total, metrics: { total, iae: m.iae * p.tau, tv: m.tv, lam: m.lr * p.theta }, lams: per.map(x => x.lr) };
  }
  function draw(ctx, W, H, p, tr, i) {
    const ink = '#0d2b55', acc = '#0b6bd3', x0 = 60, y0 = 30, w = 140, h = H - 70, lvl = Math.max(0, Math.min(1.4, tr.y[i])) / 1.4;
    ctx.strokeStyle = ink; ctx.lineWidth = 1.5; ctx.strokeRect(x0, y0, w, h); ctx.fillStyle = 'rgba(11,107,211,.25)'; ctx.fillRect(x0 + 1, y0 + h - lvl * h, w - 2, lvl * h);
    const spY = y0 + h - (1 / 1.4) * h; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(x0 - 10, spY); ctx.lineTo(x0 + w + 10, spY); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = ink; ctx.font = '600 12px IBM Plex Mono, monospace'; ctx.fillText('TC-101 reactor', x0, H - 20); ctx.fillText('setpoint', x0 + w + 14, spY + 4);
    ctx.beginPath(); ctx.arc(x0 + w + 120, y0 + 50, 26, 0, 2 * Math.PI); ctx.stroke(); ctx.fillText('PI', x0 + w + 110, y0 + 55);
    ctx.font = '12px IBM Plex Mono, monospace'; ctx.fillText(`t = ${tr.t[i].toFixed(1)} min   y = ${tr.y[i].toFixed(3)}   u = ${tr.u[i].toFixed(2)}`, x0 + w + 60, y0 + 110);
    if (tr.t[i] >= TDIST * p.tau) { ctx.fillStyle = '#b8322a'; ctx.fillText('load disturbance active', x0 + w + 60, y0 + 132); }
    ctx.strokeStyle = acc; ctx.beginPath(); ctx.moveTo(x0 + w, y0 + 50); ctx.lineTo(x0 + w + 94, y0 + 50); ctx.stroke();
  }
  function sketchSVG(col, acc) {
    return `<g fill="none" stroke="${col}" stroke-width="1.5"><rect x="70" y="80" width="140" height="200" rx="10"/><path d="M70 200 h140" stroke="${acc}"/><circle cx="300" cy="120" r="30"/>
      <path d="M210 120 h60"/><path d="M300 150 v80 h-90" stroke="${acc}"/><path d="M140 280 v40 h120"/><rect x="250" y="305" width="30" height="30"/></g>
      <g font-family="IBM Plex Mono,monospace" font-size="12" fill="${col}"><text x="290" y="125">PI</text><text x="70" y="70">jacketed reactor</text><text x="250" y="355">valve</text></g>`;
  }
  function systemHTML(p) {
    return `<p class="lead">Your plant has six PI loops. The main one, the reactor temperature loop TC-101, is a FOPDT process unique to your ID; the five others are listed by their normalised dead-time ratio and measurement noise.</p>
      <div class="grid2"><div><table class="spec"><tr><th>TC-101 PARAMETER</th><th>VALUE</th></tr><tr><td>Process gain K</td><td class="num">${p.K}</td></tr><tr><td>Time constant τ</td><td class="num">${p.tau} min</td></tr><tr><td>Dead time θ</td><td class="num">${p.theta} min</td></tr></table>
      <table class="spec" style="margin-top:10px"><tr><th>LOOP</th><th>θ/τ</th><th>NOISE</th></tr>${p.loops.map(L => `<tr><td>${L.name}</td><td class="num">${C.fmt(L.r, 3)}</td><td class="num">${L.sig}</td></tr>`).join('')}</table></div>
      <div><svg viewBox="0 0 420 380" style="width:100%">${sketchSVG('#0d2b55', '#1f5fa8')}</svg></div></div>`;
  }

  root.TOOL = {
    id: 'che-pid-tuner', courseLine: 'CHEMICAL ENGINEERING · PROCESS CONTROL', title: 'PI Tuning Challenge', subtitle: 'Learning the closed-loop cost map to tune six plant loops',
    dept: 'FACULTY OF ENGINEERING · DEPARTMENT OF CHEMICAL AND PETROLEUM ENGINEERING', assessment: 'Process Control Technical Assessment',
    cover1: 'covering FOPDT models, Ziegler–Nichols and SIMC tuning rules,', cover2: 'and a machine-learning cost model that chooses the tuning of six plant loops.',
    sketchLabel: 'REACTOR TEMPERATURE LOOP', sketchSVG, params, systemHTML, sheets: [sh1, sh2],
    ml: {
      title: 'Learning the closed-loop cost', task: 'regression', mode: 'grid', predictors, axes, defaultN: 4000, threshold: 0.98,
      response: { name: 'logJ', unit: '—', desc: 'log10 of the closed-loop cost (IAE + 0.5 × control total variation) for a setpoint step and a load step', range: [0, 1.8] },
      explainHTML: () => 'The default SIMC choice λ = θ is a compromise: with little noise a smaller λ is faster, with long dead time or noisy sensors a larger λ is safer. The best λ depends on the loop in a nonlinear way. Train a model of the closed-loop cost from simulated step tests; the plant will use it to choose λ for every loop.',
      dataset, hiddenTest
    },
    challenge: {
      title: 'Tune six plant loops', short: 'Total closed-loop cost', convLabel: 'Default SIMC (λ = θ)', refLabel: 'Best λ for every loop (exhaustive search)', indexLabel: 'Tuning Quality Index', costLabel: 'sum of the six loop costs (IAE + 0.5·TV)', xlabel: 'time [min]',
      settings: [{ key: 'noiseScale', label: 'Sensor noise level', unit: '% of nominal', default: 100, min: 0, max: 200, step: 25 }],
      describe: (p, s) => `Each loop gets a setpoint step and, half-way, a load disturbance. Sensor noise is at ${s.noiseScale} % of nominal. <b>Conventional</b>: λ = θ on every loop. <b>ML</b>: for every loop, λ/θ from 0.2 to 3 that minimises your predicted cost. The score is the sum of the true loop costs; the plots show TC-101.`,
      run, draw, sceneHeight: 240, animSeconds: 7, minIndex: 50,
      metrics: [{ key: 'total', label: 'Total cost (6 loops)', unit: '—', d: 5 }, { key: 'iae', label: 'IAE of TC-101', unit: 'min', d: 4 }, { key: 'tv', label: 'Control TV of TC-101', unit: '—', d: 4 }, { key: 'lam', label: 'λ chosen for TC-101', unit: 'min', d: 4 }],
      plots: [{ title: 'TC-101 output (normalised)', series: [{ key: 'y', label: 'output', color: '#0d2b55' }, { key: 'y_best', label: 'best tuning', color: '#a8843a', dash: [5, 3] }, { key: 'sp', label: 'setpoint', color: '#9aa7b9', dash: [2, 3] }], ylim: [-0.2, 1.6] },
        { title: 'TC-101 controller output', series: [{ key: 'u', label: 'u', color: '#0b6bd3' }] }]
    },
    _internal: { simLoop, bestLam }
  };
})(typeof window !== 'undefined' ? window : globalThis);
