// Line scene of the travel section (beats 2.2 - 5.9): a perspective road that forks, one
// lane climbing into the sky, sine hills around it. Everything is vector strokes with
// vertical teal gradients plus opaque ink-coloured lane bodies, drawn in stage px under
// setTransform(E).
//
// Layers, back to front:
//   1 terrain wireframe   columns along z every 240/detail x, cross lines every 300 z
//   2 lane bodies         opaque quads: footprint, side walls down to the ground (only
//                         where lifted and facing the camera), far cap, top face
//   3 pillars             vertical lines under the raised lane every 300 z (portrait 150),
//                         only on a wall the camera can see
//   4 lane lines          7 lines along each lane + cross lines every 300 z
//   5 centre line         on the shared road before the fork
//   6 lane edges          a wide faint glow, then a bright core, per edge

import { clamp01, mixRGB } from './math.js';
import { LANES, HALF_W, D_FAR, TERRAIN_Z_MAX, terrainHeight, makeProjector } from './world.js';
import { SPLIT_Z, CAM_HEIGHT } from './schedule.js';

// Lane geometry starts 4 depth steps before D = 25 (the reference draws 4 more vertices on
// every lane polyline than a start at 25 gives, at every camera position).
const D_NEAR_TERRAIN = 70, LANE_STEP = 1.02, D_NEAR_LANE = 25 / LANE_STEP ** 4;
// Top / bottom body quads with a corner further than this behind the camera plane are
// dropped (they would otherwise smear across the screen once the camera turns).
const BODY_BEHIND = -12;

const rgbStr = c => `rgb(${c[0]} ${c[1]} ${c[2]})`;
const rgbaStr = (c, a) => `rgb(${c[0]} ${c[1]} ${c[2]} / ${a})`;

// Viewport of the current frame (stage px) for polyline culling; set by drawTravel.
let clipW = 1920, clipH = 1080;
const CLIP_MARGIN = 8;   // wider than half the widest stroke (5) plus anti-aliasing
const outcode = (x, y) => (x < -CLIP_MARGIN ? 1 : x > clipW + CLIP_MARGIN ? 2 : 0) | (y < -CLIP_MARGIN ? 4 : y > clipH + CLIP_MARGIN ? 8 : 0);

/**
 * Add a flat [x0, y0, x1, y1, ...] polyline to the current path; NaN x marks a gap.
 * Segments lying entirely beyond one side of the view are left out (they cannot reach a
 * pixel, but far-off vertices are expensive to rasterize). Returns the lineTo count.
 */
function tracePolyline(ctx, pts, end, start = 0) {
  let pen = false, lines = 0, pc = -1, px = 0, py = 0;
  for (let i = start; i < end; i += 2) {
    const x = pts[i], y = pts[i + 1];
    if (x !== x) { pen = false; pc = -1; continue; }
    const c = outcode(x, y);
    if (pc >= 0) {
      if (c & pc) pen = false;
      else { if (!pen) { ctx.moveTo(px, py); pen = true; } ctx.lineTo(x, y); lines++; }
    }
    px = x; py = y; pc = c;
  }
  return lines;
}

/**
 * Sample a lane-following line: world (xOf(z), yOf(z)) at D = D_NEAR_LANE * 1.02^k up to `far`.
 * Writes into buf (NaN for points behind the camera); returns the used length.
 */
function sampleAlong(project, camZ, far, zFrom, zTo, xOf, yOf, buf, dStart = D_NEAR_LANE, step = LANE_STEP) {
  let n = 0;
  for (let D = dStart; D < D_FAR; D *= step) {
    const z = camZ + D;
    if (z > far || z > zTo) break;
    if (z < zFrom) continue;
    const p = project(xOf(z), yOf(z), z);
    if (p.vis) { buf[n++] = p.x; buf[n++] = p.y; } else { buf[n++] = NaN; buf[n++] = NaN; }
  }
  return n;
}

// Gradient objects are reused while their definition is unchanged: building fresh ones
// every frame is surprisingly expensive (software canvases spend ~10 ms a frame on it).
const gradientCache = new WeakMap();
function cachedGradient(ctx, key, make) {
  let m = gradientCache.get(ctx);
  if (!m) { m = new Map(); gradientCache.set(ctx, m); }
  let g = m.get(key);
  if (!g) { if (m.size > 48) m.clear(); g = make(); m.set(key, g); }
  return g;
}

const BUF = new Float64Array(4096);
const BUF2 = new Float64Array(4096);
const TBUF = new Float64Array(1 << 17), TOFF = new Int32Array(1024);   // terrain vertices

