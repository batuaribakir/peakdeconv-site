// The travel world shared by the road / fall dot samplers and the line-scene renderer:
// two lanes, a sine-hill terrain around them and a pinhole camera with yaw and pitch.
//
// World units: x across (0 = centre of the shared road), y up, z forward.
// Screen: stage px; centre column cx = stageW / 2, focal length f, horizon row.

import { SPLIT_Z, splitOffset, climbAt } from './schedule.js';

export const HALF_W = 280;            // lane half-width
export const D_FAR = 30000;           // nothing is drawn further than this ahead of the camera
export const TERRAIN_Z_MAX = 22000;

const flat = () => 0;
const centreOf = side => z => side * (HALF_W + splitOffset(z));

/** Left lane (flat) and right lane (climbs after CLIMB_Z). Inner edges exist after the fork. */
export const LANES = [
  { side: -1, cx: centreOf(-1), lift: flat, edges: [{ side: -1, from: 0 }, { side: 1, from: SPLIT_Z }] },
  { side: 1, cx: centreOf(1), lift: climbAt, edges: [{ side: 1, from: 0 }, { side: -1, from: SPLIT_Z }] },
];

export const terrainRaw = (x, z) => Math.max(0,
  130 * Math.sin(x * 0.0011 + 1.3) * Math.cos(z * 0.0007 + 0.4) + 80 * Math.sin(x * 0.0005 - z * 0.0004 + 2.1));

/** Terrain height: zero on the lanes, rising over 260 units beside them, fading out far away. */
export function terrainHeight(x, z) {
  let mask = 1;
  for (let i = 0; i < LANES.length; i++) {
    const m = (Math.abs(x - LANES[i].cx(z)) - HALF_W) / 260;
    const c = m < 0 ? 0 : m > 1 ? 1 : m;
    if (c < mask) mask = c;
  }
  const fz = (14000 - z) / 2500, fade = fz < 0 ? 0 : fz > 1 ? 1 : fz;
  return Math.min(120, Math.max(0, terrainRaw(x, z) * mask * fade - 8));
}

/**
 * A projector for one camera. project(X, Y, Z) writes the stage position into `out`
 * ({x, y, vis}) and returns it; vis is false behind the camera.
 */
export function makeProjector(cam, { f, horizon, cx }) {
  const sy = Math.sin(cam.yaw || 0), cy = Math.cos(cam.yaw || 0);
  const sp = Math.sin(cam.pitch || 0), cp = Math.cos(cam.pitch || 0);
  const camX = cam.x, camY = cam.y, camZ = cam.z || 0;
  const out = { x: 0, y: 0, vis: false };
  function project(X, Y, Z) {
    const dx = X - camX, D = Z - camZ;
    const zc = dx * sy + D * cy, xc = dx * cy - D * sy;
    const zcl = zc > 40 ? zc : 40, h = Y - camY;
    const zp = zcl * cp + h * sp, zpl = zp > 40 ? zp : 40, yp = h * cp - zcl * sp;
    out.x = cx + (xc / zpl) * f;
    out.y = horizon - (yp / zpl) * f;
    out.vis = zc > 12 && zp > 12;
    out.zc = zc;
    return out;
  }
  project.out = out;
  project.cam = cam;
  return project;
}

/** Scene constants of a stage configuration (landscape or portrait). */
export function viewOf(config) {
  return { f: config.camera.f, horizon: config.camera.horizon, cx: config.stage.w / 2, W: config.stage.w, H: config.stage.h };
}
