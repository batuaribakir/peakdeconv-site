/* MAVIS Home — site navigation (styles in nav.css).

   The behaviour of the site's global menu (assets/js/site.js), for Home, which cannot load
   that script (see the README, "Home"):

     - the handle opens the panel on hover (a mouse, from 1024 px up, after ~90 ms), on focus
       and on click; a click also pins it. An unpinned panel closes when the pointer has left
       both the handle and the panel (after ~220 ms of grace); any panel closes on a second
       click on the handle, a click or tap outside, the close button, Escape, or focus landing
       outside the menu;
     - Escape and the close button return focus to the handle when it was inside the menu;
     - while the closing sheet (#leadSheet, a modal dialog) is open the menu is closed, hidden
       and inert, so nothing outside the dialog can be reached through it.

   It never touches the scene, the scroll position or the document's height. Classic script,
   no dependencies, independent of Home's modules: if those fail, the menu still works. */
(function () {
  "use strict";

  var nav = document.getElementById("homeNav");
  if (!nav) return;
  var handle = nav.querySelector(".home-nav-handle");
  var panel = nav.querySelector(".home-nav-panel");
  var closeBtn = nav.querySelector(".home-nav-close");

  var NARROW = "(max-width: 1023px)";   /* must match nav.css */
  var OPEN_DELAY = 90;    /* ms of hover before opening: ignores a brush past */
  var CLOSE_DELAY = 220;  /* ms of grace after leaving: covers the handoff     */
  var narrow = window.matchMedia(NARROW);
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  var open = false;
  var openedBy = null;       /* "hover" | "focus" | "click"; only "click" pins */
  var openTimer = null, closeTimer = null;
  var skipFocusOpen = false; /* set when focus is put back on the handle, so that does not reopen it */
  var skipHoverOpen = false; /* likewise for a pointer the closing handle slides back under */
  var blocked = false;       /* the closing sheet is open */

  function clearTimers() {
    if (openTimer) { clearTimeout(openTimer); openTimer = null; }
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
  }

  function setOpen(next, by) {
    clearTimers();
    openedBy = next ? by : null;
    nav.classList.toggle("is-pinned", openedBy === "click");
    if (next === open) return;
    open = next;
    nav.classList.toggle("is-open", open);
    handle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function scheduleClose() {
    /* a pinned panel stays, and so does one that keyboard focus has gone into */
    if (!open || openedBy === "click" || panel.contains(document.activeElement)) return;
    clearTimers();
    closeTimer = setTimeout(function () { setOpen(false); }, reduceMotion.matches ? 0 : CLOSE_DELAY);
  }

  /* Close, and put focus back on the handle if it was inside the menu, so it is not left
     on a link that is about to be hidden. */
  function closeAndReturn() {
    var inside = nav.contains(document.activeElement);
    setOpen(false);
    skipHoverOpen = true;
    if (inside) {
      skipFocusOpen = true;
      handle.focus({ preventScroll: true });
    }
  }

  /* --- click (and Enter / Space): open and pin, or close a pinned panel ---------------- */
  handle.addEventListener("click", function () {
    if (blocked) return;
    if (open && openedBy === "click") setOpen(false);
    else setOpen(true, "click");
  });

  /* --- pointer: the handle opens, the panel keeps it open ------------------------------ */
  handle.addEventListener("pointerenter", function (e) {
    if (e.pointerType !== "mouse") return;
    /* Cancel first, unconditionally: coming back onto the handle from the open panel has
       to call off the close that leaving the panel queued. */
    clearTimers();
    if (narrow.matches || open || skipHoverOpen || blocked) return;
    openTimer = setTimeout(function () { setOpen(true, "hover"); }, OPEN_DELAY);
  });
  handle.addEventListener("pointerleave", function (e) {
    if (e.pointerType !== "mouse") return;
    skipHoverOpen = false;          /* the pointer moved away: hover counts again */
    if (openTimer) { clearTimeout(openTimer); openTimer = null; }
    scheduleClose();
  });
  panel.addEventListener("pointerenter", clearTimers);
  panel.addEventListener("pointerleave", function (e) {
    if (e.pointerType === "mouse") scheduleClose();
  });
  /* A pointer moving anywhere but the handle is a fresh approach again. */
  document.addEventListener("pointermove", function (e) {
    if (skipHoverOpen && !handle.contains(e.target)) skipHoverOpen = false;
  }, { passive: true });

  /* --- keyboard: the handle opens on focus (the panel follows it in the tab order) ----- */
  handle.addEventListener("focus", function () {
    if (!skipFocusOpen && !open && !blocked) setOpen(true, "focus");
  });
  handle.addEventListener("blur", function () { skipFocusOpen = false; });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && open) closeAndReturn();
  });

  /* Focus landing outside the menu closes it, so tabbing past the last link never leaves an
     open panel behind. */
  document.addEventListener("focusin", function (e) {
    if (open && !nav.contains(e.target)) setOpen(false);
  });

  /* A click or tap anywhere outside the handle and the panel (the scrim included) closes it.
     Capture phase, so nothing on the page can stop it from being seen. */
  document.addEventListener("pointerdown", function (e) {
    if (open && !handle.contains(e.target) && !panel.contains(e.target)) setOpen(false);
  }, true);

  /* Following a link closes the panel before the next page paints. */
  panel.addEventListener("click", function (e) {
    if (e.target.closest("a")) setOpen(false);
  });
  closeBtn.addEventListener("click", closeAndReturn);

  /* --- the closing sheet is modal: the menu steps out of reach while it is open -------- */
  var sheet = document.getElementById("leadSheet");
  if (sheet && window.MutationObserver) {
    var sync = function () {
      var modal = sheet.classList.contains("open");
      if (modal === blocked) return;
      blocked = modal;
      if (modal) setOpen(false);
      else skipHoverOpen = true;   /* the handle comes back under a pointer that has not moved */
      nav.classList.toggle("is-blocked", modal);
      nav.inert = modal;
    };
    new MutationObserver(sync).observe(sheet, { attributes: true, attributeFilter: ["class"] });
    sync();
  }

  function onBreakpoint() { setOpen(false); }
  if (narrow.addEventListener) narrow.addEventListener("change", onBreakpoint);
  else if (narrow.addListener) narrow.addListener(onBreakpoint);

  setOpen(false);
  nav.hidden = false;
})();
