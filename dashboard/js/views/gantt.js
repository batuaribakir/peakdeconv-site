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
  var state = P.state;

  /* ======================================================================
     C · GANTT
     ====================================================================== */
  var gantt = $("#gantt");
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
        '<div class="g-track">' +
        p.barSegments.map(function (s) { return '<div class="wp-bar" style="grid-column:' + s[0] + "/" + (s[1] + 1) + ';grid-row:1"></div>'; }).join("") +
        '<button type="button" class="diamond" style="grid-column:' + p.finalWeek + ';grid-row:1" aria-label="' + p.id + " planned final week, week " + p.finalWeek + '" data-tip="' + esc("<b>" + p.id + "</b> " + p.title + " · Week " + p.finalWeek) + '" data-final="' + p.id + '"></button>' +
        "</div></div>";
      var tRows = p.tasks.map(function (t) {
        var bars = t.segments.map(function (s, i) {
          return '<div class="bar o-' + t.owner + '" style="grid-column:' + s[0] + "/" + (s[1] + 1) + ';grid-row:1">' +
            '<span class="bar-state"></span></div>';
        }).join("");
        var fx = '<button type="button" class="fx is-locked" style="grid-column:' + t.fixedWeek + ';grid-row:1" data-lock="' + t.id + '" data-tip="Locked" aria-pressed="true">' + I.lock.replace("<svg", '<svg class="lock-ic"') + "</button>";
        return '<div class="g-row task" role="row" tabindex="0" data-id="' + t.id + '" data-wp="' + t.wp + '" data-owner="' + t.owner + '" aria-label="' + esc(t.id + " " + t.name + ", " + t.weeksLabel + ", " + OWNERS[t.owner].label) + '">' +
          '<div class="g-label" role="rowheader"><span class="g-code">' + t.id + '</span><span class="g-name"><span class="t">' + esc(t.name) + "</span>" + "</span>" + '<span class="g-meta">' + ownerChip(t.owner) + '<span class="g-status" data-gs="' + t.id + '"></span></span></div>' +
          '<div class="g-track">' + bars + fx + "</div></div>";
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
    gantt.addEventListener("pointerover", function (e) {
      var r = e.target.closest(".g-row.task"); if (r) highlight(r.dataset.id);
      else if (e.target.closest(".g-row.wp, .g-head")) clearHl();
    });
    gantt.addEventListener("pointerleave", clearHl);
    gantt.addEventListener("focusin", function (e) { var r = e.target.closest(".g-row.task"); if (r) highlight(r.dataset.id); });
    gantt.addEventListener("focusout", function (e) { if (!gantt.contains(e.relatedTarget)) clearHl(); });
    gantt.addEventListener("click", function (e) {
      var lk = e.target.closest("[data-lock]");
      if (lk) { e.stopPropagation(); toggleLock(lk.dataset.lock); return; }
      var dm = e.target.closest("[data-final]");
      if (dm) { openWp(dm.dataset.final); return; }
      var r = e.target.closest(".g-row.task"); if (r) openDrawer(r.dataset.id, r);
    });
    gantt.addEventListener("keydown", function (e) {
      var r = e.target.closest(".g-row.task"); if (!r || e.target !== r) return;
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDrawer(r.dataset.id, r); }
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
      '<span class="lg-item"><span class="sw-lock">' + I.unlock + "</span>Unlocked</span></span>";
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
      row.setAttribute("aria-label", t.id + " " + t.name + ", " + t.weeksLabel + ", " + OWNERS[t.owner].label + ", " + STATUS[s].label);
    });
    PKGS.forEach(function (p) { $('[data-wpcount="' + p.id + '"]', gantt).textContent = d.wp[p.id].count.done + "/" + p.tasks.length; });
  }

  P.renderGantt = renderGantt;
  P.updateGantt = updateGantt;
})(window.PD = window.PD || {});
