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
      ["done", I.kDone, "Done", '<span id="k-done">0</span><small>/ ' + TASKS.length + "</small>"],
      ["prog", I.kProg, "In progress", '<span id="k-prog">0</span>'],
      ["todo", I.kOpen, "Not started", '<span id="k-todo">0</span>']
    ].map(function (r) {
      return '<div class="kpi" data-k="' + r[0] + '"><div class="kpi-label">' + r[1] + r[2] + '</div><div class="kpi-val">' + r[3] + "</div></div>";
    }).join("");
  }
  function renderKpis(d) {
    tween($("#kpi-weighted"), pct(d.weighted));
    tween($("#hf-done"), d.count.done);
    $("#hf-total").textContent = "/ " + TASKS.length;
    $("#hf-wps").textContent = PKGS.length;
    $("#hf-weeks").textContent = NW;
    tween($("#k-done"), d.count.done);
    tween($("#k-prog"), d.count.prog);
    tween($("#k-todo"), d.count.todo);
    var sb = $("#stack-bar").children;
    sb[0].style.flexGrow = d.tw.done; sb[1].style.flexGrow = d.tw.prog; sb[2].style.flexGrow = d.tw.todo;
    $("#stack-bar").setAttribute("aria-label", "Task-weeks: " + d.tw.done + " completed, " + d.tw.prog + " in progress, " + d.tw.todo + " not started");
    // nav ring
    var C = 53.41;
    $("#nav-ring").style.strokeDashoffset = (C * (1 - d.weighted)).toFixed(2);
    $("#nav-pct").textContent = pct(d.weighted) + "%";
  }

  P.renderKpisShell = renderKpisShell;
  P.renderKpis = renderKpis;
})(window.PD = window.PD || {});
