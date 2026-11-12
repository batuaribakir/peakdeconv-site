/* ==========================================================================
   Try MAVIS — the curve and its explanation map (own SVG, no library)

   One figure, two layers sharing the potential axis, as on the MAVIS screens
   of the presentations:
     Curve        the prepared curve the model reads (or the raw current with
                  its blank); the selected scan in teal, the other scans of
                  the sample lighter; the analyte's own peak window (PVDF) as
                  a dashed box; while a region is hovered, that region is
                  shaded and, for occlusion, the curve with the region removed
                  is drawn dashed
     Explanation  one cell per region (40 mV zones or peak windows), coloured
                  by its value: teal supports the call / raises the value,
                  berry argues against / lowers it, grey near zero
   Hovering a cell or the curve shows the region, its value and standard
   error. Text uses the ink colours; colour never carries meaning alone.
   ========================================================================== */

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
export const nf1 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
/** nM for display: whole numbers from 10 nM up, one decimal below. */
export const fmtNM = (v) => (v === 0 ? "0" : Math.abs(v) < 10 ? nf1.format(v) : nf0.format(v));
/** A signed value with a sensible number of digits. */
export const fmtSigned = (v, unit) => {
  const a = Math.abs(v);
  const s = unit === "nM" ? (a >= 10 ? nf0.format(a) : nf1.format(a)) : a >= 100 ? a.toFixed(0) : a >= 10 ? a.toFixed(1) : a.toFixed(2);
  return `${v < 0 ? "−" : "+"}${s}${unit === "nM" ? " nM" : ""}`;
};
const mv = (v) => Math.round(v * 1000);

/* ---------- tooltip (one element for the page) ------------------------------ */
let tipEl = null;
export function initTips(el) {
  tipEl = el;
  document.addEventListener("pointerover", (e) => {
    const t = e.target.closest && e.target.closest("[data-tip]");
    if (t) showTip(t.getAttribute("data-tip"), e.clientX, e.clientY);
  });
  document.addEventListener("pointermove", (e) => {
    const t = e.target.closest && e.target.closest("[data-tip]");
    if (t) placeTip(e.clientX, e.clientY);
  });
  document.addEventListener("pointerout", (e) => {
    const t = e.target.closest && e.target.closest("[data-tip]");
    if (t && !t.contains(e.relatedTarget)) hideTip();
  });
  window.addEventListener("scroll", hideTip, { passive: true });
}
export function showTip(text, x, y) {
  if (!tipEl) return;
  tipEl.innerHTML = String(text).split("\n").map((line, i) => (i === 0 ? `<b>${esc(line)}</b>` : esc(line))).join("<br>");
  tipEl.hidden = false;
  placeTip(x, y);
}
export function hideTip() { if (tipEl) tipEl.hidden = true; }
function placeTip(x, y) {
  if (!tipEl || tipEl.hidden) return;
  const r = tipEl.getBoundingClientRect();
  let left = x + 14, top = y + 14;
  if (left + r.width > window.innerWidth - 8) left = x - r.width - 14;
  if (top + r.height > window.innerHeight - 8) top = y - r.height - 14;
  tipEl.style.left = `${Math.max(8, left)}px`;
  tipEl.style.top = `${Math.max(8, top)}px`;
}

