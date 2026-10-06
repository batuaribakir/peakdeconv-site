// Circuit formation (beat 11): a recursive "PCB trace" tree grown with its own LCG,
// laid on a tilted ground plane and slightly raised. Dots gather on it from the far
// (top) branches to the near ones; a faint mesh of strokes and pads then takes over.
//
// Tree space: u in [0, 1] across, v in [0, 1] depth (root at v 0.16, tips up to 0.96).

import { clamp01 } from './math.js';

export const V0 = 0.16, VMAX = 0.96;
const MIN_ALPHA = 0.001;   // mesh elements fainter than this are not drawn
const MAX_DEPTH = 6;

/** LCG s -> (9301 s + 49297) mod 233280, independent of Math.random. */
function lcg(seed) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

/** Grow the tree: segments (trunks along v, buses across u) and pads (short side stubs). */
export function circuitTree(seed = 15507) {
  const rnd = lcg(seed);
  const segs = [], pads = [];
  const grow = (u, v0, depth) => {
    if (v0 >= VMAX || depth > MAX_DEPTH) return;
    const v1 = Math.min(VMAX, v0 + 0.085 + rnd() * 0.14);
    segs.push({ u1: u, v1: v0, u2: u, v2: v1, depth });
    const nPads = 2 + Math.floor(rnd() * 2);
    for (let i = 0; i < nPads; i++) {
      const v = v0 + (v1 - v0) * ((i + 1) / (nPads + 1));
      const sign = rnd() < 0.5 ? -1 : 1, len = 0.016 + rnd() * 0.012;
      pads.push({ u1: u, v1: v, u2: u + sign * len, v2: v, depth });
    }
    if (depth < MAX_DEPTH - 1 && rnd() < 0.95) {
      const k = 2 + (rnd() < 0.55 ? 1 : 0), spread = (0.11 + rnd() * 0.12) / (depth + 1);
      const us = [];
      for (let i = 0; i < k; i++) us.push(Math.max(0.06, Math.min(0.94, u + (i - (k - 1) / 2) * spread)));
      segs.push({ u1: Math.min(...us), v1, u2: Math.max(...us), v2: v1, depth });
      for (const c of us) grow(c, v1, depth + 1);
    } else {
      const sign = rnd() < 0.5 ? -1 : 1;
      pads.push({ u1: u, v1, u2: u + sign * 0.024, v2: v1, depth });
    }
  };
  grow(0.5, V0, 0);
  return { segs, pads };
}

/** Tree space -> stage px on a ground plane between `horizon` and `base`. */
export function circuitPlane({ W, horizon, base }) {
  return {
    ground: (u, v) => [W / 2 + (u - 0.5) * W * (0.26 + 0.92 * v), horizon + (base - horizon) * Math.pow(v, 1.5)],
    lift: v => 34 * (0.42 + 0.85 * v),
    order: v => (v - V0) / (VMAX - V0),     // reveal order: 0 at the root, 1 at the tips
  };
}

/** Dot targets [x, y, order] every ~3 px along the raised traces and pads. */
export function circuitPoints(tree, plane) {
  const { ground, lift, order } = plane, pts = [];
  for (const s of tree.segs) {
    const a = ground(s.u1, s.v1), b = ground(s.u2, s.v2), r = order(Math.min(s.v1, s.v2));
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], (b[1] - lift(s.v2)) - (a[1] - lift(s.v1))) / 3));
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = s.u1 + (s.u2 - s.u1) * t, v = s.v1 + (s.v2 - s.v1) * t, g = ground(u, v);
      pts.push([g[0], g[1] - lift(v), r]);
    }
  }
  for (const p of tree.pads) {
    const a = ground(p.u1, p.v1), b = ground(p.u2, p.v2), h = lift(p.v1), r = order(p.v1);
    const x0 = a[0], y0 = a[1] - h, x1 = b[0], y1 = b[1] - h;
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 3));
    for (let i = 0; i <= n; i++) { const t = i / n; pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r]); }
  }
  return pts;
}

/**
 * Pre-computes the mesh geometry (stage px) so a frame only sets alphas and strokes:
 * traces as polylines along the raised path, two legs down to the ground per trace,
 * pads as a stub plus a 3x3 square at the tip.
 */
export function circuitMesh(tree, plane) {
  const { ground, lift, order } = plane;
  const traces = tree.segs.map(s => {
    const steps = Math.max(1, Math.ceil(Math.abs(s.v2 - s.v1) / 0.02 - 1e-9));
    const path = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, u = s.u1 + (s.u2 - s.u1) * t, v = s.v1 + (s.v2 - s.v1) * t, g = ground(u, v);
      path.push(g[0], g[1] - lift(v));
    }
    const ga = ground(s.u1, s.v1), gb = ground(s.u2, s.v2);
    const vmid = (s.v1 + s.v2) / 2;
    return {
      path, order: order(Math.min(s.v1, s.v2)),
      legs: [ga[0], ga[1], ga[0], ga[1] - lift(s.v1), gb[0], gb[1], gb[0], gb[1] - lift(s.v2)],
      k: Math.max(0.06, 0.6 - 0.055 * s.depth) * (0.18 + 0.82 * Math.min(1, 1.25 * vmid)) * 0.42,
    };
  });
  const pads = tree.pads.map(p => {
    const a = ground(p.u1, p.v1), b = ground(p.u2, p.v2), h = lift(p.v1);
    return { x0: a[0], y0: a[1] - h, x1: b[0], y1: b[1] - h, order: order(p.v1), k: 0.168 * (0.18 + 0.82 * Math.min(1, 1.25 * p.v1)) };
  });
  return { traces, pads };
}

/** Per-element reveal weight: far branches (low order) arrive first. */
export const revealOf = (Q, order) => clamp01((1.28 * Q - order) / 0.26);

/** Draw the mesh. ctx is in identity transform on entry; E = backing px per stage px. */
export function drawCircuitMesh(ctx, mesh, { Q, weight, E, rgb }) {
  const col = `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})`;
  ctx.save();
  ctx.setTransform(E, 0, 0, E, 0, 0);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  let strokes = 0;
  for (const tr of mesh.traces) {
    const rev = revealOf(Q, tr.order);
    if (rev <= 0) continue;
    const a = weight * rev * tr.k;
    if (a < MIN_ALPHA) continue;
    const p = tr.path;
    ctx.globalAlpha = a;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
    ctx.stroke();
    const g = tr.legs;
    for (let i = 0; i < 8; i += 4) {
      ctx.globalAlpha = a * 0.45;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(g[i], g[i + 1]);
      ctx.lineTo(g[i + 2], g[i + 3]);
      ctx.stroke();
    }
    strokes += 3;
  }
  for (const pd of mesh.pads) {
    const rev = revealOf(Q, pd.order);
    if (rev <= 0) continue;
    const a = weight * rev * pd.k;
    if (a < MIN_ALPHA) continue;
    ctx.globalAlpha = a;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(pd.x0, pd.y0);
    ctx.lineTo(pd.x1, pd.y1);
    ctx.stroke();
    ctx.globalAlpha = Math.min(1, a * 1.3);
    ctx.fillRect(pd.x1 - 1.5, pd.y1 - 1.5, 3, 3);
    strokes++;
  }
  ctx.restore();
  return strokes;
}
