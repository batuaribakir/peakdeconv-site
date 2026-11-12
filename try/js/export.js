/* ==========================================================================
   Try MAVIS — the downloads (no DOM except `download`)

   CSV   one row per scan: where it came from, its checks, then for each of
         AA, 5HT, 2E, Mela (the dataset's names): detection score, threshold
         and call, level, this scan's concentration, the sample mean and the
         reported (gated) concentration, and the true value when the input
         had one. A task or analyte that was not run leaves its cells empty,
         so the columns never change.
   JSON  the full record: app and model versions with their sha256, the input
         (example id, or file names with their size and sha256), the settings,
         and per scan the checks, every score, threshold and level
         probability, the 15 networks' nM, the family means, the sample mean
         and the gate.
   Neither holds a file path or a CHI header line, and nothing is uploaded:
   the files are made in the browser and saved by it.
   ========================================================================== */

export const ANALYTE_KEYS = ["AA", "5HT", "2E", "Mela"];
const PER_ANALYTE = ["detected", "score", "threshold", "level", "level_nM", "level_probability",
  "scan_nM", "sample_mean_nM", "reported_nM", "true_nM"];
export const CSV_COLUMNS = [
  "sample", "block_id", "scan", "scan_name", "file", "csv_row", "chip", "date", "subfolder", "polymer",
  "status", "check_format", "check_blank", "check_units", "check_net_signal", "blank_rule", "blank_key",
  "net_signal_rel_sd", "blank_scan_ratio",
  ...ANALYTE_KEYS.flatMap((a) => PER_ANALYTE.map((c) => `${c}_${a}`)),
];

