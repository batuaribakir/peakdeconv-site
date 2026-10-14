// Illustrative three-molecule voltammogram behind the Home chart (dopamine, serotonin,
// melatonin). NOT measured data and not fitted to any measurement: no recorded mixture of
// these three molecules exists in the project or in the open dataset it has used, so the
// chart draws a model instead, and says so in its caption ("Illustrative curve, not measured").
//
// Model: each molecule is one Gaussian oxidation peak; the composite is exactly their sum (no
// background, no noise). The peak potentials only follow the usual order on carbon electrodes
// (dopamine lowest, then serotonin, melatonin highest; V vs Ag/AgCl), with dopamine and
// serotonin close enough to merge into one broad feature. Widths and heights are chosen for
// legibility, not taken from data.
//
// Grid as before: E = E0 + DE x i, i = 0..199 (0.004-0.800 V). Everything is scaled so the
// composite's top is 1 (COMPONENTS) or 1000 (VALUES, the chart's 41 points), so the component
// curves drawn under the chart add up to the curve on top of them.

export const E0 = 0.004, DE = 0.004;
const N = 200;
const PEAKS = [
  { key: 'DA', E: 0.18, w: 0.055, h: 0.75 },
  { key: '5HT', E: 0.35, w: 0.055, h: 1 },
  { key: 'Mela', E: 0.65, w: 0.06, h: 0.6 },
];

const peak = (p, e) => p.h * Math.exp(-0.5 * ((e - p.E) / p.w) ** 2);
const sum = e => PEAKS.reduce((t, p) => t + peak(p, e), 0);
const grid = Array.from({ length: N }, (_, i) => E0 + DE * i);
const top = Math.max(...grid.map(sum));

/** Component curves in composite units (composite top = 1), each with its peak potential. */
export const COMPONENTS = PEAKS.map(p => ({ key: p.key, apexE: p.E, y: grid.map(e => +(peak(p, e) / top).toFixed(4)) }));

/** The composite at the chart's 41 points (0.004-0.8 V), composite top = 1000. */
export const VALUES = Array.from({ length: 41 }, (_, i) => Math.round(sum(E0 + (0.8 - E0) * i / 40) / top * 1000));
