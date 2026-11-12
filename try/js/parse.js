/* ==========================================================================
   Try MAVIS — file readers (no DOM)

   Two formats:
     · the open dataset's CSV: one scan per row, E_raw_V and I_raw_uA holding
       200 values separated by ";" (data/open_swv/README.md)
     · a CHI760 text export: the current table after "Potential/V, i1/A, i2/A";
       the first current column (i1) is read and converted from A to uA. The
       reader follows peakdeconv/data/blanks.py (_read_blank): a line counts
       when its first two comma-separated fields are numbers.
   Neither reader keeps a CHI header line: the "File:" line carries the path on
   the measuring computer, so it is never shown or exported.
   ========================================================================== */

import { A_TO_UA } from "./pipeline.js";

const FLOAT_RE = /^[+-]?(?:(?:\d(?:_?\d)*)?\.\d(?:_?\d)*|\d(?:_?\d)*\.?)(?:[eE][+-]?\d(?:_?\d)*)?$/;
const SPECIAL_RE = /^([+-]?)(inf|infinity|nan)$/i;

/** Python float(): surrounding whitespace allowed, underscores between digits, inf and nan. null if not a number. */
export function pyFloat(text) {
  const t = String(text).trim();
  if (FLOAT_RE.test(t)) return Number(t.replace(/_/g, ""));
  const m = SPECIAL_RE.exec(t);
  if (m) return m[2].toLowerCase() === "nan" ? NaN : (m[1] === "-" ? -Infinity : Infinity);
  return null;
}

/* ---------- CHI text export ------------------------------------------------- */

export function parseChi(text) {
  const potential = [];
  const current = [];
  for (const line of text.split(/\r\n|\r|\n/)) {
    const parts = line.trim().split(",");
    if (parts.length < 2) continue;
    const e = pyFloat(parts[0]);
    const i = pyFloat(parts[1]);
    if (e === null || i === null) continue;
    potential.push(e);
    current.push(i * A_TO_UA);
  }
  return { E: potential, I_uA: current };
}

/** Does this text look like a CHI export? (a "Potential/V" table header, or an "Init E (V)" setting) */
export const looksLikeChi = (text) => /Potential\/V\s*,/i.test(text) || /^\s*Init E \(V\)/im.test(text);

/** Chip and date tokens in a dataset-style file name, e.g. 20250408_MC302_SWV_1000nM2E_Ch3_1.txt */
export function nameTokens(fileName) {
  const tokens = fileName.replace(/\.[^.]+$/, "").split(/[_\s-]+/);
  const date = tokens.find((t) => /^20\d{6}$/.test(t)) || null;
  const chip = tokens.find((t) => /^MC\d+$/i.test(t));
  return { date, chip: chip ? chip.toUpperCase() : null };
}

/** Name without extension and without a trailing repeat number: ..._Ch3_1.txt -> ..._Ch3 */
export const repeatStem = (fileName) => fileName.replace(/\.[^.]+$/, "").replace(/[_\s-]+\d+$/, "");

/** A blank file by its name: 0 nM, blank, background, PBS. */
export const looksLikeBlank = (fileName) =>
  /(^|[_\s.-])(0nM|blank|blanks|background|backgrounds|bg|pbs)([_\s.-]|$)/i.test(fileName.replace(/\.[^.]+$/, ""));

/* ---------- CSV ------------------------------------------------------------- */

/** RFC 4180 rows: quoted fields may hold commas, quotes ("") and line breaks. */
export function csvRows(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim() !== ""));
}

export const CSV_REQUIRED = ["chip", "date", "subfolder", "E_raw_V", "I_raw_uA"];

/**
 * The open dataset's CSV -> scans. Each scan keeps its row's metadata and any
 * label_nM_* values (shown as the true value next to the prediction).
 * Returns {scans, missing} where missing lists required columns not found.
 */
export function parseDatasetCsv(text, analyteKeys) {
  const rows = csvRows(text.replace(/^﻿/, ""));
  if (!rows.length) return { scans: [], missing: CSV_REQUIRED.slice() };
  const header = rows[0].map((h) => h.trim());
  const col = (name) => header.indexOf(name);
  const missing = CSV_REQUIRED.filter((c) => col(c) < 0);
  if (missing.length) return { scans: [], missing };
  const get = (r, name) => (col(name) >= 0 && r[col(name)] !== undefined ? r[col(name)].trim() : "");
  const scans = rows.slice(1).map((r, k) => {
    const values = (field) => field === "" ? [] : field.split(";").map((v) => pyFloat(v));
    const labels = {};
    for (const a of analyteKeys) {
      const v = get(r, `label_nM_${a}`);
      if (v !== "") labels[a] = pyFloat(v);
    }
    const id = get(r, "sample_id") || get(r, "row_id") || `Row ${k + 1}`;
    return {
      name: id, row: k + 2,
      chip: get(r, "chip"), date: get(r, "date"), subfolder: get(r, "subfolder"),
      polymer: get(r, "polymer") || null, block: get(r, "block_id") || null,
      E: values(get(r, "E_raw_V")), I_uA: values(get(r, "I_raw_uA")),
      labels: Object.keys(labels).length ? labels : null,
    };
  });
  return { scans, missing: [] };
}
