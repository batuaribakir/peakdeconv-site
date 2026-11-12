/* ==========================================================================
   Try MAVIS — input checks (no DOM)

   One scan, four checks, in this order:
     format     exactly 200 readable points on the 0.004-0.800 V grid, 4 mV
                apart (within 1e-6 V), increasing           -> stop otherwise
     blank      exact chip + date + folder match -> pass; a coarser library
                match -> warn; uploaded blank files -> pass; none -> stop
     units      mean|blank| / mean|scan| inside [1e-2, 1e2] -> stop otherwise
                (blanks.py assert_magnitude_sane: a unit error shows as ~1e6)
     signal     net signal rel_sd below the 1% rule -> warn: the scan may hold
                no analyte, and the models never saw such a scan, so the page
                hides the results until the visitor asks for them
   A stopped scan is not sent to the models. A file is never interpolated.
   ========================================================================== */

import { prepare } from "./pipeline.js";

const fmt = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : String(v));

export function checkFormat(scan, manifest) {
  const grid = manifest.input.grid_V;
  const tol = manifest.input.grid_tolerance_V;
  const n = manifest.input.points;
  const E = scan.E, I = scan.I_uA;
  if (!E || !I || E.length !== n || I.length !== n) {
    const got = I ? I.length : 0;
    return { status: "stop", detail: `${got} current values; MAVIS needs exactly ${n} (0.004 to 0.800 V in 4 mV steps). Files are not interpolated.` };
  }
  if (I.some((v) => v === null) || E.some((v) => v === null)) {
    return { status: "stop", detail: "Some values could not be read as numbers." };
  }
  if (I.some((v) => !Number.isFinite(v)) || E.some((v) => !Number.isFinite(v))) {
    return { status: "stop", detail: "The scan contains non-finite values (NaN or infinity)." };
  }
  let worst = 0, at = 0;
  for (let i = 0; i < n; i++) {
    const d = Math.abs(E[i] - grid[i]);
    if (d > worst) { worst = d; at = i; }
  }
  if (worst > tol) {
    const reversed = E[0] > E[n - 1];
    return {
      status: "stop",
      detail: reversed
        ? "The potential runs downwards; MAVIS needs a forward scan from 0.004 to 0.800 V."
        : `Point ${at + 1} is at ${fmt(E[at], 4)} V; MAVIS needs ${fmt(grid[at], 3)} V (0.004 to 0.800 V in 4 mV steps).`,
    };
  }
  if (I.every((v) => v === 0)) return { status: "stop", detail: "The current is zero at every point." };
  return { status: "pass", detail: `${n} points, ${fmt(grid[0])} to ${fmt(grid[n - 1])} V` };
}

const BLANK_TEXT = {
  "chip+date+subfolder": (b) => ({ status: "pass", detail: `Library blank for ${b.key.replace(/\|/g, " · ")}, mean of ${b.nFiles} file${b.nFiles === 1 ? "" : "s"}` }),
  "chip+date_fallback": (b) => ({ status: "warn", detail: `No blank for this folder; using every blank of ${b.key.replace(/\|/g, " · ")} (${b.nFiles} files)` }),
  chip_fallback: (b) => ({ status: "warn", detail: `No blank for this chip and date; using every blank of chip ${b.key} (${b.nFiles} files)` }),
  upload: (b) => ({ status: "pass", detail: `Your blank, mean of ${b.nFiles} file${b.nFiles === 1 ? "" : "s"}` }),
  chosen: (b) => ({ status: b.mismatch ? "warn" : "pass", detail: `Library blank you chose: ${b.key.replace(/\|/g, " · ")} (${b.nFiles} file${b.nFiles === 1 ? "" : "s"})${b.mismatch ? `; ${b.mismatch}` : ""}` }),
  none: () => ({ status: "stop", detail: "No blank found. Add the blank files measured with this scan, or choose a blank from the library." }),
};

/**
 * All checks of one scan. `blank` is {blank: Float64Array|null, rule, key, nFiles, mismatch?}.
 * Returns {status, items, prepared}: status is the worst item; prepared holds the model inputs
 * (null when the scan is stopped before them).
 */
export function checkScan(scan, blank, manifest) {
  const items = [];
  const add = (id, label, r) => items.push({ id, label, ...r });
  const format = checkFormat(scan, manifest);
  add("format", "Scan format", format);
  const blankResult = BLANK_TEXT[blank.rule] ? BLANK_TEXT[blank.rule](blank) : BLANK_TEXT.none();
  if (blank.blank && checkFormat({ E: manifest.input.grid_V, I_uA: Array.from(blank.blank) }, manifest).status === "stop") {
    blankResult.status = "stop";
    blankResult.detail = "The blank is not a 200-point scan on the same potential grid.";
  }
  add("blank", "Blank", blankResult);
  let prepared = null;
  if (format.status !== "stop" && blankResult.status !== "stop") {
    prepared = prepare(Float64Array.from(scan.I_uA), blank.blank, manifest.checks.net_signal.points);
    const [lo, hi] = manifest.checks.magnitude_ratio;
    if (prepared.ratio === null || !(prepared.ratio >= lo && prepared.ratio <= hi)) {
      add("units", "Units", {
        status: "stop",
        detail: prepared.ratio === null
          ? "The blank is zero everywhere."
          : `The blank is ${prepared.ratio < 1 ? (1 / prepared.ratio).toExponential(1) + " times smaller" : prepared.ratio.toExponential(1) + " times larger"} than the scan. Check the units: MAVIS reads the scan in µA and a CHI file in A.`,
      });
      prepared = null;
    } else {
      add("units", "Units", { status: "pass", detail: `Blank / scan magnitude ${prepared.ratio.toFixed(2)}` });
      const limit = manifest.checks.net_signal.threshold;
      add("signal", "Net signal", prepared.relSd < limit
        ? { status: "warn", detail: `Very close to its blank (relative SD ${prepared.relSd.toFixed(4)}, limit ${limit.toFixed(4)}): the scan may contain no analyte.`, blankLike: true }
        : { status: "pass", detail: `Relative SD ${prepared.relSd.toFixed(3)} (limit ${limit.toFixed(4)})` });
    }
  }
  const order = { pass: 0, warn: 1, stop: 2 };
  const status = items.reduce((w, it) => (order[it.status] > order[w] ? it.status : w), "pass");
  return { status, items, prepared, blankLike: items.some((it) => it.blankLike) };
}