/* ---------- colour of a value --------------------------------------------------- */
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const NEUTRAL = hex("#efede8"), POS = hex("#0b7d6f"), NEG = hex("#c2416f");
export function valueColour(v, vmax) {
  if (!(vmax > 0) || !Number.isFinite(v)) return "rgb(239,237,232)";
  const t = Math.min(1, Math.abs(v) / vmax);
  const pole = v >= 0 ? POS : NEG;
  const c = NEUTRAL.map((n, i) => Math.round(n + (pole[i] - n) * Math.pow(t, 0.85)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/* ---------- the figure ------------------------------------------------------------ */

function niceStep(range, target) {
  const raw = range / Math.max(1, target);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  return (n > 5 ? 10 : n > 2 ? 5 : n > 1 ? 2 : 1) * mag;
}
function ticks(lo, hi, target) {
  const step = niceStep(hi - lo, target);
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return { step, values: out };
}
const fmtTick = (v, step) => v.toFixed(Math.min(Math.max(0, -Math.floor(Math.log10(step) + 1e-9)), 4));

/**
 * Draws the figure into `box` and returns a handle with setOverlay(y | null).
 * opts: {x, curves: [{y, kind: "sel" | "other" | "blank", name}], yTitle, unit,
 *        window: {E_lo, E_hi, label} | null,
 *        strip: {segments, values | null, se | null, unit, pos, neg, status} | null,
 *        onHover(index | -1)}
 */
export function drawExplain(box, opts) {
  const width = Math.max(300, Math.round(box.clientWidth || 700));
  const narrow = width < 560;
  const curveH = narrow ? 220 : Math.round(Math.min(460, Math.max(280, width * 0.4)));
  const stripH = opts.strip ? (narrow ? 30 : 36) : 0;
  const gap = opts.strip ? 12 : 0;
  const labW = narrow ? 0 : 96;     // the "Curve" / "Explanation" labels, as on the MAVIS screens
  const x0 = opts.x[0] - 0.002, x1 = opts.x[opts.x.length - 1] + 0.002;
  const from = 0.05;  // y range from 0.05 V: the scan-start transient would flatten the rest
  let lo = Infinity, hi = -Infinity;
  opts.curves.forEach((c) => c.y.forEach((v, i) => { if (opts.x[i] >= from && Number.isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }));
  if (!(hi > lo)) { lo = -1; hi = 1; }
  const pad = (hi - lo) * 0.08;
  lo -= pad; hi += pad;
  const yt = ticks(lo, hi, 4);
  const longest = Math.max(...yt.values.map((v) => fmtTick(v, yt.step).length));
  // y title on the first line, the peak-window label on the second, so the two never overlap
  const m = { l: labW + 10 + longest * 6.8, r: 14, t: opts.window ? 42 : 22, b: 40 };
  const w = width - m.l - m.r;
  const height = m.t + curveH + gap + stripH + m.b;
  const xs = (v) => m.l + ((v - x0) / (x1 - x0)) * w;
  const ys = (v) => m.t + (1 - (v - lo) / (hi - lo)) * curveH;
  const stripY = m.t + curveH + gap;
  const clip = `c${Math.random().toString(36).slice(2, 8)}`;

  const path = (y) => {
    let d = "";
    for (let i = 0; i < opts.x.length; i++) d += `${i ? "L" : "M"}${xs(opts.x[i]).toFixed(1)} ${ys(y[i]).toFixed(1)}`;
    return d;
  };
  const style = { sel: ["#0a7d74", 2.2, 1], other: ["#0a7d74", 1.4, 0.28], blank: ["#7d8791", 1.8, 1] };
  const lines = ["blank", "other", "sel"].flatMap((k) => opts.curves.filter((c) => c.kind === k).map((c) =>
    `<path d="${path(c.y)}" fill="none" stroke="${style[k][0]}" stroke-opacity="${style[k][2]}" stroke-width="${style[k][1]}" stroke-linejoin="round" stroke-linecap="round" clip-path="url(#${clip})"/>`)).join("");
  const grid = yt.values.map((v) => `<line x1="${m.l}" x2="${m.l + w}" y1="${ys(v).toFixed(1)}" y2="${ys(v).toFixed(1)}" stroke="rgba(26,32,40,.08)"/>
      <text x="${m.l - 8}" y="${(ys(v) + 4).toFixed(1)}" text-anchor="end">${fmtTick(v, yt.step)}</text>`).join("");
  const axisY = stripY + stripH + 8;
  const xt = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8].filter((v, i) => !narrow || i % 2 === 0);
  const xaxis = `<line x1="${m.l}" x2="${m.l + w}" y1="${axisY}" y2="${axisY}" stroke="rgba(26,32,40,.25)"/>` +
    xt.map((v) => `<line x1="${xs(v).toFixed(1)}" x2="${xs(v).toFixed(1)}" y1="${axisY}" y2="${axisY + 5}" stroke="rgba(26,32,40,.35)"/>
      <text class="mono" x="${xs(v).toFixed(1)}" y="${axisY + 19}" text-anchor="middle">${v.toFixed(1)} V</text>`).join("");

  let win = "";
  if (opts.window) {
    const a = xs(opts.window.E_lo), b = xs(opts.window.E_hi);
    win = `<rect x="${a.toFixed(1)}" y="${m.t}" width="${(b - a).toFixed(1)}" height="${curveH}" fill="rgba(11,125,111,.05)" stroke="rgba(11,125,111,.55)" stroke-dasharray="5 4" rx="3"/>
      <text class="win-label" x="${((a + b) / 2).toFixed(1)}" y="${m.t - 9}" text-anchor="middle">${esc(opts.window.label)}</text>`;
  }

  let strip = "";
  const st = opts.strip;
  if (st) {
    const vals = st.values;
    const vmax = vals ? Math.max(...Array.from(vals, Math.abs)) : 0;
    strip = st.segments.map((s, i) => {
      const a = xs(s.E_lo) + 1, b = xs(s.E_hi) - 1;
      const fill = vals ? valueColour(vals[i], vmax) : "rgb(239,237,232)";
      return `<rect class="cell" data-i="${i}" x="${a.toFixed(1)}" y="${stripY}" width="${Math.max(1, b - a).toFixed(1)}" height="${stripH}" rx="4" fill="${fill}"/>`;
    }).join("");
  }
  const labels = labW ? `<text class="lab" x="0" y="${(m.t + curveH / 2 + 4).toFixed(1)}">Curve</text>` +
    (st ? `<text class="lab" x="0" y="${(stripY + stripH / 2 + 4).toFixed(1)}">Explanation</text>` : "") : "";

  box.innerHTML = `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${esc(opts.label || "Voltammogram and explanation map")}">
    <defs><clipPath id="${clip}"><rect x="${m.l}" y="${m.t}" width="${w}" height="${curveH}"/></clipPath></defs>
    ${labels}
    <text x="${m.l}" y="11" style="font-size:11px">${esc(opts.yTitle)}</text>
    ${grid}${win}
    <rect class="band" x="0" y="${m.t}" width="0" height="${curveH}" fill="rgba(26,32,40,.06)" visibility="hidden"/>
    ${lines}
    <path class="overlay" d="" fill="none" stroke="#1a2028" stroke-width="1.6" stroke-dasharray="5 4" clip-path="url(#${clip})" visibility="hidden"/>
    ${strip}
    <rect class="cell-ring" x="0" y="${stripY - 2}" width="0" height="${stripH + 4}" rx="5" fill="none" stroke="#1a2028" stroke-width="2" visibility="hidden"/>
    ${xaxis}
    <rect class="hit" x="${m.l}" y="${m.t}" width="${w}" height="${axisY - m.t}" fill="transparent"/>
  </svg>`;

  const svg = box.querySelector("svg");
  const band = svg.querySelector(".band"), ring = svg.querySelector(".cell-ring"), over = svg.querySelector(".overlay");
  let current = -1;
  const segAt = (E) => (st ? st.segments.findIndex((s) => E >= s.E_lo && E < s.E_hi) : -1);
  const hover = (i, e) => {
    if (i < 0) {
      band.setAttribute("visibility", "hidden"); ring.setAttribute("visibility", "hidden"); over.setAttribute("visibility", "hidden");
      hideTip();
      if (current !== -1 && opts.onHover) opts.onHover(-1);
      current = -1;
      return;
    }
    const s = st.segments[i];
    const a = xs(s.E_lo), b = xs(s.E_hi);
    band.setAttribute("x", a); band.setAttribute("width", Math.max(1, b - a)); band.setAttribute("visibility", "visible");
    ring.setAttribute("x", a); ring.setAttribute("width", Math.max(1, b - a)); ring.setAttribute("visibility", "visible");
    const lines2 = [`${s.name || s.label} · ${mv(s.E_lo)}–${mv(s.E_hi)} mV`];
    if (st.values) {
      const v = st.values[i];
      lines2.push(`${fmtSigned(v, st.unit)}${st.se ? `  (± ${fmtSigned(st.se[i], st.unit).slice(1)})` : ""}`);
      lines2.push(v >= 0 ? st.pos : st.neg);
    } else if (st.status) lines2.push(st.status);
    showTip(lines2.join("\n"), e.clientX, e.clientY);
    if (i !== current) { current = i; if (opts.onHover) opts.onHover(i); }
  };
  svg.querySelector(".hit").addEventListener("pointermove", (e) => {
    const r = svg.getBoundingClientRect();
    const px = (e.clientX - r.left) * (width / r.width);
    const E = x0 + ((px - m.l) / w) * (x1 - x0);
    hover(segAt(E), e);
  });
  svg.querySelector(".hit").addEventListener("pointerleave", (e) => hover(-1, e));
  return {
    setOverlay(y) {
      if (!y) { over.setAttribute("visibility", "hidden"); return; }
      over.setAttribute("d", path(y));
      over.setAttribute("visibility", "visible");
    },
  };
}
