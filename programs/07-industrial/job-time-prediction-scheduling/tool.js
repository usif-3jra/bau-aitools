/* Industrial — Processing-Time Prediction for Job Scheduling (AI for Engineering, v1.0, Y. Ajra)
   A machining cell sequences its jobs by Shortest Processing Time. The routing's standard times ignore learning,
   operator experience, material and machine wear, so the sequence is built on wrong numbers. Students solve
   sequencing and work-measurement problems, then train a processing-time predictor that drives the schedule. */
(function (root) {
  'use strict';
  const C = root.Common;
  const NJOB = 40, NHID = 1500;
  const MAT = ['aluminium', 'steel', 'stainless'];

  function params(id) {
    const R = C.rng('AIENG|ind|' + id), jobs = [];
    for (let i = 0; i < 5; i++) { const pt = 2 + Math.floor(R() * 11); jobs.push({ name: 'J' + (i + 1), p: pt, d: pt + 4 + Math.floor(R() * 26) }); }
    return { jobs, obs: C.roundTo(R.uniform(4, 9), 0.1), rating: C.roundTo(R.uniform(0.9, 1.2), 0.05), allow: R.pick([0.1, 0.12, 0.15, 0.18]), lr: R.pick([0.8, 0.85, 0.9]), nUnit: R.pick([8, 16, 20, 32]),
      shift: C.roundTo(R.uniform(0.85, 1.15), 0.01), seed: Math.floor(R() * 1e9) };
  }
  function seqStats(jobs, order) { let t = 0, F = 0, Lmax = -Infinity, Tt = 0; order.forEach(j => { t += j.p; F += t; Lmax = Math.max(Lmax, t - j.d); Tt += Math.max(0, t - j.d); }); return { Fbar: F / jobs.length, Lmax, Ttot: Tt }; }
  const spt = jobs => [...jobs].sort((a, b) => a.p - b.p || a.d - b.d), edd = jobs => [...jobs].sort((a, b) => a.d - b.d || a.p - b.p);

  // a job: features and its real processing time (h)
  function job(R, shift) {
    const batch = Math.round(Math.exp(R.uniform(Math.log(5), Math.log(200)))), ops = 1 + Math.floor(R() * 10), mat = Math.floor(R() * 3), exp = +R.uniform(0, 15).toFixed(1), age = +R.uniform(0, 20).toFixed(1);
    const unitStd = 0.04 * ops * [0.8, 1.0, 1.3][mat], setupStd = 0.5 + 0.15 * ops, std = setupStd + batch * unitStd;
    const learn = Math.pow(batch, Math.log2(0.8)) * 2.2, oper = 1 + 0.8 * Math.exp(-exp / 2.5), wear = 1 + 0.0008 * age * age * (mat === 2 ? 1.5 : 1), matx = [0.9, 1.0, 1.5][mat];
    const setup = setupStd * oper * (1 + 0.02 * age), run = batch * 0.04 * ops * matx * Math.min(1.25, learn) * oper * wear;
    const actual = shift * (setup + run) * Math.exp(0.08 * R.normal());
    return { x: [batch, ops, mat + 1, exp, age, +std.toFixed(3)], y: +actual.toFixed(3) };
  }
  function draws(tag, n, shift) { const R = C.rng('AIENG|ind|' + tag), X = [], y = []; for (let i = 0; i < n; i++) { const j = job(R, shift); X.push(j.x); y.push(j.y); } return { X, y }; }

  const sh1 = {
    id: 'sequencing', title: 'Single-machine sequencing', short: 'SPT and EDD',
    lead: 'Five jobs wait at the machine (processing time p and due date d, both in hours from now). Shortest Processing Time (SPT) minimises the mean flow time; Earliest Due Date (EDD) minimises the maximum lateness L<sub>max</sub> = max(C<sub>j</sub> − d<sub>j</sub>).',
    keys: [{ key: 'Fspt', label: 'Mean flow time with SPT', unit: 'h' }, { key: 'Tspt', label: 'Total tardiness with SPT', unit: 'h' }, { key: 'Ledd', label: 'Maximum lateness with EDD', unit: 'h' }],
    answers: p => { const a = seqStats(p.jobs, spt(p.jobs)), b = seqStats(p.jobs, edd(p.jobs)); return { Fspt: a.Fbar, Tspt: a.Ttot, Ledd: b.Lmax }; },
    solution: p => { const a = seqStats(p.jobs, spt(p.jobs)), b = seqStats(p.jobs, edd(p.jobs)); return `<p>SPT order: ${spt(p.jobs).map(j => j.name).join(' → ')} → mean flow time <b>${C.fmt(a.Fbar, 5)} h</b>, total tardiness <b>${C.fmt(a.Ttot, 5)} h</b>. EDD order: ${edd(p.jobs).map(j => j.name).join(' → ')} → L<sub>max</sub> = <b>${C.fmt(b.Lmax, 5)} h</b> (negative means every job is early). Both rules need the processing times; if those are wrong, the sequence is wrong.</p>`; }
  };
  const sh2 = {
    id: 'workmeasure', title: 'Work measurement and learning', short: 'Standard time, learning',
    lead: 'A time study of one unit gives an observed time t<sub>obs</sub> (min) at a performance rating R. Normal time NT = t<sub>obs</sub>·R; standard time ST = NT(1 + allowance). With a learning rate r, the time of the n-th unit is T<sub>n</sub> = T<sub>1</sub> n<sup>b</sup>, b = log<sub>2</sub> r, taking T<sub>1</sub> = ST.',
    keys: [{ key: 'NT', label: 'Normal time NT', unit: 'min' }, { key: 'ST', label: 'Standard time ST', unit: 'min' }, { key: 'Tn', label: 'Time of unit n', unit: 'min' }],
    answers: p => { const NT = p.obs * p.rating, ST = NT * (1 + p.allow); return { NT, ST, Tn: ST * Math.pow(p.nUnit, Math.log2(p.lr)) }; },
    solution: p => { const NT = p.obs * p.rating, ST = NT * (1 + p.allow), b = Math.log2(p.lr); return `<p>NT = ${p.obs}·${p.rating} = <b>${C.fmt(NT, 5)} min</b>; ST = NT·(1 + ${p.allow}) = <b>${C.fmt(ST, 5)} min</b>; b = log<sub>2</sub>${p.lr} = ${C.fmt(b, 4)}, T<sub>${p.nUnit}</sub> = ST·${p.nUnit}<sup>b</sup> = <b>${C.fmt(ST * Math.pow(p.nUnit, b), 5)} min</b>. Routing standard times ignore this learning effect, so large batches are planned too long.</p>`; }
  };

  const predictors = [{ name: 'batch_size', unit: 'units', desc: 'number of parts in the job', range: [5, 200] }, { name: 'operations', unit: '—', desc: 'machining operations per part', range: [1, 10] },
    { name: 'material', unit: '—', desc: '1 = aluminium, 2 = steel, 3 = stainless', range: [1, 3] }, { name: 'operator_exp_y', unit: 'years', desc: 'experience of the assigned operator', range: [0, 15] },
    { name: 'machine_age_y', unit: 'years', desc: 'age of the assigned machine', range: [0, 20] }, { name: 'std_time_h', unit: 'h', desc: 'standard time from the routing', range: [0, 100] }];
  const dataset = (p, id, N) => { const d = draws('data|' + id, N, p.shift); return d.X.map((x, i) => [...x, d.y[i]]); };
  const cache = {};
  function predictSet(p, id) {
    if (cache[id]) return cache[id];
    const h = draws('hidden|' + id, NHID, p.shift), c = draws('queue|' + p.seed, NJOB, p.shift), R = C.rng('AIENG|ind|mix|' + id);
    const rows = [...h.X.map((x, i) => ({ x, y: h.y[i], hid: true })), ...c.X.map((x, i) => ({ x, y: c.y[i], hid: false, k: i }))];
    for (let i = rows.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [rows[i], rows[j]] = [rows[j], rows[i]]; }
    const ids = rows.map((_, i) => 'J' + String(i + 1).padStart(4, '0'));
    return (cache[id] = { ids, X: rows.map(r => r.x), y: rows.map(r => r.y), hidden: rows.map(r => r.hid), queue: rows.map((r, i) => r.hid ? null : { k: r.k, i }).filter(Boolean).sort((a, b) => a.k - b.k).map(o => o.i) });
  }

  function run(p, s, mode) {
    const set = predictSet(p, p._id), jobs = set.queue.map(i => {
      const est = mode === 'reference' ? set.y[i] : mode === 'conventional' ? set.X[i][5] : Number(mode(set.ids[i]));
      if (!isFinite(est)) throw new Error('Your prediction file has no time for queued job ' + set.ids[i] + '. Export it from this page\'s spec file.');
      return { id: set.ids[i], est, p: set.y[i], w: 1 };
    });
    // SPT on the estimates; each customer is promised the planned completion time (cumulative estimate)
    const seq = [...jobs].sort((a, b) => a.est - b.est), out = { t: [], C: [], Q: [], p: [], est: [], pen: [] };
    let cum = 0, plan = 0, F = 0, pen = 0, late = 0, dev = 0;
    seq.forEach((j, k) => {
      cum += j.p; plan += j.est; F += cum; const L = cum - plan; dev += Math.abs(L);
      pen += L > 0 ? s.lateWeight * L : -L; if (L > s.grace) late++;
      out.t.push(k + 1); out.C.push(cum); out.Q.push(plan); out.p.push(j.p); out.est.push(j.est); out.pen.push(pen);
    });
    return { trace: out, cost: pen / NJOB, metrics: { penalty: pen / NJOB, late, dev: dev / NJOB, Fbar: F / NJOB, mae: jobs.reduce((a, j) => a + Math.abs(j.est - j.p), 0) / NJOB } };
  }
  function draw(ctx, W, H, p, tr, i) {
    const ink = '#0d2b55', x0 = 30, w = W - 60, span = Math.max(tr.C[tr.C.length - 1], tr.Q[tr.Q.length - 1]), sx = v => x0 + v / span * w, rowH = 26, y0 = 40;
    ctx.fillStyle = ink; ctx.font = '600 13px IBM Plex Mono, monospace'; ctx.fillText(`Machine schedule — job ${tr.t[i]} / ${tr.t.length} finished at ${tr.C[i].toFixed(1)} h, promised ${tr.Q[i].toFixed(1)} h`, x0, 22);
    let s0 = 0; for (let k = 0; k <= i; k++) { const a = sx(s0), b = sx(tr.C[k]); ctx.fillStyle = k % 2 ? '#1f5fa8' : '#a8843a'; ctx.fillRect(a, y0, Math.max(1, b - a - 1), rowH); s0 = tr.C[k]; }
    ctx.strokeStyle = '#c9d3e1'; ctx.strokeRect(x0, y0, w, rowH);
    ctx.fillStyle = ink; ctx.font = '11px IBM Plex Mono, monospace'; for (let v = 0; v <= 4; v++) ctx.fillText((span * v / 4).toFixed(0) + ' h', sx(span * v / 4) - 10, y0 + rowH + 16);
    const by = H - 20, bh = H - 130, mx = Math.max(...tr.p, ...tr.est), bw = w / tr.t.length;
    for (let k = 0; k <= i; k++) { const hp = tr.p[k] / mx * bh, he = tr.est[k] / mx * bh; ctx.fillStyle = '#0d2b55'; ctx.fillRect(x0 + k * bw + 1, by - hp, bw * 0.45, hp); ctx.fillStyle = '#a8843a'; ctx.fillRect(x0 + k * bw + bw * 0.5, by - he, bw * 0.45, he); }
    ctx.fillStyle = ink; ctx.fillText('dark = real time, gold = estimate used for sequencing', x0, by - bh - 8);
  }
  function sketchSVG(col, acc) {
    return `<g fill="none" stroke="${col}" stroke-width="1.5"><rect x="40" y="200" width="40" height="30"/><rect x="85" y="200" width="25" height="30"/><rect x="115" y="200" width="55" height="30"/><path d="M30 240 h160"/>
      <path d="M175 215 h40" marker-end="url(#a)"/><rect x="225" y="150" width="120" height="100" rx="6"/><rect x="245" y="170" width="50" height="40" stroke="${acc}"/><path d="M315 175 v40"/><circle cx="315" cy="225" r="6"/>
      <path d="M40 100 h300 M40 100 v-40 M80 100 v-25 M150 100 v-50 M230 100 v-15 M290 100 v-35" stroke="${acc}"/></g>
      <g font-family="IBM Plex Mono,monospace" font-size="12" fill="${col}"><text x="50" y="260">job queue</text><text x="245" y="270">CNC cell</text><text x="40" y="45">processing times</text></g>`;
  }
  function systemHTML(p) {
    return `<p class="lead">A CNC machining cell receives a queue of jobs every morning and runs them in Shortest-Processing-Time order. The only time estimate available today is the routing's standard time, which ignores the learning effect of large batches, the operator's experience, the material and the wear of the machine.</p>
      <div class="grid2"><div><h3>Sheet data</h3><table class="spec"><tr><th>JOB</th><th>p [h]</th><th>d [h]</th></tr>${p.jobs.map(j => `<tr><td>${j.name}</td><td class="num">${j.p}</td><td class="num">${j.d}</td></tr>`).join('')}</table>
      <table class="spec"><tr><th>TIME STUDY</th><th>VALUE</th></tr><tr><td>Observed time t<sub>obs</sub></td><td class="num">${p.obs} min</td></tr><tr><td>Rating R</td><td class="num">${p.rating}</td></tr><tr><td>Allowance</td><td class="num">${100 * p.allow} %</td></tr><tr><td>Learning rate r / unit n</td><td class="num">${100 * p.lr} % / ${p.nUnit}</td></tr></table></div>
      <div><svg viewBox="0 0 400 300" style="width:100%">${sketchSVG('#0d2b55', '#1f5fa8')}</svg></div></div>`;
  }
  root.TOOL = {
    id: 'ind-job-scheduling', courseLine: 'PRODUCTION PLANNING AND CONTROL', title: 'Job Scheduling Challenge', subtitle: 'Predicting processing times to schedule a cell and promise completion dates',
    dept: 'FACULTY OF ENGINEERING · DEPARTMENT OF INDUSTRIAL ENGINEERING', assessment: 'Production Planning Technical Assessment',
    cover1: 'covering SPT and EDD sequencing, standard time and learning curves,', cover2: 'and a machine-learning processing-time predictor that drives the schedule.',
    sketchLabel: 'MACHINING CELL', sketchSVG, systemHTML, params, sheets: [sh1, sh2],
    ml: {
      title: 'Predicting the real processing time', task: 'regression', mode: 'predict', predictors, defaultN: 4000, threshold: 0.95,
      response: { name: 'actual_time_h', unit: 'h', desc: 'measured processing time of the job (setup + run)', range: [0, 150] },
      explainHTML: () => 'Train a model that predicts the real processing time of a job from its features and its standard time, using the job history of your cell. Then predict every unlabelled job in the spec file (hidden test jobs and tomorrow\'s queue). The cell will sequence the queue and promise completion times to its customers from your predictions.',
      dataset, predictSet
    },
    challenge: {
      title: 'Tomorrow\'s queue: 40 jobs', short: 'Promise accuracy', convLabel: 'SPT on standard times', refLabel: 'SPT on real times', indexLabel: 'Scheduling Index', costLabel: 'promise penalty [h per job]', xlabel: 'position in sequence',
      settings: [{ key: 'lateWeight', label: 'Weight of a late hour vs an early hour', unit: '—', default: 3, min: 1, max: 10, step: 0.5 }, { key: 'grace', label: 'Grace before a job counts as late', unit: 'h', default: 2, min: 0, max: 10, step: 0.5 }],
      describe: (p, s) => `The 40 queued jobs are sequenced by Shortest Processing Time on an estimate of each job's time, and each customer is promised the planned completion time (sum of the estimates up to that job). The jobs then run with their real times. Every hour a job finishes after its promise costs ${s.lateWeight}, every hour before it costs 1. <b>Conventional</b>: the routing standard time. <b>ML</b>: your predicted time. Scored by the promise penalty per job.`,
      run, draw, sceneHeight: 260, animSeconds: 8, minIndex: 60,
      metrics: [{ key: 'penalty', label: 'Promise penalty', unit: 'h/job', d: 4 }, { key: 'late', label: 'Jobs late beyond grace', unit: '', d: 3 }, { key: 'dev', label: 'Mean |finish − promise|', unit: 'h', d: 4 }, { key: 'Fbar', label: 'Mean flow time', unit: 'h', d: 5 }, { key: 'mae', label: 'Mean |estimate − real|', unit: 'h', d: 4 }],
      plots: [{ title: 'completion time [h]', series: [{ key: 'C', label: 'real finish', color: '#0d2b55' }, { key: 'Q', label: 'promised', color: '#a8843a', dash: [5, 3] }] }, { title: 'cumulative promise penalty [h]', series: [{ key: 'pen', label: 'penalty', color: '#b8322a' }] }]
    },
    _internal: { seqStats, spt, edd }
  };
})(typeof window !== 'undefined' ? window : globalThis);
