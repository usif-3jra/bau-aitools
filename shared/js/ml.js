/* AI for Engineering — small in-browser machine-learning library (v1.0, Y. Ajra)
   Regression models that train in the student's browser (no MATLAB, works offline):
   linear, polynomial (degree 2), k-nearest neighbours, decision tree, random forest.
   Every model standardises its inputs, is deterministic for a given seed and returns predict(x). */
(function (root) {
  'use strict';
  const C = root.Common;

  /* ---------- helpers ---------- */
  function scaler(X) {
    const d = X[0].length, mu = new Array(d).fill(0), sd = new Array(d).fill(0);
    X.forEach(r => r.forEach((v, j) => { mu[j] += v; })); mu.forEach((_, j) => { mu[j] /= X.length; });
    X.forEach(r => r.forEach((v, j) => { sd[j] += (v - mu[j]) ** 2; })); sd.forEach((_, j) => { sd[j] = Math.sqrt(sd[j] / X.length) || 1; });
    return x => x.map((v, j) => (v - mu[j]) / sd[j]);
  }
  // solve (A + λI) w = b, Gaussian elimination with partial pivoting
  function solve(A, b) {
    const n = b.length, M = A.map((r, i) => [...r, b[i]]);
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]]; const piv = M[c][c] || 1e-12;
      for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / piv; if (f) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
    }
    return M.map((r, i) => r[n] / (r[i] || 1e-12));
  }
  function leastSquares(Phi, y, lambda) {
    const m = Phi[0].length, A = Array.from({ length: m }, () => new Array(m).fill(0)), b = new Array(m).fill(0);
    Phi.forEach((f, i) => { for (let a = 0; a < m; a++) { b[a] += f[a] * y[i]; for (let c = a; c < m; c++) A[a][c] += f[a] * f[c]; } });
    for (let a = 0; a < m; a++) { for (let c = 0; c < a; c++) A[a][c] = A[c][a]; if (a > 0) A[a][a] += lambda * Phi.length; }
    return solve(A, b);
  }
  const poly2 = z => { const f = [1, ...z]; for (let a = 0; a < z.length; a++) for (let c = a; c < z.length; c++) f.push(z[a] * z[c]); return f; };

  /* ---------- models ---------- */
  function fitLinear(X, y) {
    const t = scaler(X), w = leastSquares(X.map(x => [1, ...t(x)]), y, 1e-8);
    return x => { const z = t(x); let s = w[0]; for (let j = 0; j < z.length; j++) s += w[j + 1] * z[j]; return s; };
  }
  function fitPoly2(X, y) {
    const t = scaler(X), w = leastSquares(X.map(x => poly2(t(x))), y, 1e-6);
    return x => poly2(t(x)).reduce((s, f, j) => s + w[j] * f, 0);
  }
  function fitKNN(X, y, o = {}) {
    const k = o.k || 5, t = scaler(X), Z = X.map(t);
    return x => {
      const z = t(x), best = [];
      for (let i = 0; i < Z.length; i++) {
        let d = 0; for (let j = 0; j < z.length; j++) d += (z[j] - Z[i][j]) ** 2;
        if (best.length < k || d < best[best.length - 1][0]) { best.push([d, y[i]]); best.sort((a, b) => a[0] - b[0]); if (best.length > k) best.pop(); }
      }
      return best.reduce((s, b) => s + b[1], 0) / best.length;
    };
  }
  // CART regression tree: best split by squared error, minLeaf samples per leaf
  function buildTree(X, y, idx, o, depth) {
    const n = idx.length; let sum = 0; for (const i of idx) sum += y[i];
    const mean = sum / n;
    if (n < 2 * o.minLeaf || depth >= o.maxDepth) return { v: mean };
    let best = null; const d = X[0].length;
    for (let j = 0; j < d; j++) {
      const s = idx.slice().sort((a, b) => X[a][j] - X[b][j]); let ls = 0, lq = 0, tq = 0;
      for (const i of s) tq += y[i] * y[i];
      for (let k = 0; k < n - 1; k++) {
        const yi = y[s[k]]; ls += yi; lq += yi * yi;
        if (k + 1 < o.minLeaf || n - k - 1 < o.minLeaf || X[s[k]][j] === X[s[k + 1]][j]) continue;
        const nl = k + 1, nr = n - nl, rs = sum - ls, sse = (lq - ls * ls / nl) + ((tq - lq) - rs * rs / nr);
        if (!best || sse < best.sse) best = { sse, j, thr: (X[s[k]][j] + X[s[k + 1]][j]) / 2 };
      }
    }
    if (!best) return { v: mean };
    const L = idx.filter(i => X[i][best.j] <= best.thr), Rr = idx.filter(i => X[i][best.j] > best.thr);
    return { j: best.j, thr: best.thr, l: buildTree(X, y, L, o, depth + 1), r: buildTree(X, y, Rr, o, depth + 1) };
  }
  const walk = (nd, x) => { while (nd.v === undefined) nd = x[nd.j] <= nd.thr ? nd.l : nd.r; return nd.v; };
  function fitTree(X, y, o = {}) {
    const opt = { minLeaf: o.minLeaf || 3, maxDepth: o.maxDepth || 14 }, root = buildTree(X, y, X.map((_, i) => i), opt, 0);
    return x => walk(root, x);
  }
  function fitForest(X, y, o = {}) {
    const R = C.rng('AIENG|forest|' + (o.seed || 0)), nT = o.trees || 30, opt = { minLeaf: o.minLeaf || 2, maxDepth: o.maxDepth || 16 }, trees = [];
    for (let t = 0; t < nT; t++) { const idx = X.map(() => Math.floor(R() * X.length)); trees.push(buildTree(X, y, idx, opt, 0)); }
    return x => trees.reduce((s, tr) => s + walk(tr, x), 0) / nT;
  }
  const MODELS = {
    linear: { name: 'Linear regression', fit: fitLinear, note: 'straight-line (weighted sum) of the features' },
    poly2: { name: 'Polynomial regression (degree 2)', fit: fitPoly2, note: 'adds squares and products of the features' },
    knn: { name: 'k-nearest neighbours (k = 5)', fit: fitKNN, note: 'average of the 5 most similar training rows' },
    tree: { name: 'Decision tree', fit: fitTree, note: 'a sequence of if–then splits on the features' },
    forest: { name: 'Random forest (30 trees)', fit: fitForest, note: 'average of 30 trees grown on resampled data' }
  };

  /* ---------- evaluation ---------- */
  function metrics(y, yh) {
    const n = y.length, m = y.reduce((a, b) => a + b, 0) / n;
    let ss = 0, st = 0, ae = 0, pe = 0, okp = true;
    for (let i = 0; i < n; i++) { const e = yh[i] - y[i]; ss += e * e; st += (y[i] - m) ** 2; ae += Math.abs(e); if (Math.abs(y[i]) < 1e-9) okp = false; else pe += Math.abs(e / y[i]); }
    return { r2: 1 - ss / (st || 1), rmse: Math.sqrt(ss / n), mae: ae / n, mape: okp ? 100 * pe / n : null };
  }
  function split(n, testFrac, seed) {
    const R = C.rng('AIENG|split|' + seed), idx = [...Array(n).keys()];
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    const nt = Math.max(1, Math.round(n * testFrac)); return { test: idx.slice(0, nt), train: idx.slice(nt) };
  }

  /* ---------- plots (canvas) ---------- */
  function frame(cv, o) {
    const dpr = window.devicePixelRatio || 1, W = cv.clientWidth || 360, H = o.height || 230;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + 'px';
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const P = { l: 52, r: 10, t: 22, b: 34 }; return { ctx, W, H, P, w: W - P.l - P.r, h: H - P.t - P.b };
  }
  const nice = (a, b) => { if (a === b) { a -= 1; b += 1; } const pad = (b - a) * 0.05; return [a - pad, b + pad]; };
  const fmtTick = v => Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + 'k' : Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(2);
  function axes(F, xr, yr, o) {
    const { ctx, P, w, h } = F; ctx.strokeStyle = '#c9d3e1'; ctx.fillStyle = '#556'; ctx.font = '10.5px IBM Plex Mono, monospace'; ctx.lineWidth = 1;
    for (let k = 0; k <= 4; k++) {
      const yy = P.t + h - k / 4 * h, xx = P.l + k / 4 * w;
      ctx.beginPath(); ctx.moveTo(P.l, yy); ctx.lineTo(P.l + w, yy); ctx.stroke(); ctx.fillText(fmtTick(yr[0] + k / 4 * (yr[1] - yr[0])), 4, yy + 3);
      ctx.beginPath(); ctx.moveTo(xx, P.t); ctx.lineTo(xx, P.t + h); ctx.stroke(); ctx.fillText(fmtTick(xr[0] + k / 4 * (xr[1] - xr[0])), xx - 12, P.t + h + 14);
    }
    ctx.fillStyle = '#0d2b55'; ctx.font = '600 11.5px IBM Plex Mono, monospace'; ctx.fillText(o.title || '', P.l, 14);
    ctx.font = '10.5px IBM Plex Mono, monospace'; ctx.fillStyle = '#556'; ctx.fillText(o.xlabel || '', P.l + w - ctx.measureText(o.xlabel || '').width, P.t + h + 28);
  }
  function scatter(cv, x, y, o = {}) {
    const F = frame(cv, o), xr = o.xr || nice(Math.min(...x), Math.max(...x)), yr = o.yr || nice(Math.min(...y), Math.max(...y));
    axes(F, xr, yr, o); const { ctx, P, w, h } = F, sx = v => P.l + (v - xr[0]) / (xr[1] - xr[0]) * w, sy = v => P.t + h - (v - yr[0]) / (yr[1] - yr[0]) * h;
    if (o.ref === 'diag') { ctx.strokeStyle = '#a8843a'; ctx.setLineDash([5, 4]); ctx.beginPath(); const a = Math.max(xr[0], yr[0]), b = Math.min(xr[1], yr[1]); ctx.moveTo(sx(a), sy(a)); ctx.lineTo(sx(b), sy(b)); ctx.stroke(); ctx.setLineDash([]); }
    if (o.ref === 'zero') { ctx.strokeStyle = '#a8843a'; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(P.l, sy(0)); ctx.lineTo(P.l + w, sy(0)); ctx.stroke(); ctx.setLineDash([]); }
    ctx.fillStyle = o.color || 'rgba(11,107,211,.55)';
    for (let i = 0; i < x.length; i++) { const X = sx(x[i]), Y = sy(y[i]); if (X >= P.l && X <= P.l + w && Y >= P.t && Y <= P.t + h) { ctx.beginPath(); ctx.arc(X, Y, 2.4, 0, 7); ctx.fill(); } }
  }
  function hist(cv, v, o = {}) {
    const nb = o.bins || 25, lo = Math.min(...v), hi = Math.max(...v), wdt = (hi - lo) / nb || 1, c = new Array(nb).fill(0);
    v.forEach(z => { c[Math.min(nb - 1, Math.floor((z - lo) / wdt))]++; });
    const F = frame(cv, o), xr = [lo, hi], yr = [0, Math.max(...c) * 1.1]; axes(F, xr, yr, o);
    const { ctx, P, w, h } = F; ctx.fillStyle = o.color || 'rgba(13,43,85,.7)';
    c.forEach((k, i) => { const bh = k / yr[1] * h; ctx.fillRect(P.l + i / nb * w + 1, P.t + h - bh, w / nb - 2, bh); });
    if (lo < 0 && hi > 0) { const x0 = P.l + (0 - lo) / (hi - lo) * w; ctx.strokeStyle = '#a8843a'; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(x0, P.t); ctx.lineTo(x0, P.t + h); ctx.stroke(); ctx.setLineDash([]); }
  }

  const api = { MODELS, fit: (type, X, y, o) => MODELS[type].fit(X, y, o), metrics, split, scatter, hist, scaler };
  root.ML = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
