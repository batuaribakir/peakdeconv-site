/* G · Milestones track + agenda */
(function (P) {
  "use strict";
  function $() { return P.$.apply(null, arguments); }
  function $$() { return P.$$.apply(null, arguments); }
  var I = P.I;
  var MID = P.MID;
  var PKG = P.PKG;
  var PKGS = P.PKGS;
  var PRES = P.PRES;
  function S() { return P.S.apply(null, arguments); }
  var STATUS = P.STATUS;
  var TASKS = P.TASKS;
  var WEEKS = P.WEEKS;
  function bindTip() { return P.bindTip.apply(null, arguments); }
  function derive() { return P.derive.apply(null, arguments); }
  function esc() { return P.esc.apply(null, arguments); }
  function openDrawer() { return P.openDrawer.apply(null, arguments); }
  function openWp() { return P.openWp.apply(null, arguments); }

  /* ======================================================================
     G · MILESTONES
     ====================================================================== */
  function renderMilestones() {
    var el = $("#ms-track"), html = '<div class="ms-weeks"><div class="ms-wk" style="text-align:left">Week</div>' +
      WEEKS.map(function (w) { return '<div class="ms-wk ' + (w.kind === "presentation" ? "p" : w.kind === "midterm" ? "m" : "") + '">' + w.week + "</div>"; }).join("") + "</div>";
    function lane(label, sw, cellFn) {
      html += '<div class="ms-lane-label">' + sw + label + "</div>";
      WEEKS.forEach(function (w) { html += '<div class="ms-cell ' + (w.kind === "midterm" ? "m-bg" : "") + '">' + (cellFn(w.week) || "") + "</div>"; });
    }
    var pn = 0;
    lane("Presentations", '<span class="sw sw-pres"></span>', function (w) {
      if (PRES.indexOf(w) < 0) return "";
      pn++;
      return '<button type="button" class="ms-pres" data-tip="' + esc("<span class='tk'>Presentation " + pn + " of " + PRES.length + "</span>Week " + w) + '" aria-label="Presentation ' + pn + ", week " + w + '">P' + pn + "</button>";
    });
    lane("Midterm", '<span class="sw sw-mid"></span>', function (w) {
      return w === MID ? '<button type="button" class="ms-mid" data-tip="' + esc("<span class='tk'>Midterm</span>Week " + MID + " — no task work is scheduled this week") + '" aria-label="Midterm, week ' + MID + '">Mid</button>' : "";
    });
    lane("Package final ◆", '<span class="sw sw-diamond"></span>', function (w) {
      var ps = PKGS.filter(function (p) { return p.finalWeek === w; });
      if (!ps.length) return "";
      return '<div class="ms-dias">' + ps.map(function (p) {
        return '<div class="row" data-wp="' + p.id + '"><button type="button" class="ms-dia" data-final="' + p.id + '" data-mstip="' + p.id + '" aria-label="' + p.id + " planned final week, week " + w + '"></button><span class="ms-dia-lbl">' + p.id + "</span></div>";
      }).join("") + "</div>";
    });
    lane("Fixed deliveries", '<span class="sw sw-lock" style="display:inline-grid;place-items:center;background:var(--ink);color:#fff;border-radius:4px;width:16px;height:16px">' + I.lock.replace("<svg", '<svg style="width:10px;height:10px"') + "</span>", function (w) {
      var ts = TASKS.filter(function (t) { return t.fixedWeek === w; });
      if (!ts.length) return "";
      return '<button type="button" class="ms-lock" data-fxweek="' + w + '" aria-label="' + ts.length + " fixed deliveries in week " + w + '">' + I.lock + '<span data-fxc="' + w + '">' + ts.length + '</span></button><div class="ms-lockbar"><span data-fxb="' + w + '"></span></div>';
    });
    el.innerHTML = html;
    $$("[data-mstip]", el).forEach(function (b) {
      var p = PKG[b.dataset.mstip];
      bindTip(b, function () { var x = derive().wp[p.id]; return "<span class='tk'>◆ Planned final week · Week " + p.finalWeek + "</span><b>" + p.id + "</b> " + esc(p.title) + "<br>" + x.count.done + "/" + p.tasks.length + " tasks completed"; });
    });
    $$("[data-fxweek]", el).forEach(function (b) {
      var w = +b.dataset.fxweek;
      bindTip(b, function () {
        return "<span class='tk'>Fixed deliveries · Week " + w + "</span>" + TASKS.filter(function (t) { return t.fixedWeek === w; }).map(function (t) {
          return "<span class='tr'><span>" + t.id + " " + esc(t.name.length > 34 ? t.name.slice(0, 33) + "…" : t.name) + "</span><span>" + STATUS[S(t.id)].label + "</span></span>";
        }).join("");
      });
    });
    el.addEventListener("click", function (e) {
      var dm = e.target.closest("[data-final]"); if (dm) { openWp(dm.dataset.final, dm); return; }
      var lk = e.target.closest("[data-fxweek]");
      if (lk) {
        var ts = TASKS.filter(function (t) { return t.fixedWeek === +lk.dataset.fxweek; });
        var t = ts.filter(function (t) { return S(t.id) !== "done"; })[0] || ts[0];
        openDrawer(t.id, lk);
      }
    });
    $("#agenda").addEventListener("click", function (e) {
      var b = e.target.closest("[data-open]"); if (b) openDrawer(b.dataset.open, b);
      var f = e.target.closest("[data-openwp]"); if (f) openWp(f.dataset.openwp, f);
    });
  }
  function updateMilestones(d) {
    var weeksFx = {};
    TASKS.forEach(function (t) { var x = weeksFx[t.fixedWeek] = weeksFx[t.fixedWeek] || { n: 0, done: 0 }; x.n++; if (S(t.id) === "done") x.done++; });
    Object.keys(weeksFx).forEach(function (w) {
      var x = weeksFx[w];
      var b = $('[data-fxb="' + w + '"]'); if (b) b.style.width = (x.done / x.n * 100) + "%";
      var btn = $('[data-fxweek="' + w + '"]'); if (btn) btn.classList.toggle("all-done", x.done === x.n);
    });
    // agenda
    var pn = 0;
    var cal = WEEKS.filter(function (w) { return w.kind !== "work"; }).map(function (w) {
      var isP = w.kind === "presentation"; if (isP) pn++;
      return '<li><span class="w">Week ' + w.week + '</span><span class="x">' + (isP ? "Presentation " + pn : "Midterm") + '</span><span class="s">' + (isP ? '<span class="sw sw-pres" style="display:inline-block;vertical-align:-1px"></span>' : '<span class="sw sw-mid" style="display:inline-block;vertical-align:-2px"></span>') + "</span></li>";
    }).join("");
    var fin = PKGS.slice().sort(function (a, b) { return a.finalWeek - b.finalWeek; }).map(function (p) {
      var x = d.wp[p.id];
      return '<li data-wp="' + p.id + '"><span class="w">Week ' + p.finalWeek + '</span><button type="button" class="x" data-openwp="' + p.id + '"><b style="color:var(--wp-ink)">◆ ' + p.id + "</b> " + esc(p.short) + '</button><span class="s ' + (x.complete ? "done" : "") + '">' + (x.complete ? "Complete" : x.count.done + "/" + x.tasks) + "</span></li>";
    }).join("");
    var fxWeeks = Object.keys(weeksFx).map(Number).sort(function (a, b) { return a - b; });
    var fx = fxWeeks.map(function (w) {
      var ts = TASKS.filter(function (t) { return t.fixedWeek === w; });
      return '<li><span class="w">Week ' + w + '</span><span class="x">' + ts.map(function (t) {
        var s = S(t.id);
        return '<button type="button" class="x" data-open="' + t.id + '" data-wp="' + t.wp + '" style="margin-right:10px;color:var(--wp-ink);font-family:var(--f-mono);font-size:.76rem;' + (s === "done" ? "text-decoration:line-through;opacity:.6" : "") + '" aria-label="' + t.id + " " + esc(t.name) + ", " + STATUS[s].label + '">' + t.id + "</button>";
      }).join("") + '</span><span class="s ' + (weeksFx[w].done === weeksFx[w].n ? "done" : "") + '">' + weeksFx[w].done + "/" + weeksFx[w].n + "</span></li>";
    }).join("");
    $("#agenda").innerHTML =
      '<div class="ag-col"><div class="ag-title">Presentations &amp; midterm</div><ul class="ag-list">' + cal + "</ul></div>" +
      '<div class="ag-col"><div class="ag-title">Package final weeks</div><ul class="ag-list">' + fin + "</ul></div>" +
      '<div class="ag-col"><div class="ag-title">Fixed task deliveries</div><ul class="ag-list">' + fx + "</ul></div>";
  }

  P.renderMilestones = renderMilestones;
  P.updateMilestones = updateMilestones;
})(window.PD = window.PD || {});
