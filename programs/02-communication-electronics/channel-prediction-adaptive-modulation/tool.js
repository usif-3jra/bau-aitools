/* Communication — Fading-Channel Prediction for Adaptive Modulation (AI for Engineering, v1.0, Y. Ajra)
   Rayleigh fading with Doppler; the transmitter learns the channel 5 ms late. Students compute modulation
   thresholds and channel time scales, then train an SNR predictor that drives the adaptive modulation. */
(function (root) {
  'use strict';
  const C = root.Common;
  const TS = 1e-3, DELAY = 5, NPATH = 16, MODS = [{ name: 'BPSK', M: 2, b: 1 }, { name: 'QPSK', M: 4, b: 2 }, { name: '16-QAM', M: 16, b: 4 }, { name: '64-QAM', M: 64, b: 6 }];
  const Q = x => 0.5 * erfc(x / Math.SQRT2);
  function erfc(x) { const z = Math.abs(x), t = 1 / (1 + 0.5 * z), r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return x >= 0 ? r : 2 - r; }
  // BER vs symbol SNR γ (linear): BPSK exact, Gray square M-QAM approximation (QPSK identical to BPSK per bit at Eb/N0)
  const ber = (M, g) => M === 2 ? Q(Math.sqrt(2 * g)) : (4 / Math.log2(M)) * (1 - 1 / Math.sqrt(M)) * Q(Math.sqrt(3 * g / (M - 1)));
  const db = x => 10 * Math.log10(x), lin = d => Math.pow(10, d / 10);
  function threshold(M, target) { let lo = -10, hi = 40; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (ber(M, lin(m)) > target) lo = m; else hi = m; } return (lo + hi) / 2; }
  function besselJ0(x) { let s = 0; for (let k = 0; k < 200; k++) { const t = Math.PI * (k + 0.5) / 200; s += Math.cos(x * Math.sin(t)); } return s / 200; }

  function params(id) {
    const R = C.rng('AIENG|com|' + id);
    const p = { v: C.roundTo(R.uniform(8, 16), 1), fc: R.pick([2.1, 2.6]), snr: C.roundTo(R.uniform(14, 20), 1), target: R.pick([1e-3, 1e-4]), seed: Math.floor(R() * 1e9) };
    p.fd = p.v / 3.6 * p.fc * 1e9 / 3e8; return p;
  }
  // sum-of-sinusoids Rayleigh fading (Jakes-type), SNR in dB per slot
  function fading(p, tag, n) {
    const R = C.rng('AIENG|com|fade|' + tag), a = [], ph1 = [], ph2 = [];
    for (let k = 0; k < NPATH; k++) { a.push(Math.cos(2 * Math.PI * (k + R()) / NPATH)); ph1.push(2 * Math.PI * R()); ph2.push(2 * Math.PI * R()); }
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = i * TS; let re = 0, im = 0;
      for (let k = 0; k < NPATH; k++) { const w = 2 * Math.PI * p.fd * a[k] * t; re += Math.cos(w + ph1[k]); im += Math.sin(w + ph2[k]); }
      out.push(p.snr + db(Math.max(1e-6, (re * re + im * im) / NPATH)));
    }
    return out;
  }
  const clampF = x => [Math.max(-5, Math.min(35, x[0])), Math.max(-8, Math.min(8, x[1])), Math.max(-8, Math.min(8, x[2]))];
  function features(meas, i) { return clampF([meas[i], meas[i] - meas[i - 2], meas[i - 2] - meas[i - 4]]); }

  const sh1 = {
    id: 'thresholds', title: 'Modulation switching thresholds', short: 'BER and required SNR',
    lead: 'The link adapts its modulation every 1 ms slot. Find the symbol SNR (E<sub>s</sub>/N<sub>0</sub>, dB) at which each scheme just meets your target bit-error rate. Use BER<sub>BPSK</sub> = Q(√(2γ)) and, for square M-QAM (QPSK = 4-QAM), BER ≈ (4/log<sub>2</sub>M)(1 − 1/√M) Q(√(3γ/(M − 1))).',
    keys: [{ key: 'tB', label: 'BPSK threshold', unit: 'dB' }, { key: 'tQ', label: 'QPSK threshold', unit: 'dB' }, { key: 't16', label: '16-QAM threshold', unit: 'dB' }, { key: 't64', label: '64-QAM threshold', unit: 'dB' }],
    answers: p => ({ tB: threshold(2, p.target), tQ: threshold(4, p.target), t16: threshold(16, p.target), t64: threshold(64, p.target) }),
    solution: p => `<p>Solve BER(γ) = ${p.target} for each scheme (Q⁻¹ tables or numerically). Results: BPSK <b>${C.fmt(threshold(2, p.target), 4)} dB</b>, QPSK <b>${C.fmt(threshold(4, p.target), 4)} dB</b> (3 dB above BPSK), 16-QAM <b>${C.fmt(threshold(16, p.target), 4)} dB</b>, 64-QAM <b>${C.fmt(threshold(64, p.target), 4)} dB</b>. The transmitter picks the fastest scheme whose threshold is below the SNR it expects.</p>`
  };
  const sh2 = {
    id: 'doppler', title: 'Doppler and channel ageing', short: 'Doppler, coherence time',
    lead: `A mobile user moves at v (km/h) with carrier f<sub>c</sub>. The SNR measured at the receiver reaches the transmitter ${DELAY} ms later. Use f<sub>d</sub> = v f<sub>c</sub>/c, T<sub>c</sub> ≈ 0.423/f<sub>d</sub>, and the channel correlation ρ = J<sub>0</sub>(2π f<sub>d</sub> τ) for a delay τ.`,
    keys: [{ key: 'fd', label: 'Maximum Doppler shift f<sub>d</sub>', unit: 'Hz' }, { key: 'Tc', label: 'Coherence time T<sub>c</sub>', unit: 'ms' }, { key: 'rho', label: `Correlation after the ${DELAY} ms feedback delay ρ`, unit: '—' }],
    answers: p => ({ fd: p.fd, Tc: 423 / p.fd, rho: besselJ0(2 * Math.PI * p.fd * DELAY * TS) }),
    solution: p => `<p>f<sub>d</sub> = (${p.v}/3.6)·${p.fc}×10⁹/3×10⁸ = <b>${C.fmt(p.fd, 5)} Hz</b>; T<sub>c</sub> = 0.423/f<sub>d</sub> = <b>${C.fmt(423 / p.fd, 5)} ms</b>; ρ = J<sub>0</sub>(2π·${C.fmt(p.fd, 4)}·0.005) = <b>${C.fmt(besselJ0(2 * Math.PI * p.fd * DELAY * TS), 4)}</b>. With ρ well below 1 the last measured SNR is already out of date when it is used.</p>`
  };

  const predictors = [{ name: 'snr_now_dB', unit: 'dB', desc: 'latest SNR report (with 0.5 dB measurement noise)', range: [-5, 35] }, { name: 'd1_dB', unit: 'dB', desc: 'change over the last 2 ms (report now − report 2 ms ago)', range: [-8, 8] }, { name: 'd2_dB', unit: 'dB', desc: 'change over the 2 ms before that', range: [-8, 8] }];
  const axes = { snr_now_dB: C.linspace(-5, 35, 21), d1_dB: C.linspace(-8, 8, 17), d2_dB: C.linspace(-8, 8, 17) };
  function samples(p, tag, N, noisy) {
    const X = [], y = []; let r = 0;
    while (X.length < N) {
      const tr = fading(p, tag + '|' + r++, 2000), R = C.rng('AIENG|com|meas|' + tag + r), meas = tr.map(v => v + (noisy ? 0.5 * R.normal() : 0.0));
      for (let i = 4; i + DELAY < tr.length && X.length < N; i += 7) { X.push(features(meas, i).map(v => +v.toFixed(3))); y.push(+tr[i + DELAY].toFixed(3)); }
    }
    return { X, y };
  }
  const dataset = (p, id, N) => { const d = samples(p, 'data|' + id, N, true); return d.X.map((x, i) => [...x, d.y[i]]); };
  const hiddenTest = (p, id) => samples(p, 'hidden|' + id, 2000, true);

  function run(p, s, mode) {
    const n = 3000, tr = fading(p, 'challenge|' + p.seed, n), R = C.rng('AIENG|com|chmeas|' + p.seed), meas = tr.map(v => v + 0.5 * R.normal());
    const th = MODS.map(m => threshold(m.M, p.target) + s.margin), out = { t: [], snr: [], pred: [], bits: [] };
    let bits = 0, fails = 0, idle = 0;
    for (let i = 4; i + DELAY < n; i++) {
      const pred = mode === 'reference' ? tr[i + DELAY] : mode === 'conventional' ? meas[i] : mode(...features(meas, i));
      let k = -1; for (let m = 0; m < MODS.length; m++) if (pred >= th[m]) k = m;
      const actual = tr[i + DELAY]; let got = 0;
      if (k < 0) idle++; else if (actual >= threshold(MODS[k].M, p.target)) got = MODS[k].b; else fails++;
      bits += got;
      if (i % 4 === 0) { out.t.push(i * TS * 1000); out.snr.push(actual); out.pred.push(pred); out.bits.push(k < 0 ? 0 : MODS[k].b); }
    }
    const slots = n - 4 - DELAY;
    return { trace: out, cost: -bits / slots, metrics: { goodput: bits / slots, rate: bits / slots / TS / 1e3, fails: 100 * fails / slots, idle: 100 * idle / slots } };
  }
  function draw(ctx, W, H, p, tr, i) {
    const ink = '#0d2b55', x0 = 40, bh = H - 70, sc = v => Math.max(0, Math.min(1, (v + 10) / 45)) * bh;
    ctx.strokeStyle = ink; ctx.lineWidth = 1.5; ctx.strokeRect(x0, 30, 40, bh); ctx.strokeRect(x0 + 80, 30, 40, bh);
    ctx.fillStyle = '#0b6bd3'; ctx.fillRect(x0 + 1, 30 + bh - sc(tr.snr[i]), 38, sc(tr.snr[i])); ctx.fillStyle = '#a8843a'; ctx.fillRect(x0 + 81, 30 + bh - sc(tr.pred[i]), 38, sc(tr.pred[i]));
    ctx.fillStyle = ink; ctx.font = '11px IBM Plex Mono, monospace'; ctx.fillText('actual', x0, H - 22); ctx.fillText('used', x0 + 84, H - 22); ctx.fillText(tr.snr[i].toFixed(1) + ' dB', x0, H - 8); ctx.fillText(tr.pred[i].toFixed(1) + ' dB', x0 + 80, H - 8);
    const b = tr.bits[i], name = { 0: 'no transmission', 1: 'BPSK', 2: 'QPSK', 4: '16-QAM', 6: '64-QAM' }[b], ok = b === 0 || tr.snr[i] >= threshold({ 1: 2, 2: 4, 4: 16, 6: 64 }[b], p.target);
    ctx.font = '600 18px IBM Plex Mono, monospace'; ctx.fillText(name, x0 + 170, 70); ctx.font = '13px IBM Plex Mono, monospace'; ctx.fillStyle = ok ? '#0f7a55' : '#b8322a'; ctx.fillText(b === 0 ? 'idle' : ok ? 'slot received ✔' : 'slot lost ✘', x0 + 170, 96);
    const M = { 0: 0, 1: 2, 2: 4, 4: 16, 6: 64 }[b], cx = x0 + 420, cy = H / 2 + 10, rr = 70; ctx.strokeStyle = '#c9d3e1'; ctx.strokeRect(cx - rr, cy - rr, 2 * rr, 2 * rr); ctx.fillStyle = ink;
    if (M) { const m = M === 2 ? 2 : Math.sqrt(M); for (let a = 0; a < m; a++) for (let c = 0; c < (M === 2 ? 1 : m); c++) { const xx = cx - rr + (a + 0.5) * 2 * rr / m, yy = M === 2 ? cy : cy - rr + (c + 0.5) * 2 * rr / m; ctx.beginPath(); ctx.arc(xx, yy, 3, 0, 7); ctx.fill(); } }
    ctx.fillStyle = ink; ctx.font = '12px IBM Plex Mono, monospace'; ctx.fillText(`t = ${tr.t[i].toFixed(0)} ms`, x0 + 170, 130);
  }
  function sketchSVG(col, acc) {
    return `<g fill="none" stroke="${col}" stroke-width="1.5"><path d="M60 300 l30 -200 l30 200 M70 230 h40 M80 165 h20"/><path d="M90 100 q30 -30 60 0 M90 100 q50 -60 100 0" stroke="${acc}"/>
      <rect x="270" y="230" width="70" height="40" rx="8"/><circle cx="290" cy="280" r="10"/><circle cx="325" cy="280" r="10"/><path d="M150 140 q80 40 140 90" stroke-dasharray="6 5" stroke="${acc}"/><path d="M150 200 q60 60 120 50" stroke-dasharray="6 5" stroke="${acc}"/></g>
      <g font-family="IBM Plex Mono,monospace" font-size="12" fill="${col}"><text x="40" y="330">base station</text><text x="250" y="320">moving user</text></g>`;
  }
  function systemHTML(p) {
    return `<p class="lead">A base station sends to a moving user over a Rayleigh-fading channel. Each 1 ms slot it picks BPSK, QPSK, 16-QAM or 64-QAM (or stays idle) from the SNR it expects; the receiver's SNR reports arrive ${DELAY} ms late.</p>
      <div class="grid2"><table class="spec"><tr><th>QUANTITY</th><th>VALUE</th></tr><tr><td>User speed v</td><td class="num">${p.v} km/h</td></tr><tr><td>Carrier frequency f<sub>c</sub></td><td class="num">${p.fc} GHz</td></tr>
      <tr><td>Average SNR</td><td class="num">${p.snr} dB</td></tr><tr><td>Target BER</td><td class="num">${p.target}</td></tr><tr><td>Slot / feedback delay</td><td class="num">1 ms / ${DELAY} ms</td></tr></table>
      <div><svg viewBox="0 0 420 360" style="width:100%">${sketchSVG('#0d2b55', '#1f5fa8')}</svg></div></div>`;
  }
  root.TOOL = {
    id: 'com-channel-prediction', courseLine: 'COMMUNICATION SYSTEMS', title: 'Channel Prediction Challenge', subtitle: 'Predicting a fading channel to drive adaptive modulation',
    dept: 'FACULTY OF ENGINEERING · DEPARTMENT OF ELECTRICAL AND COMPUTER ENGINEERING', assessment: 'Communication Systems Technical Assessment',
    cover1: 'covering BER of M-QAM, modulation thresholds, Doppler and channel ageing,', cover2: 'and a machine-learning SNR predictor that drives adaptive modulation.',
    sketchLabel: 'MOBILE RADIO LINK', sketchSVG, params, systemHTML, sheets: [sh1, sh2],
    ml: {
      title: 'Predicting the SNR 5 ms ahead', task: 'regression', mode: 'grid', predictors, axes, defaultN: 4000, threshold: 0.55,
      response: { name: 'snr_future_dB', unit: 'dB', desc: `true SNR ${DELAY} ms (slots) later`, range: [-25, 30] },
      explainHTML: () => `The transmitter only knows the SNR from ${DELAY} ms ago. Using it as if it were current sends 64-QAM into fades and loses slots. Train a model that predicts the SNR ${DELAY} slots ahead from the latest report and its recent changes; the transmitter will choose the modulation from your prediction.`,
      dataset, hiddenTest
    },
    challenge: {
      title: '3 seconds of a moving user', short: 'Goodput', convLabel: 'Last report used as current', refLabel: 'Perfect channel knowledge', indexLabel: 'Throughput Index', costLabel: '− goodput [bits per slot]', xlabel: 'time [ms]',
      settings: [{ key: 'margin', label: 'Safety margin added to thresholds', unit: 'dB', default: 0, min: 0, max: 4, step: 0.5 }],
      describe: (p, s) => `3000 slots of fading at ${p.v} km/h. Each slot the scheme with the highest rate whose threshold (+${s.margin} dB margin) is below the expected SNR is used; a slot whose real SNR is below that scheme's threshold is lost. <b>Conventional</b>: expected SNR = latest report. <b>ML</b>: your ${DELAY}-ms-ahead prediction. Scored by the goodput (bits delivered per slot).`,
      run, draw, sceneHeight: 240, animSeconds: 8, minIndex: 32,
      metrics: [{ key: 'goodput', label: 'Goodput', unit: 'bit/slot', d: 4 }, { key: 'fails', label: 'Lost slots', unit: '%', d: 3 }, { key: 'idle', label: 'Idle slots', unit: '%', d: 3 }],
      plots: [{ title: 'SNR [dB]', series: [{ key: 'snr', label: 'actual SNR', color: '#0d2b55' }, { key: 'pred', label: 'SNR used', color: '#a8843a', dash: [5, 3] }], ylim: [-15, 30] },
        { title: 'bits per symbol sent', series: [{ key: 'bits', label: 'modulation', color: '#0b6bd3' }], ylim: [0, 7] }]
    },
    _internal: { threshold, fading, besselJ0 }
  };
})(typeof window !== 'undefined' ? window : globalThis);
