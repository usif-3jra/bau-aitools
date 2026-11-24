/* AI for Engineering — shared computational helpers (no DOM). Used by every challenge tool + Node tests. */
(function (root) {
  'use strict';
  function hashStr(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
  function rng(seed) {
    let a = hashStr(String(seed));
    const next = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let i = 0; i < 8; i++) next();
    next.normal = () => { let u = 0; while (u === 0) u = next(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next()); };
    next.uniform = (lo, hi) => lo + (hi - lo) * next();
    next.pick = arr => arr[Math.floor(next() * arr.length)];
    return next;
  }
  const roundTo = (x, step) => Math.round(Math.round(x / step) * step * 1e9) / 1e9;
  const sig = (x, n) => { if (!x || !isFinite(x)) return x; const d = Math.ceil(Math.log10(Math.abs(x))); const p = Math.pow(10, n - d); return Math.round(x * p) / p; };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  function fmt(x, n = 4) {
    x = Number(x); if (!isFinite(x)) return String(x); if (x === 0) return '0';
    const a = Math.abs(x); if (a >= 1e5 || a < 1e-3) return x.toExponential(n - 1);
    return String(Number(x.toPrecision(n + 1)));
  }
  function validateName(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length !== 3) return { ok: false, msg: 'Full name must contain exactly three words (first, father, family).' };
    if (!parts.every(p => /^[A-Za-zÀ-ɏ؀-ۿ'\-]{2,}$/.test(p))) return { ok: false, msg: 'Each name word must have at least 2 letters.' };
    return { ok: true, value: parts.map(p => p[0].toUpperCase() + p.slice(1)).join(' ') };
  }
  function validateId(id) {
    const v = String(id || '').trim();
    return /^20\d{7}$/.test(v) ? { ok: true, value: v } : { ok: false, msg: 'Student ID must be 9 digits and start with 20 (e.g. 202312345).' };
  }
  const parseNum = s => { s = String(s ?? '').trim().replace(/[−–]/g, '-').replace(/,/g, '.'); return s === '' ? NaN : Number(s); };
  const near = (x, ref, tolPct) => Math.abs(x - ref) <= (tolPct / 100) * Math.abs(ref) + 1e-9;
  const linspace = (a, b, n) => Array.from({ length: n }, (_, i) => Math.round((a + (b - a) * i / (n - 1)) * 1e6) / 1e6);

  /* ---------- ML models from MATLAB export (format AIENG-MODEL-v1) ---------- */
  // grid: multilinear interpolation over 1-4 axes (first axis varies fastest, MATLAB ndgrid order)
  function makeGridModel(json, predictors) {
    const ax = predictors.map(p => json.axes[p]);
    if (ax.some(a => !Array.isArray(a) || a.length < 2)) throw new Error('model axes do not match this tool');
    const n = ax.map(a => a.length), total = n.reduce((a, b) => a * b, 1), vals = json.values.map(Number);
    if (vals.length !== total) throw new Error(`values has ${vals.length} entries, expected ${total}`);
    if (vals.some(v => !isFinite(v))) throw new Error('values contains NaN/Inf');
    const loc = (a, x) => { const m = a.length - 1; if (x <= a[0]) return [0, 0]; if (x >= a[m]) return [m - 1, 1]; let lo = 0, hi = m; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (a[mid] <= x) lo = mid; else hi = mid; } return [lo, (x - a[lo]) / (a[lo + 1] - a[lo])]; };
    const f = (...x) => {
      const L = x.map((v, d) => loc(ax[d], v)); let s = 0; const D = ax.length;
      for (let c = 0; c < (1 << D); c++) {
        let w = 1, idx = 0, stride = 1;
        for (let d = 0; d < D; d++) { const b = (c >> d) & 1; w *= b ? L[d][1] : 1 - L[d][1]; idx += (L[d][0] + b) * stride; stride *= n[d]; }
        if (w) s += w * vals[idx];
      }
      return s;
    };
    f.meta = json; f.kind = 'grid'; return f;
  }
  // predictions: one value per row id of the spec file (regression numbers or class names)
  function makePredModel(json) {
    if (!Array.isArray(json.ids) || !Array.isArray(json.values) || json.ids.length !== json.values.length) throw new Error('ids/values missing or of different length');
    const map = new Map(json.ids.map((id, i) => [String(id), json.values[i]]));
    const f = id => map.get(String(id)); f.meta = json; f.kind = 'predict'; f.size = map.size; return f;
  }
  function r2rmse(y, yh) {
    const n = y.length, my = y.reduce((a, b) => a + b, 0) / n;
    let se = 0, st = 0; for (let i = 0; i < n; i++) { se += (y[i] - yh[i]) ** 2; st += (y[i] - my) ** 2; }
    return { r2: 1 - se / st, rmse: Math.sqrt(se / n) };
  }
  function accuracy(y, yh) { let c = 0; for (let i = 0; i < y.length; i++) if (String(y[i]) === String(yh[i])) c++; return c / y.length; }
  function toCSV(header, rows) { return header.join(',') + '\n' + rows.map(r => r.join(',')).join('\n') + '\n'; }

  /* ---------- config & marks ---------- */
  function questionList(TOOL) { return TOOL.sheets.flatMap(s => s.keys.map(k => ({ key: k.key, label: k.label, sheet: s.id }))); }
  function markItems(TOOL) {
    return [...questionList(TOOL), { key: 'ml', label: 'ML model validation (hidden test set)' }, { key: 'sim', label: 'Engineering challenge with the ML model' }];
  }
  function defaultConfig(TOOL) {
    const items = markItems(TOOL), qs = items.filter(i => i.key !== 'ml' && i.key !== 'sim');
    const w = {}, base = Math.floor(50 / qs.length * 2) / 2; qs.forEach((q, i) => { w[q.key] = i === qs.length - 1 ? 50 - base * (qs.length - 1) : base; }); w.ml = 20; w.sim = 30;
    return {
      weights: Object.assign(w, TOOL.weights || {}), attempts: 3, tolPct: 2, datasetN: TOOL.ml.defaultN || 4000,
      mlThreshold: TOOL.ml.threshold, minIndex: TOOL.challenge.minIndex ?? 60,
      challenge: Object.fromEntries((TOOL.challenge.settings || []).map(s => [s.key, s.default])),
      sessionOpen: true, certRequiresPass: true
    };
  }
  function mergeConfig(TOOL, c) {
    const d = defaultConfig(TOOL); if (!c) return d;
    for (const k of Object.keys(d)) if (c[k] !== undefined) d[k] = (d[k] && typeof d[k] === 'object') ? Object.assign(d[k], c[k]) : c[k];
    return d;
  }
  function computeMarks(TOOL, results, overrides, cfg) {
    const rows = markItems(TOOL).map(q => {
      const r = (results || {})[q.key] || {}, w = Number(cfg.weights[q.key]) || 0;
      const ov = overrides && overrides[q.key] !== undefined && overrides[q.key] !== null && overrides[q.key] !== '' ? Number(overrides[q.key]) : null;
      const auto = r.correct ? w : 0;
      return { ...q, weight: w, auto, override: ov, earned: ov !== null ? Math.min(ov, w) : auto, done: !!r.done, correct: !!r.correct };
    });
    const total = rows.reduce((s, r) => s + r.weight, 0), earned = rows.reduce((s, r) => s + r.earned, 0);
    return { rows, total, earned, pct: total ? 100 * earned / total : 0 };
  }
  const certCode = (tool, id, name, pct, date) => ('BAU-' + tool.toUpperCase().slice(0, 6) + '-' + hashStr(tool + id + name + pct.toFixed(1) + date).toString(36).toUpperCase()).slice(0, 22);
  // improvement captured relative to the ideal: 100 = as good as the reference, 0 = no better than conventional
  const captureIndex = (cConv, cModel, cRef) => (cConv - cRef) <= 1e-12 ? 100 : clamp(100 * (cConv - cModel) / (cConv - cRef), 0, 100);
  function packTrace(trace, n = 300) {
    const len = trace.t.length, step = Math.max(1, Math.floor(len / n)), out = {};
    for (const k of Object.keys(trace)) if (Array.isArray(trace[k])) out[k] = trace[k].filter((_, i) => i % step === 0).map(v => (typeof v === 'number' ? Math.round(v * 1e4) / 1e4 : v));
    return out;
  }

  const Common = { hashStr, rng, roundTo, sig, clamp, fmt, validateName, validateId, parseNum, near, linspace,
    makeGridModel, makePredModel, r2rmse, accuracy, toCSV, questionList, markItems, defaultConfig, mergeConfig, computeMarks, certCode, captureIndex, packTrace, VERSION: 'v1.0' };
  root.Common = Common;
  if (typeof module !== 'undefined' && module.exports) module.exports = Common;
})(typeof window !== 'undefined' ? window : globalThis);