/** One CSV field: quoted when it holds a comma, a quote or a line break. */
export function csvField(v) {
  if (v === null || v === undefined) return "";
  const s = typeof v === "number" ? (Number.isFinite(v) ? String(v) : "") : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const checkOf = (sc, id) => { const it = sc.check.items.find((x) => x.id === id); return it ? it.status : "not run"; };

function scanCells(sample, sc, k, ran) {
  const row = {
    sample: sample.title, block_id: sample.block || "", scan: k + 1, scan_name: sc.name || "", file: sc.file || "",
    csv_row: sc.row || "", chip: sc.chip ?? sample.chip ?? "", date: sc.date ?? sample.date ?? "", subfolder: sc.subfolder || "",
    polymer: sample.polymer || "", status: sc.check.status,
    check_format: checkOf(sc, "format"), check_blank: checkOf(sc, "blank"), check_units: checkOf(sc, "units"), check_net_signal: checkOf(sc, "signal"),
    blank_rule: sc.blankInfo ? sc.blankInfo.rule : "", blank_key: sc.blankInfo && sc.blankInfo.key ? sc.blankInfo.key : "",
    net_signal_rel_sd: sc.check.prepared ? sc.check.prepared.relSd : "", blank_scan_ratio: sc.check.prepared ? sc.check.prepared.ratio : "",
  };
  const r = sc.result;
  for (const a of ANALYTE_KEYS) {
    const on = ran && ran.analytes.includes(a);
    const d = r && r.detection && on ? r.detection[a] : null;
    const c = r && r.classification && on ? r.classification[a] : null;
    const g = r && r.regression && on ? r.regression[a] : null;
    row[`detected_${a}`] = d ? (d.present ? 1 : 0) : "";
    row[`score_${a}`] = d ? d.score : "";
    row[`threshold_${a}`] = d ? d.threshold : "";
    row[`level_${a}`] = c ? c.level : "";
    row[`level_nM_${a}`] = c ? c.level_nM : "";
    row[`level_probability_${a}`] = c ? c.probability : "";
    row[`scan_nM_${a}`] = g ? g.ens15 : "";
    row[`sample_mean_nM_${a}`] = g ? g.B : "";
    row[`reported_nM_${a}`] = g ? g.G : "";
    row[`true_nM_${a}`] = sample.truth && sample.truth.nM && sample.truth.nM[a] !== undefined ? sample.truth.nM[a] : "";
  }
  return row;
}

/** The results as CSV text (one row per scan, every sample). */
export function resultsCsv(samples, ran) {
  const lines = [CSV_COLUMNS.join(",")];
  samples.forEach((s) => s.scans.forEach((sc, k) => {
    const row = scanCells(s, sc, k, ran);
    lines.push(CSV_COLUMNS.map((c) => csvField(row[c])).join(","));
  }));
  return lines.join("\r\n") + "\r\n";
}

/** The full record of an analysis. */
export function resultsRecord(samples, manifest, ran, input, settings) {
  const keys = ran.analytes;
  const m = manifest;
  const pick = (obj, a) => (obj && keys.includes(a) ? obj[a] : undefined);
  const count = (st) => samples.reduce((n, s) => n + s.scans.filter((sc) => sc.check.status === st).length, 0);
  return {
    app: { name: m.app.name, version: m.app.version, built: m.app.built },
    created: new Date().toISOString(),
    models: {
      runtime: `ONNX Runtime Web ${m.runtime.version}, WebAssembly, ${m.runtime.threads} thread`,
      opset: m.versions.opset,
      detection: { file: m.detection.file, sha256: m.files[m.detection.file].sha256, rule: m.detection.rule,
        columns: m.detection.columns.map((c) => ({ analyte: c.analyte, model: c.model, seed: c.seed, threshold: c.threshold })) },
      classification: ran.tasks.level ? { file: m.classification.file, sha256: m.files[m.classification.file].sha256, seed: m.classification.seed,
        rule: m.classification.rule, levels_nM: Object.fromEntries(m.classification.heads.map((h) => [h.analyte, h.levels_nM])) } : null,
      regression: ran.tasks.concentration ? Object.fromEntries(keys.map((a) => [a, { file: m.regression[a].file,
        sha256: m.files[m.regression[a].file].sha256, seed: m.regression[a].seed, members: m.regression[a].members.length }])) : null,
      regression_rules: ran.tasks.concentration ? m.regression_rules : null,
      input_checks: m.checks,
    },
    input,
    settings: { tasks: ran.tasks, analytes: keys, ...settings },
    summary: { samples: samples.length, scans: samples.reduce((n, s) => n + s.scans.length, 0),
      passed: count("pass"), warned: count("warn"), stopped: count("stop") },
    samples: samples.map((s) => ({
      title: s.title, block_id: s.block || null, polymer: s.polymer || null, chip: s.chip || null, date: s.date || null,
      true_nM: s.truth ? s.truth.nM : null,
      scans: s.scans.map((sc, k) => {
        const r = sc.result;
        return {
          scan: k + 1, name: sc.name || null, file: sc.file || null, csv_row: sc.row || null, status: sc.check.status,
          checks: sc.check.items.map((it) => ({ check: it.id, status: it.status, detail: it.detail })),
          blank: sc.blankInfo ? { rule: sc.blankInfo.rule, key: sc.blankInfo.key || null, n_files: sc.blankInfo.nFiles } : null,
          net_signal_rel_sd: sc.check.prepared ? sc.check.prepared.relSd : null,
          blank_scan_ratio: sc.check.prepared ? sc.check.prepared.ratio : null,
          results: r ? {
            detection: Object.fromEntries(keys.map((a) => [a, pick(r.detection, a)])),
            levels: r.classification ? Object.fromEntries(keys.map((a) => {
              const c = pick(r.classification, a);
              return [a, { level: c.level, level_nM: c.level_nM, probability: c.probability, probabilities: c.probabilities }];
            })) : null,
            concentration: r.regression ? Object.fromEntries(keys.filter((a) => r.regression[a]).map((a) => {
              const g = r.regression[a];
              return [a, { member_nM: g.memberNM, family_nM: Object.fromEntries(g.families.map((f, i) => [f, g.familyNM[i]])),
                scan_nM: g.ens15, sample_mean_nM: g.B, scans_in_mean: g.nScans, reported_nM: g.G }];
            })) : null,
          } : null,
        };
      }),
    })),
  };
}

/** Saves text as a file through the browser (no server involved). */
export function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
