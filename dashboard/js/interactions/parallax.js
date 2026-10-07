/* ==========================================================================
   Depth parallax.
   Any element with data-depth="<level>" (levels in fx.depth.layers, set in
   config.js) is shifted by the damped camera tilt × that level's travel. The
   tilt comes from the shared frame loop of ../../assets/js/ambient-scene.js
   (window.MavisAmbient), so the page has one pointer listener. Uses the
   individual CSS `translate` property, so it composes with the elements'
   own `transform` (reveal animations, hover lifts) instead of fighting it.

   Scene layers (inside #scene-layer) additionally get the camera's small
   yaw/pitch rotation, and drift with page scroll, like the Spline camera
   looking into a deeper space.

   Scoped CSS variables for scene extras: --mouse-x / --mouse-y (raw 0…1)
   and --parallax-x / --parallax-y (damped −1…1), written on #scene-layer
   only — never on :root, so the dashboard's styles are not invalidated
   every frame.
   ========================================================================== */
(function (P) {
  "use strict";
  var A = window.MavisAmbient, fx = P.fx, D = fx.depth;
  if (!A || !A.onFrame) return;   // the shared scene script did not load
  var C = A.config;
  var scene = document.getElementById("scene-layer");
  var layers = [];            // { el, amount, scroll, rotate, visible, last }
  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.target.__px) e.target.__px.visible = e.isIntersecting; });
    A.wake();
  }, { rootMargin: "200px" }) : null;

  function collect() {
    document.querySelectorAll("[data-depth]").forEach(function (el) {
      if (el.__px) return;
      var level = el.getAttribute("data-depth");
      if (!(level in D.layers)) return;
      var inScene = scene && scene.contains(el);
      var rec = { el: el, amount: D.layers[level], scroll: (D.scrollDrift[level] || 0), rotate: inScene, visible: true, last: "" };
      el.__px = rec;
      layers.push(rec);
      if (io && !inScene) io.observe(el);
    });
  }

  function apply(f) {
    var px = f.motion ? f.px : 0, py = f.motion ? f.py : 0;
    for (var i = 0; i < layers.length; i++) {
      var L = layers[i];
      if (!L.visible) continue;
      var x = px * L.amount, y = py * L.amount * D.verticalRatio - (f.motion ? f.scroll * L.scroll : 0);
      var v = x.toFixed(2) + "px " + y.toFixed(2) + "px";
      if (L.rotate) {
        var ry = (px * C.camera.yawDeg).toFixed(3), rx = (-py * C.camera.pitchDeg).toFixed(3);
        v += "|" + ry + "|" + rx;
        if (v === L.last) continue;
        L.el.style.transform = "perspective(1600px) rotateY(" + ry + "deg) rotateX(" + rx + "deg)";
      } else if (v === L.last) continue;
      L.el.style.translate = x.toFixed(2) + "px " + y.toFixed(2) + "px";
      L.last = v;
    }
    if (scene) {
      scene.style.setProperty("--parallax-x", px.toFixed(4));
      scene.style.setProperty("--parallax-y", py.toFixed(4));
      scene.style.setProperty("--mouse-x", ((f.lx / innerWidth) || 0).toFixed(4));
      scene.style.setProperty("--mouse-y", ((f.ly / innerHeight) || 0).toFixed(4));
    }
  }

  fx.parallax = { refresh: function () { collect(); A.wake(); } };
  document.addEventListener("pd:surfaces", fx.parallax.refresh);
  collect();
  A.onFrame(apply);
})(window.PD = window.PD || {});
