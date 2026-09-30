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
  function isLocked() { return P.isLocked.apply(null, arguments); }
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
      return '<button type="button" class="ms-pres" data-tip="' + esc("<span class='tk'>Presentation " + pn + "</span>Week " + w) + '" aria-label="Presentation ' + pn + ", week " + w + '">P' + pn + "</button>";
    });
    lane("Midterm", '<span class="sw sw-mid"></span>', function (w) {
      return w === MID ? '<button type="button" class="ms-mid" data-tip="' + esc("<span class='tk'>Midterm</span>Week " + MID) + '" aria-label="Midterm, week ' + MID + '">Mid</button>' : "";
    });
    lane("Final week", '<span class="sw sw-diamond"></span>', function (w) {
      var ps = PKGS.filter(function (p) { return p.finalWeek === w; });
      if (!ps.length) return "";
      return '<div class="ms-dias">' + ps.map(function (p) {
        return '<div class="row" data-wp="' + p.id + '"><button type="button" class="ms-dia" data-final="' + p.id + '" data-mstip="' + p.id + '" aria-label="' + p.id + " planned final week, week " + w + '"></button><span class="ms-dia-lbl">' + p.id + "</span></div>";
      }).join("") + "</div>";
    });
    lane("Locked", '<span class="sw-lock is-locked">' + I.lock + "</span>", function (w) {
      var ts = TASKS.filter(function (t) { return t.fixedWeek === w; });
      if (!ts.length) return "";
      return '<button type="button" class="ms-lock" data-fxweek="' + w + '" aria-label="Locked deliveries in week ' + w + '">' + I.lock + '<span data-fxc="' + w + '">' + ts.length + '</span></button><div class="ms-lockbar"><span data-fxb="' + w + '"></span></div>';
    });
    el.innerHTML = html;
    $$("[data-mstip]", el).forEach(function (b) {
      var p = PKG[b.dataset.mstip];
      bindTip(b, function () { var x = derive().wp[p.id]; return "<span class='tk'>Week " + p.finalWeek + "</span><b>" + p.id + "</b> " + esc(p.title) + "<br>" + x.count.done + "/" + p.tasks.length + " done"; });
    });
    $$("[data-fxweek]", el).forEach(function (b) {
      var w = +b.dataset.fxweek;
      bindTip(b, function () {
        return "<span class='tk'>Week " + w + "</span>" + TASKS.filter(function (t) { return t.fixedWeek === w && isLocked(t.id); }).map(function (t) {
          return "<span class='tr'><span>" + t.id + " " + esc(t.name.length > 34 ? t.name.slice(0, 33) + "…" : t.name) + "</span><span>" + STATUS[S(t.id)].label + "</span></span>";
        }).join("");
      });
    });
    el.addEventListener("click", function (e) {
      var dm = e.target.closest("[data-final]"); if (dm) { openWp(dm.dataset.final, dm); return; }
      var lk = e.target.closest("[data-fxweek]");
      if (lk) {
        var ts = TASKS.filter(function (t) { return t.fixedWeek === +lk.dataset.fxweek && isLocked(t.id); });
        if (!ts.length) return;
        var t = ts.filter(function (t) { return S(t.id) !== "done"; })[0] || ts[0];
        openDrawer(t.id, lk);
      }
    });
  }
  function updateMilestones() {
    // the lane counts only locked deliveries; a week with none shows nothing
    var weeksFx = {};
    TASKS.forEach(function (t) {
      var x = weeksFx[t.fixedWeek] = weeksFx[t.fixedWeek] || { n: 0, done: 0 };
      if (!isLocked(t.id)) return;
      x.n++; if (S(t.id) === "done") x.done++;
    });
    Object.keys(weeksFx).forEach(function (w) {
      var x = weeksFx[w];
      var b = $('[data-fxb="' + w + '"]'), btn = $('[data-fxweek="' + w + '"]');
      if (btn) { btn.hidden = !x.n; btn.classList.toggle("all-done", x.n > 0 && x.done === x.n); $('[data-fxc="' + w + '"]').textContent = x.n; }
      if (b) { b.parentNode.hidden = !x.n; b.style.width = (x.n ? x.done / x.n * 100 : 0) + "%"; }
    });
  }

  P.renderMilestones = renderMilestones;
  P.updateMilestones = updateMilestones;
})(window.PD = window.PD || {});
