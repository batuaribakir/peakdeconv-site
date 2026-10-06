// Particle field for canvas#dots.
//
//   const field = createField(canvas, { config, chart, reducedMotion, touch, random, palette, circuitSeed });
//   (circuitSeed defaults to DEFAULT_CIRCUIT_SEED = 15507)
//   field.resize(stageScale, dpr);      // on mount and when the stage fit changes
//   field.frame(now, L);                // once per animation frame (L = eased progress 0..1)
//   field.pointerMove(x, y); field.pointerLeave();   // stage px
//   field.refreshPalette();             // after body.inverted toggles
//   field.destroy();
//
// One Canvas2D context, no offscreen buffers. Dots are 1x1 backing-px fillRects under an
// identity transform; the line scene and the circuit mesh are strokes under setTransform(E).
// Every drawn frame starts with a full clear; a frame whose state is unchanged and that has
// nothing moving (no dots, no mesh) is skipped, so static line scenes are drawn once.

import { clamp01, S } from './math.js';
import { weights, KEY_FIELDS, BEATS, cameraAt, REST_CAMERA, FAR_REST } from './schedule.js';
import { viewOf } from './world.js';
import { sampleTravel } from './sampler.js';
import { chartPoints } from './chart.js';
import { circuitTree, circuitPlane, circuitPoints, circuitMesh, drawCircuitMesh } from './circuit.js';
import { particleScale, createParticles, assignChart, assignAll } from './particles.js';
import { createLadder } from './quality.js';
import { drawTravel } from './travel.js';

export { chartAnchor } from './chart.js';
export { weights, cameraAt } from './schedule.js';

export const DEFAULT_PALETTE = Object.freeze({
  ink: [3, 16, 17], cream: [244, 239, 230], teal: [34, 190, 198], dotLight: [244, 239, 230], dotDark: [10, 22, 26],
});

// Circuit tree seed. The reference grows its tree from seed 11, which is not shipped. 15507
// was picked from seeds 0..39999 as the one closest to that tree in size (123 segments,
// 235 pads, 604 mesh strokes, 7395 dot targets vs 123 / 236 / 605 / 7572) and in shape
// (root trunk at the top centre, first bus spanning u 0.10..0.84, 53 % of the trace length
// left of centre); see the seed search in the field report.
export const DEFAULT_CIRCUIT_SEED = 15507;

const POINTER_RADIUS = 170, POINTER_PULL = 0.22, POINTER_DECAY = 0.3;
const FOLLOW_RATE = 6, SNAP_PX = 0.35;
const DOT_ALPHA = 0.78;
const E_MIN = 0.4, REF_AREA = 1920 * 1080;

