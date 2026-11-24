/* AI for Engineering — full technical report (identical for the student and the instructor) */
(function (root) {
  'use strict';
  const C = root.Common, UI = root.UI, esc = UI.esc, NAVY = UI.NAVY, GOLD = UI.GOLD, MUTED = UI.MUTED;
  const verdict = r => !r || !r.done ? '<span class="tag pend">pending</span>' : r.correct ? '<span class="tag ok">correct</span>' : '<span class="tag bad">incorrect</span>';
  const f = (x, n = 5) => (x === null || x === undefined || x === '') ? '—' : C.fmt(x, n);
  function build(T, rec, cfgIn, logo) {
    const cfg = C.mergeConfig(T, cfgIn), pr = rec.profile, id = pr.id, p = Object.assign(T.params(id), { _id: String(id) });
    const R = (rec.work && rec.work.results) || {}, mk = C.computeMarks(T, R, rec.overrides, cfg);
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const ch = T.challenge, s = (R.sim && R.sim.settings) || cfg.challenge;
    const ref = ch.run(p, s, 'reference'), conv = ch.run(p, s, 'conventional');
    const sim = R.sim || {}, best = sim.best || null, trace = (best && best.trace) || sim.trace || null, mlM = (best && best.metrics) || sim.lastMetrics || null;
    const cert = rec.work && rec.work.cert;
    const sheets = T.sheets.map((sh, n) => {
      const ans = sh.answers(p);
      return `<h2 class="newpage">${n + 3}. ${esc(sh.title)}</h2><p>${typeof sh.lead === 'function' ? sh.lead(p) : sh.lead}</p>
        ${sh.solution ? `<h3>Worked solution</h3><div class="sol">${sh.solution(p)}</div>` : ''}
        <h3>Answers</h3><table class="t"><tr><th>QUANTITY</th><th>CORRECT</th><th>STUDENT</th><th>UNIT</th><th>ATTEMPTS</th><th>VERDICT</th></tr>
        ${sh.keys.map(k => `<tr><td>${k.label}</td><td class="n">${f(ans[k.key])}</td><td class="n">${f((R[k.key] || {}).answer)}</td><td>${esc(k.unit || '—')}</td><td class="n">${(R[k.key] || {}).attempts || '—'}</td><td>${verdict(R[k.key])}</td></tr>`).join('')}</table>`;
    }).join('');
    const nS = T.sheets.length;
    const mrow = (name, m, ix) => `<tr><td>${name}</td>${ch.metrics.map(x => `<td class="n">${m ? f(m[x.key], x.d || 4) : '—'}</td>`).join('')}<td class="n">${ix ?? '—'}</td></tr>`;
    const figs = trace ? ch.plots.map(pl => UI.svgPlot(trace.t, pl.series.filter(sr => trace[sr.key]).map(sr => ({ data: trace[sr.key], color: sr.color, label: sr.label, dash: Array.isArray(sr.dash) ? sr.dash.join(' ') : sr.dash })),
      { xlabel: ch.xlabel || 't', ylabel: pl.ylabel || '', ylim: pl.ylim, caption: esc(pl.title) + ' — run with the student\'s ML model.' })).join('')
      : '<p class="note">No challenge run with the ML model recorded yet.</p>';
    const convFigs = ch.plots.slice(0, 1).map(pl => UI.svgPlot(conv.trace.t, pl.series.filter(sr => conv.trace[sr.key]).map(sr => ({ data: conv.trace[sr.key], color: sr.color, label: sr.label, dash: Array.isArray(sr.dash) ? sr.dash.join(' ') : sr.dash })),
      { xlabel: ch.xlabel || 't', ylabel: pl.ylabel || '', ylim: pl.ylim, caption: esc(pl.title) + ' — ' + esc(ch.convLabel) + ' (for comparison).' })).join('');
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(T.title)} — ${esc(pr.name)} (${esc(id)})</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;600&family=Cormorant+Garamond:wght@500;600;700&display=swap" rel="stylesheet">
<style>
@page { size: A4; margin: 20mm 16mm 18mm 16mm;
  @top-left { content: "${esc(T.courseLine)} · Technical Assessment Report"; font: 7.5pt 'IBM Plex Mono', monospace; color: ${MUTED}; border-bottom: .6pt solid ${GOLD}; vertical-align: bottom; padding-bottom: 3mm; }
  @top-right { content: "${esc(pr.name)} · ${esc(id)}"; font: 7.5pt 'IBM Plex Mono', monospace; color: ${MUTED}; border-bottom: .6pt solid ${GOLD}; vertical-align: bottom; padding-bottom: 3mm; }
  @bottom-left { content: "${esc(T.title)} · ${C.VERSION} · Created by Youssef Ajra"; font: 7pt 'IBM Plex Mono', monospace; color: ${MUTED}; vertical-align: top; padding-top: 3mm; }
  @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 7pt 'IBM Plex Mono', monospace; color: ${MUTED}; vertical-align: top; padding-top: 3mm; } }
@page :first { @top-left { content: none; border: 0; } @top-right { content: none; border: 0; } }
* { box-sizing: border-box; } body { margin: 0; font-family: 'IBM Plex Sans', Arial, sans-serif; font-size: 10.5pt; color: #1d2633; line-height: 1.45; background: #eef1f6; }
.doc { max-width: 210mm; margin: 0 auto; background: #fff; padding: 18mm 16mm; }
.bar { position: sticky; top: 0; background: ${NAVY}; color: #fff; padding: 10px 16px; display: flex; gap: 10px; align-items: center; z-index: 5; font-family: 'IBM Plex Mono', monospace; font-size: 12px; }
.bar button { font: inherit; background: ${GOLD}; color: #fff; border: 0; padding: 7px 14px; cursor: pointer; border-radius: 3px; }
h1, h2, h3 { color: ${NAVY}; margin: 0; } h2 { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 20pt; font-weight: 600; border-bottom: 1.5px solid ${GOLD}; padding-bottom: 3px; margin: 22px 0 10px; break-after: avoid; }
h3 { font-size: 11.5pt; margin: 14px 0 6px; break-after: avoid; } p { margin: 5px 0; } .note { color: ${MUTED}; font-style: italic; }
table.t, .sol table, .sys table { border-collapse: collapse; width: 100%; margin: 6px 0; font-size: 9.5pt; break-inside: avoid; }
table.t th, table.t td, .sol th, .sol td, .sys th, .sys td { border: 1px solid #c9d3e1; padding: 4px 6px; text-align: left; vertical-align: top; }
table.t th, .sol th, .sys th { background: #f3f6fa; color: ${MUTED}; font-family: 'IBM Plex Mono', monospace; font-size: 8.5pt; }
td.n, .num { font-family: 'IBM Plex Mono', monospace; text-align: right; white-space: nowrap; }
.sol { background: #f8f9fc; border-left: 3px solid ${GOLD}; padding: 6px 12px; } .sol p { margin: 4px 0; } code, .eq { font-family: 'IBM Plex Mono', monospace; font-size: 9.5pt; }
.tag { font-family: 'IBM Plex Mono', monospace; font-size: 8.5pt; padding: 1px 6px; border-radius: 9px; border: 1px solid; white-space: nowrap; }
.tag.ok { color: #0f7a55; background: #e3f5ee; } .tag.bad { color: #b8322a; background: #fbe9e7; } .tag.pend { color: #a86a00; background: #fff4dc; }
figure { margin: 8px 0 12px; break-inside: avoid; } figcaption { font-size: 9pt; color: ${MUTED}; } svg.plot { width: 100%; height: auto; display: block; }
.cover { text-align: center; padding: 26mm 0 10mm; break-after: page; } .cover img.logo { height: 90px; margin-bottom: 18px; }
.cover .k { font-family: 'IBM Plex Mono', monospace; font-size: 10pt; letter-spacing: .16em; color: ${MUTED}; }
.cover h1 { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 34pt; font-weight: 600; margin: 18px 0 6px; } .cover .sub { font-size: 13pt; color: ${GOLD}; font-style: italic; font-family: 'Cormorant Garamond', Georgia, serif; }
.cover .who { margin: 22mm auto 0; width: 70%; border-top: 1.5px solid ${GOLD}; border-bottom: 1.5px solid ${GOLD}; padding: 12px 0; } .cover .who .name { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 24pt; font-weight: 700; color: ${NAVY}; }
.kpis { display: flex; justify-content: center; gap: 14px; margin-top: 14mm; } .kpi { border: 1.2px solid ${GOLD}; background: #fbf7ee; padding: 8px 18px; min-width: 120px; }
.kpi span { display: block; font-family: 'IBM Plex Mono', monospace; font-size: 8pt; letter-spacing: .12em; color: ${MUTED}; } .kpi b { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 20pt; color: ${NAVY}; }
.sign { display: flex; justify-content: space-between; margin-top: 18mm; break-inside: avoid; } .sign div { width: 42%; border-top: 1px solid ${NAVY}; padding-top: 4px; font-size: 9pt; color: ${MUTED}; text-align: center; }
.sys .lead, .sys .msg { margin: 6px 0; } .sys svg { max-width: 100%; height: auto; } .pill { font-family: 'IBM Plex Mono', monospace; font-size: 8.5pt; }
@media print { body { background: #fff; } .bar { display: none; } .doc { max-width: none; padding: 0; } h2.newpage { break-before: page; } }
</style></head><body>
<div class="bar"><span>${esc(T.title)} — ${esc(pr.name)} (${esc(id)})</span><span style="flex:1"></span><button onclick="window.print()">⬇ Save as PDF / Print</button></div>
<div class="doc">
<section class="cover">${logo ? `<img class="logo" src="${esc(logo)}" alt="Beirut Arab University">` : ''}
  <div class="k">BEIRUT ARAB UNIVERSITY · FACULTY OF ENGINEERING</div><div class="k">${esc(T.dept.replace(/^FACULTY OF ENGINEERING · /, ''))}</div>
  <h1>Technical Assessment Report</h1><div class="sub">${esc(T.title)} — ${esc(T.subtitle)}</div><div class="k" style="margin-top:8px">${esc(T.courseLine)}</div>
  <div class="who"><div class="name">${esc(pr.name)}</div><div class="k">STUDENT ID ${esc(id)}</div></div>
  <div class="kpis"><div class="kpi"><span>MARKS</span><b>${Math.round(mk.earned * 10) / 10} / ${mk.total}</b></div><div class="kpi"><span>ACHIEVEMENT</span><b>${mk.pct.toFixed(1)} %</b></div><div class="kpi"><span>${esc((ch.indexLabel || 'Challenge Index').toUpperCase())}</span><b>${sim.bestIndex ? Number(sim.bestIndex).toFixed(1) : '—'}</b></div></div>
  <p class="k" style="margin-top:14mm">Instructor: Dr. Youssef Ajra · Report generated ${esc(today)}${cert ? ' · Certificate ' + esc(cert.code) : ''}</p></section>
<h2>1. Summary of results</h2><table class="t"><tr><th>#</th><th>ITEM</th><th>STATUS</th><th>ATTEMPTS</th><th>MARK</th></tr>
${mk.rows.map((r, i) => `<tr><td>${i + 1}</td><td>${r.label}</td><td>${verdict(R[r.key])}${r.override !== null ? ' <span class="tag pend">adjusted by instructor</span>' : ''}</td><td class="n">${(R[r.key] || {}).attempts || ''}</td><td class="n">${Math.round(r.earned * 10) / 10} / ${r.weight}</td></tr>`).join('')}
<tr><td></td><td><b>Total</b></td><td></td><td></td><td class="n"><b>${Math.round(mk.earned * 10) / 10} / ${mk.total} (${mk.pct.toFixed(1)} %)</b></td></tr></table>
<h2 class="newpage">2. The system</h2><div class="sys">${T.systemHTML(p)}</div>
${sheets}
<h2 class="newpage">${nS + 3}. Machine-learning model</h2><p>${T.ml.explainHTML(p)}</p>
<table class="t"><tr><th>ITEM</th><th>VALUE</th></tr>
<tr><td>Dataset</td><td>N = ${cfg.datasetN} rows · features ${T.ml.predictors.map(v => v.name + (v.unit ? ' [' + v.unit + ']' : '')).join(', ')} · label ${T.ml.response.name}${T.ml.response.unit ? ' [' + T.ml.response.unit + ']' : ''}</td></tr>
<tr><td>Tool</td><td>${T.ml.toolText || `MATLAB ${T.ml.task === 'classification' ? 'Classification' : 'Regression'} Learner, exported with exportForWeb.m (${T.ml.mode === 'grid' ? 'grid sampling' : 'prediction file'})`}</td></tr>
<tr><td>Selected model</td><td>${esc((R.ml && R.ml.modelType) || '—')}</td></tr>
<tr><td>Hidden-test ${esc((R.ml && R.ml.label) || (T.ml.task === 'classification' ? 'accuracy' : 'R²'))}</td><td class="n">${esc((R.ml && R.ml.text) || '—')}${R.ml && R.ml.rmse ? ' · RMSE ' + f(R.ml.rmse, 4) : ''}</td></tr>
<tr><td>Pass criterion</td><td>${T.ml.task === 'classification' ? 'accuracy ≥ ' + (100 * cfg.mlThreshold).toFixed(1) + ' %' : 'R² ≥ ' + cfg.mlThreshold} → ${verdict(R.ml)}</td></tr></table>${T.ml.reportHTML ? T.ml.reportHTML(p, rec, cfg) : ''}
<h2 class="newpage">${nS + 4}. Engineering challenge</h2><p>${ch.describe(p, s)}</p>
<table class="t"><tr><th>RUN</th>${ch.metrics.map(m => `<th>${esc(m.label)}${m.unit ? ' [' + esc(m.unit) + ']' : ''}</th>`).join('')}<th>INDEX</th></tr>
${mrow(esc(ch.refLabel || 'Reference (ideal)'), ref.metrics, '100')}${mrow('<b>With the student\'s ML model</b>', mlM, sim.bestIndex || sim.lastIndex)}${mrow(esc(ch.convLabel), conv.metrics, '0')}</table>
<p>Pass: index ≥ ${cfg.minIndex} → ${verdict(R.sim)}${sim.runs ? ` (${sim.runs} run(s))` : ''}. Index = 100 × (conventional − model) / (conventional − reference), on the cost "${esc(ch.costLabel || 'cost')}".</p>
${figs}${convFigs}
<h2>${nS + 5}. Conclusion</h2><p>${esc(pr.name)} achieved <b>${mk.pct.toFixed(1)} %</b> of the marks. ${sim.correct ? `The ML model passed the engineering challenge with a ${esc(ch.indexLabel || 'Challenge Index')} of ${Number(sim.bestIndex).toFixed(1)}, improving on the ${esc(ch.convLabel.toLowerCase())}.` : 'The engineering challenge with the ML model is not yet passed.'}</p>
<div class="sign"><div>${esc(pr.name)} — Student</div><div>Dr. Youssef Ajra — Course Instructor</div></div></div>
<script>document.fonts && document.fonts.ready.then(() => setTimeout(() => { if (!window.__p) { window.__p = 1; window.print(); } }, 400));</script></body></html>`;
  }
  function open(T, rec, cfg) {
    const w = root.open('', '_blank'); if (!w) { UI.toast('Allow pop-ups for this site to download the report.', 'bad'); return; }
    w.document.write('<p style="font-family:monospace;padding:20px">Building report…</p>');
    UI.resolveLogo().then(logo => { try { const h = build(T, rec, cfg, logo); w.document.open(); w.document.write(h); w.document.close(); } catch (e) { w.document.body.innerHTML = '<pre>Report failed: ' + esc(e.stack || e.message) + '</pre>'; } });
  }
  root.Report = { open, build };
})(window);
