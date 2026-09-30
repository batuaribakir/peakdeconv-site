/* ==========================================================================
   Central pointer / frame controller.
   One pointermove listener, one scroll listener, one requestAnimationFrame
   loop for the whole page. Effects (parallax, background scene) register as
   frame subscribers and receive the same damped state:

     frame.px, frame.py   camera tilt, normalised −1…1 (damped, Spline 0.125/frame)
     frame.lx, frame.ly   pointer position in viewport px (faster follow damping)
     frame.li             pointer activity (rest → active)
     frame.rawX, rawY     last raw pointer position (for forwarding to the 3D scene)
     frame.scroll         0…1 page scroll progress
     frame.dt, frame.t    seconds since last frame / timestamp

   The loop sleeps when nothing moves and no subscriber asks for more frames.
   ========================================================================== */
(function (P) {
  "use strict";
  var fx = P.fx = P.fx || {};
  var C = fx.config;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)");

  function restLight() { return { x: innerWidth * C.light.rest.x, y: innerHeight * C.light.rest.y }; }
  var r0 = restLight();
  var target = { px: 0, py: 0, lx: r0.x, ly: r0.y, li: C.light.restIntensity };
  var frame = { px: 0, py: 0, lx: r0.x, ly: r0.y, li: C.light.restIntensity, rawX: r0.x, rawY: r0.y, scroll: 0, dt: 0, t: 0, following: false, motion: true };
  var subs = [];
  var raf = 0, last = 0, dirty = true;

  function motionAllowed() { return !reduce.matches; }
  function interactive() { return fine.matches && !reduce.matches; }
  frame.motion = motionAllowed();

  function scrollProgress() {
    var max = document.documentElement.scrollHeight - innerHeight;
    return max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
  }

  function goRest() {
    var r = restLight();
    frame.following = false;
    if (C.camera.resetOnLeave) { target.px = 0; target.py = 0; }
    target.lx = r.x; target.ly = r.y; target.li = C.light.restIntensity;
    wake();
  }

  function tick(t) {
    raf = 0;
    var dt = last ? Math.min(0.05, (t - last) / 1000) : 1 / 60;
    last = t;
    frame.dt = dt; frame.t = t;
    frame.motion = motionAllowed();
    // camera: Spline hoverRotateDamping is per 60 fps frame → make it frame-rate independent
    var kc = 1 - Math.pow(1 - C.camera.damping, dt * 60);
    var kl = 1 - Math.exp(-(frame.following ? C.light.followSpeed : C.light.resetSpeed) * dt);
    var ki = 1 - Math.exp(-4 * dt);
    frame.px += (target.px - frame.px) * kc;
    frame.py += (target.py - frame.py) * kc;
    frame.lx += (target.lx - frame.lx) * kl;
    frame.ly += (target.ly - frame.ly) * kl;
    frame.li += (target.li - frame.li) * ki;
    frame.scroll = scrollProgress();

    var moving = dirty ||
      Math.abs(target.px - frame.px) > 0.0005 || Math.abs(target.py - frame.py) > 0.0005 ||
      Math.abs(target.lx - frame.lx) > 0.3 || Math.abs(target.ly - frame.ly) > 0.3 ||
      Math.abs(target.li - frame.li) > 0.002;
    dirty = false;
    var more = false;
    for (var i = 0; i < subs.length; i++) { if (subs[i](frame, moving) === true) more = true; }
    if ((moving || more) && document.visibilityState === "visible") raf = requestAnimationFrame(tick);
    else last = 0;
  }

  function wake() { dirty = true; if (!raf) raf = requestAnimationFrame(tick); }

  window.addEventListener("pointermove", function (e) {
    if (e.pointerType === "touch" || !interactive()) return;
    frame.following = true;
    frame.rawX = e.clientX; frame.rawY = e.clientY;
    target.px = Math.max(-1, Math.min(1, (e.clientX / innerWidth) * 2 - 1));
    target.py = Math.max(-1, Math.min(1, (e.clientY / innerHeight) * 2 - 1));
    target.lx = e.clientX; target.ly = e.clientY; target.li = C.light.activeIntensity;
    wake();
  }, { passive: true });
  document.addEventListener("pointerleave", goRest);
  document.addEventListener("mouseout", function (e) { if (!e.relatedTarget) goRest(); });
  window.addEventListener("blur", goRest);
  window.addEventListener("scroll", wake, { passive: true });
  window.addEventListener("resize", function () { if (!frame.following) goRest(); else wake(); });
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") wake(); });
  if (reduce.addEventListener) reduce.addEventListener("change", goRest);

  fx.onFrame = function (fn) { subs.push(fn); wake(); };
  fx.wake = wake;
  fx.frame = frame;
})(window.PD = window.PD || {});
