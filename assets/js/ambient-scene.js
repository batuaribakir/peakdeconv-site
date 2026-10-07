/* ==========================================================================
   MAVIS — ambient scene
   The light 3D background of the product pages (Dashboard, Presentations,
   Team): three slowly undulating ribbons and drifting particles behind the
   content, seen through a camera that sways toward the pointer and rises
   with page scroll. Home has its own scroll scene and never loads this.

   Moved here unchanged from the dashboard (js/interactions/config.js,
   pointer-controller.js and background-scene.js), so every page runs the
   same scene with the same settings. Needs, before it:
     · the markup  <div id="scene-layer" class="scene-layer" aria-hidden="true">
                     <canvas id="scene-canvas" class="scene-canvas"></canvas>
                     <div class="scene-grain"></div></div>
     · assets/css/ambient-scene.css
     · Three.js r134 (global THREE); without it the layer keeps its CSS
       ground and only the frame loop runs.

   Exposes window.MavisAmbient:
     config            camera / scene / light settings (below)
     onFrame(fn)       subscribe to the shared frame loop; fn(frame, moving)
     wake()            ask for a frame
     frame             the damped pointer state (see "frame loop")
     scene             { renderer, scene, camera, resize } once running
   The dashboard's content parallax (dashboard/js/interactions/parallax.js)
   subscribes to the same loop, so a page never has a second pointer listener.

   Motion: one pointermove listener (mouse and pen only: touch never moves the
   camera), one requestAnimationFrame loop that sleeps when nothing moves,
   paused while the tab is hidden. Under prefers-reduced-motion the camera
   stays at rest and the scene is drawn once and left still.
   ========================================================================== */
