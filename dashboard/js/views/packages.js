/* D · Work-package plate */
(function (P) {
  "use strict";
  function $() { return P.$.apply(null, arguments); }
  function $$() { return P.$$.apply(null, arguments); }
  var MID = P.MID;
  var OWNERS = P.OWNERS;
  var OWNER_KEYS = P.OWNER_KEYS;
  var PKG = P.PKG;
  var PKGS = P.PKGS;
  function S() { return P.S.apply(null, arguments); }
  var WEEKS = P.WEEKS;
  function esc() { return P.esc.apply(null, arguments); }
  function openDrawer() { return P.openDrawer.apply(null, arguments); }
  function pct() { return P.pct.apply(null, arguments); }
  function tween() { return P.tween.apply(null, arguments); }

  /* ======================================================================
     D · WORK PACKAGE PLATE
     ====================================================================== */
  function renderPlate() {
    var el = $("#wp-plate");
    el.innerHTML = PKGS.map(function (p) {
      var counts = {}; p.tasks.forEach(function (t) { counts[t.owner] = (counts[t.owner] || 0) + 1; });
      var strip = WEEKS.map(function (w) {
        var on = p.headingBar.indexOf(w.week) >= 0;
        return '<i class="' + (on ? "on " : "") + (w.week === MID ? "mid " : "") + (w.week === p.finalWeek ? "fin" : "") + '"></i>';
      }).join("");
      return '<button type="button" class="wpm" data-wp="' + p.id + '" aria-label="' + esc(p.id + " " + p.title) + '">' +
        '<div class="wpm-top"><span class="wpm-id"><span>WP</span>' + p.id.replace("WP", "") + '</span><span class="wpm-pct" data-wpct="' + p.id + '">0%</span></div>' +
        '<div class="wpm-title">' + esc(p.title) + '<span class="wpm-short">' + esc(p.short) + "</span></div>" +
        "<div><div class=\"wpm-strip\" aria-hidden=\"true\">" + strip + '</div><div class="wpm-axis"><span>1</span><span>8</span><span>15</span></div></div>' +
        '<div style="display:grid;gap:12px">' +
        '<div class="wpm-progress" aria-hidden="true"><span class="pd" data-wpd="' + p.id + '"></span><span class="pp" data-wpp="' + p.id + '"></span><span data-wpo="' + p.id + '" style="flex-grow:1"></span></div>' +
        '<div class="wpm-stats"><span><b data-wpdone="' + p.id + '">0/' + p.tasks.length + "</b>tasks done</span><span><b>" + p.span[0] + "–" + p.span[1] + "</b>span (wk)</span><span><b>◆ " + p.finalWeek + "</b>final week</span></div>" +
        '<div class="wpm-owners">' + OWNER_KEYS.filter(function (o) { return counts[o]; }).map(function (o) {
          return '<span class="owner-chip" data-owner="' + o + '"><span class="sw sw-' + o + '"></span>' + esc(OWNERS[o].label) + " ×" + counts[o] + "</span>";
        }).join("") + "</div></div></button>";
    }).join("");
    $$(".wpm", el).forEach(function (b) { b.addEventListener("click", function () { openWp(b.dataset.wp, b); }); });
  }
  function updatePlate(d) {
    PKGS.forEach(function (p) {
      var x = d.wp[p.id];
      tween($('[data-wpct="' + p.id + '"]'), pct(x.pct), function (v) { return Math.round(v) + "%"; });
      $('[data-wpdone="' + p.id + '"]').textContent = x.count.done + "/" + p.tasks.length;
      $('[data-wpd="' + p.id + '"]').style.flexGrow = x.tw.done;
      $('[data-wpp="' + p.id + '"]').style.flexGrow = x.tw.prog * 0.5;
      $('[data-wpo="' + p.id + '"]').style.flexGrow = x.tw.todo + x.tw.prog * 0.5;
      var btn = $('.wpm[data-wp="' + p.id + '"]');
      btn.setAttribute("aria-label", p.id + " " + p.title + ", " + x.count.done + " of " + p.tasks.length + " tasks completed, " + pct(x.pct) + "% weighted");
    });
  }
  function openWp(id, from) {
    var p = PKG[id];
    var t = p.tasks.filter(function (t) { return S(t.id) !== "done"; })[0] || p.tasks[0];
    openDrawer(t.id, from);
  }

  P.renderPlate = renderPlate;
  P.updatePlate = updatePlate;
  P.openWp = openWp;
})(window.PD = window.PD || {});
