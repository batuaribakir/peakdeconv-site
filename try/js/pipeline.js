/* ==========================================================================
   Try MAVIS — numerical pipeline (no DOM, no network)

   Everything the page computes outside the neural networks, written to give
   the same float64 numbers as the project's Python code:

     blank match   peakdeconv/data/blanks.py   BlankIndex.match, _mean, A -> uA
     smoothing     peakdeconv/preprocess/arms.py  savgol9 (window 9, degree 3,
                   four edge points left as they are), zscore_per_curve
     checks        the magnitude test of blanks.py (assert_magnitude_sane) and
                   the net-signal statistic of tools/web_export/net_signal_stats.py
     decisions     peakdeconv/train.py  sigmoid (piecewise), _softmax + argmax,
                   regression_to_nM; then Ens15 -> sample mean (B) -> gate (G),
                   as tools/web_export/check_onnx_golden.py defines them

   NumPy sums a contiguous float64 array pairwise (blocks of eight partial sums,
   split in halves above 128 values), so means and standard deviations here use
   the same order. tools/web_export/js/test_site.mjs checks this file against
   the golden scans and the Python reference.
   ========================================================================== */

export const N_POINTS = 200;
export const A_TO_UA = 1e6;
export const SG9 = [-21, 14, 39, 54, 59, 54, 39, 14, -21].map((v) => v / 231);
const SG_HALF = 4;
const PW_BLOCKSIZE = 128;

/* ---------- NumPy-order reductions ----------------------------------------- */

/** numpy's pairwise_sum over a[start .. start+n). */
export function pairwiseSum(a, start = 0, n = a.length - start) {
  if (n < 8) {
    let res = -0.0;
    for (let i = 0; i < n; i++) res += a[start + i];
    return res;
  }
  if (n <= PW_BLOCKSIZE) {
    let r0 = a[start], r1 = a[start + 1], r2 = a[start + 2], r3 = a[start + 3];
    let r4 = a[start + 4], r5 = a[start + 5], r6 = a[start + 6], r7 = a[start + 7];
    let i = 8;
    for (; i < n - (n % 8); i += 8) {
      const p = start + i;
      r0 += a[p]; r1 += a[p + 1]; r2 += a[p + 2]; r3 += a[p + 3];
      r4 += a[p + 4]; r5 += a[p + 5]; r6 += a[p + 6]; r7 += a[p + 7];
    }
    let res = ((r0 + r1) + (r2 + r3)) + ((r4 + r5) + (r6 + r7));
    for (; i < n; i++) res += a[start + i];
    return res;
  }
  let n2 = Math.floor(n / 2);
  n2 -= n2 % 8;
  return pairwiseSum(a, start, n2) + pairwiseSum(a, start + n2, n - n2);
}

/** np.sum: the reduction starts from the identity 0 and adds the pairwise sum. */
export const npSum = (a) => 0 + pairwiseSum(a, 0, a.length);
/** np.mean */
export const npMean = (a) => npSum(a) / a.length;
/** np.std (population, ddof 0): sqrt(sum((x - mean)^2) / n) */
export function npStd(a) {
  const m = npMean(a);
  const sq = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) { const d = a[i] - m; sq[i] = d * d; }
  return Math.sqrt(npSum(sq) / a.length);
}
function absArray(a) {
  const out = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = Math.abs(a[i]);
  return out;
}

/* ---------- preprocessing ---------------------------------------------------- */

/** Savitzky-Golay, window 9, degree 3; the first and last four points are copied. */
export function savgol9(y) {
  const out = Float64Array.from(y);
  if (y.length <= 2 * SG_HALF) return out;
  for (let i = SG_HALF; i < y.length - SG_HALF; i++) {
    let s = 0;
    for (let j = 0; j < 9; j++) s += y[i - SG_HALF + j] * SG9[j];
    out[i] = s;
  }
  return out;
}

/** zscore_per_curve: (y - mean) / sd, with sd = 1 when the curve is flat. */
export function zscore(y) {
  const mu = npMean(y);
  let sd = npStd(y);
  if (!(sd > 0)) sd = 1.0;
  const out = new Float64Array(y.length);
  for (let i = 0; i < y.length; i++) out[i] = (y[i] - mu) / sd;
  return out;
}

/** Mean of several curves point by point (np.stack(...).mean(axis=0)). */
export function meanCurves(curves) {
  const n = curves.length;
  const out = new Float64Array(curves[0].length);
  for (let j = 0; j < out.length; j++) {
    let s = 0;
    for (let k = 0; k < n; k++) s += curves[k][j];
    out[j] = s / n;
  }
  return out;
}

