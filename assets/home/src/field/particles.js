// Particle buffers and formation assignment.
//
// Every particle has a drift anchor, two drift sinusoids, a fixed ambient alpha (only the
// first `ambient` particles have one; the rest exist to fill formations) and a fall speed.
// All attributes are float32, drawn from `random` in a fixed order so a seeded generator
// reproduces the field exactly.

import { shuffle } from './math.js';

/** Device class scale for the particle count (cores / GB of memory; 1 when unknown). */
export function particleScale(cores, memoryGB) {
  let s = 1;
  if (cores) { if (cores <= 2) s = Math.min(s, 0.45); else if (cores <= 4) s = Math.min(s, 0.7); }
  if (memoryGB) { if (memoryGB <= 1) s = Math.min(s, 0.4); else if (memoryGB <= 2) s = Math.min(s, 0.55); else if (memoryGB <= 4) s = Math.min(s, 0.8); }
  return Math.max(0.4, s);
}

export function createParticles({ total, ambient, W, H, random }) {
  const f32 = () => new Float32Array(total);
  const p = {
    total, ambient,
    ax: f32(), ay: f32(), p1: f32(), p2: f32(), s1: f32(), s2: f32(), amp: f32(), a: f32(), fallV: f32(),
    x: f32(), y: f32(),                       // drawn position (stage px)
  };
  const TWO_PI = Math.PI * 2;
  for (let j = 0; j < total; j++) {
    p.ax[j] = random() * W;
    p.ay[j] = random() * H;
    p.p1[j] = random() * TWO_PI;
    p.p2[j] = random() * TWO_PI;
    p.s1[j] = 0.08 + random() * 0.14;         // rad/s, x drift
    p.s2[j] = 0.05 + random() * 0.1;          // rad/s, y drift
    p.amp[j] = 24 + random() * 60;            // drift radius, stage px
    p.a[j] = j < ambient ? 0.22 + random() * 0.26 : 0;
    p.fallV[j] = 500 + random() * 1400;       // extra fall distance
  }
  return p;
}

/**
 * A formation's per-particle targets. `has` marks members (only the chart leaves some
 * particles out); `teal` flags teal points (chart); `order` is the circuit reveal order.
 */
function emptyTargets(total) {
  return { x: new Float32Array(total), y: new Float32Array(total), teal: new Uint8Array(total), order: new Float32Array(total), has: new Uint8Array(total) };
}

const indexList = n => { const a = new Array(n); for (let i = 0; i < n; i++) a[i] = i; return a; };

/**
 * Chart: points are shuffled, particle indices are shuffled, the first min(points, total)
 * particles get one point each, then every ambient particle still without one gets a
 * random point of the unshuffled list (so the whole ambient field joins the chart).
 */
export function assignChart(points, { total, ambient }, random) {
  const t = emptyTargets(total);
  const pts = shuffle(points.slice(), random), idx = shuffle(indexList(total), random);
  const n = Math.min(pts.length, total);
  for (let i = 0; i < n; i++) {
    const j = idx[i], q = pts[i];
    t.x[j] = q[0]; t.y[j] = q[1]; t.teal[j] = q[2] ? 1 : 0; t.has[j] = 1;
  }
  if (points.length) {
    // the extra points come from the list in its original (drawing) order
    for (let j = 0; j < ambient; j++) {
      if (t.has[j]) continue;
      const q = points[Math.floor(random() * points.length)];
      t.x[j] = q[0]; t.y[j] = q[1]; t.teal[j] = q[2] ? 1 : 0; t.has[j] = 1;
    }
  }
  return t;
}

/** Road / fall / circuit: every particle gets point[i mod n] after both shuffles. */
export function assignAll(points, { total }, random, withOrder = false) {
  const t = emptyTargets(total);
  const pts = shuffle(points.slice(), random), idx = shuffle(indexList(total), random);
  const n = pts.length;
  if (!n) return t;
  for (let i = 0; i < total; i++) {
    const j = idx[i], q = pts[i % n];
    t.x[j] = q[0]; t.y[j] = q[1]; t.has[j] = 1;
    if (withOrder) t.order[j] = q[2];
  }
  return t;
}
