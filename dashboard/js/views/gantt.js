/* C · Interactive Gantt */
(function (P) {
  "use strict";
  function $() { return P.$.apply(null, arguments); }
  function $$() { return P.$$.apply(null, arguments); }
  var I = P.I;
  var OWNERS = P.OWNERS;
  var OWNER_KEYS = P.OWNER_KEYS;
  var PKG = P.PKG;
  var PKGS = P.PKGS;
  var PRES = P.PRES;
  function S() { return P.S.apply(null, arguments); }
  var STATUS = P.STATUS;
  var TASK = P.TASK;
  var TASKS = P.TASKS;
  var WEEKS = P.WEEKS;
  function esc() { return P.esc.apply(null, arguments); }
  function glyph() { return P.glyph.apply(null, arguments); }
  function openDrawer() { return P.openDrawer.apply(null, arguments); }
  function openWp() { return P.openWp.apply(null, arguments); }
  function ownerChip() { return P.ownerChip.apply(null, arguments); }
  function syncLock() { return P.syncLock.apply(null, arguments); }
  function toggleLock() { return P.toggleLock.apply(null, arguments); }
  var OWNER_SHORT = P.OWNER_SHORT;
  var MID = P.MID;
  var NW = P.NW;
  function isLocked() { return P.isLocked.apply(null, arguments); }
  var state = P.state;

  /* ======================================================================
     C · GANTT
     ====================================================================== */
  var gantt = $("#gantt");
  function wpTrack(p) {
    return p.barSegments.map(function (s) { return '<div class="wp-bar" style="grid-column:' + s[0] + "/" + (s[1] + 1) + ';grid-row:1"></div>'; }).join("") +
      '<button type="button" class="diamond" style="grid-column:' + p.finalWeek + ';grid-row:1" aria-label="' + p.id + " planned final week, week " + p.finalWeek + '" data-tip="' + esc("<b>" + p.id + "</b> " + p.title + " · Week " + p.finalWeek) + '" data-final="' + p.id + '"></button>';
  }
  function taskTrack(t) {
    // where the task sat in the plan, when it has been moved
    var ghost = P.shiftOf(t.id) ? t.base.segments.map(function (s) {
      return '<div class="bar-ghost" style="grid-column:' + s[0] + "/" + (s[1] + 1) + ';grid-row:1"></div>';
    }).join("") : "";
    var bars = t.segments.map(function (s) {
      return '<div class="bar o-' + t.owner + '" style="grid-column:' + s[0] + "/" + (s[1] + 1) + ';grid-row:1">' +
        '<span class="bar-state"></span></div>';
    }).join("");
    var fx = '<button type="button" class="fx is-locked" style="grid-column:' + t.fixedWeek + ';grid-row:1" data-lock="' + t.id + '" data-tip="Locked" aria-pressed="true">' + I.lock.replace("<svg", '<svg class="lock-ic"') + "</button>";
    return ghost + bars + fx;
  }
  function renderGantt() {
    var head = '<div class="g-head" role="row"><div class="g-corner" role="columnheader"></div>' +
      WEEKS.map(function (w) {
        var cls = w.kind === "presentation" ? "is-pres" : w.kind === "midterm" ? "is-mid" : "";
        var k = w.kind === "presentation" ? "Pres" : w.kind === "midterm" ? "Mid" : "";
        var t = w.kind === "presentation" ? "<span class='tk'>Presentation</span>Week " + w.week :
          w.kind === "midterm" ? "<span class='tk'>Midterm</span>Week " + w.week : "";
        return '<div class="g-wk ' + cls + '" role="columnheader" data-w="' + w.week + '"' + (t ? ' tabindex="0" data-tip="' + esc(t) + '"' : "") + '><span class="n">' + w.week + '</span><span class="k">' + k + "</span></div>";
      }).join("") + "</div>";

    var cols = '<div class="g-cols" aria-hidden="true"><div></div>' + WEEKS.map(function (w) {
      return '<div data-w="' + w.week + '" class="' + (w.kind === "presentation" ? "c-pres" : w.kind === "midterm" ? "c-mid" : "") + '">' + (w.kind === "midterm" ? "<span>Midterm</span>" : "") + "</div>";
    }).join("") + "</div>";

    var rows = PKGS.map(function (p) {
      var wpRow = '<div class="g-row wp" role="row" data-wp="' + p.id + '">' +
        '<div class="g-label" role="rowheader"><span class="g-code">' + p.id + '</span><span class="g-name"><span class="t">' + esc(p.title) + '</span></span><span class="g-meta"><span class="g-wpcount" data-wpcount="' + p.id + '">0/' + p.tasks.length + "</span></span></div>" +
        '<div class="g-track">' + wpTrack(p) + "</div></div>";
      var tRows = p.tasks.map(function (t) {
        return '<div class="g-row task" role="row" tabindex="0" data-id="' + t.id + '" data-wp="' + t.wp + '" data-owner="' + t.owner + '" aria-label="' + esc(t.id + " " + t.name + ", " + t.weeksLabel + ", " + OWNERS[t.owner].label) + '">' +
          '<div class="g-label" role="rowheader"><span class="g-code">' + t.id + '</span><span class="g-name"><span class="t">' + esc(t.name) + "</span>" + "</span>" + '<span class="g-meta">' + ownerChip(t.owner) + '<span class="g-status" data-gs="' + t.id + '"></span></span></div>' +
          '<div class="g-track">' + taskTrack(t) + "</div></div>";
      }).join("");
      return wpRow + tRows;
    }).join("");

    gantt.innerHTML = head + '<div class="g-body" role="rowgroup">' + cols + rows + "</div>";

    // hover / focus highlighting
    var hlId = null;
    function highlight(id) {
      if (hlId === id) return; clearHl(); if (!id) return;
      hlId = id; var t = TASK[id];
      gantt.classList.add("has-hl");
      $('.g-row.task[data-id="' + id + '"]', gantt).classList.add("is-hl");
      $('.g-row.wp[data-wp="' + t.wp + '"]', gantt).classList.add("is-hl-wp");
      t.weeks.forEach(function (w) {
        $('.g-wk[data-w="' + w + '"]', gantt).classList.add("is-hl");
        $('.g-cols [data-w="' + w + '"]', gantt).classList.add("c-hl");
      });
      var chip = $('.g-row.task[data-id="' + id + '"] .owner-chip', gantt); if (chip) chip.classList.add("is-hl");
      $$('#gantt-legend [data-owner="' + t.owner + '"]').forEach(function (n) { n.style.color = "var(--ink)"; n.style.fontWeight = 600; });
    }
    function clearHl() {
      hlId = null; gantt.classList.remove("has-hl");
      $$(".is-hl, .is-hl-wp, .c-hl", gantt).forEach(function (n) { n.classList.remove("is-hl", "is-hl-wp", "c-hl"); });
      $$("#gantt-legend [data-owner]").forEach(function (n) { n.style.color = ""; n.style.fontWeight = ""; });
    }
    // rebuild the bars after a task has moved; the rows, labels and listeners stay
    P.refreshGantt = function () {
      var keep = hlId; clearHl();
      PKGS.forEach(function (p) {
        $('.g-row.wp[data-wp="' + p.id + '"] .g-track', gantt).innerHTML = wpTrack(p);
        p.tasks.forEach(function (t) {
          var row = $('.g-row.task[data-id="' + t.id + '"]', gantt);
          $(".g-track", row).innerHTML = taskTrack(t);
          syncLock($('[data-lock="' + t.id + '"]', row), t);
        });
      });
      if (keep) highlight(keep);
    };

    // drag a bar of an unlocked task sideways; it snaps to working weeks
    var drag = null, suppressClick = false;
    function ordOf(col, dx) { return col < MID ? col - 1 : col > MID ? col - 2 : (dx > 0 ? MID - 1 : MID - 2); }
    gantt.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      var grip = e.target.closest(".bar, .fx"), row = grip && grip.closest(".g-row.task");
      if (!row || isLocked(row.dataset.id)) return;
      var t = TASK[row.dataset.id];
      drag = { id: t.id, x0: e.clientX, col0: t.weeks[0], start: P.shiftOf(t.id), colW: $(".g-track", row).getBoundingClientRect().width / NW, on: false, row: row, pid: e.pointerId };
    });
    gantt.addEventListener("pointermove", function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x0;
      if (!drag.on) {
        if (Math.abs(dx) < 5) return;
        drag.on = true; gantt.classList.add("is-dragging");
        try { drag.row.setPointerCapture(drag.pid); } catch (err) { /* ignore */ }
      }
      var col = Math.max(1, Math.min(NW, drag.col0 + Math.round(dx / drag.colW)));
      P.moveTaskTo(drag.id, drag.start + ordOf(col, dx) - ordOf(drag.col0, 0));
    });
    function endDrag() {
      if (!drag) return;
      if (drag.on) { suppressClick = true; setTimeout(function () { suppressClick = false; }, 60); }
      gantt.classList.remove("is-dragging"); drag = null;
    }
    gantt.addEventListener("pointerup", endDrag);
    gantt.addEventListener("pointercancel", endDrag);

    gantt.addEventListener("pointerover", function (e) {
      var r = e.target.closest(".g-row.task"); if (r) highlight(r.dataset.id);
      else if (e.target.closest(".g-row.wp, .g-head")) clearHl();
    });
    gantt.addEventListener("pointerleave", clearHl);
    gantt.addEventListener("focusin", function (e) { var r = e.target.closest(".g-row.task"); if (r) highlight(r.dataset.id); });
    gantt.addEventListener("focusout", function (e) { if (!gantt.contains(e.relatedTarget)) clearHl(); });
    gantt.addEventListener("click", function (e) {
      if (suppressClick) { suppressClick = false; return; }
      var lk = e.target.closest("[data-lock]");
      if (lk) { e.stopPropagation(); toggleLock(lk.dataset.lock); return; }
      var dm = e.target.closest("[data-final]");
      if (dm) { openWp(dm.dataset.final); return; }
      var r = e.target.closest(".g-row.task"); if (r) openDrawer(r.dataset.id, r);
    });
    gantt.addEventListener("keydown", function (e) {
      var r = e.target.closest(".g-row.task"); if (!r || e.target !== r) return;
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDrawer(r.dataset.id, r); }
      if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) { e.preventDefault(); P.moveTask(r.dataset.id, e.key === "ArrowLeft" ? -1 : 1); return; }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        var all = $$(".g-row.task", gantt), i = all.indexOf(r) + (e.key === "ArrowDown" ? 1 : -1);
        if (all[i]) all[i].focus();
      }
    });

    // legend (owners are toggles that emphasise their tasks)
    var lg = $("#gantt-legend");
    lg.innerHTML =
      '<span class="lg-group">' + OWNER_KEYS.map(function (o) {
        return '<button type="button" class="lg-item" data-owner="' + o + '" aria-pressed="false"><span class="sw sw-' + o + '"></span>' + esc(OWNER_SHORT[o]) + "</button>";
      }).join("") + "</span>" +
      '<span class="lg-group">' +
      '<span class="lg-item"><span class="sw sw-pres"></span>Presentation</span>' +
      '<span class="lg-item"><span class="sw sw-mid"></span>Midterm</span>' +
      '<span class="lg-item"><span class="sw sw-diamond"></span>Final week</span>' +
      '<span class="lg-item"><span class="sw-lock is-locked">' + I.lock + "</span>Locked</span>" +
      '<span class="lg-item" data-tip="Drag to move"><span class="sw-lock">' + I.unlock + "</span>Unlocked</span></span>";
    $$("button[data-owner]", lg).forEach(function (b) {
      b.addEventListener("click", function () {
        var on = b.getAttribute("aria-pressed") !== "true";
        $$("button[data-owner]", lg).forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
        gantt.classList.toggle("has-filter", on);
        $$(".g-row.task", gantt).forEach(function (r) { r.classList.toggle("is-off", on && r.dataset.owner !== b.dataset.owner); });
        $$(".g-row.wp", gantt).forEach(function (r) {
          r.classList.toggle("is-off", on && !PKG[r.dataset.wp].tasks.some(function (t) { return t.owner === b.dataset.owner; }));
        });
        if (on) b.setAttribute("aria-pressed", "true");
      });
    });
  }
  function updateGantt(d) {
    TASKS.forEach(function (t) {
      var s = S(t.id);
      var gs = $('[data-gs="' + t.id + '"]', gantt);
      gs.innerHTML = glyph(s); gs.title = STATUS[s].label;
      $$('.g-row.task[data-id="' + t.id + '"] .bar', gantt).forEach(function (b, i) {
        b.classList.toggle("is-done", s === "done"); b.classList.toggle("is-prog", s === "prog");
        var st = $(".bar-state", b); st.innerHTML = s === "done" && i === 0 ? I.check : "";
      });
      syncLock($('[data-lock="' + t.id + '"]', gantt), t);
      var row = $('.g-row.task[data-id="' + t.id + '"]', gantt);
      row.classList.toggle("is-free", !P.isLocked(t.id));
      row.setAttribute("aria-label", t.id + " " + t.name + ", " + t.weeksLabel + ", " + OWNERS[t.owner].label + ", " + STATUS[s].label);
    });
    PKGS.forEach(function (p) { $('[data-wpcount="' + p.id + '"]', gantt).textContent = d.wp[p.id].count.done + "/" + p.tasks.length; });
  }

  P.renderGantt = renderGantt;
  P.updateGantt = updateGantt;
})(window.PD = window.PD || {});
