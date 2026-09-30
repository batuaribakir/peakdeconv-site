/* E · Task tracker (filters, status controls, reset) */
(function (P) {
  "use strict";
  function $() { return P.$.apply(null, arguments); }
  function $$() { return P.$$.apply(null, arguments); }
  var I = P.I;
  var OWNERS = P.OWNERS;
  var OWNER_KEYS = P.OWNER_KEYS;
  var PKG = P.PKG;
  var PKGS = P.PKGS;
  function S() { return P.S.apply(null, arguments); }
  var STATUS = P.STATUS;
  var S_KEYS = P.S_KEYS;
  var TASK = P.TASK;
  var TASKS = P.TASKS;
  var WEEKS = P.WEEKS;
  function esc() { return P.esc.apply(null, arguments); }
  function openDrawer() { return P.openDrawer.apply(null, arguments); }
  function ownerChip() { return P.ownerChip.apply(null, arguments); }
  function resetAll() { return P.resetAll.apply(null, arguments); }
  function save() { return P.save.apply(null, arguments); }
  function isLocked() { return P.isLocked.apply(null, arguments); }
  function syncLock() { return P.syncLock.apply(null, arguments); }
  function toggleLock() { return P.toggleLock.apply(null, arguments); }
  function segControl() { return P.segControl.apply(null, arguments); }
  function setStatus() { return P.setStatus.apply(null, arguments); }
  var state = P.state;
  function weeksText() { return P.weeksText.apply(null, arguments); }

  /* ======================================================================
     E · TASK TRACKER
     ====================================================================== */
  function fillFilters() {
    function opts(sel, list) { $(sel).innerHTML = list.map(function (o) { return '<option value="' + o[0] + '">' + esc(o[1]) + "</option>"; }).join(""); }
    opts("#f-status", [["all", "All statuses"]].concat(S_KEYS.map(function (s) { return [s, STATUS[s].label]; })));
    opts("#f-wp", [["all", "All packages"]].concat(PKGS.map(function (p) { return [p.id, p.id + " · " + p.short]; })));
    opts("#f-owner", [["all", "All leads"]].concat(OWNER_KEYS.map(function (o) { return [o, OWNERS[o].label]; })));
    opts("#f-week", [["all", "Any week"]].concat(WEEKS.map(function (w) {
      return [String(w.week), "Week " + w.week + (w.kind === "presentation" ? " · Presentation" : w.kind === "midterm" ? " · Midterm" : "")];
    })));
    var F = state.filters;
    $("#f-q").value = F.q; $("#f-status").value = F.status; $("#f-wp").value = F.wp; $("#f-owner").value = F.owner; $("#f-week").value = F.week;
    // guard stale saved values
    ["status", "wp", "owner", "week"].forEach(function (k) { var s = $("#f-" + k); if (s.value !== F[k]) { F[k] = "all"; s.value = "all"; } });
    function upd() {
      F.q = $("#f-q").value; F.status = $("#f-status").value; F.wp = $("#f-wp").value; F.owner = $("#f-owner").value; F.week = $("#f-week").value;
      save(); renderTable();
    }
    $("#f-q").addEventListener("input", upd);
    ["#f-status", "#f-wp", "#f-owner", "#f-week"].forEach(function (s) { $(s).addEventListener("change", upd); });
    function clear() { F.q = ""; F.status = F.wp = F.owner = F.week = "all"; fillValues(); save(); renderTable(); }
    function fillValues() { $("#f-q").value = ""; ["status", "wp", "owner", "week"].forEach(function (k) { $("#f-" + k).value = "all"; }); }
    $("#f-clear").addEventListener("click", clear);
    $("#t-empty-clear").addEventListener("click", clear);
  }
  function matches(t) {
    var F = state.filters, q = F.q.trim().toLowerCase();
    if (F.status !== "all" && S(t.id) !== F.status) return false;
    if (F.wp !== "all" && t.wp !== F.wp) return false;
    if (F.owner !== "all" && t.owner !== F.owner) return false;
    if (F.week !== "all" && t.weeks.indexOf(+F.week) < 0) return false;
    if (q) {
      var hay = (t.id + " " + t.name + " " + PKG[t.wp].title + " " + PKG[t.wp].short + " " + OWNERS[t.owner].label + "").toLowerCase();
      if (q.split(/\s+/).some(function (w) { return hay.indexOf(w) < 0; })) return false;
    }
    return true;
  }
  function renderTable() {
    var tb = $("#tbody"), shown = 0, html = "";
    var active = document.activeElement, refocus = active && active.dataset && active.dataset.set ? { id: active.dataset.id, s: active.dataset.set } : null;
    PKGS.forEach(function (p) {
      var ts = p.tasks.filter(matches);
      if (!ts.length) return;
      shown += ts.length;
      html += '<tr class="wp-sep" data-wp="' + p.id + '"><td colspan="6"><span class="wp-sep-label">' + p.id + " · " + esc(p.title) + "</span></td></tr>";
      html += ts.map(function (t) {
        var s = S(t.id);
        return '<tr class="task-row" tabindex="0" data-id="' + t.id + '" data-wp="' + t.wp + '">' +
          '<td class="td-status"><div class="status-cell">' + segControl(t) + '<span class="status-text" data-s="' + s + '" data-st="' + t.id + '">' + STATUS[s].label + "</span></div></td>" +
          '<td class="td-id">' + t.id + "</td>" +
          '<td class="td-task"><span class="tn">' + esc(t.name) + "</span></td>" +
          '<td class="td-weeks td-hide-m">' + esc(weeksText(t)) + "</td>" +
          '<td class="td-hide-m">' + ownerChip(t.owner) + "</td>" +
          '<td class="td-fx td-hide-m"><button type="button" class="lock-btn" data-lock="' + t.id + '"><span class="lock-ic-wrap">' + (isLocked(t.id) ? I.lock : I.unlock).replace("<svg", '<svg class="lock-ic"') + "</span>Wk " + t.fixedWeek + "</button></td></tr>";
      }).join("");
    });
    tb.innerHTML = html;
    $$("#tbody [data-lock]").forEach(function (b) { syncLock(b, TASK[b.dataset.lock]); });
    $("#t-empty").hidden = shown > 0;
    $("#ttable").hidden = shown === 0;
    $("#t-count").innerHTML = "<b>" + shown + "</b> / " + TASKS.length;
    if (refocus) {
      var b = $('[data-set="' + refocus.s + '"][data-id="' + refocus.id + '"]', tb);
      if (b) b.focus(); else { var first = $("#tbody [data-set]"); if (first) first.focus({ preventScroll: true }); }
    }
  }
  function updateTableStatus(changedId) {
    if (state.filters.status !== "all") { renderTable(); return; }
    TASKS.forEach(function (t) {
      if (changedId && changedId !== t.id) return;
      var lb = $('#tbody [data-lock="' + t.id + '"]');
      if (lb) syncLock(lb, t);
      var s = S(t.id);
      $$('#tbody [data-id="' + t.id + '"][data-set]').forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.set === s)); });
      var st = $('#tbody [data-st="' + t.id + '"]');
      if (st) { st.dataset.s = s; st.textContent = STATUS[s].label; }
    });
  }
  function bindTable() {
    var tb = $("#tbody");
    tb.addEventListener("click", function (e) {
      var lk = e.target.closest("[data-lock]");
      if (lk) { e.stopPropagation(); toggleLock(lk.dataset.lock); return; }
      var b = e.target.closest("[data-set]");
      if (b) { e.stopPropagation(); setStatus(b.dataset.id, b.dataset.set); return; }
      var r = e.target.closest("tr.task-row"); if (r) openDrawer(r.dataset.id, r);
    });
    tb.addEventListener("keydown", function (e) {
      var r = e.target.closest("tr.task-row");
      if (r && e.target === r && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openDrawer(r.dataset.id, r); }
    });
    // reset with inline confirmation
    var box = $("#t-actions");
    function idle() {
      box.innerHTML = '<button type="button" class="btn btn-danger" id="t-reset">' + I.reset + "Reset</button>";
      $("#t-reset").addEventListener("click", ask);
    }
    function ask() {
      var n = Object.keys(state.status).length;
      if (!n) { box.innerHTML = '<span class="confirm">Nothing to reset</span>'; setTimeout(idle, 2200); return; }
      box.innerHTML = '<span class="confirm">Reset all? <button type="button" class="btn btn-solid" id="t-yes">Reset</button><button type="button" class="btn" id="t-no">Cancel</button></span>';
      $("#t-yes").addEventListener("click", function () { resetAll(); box.innerHTML = '<span class="confirm" role="status">Done</span>'; setTimeout(idle, 2000); });
      $("#t-no").addEventListener("click", function () { idle(); $("#t-reset").focus(); });
      $("#t-no").focus();
    }
    idle();
    // "Restore plan" appears only while some task sits away from its planned weeks
    var restore = $("#t-restore");
    restore.addEventListener("click", function () { P.restorePlan(); });
    P.refreshRestore();
  }
  function refreshRestore() { $("#t-restore").hidden = P.movedCount() === 0; }

  P.fillFilters = fillFilters;
  P.matches = matches;
  P.renderTable = renderTable;
  P.updateTableStatus = updateTableStatus;
  P.bindTable = bindTable;
  P.refreshRestore = refreshRestore;
})(window.PD = window.PD || {});
