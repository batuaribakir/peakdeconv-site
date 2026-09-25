/* ==========================================================================
   Cursor light — the spot-light / glass-light response around the pointer
   (origin: Spot Light + Follow cursor in telecom_dashboard.spline; damping
   and reset driven by the shared pointer controller).

   The pointer casts a soft, dark-violet shading (colour: --shade-tint in
   css/depth.css) rather than a white highlight. Three parts, all transform-
   or small-element driven:
   1. .light-field (behind content): a broad violet pool under the glass.
   2. .light-overlay (above content, pointer-events: none): a faint violet
      core so the shading also reads over white panels.
   3. every glass surface ([data-lift]) gets one injected .glass-light child
      that carries local pointer coords (--mx/--my), proximity (--near) and
      intensity (--li): violet sheen and rim. Its shadow is cast away from
      the pointer (box-shadow on the surface, quantised so it is only
      rewritten when it actually changes).
   Reads (rects) happen before writes each frame — no layout thrashing.
   ========================================================================== */
(function (P) {
  "use strict";
  var fx = P.fx;
  var field = document.getElementById("light-field");
  var overlay = document.getElementById("light-overlay");
  if (!field || !overlay) return;
  var glow = field.querySelector(".lf-glow"), ovCore = overlay.querySelector(".lo-core");

  var SHADOW = "46,30,78";  // dark violet, matches --shade-tint
  var surfaces = [];  // { el, span, visible, shadow }
  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.target.__lit) e.target.__lit.visible = e.isIntersecting; });
    fx.wake();
  }, { rootMargin: "160px" }) : null;

  function collect() {
    document.querySelectorAll("[data-lift]").forEach(function (el) {
      var rec = el.__lit;
      if (!rec) {
        rec = el.__lit = { el: el, span: null, visible: !io, shadow: "" };
        surfaces.push(rec);
        if (io) io.observe(el);
      }
      // views may re-render their innerHTML (drawer, plate, team) — re-attach
      if (!rec.span || rec.span.parentNode !== el) {
        rec.span = document.createElement("span");
        rec.span.className = "glass-light";
        rec.span.setAttribute("aria-hidden", "true");
        el.appendChild(rec.span);
      }
    });
  }

  function apply(f, moving) {
    if (!moving) return;
    var x = f.lx, y = f.ly, li = f.li;
    var t = "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0)";
    glow.style.transform = t; ovCore.style.transform = t;
    var lis = li.toFixed(3);
    field.style.setProperty("--li", lis); overlay.style.setProperty("--li", lis);

    // read phase
    var reads = [];
    for (var i = 0; i < surfaces.length; i++) {
      var s = surfaces[i];
      if (!s.visible || !s.span) continue;
      reads.push([s, s.el.getBoundingClientRect()]);
    }
    // write phase
    var reach = Math.max(520, innerWidth * 0.42);
    for (var j = 0; j < reads.length; j++) {
      var S = reads[j][0], b = reads[j][1];
      var nx = Math.max(b.left, Math.min(x, b.right)), ny = Math.max(b.top, Math.min(y, b.bottom));
      var dNear = Math.hypot(nx - x, ny - y);
      var near = Math.max(0, 1 - dNear / reach) * li;
      var cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      var dx = cx - x, dy = cy - y, d = Math.hypot(dx, dy) || 1;
      var len = Math.min(22, d * 0.024) * (0.3 + 0.7 * li);
      var st = S.span.style;
      st.setProperty("--mx", (x - b.left).toFixed(0) + "px");
      st.setProperty("--my", (y - b.top).toFixed(0) + "px");
      st.setProperty("--near", near.toFixed(3));
      st.setProperty("--li", lis);
      var sx = Math.round(dx / d * len * 2) / 2, sy = Math.round((12 + dy / d * len) * 2) / 2;
      var sa = (0.1 + 0.1 * near).toFixed(2);
      var sh = "inset 0 1px 0 rgba(255,255,255,.75), 0 1px 2px rgba(31,43,56,.05), " + sx + "px " + sy + "px 46px -18px rgba(" + SHADOW + "," + sa + ")";
      if (sh !== S.shadow) { S.el.style.boxShadow = sh; S.shadow = sh; }
    }
  }

  fx.light = { refresh: function () { collect(); fx.wake(); } };
  document.addEventListener("pd:surfaces", fx.light.refresh);
  collect();
  fx.onFrame(apply);
})(window.PD = window.PD || {});
