/* AI for Engineering — shared drawing & UI helpers (plots, certificate, logo, downloads) */
(function (root) {
  'use strict';
  const C = root.Common;
  const INK = '#0d2b55', NAVY = '#13294b', GOLD = '#a8843a', MUTED = '#5b6b82';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const BASE = root.SHARED || '../../../shared/';
  const LOGO_SOURCES = ['https://usif-3jra.github.io/epme-study-plan/assets/logo_ECE.png', BASE + 'assets/bau-logo.png'];
  function logoHTML(cls = 'logo') {
    return `<img class="${cls}" src="${LOGO_SOURCES[0]}" alt="Beirut Arab University" data-i="0" onerror="var i=+this.dataset.i+1;var L=${esc(JSON.stringify(LOGO_SOURCES))};if(i<L.length){this.dataset.i=i;this.src=L[i];}else{this.outerHTML='<div class=&quot;logo-fallback&quot;>BAU</div>';}">`;
  }
  function resolveLogo() {
    return new Promise(res => { const go = i => { if (i >= LOGO_SOURCES.length) return res(null); const u = new URL(LOGO_SOURCES[i], location.href).href, im = new Image(); im.onload = () => res(u); im.onerror = () => go(i + 1); im.src = u; }; go(0); });
  }
  function plot(canvas, x, series, o = {}) {
    const dpr = root.devicePixelRatio || 1, w = canvas.clientWidth || 600, h = o.height || 200;
    canvas.width = w * dpr; canvas.height = h * dpr; canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const m = { l: 54, r: 12, t: 18, b: 28 };
    const pw = w - m.l - m.r, ph = h - m.t - m.b;
    const upto = o.upto ?? x.length - 1;
    let lo = Infinity, hi = -Infinity;
    series.forEach(s => s.data.forEach(v => { if (isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }));
    if (o.ylim) [lo, hi] = o.ylim;
    if (!(hi > lo)) { hi = lo + 1; lo -= 1; }
    const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
    const x0 = x[0], x1 = x[x.length - 1];
    const X = v => m.l + (v - x0) / (x1 - x0) * pw, Y = v => m.t + (hi - v) / (hi - lo) * ph;
    ctx.strokeStyle = 'rgba(31,95,168,.12)'; ctx.lineWidth = 1; ctx.font = '10.5px IBM Plex Mono, monospace'; ctx.fillStyle = '#5a7293';
    const ticks = (a, b, n) => { const st = Math.pow(10, Math.floor(Math.log10((b - a) / n))); const k = [1, 2, 5, 10].find(k => (b - a) / (k * st) <= n) * st; const r = []; for (let v = Math.ceil(a / k) * k; v <= b + 1e-12; v += k) r.push(+v.toFixed(10)); return r; };
    ticks(lo, hi, 5).forEach(v => { ctx.beginPath(); ctx.moveTo(m.l, Y(v)); ctx.lineTo(w - m.r, Y(v)); ctx.stroke(); ctx.fillText(String(+v.toPrecision(3)), 6, Y(v) + 3); });
    ticks(x0, x1, 9).forEach(v => { ctx.beginPath(); ctx.moveTo(X(v), m.t); ctx.lineTo(X(v), h - m.b); ctx.stroke(); ctx.fillText(String(v), X(v) - 6, h - 10); });
    ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.strokeRect(m.l, m.t, pw, ph);
    if (lo < 0 && hi > 0) { ctx.strokeStyle = 'rgba(13,43,85,.35)'; ctx.beginPath(); ctx.moveTo(m.l, Y(0)); ctx.lineTo(w - m.r, Y(0)); ctx.stroke(); }
    series.forEach(s => {
      ctx.strokeStyle = s.color || INK; ctx.lineWidth = s.width || 1.6; ctx.setLineDash(s.dash || []);
      ctx.beginPath(); let started = false;
      for (let i = 0; i <= upto && i < s.data.length; i++) { const v = s.data[i]; if (!isFinite(v)) continue; const px = X(x[i]), py = Y(Math.max(lo, Math.min(hi, v))); if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py); }
      ctx.stroke(); ctx.setLineDash([]);
    });
    if (o.title) { ctx.fillStyle = INK; ctx.font = '600 11.5px IBM Plex Mono, monospace'; ctx.fillText(o.title, m.l, 12); }
    if (o.xlabel) { ctx.fillStyle = '#5a7293'; ctx.fillText(o.xlabel, w - m.r - 60, 12); }
  }

  function svgPlot(x, series, o = {}) {
    const W = o.w || 680, H = o.h || 220, m = { l: 56, r: 14, t: 22, b: 34 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    let lo = Infinity, hi = -Infinity;
    series.forEach(s => s.data.forEach(v => { if (isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }));
    if (o.ylim) [lo, hi] = o.ylim;
    if (!(hi > lo)) { hi = lo + 1; lo -= 1; }
    const pad = (hi - lo) * 0.07; lo -= pad; hi += pad;
    const x0 = x[0], x1 = x[x.length - 1];
    const X = v => m.l + (v - x0) / (x1 - x0) * pw, Y = v => m.t + (hi - Math.max(lo, Math.min(hi, v))) / (hi - lo) * ph;
    const ticks = (a, b, n) => { const st = Math.pow(10, Math.floor(Math.log10((b - a) / n))); const k = [1, 2, 5, 10].find(k => (b - a) / (k * st) <= n) * st; const r = []; for (let v = Math.ceil(a / k) * k; v <= b + 1e-12; v += k) r.push(+v.toFixed(10)); return r; };
    const gy = ticks(lo, hi, 5).map(v => `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e3e8f0"/><text x="${m.l - 6}" y="${Y(v) + 3}" text-anchor="end">${+v.toPrecision(3)}</text>`).join('');
    const gx = ticks(x0, x1, 9).map(v => `<line y1="${m.t}" y2="${H - m.b}" x1="${X(v)}" x2="${X(v)}" stroke="#e3e8f0"/><text x="${X(v)}" y="${H - m.b + 14}" text-anchor="middle">${+v.toPrecision(4)}</text>`).join('');
    const zero = lo < 0 && hi > 0 ? `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(0)}" y2="${Y(0)}" stroke="#9aa7b9"/>` : '';
    const paths = series.map(s => {
      let d = ''; s.data.forEach((v, i) => { if (!isFinite(v)) return; d += (d ? 'L' : 'M') + X(x[i]).toFixed(1) + ',' + Y(v).toFixed(1); });
      return `<path d="${d}" fill="none" stroke="${s.color || NAVY}" stroke-width="${s.width || 1.6}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''}/>`;
    }).join('');
    const legend = series.filter(s => s.label).map((s, i) => `<g transform="translate(${m.l + 8 + i * 150} ${m.t + 12})"><line x1="0" x2="18" y1="-4" y2="-4" stroke="${s.color || NAVY}" stroke-width="2" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''}/><text x="24" y="0">${esc(s.label)}</text></g>`).join('');
    return `<figure><svg viewBox="0 0 ${W} ${H}" class="plot"><g font-family="IBM Plex Mono,monospace" font-size="10" fill="${MUTED}">${gy}${gx}</g>${zero}
      <rect x="${m.l}" y="${m.t}" width="${pw}" height="${ph}" fill="none" stroke="${NAVY}"/>${paths}
      <g font-family="IBM Plex Mono,monospace" font-size="10" fill="${NAVY}">${legend}</g>
      <text x="${W - m.r}" y="${H - 6}" text-anchor="end" font-family="IBM Plex Mono,monospace" font-size="10" fill="${MUTED}">${esc(o.xlabel || '')}</text>
      <text x="12" y="${m.t + ph / 2}" transform="rotate(-90 12 ${m.t + ph / 2})" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="10" fill="${MUTED}">${esc(o.ylabel || '')}</text></svg>
      ${o.caption ? `<figcaption>${o.caption}</figcaption>` : ''}</figure>`;
  }
  function download(name, text, mime = 'text/plain') {
    const b = new Blob([text], { type: mime }); const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function toast(msg, type = '') {
    let host = document.querySelector('.toast'); if (!host) { host = document.createElement('div'); host.className = 'toast'; document.body.appendChild(host); }
    const d = document.createElement('div'); d.className = type; d.textContent = msg; host.appendChild(d); setTimeout(() => d.remove(), 3800);
  }
  function certificateSVG(d) {
    const W = 1123, H = 794, K = '#13294b', G = '#5b6b82', A = '#a8843a', S = '#1c1c1c';
    const corner = (x, y, sx, sy) => `<g transform="translate(${x} ${y}) scale(${sx} ${sy})" fill="none" stroke="${A}" stroke-width="1.2"><path d="M0 46 L0 0 L46 0"/><path d="M8 38 L8 8 L38 8"/><circle cx="8" cy="8" r="3"/><path d="M16 30 Q16 16 30 16"/></g>`;
    const sketch = d.sketch ? `<svg x="742" y="250" width="330" height="314" viewBox="0 0 420 400">${d.sketch}</svg>` : '';
    const logo = d.logo
      ? `<image href="${esc(d.logo)}" x="${W / 2 - 120}" y="52" width="240" height="96" preserveAspectRatio="xMidYMid meet"/>`
      : `<circle cx="${W / 2}" cy="100" r="40" fill="none" stroke="${K}"/><text x="${W / 2}" y="106" text-anchor="middle" font-family="Cormorant Garamond,serif" font-size="22" fill="${K}">BAU</text>`;
    return `<svg class="cert-frame" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="width:100%;height:auto;display:block;background:#fff">
      <rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>
      <rect x="22" y="22" width="${W - 44}" height="${H - 44}" fill="none" stroke="${K}" stroke-width="3"/>
      <rect x="31" y="31" width="${W - 62}" height="${H - 62}" fill="none" stroke="${A}" stroke-width="1.2"/>
      <rect x="36" y="36" width="${W - 72}" height="${H - 72}" fill="none" stroke="${A}" stroke-width=".5"/>
      ${corner(44, 44, 1, 1)}${corner(W - 44, 44, -1, 1)}${corner(44, H - 44, 1, -1)}${corner(W - 44, H - 44, -1, -1)}
      ${logo}
      <text x="${W / 2}" y="170" text-anchor="middle" font-family="IBM Plex Sans,Arial,sans-serif" font-size="12.5" letter-spacing="3.2" fill="${G}">${esc(d.dept)}</text>
      <text x="${W / 2}" y="196" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="14" letter-spacing="2" fill="${K}">${esc(d.courseLine)}</text>
      <line x1="${W / 2 - 170}" y1="214" x2="${W / 2 - 12}" y2="214" stroke="${A}" stroke-width="1"/><path d="M${W / 2} 208 L${W / 2 + 6} 214 L${W / 2} 220 L${W / 2 - 6} 214 Z" fill="${A}"/><line x1="${W / 2 + 12}" y1="214" x2="${W / 2 + 170}" y2="214" stroke="${A}" stroke-width="1"/>
      <text x="${W / 2}" y="270" text-anchor="middle" font-family="Cormorant Garamond,Garamond,Georgia,serif" font-size="50" font-weight="500" letter-spacing="1.5" fill="${K}">Certificate of Achievement</text>
      <text x="96" y="330" font-family="Cormorant Garamond,Georgia,serif" font-size="21" font-style="italic" fill="${G}">This is to certify that</text>
      <text x="96" y="390" font-family="Cormorant Garamond,Georgia,serif" font-size="46" font-weight="600" fill="${K}">${esc(d.name)}</text>
      <line x1="96" y1="404" x2="700" y2="404" stroke="${A}" stroke-width="1.2"/>
      <text x="96" y="426" font-family="IBM Plex Mono,monospace" font-size="13" letter-spacing="1.5" fill="${G}">STUDENT ID  ${esc(d.id)}</text>
      <text x="96" y="468" font-family="Cormorant Garamond,Georgia,serif" font-size="21" fill="${K}">has successfully passed the <tspan font-weight="700" fill="${A}">${esc(d.assessment)}</tspan>:</text>
      <text x="96" y="496" font-family="Cormorant Garamond,Georgia,serif" font-size="21" font-style="italic" fill="${K}">${esc(d.subtitle)},</text>
      <text x="96" y="524" font-family="Cormorant Garamond,Georgia,serif" font-size="19" fill="${G}">${esc(d.cover1)}</text>
      <text x="96" y="548" font-family="Cormorant Garamond,Georgia,serif" font-size="19" fill="${G}">${esc(d.cover2)}</text>
      <g transform="translate(96 574)">
        <rect x="0" y="0" width="200" height="62" fill="#fbf7ee" stroke="${A}" stroke-width="1.2"/>
        <text x="100" y="20" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="10.5" letter-spacing="2" fill="${G}">ACHIEVEMENT</text>
        <text x="100" y="50" text-anchor="middle" font-family="Cormorant Garamond,Georgia,serif" font-size="30" font-weight="700" fill="${K}">${d.pct.toFixed(1)} %</text>
        <rect x="216" y="0" width="200" height="62" fill="#fbf7ee" stroke="${A}" stroke-width="1.2"/>
        <text x="316" y="20" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="10.5" letter-spacing="2" fill="${G}">${esc(d.indexLabel || 'CHALLENGE INDEX')}</text>
        <text x="316" y="50" text-anchor="middle" font-family="Cormorant Garamond,Georgia,serif" font-size="30" font-weight="700" fill="${K}">${d.index !== undefined && d.index !== null ? Number(d.index).toFixed(1) : '—'}</text>
      </g>
      ${sketch}
      <text x="906" y="586" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="10" letter-spacing="1.6" fill="${G}">${esc(d.sketchLabel || 'SYSTEM SKETCH')}</text>
      <line x1="740" y1="628" x2="1000" y2="628" stroke="${A}" stroke-width="1"/>
      <text x="870" y="648" text-anchor="middle" font-family="IBM Plex Sans,Arial,sans-serif" font-size="12" letter-spacing="1" fill="${G}">Under the supervision of</text>
      <text x="870" y="676" text-anchor="middle" font-family="Cormorant Garamond,Georgia,serif" font-size="26" font-weight="600" fill="${K}">Dr. Youssef Ajra</text>
      <text x="870" y="696" text-anchor="middle" font-family="IBM Plex Sans,Arial,sans-serif" font-size="11" letter-spacing="1" fill="${G}">Course Instructor · Beirut Arab University</text>
      <text x="96" y="676" font-family="IBM Plex Mono,monospace" font-size="11" letter-spacing="1.4" fill="${G}">DATE</text>
      <text x="96" y="698" font-family="Cormorant Garamond,Georgia,serif" font-size="21" fill="${K}">${esc(d.date)}</text>
      <text x="300" y="676" font-family="IBM Plex Mono,monospace" font-size="11" letter-spacing="1.4" fill="${G}">VERIFICATION CODE</text>
      <text x="300" y="698" font-family="IBM Plex Mono,monospace" font-size="15" fill="${K}">${esc(d.code)}</text>
      <g transform="translate(594 640)">
        <defs><path id="sealp" d="M -44 0 A 44 44 0 1 1 44 0 A 44 44 0 1 1 -44 0"/></defs>
        <circle r="56" fill="#fbf7ee" stroke="${A}" stroke-width="1.6"/><circle r="51" fill="none" stroke="${A}" stroke-width=".6"/><circle r="33" fill="none" stroke="${A}" stroke-width=".6"/>
        <text font-family="IBM Plex Mono,monospace" font-size="8.6" letter-spacing="2.2" fill="${A}"><textPath href="#sealp" startOffset="0">${esc(d.seal)}</textPath></text>
        <text y="-4" text-anchor="middle" font-family="Cormorant Garamond,Georgia,serif" font-size="17" font-weight="700" fill="${K}">BAU</text>
        <text y="12" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="8" letter-spacing="1" fill="${G}">${esc(C.VERSION)}</text>
      </g>
      <text x="${W / 2}" y="${H - 60}" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="9.5" letter-spacing="1.6" fill="${G}">${esc(d.footer)} · ${esc(C.VERSION)} · CREATED BY YOUSSEF AJRA</text>
    </svg>`;
  }

  root.UI = { esc, logoHTML, resolveLogo, plot, svgPlot, download, toast, certificateSVG, NAVY, GOLD, MUTED, INK };
})(window);
