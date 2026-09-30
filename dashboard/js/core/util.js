/* DOM / SVG helpers, number tween, icon set, shared markup */
(function (P) {
  "use strict";
  var OWNERS = P.OWNERS;
  function S() { return P.S.apply(null, arguments); }
  var STATUS = P.STATUS;
  var S_KEYS = P.S_KEYS;

  /* ---------- helpers ------------------------------------------------------ */
  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function pct(x) { return Math.round(x * 100); }
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var SVGNS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs, parent) {
    var el = document.createElementNS(SVGNS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(el);
    return el;
  }
  function tween(el, to, fmt) {
    fmt = fmt || function (v) { return String(Math.round(v)); };
    var from = el.__v == null ? to : el.__v;
    el.__v = to;
    if (reduceMotion.matches || from === to) { el.textContent = fmt(to); return; }
    var t0 = performance.now(), dur = 520;
    cancelAnimationFrame(el.__raf);
    (function tick(t) {
      var k = Math.min(1, (t - t0) / dur); k = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(from + (to - from) * k);
      if (k < 1) el.__raf = requestAnimationFrame(tick);
    })(t0);
  }
  function weeksText(t) { return t.weeksLabel.replace(/Weeks? /g, "").replace(/–/g, "–"); }

  /* ---------- icons (one stroke family, 16px grid) ------------------------ */
  var I = {
    lock: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.6" fill="currentColor"/><path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    unlock: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.6" fill="currentColor"/><path d="M5.5 7V5.2a2.5 2.5 0 0 1 4.8-1" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    close: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    check: '<svg class="bar-check" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.3l2.3 2.3 4.7-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    reset: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8a5 5 0 1 0 1.6-3.7M3 2.5v2.8h2.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    kDone: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5.2 8.2l1.9 1.9 3.8-4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    kProg: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 1.8a6.2 6.2 0 0 1 0 12.4z" fill="currentColor"/></svg>',
    kOpen: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="2.2 2.2"/></svg>',
    kLayers: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2l6 3.2-6 3.2-6-3.2z M2 8.2l6 3.2 6-3.2 M2 11l6 3.2 6-3.2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
    kCal: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.2" y="3.2" width="11.6" height="10.6" rx="1.8" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M2.2 6.6h11.6M5.4 1.8v2.6M10.6 1.8v2.6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
    kPres: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2.6" width="12" height="8" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M8 10.6v2.6M5.4 14h5.2M5 7.8l2-2 1.6 1.4L11 5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  function glyph(s) {
    var inner = '<circle class="sg-ring" cx="7" cy="7" r="5.75"/>';
    if (s === "prog") inner += '<path class="sg-half" d="M7 1.25a5.75 5.75 0 0 1 0 11.5z"/>';
    if (s === "done") inner += '<path class="sg-check" d="M4.3 7.2l1.8 1.8 3.6-3.8"/>';
    return '<svg class="status-glyph" data-s="' + s + '" viewBox="0 0 14 14" aria-hidden="true">' + inner + "</svg>";
  }
  function segIcon(s) {
    if (s === "todo") return '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
    if (s === "prog") return '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 2.4a5.6 5.6 0 0 1 0 11.2z" fill="currentColor"/></svg>';
    return '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.3" fill="currentColor"/><path d="M5.2 8.2l1.9 1.9 3.8-4" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  var OWNER_SHORT = { bme: "BME", eee: "EEE", shared: "BME + EEE" };
  function ownerChip(o, extra) {
    return '<span class="owner-chip ' + (extra || "") + '" data-owner="' + o + '"><span class="sw sw-' + o + '"></span>' + esc(OWNER_SHORT[o]) + "</span>";
  }
  // One toggle for a task's delivery week, used by the Gantt, the table and the drawer.
  function lockLabel(t, locked) { return (locked ? "Unlock" : "Lock") + " delivery week, " + t.id + ", week " + t.fixedWeek; }
  function lockTip(locked) { return locked ? "Locked" : "Unlocked"; }
  function syncLock(el, t) {
    var on = P.isLocked(t.id);
    el.classList.toggle("is-locked", on);
    el.setAttribute("aria-pressed", String(on));
    el.setAttribute("aria-label", lockLabel(t, on));
    if (el.hasAttribute("data-tip")) el.setAttribute("data-tip", lockTip(on));
    var ic = el.querySelector("svg.lock-ic");
    if (ic) ic.outerHTML = (on ? I.lock : I.unlock).replace("<svg", '<svg class="lock-ic"');
  }
  function segControl(t) {
    return '<div class="seg" role="group" aria-label="Status of ' + esc(t.id) + '">' + S_KEYS.map(function (s) {
      return '<button type="button" data-set="' + s + '" data-id="' + t.id + '" data-s="' + s + '" aria-pressed="' + (S(t.id) === s) + '" aria-label="' + STATUS[s].label + '" data-tip="' + STATUS[s].label + '">' + segIcon(s) + "</button>";
    }).join("") + "</div>";
  }

  P.$ = $;
  P.$$ = $$;
  P.esc = esc;
  P.pct = pct;
  P.svgEl = svgEl;
  P.tween = tween;
  P.weeksText = weeksText;
  P.glyph = glyph;
  P.segIcon = segIcon;
  P.ownerChip = ownerChip;
  P.segControl = segControl;
  P.syncLock = syncLock;
  P.reduceMotion = reduceMotion;
  P.SVGNS = SVGNS;
  P.I = I;
  P.OWNER_SHORT = OWNER_SHORT;
})(window.PD = window.PD || {});