/**
 * Draw the line scene.
 *  w        weights() at the current L (Ht, K, far, terrain, ...)
 *  cam      camera {x, y, z, yaw, pitch}
 *  view     {f, horizon, cx, W, H}
 *  E        backing px per stage px; stageScale for the minimum stroke width
 *  detail   terrain density from the quality ladder
 *  colors   {ink, cream, teal} as [r, g, b]
 *  portrait portrait tweaks (pillars every 150 z at full alpha, fixed gradients, no tint)
 */
export function drawTravel(ctx, { w, cam, view, E, stageScale, detail, colors, portrait }) {
  const { H, horizon } = view;
  const project = makeProjector(cam, view);
  clipW = view.W; clipH = H;
  const far = w.far, camZ = cam.z, Ht = w.Ht;
  const minW = 1.15 / stageScale, lw = v => Math.max(v, minW);
  const h1 = portrait ? 1 : clamp01((cam.y - CAM_HEIGHT) / 1000);
  const hb = portrait ? 0 : clamp01((cam.y - CAM_HEIGHT) / 300);
  const { ink, cream, teal } = colors;
  const counts = { strokes: 0, fills: 0, lineTo: 0, quads: 0 };

  const gTop = horizon - 0.08 * H;
  const tealGradient = (a0, a1) => cachedGradient(ctx, `t${gTop},${H},${teal},${a0},${a1}`, () => {
    const g = ctx.createLinearGradient(0, gTop, 0, H);
    g.addColorStop(0, rgbaStr(teal, a0)); g.addColorStop(1, rgbaStr(teal, a1));
    return g;
  });
  const gradA = tealGradient(0.2 + (0.32 - 0.2) * h1, 0.55 + (0.32 - 0.55) * h1);
  const bodyGradient = q => {
    const mid = mixRGB(ink, cream, 0.1 * q * hb), end = mixRGB(ink, cream, q * hb);
    return cachedGradient(ctx, `b${horizon},${H},${ink},${mid},${end}`, () => {
      const g = ctx.createLinearGradient(0, horizon, 0, H);
      g.addColorStop(0, rgbStr(ink)); g.addColorStop(0.5, rgbStr(mid)); g.addColorStop(1, rgbStr(end));
      return g;
    });
  };
  const gradBodyTop = bodyGradient(0.04), gradBodySide = bodyGradient(0.022), gradBodyBottom = bodyGradient(0.008);

  ctx.save();
  ctx.setTransform(E, 0, 0, E, 0, 0);
  ctx.lineJoin = 'round';

  // ---- 1. terrain wireframe -------------------------------------------------------
  if (w.terrain > 0.02) {
    const zMax = Math.min(far, TERRAIN_Z_MAX), dStep = 1 + 0.02 / detail, xStep = 240 / detail, cStep = 70 / detail;
    const W = view.W;
    let n = 0, lines = 0, onScreen = false;
    const put = p => {
      if (p.vis) {
        TBUF[n++] = p.x; TBUF[n++] = p.y;
        if (!onScreen && p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= H) onScreen = true;
      } else { TBUF[n++] = NaN; TBUF[n++] = NaN; }
    };
    for (let x = -4800; x <= 4800 && n < TBUF.length - 4096; x += xStep) {
      TOFF[lines++] = n;
      for (let D = D_NEAR_TERRAIN; D < D_FAR; D *= dStep) {
        const z = camZ + D;
        if (z > zMax) break;
        put(project(x, terrainHeight(x, z), z));
      }
    }
    for (let z = 300; z <= zMax && n < TBUF.length - 4096; z += 300) {
      if (z - camZ < D_NEAR_TERRAIN) continue;
      TOFF[lines++] = n;
      for (let x = -4800; x <= 4800; x += cStep) put(project(x, terrainHeight(x, z), z));
    }
    TOFF[lines] = n;
    if (onScreen) {
      ctx.strokeStyle = gradA;
      ctx.lineWidth = lw(0.8);
      ctx.globalAlpha = Ht * 0.8 * w.terrain;
      for (let i = 0; i < lines; i++) {
        ctx.beginPath();
        counts.lineTo += tracePolyline(ctx, TBUF, TOFF[i + 1], TOFF[i]);
        ctx.stroke(); counts.strokes++;
      }
    }
  }

  // ---- 2. lane bodies ---------------------------------------------------------------
  // Each lane is a solid from the ground up to its surface, sampled like the lane lines.
  // Faces are not clipped at the camera plane (the projection clamps depth instead), so
  // a face that passes beside or under the camera still reaches the screen edge; faces
  // turned away from the camera are culled in world space.
  ctx.globalAlpha = 1;
  ctx.lineWidth = lw(2.2);
  const cX = cam.x, cY = cam.y, QM = 4, VW = view.W + QM, VH = H + QM;
  for (const lane of LANES) {
    const S = [];
    for (let D = D_NEAR_LANE; D < D_FAR; D *= LANE_STEP) {
      const z = camZ + D;
      if (z > far) break;
      const c = lane.cx(z), h = lane.lift(z);
      let p = project(c - HALF_W, h, z); const tlx = p.x, tly = p.y, zl = p.zc;
      p = project(c + HALF_W, h, z); const trx = p.x, try_ = p.y, zr = p.zc;
      p = project(c - HALF_W, 0, z); const blx = p.x, bly = p.y;
      p = project(c + HALF_W, 0, z); const brx = p.x, bry = p.y;
      S.push({ z, c, h, tlx, tly, trx, try_, blx, bly, brx, bry, zmin: Math.min(zl, zr) });
    }
    const quad = (ax, ay, bx, by, qx, qy, dx, dy) => {
      // entirely off-screen (with room for the 2.2 px stroke): nothing to rasterize
      if ((ax < -QM && bx < -QM && qx < -QM && dx < -QM) || (ax > VW && bx > VW && qx > VW && dx > VW) ||
          (ay < -QM && by < -QM && qy < -QM && dy < -QM) || (ay > VH && by > VH && qy > VH && dy > VH)) return;
      ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(qx, qy); ctx.lineTo(dx, dy); ctx.closePath();
      counts.quads++; counts.lineTo += 3;
    };
    const face = (grad, emit) => {
      ctx.fillStyle = grad; ctx.strokeStyle = grad;
      ctx.beginPath();
      emit();
      ctx.fill(); ctx.stroke(); counts.fills++; counts.strokes++;
    };
    // outward side normal of segment a->b is +-(dz, 0, -dx); the surface normal points up
    const wallFacing = (a, b, side) => {
      const dx = b.c - a.c, dz = b.z - a.z, ex = a.c + side * HALF_W;
      return side * ((cX - ex) * dz - (camZ - a.z) * dx) > 0;
    };
    const topFacing = (a, b) => {
      const dx = b.c - a.c, dy = b.h - a.h, dz = b.z - a.z;
      return (cX - a.c) * (-dx * dy) + (cY - a.h) * (dx * dx + dz * dz) + (camZ - a.z) * (-dz * dy) > 0;
    };
    const walls = side => () => {
      for (let k = 0; k + 1 < S.length; k++) {
        const a = S[k], b = S[k + 1];
        if (!(a.h > 0 || b.h > 0) || !wallFacing(a, b, side)) continue;
        if (side < 0) quad(a.tlx, a.tly, b.tlx, b.tly, b.blx, b.bly, a.blx, a.bly);
        else quad(a.trx, a.try_, b.trx, b.try_, b.brx, b.bry, a.brx, a.bry);
      }
    };
    // the footprint: for flat lanes it doubles the top face, which is what gives the road
    // edge its slightly heavier anti-aliased ink border
    face(gradBodyBottom, () => {
      for (let k = 0; k + 1 < S.length; k++) {
        const a = S[k], b = S[k + 1];
        if (Math.min(a.zmin, b.zmin) < BODY_BEHIND) continue;
        quad(a.blx, a.bly, a.brx, a.bry, b.brx, b.bry, b.blx, b.bly);
      }
    });
    face(gradBodySide, walls(-1));
    face(gradBodySide, walls(1));
    face(gradBodySide, () => {
      const e = S[S.length - 1];
      if (e && e.h > 0) quad(e.tlx, e.tly, e.trx, e.try_, e.brx, e.bry, e.blx, e.bly);
    });
    face(gradBodyTop, () => {
      for (let k = 0; k + 1 < S.length; k++) {
        const a = S[k], b = S[k + 1];
        if (Math.min(a.zmin, b.zmin) >= BODY_BEHIND && topFacing(a, b)) quad(a.tlx, a.tly, a.trx, a.try_, b.trx, b.try_, b.tlx, b.tly);
      }
    });
  }

  // ---- 3 + 4. pillars, lane lines, cross lines -----------------------------------------
  ctx.strokeStyle = gradA;
  ctx.lineWidth = lw(0.8);
  ctx.globalAlpha = Ht * 0.8;
  {
    // pillars every pStep z under the lifted lane. One path for every lifted section in
    // range (stroked even if all of it is hidden). Far away they crowd together, so a pillar
    // whose foot lands within 2 backing px of the previous one on that edge is skipped.
    const pStep = portrait ? 150 : 300, z0 = Math.ceil(camZ / pStep) * pStep, gap = 2 / E;
    let lifted = false;
    for (const lane of LANES) for (let z = z0; !lifted && z <= far && z - camZ < D_FAR; z += pStep) if (lane.lift(z) >= 40) lifted = true;
    if (lifted) {
      if (portrait) ctx.globalAlpha = Ht;
      ctx.beginPath();
      for (const lane of LANES) {
        const lastX = [NaN, NaN], lastY = [NaN, NaN];
        for (let z = z0; z <= far && z - camZ < D_FAR; z += pStep) {
          const h = lane.lift(z);
          if (h < 40) continue;
          const c = lane.cx(z), rel = (cam.x - c) / HALF_W;
          for (let s = 0; s < 2; s++) {
            const side = s ? 1 : -1;
            // the far edge is behind the body; pillars under the lane are hidden while the
            // camera is between the edges (it sees the lane surface, not the walls)
            if ((side === 1 && rel < -0.6) || (side === -1 && rel > 0.6)) continue;
            if (side * rel < 1) continue;
            const a = project(c + side * HALF_W, h, z); if (!a.vis) continue;
            const ax = a.x, ay = a.y;
            const b = project(c + side * HALF_W, 0, z); if (!b.vis) continue;
            if (Math.hypot(b.x - lastX[s], b.y - lastY[s]) < gap) continue;
            lastX[s] = b.x; lastY[s] = b.y;
            ctx.moveTo(ax, ay); ctx.lineTo(b.x, b.y); counts.lineTo++;
          }
        }
      }
      ctx.stroke(); counts.strokes++;
      ctx.globalAlpha = Ht * 0.8;
    }
  }
  for (const lane of LANES) {
    for (let t = -0.75; t <= 0.76; t += 0.25) {
      const n = sampleAlong(project, camZ, far, -Infinity, Infinity, z => lane.cx(z) + t * HALF_W, lane.lift, BUF);
      ctx.beginPath();
      counts.lineTo += tracePolyline(ctx, BUF, n);
      ctx.stroke(); counts.strokes++;
    }
    for (let z = Math.floor(camZ / 300) * 300; z <= far && z - camZ < D_FAR; z += 300) {
      const c = lane.cx(z), h = lane.lift(z);
      let n = 0;
      for (let i = 0; i <= 20; i++) {
        const p = project(c + (i / 10 - 1) * HALF_W, h, z);
        if (p.vis) { BUF[n++] = p.x; BUF[n++] = p.y; } else { BUF[n++] = NaN; BUF[n++] = NaN; }
      }
      ctx.beginPath();
      counts.lineTo += tracePolyline(ctx, BUF, n);
      ctx.stroke(); counts.strokes++;
    }
  }

  // ---- 5. centre line on the shared road --------------------------------------------
  {
    const n = sampleAlong(project, camZ, far, -Infinity, SPLIT_Z, () => 0, () => 0, BUF);
    let vis = 0; for (let i = 0; i < n; i += 2) if (BUF[i] === BUF[i]) vis++;
    if (vis > 1) {
      ctx.strokeStyle = gradA;
      ctx.lineWidth = lw(0.8);
      ctx.globalAlpha = Ht * 0.8;
      ctx.beginPath();
      counts.lineTo += tracePolyline(ctx, BUF, n);
      ctx.stroke(); counts.strokes++;
    }
  }

  // ---- 6. lane edges: glow, then core ----------------------------------------------
  for (const lane of LANES) {
    for (const e of lane.edges) {
      const n = sampleAlong(project, camZ, far, e.from, Infinity, z => lane.cx(z) + e.side * HALF_W, lane.lift, BUF2);
      ctx.strokeStyle = tealGradient(0.05 + (0.2 - 0.05) * h1, 0.24 + (0.2 - 0.24) * h1);
      ctx.lineWidth = lw(5);
      ctx.globalAlpha = Ht * 0.7;
      ctx.beginPath();
      counts.lineTo += tracePolyline(ctx, BUF2, n);
      ctx.stroke(); counts.strokes++;
      ctx.strokeStyle = tealGradient(0.55 + (0.9 - 0.55) * h1, 1 + (0.9 - 1) * h1);
      ctx.lineWidth = lw(1.3);
      ctx.globalAlpha = Ht * 0.95;
      ctx.beginPath();
      counts.lineTo += tracePolyline(ctx, BUF2, n);
      ctx.stroke(); counts.strokes++;
    }
  }

  ctx.restore();
  return counts;
}