/** BlankIndex.match order: exact key, then chip + date, then chip. */
export function matchBlank(library, chip, date, subfolder) {
  const tries = [
    ["exact", `${chip}|${date}|${subfolder}`, "chip+date+subfolder"],
    ["chip_date", `${chip}|${date}`, "chip+date_fallback"],
    ["chip", `${chip}`, "chip_fallback"],
  ];
  for (const [table, key, rule] of tries) {
    const hit = library[table] && library[table][key];
    if (hit) return { blank: Float64Array.from(hit.blank_uA), rule, key, nFiles: hit.n_files };
  }
  return { blank: null, rule: "none", key: null, nFiles: 0 };
}

/**
 * Model inputs and the two signal checks of one scan.
 *   p4      blank-subtracted, smoothed, z-scored (detection and regression)
 *   p5      raw current z-scored (classification)
 *   ratio   mean|blank| / mean|scan| (null when either is zero, as in blanks.py)
 *   relSd   SD of the smoothed net current over points lo..hi-1 / mean|blank| there
 */
export function prepare(current, blank, netPoints = [10, 190]) {
  const net = new Float64Array(current.length);
  for (let i = 0; i < current.length; i++) net[i] = current[i] - blank[i];
  const smooth = savgol9(net);
  const s = npMean(absArray(current));
  const b = npMean(absArray(blank));
  const [lo, hi] = netPoints;
  const relSd = npStd(smooth.subarray(lo, hi)) / npMean(absArray(blank.subarray(lo, hi)));
  return { net, smooth, p4: zscore(smooth), p5: zscore(current), ratio: s === 0 || b === 0 ? null : b / s, relSd };
}

/* ---------- decisions -------------------------------------------------------- */

/** train.sigmoid: piecewise, exact in both tails. */
export function sigmoid(x) {
  if (x >= 0) return 1.0 / (1.0 + Math.exp(-x));
  const e = Math.exp(x);
  return e / (1.0 + e);
}

/** train._softmax over one head; returns float64 probabilities. */
export function softmax(logits) {
  let max = -Infinity;
  for (const v of logits) if (v > max) max = v;
  const e = logits.map((v) => Math.exp(v - max));
  const total = npSum(Float64Array.from(e));
  return e.map((v) => v / total);
}

/** First index of the largest value (np.argmax). */
export function argmax(values) {
  let best = 0;
  for (let i = 1; i < values.length; i++) if (values[i] > values[best]) best = i;
  return best;
}

/** One scan's detection row -> {analyte: {logit, score, threshold, present}}. */
export function detect(logitRow, columns) {
  const out = {};
  columns.forEach((c, j) => {
    const logit = logitRow[j];
    const score = sigmoid(logit);
    out[c.analyte] = { logit, score, threshold: c.threshold, present: score >= c.threshold };
  });
  return out;
}

/** One scan's 67 level logits -> per head probabilities, level index and its nM. */
export function classify(logitRow, heads) {
  const out = {};
  let start = 0;
  for (const h of heads) {
    const logits = Array.from(logitRow.slice(start, start + h.size));
    start += h.size;
    const probabilities = softmax(logits);
    const level = argmax(probabilities);
    out[h.analyte] = { probabilities, level, level_nM: h.levels_nM[level], probability: probabilities[level] };
  }
  return out;
}

/**
 * One scan's 15 member outputs (z) -> member nM (max(z*sd + mu, 0)), the three
 * family means (each over its initialisations) and Ens15 (mean of the family means).
 */
export function ensemble(zRow, members) {
  const memberNM = members.map((m, i) => Math.max(zRow[i] * m.target_sd + m.target_mu, 0.0));
  const families = [...new Set(members.map((m) => m.family))];
  const familyNM = families.map((f) => {
    let s = 0, n = 0;
    members.forEach((m, i) => { if (m.family === f) { s += memberNM[i]; n++; } });
    return s / n;
  });
  let s = 0;
  for (const v of familyNM) s += v;
  return { memberNM, families, familyNM, ens15: s / familyNM.length };
}

/** B: mean of Ens15 over the scans of one sample, in scan order. */
export function sampleMean(values) {
  let s = 0;
  for (const v of values) s += v;
  return s / values.length;
}

/** G: the sample mean where this scan's detector says present, else 0 nM. */
export const gate = (B, present) => (present ? B : 0.0);
