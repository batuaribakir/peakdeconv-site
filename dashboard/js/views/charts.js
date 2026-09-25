/* F · Analytics charts */
(function (P) {
  "use strict";
  function $() { return P.$.apply(null, arguments); }
  var MID = P.MID;
  var NW = P.NW;
  var OWNERS = P.OWNERS;
  var OWNER_KEYS = P.OWNER_KEYS;
  var PKGS = P.PKGS;
  var PRES = P.PRES;
  var TASKS = P.TASKS;
  var TOTAL_TW = P.TOTAL_TW;
  function bindTip() { return P.bindTip.apply(null, arguments); }
  function derive() { return P.derive.apply(null, arguments); }
  function esc() { return P.esc.apply(null, arguments); }
  function pct() { return P.pct.apply(null, arguments); }
  function svgEl() { return P.svgEl.apply(null, arguments); }
  function weekTip() { return P.weekTip.apply(null, arguments); }

  /* ======================================================================
     F · ANALYTICS
     ====================================================================== */
  function hatchDefs(svg) {
    var defs = svgEl("defs", {}, svg);
    PKGS.forEach(function (p) {
      var pat = svgEl("pattern", { id: "h-" + svg.id + "-" + p.id, width: 5, height: 5, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs);
      svgEl("rect", { width: 5, height: 5, style: "fill:color-mix(in oklab, var(--" + p.id.toLowerCase() + ") 30%, white)" }, pat);
      svgEl("rect", { width: 2.2, height: 5, style: "fill:var(--" + p.id.toLowerCase() + ")" }, pat);
    });
    var own = svgEl("pattern", { id: "h-" + svg.id + "-shared", width: 5, height: 5, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs);
    svgEl("rect", { width: 5, height: 5, fill: "#ffffff" }, own);
    svgEl("rect", { width: 1.6, height: 5, style: "fill:color-mix(in oklab, var(--slate) 75%, white)" }, own);
  }
  function wpFill(p, part, svg) {
    var v = "var(--" + p.id.toLowerCase() + ")";
    if (part === "done") return "fill:" + v;
    if (part === "prog") return "fill:url(#h-" + svg.id + "-" + p.id + ")";
    return "fill:color-mix(in oklab, " + v + " 20%, white)";
  }
  var geoTransition = "y 520ms cubic-bezier(.22,.8,.24,1), height 520ms cubic-bezier(.22,.8,.24,1), x 520ms cubic-bezier(.22,.8,.24,1), width 520ms cubic-bezier(.22,.8,.24,1)";

  var chWeek = {};
  function buildWeekChart() {
    var svg = $("#ch-week"), VW = 640, VH = 470, m = { l: 34, r: 8, t: 14, b: 52 };
    var pw = VW - m.l - m.r, ph = VH - m.t - m.b;
    var maxT = Math.max.apply(null, derive().week.map(function (r) { return r.total; }));
    var yMax = Math.ceil(maxT / 2) * 2;
    var band = pw / NW, bw = Math.min(24, band * 0.58);
    function Y(v) { return m.t + ph - v / yMax * ph; }
    svg.innerHTML = ""; hatchDefs(svg);
    var g = svgEl("g", { class: "grid" }, svg);
    for (var v = 0; v <= yMax; v += 2) {
      if (v) svgEl("line", { x1: m.l, x2: m.l + pw, y1: Y(v), y2: Y(v) }, g);
      svgEl("text", { x: m.l - 8, y: Y(v) + 3.5, "text-anchor": "end" }, svg).textContent = v;
    }
    svgEl("rect", { x: m.l + (MID - 1) * band, y: m.t, width: band, height: ph, fill: "rgba(31,43,56,0.05)" }, svg);
    var midLbl = svgEl("text", { "text-anchor": "start", style: "font-size:9px;letter-spacing:.16em;fill:rgba(31,43,56,.6)" }, svg);
    midLbl.setAttribute("transform", "translate(" + (m.l + (MID - 0.5) * band + 3) + " " + (Y(0) - 8) + ") rotate(-90)");
    midLbl.textContent = "MIDTERM";
    svgEl("line", { class: "baseline", x1: m.l, x2: m.l + pw, y1: Y(0), y2: Y(0) }, svg);
    chWeek = { svg: svg, Y: Y, yMax: yMax, ph: ph, rects: [] };
    for (var w = 1; w <= NW; w++) {
      var cx = m.l + (w - 0.5) * band, x0 = cx - bw / 2;
      var col = svgEl("g", { class: "col" }, svg);
      svgEl("rect", { class: "col-hl", x: m.l + (w - 1) * band + 1, y: m.t, width: band - 2, height: ph, rx: 6 }, col);
      PKGS.forEach(function (p) {
        ["done", "prog", "todo"].forEach(function (part) {
          var r = svgEl("rect", { x: x0, width: bw, rx: 2.5, style: wpFill(p, part, svg) + ";transition:" + geoTransition }, col);
          r.style.y = Y(0) + "px"; r.style.height = "0px";
          chWeek.rects.push({ w: w, p: p, part: part, el: r });
        });
      });
      var isP = PRES.indexOf(w) >= 0;
      svgEl("text", { x: cx, y: Y(0) + 17, "text-anchor": "middle", class: isP ? "pres-tick" : "", style: w === MID ? "fill:var(--midterm);font-weight:600" : "" }, col).textContent = w;
      if (isP) svgEl("circle", { cx: cx, cy: Y(0) + 27, r: 2.4, fill: "var(--amber)" }, col);
      if (w === MID) svgEl("rect", { x: cx - 3, y: Y(0) + 24.5, width: 6, height: 5, rx: 1, fill: "var(--midterm)" }, col);
      var hit = svgEl("rect", { class: "hit", x: m.l + (w - 1) * band, y: m.t, width: band, height: ph + 34 }, col);
      (function (wk) { bindTip(hit, function () { return weekTip(wk); }); })(w);
    }
    svgEl("text", { x: m.l + pw, y: VH - 6, "text-anchor": "end", style: "font-size:9.5px" }, svg).textContent = "week";
    $("#ch-week-legend").innerHTML = PKGS.map(function (p) { return '<span data-wp="' + p.id + '"><i></i>' + p.id + " " + esc(p.short) + "</span>"; }).join("") +
      '<span style="margin-left:auto;color:var(--ink-3)">solid completed · hatched in progress · tint open</span>';
  }
  function updateWeekChart(d) {
    var stackAcc = {};
    chWeek.rects.forEach(function (r) {
      var c = d.week[r.w - 1].wp[r.p.id][r.part], acc = stackAcc[r.w] || 0;
      var gap = c ? 2 : 0;
      var y0 = chWeek.Y(acc + c), h = Math.max(0, (c / chWeek.yMax) * chWeek.ph - gap);
      r.el.style.y = y0 + "px"; r.el.style.height = h + "px";
      stackAcc[r.w] = acc + c;
    });
  }

  var chWp = {};
  function buildWpChart() {
    var svg = $("#ch-wp"), VW = 420, lab = 118, right = 74, rowH = 38, top = 8;
    var maxTW = Math.max.apply(null, PKGS.map(function (p) { return p.tw; }));
    var sc = (VW - lab - right) / maxTW;
    svg.innerHTML = ""; hatchDefs(svg);
    chWp = { svg: svg, rows: [] };
    PKGS.forEach(function (p, i) {
      var y = top + i * rowH, g = svgEl("g", { "data-wp": p.id }, svg);
      svgEl("text", { class: "lbl-strong", x: 0, y: y + 13 }, g).textContent = p.id;
      svgEl("text", { class: "lbl", x: 34, y: y + 13 }, g).textContent = p.short;
      var parts = {};
      ["done", "prog", "todo"].forEach(function (part) {
        var r = svgEl("rect", { y: y + 4, height: 13, rx: 2.5, style: wpFill(p, part, svg) + ";transition:" + geoTransition }, g);
        r.style.x = lab + "px"; r.style.width = "0px";
        parts[part] = r;
      });
      var val = svgEl("text", { class: "val", x: lab + p.tw * sc + 8, y: y + 14.5 }, g);
      svgEl("text", { class: "lbl", x: lab, y: y + 32, style: "font-size:10px;fill:var(--ink-3)" }, g).textContent = p.tw + " task-weeks · " + p.tasks.length + " tasks";
      var hit = svgEl("rect", { class: "hit", x: 0, y: y, width: VW, height: rowH - 2 }, g);
      bindTip(hit, function () {
        var x = derive().wp[p.id];
        return "<span class='tk'>" + p.id + " · " + esc(p.short) + "</span>" +
          "<span class='tr'><span>Completed</span><span>" + x.count.done + " tasks · " + x.tw.done + " tw</span></span>" +
          "<span class='tr'><span>In progress</span><span>" + x.count.prog + " tasks · " + x.tw.prog + " tw</span></span>" +
          "<span class='tr'><span>Not started</span><span>" + x.count.todo + " tasks · " + x.tw.todo + " tw</span></span>" +
          "<span class='tr' style='margin-top:4px'><b>Weighted</b><span>" + pct(x.pct) + "%</span></span>";
      });
      chWp.rows.push({ p: p, parts: parts, val: val, sc: sc, lab: lab });
    });
  }
  function updateWpChart(d) {
    chWp.rows.forEach(function (r) {
      var x = d.wp[r.p.id], cur = r.lab;
      ["done", "prog", "todo"].forEach(function (part) {
        var tw = x.tw[part], wdt = Math.max(0, tw * r.sc - (tw ? 2 : 0));
        r.parts[part].style.x = cur + "px"; r.parts[part].style.width = wdt + "px";
        cur += tw * r.sc;
      });
      r.val.textContent = pct(x.pct) + "%";
    });
  }

  var chOwn = {};
  function buildOwnerChart() {
    var svg = $("#ch-owner"), VW = 420, lab = 86, W0 = VW - lab - 6;
    svg.innerHTML = ""; hatchDefs(svg);
    var ownFill = { bme: "fill:var(--slate)", eee: "fill:color-mix(in oklab, var(--slate) 16%, white);stroke:color-mix(in oklab, var(--slate) 55%, white);stroke-width:1", shared: "fill:url(#h-ch-owner-shared);stroke:color-mix(in oklab, var(--slate) 55%, white);stroke-width:1" };
    var byTasks = {}, byTw = {};
    OWNER_KEYS.forEach(function (o) {
      byTasks[o] = TASKS.filter(function (t) { return t.owner === o; }).length;
      byTw[o] = TASKS.filter(function (t) { return t.owner === o; }).reduce(function (s, t) { return s + t.duration; }, 0);
    });
    [["Tasks", byTasks, TASKS.length, 6], ["Task-weeks", byTw, TOTAL_TW, 50]].forEach(function (row) {
      var y = row[3], cur = lab;
      svgEl("text", { class: "lbl", x: 0, y: y + 14 }, svg).textContent = row[0];
      OWNER_KEYS.forEach(function (o) {
        var w = row[1][o] / row[2] * W0;
        var r = svgEl("rect", { x: cur + 0.5, y: y + 2, width: Math.max(0, w - 2.5), height: 16, rx: 3, style: ownFill[o] }, svg);
        if (w > 26) svgEl("text", { x: cur + 7, y: y + 14, style: "font-family:var(--f-mono);font-size:10.5px;font-weight:600;" + (o === "bme" ? "fill:#fff" : "fill:var(--ink);paint-order:stroke;stroke:#fff;stroke-width:3px;stroke-linejoin:round") }, svg).textContent = row[1][o];
        bindTip(r, function () { return "<span class='tk'>" + row[0] + "</span><b>" + OWNERS[o].label + "</b> · " + row[1][o] + " of " + row[2] + " (" + pct(row[1][o] / row[2]) + "%)"; });
        cur += w;
      });
    });
    // per-owner completion rows
    chOwn = { svg: svg, rows: [] };
    OWNER_KEYS.forEach(function (o, i) {
      var y = 104 + i * 32;
      var sw = svgEl("rect", { x: 0, y: y + 2, width: 12, height: 10, rx: 2, style: ownFill[o] }, svg);
      svgEl("text", { class: "lbl", x: 18, y: y + 11 }, svg).textContent = OWNERS[o].label;
      svgEl("rect", { x: lab, y: y + 4, width: W0 - 64, height: 6, rx: 3, fill: "rgba(26,32,40,0.07)" }, svg);
      var bar = svgEl("rect", { x: lab, y: y + 4, height: 6, rx: 3, fill: "var(--st-done)", style: "transition:" + geoTransition }, svg);
      bar.style.width = "0px";
      var val = svgEl("text", { class: "val", x: VW - 2, y: y + 11, "text-anchor": "end" }, svg);
      chOwn.rows.push({ o: o, bar: bar, val: val, W: W0 - 64 });
    });
    svgEl("text", { class: "lbl", x: 0, y: 92, style: "font-size:10px;fill:var(--ink-3);letter-spacing:.06em" }, svg).textContent = "WEIGHTED COMPLETION BY LEAD";
  }
  function updateOwnerChart(d) {
    chOwn.rows.forEach(function (r) {
      var x = d.owner[r.o];
      r.bar.style.width = (x.pct * r.W) + "px";
      r.val.textContent = x.done + "/" + x.tasks + " · " + pct(x.pct) + "%";
    });
  }

  P.hatchDefs = hatchDefs;
  P.wpFill = wpFill;
  P.buildWeekChart = buildWeekChart;
  P.updateWeekChart = updateWeekChart;
  P.buildWpChart = buildWpChart;
  P.updateWpChart = updateWpChart;
  P.buildOwnerChart = buildOwnerChart;
  P.updateOwnerChart = updateOwnerChart;
})(window.PD = window.PD || {});
