/* ==========================================================================
   Peak Deconvolution — site shell behaviour

   Two small, independent pieces, both progressive enhancements:

     1. the global bar's menu disclosure (narrow screens / touch)
     2. a scroll-spy for the per-page section bar

   Loaded on every page, including the dashboard, where it only ever touches
   the global bar: the dashboard's own section navigation is driven by
   dashboard/js/ui/nav.js and is deliberately left alone (it carries no
   [data-section-nav] attribute).

   Classic script, no modules, no dependencies — the same constraints the
   dashboard works under, so the whole site still runs from a plain folder.
   ========================================================================== */
(function () {
  "use strict";

  var NARROW = "(max-width: 880px)";
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------------------------------------------------------------------- */
  /* 1 · global bar: menu disclosure                                         */
  /* ---------------------------------------------------------------------- */
  function initMenu() {
    var bar = document.querySelector(".sitebar");
    var btn = document.getElementById("sitenav-toggle");
    var menu = document.getElementById("sitenav-menu");
    if (!bar || !btn || !menu) return;

    var mq = window.matchMedia(NARROW);
    var open = false;

    function paint() {
      var collapsible = mq.matches;
      // Outside the narrow breakpoint the links are always in the bar, so the
      // menu must never carry [hidden] there.
      menu.hidden = collapsible && !open;
      btn.setAttribute("aria-expanded", collapsible && open ? "true" : "false");
    }

    function setOpen(next, returnFocus) {
      if (!mq.matches) next = false;
      if (next === open) return;
      open = next;
      paint();
      if (!open && returnFocus) btn.focus();
    }

    btn.addEventListener("click", function () { setOpen(!open, false); });

    // Escape closes and hands focus back to the control that opened it.
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && open) setOpen(false, true);
    });

    // A tap or click anywhere outside the bar closes it.
    document.addEventListener("pointerdown", function (e) {
      if (open && !bar.contains(e.target)) setOpen(false, false);
    });

    // Following a link closes the panel before the next page paints.
    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) setOpen(false, false);
    });

    // Focus leaving the bar entirely (Tab past the last link) closes it too.
    document.addEventListener("focusin", function (e) {
      if (open && !bar.contains(e.target)) setOpen(false, false);
    });

    function onBreakpoint() { open = false; paint(); }
    if (mq.addEventListener) mq.addEventListener("change", onBreakpoint);
    else if (mq.addListener) mq.addListener(onBreakpoint);

    paint();
  }

  /* ---------------------------------------------------------------------- */
  /* 2 · section bar: mark the section currently in view                     */
  /* ---------------------------------------------------------------------- */
  function initSectionNav() {
    var bar = document.querySelector("[data-section-nav]");
    if (!bar) return;

    var links = [].slice.call(bar.querySelectorAll('a[href^="#"]'));
    var targets = links.map(function (a) {
      return document.getElementById(decodeURIComponent(a.getAttribute("href").slice(1)));
    });
    // Only keep links whose target actually exists on this page.
    var pairs = [];
    links.forEach(function (a, i) { if (targets[i]) pairs.push({ a: a, el: targets[i] }); });
    if (!pairs.length) return;

    var current = null;

    function centre(a) {
      if (bar.scrollWidth <= bar.clientWidth) return;
      var left = a.offsetLeft - bar.clientWidth / 2 + a.offsetWidth / 2;
      if (reduceMotion.matches || !bar.scrollTo) bar.scrollLeft = left;
      else bar.scrollTo({ left: left, behavior: "smooth" });
    }

    function pick() {
      var line = window.innerHeight * 0.35;
      var best = pairs[0];
      pairs.forEach(function (p) { if (p.el.getBoundingClientRect().top <= line) best = p; });
      // At the very bottom of the page, the last section is the one being read.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) best = pairs[pairs.length - 1];
      if (best === current) return;
      current = best;
      pairs.forEach(function (p) {
        if (p === best) p.a.setAttribute("aria-current", "true");
        else p.a.removeAttribute("aria-current");
      });
      centre(best.a);
    }

    var ticking = false;
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; pick(); });
    }, { passive: true });
    window.addEventListener("resize", function () { current = null; pick(); });
    pick();
  }

  initMenu();
  initSectionNav();
})();