(function () {
  "use strict";
  var A = window.MavisAmbient = window.MavisAmbient || {};

  /* ---------- settings -------------------------------------------------------
     The interaction language follows the Spline reference scene
     (dashboard/assets/spline/interactive_3_d_parallax_scene.spline): hover-tilt
     camera, damping 0.125 per frame, reset on pointer leave, depth-layered
     ribbons + particles, rebuilt as our own light scene with a wider
     horizontal sway.                                                         */
  A.config = {
    camera: {
      yawDeg: 7,            // horizontal sway of the 3D camera (reference scene: 2°, widened on request)
      pitchDeg: 2.2,        // vertical sway
      panX: 0.55,           // extra sideways camera travel (world units) at full deflection
      damping: 0.125,       // fraction closed per 60 fps frame (reference scene value)
      resetOnLeave: true
    },

    scene: {
      fov: 35,
      distance: 10,
      renderScale: 0.6,     // render below device resolution: softer ribbons, lighter GPU load
      scrollLift: 1.4,      // camera rises this much (world units) over the full page scroll
      particles: 220,
      // ribbons: control points (x, y, z), width, twist turns, opacity, hue offset
      ribbons: [
        { pts: [[-9, 3.6, -3], [-4, 1.6, -1.5], [0.5, 3.1, -0.8], [5, 1.0, -2.2], [10, 2.9, -4]], width: 1.7, twist: 1.25, opacity: 0.74, hue: 0.0,  speed: 0.32 },
        { pts: [[-10, -3.4, -1.5], [-4.5, -1.2, 0.6], [0.5, -2.9, 1.2], [5, -1.0, -0.6], [10, -2.8, -2.5]], width: 1.25, twist: 0.9, opacity: 0.66, hue: 0.33, speed: 0.26 },
        { pts: [[-12, -0.6, -9], [-6, 2.6, -8], [0, -0.4, -7], [6, 2.8, -8], [12, 0.2, -9.5]], width: 3.2, twist: 0.6, opacity: 0.46, hue: 0.62, speed: 0.18 }
      ]
    },

    light: {
      followSpeed: 9,     // 1/s — pointer position follow
      resetSpeed: 5,      // 1/s — ease back when the pointer leaves
      restIntensity: 0.38,
      activeIntensity: 1,
      rest: { x: 0.78, y: 0.12 } // fraction of the viewport
    }
  };

  /* ---------- frame loop: one pointer listener, one rAF loop ---------------
     Subscribers receive the same damped state:
       frame.px, frame.py   camera tilt, normalised −1…1 (damped, Spline 0.125/frame)
       frame.lx, frame.ly   pointer position in viewport px (faster follow damping)
       frame.li             pointer activity (rest → active)
       frame.rawX, rawY     last raw pointer position
       frame.scroll         0…1 page scroll progress
       frame.dt, frame.t    seconds since last frame / timestamp
     The loop sleeps when nothing moves and no subscriber asks for more frames. */
  var C = A.config;
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

  A.onFrame = function (fn) { subs.push(fn); wake(); };
  A.wake = wake;
  A.frame = frame;

  /* ---------- the scene (Three.js r134, global THREE) ------------------------
     · three twisted ribbons with a soft iridescent (view-angle) shader,
       slowly undulating, at different depths
     · fine drifting particles through the volume
     · film grain from CSS (.scene-grain in assets/css/ambient-scene.css)
     Rendered at reduced resolution (config.scene.renderScale) so the ribbons
     read soft and the GPU cost stays low.                                    */
  (function startScene() {
    var C = A.config, SC = C.scene;
    var root = document.getElementById("scene-layer");
    var canvas = document.getElementById("scene-canvas");
    if (!root || !canvas || !window.THREE) { if (root) root.classList.add("is-static"); return; }
    var THREE = window.THREE;

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: false, powerPreference: "low-power" });
    renderer.setClearColor(0x000000, 0);
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(SC.fov, innerWidth / innerHeight, 0.1, 100);
    var target = new THREE.Vector3(0, 0, 0);

    /* ---------- ribbons ------------------------------------------------------ */
    var ribbonVS = [
      "uniform float uTime; uniform float uSpeed; uniform float uPhase;",
      "attribute vec2 aUv; attribute vec3 aSide;",
      "varying vec2 vUv; varying float vFacing; varying float vDepth;",
      "void main() {",
      "  vUv = aUv;",
      "  vec3 p = position;",
      "  float w = sin(aUv.x * 6.2832 * 0.9 + uTime * uSpeed + uPhase);",
      "  p.y += w * 0.22; p.z += cos(aUv.x * 5.0 + uTime * uSpeed * 0.8 + uPhase) * 0.18;",
      "  vec4 mv = modelViewMatrix * vec4(p, 1.0);",
      "  vec3 n = normalize(normalMatrix * normal);",
      "  vFacing = abs(dot(n, normalize(-mv.xyz)));",
      "  vDepth = -mv.z;",
      "  gl_Position = projectionMatrix * mv;",
      "}"
    ].join("\n");
    var ribbonFS = [
      "uniform float uTime; uniform float uOpacity; uniform float uHue;",
      "varying vec2 vUv; varying float vFacing; varying float vDepth;",
      // pastel cosine palette: teal → violet → rose → gold (project accents, lightened)
      "vec3 pal(float t) { return vec3(0.80) + vec3(0.20, 0.18, 0.20) * cos(6.2832 * (vec3(1.0) * t + vec3(0.00, 0.28, 0.58))); }",
      "void main() {",
      "  float fres = 1.0 - vFacing;",
      "  float t = vUv.x * 0.85 + fres * 0.55 + uHue + uTime * 0.012;",
      "  vec3 col = pal(t);",
      "  col = mix(col, vec3(1.0), 0.18 + 0.25 * vFacing);",           // sheen where the band faces us
      "  float across = smoothstep(0.0, 0.42, vUv.y) * smoothstep(1.0, 0.58, vUv.y);", // soft edges
      "  float along = smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x);",
      "  float a = uOpacity * across * along * (0.45 + 0.55 * fres + 0.25 * vFacing);",
      "  gl_FragColor = vec4(col, a);",
      "}"
    ].join("\n");

    function buildRibbon(R, i) {
      var curve = new THREE.CatmullRomCurve3(R.pts.map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); }), false, "centripetal");
      var SEG = 260;
      var frames = curve.computeFrenetFrames(SEG, false);
      var pos = [], uv = [], nrm = [], idx = [];
      for (var s = 0; s <= SEG; s++) {
        var t = s / SEG, p = curve.getPointAt(t);
        var ang = R.twist * Math.PI * 2 * t + i * 1.3;
        var dir = frames.normals[s].clone().multiplyScalar(Math.cos(ang)).add(frames.binormals[s].clone().multiplyScalar(Math.sin(ang)));
        var nor = new THREE.Vector3().crossVectors(frames.tangents[s], dir).normalize();
        var w = R.width * (0.55 + 0.45 * Math.sin(Math.PI * t));
        [1, -1].forEach(function (side, k) {
          pos.push(p.x + dir.x * w * 0.5 * side, p.y + dir.y * w * 0.5 * side, p.z + dir.z * w * 0.5 * side);
          nrm.push(nor.x, nor.y, nor.z);
          uv.push(t, k);
        });
        if (s < SEG) { var a = s * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
      g.setAttribute("aUv", new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      var m = new THREE.ShaderMaterial({
        vertexShader: ribbonVS, fragmentShader: ribbonFS, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 }, uSpeed: { value: R.speed }, uPhase: { value: i * 2.1 }, uOpacity: { value: R.opacity }, uHue: { value: R.hue } }
      });
      var mesh = new THREE.Mesh(g, m);
      mesh.renderOrder = -i;
      return mesh;
    }
    var ribbons = SC.ribbons.map(buildRibbon);
    ribbons.forEach(function (r) { scene.add(r); });

    /* ---------- particles ---------------------------------------------------- */
    var N = SC.particles, pp = new Float32Array(N * 3), ps = new Float32Array(N);
    for (var k = 0; k < N; k++) {
      pp[k * 3] = (Math.random() - 0.5) * 26; pp[k * 3 + 1] = (Math.random() - 0.5) * 14; pp[k * 3 + 2] = -10 + Math.random() * 13;
      ps[k] = 0.6 + Math.random() * 1.6;
    }
    var pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.BufferAttribute(pp, 3));
    pg.setAttribute("aSize", new THREE.BufferAttribute(ps, 1));
    var pm = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime: { value: 0 }, uPx: { value: 1 } },
      vertexShader: [
        "uniform float uTime; uniform float uPx; attribute float aSize; varying float vA;",
        "void main() {",
        "  vec3 p = position; p.y += sin(uTime * 0.12 + position.x * 0.7) * 0.25; p.x += cos(uTime * 0.09 + position.y) * 0.2;",
        "  vec4 mv = modelViewMatrix * vec4(p, 1.0);",
        "  gl_PointSize = aSize * uPx * (14.0 / -mv.z);",
        "  vA = clamp(1.2 - (-mv.z) / 22.0, 0.25, 1.0);",
        "  gl_Position = projectionMatrix * mv;",
        "}"].join("\n"),
      fragmentShader: [
        "varying float vA;",
        "void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.1, d) * 0.32 * vA; gl_FragColor = vec4(0.27, 0.25, 0.36, a); }"].join("\n")
    });
    scene.add(new THREE.Points(pg, pm));

    /* ---------- sizing ------------------------------------------------------- */
    function resize() {
      var pr = Math.min(window.devicePixelRatio || 1, 2) * SC.renderScale;
      renderer.setPixelRatio(pr);
      renderer.setSize(innerWidth, innerHeight, false);
      camera.aspect = innerWidth / innerHeight;
      // keep the composition: narrower screens pull the camera back a little
      camera.userData.dist = SC.distance * Math.max(1, 1.45 / Math.max(camera.aspect, 0.5));
      camera.updateProjectionMatrix();
      pm.uniforms.uPx.value = pr * 2;
      dirty = true;
    }
    var dirty = true, time = 0, readyOnce = false;
    window.addEventListener("resize", resize);
    resize();

    /* ---------- frame -------------------------------------------------------- */
    A.onFrame(function (f, moving) {
      if (document.visibilityState !== "visible") return false;
      if (!f.motion && !moving && !dirty) return false;
      if (f.motion) time += f.dt;
      var yaw = f.px * C.camera.yawDeg * Math.PI / 180;
      var pitch = -f.py * C.camera.pitchDeg * Math.PI / 180;
      var d = camera.userData.dist;
      var lift = f.scroll * SC.scrollLift;
      camera.position.set(
        Math.sin(yaw) * Math.cos(pitch) * d + f.px * C.camera.panX,
        Math.sin(pitch) * d - lift,
        Math.cos(yaw) * Math.cos(pitch) * d
      );
      target.set(f.px * C.camera.panX * 0.4, -lift, 0);
      camera.lookAt(target);
      for (var i = 0; i < ribbons.length; i++) ribbons[i].material.uniforms.uTime.value = time;
      pm.uniforms.uTime.value = time;
      renderer.render(scene, camera);
      dirty = false;
      if (!readyOnce) { readyOnce = true; root.classList.add("is-ready"); }
      return f.motion; // ambient undulation keeps running while motion is allowed
    });

    A.scene = { renderer: renderer, scene: scene, camera: camera, resize: resize };
  })();
})();
