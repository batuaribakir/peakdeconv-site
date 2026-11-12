/* ==========================================================================
   Try MAVIS — explanations (no DOM)

   The two row-level explanation methods of the project's protocols, computed
   in the browser on the shipped models:
     occlusion   value of a region = g(curve) - g(curve with the region removed)
     Shapley     the region's average contribution over coalitions: exact over
                 the PVDF peak windows (R-B, 2^9 coalitions), antithetic
                 permutation pairs over the 20 zones of 40 mV (R-A)
   A removal acts on the net current I - blank: the removed points are filled
   (line: the straight line between the run's outer neighbours; blank: 0),
   and the whole pipeline runs again (blank, Savitzky-Golay, z-score, model).

     detection     one scan; g = decision margin
                   s * (logit - logit(threshold)), s = +1 when the scan is
                   detected, so a positive value supports the call
     concentration one sample; g = mean over its scans of the flat mean of
                   the 15 networks' clipped nM, the same regions removed from
                   every scan; the detection gate is not part of it

   Mirrors peakdeconv/xai: pipeline.fill_net, attribution.occlusion,
   attribution.shapley_exact, attribution.shapley_permutation and
   regression.BlockGame. tools/web_export/js/test_site.mjs compares the maps
   with tools/web_export/make_xai_reference.py.
   ========================================================================== */

import * as P from "./pipeline.js";
import { yieldToPage } from "./engine.js";

/* ---------- fills ------------------------------------------------------------ */

/** pipeline.fill_net for one mask: `removed` is a Uint8Array (1 = removed). */
export function fillNet(net, removed, fill) {
  const n = net.length;
  const out = Float64Array.from(net);
  if (fill === "blank") {
    for (let i = 0; i < n; i++) if (removed[i]) out[i] = 0.0;
    return out;
  }
  const left = new Int32Array(n), right = new Int32Array(n);
  let last = -1;
  for (let i = 0; i < n; i++) { if (!removed[i]) last = i; left[i] = last; }
  let next = n;
  for (let i = n - 1; i >= 0; i--) { if (!removed[i]) next = i; right[i] = next; }
  for (let i = 0; i < n; i++) {
    if (!removed[i]) continue;
    const hasL = left[i] >= 0, hasR = right[i] < n;
    const vl = net[Math.min(Math.max(left[i], 0), n - 1)];
    const vr = net[Math.min(Math.max(right[i], 0), n - 1)];
    if (hasL && hasR) {
      const span = Math.max(right[i] - left[i], 1);
      const t = (i - left[i]) / span;
      out[i] = vl + t * (vr - vl);
    } else out[i] = hasL ? vl : hasR ? vr : 0.0;
  }
  return out;
}

/** Points removed by a coalition (bit g set = segment g removed). */
export function removedPoints(segments, bitmask, n = 200) {
  const r = new Uint8Array(n);
  segments.forEach((s, g) => {
    if (Math.floor(bitmask / 2 ** g) % 2 === 1) for (let i = s.lo; i < s.hi; i++) r[i] = 1;
  });
  return r;
}

/** Model input of a filled net current, as the pipeline computes it from measured current. */
function modelInput(blank, filledNet) {
  const n = blank.length;
  const net = new Float64Array(n);
  for (let i = 0; i < n; i++) net[i] = (blank[i] + filledNet[i]) - blank[i];  // CurveGame._currents, then the arm
  return P.zscore(P.savgol9(net));
}

/* ---------- random orders (seeded; the Python run draws its own) ------------- */

function hash128(text) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < text.length; i++) {
    const k = text.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

/** sfc32 generator: uniform numbers in [0, 1). */
export function makeRng(key) {
  let [a, b, c, d] = hash128(String(key));
  return () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    const t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    const r = (t + d) | 0;
    c = (c + r) | 0;
    return (r >>> 0) / 4294967296;
  };
}

function permutation(n, rng) {
  const p = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  return p;
}

/* ---------- estimators (attribution.py) --------------------------------------- */

const bit = (i) => 2 ** i;

/** Occlusion: g(nothing removed) - g(region i removed). */
export async function occlusion(game) {
  const masks = [0, ...Array.from({ length: game.nPlayers }, (_, i) => bit(i))];
  const v = await game.values(masks);
  return { values: Float64Array.from(v.slice(1), (x) => v[0] - x) };
}

function comb(n, k) {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
}

/** Exact Shapley over all 2^n coalitions (attribution.shapley_exact). */
export async function shapleyExact(game) {
  const n = game.nPlayers;
  const full = 2 ** n - 1;
  const present = Array.from({ length: 2 ** n }, (_, i) => i);
  const v = await game.values(present.map((p) => full ^ p));  // removed = complement of present
  const weight = Array.from({ length: n }, (_, k) => 1.0 / (n * comb(n - 1, k)));
  const size = present.map((p) => { let c = 0; for (let x = p; x; x >>= 1) c += x & 1; return c; });
  const values = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const terms = [];
    for (const s of present) if (((s >> i) & 1) === 0) terms.push(weight[size[s]] * (v[s | (1 << i)] - v[s]));
    values[i] = P.npSum(Float64Array.from(terms));
  }
  return { values };
}

/**
 * Permutation Shapley with antithetic pairs (attribution.shapley_permutation):
 * each pair is an order and its reverse; a unit is the mean of the pair's two
 * contribution vectors; estimate = mean over units, SE = SD over units / sqrt(units).
 * The orders come from a seeded generator, so a page gives the same map every time.
 */
