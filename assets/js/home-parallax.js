/* The signal scene uses the natural document scroll. CSS makes it sticky only
   after GSAP is available and this media query matches; otherwise the SVG is
   complete, static and no artificial scroll space is added. */
(function () {
  "use strict";
  var track = document.querySelector(".signal-track");
  var scene = document.querySelector("[data-parallax-scene]");
  if (!track || !scene || !window.gsap || !window.ScrollTrigger) return;

  window.gsap.registerPlugin(window.ScrollTrigger);
  var media = window.gsap.matchMedia();
  media.add("(min-width: 741px) and (min-height: 560px) and (prefers-reduced-motion: no-preference)", function () {
    document.body.classList.add("motion-ready");
    var bar = scene.querySelector(".signal-progress span");
    var timeline = window.gsap.timeline({
      scrollTrigger: {
        trigger: track,
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: function (self) {
          if (bar) bar.style.transform = "scaleX(" + self.progress.toFixed(3) + ")";
        }
      }
    });

    timeline.to(scene.querySelector(".peak-scene__ambient"), { y: 130, ease: "none", duration: 1 }, 0)
      .to(scene.querySelector(".peak-scene__grid"), { y: -90, ease: "none", duration: 1 }, 0)
      .to(scene.querySelector(".peak-scene__plot"), { y: -46, ease: "none", duration: 1 }, 0)
      .fromTo(scene.querySelectorAll(".peak-component"),
        { opacity: .08 },
        { opacity: .95, stagger: .12, ease: "none", duration: .55 }, .12);

    window.ScrollTrigger.refresh();
    return function () {
      document.body.classList.remove("motion-ready");
      if (bar) bar.style.transform = "";
    };
  });
})();
