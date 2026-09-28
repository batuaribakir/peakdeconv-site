/* Home only. GSAP animates illustration layers; text, links and scientific
   geometry stay in normal document flow. Without GSAP, the complete SVG is
   visible as a static illustration. */
(function () {
  "use strict";
  var scene = document.querySelector("[data-parallax-scene]");
  if (!scene || !window.gsap || !window.ScrollTrigger) return;

  window.gsap.registerPlugin(window.ScrollTrigger);
  var media = window.gsap.matchMedia();
  media.add("(min-width: 901px) and (prefers-reduced-motion: no-preference)", function () {
    var trigger = { trigger: "#overview", start: "top top", end: "bottom top", scrub: true };
    window.gsap.to(scene.querySelector(".peak-scene__ambient"), {
      y: 48, ease: "none", scrollTrigger: trigger
    });
    window.gsap.to(scene.querySelector(".peak-scene__grid"), {
      y: 22, ease: "none", scrollTrigger: trigger
    });
    window.gsap.to(scene.querySelector(".peak-scene__plot"), {
      y: -18, ease: "none", scrollTrigger: trigger
    });
    window.gsap.fromTo(scene.querySelectorAll(".peak-component"),
      { opacity: .2 },
      { opacity: .9, ease: "none", stagger: .12,
        scrollTrigger: { trigger: "#overview", start: "top top", end: "bottom top", scrub: true } }
    );
  });
})();