export async function shapleyPermutation(game, nPairs, seedKey) {
  const n = game.nPlayers;
  const full = 2 ** n - 1;
  const rng = makeRng(seedKey);
  const orders = [];
  for (let p = 0; p < nPairs; p++) {
    const o = permutation(n, rng);
    orders.push(o, o.slice().reverse());
  }
  const chains = orders.map((o) => {
    const masks = [0];
    let m = 0;
    for (const player of o) { m += bit(player); masks.push(m); }
    return masks.map((present) => full - present);  // removed = complement
  });
  const v = await game.values(chains.flat());
  const units = [];
  for (let p = 0; p < nPairs; p++) {
    const unit = new Float64Array(n);
    for (const r of [2 * p, 2 * p + 1]) {
      const base = r * (n + 1);
      orders[r].forEach((player, k) => { unit[player] += (v[base + k + 1] - v[base + k]) / 2; });
    }
    units.push(unit);
  }
  const values = new Float64Array(n), se = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (const u of units) s += u[i];
    const m = s / units.length;
    let ss = 0;
    for (const u of units) ss += (u[i] - m) * (u[i] - m);
    values[i] = m;
    se[i] = Math.sqrt(ss / (units.length - 1)) / Math.sqrt(units.length);
  }
  return { values, se };
}

/* ---------- games -------------------------------------------------------------- */


/**
 * Evaluates coalitions in chunks, caches every result, reports progress and
 * can be cancelled. `evaluate(masks)` returns one result per mask.
 */
class Cache {
  constructor(evaluate, chunk) {
    this.evaluate = evaluate;
    this.chunk = chunk;
    this.store = new Map();
    this.onProgress = null;
    this.signal = null;
    this.evaluations = 0;
  }
  async ensure(masks) {
    // The run that asked keeps its own signal and progress callback, so a cancelled run never
    // continues under a newer run's settings.
    const signal = this.signal, onProgress = this.onProgress;
    const todo = [...new Set(masks)].filter((m) => !this.store.has(m));
    for (let i = 0; i < todo.length; i += this.chunk) {
      if (signal && signal.cancelled) throw new Error("cancelled");
      const part = todo.slice(i, i + this.chunk).filter((m) => !this.store.has(m));
      if (part.length) {
        const out = await this.evaluate(part);
        part.forEach((m, k) => this.store.set(m, out[k]));
        this.evaluations += part.length;
      }
      if (onProgress) onProgress(Math.min(1, (i + this.chunk) / todo.length));
      await yieldToPage();  // keep the page responsive between chunks
    }
    if (signal && signal.cancelled) throw new Error("cancelled");
  }
}

/** One scan, all four detectors at once: one model run gives every analyte's logit. */
export class DetectionGame {
  constructor(engine, scan, segments, fill) {
    this.segments = segments;
    this.nPlayers = segments.length;
    this.cache = new Cache(async (masks) => {
      const rows = masks.map((m) => modelInput(scan.blank, fillNet(scan.net, removedPoints(segments, m), fill)));
      return engine.run(engine.manifest.detection.file, rows, 256);
    }, 128);
  }
  /** A view of the game for one analyte (column, threshold). */
  forAnalyte(column, threshold) {
    const cache = this.cache;
    const tau = Math.min(Math.max(threshold, 1e-12), 1 - 1e-12);
    const logitTau = Math.log(tau / (1 - tau));
    const view = {
      nPlayers: this.nPlayers,
      segments: this.segments,
      cache,
      sign: null,
      async values(masks) {
        await cache.ensure(masks.concat([0]));
        if (view.sign === null) {
          const full = cache.store.get(0)[column];
          view.sign = P.sigmoid(full) >= threshold ? 1.0 : -1.0;
        }
        return masks.map((m) => view.sign * (cache.store.get(m)[column] - logitTau));
      },
    };
    return view;
  }
}

/** One sample (all its scans), one analyte: E5+B of the 15-network ensemble (regression.BlockGame). */
export class ConcentrationGame {
  constructor(engine, scans, segments, fill, analyte) {
    const info = engine.manifest.regression[analyte];
    this.segments = segments;
    this.nPlayers = segments.length;
    this.cache = new Cache(async (masks) => {
      const rows = [];
      for (const m of masks) {
        const removed = removedPoints(segments, m);
        for (const s of scans) rows.push(modelInput(s.blank, fillNet(s.net, removed, fill)));
      }
      const z = await engine.run(info.file, rows, 32);
      return masks.map((_, k) => scans.map((__, j) => {
        const zr = z[k * scans.length + j];
        let total = 0;  // EnsembleFold.predict_inputs: member by member, then / 15
        info.members.forEach((mem, i) => { total += Math.max(zr[i] * mem.target_sd + mem.target_mu, 0.0); });
        return total / info.members.length;
      }));
    }, 16);
  }
  async values(masks) {
    await this.cache.ensure(masks);
    return masks.map((m) => {
      const perScan = this.cache.store.get(m);
      let s = 0;
      for (const v of perScan) s += v;
      return s / perScan.length;
    });
  }
}

/** Runs one method on a game and returns the map with g(full) and g(all removed). */
export async function explain(game, { method, exact, nPairs, seedKey, onProgress, signal }) {
  const cache = game.cache;
  cache.onProgress = onProgress || null;
  cache.signal = signal || null;
  const t0 = performance.now();
  const before = cache.evaluations;
  let out;
  if (method === "occlusion") out = await occlusion(game);
  else if (exact) out = await shapleyExact(game);
  else out = await shapleyPermutation(game, nPairs, seedKey);
  const full = (await game.values([0]))[0];
  const empty = (await game.values([2 ** game.nPlayers - 1]))[0];
  return { ...out, full, empty, evaluations: cache.evaluations - before, seconds: (performance.now() - t0) / 1000 };
}