export function createField(canvas, opts = {}) {
  const {
    config, chart, reducedMotion = false, touch = false, random = Math.random,
    palette = () => DEFAULT_PALETTE, circuitSeed = DEFAULT_CIRCUIT_SEED,
    ladderRecovery = true,   // false: strict reference behaviour (the ladder never steps back up)
  } = opts;
  if (!config || !chart) throw new Error('createField: config and chart are required');
  const ctx = canvas.getContext('2d');
  const W = config.stage.w, H = config.stage.h;
  const view = viewOf(config);
  const portrait = config.name === 'portrait';
  const reduced = !!reducedMotion;

  // ---- particles and formations (random draws in this exact order) ----------------
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const scale = particleScale(nav.hardwareConcurrency, nav.deviceMemory);
  const total = Math.round(config.particles.total * scale);
  const ambient = Math.round(config.particles.ambient * scale);
  const P = createParticles({ total, ambient, W, H, random });

  const chartPts = chartPoints(chart, config.chart);
  const roadSample = sampleTravel(total, { cam: REST_CAMERA, far: FAR_REST, view, renderK: E_MIN });
  const tree = circuitTree(circuitSeed);
  const plane = circuitPlane({ W, horizon: config.circuit.horizon, base: config.circuit.base });
  const circPts = circuitPoints(tree, plane);
  const mesh = circuitMesh(tree, plane);
  const fallL = 5.8 / BEATS, fallCam = cameraAt(fallL);
  const fallSample = sampleTravel(total, { cam: fallCam, far: weights(fallL).far, fall: true, view });
  const T = {
    chart: assignChart(chartPts, P, random),
    road: assignAll(roadSample.points, P, random),
    circuit: assignAll(circPts, P, random, true),
    fall: assignAll(fallSample.points, P, random),
  };

  // ---- runtime state ------------------------------------------------------------------
  const ladder = createLadder({ recover: ladderRecovery });
  let targetE = 0;           // the resolution factor resize() asks for; recovery climbs back to it
  let E = E_MIN, stageScale = 1;
  let G = 0, last = typeof performance !== 'undefined' ? performance.now() : 0, first = true;
  let lastKey = null, lastMoving = true, destroyed = false;
  const cursor = { active: false, x: 0, y: 0, vx: 0, vy: 0 };
  let colors = readPalette();
  let styles = new Map(), styleBase = null;
  const stats = { dots: 0, strokes: 0, meshStrokes: 0, drawn: false, travel: null, frames: 0, skipped: 0 };
  let lastW = null;

  function readPalette() {
    const p = { ...DEFAULT_PALETTE, ...(palette() || {}) };
    return { ink: p.ink, cream: p.cream, teal: p.teal, dotLight: p.dotLight, dotDark: p.dotDark };
  }

  function applyBacking() {
    const bw = Math.round(W * E), bh = Math.round(H * E);
    if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
    lastKey = null;
  }

  function resize(s, dpr = 1) {
    stageScale = s > 0 ? s : 1;
    const ceilU = Math.min(1, Math.sqrt(REF_AREA / (W * H)));
    const want = Math.max(E_MIN, Math.min(ceilU, Math.round(stageScale * dpr * 4) / 4));
    targetE = Math.max(targetE, want);
    E = Math.min(ladder.kCeil, Math.max(E, want));
    applyBacking();
  }

  const onVisibility = () => { lastKey = null; };
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);

  // ---- colour strings, cached per (alpha, teal share) at the current base colour ----
  function styleFor(ka, kt, base) {
    if (base !== styleBase) { styles = new Map(); styleBase = base; }
    const key = ka * 256 + kt;
    let s = styles.get(key);
    if (s === undefined) {
      const m = 1 - kt / 255, t = colors.teal;
      const r = Math.round(t[0] + (base[0] - t[0]) * m), g = Math.round(t[1] + (base[1] - t[1]) * m), b = Math.round(t[2] + (base[2] - t[2]) * m);
      s = `rgba(${r},${g},${b},${ka / 255})`;
      styles.set(key, s);
    }
    return s;
  }
  let baseCache = { inv: NaN, rgb: null, colors: null };
  function baseColour(inv) {
    if (baseCache.inv !== inv || baseCache.colors !== colors) {
      const l = colors.dotLight, d = colors.dotDark;
      baseCache = { inv, colors, rgb: [Math.round(l[0] + (d[0] - l[0]) * inv), Math.round(l[1] + (d[1] - l[1]) * inv), Math.round(l[2] + (d[2] - l[2]) * inv)] };
    }
    return baseCache.rgb;
  }

  // ---- one pass over the particles: move, then draw ----------------------------------
  function drawDots(w, dt) {
    const { ax, ay, p1, p2, s1, s2, amp, a, fallV, x, y } = P;
    const tc = T.chart, tr = T.road, tf = T.fall, tq = T.circuit;
    const budget = Math.max(ambient, Math.round(total * ladder.dotK));
    const B = Math.min(1, FOLLOW_RATE * dt), hard = first || reduced;
    const C = w.C, roadMix = w.roadMix, roadDot = w.roadDot, fallOn = w.fallOn, fallDot = w.fallDot;
    const Q = w.Q, Q128 = 1.28 * Q, fallDrop = w.P * w.P, gridKeep = 1 - w.gridFade;
    const circK = 0.5 * (1 - w.chipTake), ambA = w.ambientAlpha;
    const base = baseColour(w.invert);
    const Ls = Math.max(1, Math.round(E)) * (touch ? 1.5 : 1);
    const grab = w.grab, pointerOn = !touch && !reduced && cursor.active && grab > 0;
    const cx = cursor.x, cy = cursor.y, vx = cursor.vx, vy = cursor.vy, v2 = vx * vx + vy * vy;
    const Gt = reduced ? 0 : G;
    let current = null, currentKey = -1, drawn = 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (let j = 0; j < budget; j++) {
      let tx = ax[j] + Math.cos(Gt * s1[j] + p1[j]) * amp[j];
      let ty = ay[j] + Math.sin(Gt * s2[j] + p2[j]) * amp[j];
      if (pointerOn) {
        // distance from the dot's last drawn position to the segment the pointer travelled
        const px = x[j], py = y[j];
        const t = v2 > 0 ? clamp01(((px - (cx - vx)) * vx + (py - (cy - vy)) * vy) / v2) : 1;
        const qx = cx - vx * (1 - t) - px, qy = cy - vy * (1 - t) - py, q = Math.hypot(qx, qy);
        if (q < POINTER_RADIUS) {
          const k = S(1 - q / POINTER_RADIUS) * grab;
          ax[j] += vx * k + (cx - px) * k * POINTER_PULL;
          ay[j] += vy * k + (cy - py) * k * POINTER_PULL;
        }
      }
      const inChart = tc.has[j] === 1;
      if (C > 0 && inChart) { tx += (tc.x[j] - tx) * C; ty += (tc.y[j] - ty) * C; }
      if (roadMix > 0) { tx += (tr.x[j] - tx) * roadMix; ty += (tr.y[j] - ty) * roadMix; }
      let snap = hard;
      if (fallOn > 0) { tx = tf.x[j]; ty = tf.y[j] + fallDrop * (2000 + fallV[j]); snap = true; }
      let circW = 0;
      if (Q > 0) {
        circW = (Q128 - tq.order[j]) / 0.26;
        circW = circW < 0 ? 0 : circW > 1 ? 1 : circW;
        if (circW > 0) { tx += (tq.x[j] - tx) * circW; ty += (tq.y[j] - ty) * circW; }
      }
      if (snap) { x[j] = tx; y[j] = ty; }
      else {
        x[j] += (tx - x[j]) * B; if (Math.abs(tx - x[j]) < SNAP_PX) x[j] = tx;
        y[j] += (ty - y[j]) * B; if (Math.abs(ty - y[j]) < SNAP_PX) y[j] = ty;
      }

      // strongest formation decides alpha, teal share and size
      let V = 0, kind = 0;
      if (inChart && C > V) { V = C; kind = 1; }
      if (roadDot > V) { V = roadDot; kind = 2; }
      if (fallDot > V) { V = fallDot; kind = 3; }
      if (circW > V) { V = circW; kind = 4; }
      let alpha, share = 0;
      if (V > 0) {
        const a0 = kind === 2 || kind === 3 ? a[j] * gridKeep : a[j];
        alpha = a0 + (DOT_ALPHA - a0) * V;
        if (kind === 4) alpha *= circK;
        else if (kind === 1) share = tc.teal[j] ? C : 0;
        else if (kind === 2) share = roadMix;
        else if (kind === 3) share = 1;
      } else {
        alpha = a[j] * ambA;
        if (alpha < 0.01) continue;
      }
      const key = Math.round(alpha * 255) * 256 + Math.round(share * 255);
      if (key !== currentKey) {
        const style = styleFor(key >> 8, key & 255, base);
        if (style !== current) { ctx.fillStyle = style; current = style; }
        currentKey = key;
      }
      const s = V > 0 ? Ls + (1 - Ls) * S(V) : Ls;
      ctx.fillRect(Math.round(x[j] * E), Math.round(y[j] * E), s, s);
      drawn++;
    }
    return drawn;
  }

  function stateKey(w) {
    let k = '';
    for (let i = 0; i < KEY_FIELDS.length; i++) k += w[KEY_FIELDS[i]] + ',';
    return k + E + ',' + ladder.detail + ',' + ladder.dotK;
  }

  function frame(now, L) {
    if (destroyed) return;
    const dtMs = now - last;
    last = now;
    const dt = Math.min(0.05, Math.max(0, dtMs / 1000));
    if (!reduced) G += dt;
    const Lc = clamp01(Number.isFinite(L) ? L : 0);
    const w = weights(Lc, reduced);
    lastW = w;
    // quality: the line scene and the dot scenes keep separate levels (quality.js)
    const classChanged = ladder.setClass(w.Ht > 0.01 ? 'travel' : 'light');
    const step = !first && dtMs > 0 ? ladder.sample(dtMs, now) : 0;
    const wantE = Math.min(ladder.kCeil, Math.max(targetE, E_MIN));
    if ((step < 0 && E > ladder.kCeil) || ((step > 0 || classChanged) && wantE !== E)) { E = wantE; applyBacking(); }
    stats.frames++;

    const key = stateKey(w);
    if (key === lastKey && !lastMoving && !first) {
      stats.skipped++; stats.drawn = false;
      cursor.vx *= POINTER_DECAY; cursor.vy *= POINTER_DECAY;
      return;
    }
    lastKey = key;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const lines = w.Ht > 0;
    const dotsOnTop = lines && (w.birth > 0 || w.gridFade < 1);
    let dots = 0, meshStrokes = 0;
    stats.travel = null;
    if (!dotsOnTop) dots = drawDots(w, dt);
    if (!reduced && w.mesh > 0) meshStrokes = drawCircuitMesh(ctx, mesh, { Q: w.Q, weight: w.mesh, E, rgb: colors.cream });
    if (lines) {
      const cam = { x: w.camX, y: w.camY, z: w.camZ, yaw: w.camYaw, pitch: w.camPitch };
      stats.travel = drawTravel(ctx, { w, cam, view, E, stageScale, detail: ladder.detail, colors, portrait });
    }
    if (dotsOnTop) dots = drawDots(w, dt);
    lastMoving = dots > 0 || meshStrokes > 0;
    stats.dots = dots; stats.meshStrokes = meshStrokes; stats.drawn = true;
    first = false;
    cursor.vx *= POINTER_DECAY; cursor.vy *= POINTER_DECAY;
  }

  function pointerMove(sx, sy) {
    if (touch || reduced || destroyed) return;
    if (cursor.active) { cursor.vx += sx - cursor.x; cursor.vy += sy - cursor.y; }
    cursor.x = sx; cursor.y = sy; cursor.active = true;
  }
  function pointerLeave() { cursor.active = false; cursor.vx = 0; cursor.vy = 0; }

  function refreshPalette() { colors = readPalette(); styles = new Map(); styleBase = null; baseCache = { inv: NaN }; lastKey = null; }

  function destroy() {
    destroyed = true;
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
  }

  return {
    resize, frame, pointerMove, pointerLeave, refreshPalette, destroy,
    /** Read-only view of the internals for tests and the dev page. */
    debug: {
      get E() { return E; }, get stageScale() { return stageScale; }, get G() { return G; },
      get quality() { return { kCeil: ladder.kCeil, detail: ladder.detail, dotK: ladder.dotK, steps: ladder.steps, recoveries: ladder.recoveries, sceneClass: ladder.sceneClass, E }; },
      get weights() { return lastW; }, get stats() { return { ...stats }; },
      get cursor() { return { ...cursor }; },
      counts: { total, ambient, scale, chart: chartPts.length, road: roadSample.points.length, fall: fallSample.points.length, circuit: circPts.length, segs: tree.segs.length, pads: tree.pads.length },
      points: { chart: chartPts, road: roadSample.points, fall: fallSample.points, circuit: circPts },
      spacing: { road: roadSample.spacingScale, fall: fallSample.spacingScale },
      particles: P, targets: T, tree, view,
      invalidate() { lastKey = null; },
    },
  };
}
