// Scroll schedule of the field: every scalar that drives the canvas, as a function of the
// eased scroll progress L (0..1). The page has 15 beats; beat b is "local" position
// l_b = 15 L - b, and the windows below deliberately reach into the neighbouring beats.
//
//   C  chart          R  road dots        K  fork           U  climb
//   P  fall progress  Q  circuit dots     Ht line-scene strength (0..0.9)

import { clamp01, S, ramp, win } from './math.js';

export const BEATS = 15;

// World path of the travel camera (world units: x across, y up, z forward).
export const SPLIT_Z = 6500;       // the shared road forks here
export const SPLIT_LEN = 3000;     // lanes drift apart over this distance ...
export const SPLIT_W = 1700;       // ... by this much each
export const CLIMB_Z = 9700;       // the right lane starts to climb here
export const CLIMB_K = 0.00095;    // climb height = K (z - CLIMB_Z)^2
export const CAM_HEIGHT = 150;
export const FAR_REST = 9700;

export const splitOffset = z => SPLIT_W * S(Math.min(1, Math.max(0, z - SPLIT_Z) / SPLIT_LEN));
export const climbAt = z => { const d = Math.max(0, z - CLIMB_Z); return CLIMB_K * d * d; };
/** Camera lateral position: a gentle drift right before the fork, then the right lane. */
export const camPath = z => 280 * S((z - 5600) / 1800) + splitOffset(z);

export function cameraZ(L) {
  const l2 = L * BEATS - 2, l4 = L * BEATS - 4;
  return S((l2 - 0.8) / 1.2) * 6200 + S(clamp01(l4)) * 3400 + S(Math.min(clamp01(l4 - 1), 0.65)) * 2200;
}

export function cameraAtZ(z) {
  const x = camPath(z);
  return {
    z, x, y: CAM_HEIGHT + climbAt(z),
    yaw: Math.atan2(camPath(z + 450) - x, 450),
    pitch: Math.atan2(climbAt(z + 900) - climbAt(z + 100), 800) * 0.85,
  };
}

export const cameraAt = L => cameraAtZ(cameraZ(L));
export const REST_CAMERA = Object.freeze({ z: 0, x: 0, y: CAM_HEIGHT, yaw: 0, pitch: 0 });

/**
 * All weights at progress L. `reduced` pins the travel camera to the rest camera.
 * Returned object is plain data (also used for the frame-skip key).
 */
export function weights(L, reduced = false) {
  const b = L * BEATS;
  const l1 = b - 1, l2 = b - 2, l3 = b - 3, l4 = b - 4, l9 = b - 9, l11 = b - 11;
  const C = win(l1, -0.14, 0.22, 0.62, 0.95);
  const R = win(l2, 0.02, 0.34, 1.05, 1.6);
  const K = win(l3, 0, 0.34, 0.95, 1.3);
  const U = win(l4, -0.35, -0.05, 2.35, 2.8);
  const gridFade = ramp(l2, 0.38, 0.8);
  const P = ramp(l4, 1.8, 2.35);
  const fallActive = P * (1 - ramp(l4, 3.4, 3.8));
  const birth = Math.max(ramp(l4, 1.68, 1.87), Math.min(1, P / 0.05));
  // the fall owns the dots from its birth until it hands over (after beat 7.8)
  const fallOn = birth * (1 - ramp(l4, 3.4, 3.8));
  const circOut = 1 - ramp(l11, 0.62, 0.82);
  const Q = ramp(l11, 0.12, 0.44) * circOut;
  const mesh = ramp(l11, 0.2, 0.42) * circOut;
  const chipTake = ramp(l11, 0.2, 0.42);
  const roadLines = ramp(l2, 0.22, 0.52) * (1 - ramp(l2, 1, 1.35));
  const Ht = Math.max(roadLines, K, U) * 0.9 * (1 - clamp01(fallActive / 0.06));
  const ambientAlpha = (1 - Math.max(C * 0.55, Math.min(1, R + K), U)) * (1 - ramp(b, 6.28, 6.5));
  const cam = reduced ? REST_CAMERA : cameraAt(L);
  return {
    C, R, K, U, gridFade, P, fallActive, birth, fallOn, Q, mesh, chipTake, Ht, ambientAlpha,
    roadMix: clamp01(R + K),
    roadDot: Math.min(R, 1 - K, 1 - gridFade),
    fallDot: birth * (1 - ramp(P, 0.55, 0.95)),
    invert: ramp(l9, 0.34, 0.42),
    far: 9700 + ramp(clamp01(l4), 0.12, 0.67) * 31000,
    terrain: 1 - ramp(l4, 1.8, 1.96),
    grab: 1 - S(L * BEATS * 1.4),
    camZ: cam.z, camX: cam.x, camY: cam.y, camYaw: cam.yaw, camPitch: cam.pitch,
  };
}

/** Keys of weights() that make up the frame-skip state key, in a fixed order. */
export const KEY_FIELDS = ['C', 'R', 'K', 'U', 'gridFade', 'P', 'birth', 'fallOn', 'Q', 'mesh', 'chipTake', 'Ht',
  'ambientAlpha', 'invert', 'far', 'terrain', 'grab', 'camZ', 'camX', 'camY', 'camYaw', 'camPitch'];
