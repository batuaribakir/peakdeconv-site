/* A · Hero — planned-activity trace + next milestones */
(function (P) {
  "use strict";
  function $() { return P.$.apply(null, arguments); }
  function $$() { return P.$$.apply(null, arguments); }
  var MID = P.MID;
  var NW = P.NW;
  var PKGS = P.PKGS;
  var PRES = P.PRES;
  function bindTip() { return P.bindTip.apply(null, arguments); }
  function derive() { return P.derive.apply(null, arguments); }
  function esc() { return P.esc.apply(null, arguments); }
  var reduceMotion = P.reduceMotion;
  function svgEl() { return P.svgEl.apply(null, arguments); }
  function weekKind() { return P.weekKind.apply(null, arguments); }

  /* ======================================================================
     A · HERO — planned activity trace resolved into WP components
     Each scheduled task-week contributes a unit-area Gaussian (σ = 0.5 wk)
     centred on its week, so a plateau reads as the number of active tasks.
     ====================================================================== */
  function renderTrace() {
    var svg = $("#trace");
    var VW = 560, VH = 300, m = { l: 30, r: 10, t: 26, b: 46 };
    var pw = VW - m.l - m.r, ph = VH - m.t - m.b;
    var SIG = 0.5, NORM = 1 / (SIG * Math.sqrt(2 * Math.PI));
    function comp(p, x) {
      var v = 0;
      p.tasks.forEach(function (t) { t.weeks.forEach(function (w) { var z = (x - w) / SIG; v += Math.exp(-0.5 * z * z); }); });
      return v * NORM;
    }
    var xs = []; for (var x = 0.5; x <= NW + 0.5 + 1e-9; x += 0.08) xs.push(+x.toFixed(2));
    var comps = PKGS.map(function (p) { return xs.map(function (x) { return comp(p, x); }); });
    var sum = xs.map(function (_, i) { return comps.reduce(function (s, c) { return s + c[i]; }, 0); });
    var counts = derive().week.map(function (r) { return r.total; });
    var yMax = Math.ceil(Math.max(Math.max.apply(null, sum), Math.max.apply(null, counts)) / 2) * 2;
    function X(v) { return m.l + (v - 0.5) / NW * pw; }
    function Y(v) { return m.t + ph - v / yMax * ph; }
    function path(arr, close) {
      var d = arr.map(function (v, i) { return (i ? "L" : "M") + X(xs[i]).toFixed(1) + " " + Y(v).toFixed(1); }).join("");
      return close ? d + "L" + X(xs[xs.length - 1]).toFixed(1) + " " + Y(0) + "L" + X(xs[0]).toFixed(1) + " " + Y(0) + "Z" : d;
    }
    svg.innerHTML = "";
    var g = svgEl("g", { class: "axis" }, svg);
    // midterm band + presentation guides
    svgEl("rect", { x: X(MID - 0.5), y: m.t, width: pw / NW, height: ph, fill: "rgba(31,43,56,0.06)" }, g);
    svgEl("text", { x: X(MID), y: m.t + 10, "text-anchor": "middle", style: "font-size:8.5px;letter-spacing:.14em;fill:rgba(31,43,56,.6)" }, g).textContent = "MIDTERM";
    for (var v = 0; v <= yMax; v += 2) {
      svgEl("line", { x1: m.l, x2: m.l + pw, y1: Y(v), y2: Y(v), stroke: v ? "rgba(26,32,40,0.06)" : "rgba(26,32,40,0.3)" }, g);
      svgEl("text", { x: m.l - 8, y: Y(v) + 3.5, "text-anchor": "end" }, g).textContent = v;
    }
    for (var w = 1; w <= NW; w++) {
      var isP = PRES.indexOf(w) >= 0;
      var tx = svgEl("text", { x: X(w), y: m.t + ph + 16, "text-anchor": "middle", style: isP ? "fill:var(--amber-ink);font-weight:600" : (w === MID ? "fill:var(--midterm);font-weight:600" : "") }, g);
      tx.textContent = w;
      if (isP) svgEl("circle", { cx: X(w), cy: m.t + ph + 26, r: 2.4, fill: "var(--amber)" }, g);
      if (w === MID) svgEl("rect", { x: X(w) - 3, y: m.t + ph + 23.5, width: 6, height: 5, rx: 1, fill: "var(--midterm)" }, g);
    }
    svgEl("text", { x: m.l + pw, y: m.t + ph + 40, "text-anchor": "end", style: "font-size:9px" }, g).textContent = "week";
    svgEl("text", { x: m.l - 8, y: m.t - 6, "text-anchor": "start", style: "font-size:9px" }, g).textContent = "active tasks";

    var cg = svgEl("g", {}, svg);
    PKGS.forEach(function (p, i) {
      svgEl("path", { class: "comp", "data-wp": p.id, d: path(comps[i], true), style: "fill:var(--wp);fill-opacity:.16" }, cg);
      svgEl("path", { class: "comp-line", "data-wp": p.id, d: path(comps[i], false), style: "stroke:var(--wp)" }, cg);
    });
    var sp = svgEl("path", { class: "sum", d: path(sum, false) }, svg);
    if (!reduceMotion.matches && sp.getTotalLength) {
      var L = sp.getTotalLength();
      sp.style.strokeDasharray = L; sp.style.strokeDashoffset = L;
      sp.getBoundingClientRect();
      sp.style.transition = "stroke-dashoffset 1600ms cubic-bezier(.22,.8,.24,1) 200ms";
      requestAnimationFrame(function () { sp.style.strokeDashoffset = 0; });
    }
    // hover crosshair
    var cross = svgEl("line", { y1: m.t, y2: m.t + ph, stroke: "rgba(26,32,40,.35)", "stroke-dasharray": "2 3", opacity: 0 }, svg);
    var dot = svgEl("circle", { r: 3.5, fill: "var(--ink)", stroke: "#fff", "stroke-width": 1.5, opacity: 0 }, svg);
    var hit = svgEl("rect", { x: m.l, y: m.t, width: pw, height: ph + 30, fill: "transparent" }, svg);
    function wkAt(evt) {
      var pt = svg.createSVGPoint(); pt.x = evt.clientX; pt.y = evt.clientY;
      var loc = pt.matrixTransform(svg.getScreenCTM().inverse());
      return Math.max(1, Math.min(NW, Math.round((loc.x - m.l) / pw * NW + 0.5)));
    }
    var hoverW = 1;
    hit.addEventListener("pointermove", function (e) {
      hoverW = wkAt(e);
      var i = Math.round((hoverW - 0.5) / 0.08);
      cross.setAttribute("x1", X(hoverW)); cross.setAttribute("x2", X(hoverW)); cross.setAttribute("opacity", 1);
      dot.setAttribute("cx", X(hoverW)); dot.setAttribute("cy", Y(sum[i] || 0)); dot.setAttribute("opacity", 1);
    });
    hit.addEventListener("pointerleave", function () { cross.setAttribute("opacity", 0); dot.setAttribute("opacity", 0); });
    bindTip(hit, function () { return weekTip(hoverW); });

    var lg = $("#trace-legend");
    lg.innerHTML = PKGS.map(function (p) {
      return '<button type="button" data-wp="' + p.id + '"><i></i>' + p.id + " · " + esc(p.short) + "</button>";
    }).join("");
    $$("button", lg).forEach(function (b) {
      function on() { svg.classList.add("focus"); $$('[data-wp="' + b.dataset.wp + '"]', svg).forEach(function (n) { n.classList.add("on"); }); }
      function off() { svg.classList.remove("focus"); $$(".on", svg).forEach(function (n) { n.classList.remove("on"); }); }
      b.addEventListener("mouseenter", on); b.addEventListener("focus", on);
      b.addEventListener("mouseleave", off); b.addEventListener("blur", off);
      b.addEventListener("click", function () { document.getElementById("packages").scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth" }); });
    });
  }

  function weekTip(w) {
    var d = derive(), row = d.week[w - 1], k = weekKind(w);
    var head = "Week " + w + (k === "presentation" ? " · Presentation" : k === "midterm" ? " · Midterm" : "");
    var lines = PKGS.filter(function (p) { return row.wp[p.id].n; }).map(function (p) {
      var c = row.wp[p.id];
      return '<span class="tr" data-wp="' + p.id + '"><span><i></i>' + p.id + " " + esc(p.short) + "</span><span>" + c.n + (c.done ? " · " + c.done + " done" : "") + "</span></span>";
    }).join("");
    return '<span class="tk">' + head + "</span>" + (lines || "No scheduled subtasks") +
      (row.total ? '<span class="tr" style="margin-top:4px;border-top:1px solid rgba(26,32,40,.1);padding-top:4px"><b>Active subtasks</b><span>' + row.total + "</span></span>" : "");
  }

  function renderNext(d) {
    var el = $("#next-card"), html = '<span class="nc-label">Next open milestones</span>';
    if (d.nextFixed) {
      var t = d.nextFixed, more = d.nextFixedSame.length - 1;
      html += '<span class="nc-week">Week ' + t.fixedWeek + '</span><span class="nc-what">Fixed delivery · <b>' + t.id + "</b> " + esc(t.name) + (more > 0 ? " <span>+" + more + " more</span>" : "") + "</span>";
    }
    if (d.nextWp) {
      html += '<span class="nc-week">Week ' + d.nextWp.finalWeek + '</span><span class="nc-what">◆ <b>' + d.nextWp.id + "</b> " + esc(d.nextWp.title) + " · planned final week</span>";
    }
    if (!d.nextFixed && !d.nextWp) html += '<span class="nc-week">—</span><span class="nc-what">Every task is marked completed.</span>';
    el.innerHTML = html;
  }

  P.renderTrace = renderTrace;
  P.weekTip = weekTip;
  P.renderNext = renderNext;
})(window.PD = window.PD || {});
