/* B · Project health KPIs */
(function (P) {
  "use strict";
  function $() { return P.$.apply(null, arguments); }
  var I = P.I;
  var MID = P.MID;
  var NW = P.NW;
  var PKGS = P.PKGS;
  var PRES = P.PRES;
  var TASKS = P.TASKS;
  var TOTAL_TW = P.TOTAL_TW;
  var WEEKS = P.WEEKS;
  function pct() { return P.pct.apply(null, arguments); }
  function tween() { return P.tween.apply(null, arguments); }

  /* ======================================================================
     B · KPIs
     ====================================================================== */
  function renderKpisShell() {
    var k = $("#kpis");
    k.innerHTML = [
      ["done", I.kDone, "Completed tasks", '<span id="k-done">0</span><small>/ ' + TASKS.length + "</small>", '<span id="k-done-sub"></span>'],
      ["prog", I.kProg, "In progress", '<span id="k-prog">0</span>', "counted at half weight"],
      ["open", I.kOpen, "Remaining", '<span id="k-open">0</span>', '<span id="k-open-sub"></span>'],
      ["wp", I.kLayers, "Work packages", String(PKGS.length), '<span id="k-wp-sub"></span>'],
      ["weeks", I.kCal, "Project weeks", String(NW), "midterm in week " + MID + '<div class="kpi-weeks">' + WEEKS.map(function (w) { return '<i class="' + (w.kind === "presentation" ? "p" : w.kind === "midterm" ? "m" : "") + '"></i>'; }).join("") + "</div>"],
      ["pres", I.kPres, "Presentations", String(PRES.length), "weeks " + PRES.join(", ")]
    ].map(function (r) {
      return '<div class="kpi" data-k="' + r[0] + '"><div class="kpi-label">' + r[1] + r[2] + '</div><div class="kpi-val">' + r[3] + '</div><div class="kpi-sub">' + r[4] + "</div></div>";
    }).join("");
    $("#kpi-tw").textContent = TOTAL_TW;
  }
  function renderKpis(d) {
    tween($("#kpi-weighted"), pct(d.weighted));
    tween($("#hf-weighted"), pct(d.weighted));
    tween($("#hf-done"), d.count.done);
    $("#hf-total").textContent = "/ " + TASKS.length;
    $("#hf-wps").textContent = PKGS.length;
    $("#hf-weeks").textContent = NW;
    tween($("#k-done"), d.count.done);
    $("#k-done-sub").textContent = "task completion " + pct(d.taskCompletion) + "%";
    tween($("#k-prog"), d.count.prog);
    tween($("#k-open"), TASKS.length - d.count.done);
    $("#k-open-sub").textContent = d.count.todo + " not started";
    var full = PKGS.filter(function (p) { return d.wp[p.id].complete; }).length;
    $("#k-wp-sub").textContent = full + " fully completed";
    var sb = $("#stack-bar").children;
    sb[0].style.flexGrow = d.tw.done; sb[1].style.flexGrow = d.tw.prog; sb[2].style.flexGrow = d.tw.todo;
    $("#stack-bar").setAttribute("aria-label", "Task-weeks: " + d.tw.done + " completed, " + d.tw.prog + " in progress, " + d.tw.todo + " not started");
    $("#stack-legend").innerHTML =
      '<span><b>' + d.tw.done + "</b> completed</span><span><b>" + d.tw.prog + "</b> in progress</span><span><b>" + d.tw.todo + "</b> not started</span><span>task-weeks of " + TOTAL_TW + "</span>";
    // nav ring
    var C = 53.41;
    $("#nav-ring").style.strokeDashoffset = (C * (1 - d.weighted)).toFixed(2);
    $("#nav-pct").textContent = pct(d.weighted) + "%";
  }

  P.renderKpisShell = renderKpisShell;
  P.renderKpis = renderKpis;
})(window.PD = window.PD || {});
