/* Task detail drawer (shared by every view) */
(function (P) {
  "use strict";
  function $() { return P.$.apply(null, arguments); }
  function $$() { return P.$$.apply(null, arguments); }
  var I = P.I;
  var PKG = P.PKG;
  function S() { return P.S.apply(null, arguments); }
  var STATUS = P.STATUS;
  var S_KEYS = P.S_KEYS;
  var TASK = P.TASK;
  var WEEKS = P.WEEKS;
  function esc() { return P.esc.apply(null, arguments); }
  function glyph() { return P.glyph.apply(null, arguments); }
  function hideTip() { return P.hideTip.apply(null, arguments); }
  function ownerChip() { return P.ownerChip.apply(null, arguments); }
  function isLocked() { return P.isLocked.apply(null, arguments); }
  function syncLock() { return P.syncLock.apply(null, arguments); }
  function toggleLock() { return P.toggleLock.apply(null, arguments); }
  function segIcon() { return P.segIcon.apply(null, arguments); }
  function setStatus() { return P.setStatus.apply(null, arguments); }

  /* ======================================================================
     DRAWER (shared by Gantt, tracker, packages, milestones)
     ====================================================================== */
  var drawer = $("#drawer"), scrim = $("#scrim"), drawerId = null, lastFocus = null;
  function drawerHtml(t) {
    var p = PKG[t.wp], s = S(t.id), locked = isLocked(t.id);
    var weeks = WEEKS.map(function (w) {
      var on = t.weeks.indexOf(w.week) >= 0;
      return '<div class="dw"><i class="' + (on ? "on " : "") + (w.week === t.fixedWeek ? "fx " : "") + (w.kind === "midterm" ? "mid" : "") + '"></i><span class="' + (w.kind === "presentation" ? "p" : "") + '">' + w.week + "</span></div>";
    }).join("");
    return '<div class="dr-head" data-wp="' + t.wp + '">' +
      '<div class="dr-top"><span class="dr-crumb">' + t.id + " · " + esc(p.title) + '</span><button type="button" class="dr-close" id="dr-close" aria-label="Close details">' + I.close + "</button></div>" +
      '<h3 class="dr-title" id="dr-title">' + esc(t.name) + "</h3>" +
      '<div class="dr-tags">' + ownerChip(t.owner) + "</div></div>" +
      '<div class="dr-body" data-wp="' + t.wp + '">' +
      '<div class="dr-status" role="group" aria-label="Set status">' + S_KEYS.map(function (k) {
        return '<button type="button" data-dset="' + k + '" data-s="' + k + '" aria-pressed="' + (s === k) + '">' + segIcon(k) + "<span>" + STATUS[k].label + "</span></button>";
      }).join("") + "</div>" +
      '<div class="dr-weeks" aria-hidden="true">' + weeks + "</div>" +
      '<div class="dr-lockrow"><span>Week ' + t.fixedWeek + '</span><button type="button" class="lock-btn lock-switch' + (locked ? " is-locked" : "") + '" data-lock="' + t.id + '" aria-pressed="' + locked + '" aria-label="' + (locked ? "Unlock" : "Lock") + " delivery week, " + t.id + ", week " + t.fixedWeek + '">' +
        (locked ? I.lock : I.unlock).replace("<svg", '<svg class="lock-ic"') + '<span class="lock-txt">' + (locked ? "Locked" : "Unlocked") + "</span></button></div>" +
      '<dl class="dl-list">' +
      "<dt>Weeks</dt><dd>" + esc(t.weeksLabel.replace(/^Weeks? /, "")) + "</dd>" +
      "<dt>Duration</dt><dd>" + t.duration + " wk</dd>" +
      "<dt>Final week</dt><dd>◆ " + p.finalWeek + "</dd>" +
      "</dl>" +
      '<div class="dr-siblings">' + p.tasks.map(function (x) {
        return '<button type="button" data-goto="' + x.id + '"' + (x.id === t.id ? ' aria-current="true"' : "") + '><span class="c">' + x.id + '</span><span>' + esc(x.name) + "</span>" + glyph(S(x.id)) + "</button>";
      }).join("") + "</div>" +
      "</div>";
  }

  function openDrawer(id, from) {
    var t = TASK[id]; if (!t) return;
    if (!drawerId) lastFocus = from || document.activeElement;
    drawerId = id;
    drawer.innerHTML = drawerHtml(t);
    drawer.setAttribute("data-wp", t.wp);
    drawer.setAttribute("aria-hidden", "false");
    drawer.classList.add("open"); scrim.classList.add("open");
    hideTip();
    $("#dr-close").focus({ preventScroll: true });
  }
  function closeDrawer() {
    if (!drawerId) return;
    drawerId = null;
    drawer.classList.remove("open"); scrim.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }
  drawer.addEventListener("click", function (e) {
    if (e.target.closest("#dr-close")) { closeDrawer(); return; }
    var b = e.target.closest("[data-dset]"); if (b) { setStatus(drawerId, b.dataset.dset); return; }
    var lk = e.target.closest("[data-lock]"); if (lk) { toggleLock(drawerId); return; }
    var g = e.target.closest("[data-goto]"); if (g) openDrawer(g.dataset.goto);
  });
  scrim.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", function (e) {
    if (!drawerId) return;
    if (e.key === "Escape") { e.preventDefault(); closeDrawer(); }
    if (e.key === "Tab") {
      var f = $$("button, [tabindex='0']", drawer); if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  function updateDrawer() {
    if (!drawerId) return;
    var s = S(drawerId);
    $$("[data-dset]", drawer).forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.dset === s)); });
    var lb = $("[data-lock]", drawer);
    if (lb) { syncLock(lb, TASK[drawerId]); $(".lock-txt", lb).textContent = isLocked(drawerId) ? "Locked" : "Unlocked"; }
    $$("[data-goto]", drawer).forEach(function (b) {
      var old = $(".status-glyph", b); old.outerHTML = glyph(S(b.dataset.goto));
    });
  }

  P.drawerHtml = drawerHtml;
  P.openDrawer = openDrawer;
  P.closeDrawer = closeDrawer;
  P.updateDrawer = updateDrawer;
})(window.PD = window.PD || {});
