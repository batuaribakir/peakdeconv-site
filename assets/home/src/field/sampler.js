// Dot targets taken from the travel scene: screen points along the same lines the
// line renderer draws, thinned so the formation has about as many points as particles.
//
//  road: seen from the rest camera, far 9700. Terrain columns every 240 x, cross rows every
//        300 z (skipping rows that land too close on screen), lane edges, 7 lane lines.
//        A 7.5 px grid (3 / renderK, renderK = 0.4 = E before the canvas is sized) keeps
//        one point per cell.
//  fall: seen from the camera at beat 5.8 (high above the climbing lane), far 40700:
//        rows across the lanes, edges, lane lines, pillars; no grid de-duplication.
//
// Each point is [x, y] in stage px.

import { LANES, HALF_W, D_FAR, terrainHeight, makeProjector } from './world.js';

const Z_NEAR = 70;

export function sampleTravel(count, { cam, far, fall = false, renderK = 0.4, view }) {
  const { W, H, horizon } = view;
  const project = makeProjector(cam, view);
  const zOff = cam.z || 0;
  const cell = 3 / Math.max(0.05, renderK);

  function pass(scale) {
    const pts = [], seen = new Set();
    let lastX = 0, lastY = 0, hasLast = false;
    const minGap = (y, base) => scale * base * (2.4 - 1.9 * Math.max(0, Math.min(1, (y - horizon) / (H - horizon))));
    const add = (X, Y, D, base) => {
      const p = project(X, Y, D + zOff);
      if (!p.vis) { hasLast = false; return; }
      const x = p.x, y = p.y;
      if (x < -10 || x > W + 10 || y < 40 || y > H + 20) return;
      if (hasLast && Math.hypot(x - lastX, y - lastY) < minGap(y, base)) return;
      if (!fall) {
        const key = (Math.floor(y / cell) + 4096) * 8192 + Math.floor(x / cell) + 4096;
        if (seen.has(key)) return;
        seen.add(key);
      }
      lastX = x; lastY = y; hasLast = true;
      pts.push([x, y]);
    };

    if (!fall) {
      for (let x = -4800; x <= 4800; x += 240) {                    // terrain columns
        hasLast = false;
        for (let d = Z_NEAR; d < D_FAR; d *= 1.004) {
          const z = d + zOff;
          if (z > far) break;
          if (LANES.some(l => Math.abs(x - l.cx(z)) < HALF_W - 2)) { hasLast = false; continue; }
          add(x, terrainHeight(x, z), d, 5);
        }
      }
    }

    const dMin = fall ? 25 : Z_NEAR, rowGap = Math.max(9, 14 * scale);
    let lastRowY = -999;
    for (let z = 300; z < zOff + D_FAR && z <= far; z += 300) {      // cross rows
      const d = z - zOff;
      if (d < dMin || d >= D_FAR) continue;
      const lane0 = LANES[0];
      const rowY = project(lane0.cx(z), lane0.lift(z), z).y;
      if (Math.abs(rowY - lastRowY) < rowGap) continue;
      lastRowY = rowY; hasLast = false;
      if (fall) {
        for (const l of LANES) {
          hasLast = false;
          for (let t = -1; t <= 1.0001; t += 0.01) add(l.cx(z) + t * HALF_W, l.lift(z), d, 1.3);
        }
      } else {
        for (let x = -4800; x <= 4800; x += 4) add(x, terrainHeight(x, z), d, 1.3);
      }
    }

    for (const l of LANES) {
      for (const e of l.edges) {                                     // lane edges
        hasLast = false;
        for (let d = Z_NEAR; d < D_FAR; d *= 1.003) {
          const z = d + zOff;
          if (z > far) break;
          if (z < e.from) { hasLast = false; continue; }
          add(l.cx(z) + e.side * HALF_W, l.lift(z), d, 3);
        }
      }
      for (let t = -0.75; t <= 0.76; t += 0.25) {                    // 7 lane lines
        hasLast = false;
        for (let d = dMin; d < D_FAR; d *= 1.006) {
          const z = d + zOff;
          if (z > far) break;
          add(l.cx(z) + t * HALF_W, l.lift(z), d, 5);
        }
      }
      if (fall) {                                                    // pillars under the raised lane
        for (let z = 300; z < zOff + D_FAR && z <= far; z += 300) {
          const d = z - zOff;
          if (d < dMin || d >= D_FAR) continue;
          const h = l.lift(z);
          if (h < 40) continue;
          const rel = (cam.x - l.cx(z)) / HALF_W;
          for (const side of [-1, 1]) {
            if ((side === 1 && rel < -0.6) || (side === -1 && rel > 0.6)) continue;
            hasLast = false;
            for (let t = 0; t <= 1.0001; t += 0.05) add(l.cx(z) + side * HALF_W, h * (1 - t), d, 3);
          }
        }
      }
    }
    return pts;
  }

  let scale = 1, pts = pass(scale);
  for (let i = 0; i < 4 && pts.length < count * 1.02; i++) {
    scale = Math.max(0.28, scale * Math.max(0.5, pts.length / count));
    pts = pass(scale);
  }
  return { points: pts, spacingScale: scale };
}
