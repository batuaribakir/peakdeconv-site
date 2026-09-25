/* ==========================================================================
   Background scene — our own light 3D scene (Three.js r134, global THREE).
   Same interaction language as the reference Spline scene, on a light ground:

     · three twisted ribbons with a soft iridescent (view-angle) shader,
       slowly undulating, at different depths
     · fine drifting particles through the volume
     · a perspective camera that sways toward the pointer (damped by the
       shared pointer controller) and rises gently with page scroll
     · film grain from CSS (see .scene-grain in css/depth.css)

   Rendered at reduced resolution (config.scene.renderScale) so the ribbons
   read soft and the GPU cost stays low. Driven by the one frame loop in
   pointer-controller.js; paused when the tab is hidden, rendered once and
   left still under prefers-reduced-motion.
   ========================================================================== */
(function (P) {
  "use strict";
  var fx = P.fx, C = fx.config, SC = C.scene;
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
  fx.onFrame(function (f, moving) {
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

  fx.scene = { renderer: renderer, scene: scene, camera: camera, resize: resize };
})(window.PD = window.PD || {});
