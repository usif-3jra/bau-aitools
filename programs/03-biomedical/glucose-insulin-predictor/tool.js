/* Biomedical — Blood-Glucose Predictor for an Insulin Pump (AI for Engineering, v1.0, Y. Ajra)
   Bergman minimal model of a virtual type-1 diabetic patient. Students solve its steady state and
   linearisation, train a 30-minute glucose predictor, and use it inside the insulin-pump controller. */
(function (root) {
  'use strict';
  const C = root.Common;
  const VI = 12, VG = 100, KABS = 0.02, FABS = 0.8, TARGET = 110, DT = 1, CTRL = 5, HORIZON = 30;

  function params(id) {
    const R = C.rng('AIENG|glu|' + id);
    const p = {
      p1: C.roundTo(R.uniform(0.006, 0.010), 0.0005), p2: C.roundTo(R.uniform(0.02, 0.03), 0.001), p3: C.roundTo(R.uniform(1.0e-5, 1.6e-5), 1e-7),
      n: C.roundTo(R.uniform(0.12, 0.16), 0.005), Gb: C.roundTo(R.uniform(220, 280), 5), Gt: TARGET, mealSeed: Math.floor(R() * 1e9)
    };
    p.Xss = p.p1 * (p.Gb / p.Gt - 1); p.Iss = p.p2 * p.Xss / p.p3; p.uss = p.n * VI * p.Iss;          // mU/min
    return p;
  }
  // state: G [mg/dL], X [1/min], I [µU/mL], Q1, Q2 [g in gut]
  function step(p, s, u, mealG) {
    const Ra = 1000 * KABS * s.Q2 * FABS / VG;
    return { G: s.G + DT * (-(p.p1 + s.X) * s.G + p.p1 * p.Gb + Ra), X: s.X + DT * (-p.p2 * s.X + p.p3 * s.I), I: s.I + DT * (-p.n * s.I + u / VI),
      Q1: s.Q1 + DT * (-KABS * s.Q1) + (mealG || 0), Q2: s.Q2 + DT * KABS * (s.Q1 - s.Q2) };
  }
  const steady = p => ({ G: p.Gt, X: p.Xss, I: p.Iss, Q1: 0, Q2: 0 });
  // label definition: glucose 30 min ahead if only basal insulin is delivered from now on
  function g30(p, s) { let x = { ...s }; for (let k = 0; k < HORIZON; k++) x = step(p, x, p.uss, 0); return x.G; }

  /* ---------- sheets */
  const sh1 = {
    id: 'steady', title: 'Basal insulin from the steady state', short: 'Equilibrium of the minimal model',
    lead: `Find the constant insulin infusion that holds the patient at the target glucose G<sub>t</sub> = ${TARGET} mg/dL with no meal (all derivatives zero).`,
    keys: [{ key: 'Xss', label: 'Remote insulin action X<sub>ss</sub>', unit: '1/min' }, { key: 'Iss', label: 'Plasma insulin I<sub>ss</sub>', unit: 'µU/mL' },
      { key: 'uss', label: 'Basal infusion u<sub>ss</sub>', unit: 'mU/min' }, { key: 'ussh', label: 'Basal infusion u<sub>ss</sub>', unit: 'U/h' }],
    answers: p => ({ Xss: p.Xss, Iss: p.Iss, uss: p.uss, ussh: p.uss * 60 / 1000 }),
    solution: p => { const f = x => C.fmt(x, 5);
      return `<p>dG/dt = 0 ⇒ (p<sub>1</sub>+X)G<sub>t</sub> = p<sub>1</sub>G<sub>b</sub> ⇒ X<sub>ss</sub> = p<sub>1</sub>(G<sub>b</sub>/G<sub>t</sub> − 1) = ${p.p1}(${p.Gb}/${TARGET} − 1) = <b>${f(p.Xss)} min⁻¹</b></p>
        <p>dX/dt = 0 ⇒ I<sub>ss</sub> = p<sub>2</sub>X<sub>ss</sub>/p<sub>3</sub> = ${p.p2}·${f(p.Xss)}/${p.p3} = <b>${f(p.Iss)} µU/mL</b></p>
        <p>dI/dt = 0 ⇒ u<sub>ss</sub> = n·V<sub>I</sub>·I<sub>ss</sub> = ${p.n}·${VI}·${f(p.Iss)} = <b>${f(p.uss)} mU/min</b> = <b>${f(p.uss * 0.06)} U/h</b></p>`; }
  };
  const sh2 = {
    id: 'linear', title: 'Linearised dynamics at the target', short: 'Eigenvalues and time constants',
    lead: 'Linearise the glucose–insulin subsystem (G, X, I) about the steady state of task 1 (no meal). The Jacobian is upper-triangular, so its eigenvalues are its diagonal entries.',
    keys: [{ key: 'lG', label: 'Eigenvalue of the glucose state λ<sub>G</sub>', unit: '1/min' }, { key: 'lX', label: 'Eigenvalue of the insulin-action state λ<sub>X</sub>', unit: '1/min' },
      { key: 'lI', label: 'Eigenvalue of the plasma-insulin state λ<sub>I</sub>', unit: '1/min' }, { key: 'tauG', label: 'Glucose time constant τ<sub>G</sub> = −1/λ<sub>G</sub>', unit: 'min' }],
    answers: p => ({ lG: -(p.p1 + p.Xss), lX: -p.p2, lI: -p.n, tauG: 1 / (p.p1 + p.Xss) }),
    solution: p => `<p>J = [[−(p<sub>1</sub>+X<sub>ss</sub>), −G<sub>t</sub>, 0], [0, −p<sub>2</sub>, p<sub>3</sub>], [0, 0, −n]] ⇒ λ<sub>G</sub> = <b>${C.fmt(-(p.p1 + p.Xss), 5)}</b>, λ<sub>X</sub> = <b>${-p.p2}</b>, λ<sub>I</sub> = <b>${-p.n}</b> min⁻¹; all negative ⇒ the equilibrium is stable. τ<sub>G</sub> = <b>${C.fmt(1 / (p.p1 + p.Xss), 5)} min</b>. Insulin acts slowly (1/p<sub>2</sub> = ${C.fmt(1 / p.p2, 4)} min), which is why prediction helps.</p>`
  };

  /* ---------- simulation of a day */
  function meals(p, seedTag) {
    const R = C.rng('AIENG|glu|meals|' + seedTag);
    return [[7 * 60 + R.uniform(-30, 30), R.uniform(40, 70)], [13 * 60 + R.uniform(-30, 30), R.uniform(60, 90)], [19.5 * 60 + R.uniform(-30, 30), R.uniform(60, 90)], [16 * 60 + R.uniform(-20, 20), R.uniform(10, 25)]].map(([t, g]) => [Math.round(t), g]);
  }
  function simulate(p, mealList, predictor, Kp, noiseTag) {
    const R = C.rng('AIENG|glu|cgm|' + noiseTag), M = new Map(mealList), tr = { t: [], G: [], Gp: [], u: [], meal: [] };
    let s = steady(p), u = p.uss, iob = 0, hist = [], cost = 0, tir = 0, low = 0, high = 0, peak = 0, nadir = 1e9;
    for (let t = 0; t < 1440; t++) {
      const cgm = s.G + 2 * R.normal(); hist.push(cgm);
      if (t % CTRL === 0) {
        const slope = hist.length > 15 ? (cgm - hist[hist.length - 16]) / 15 : 0;
        const Gp = predictor === 'reference' ? g30(p, s) : predictor === 'conventional' ? cgm : predictor(cgm, slope, iob);
        u = Gp < 80 ? 0 : Math.max(0, Math.min(8 * p.uss, p.uss + Kp * (Gp - TARGET)));
        tr.t.push(t / 60); tr.G.push(s.G); tr.Gp.push(Gp); tr.u.push(u * 0.06); tr.meal.push(M.has(t) ? M.get(t) : 0);
      }
      iob = iob * Math.exp(-1 / 90) + (u - p.uss) * DT / 1000;                    // units above basal still acting
      s = step(p, s, u, M.get(t) || 0);
      const g = s.G; cost += Math.max(0, g - 180) + 4 * Math.max(0, 70 - g); if (g >= 70 && g <= 180) tir++; if (g < 70) low++; if (g > 180) high++; peak = Math.max(peak, g); nadir = Math.min(nadir, g);
    }
    return { trace: tr, cost: cost / 60, metrics: { tir: 100 * tir / 1440, low: 100 * low / 1440, high: 100 * high / 1440, peak, nadir }, failed: nadir < 40, failMsg: 'Severe hypoglycaemia (glucose below 40 mg/dL).' };
  }

  /* ---------- dataset (random days, random dosing) */
  const predictors = [{ name: 'G_mgdl', unit: 'mg/dL', desc: 'current CGM glucose', range: [40, 400] }, { name: 'slope_mgdl_min', unit: 'mg/dL/min', desc: 'CGM trend over the last 15 min', range: [-4, 4] }, { name: 'IOB_U', unit: 'U', desc: 'insulin on board above basal (pump history)', range: [-3, 10] }];
  const axes = { G_mgdl: C.linspace(40, 400, 25), slope_mgdl_min: C.linspace(-4, 4, 17), IOB_U: C.linspace(-3, 10, 27) };
  function samples(p, tag, N, noisy) {
    const R = C.rng('AIENG|glu|' + tag), X = [], y = [];
    while (X.length < N) {
      const ml = []; for (let m = 0; m < 4; m++) ml.push([Math.round(R.uniform(0, 1380)), R.uniform(0, 100)]);
      const M = new Map(ml), Kp = R.uniform(0, 0.8), bolusT = new Map(Array.from({ length: 3 }, () => [Math.round(R.uniform(0, 1380)), R.uniform(0, 400)]));
      let s = steady(p); s.G = R.uniform(70, 250); let iob = 0, hist = [], u = p.uss;
      for (let t = 0; t < 1440 && X.length < N; t++) {
        const cgm = s.G + (noisy ? 2 * R.normal() : 0); hist.push(cgm);
        if (t % CTRL === 0) u = Math.max(0, p.uss + Kp * (cgm - TARGET) + (bolusT.get(t) || 0));
        if (t > 30 && t % 9 === 0 && R() < 0.5) {
          const slope = (cgm - hist[hist.length - 16]) / 15, lab = g30(p, s);
          if (cgm >= 40 && cgm <= 400 && lab > 20) { X.push([+cgm.toFixed(2), +slope.toFixed(4), +iob.toFixed(4)]); y.push(+(lab + (noisy ? 2 * R.normal() : 0)).toFixed(2)); }
        }
        iob = iob * Math.exp(-1 / 90) + (u - p.uss) * DT / 1000; s = step(p, s, u, M.get(t) || 0);
      }
    }
    return { X, y };
  }
  const dataset = (p, id, N) => { const d = samples(p, 'data|' + id, N, true); return d.X.map((x, i) => [...x, d.y[i]]); };
  const hiddenTest = (p, id) => samples(p, 'hidden|' + id, 2000, false);

  function systemHTML(p) {
    return `<p class="lead">A virtual type-1 diabetic patient (Bergman minimal model, unique to your ID) wears a continuous glucose monitor (CGM) and an insulin pump. Meals are <b>not announced</b> to the pump.</p>
      <div class="grid2"><table class="spec"><tr><th>MODEL</th><th>PARAMETER</th><th>VALUE</th></tr>
      <tr><td rowspan="2">dG/dt = −(p<sub>1</sub>+X)G + p<sub>1</sub>G<sub>b</sub> + R<sub>a</sub>(t)</td><td>p<sub>1</sub> (glucose effectiveness)</td><td class="num">${p.p1} min⁻¹</td></tr><tr><td>G<sub>b</sub> (glucose with no insulin)</td><td class="num">${p.Gb} mg/dL</td></tr>
      <tr><td rowspan="2">dX/dt = −p<sub>2</sub>X + p<sub>3</sub>I</td><td>p<sub>2</sub></td><td class="num">${p.p2} min⁻¹</td></tr><tr><td>p<sub>3</sub></td><td class="num">${p.p3} min⁻²·(µU/mL)⁻¹</td></tr>
      <tr><td rowspan="2">dI/dt = −nI + u(t)/V<sub>I</sub></td><td>n (insulin clearance)</td><td class="num">${p.n} min⁻¹</td></tr><tr><td>V<sub>I</sub></td><td class="num">${VI} L</td></tr>
      <tr><td>Meal: two-compartment gut</td><td>k<sub>abs</sub>, f, V<sub>G</sub></td><td class="num">${KABS} min⁻¹, ${FABS}, ${VG} dL</td></tr></table>
      <div><svg viewBox="0 0 420 340" style="width:100%">${sketchSVG('#0d2b55', '#1f5fa8')}</svg></div></div>
      <div class="msg info small">Units: G in mg/dL, I in µU/mL (= mU/L), u in mU/min (1 U/h = 16.67 mU/min). Safe range 70–180 mg/dL.</div>`;
  }
  function sketchSVG(col, acc) {
    return `<g fill="none" stroke="${col}" stroke-width="1.5"><path d="M150 40 q60 0 70 70 l8 150 q4 50 -48 50 h-60 q-52 0 -48 -50 l8 -150 q10 -70 70 -70z"/>
      <rect x="250" y="160" width="110" height="70" rx="10"/><rect x="262" y="172" width="60" height="30" rx="3"/><path d="M250 210 q-40 10 -60 -10" stroke="${acc}"/>
      <circle cx="120" cy="150" r="18"/><path d="M120 168 q20 40 60 30" stroke="${acc}"/><path d="M40 280 l30 -60 l30 40 l30 -90 l30 70" stroke="${acc}"/></g>
      <g font-family="IBM Plex Mono,monospace" font-size="12" fill="${col}"><text x="262" y="250">insulin pump</text><text x="70" y="128">CGM</text><text x="30" y="310">glucose trace</text></g>`;
  }
  function draw(ctx, W, H, p, tr, i) {
    const ink = '#0d2b55', g = tr.G[i], col = g < 70 ? '#b8322a' : g > 180 ? '#a86a00' : '#0f7a55';
    ctx.strokeStyle = ink; ctx.lineWidth = 1.5; ctx.strokeRect(30, 30, 220, H - 60); ctx.fillStyle = ink; ctx.font = '600 12px IBM Plex Mono, monospace'; ctx.fillText('CGM', 44, 54);
    ctx.fillStyle = col; ctx.font = '700 46px IBM Plex Mono, monospace'; ctx.fillText(g.toFixed(0), 50, 120); ctx.font = '12px IBM Plex Mono, monospace'; ctx.fillText('mg/dL', 170, 120);
    const sl = i > 2 ? tr.G[i] - tr.G[i - 3] : 0; ctx.fillStyle = ink; ctx.font = '600 22px IBM Plex Mono, monospace'; ctx.fillText(sl > 6 ? '↑' : sl > 2 ? '↗' : sl < -6 ? '↓' : sl < -2 ? '↘' : '→', 200, 80);
    ctx.font = '12px IBM Plex Mono, monospace'; ctx.fillText(`predicted 30 min: ${tr.Gp[i].toFixed(0)}`, 44, 150); ctx.fillText(`time ${String(Math.floor(tr.t[i])).padStart(2, '0')}:${String(Math.round(tr.t[i] % 1 * 60)).padStart(2, '0')}`, 44, 172);
    ctx.strokeRect(290, 30, 200, H - 60); ctx.font = '600 12px IBM Plex Mono, monospace'; ctx.fillText('PUMP', 304, 54); ctx.font = '700 30px IBM Plex Mono, monospace'; ctx.fillText(tr.u[i].toFixed(2), 304, 105); ctx.font = '12px IBM Plex Mono, monospace'; ctx.fillText('U/h', 420, 105);
    const bh = H - 160, h = Math.min(1, tr.u[i] / (8 * p.uss * 0.06)) * bh; ctx.strokeRect(304, 120, 24, bh); ctx.fillStyle = '#0b6bd3'; ctx.fillRect(305, 120 + bh - h, 22, h);
    let ml = 0; for (let k = Math.max(0, i - 12); k <= i; k++) ml += tr.meal[k]; if (ml) { ctx.fillStyle = '#a8843a'; ctx.font = '600 13px IBM Plex Mono, monospace'; ctx.fillText(`meal ${ml.toFixed(0)} g carbs`, 540, 60); }
  }

  root.TOOL = {
    id: 'bme-glucose-predictor', courseLine: 'BIOMEDICAL ENGINEERING · PHYSIOLOGICAL SYSTEMS', title: 'Glucose Predictor Challenge', subtitle: 'Predicting blood glucose 30 minutes ahead for an insulin pump',
    dept: 'FACULTY OF ENGINEERING · DEPARTMENT OF BIOMEDICAL ENGINEERING', assessment: 'Biomedical Engineering Technical Assessment',
    cover1: 'covering the Bergman minimal model, its steady state and linearised dynamics,', cover2: 'and a machine-learning glucose predictor inside an insulin-pump controller.',
    sketchLabel: 'CGM + INSULIN PUMP', sketchSVG, params, systemHTML, sheets: [sh1, sh2],
    ml: {
      title: 'Predicting glucose 30 minutes ahead', task: 'regression', mode: 'grid', predictors, axes, defaultN: 4000, threshold: 0.95,
      response: { name: 'G30_mgdl', unit: 'mg/dL', desc: 'glucose 30 min later if only basal insulin is given', range: [20, 450] },
      explainHTML: () => 'Insulin acts slowly and meals are not announced, so a pump that reacts to the current glucose is always late: high after meals, then too much insulin and a low. Train a model that predicts the glucose 30 minutes ahead from what the pump can measure (CGM value, CGM trend, insulin on board). The pump will dose on your prediction instead of the current value.',
      dataset, hiddenTest
    },
    challenge: {
      title: 'One day with unannounced meals', short: 'Time in range', convLabel: 'Reactive pump (current CGM)', refLabel: 'Ideal predictor (exact 30-min forecast)', indexLabel: 'Glycaemic Control Index', costLabel: 'glucose excursion area (above 180, 4× below 70) [mg/dL·h]', xlabel: 'time [h]',
      settings: [{ key: 'Kp', label: 'Correction gain', unit: 'mU/min per mg/dL', default: 0.4, min: 0.05, max: 0.6, step: 0.05 }, { key: 'mealScale', label: 'Meal size', unit: '% of standard', default: 100, min: 60, max: 150, step: 10 }],
      describe: (p, s) => `24 hours with breakfast, lunch, a snack and dinner (${s.mealScale} % of standard size), not announced to the pump. Every 5 min the pump sets u = u<sub>basal</sub> + K<sub>p</sub>(G<sub>used</sub> − ${TARGET}) with K<sub>p</sub> = ${s.Kp}, and stops if G<sub>used</sub> < 80 mg/dL. <b>Conventional</b>: G<sub>used</sub> = current CGM. <b>ML</b>: G<sub>used</sub> = your 30-minute prediction. Safe range 70–180 mg/dL; lows are penalised 4×.`,
      run: (p, s, mode) => simulate(p, meals(p, p.mealSeed).map(([t, g]) => [t, g * s.mealScale / 100]), mode, s.Kp, 'day'),
      draw, sceneHeight: 240, animSeconds: 8, minIndex: 50,
      metrics: [{ key: 'tir', label: 'Time in range', unit: '%', d: 4 }, { key: 'low', label: 'Time < 70', unit: '%', d: 3 }, { key: 'high', label: 'Time > 180', unit: '%', d: 3 }, { key: 'peak', label: 'Peak', unit: 'mg/dL', d: 4 }, { key: 'nadir', label: 'Lowest', unit: 'mg/dL', d: 4 }],
      plots: [{ title: 'glucose [mg/dL]', series: [{ key: 'G', label: 'glucose', color: '#0d2b55' }, { key: 'Gp', label: 'value used by the pump', color: '#a8843a', dash: [5, 3] }], ylim: [40, 320] },
        { title: 'insulin infusion [U/h]', series: [{ key: 'u', label: 'pump rate', color: '#0b6bd3' }] }]
    },
    _internal: { g30, step, steady, simulate, meals }
  };
})(typeof window !== 'undefined' ? window : globalThis);
