/* ==========================================================================
   Peak Deconvolution — site shell behaviour

   Two independent pieces, both progressive enhancements:

     1. the global navigation panel (left-edge handle on pointer devices,
        Menu button in the page bar on narrow screens)
     2. a scroll-spy for the page bar's section links

   Loaded on every page, including the dashboard, where it only ever touches
   the global panel: the dashboard's section navigation is driven by
   dashboard/js/ui/nav.js and is deliberately left alone (its bar carries no
   [data-section-nav]).

   Classic script, no modules, no dependencies — the same constraints the
   dashboard works under, so the whole site still runs from a plain folder.
   ========================================================================== */
(function () {
  "use strict";

  var NARROW = "(max-width: 1023px)";   /* must match site.css */
  var OPEN_DELAY = 90;    /* ms of hover before opening — ignores a brush past */
  var CLOSE_DELAY = 220;  /* ms of grace after leaving — covers the handoff   */
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------------------------------------------------------------------- */
  /* 1 · global navigation panel                                             */
  /* ---------------------------------------------------------------------- */
  function initPanel() {
    var panel = document.getElementById("navpanel");
    var handle = document.querySelector(".navhandle");
    var scrim = document.querySelector(".navscrim");
    var toggles = [].slice.call(document.querySelectorAll("[data-nav-toggle]"));
    if (!panel || !toggles.length) return;

    var narrow = window.matchMedia(NARROW);
    var open = false;
    var openedBy = null;       /* "hover" | "click" | "focus" */
    var openTimer = null, closeTimer = null;
    var skipFocusOpen = false; /* set by Escape, so returning focus to the
                                  handle does not immediately reopen it */

    function clearTimers() {
      if (openTimer) { clearTimeout(openTimer); openTimer = null; }
      if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    }

    /* offsetParent is null for position:fixed, so ask the box instead: the
       handle and the Menu button swap at the breakpoint and only one is up. */
    function visibleToggle() {
      for (var i = 0; i < toggles.length; i++) {
        var r = toggles[i].getBoundingClientRect();
        if (r.width > 0 && r.height > 0) return toggles[i];
      }
      return toggles[0];
    }

    function setOpen(next, by) {
      clearTimers();
      openedBy = next ? by : null;
      if (next === open) return;
      open = next;
      panel.classList.toggle("is-open", open);
      if (handle) handle.classList.toggle("is-open", open);
      if (scrim) scrim.classList.toggle("is-open", open);
      toggles.forEach(function (t) { t.setAttribute("aria-expanded", open ? "true" : "false"); });
    }

    function scheduleClose() {
      if (!open || openedBy === "click") return;   /* a clicked-open panel stays */
      clearTimers();
      closeTimer = setTimeout(function () { setOpen(false); }, reduceMotion.matches ? 0 : CLOSE_DELAY);
    }

    /* --- click: opens, or pins a panel that hover already opened --------- */
    toggles.forEach(function (t) {
      t.addEventListener("click", function () {
        if (!open) setOpen(true, "click");
        else if (openedBy === "click") setOpen(false);
        else openedBy = "click";
      });
    });

    /* --- pointer: the handle opens, the panel keeps it open -------------- */
    if (handle) {
      handle.addEventListener("pointerenter", function (e) {
        if (e.pointerType !== "mouse") return;
        /* Cancel first, unconditionally: coming back onto the handle from the
           open panel has to call off the close that leaving the panel queued. */
        clearTimers();
        if (narrow.matches || open) return;
        openTimer = setTimeout(function () { setOpen(true, "hover"); }, OPEN_DELAY);
      });
      handle.addEventListener("pointerleave", function (e) {
        if (e.pointerType !== "mouse") return;
        if (openTimer) { clearTimeout(openTimer); openTimer = null; }
        scheduleClose();
      });
    }
    /* The handle sits against the panel's edge while it is open, so crossing
       between them never touches the page; this only cancels the pending close. */
    panel.addEventListener("pointerenter", clearTimers);
    panel.addEventListener("pointerleave", function (e) {
      if (e.pointerType === "mouse") scheduleClose();
    });

    /* --- keyboard: focusing the control opens it, Escape closes it ------- */
    toggles.forEach(function (t) {
      t.addEventListener("focus", function () {
        if (!skipFocusOpen && !open) setOpen(true, "focus");
      });
      t.addEventListener("blur", function () { skipFocusOpen = false; });
    });

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || !open) return;
      setOpen(false);
      skipFocusOpen = true;
      visibleToggle().focus();
    });

    function inChrome(node) {
      if (panel.contains(node)) return true;
      for (var i = 0; i < toggles.length; i++) if (toggles[i].contains(node)) return true;
      return false;
    }

    /* Focus leaving the panel closes it, unless a click pinned it open. */
    document.addEventListener("focusin", function (e) {
      if (open && openedBy !== "click" && !inChrome(e.target)) setOpen(false);
    });

    /* A tap or click anywhere outside closes it. */
    document.addEventListener("pointerdown", function (e) {
      if (open && !inChrome(e.target)) setOpen(false);
    });

    /* Following a link closes the panel before the next page paints. */
    panel.addEventListener("click", function (e) {
      if (e.target.closest("a")) setOpen(false);
    });

    var closeBtn = panel.querySelector(".navpanel-close");
    if (closeBtn) closeBtn.addEventListener("click", function () {
      setOpen(false);
      skipFocusOpen = true;
      visibleToggle().focus();
    });

    function onBreakpoint() { setOpen(false); }
    if (narrow.addEventListener) narrow.addEventListener("change", onBreakpoint);
    else if (narrow.addListener) narrow.addListener(onBreakpoint);

    setOpen(false);
  }

  /* ---------------------------------------------------------------------- */
  /* 2 · page bar: mark the section currently in view                        */
  /* ---------------------------------------------------------------------- */
  function initSectionNav() {
    var bar = document.querySelector("[data-section-nav]");
    if (!bar) return;

    var pairs = [];
    [].slice.call(bar.querySelectorAll('a[href^="#"]')).forEach(function (a) {
      var el = document.getElementById(decodeURIComponent(a.getAttribute("href").slice(1)));
      if (el) pairs.push({ a: a, el: el });   /* only links with a target on this page */
    });
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
      /* At the very bottom of the page, the last section is the one being read. */
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

  initPanel();
  initSectionNav();
})();
