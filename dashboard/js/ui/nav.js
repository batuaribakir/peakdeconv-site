/* Section navigation + scroll reveal */
(function (P) {
  "use strict";
  function $() { return P.$.apply(null, arguments); }
  function $$() { return P.$$.apply(null, arguments); }
  var reduceMotion = P.reduceMotion;

  /* ======================================================================
     NAVIGATION + REVEAL
     ====================================================================== */
  function initNav() {
    var links = $$("#nav-links a"), pill = $("#nav-pill");
    var map = { overview: "overview", health: "overview", schedule: "schedule", packages: "packages", tasks: "tasks", analytics: "analytics", milestones: "milestones", team: "team" };
    var current = null;
    function setActive(id) {
      if (id === current) return; current = id;
      links.forEach(function (a) {
        var on = a.getAttribute("href") === "#" + id;
        a.setAttribute("aria-current", on ? "true" : "false");
        if (on) {
          pill.style.opacity = 1; pill.style.width = a.offsetWidth + "px";
          pill.style.transform = "translateX(" + a.offsetLeft + "px)";
          var nav = a.closest("nav");
          if (nav && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: a.offsetLeft - nav.clientWidth / 2 + a.offsetWidth / 2, behavior: "smooth" });
        }
      });
    }
    var secs = Object.keys(map).map(function (k) { return document.getElementById(k); }).filter(Boolean);
    function pick() {
      var y = window.innerHeight * 0.35, best = secs[0];
      secs.forEach(function (s) { if (s.getBoundingClientRect().top <= y) best = s; });
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) best = secs[secs.length - 1];
      setActive(map[best.id]);
    }
    var ticking = false;
    window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; pick(); }); } }, { passive: true });
    window.addEventListener("resize", function () { current = null; pick(); });
    pick();
  }
  function initReveal() {
    if (reduceMotion.matches || !("IntersectionObserver" in window)) return;
    var els = $$(".reveal").filter(function (el) { return el.getBoundingClientRect().top > window.innerHeight * 0.92; });
    els.forEach(function (el) { el.classList.add("pre"); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target; io.unobserve(el);
        setTimeout(function () { el.classList.remove("pre"); }, el.classList.contains("sec-head") ? 0 : 70);
      });
    }, { threshold: 0, rootMargin: "0px 0px -8% 0px" });
    els.forEach(function (el) { io.observe(el); });
  }

  P.initNav = initNav;
  P.initReveal = initReveal;
})(window.PD = window.PD || {});
