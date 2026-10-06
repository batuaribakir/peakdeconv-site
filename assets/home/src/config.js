// Layout and scene constants for the two compositions (landscape, portrait).
//
// Every number here is a measurement of the reference (reference/revert/): stage sizes,
// runway length, particle counts, chart / camera / circuit geometry. The chart SERIES is
// ours (content.js); only its frame (x0..x1, yBase..yTop) matches the reference.

export const BEATS = 15;
export const CROP_CAP = 64;          // portrait: never crop more than this many stage px per side
export const PORTRAIT_MAX_H = 2520;  // portrait stage height is stretched from 1920 up to this

export const LANDSCAPE = {
  name: 'landscape',
  stage: { w: 1920, h: 1080 },
  yScale: 1,
  fit: 'cover',
  runwayVh: 6000,
  particles: { ambient: 3200, total: 24000 },
  chart: { x0: 170, x1: 940, yBase: 750, yTop: 320 },
  camera: { f: 950, horizon: 620 },
  circuit: { horizon: 596, base: 1046 },
  // label offsets from their chart point, stage px (first, mid, today, projected)
  chartLabelOffset: { first: [15, -49], mid: [-38, -55], today: [-25, -84], projected: [-50, -40] },
  chartYears: { y: 768, x: [158, 540, 910] },
  warp: false,
  disciplines: 'timer',
  forkColumns: 'both',
};

const PORTRAIT_BASE = {
  name: 'portrait',
  stage: { w: 1080, h: 1920 },
  yScale: 1,
  fit: 'contain',
  runwayVh: 4350,
  particles: { ambient: 1800, total: 11000 },
  chart: { x0: 140, x1: 960, yBase: 1010, yTop: 470 },
  camera: { f: 760, horizon: 820 },
  circuit: { horizon: 940, base: 1810 },
  chartLabelOffset: { first: [-30, -61], mid: [-72, -54], today: [-80, -105], projected: [-114, -54] },
  chartYears: { y: 1030, x: [118, 512, 902] },
  warp: true,
  disciplines: 'scroll',
  forkColumns: 'sequential',
};

/** Portrait config for a w×h viewport: the stage grows taller on tall phones. */
export function portraitConfig(w, h) {
  const want = w > 0 ? PORTRAIT_BASE.stage.w * h / w : PORTRAIT_BASE.stage.h;
  const H = Math.min(PORTRAIT_MAX_H, Math.max(PORTRAIT_BASE.stage.h, Math.round(want / 20) * 20));
  if (H === PORTRAIT_BASE.stage.h) return PORTRAIT_BASE;
  const k = H / PORTRAIT_BASE.stage.h, sy = v => Math.round(v * k);
  return {
    ...PORTRAIT_BASE,
    stage: { w: PORTRAIT_BASE.stage.w, h: H },
    yScale: k,
    chart: { ...PORTRAIT_BASE.chart, yBase: sy(PORTRAIT_BASE.chart.yBase), yTop: sy(PORTRAIT_BASE.chart.yTop) },
    camera: { ...PORTRAIT_BASE.camera, horizon: sy(PORTRAIT_BASE.camera.horizon) },
    circuit: { horizon: sy(PORTRAIT_BASE.circuit.horizon), base: sy(PORTRAIT_BASE.circuit.base) },
    chartYears: { ...PORTRAIT_BASE.chartYears, y: sy(PORTRAIT_BASE.chartYears.y) },
  };
}

export const orientationOf = (w, h) => (h > w ? 'portrait' : 'landscape');
export const configFor = (w, h) => (orientationOf(w, h) === 'portrait' ? portraitConfig(w, h) : LANDSCAPE);

/** Stage scale: cover in landscape; cover capped at CROP_CAP stage px of crop in portrait. */
export function stageScale(cfg, w, h) {
  const sx = w / cfg.stage.w, sy = h / cfg.stage.h;
  if (cfg.fit === 'cover') return Math.max(sx, sy);
  return Math.min(Math.max(sx, sy), w / (cfg.stage.w - 2 * CROP_CAP), h / (cfg.stage.h - 2 * CROP_CAP));
}

// Scroll easing (per animation frame): L += (B - L)(1 - e^(-K dt)); snap under SNAP.
export const EASE_K = 4.5;
export const EASE_SNAP = 4e-4;
export const DT_MAX = 0.05;

// Palette tokens (CSS custom properties hold them as "r g b").
export const PALETTE_VARS = ['--ink-rgb', '--cream-rgb', '--teal-rgb', '--dot-light-rgb', '--dot-dark-rgb', '--vignette-rgb'];
