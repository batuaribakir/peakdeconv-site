/* ==========================================================================
   Try MAVIS — page controller

   Three glass columns over the site's 3D scene, as on the MAVIS screens of
   the presentations:
     left      sample (seven examples or the visitor's files), tasks
               (Detection, Level, Concentration) and analytes to run
     centre    Analyze, the curve, and under it the explanation map of the
               selected task and analyte: method (Occlusion, Shapley), fill
               (Straight Line, Blank), regions (40 mV Zones, Peak Windows) and
               whether that explanation type passed the project's tests
     right     the results by task for the selected scan; a row of Detection
               or Concentration opens its explanation in the centre
     below     every scan of the input in one table (a row opens that scan
               above), and the CSV and JSON downloads (export.js)
   One Analyze takes up to MAX_SCANS scans.
   Models and ONNX Runtime Web are fetched on the first Analyze (only what the
   selected tasks and analytes need) and checked against their sha256.
   ========================================================================== */

import * as P from "./pipeline.js";
import * as R from "./parse.js";
import { checkScan, checkFormat } from "./checks.js";
import { Engine } from "./engine.js";
import * as X from "./xai.js";
import { initTips, drawExplain, fmtNM, fmtSigned, nf0, hideTip } from "./chart.js";
import { resultsCsv, resultsRecord, download } from "./export.js";

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const BASE = new URL("../", import.meta.url);
const href = (p) => new URL(p, BASE).href;
const MB = (b) => (b / 1e6).toFixed(b < 1e6 ? 2 : 1);
const plural = (n, one, many = `${one}s`) => `${nf0.format(n)} ${n === 1 ? one : many}`;
const TICK = '<svg viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6.3l2.3 2.2 4.7-5"/></svg>';
const UPLOAD = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>';
const CHEVRON = (d) => `<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${d === "l" ? "M10 3L5 8l5 5" : "M6 3l5 5-5 5"}"/></svg>`;
const SHIELD = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6.2"/><path d="M5.3 8.2l1.9 1.8 3.6-4"/></svg>';

const TASKS = [
  { key: "detection", name: "Detection" },
  { key: "level", name: "Level" },
  { key: "concentration", name: "Concentration" },
];
/** Most scans one Analyze takes; a larger input is split by the visitor. Measured on the dataset CSV (all tasks
 *  and analytes, one WebAssembly thread): 1,111 scans 13.8 s and 5,555 scans 63.5 s on a desktop, 1,111 scans 80 s
 *  with the CPU slowed 4x. So 2,000 scans take about 25 s there and about 2.5 min on a slow laptop. */
const MAX_SCANS = 2000;
/** Relative time of each stage, for the progress bar (concentration: per analyte). Measured on 1,111 scans:
 *  detection 0.3 s, levels under 0.1 s, concentration 3.1 to 3.8 s per analyte. */
const STAGE_COST = { detection: 0.1, levels: 0.03, concentration: 1 };
const SHORT = { aa: "Ascorbic Acid", "5ht": "Serotonin", e2: "Estradiol", mel: "Melatonin", all4: "All Four", "5ht-e2": "Serotonin + Estradiol", "aa-5ht": "Ascorbic Acid + Serotonin" };

const state = {
  manifest: null, examples: [], library: null, libraryPromise: null,
  source: null,            // {kind: "example", example} | {kind: "csv", file, scans, problems} | {kind: "chi", files, coating}
  sourceId: 0,
  chosenBlank: "", groupRepeats: true,
  samples: [], sel: { sample: 0, scan: 0 },
  tasks: { detection: true, level: true, concentration: true },
  analytes: {},
  ran: null,               // {sourceId, tasks, analytes} of the results on screen
  view: "prepared",
  xai: { task: "detection", analyte: "AA", method: "occlusion", fill: "blank", set: "RA" },
  xaiResults: new Map(), xaiGames: new Map(), xaiRun: null,
  shown: new Set(), drawer: false, batchPage: 0, batchProblems: false,
  ort: null, engine: null, running: false, plot: null,
};

/* ---------- loading --------------------------------------------------------- */

async function fetchJSON(path) {
  const res = await fetch(href(path));
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

async function fetchBytes(path, onBytes) {
  const res = await fetch(href(path));
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  if (!res.body || !res.body.getReader) {
    const all = new Uint8Array(await res.arrayBuffer());
    onBytes(all.length);
    return all;
  }
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    onBytes(got);
  }
  const out = new Uint8Array(got);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

async function sha256Hex(bytes) {
  const d = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

function getLibrary() {
  if (!state.libraryPromise) {
    state.libraryPromise = fetchJSON("data/blanks.json").then((lib) => { state.library = lib; return lib; });
  }
  return state.libraryPromise;
}

/** ONNX Runtime Web from the page's own copy; the WebAssembly binary is fetched here so its download shows. */
async function getEngine(onBytes) {
  if (state.engine) return state.engine;
  const rt = state.manifest.runtime;
  if (!state.ort) {
    const [ort, wasm] = await Promise.all([
      import(href(rt.dir + rt.module)),
      fetchBytes(rt.dir + rt.wasm, (n) => onBytes(n)),
    ]);
    if (crypto.subtle && (await sha256Hex(wasm)) !== rt.files[rt.wasm].sha256) {
      throw new Error("The ONNX Runtime file does not match its checksum. Reload the page to try again.");
    }
    ort.env.wasm.numThreads = rt.threads;
    ort.env.wasm.wasmBinary = wasm;
    state.ort = ort;
  }
  state.engine = new Engine(state.ort, state.manifest, (file, cb) => fetchBytes(`models/${file}`, cb));
  return state.engine;
}

/* ---------- helpers ------------------------------------------------------------ */

const analyteOf = (key) => {
  const a = state.manifest.analytes.find((x) => x.key === key);
  return a ? { ...a, name: a.name.replace(/\b\w/g, (c) => c.toUpperCase()) } : a;  // Title Case on screen
};
const selectedAnalytes = () => state.manifest.analytes.map((a) => a.key).filter((k) => state.analytes[k]);
const currentSample = () => state.samples[state.sel.sample] || null;
const currentScan = () => { const s = currentSample(); return s ? s.scans[state.sel.scan] || s.scans[0] : null; };
const dot = (a) => `<i class="dot" data-a="${a}"></i>`;

/** Files the current selection still needs to download, in bytes (runtime included). */
function pendingBytes() {
  const m = state.manifest;
  const keys = selectedAnalytes();
  const files = [m.detection.file];
  if (state.tasks.level) files.push(m.classification.file);
  if (state.tasks.concentration) files.push(...keys.map((a) => m.regression[a].file));
  const loaded = (f) => state.engine && state.engine.sessions.has(f);
  let bytes = files.filter((f) => !loaded(f)).reduce((s, f) => s + m.files[f].bytes, 0);
  if (!state.ort) bytes += m.runtime.files[m.runtime.wasm].bytes;
  return bytes;
}

/** Results on screen are out of date when the sample or the selection changed since the last Analyze. */
function isStale() {
  if (!state.ran) return false;
  if (state.ran.sourceId !== state.sourceId) return true;
  return TASKS.some((t) => state.tasks[t.key] && !state.ran.tasks[t.key])
    || (state.tasks.concentration && selectedAnalytes().some((a) => !state.ran.analytes.includes(a)));
}

/* ---------- input: samples, tasks, analytes -------------------------------------- */

function renderSampleList() {
  const s = state.source;
  const rows = state.examples.map((ex) => `<button class="sample-row" type="button" data-example="${esc(ex.id)}"
      aria-pressed="${String(!!s && s.kind === "example" && s.example.id === ex.id)}">
      <span class="sample-dots">${ex.analytes.map(dot).join("")}</span>
      <span class="sample-name">${esc(SHORT[ex.id] || ex.title)}</span>
      <span class="sample-meta">${esc(ex.polymer)} · ${plural(ex.scans.length, "scan")}</span></button>`).join("");
  const up = !!s && s.kind !== "example";
  const meta = !up ? "CSV or CHI text export"
    : s.tooMany ? `${plural(s.tooMany, "scan")}, over the limit`
    : state.samples.length ? `${plural(state.samples.length, "sample")} · ${plural(state.samples.reduce((n, x) => n + x.scans.length, 0), "scan")}` : "No scan yet";
  $("#sample-list").innerHTML = rows + `<button class="sample-row is-upload" type="button" id="upload-pill" aria-pressed="${String(up)}" aria-expanded="${String(state.drawer)}" aria-controls="upload-drawer">
      <span class="sample-dots">${UPLOAD}</span><span class="sample-name">Your Files</span><span class="sample-meta">${esc(meta)}</span></button>`;
}

function renderToggles() {
  $("#task-toggles").innerHTML = TASKS.map((t) => `<button class="toggle" type="button" data-task="${t.key}" aria-pressed="${String(state.tasks[t.key])}"><span class="box">${TICK}</span>${t.name}</button>`).join("");
  $("#analyte-toggles").innerHTML = state.manifest.analytes.map((a) => `<button class="toggle" type="button" data-analyte="${a.key}" aria-pressed="${String(state.analytes[a.key])}" data-tip="${esc(a.name)}"><span class="box">${TICK}</span>${dot(a.key)}${esc(a.label)}</button>`).join("");
}

function renderRunRow() {
  const btn = $("#run-btn");
  const bytes = pendingBytes();
  const stale = isStale();
  btn.disabled = state.running || !state.samples.length;
  btn.classList.toggle("is-busy", state.running);
  btn.classList.toggle("is-stale", stale && !state.running);
  btn.textContent = state.running ? "Running…" : stale ? "Analyze Again" : "Analyze";
  $("#run-note").textContent = state.running ? "" : bytes > 0 ? `Downloads ${MB(bytes)} MB once` : state.ran ? "" : "Models ready";
}

function renderSampleHead() {
  const s = currentSample();
  const box = $("#sample-head");
  if (!s) { box.innerHTML = ""; return; }
  const tags = [];
  if (s.kind === "example") tags.push('<span class="tag is-teal">Training Data</span>');
  if (s.polymer) tags.push(`<span class="tag">${esc(s.polymer)}</span>`);
  tags.push(`<span class="tag">${plural(s.scans.length, "Scan")}</span>`);
  if (state.samples.length > 1) tags.push(`<span class="tag">Sample ${state.sel.sample + 1} of ${nf0.format(state.samples.length)}</span>`);
  box.innerHTML = `<span class="pm-sample" id="sample-title">${esc(s.title)}</span>${tags.join("")}`;
}

function wireInput() {
  $("#sample-list").addEventListener("click", (e) => {
    const ex = e.target.closest("[data-example]");
    if (ex) { selectExample(ex.dataset.example); return; }
    if (e.target.closest("#upload-pill")) {
      state.drawer = !state.drawer;
      $("#upload-drawer").hidden = !state.drawer;
      renderSampleList();
    }
  });
  $("#task-toggles").addEventListener("click", (e) => {
    const b = e.target.closest("[data-task]");
    if (!b) return;
    const k = b.dataset.task;
    if (state.tasks[k] && TASKS.filter((t) => state.tasks[t.key]).length === 1) return;  // keep one task
    state.tasks[k] = !state.tasks[k];
    renderToggles(); renderRunRow(); renderResults(); renderExplain(); renderBatch(); computeXai();
  });
  $("#analyte-toggles").addEventListener("click", (e) => {
    const b = e.target.closest("[data-analyte]");
    if (!b) return;
    const k = b.dataset.analyte;
    if (state.analytes[k] && selectedAnalytes().length === 1) return;  // keep one analyte
    state.analytes[k] = !state.analytes[k];
    if (!state.analytes[state.xai.analyte]) state.xai.analyte = selectedAnalytes()[0];
    renderToggles(); renderRunRow(); renderResults(); renderExplain(); renderBatch(); computeXai();
  });
  $("#run-btn").addEventListener("click", run);
  wireUpload();
}

async function selectExample(id) {
  const example = state.examples.find((x) => x.id === id);
  state.drawer = false;
  $("#upload-drawer").hidden = true;
  await setSource({ kind: "example", example });
}

async function setSource(source) {
  cancelXai();
  state.source = source;
  state.sourceId += 1;
  state.ran = null;
  state.xaiResults.clear();
  state.xaiGames.clear();
  state.shown.clear();
  state.batchPage = 0;
  const lib = await getLibrary();
  if (source.kind === "chi") {
    const n = source.files.filter((f) => f.role === "scan" && !f.error).length;
    source.tooMany = n > MAX_SCANS ? n : 0;
  }
  state.samples = source.tooMany ? [] : buildSamples(lib);
  state.sel = { sample: Math.max(0, state.samples.findIndex((x) => x.scans.some((sc) => sc.check.prepared))), scan: 0 };
  renderAll();
}

/* ---------- upload --------------------------------------------------------------- */

function wireUpload() {
  const input = $("#file-input");
  const zone = $("#dropzone");
  input.addEventListener("change", () => { if (input.files.length) readFiles([...input.files]); input.value = ""; });
  ["dragenter", "dragover"].forEach((t) => zone.addEventListener(t, (e) => { e.preventDefault(); zone.classList.add("is-over"); }));
  ["dragleave", "drop"].forEach((t) => zone.addEventListener(t, () => zone.classList.remove("is-over")));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    const files = [...(e.dataTransfer?.files || [])];
    if (files.length) readFiles(files);
  });
}

async function readFiles(files) {
  const keys = state.manifest.analytes.map((a) => a.key);
  // Each file is read once: its text for the readers, its size and sha256 for the JSON record.
  const texts = await Promise.all(files.map(async (f) => {
    const buf = await f.arrayBuffer();
    return { name: f.name, text: new TextDecoder().decode(buf), bytes: buf.byteLength, sha256: crypto.subtle ? await sha256Hex(buf) : null };
  }));
  const inputFiles = texts.map((t) => ({ name: t.name, bytes: t.bytes, sha256: t.sha256 }));
  const csvs = texts.filter((t) => /\.csv$/i.test(t.name) || (!R.looksLikeChi(t.text) && t.text.includes("I_raw_uA")));
  const others = texts.filter((t) => !csvs.includes(t));
  state.chosenBlank = "";   // a blank chosen for earlier files never carries over to new ones
  await getLibrary();
  if (csvs.length) {
    const scans = [];
    const problems = [];
    for (const f of csvs) {
      const { scans: s, missing } = R.parseDatasetCsv(f.text, keys);
      if (missing.length) problems.push(`${f.name}: missing column${missing.length > 1 ? "s" : ""} ${missing.join(", ")}`);
      s.forEach((x) => { x.file = f.name; });
      scans.push(...s);
    }
    if (others.length) problems.push(`${plural(others.length, "other file")} left out: add CSV and CHI files separately.`);
    const tooMany = scans.length > MAX_SCANS ? scans.length : 0;  // nothing is kept: the visitor splits the file
    await setSource({ kind: "csv", file: csvs.map((f) => f.name).join(", "), scans: tooMany ? [] : scans, problems, inputFiles, tooMany });
  } else {
    const parsed = others.map((f) => {
      if (!R.looksLikeChi(f.text)) return { name: f.name, role: "skip", error: "Not a CHI text export or a dataset CSV." };
      const { E, I_uA } = R.parseChi(f.text);
      const format = checkFormat({ E, I_uA }, state.manifest);
      return { name: f.name, E, I_uA, role: R.looksLikeBlank(f.name) ? "blank" : "scan", error: format.status === "stop" ? format.detail : null };
    });
    await setSource({ kind: "chi", files: parsed, coating: "", inputFiles });
  }
  state.drawer = true;
  $("#upload-drawer").hidden = false;
  renderSampleList();
}

function libraryOptions(suggest) {
  const lib = state.library;
  const fmtKey = (k) => k.split("|").join(" · ");
  const exact = Object.entries(lib.exact).map(([k, v]) => ({ value: `exact|${k}`, text: `${fmtKey(k)} (${plural(v.n_files, "file")})`, chip: k.split("|")[0], date: k.split("|")[1] }));
  const dates = Object.entries(lib.chip_date).map(([k, v]) => ({ value: `chip_date|${k}`, text: `${fmtKey(k)} · every folder (${plural(v.n_files, "file")})`, chip: k.split("|")[0], date: k.split("|")[1] }));
  const all = [...exact, ...dates].sort((a, b) => a.value.localeCompare(b.value));
  const hit = (o) => suggest.some((s) => s.chip && o.chip === s.chip && (!s.date || o.date === s.date));
  const opt = (o) => `<option value="${esc(o.value)}"${state.chosenBlank === o.value ? " selected" : ""}>${esc(o.text)}</option>`;
  const suggested = all.filter(hit);
  return `<option value="">Choose a blank…</option>
    ${suggested.length ? `<optgroup label="Matching the file names">${suggested.map(opt).join("")}</optgroup>` : ""}
    <optgroup label="All blanks in the library">${all.map(opt).join("")}</optgroup>`;
}

function renderUploadState() {
  const box = $("#upload-state");
  const s = state.source;
  if (!s || s.kind === "example") { box.innerHTML = ""; return; }
  let html = "";
  if (s.kind === "csv") {
    html += `<p><b>${esc(s.file)}</b></p>`;
    if (!s.tooMany) {
      const blocks = new Set(s.scans.map((x) => x.block || `${x.file}#${x.row}`));
      html += `<p class="file-note">${plural(s.scans.length, "scan")} in ${plural(blocks.size, "sample")}${s.scans.some((x) => x.block) ? " (grouped by block_id)" : ""}</p>`;
    }
    for (const p of s.problems || []) html += `<p class="file-note is-error">${esc(p)}</p>`;
  } else {
    html += `<ul class="file-list">${s.files.map((f, i) => `
      <li class="file-row">
        <span class="file-name" title="${esc(f.name)}">${esc(f.name)}</span>
        ${f.role === "skip" && f.error ? '<span class="st st-skip">Left Out</span>' : `<select data-file="${i}" aria-label="Role of ${esc(f.name)}">
          <option value="scan"${f.role === "scan" ? " selected" : ""}>Scan</option>
          <option value="blank"${f.role === "blank" ? " selected" : ""}>Blank</option>
          <option value="skip"${f.role === "skip" ? " selected" : ""}>Leave Out</option></select>`}
        ${f.error ? `<span class="file-note is-error">${esc(f.error)}</span>` : ""}
      </li>`).join("")}</ul>`;
    if (s.files.filter((f) => f.role === "scan").length > 1) {
      html += `<label class="check-row"><input type="checkbox" id="group-repeats"${state.groupRepeats ? " checked" : ""}>
        <span>Files that differ only in their last number are repeats of one sample</span></label>`;
    }
    html += `<label class="field">Coating <select id="coating">${["", "PVDF", "P4VP"].map((c) => `<option value="${c}"${s.coating === c ? " selected" : ""}>${c || "Unknown"}</option>`).join("")}</select></label>`;
  }
  if (s.tooMany) {
    html += `<p class="file-note is-error" id="too-many">${plural(s.tooMany, "scan")}: Try MAVIS analyses up to ${nf0.format(MAX_SCANS)} at a time. ${s.kind === "csv" ? "Split the file into parts of up to " + nf0.format(MAX_SCANS) + " rows." : "Mark some files Leave Out, or add them in parts."}</p>`;
  }
  const needsBlank = s.kind === "chi"
    ? !s.files.some((f) => f.role === "blank" && !f.error)
    : s.scans.some((x) => P.matchBlank(state.library, x.chip, x.date, x.subfolder).rule === "none");
  if (needsBlank) {
    const suggest = s.kind === "chi" ? s.files.filter((f) => f.role === "scan").map((f) => R.nameTokens(f.name)) : s.scans.map((x) => ({ chip: x.chip, date: x.date }));
    html += `<label class="field">${s.kind === "chi" ? "No blank file added. Blank from the library:" : "Some scans have no blank in the library. Blank for them:"}
      <select id="blank-choice">${libraryOptions(suggest)}</select></label>`;
  }
  box.innerHTML = html;
  const rebuild = async () => { await setSource({ ...state.source }); };
  box.querySelectorAll("select[data-file]").forEach((sel) => sel.addEventListener("change", () => { s.files[Number(sel.dataset.file)].role = sel.value; rebuild(); }));
  const g = $("#group-repeats");
  if (g) g.addEventListener("change", () => { state.groupRepeats = g.checked; rebuild(); });
  const c = $("#coating");
  if (c) c.addEventListener("change", () => { s.coating = c.value; rebuild(); });
  const bc = $("#blank-choice");
  if (bc) bc.addEventListener("change", () => { state.chosenBlank = bc.value; rebuild(); });
}

/* ---------- building samples ------------------------------------------------------ */

function groupChi(scans) {
  if (!state.groupRepeats) return scans.map((f) => [f]);
  const groups = new Map();
  for (const f of scans) {
    const k = R.repeatStem(f.name);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(f);
  }
  return [...groups.values()];
}

function chosenBlankInfo(lib, hints) {
  if (!state.chosenBlank) return null;
  const [table, ...key] = state.chosenBlank.split("|");
  const k = key.join("|");
  const hit = lib[table] && lib[table][k];
  if (!hit) return null;
  const [chip, date] = key;
  const bad = hints.filter((h) => (h.chip && h.chip !== chip) || (h.date && h.date !== date));
  return { blank: Float64Array.from(hit.blank_uA), rule: "chosen", key: k, nFiles: hit.n_files, mismatch: bad.length ? "its chip or date differs from the scan's" : null };
}

function truthOf(labels) {
  if (!labels) return null;
  const nM = {}, level = {};
  for (const h of state.manifest.classification.heads) {
    if (labels[h.analyte] === undefined || labels[h.analyte] === null) continue;
    nM[h.analyte] = labels[h.analyte];
    const i = h.levels_nM.indexOf(labels[h.analyte]);
    level[h.analyte] = i >= 0 ? i : null;
  }
  return Object.keys(nM).length ? { nM, level } : null;
}

function buildSamples(lib) {
  const m = state.manifest;
  const s = state.source;
  const mk = (scan, blank, k) => ({ ...scan, label: `Scan ${k + 1}`, blankInfo: blank, check: checkScan(scan, blank, m), result: null });
  if (s.kind === "example") {
    const ex = s.example;
    const blank = P.matchBlank(lib, ex.chip, ex.date, ex.subfolder);
    return [{
      title: SHORT[ex.id] || ex.title, kind: "example", key: `ex:${ex.id}`, block: ex.block_id, polymer: ex.polymer, chip: ex.chip, date: ex.date,
      truth: { nM: ex.label_nM, level: ex.label_level },
      scans: ex.scans.map((x, k) => mk({ name: x.sample_id, E: x.E_raw_V, I_uA: x.I_raw_uA, chip: ex.chip, date: ex.date, subfolder: ex.subfolder }, blank, k)),
    }];
  }
  if (s.kind === "csv") {
    const groups = new Map();
    for (const x of s.scans) {
      const k = x.block || `${x.file}#${x.row}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(x);
    }
    return [...groups.entries()].map(([k, rows], gi) => ({
      title: rows[0].block || rows[0].name, kind: "csv", key: `csv${state.sourceId}:${gi}`, block: rows[0].block || null, polymer: ["PVDF", "P4VP"].includes(rows[0].polymer) ? rows[0].polymer : null,
      chip: rows[0].chip, date: rows[0].date, truth: truthOf(rows[0].labels),
      scans: rows.map((x, i) => {
        let blank = P.matchBlank(lib, x.chip, x.date, x.subfolder);
        if (blank.rule === "none") blank = chosenBlankInfo(lib, [{ chip: x.chip, date: x.date }]) || blank;
        return mk(x, blank, i);
      }),
    }));
  }
  const files = s.files.filter((f) => f.role === "scan" && !f.error);
  const blanks = s.files.filter((f) => f.role === "blank" && !f.error);
  let blank;
  if (blanks.length) blank = { blank: P.meanCurves(blanks.map((f) => Float64Array.from(f.I_uA))), rule: "upload", key: null, nFiles: blanks.length };
  else blank = chosenBlankInfo(lib, files.map((f) => R.nameTokens(f.name))) || { blank: null, rule: "none", key: null, nFiles: 0 };
  return groupChi(files).map((group, gi) => ({
    title: group.length > 1 ? R.repeatStem(group[0].name) : group[0].name.replace(/\.[^.]+$/, ""),
    kind: "chi", key: `chi${state.sourceId}:${gi}`, polymer: s.coating || null, truth: null,
    scans: group.map((f, i) => mk({ name: f.name, file: f.name, E: f.E, I_uA: f.I_uA }, blank, i)),
  }));
}

/* ---------- running ------------------------------------------------------------------ */

function setProgress(fraction, text) {
  $("#progress").hidden = false;
  $("#progress-fill").style.width = `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`;
  $("#progress-text").textContent = text;
}

async function run() {
  if (state.running || !state.samples.length) return;
  cancelXai();
  state.running = true;
  $("#run-error").hidden = true;
  renderRunRow();
  const tasks = { ...state.tasks };
  const analytes = selectedAnalytes();
  try {
    const total = pendingBytes();
    let rtGot = 0, modelGot = 0;
    const dl = () => setProgress(total ? (rtGot + modelGot) / total : 1, `Downloading ${MB(rtGot + modelGot)} of ${MB(total)} MB (once; your browser keeps them)`);
    if (total) dl();
    const engine = await getEngine((n) => { rtGot = n; dl(); });
    const nScans = state.samples.reduce((n, x) => n + x.scans.filter((sc) => sc.check.prepared).length, 0);
    // The bar runs once for the downloads, then once for the models, each stage taking its share of the time.
    const cost = { detection: STAGE_COST.detection, levels: tasks.level ? STAGE_COST.levels : 0,
      concentration: tasks.concentration ? STAGE_COST.concentration * analytes.length : 0 };
    const sum = cost.detection + cost.levels + cost.concentration;
    const from = { detection: 0, levels: cost.detection, concentration: cost.detection + cost.levels };
    const at = (stage, f) => (from[stage] + cost[stage] * f) / sum;
    await engine.analyze(state.samples, (st) => {
      if (st.stage === "download") { modelGot = st.done; dl(); }
      else if (st.stage === "detection") setProgress(at("detection", st.done / st.total), `Detecting analytes in ${plural(nScans, "scan")}…`);
      else if (st.stage === "levels") setProgress(at("levels", st.done / st.total), `Estimating concentration levels in ${plural(nScans, "scan")}…`);
      else if (st.stage === "concentration") setProgress(at("concentration", st.done / st.total), `Estimating concentrations: ${analyteOf(st.analyte).name}…`);
    }, { tasks, analytes });
    state.ran = { sourceId: state.sourceId, tasks, analytes };
    setProgress(1, `Done: ${plural(nScans, "scan")} analysed`);
    setTimeout(() => { if (!state.running) $("#progress").hidden = true; }, 1600);
    chooseDefaultExplanation();
  } catch (err) {
    console.error(err);
    const box = $("#run-error");
    box.textContent = `Something went wrong: ${err.message || err}`;
    box.hidden = false;
    $("#progress").hidden = true;
  } finally {
    state.running = false;
    renderAll();
    computeXai();
  }
}

/* ---------- explanations ------------------------------------------------------------- */

const explainable = () => ["detection", "concentration"].filter((t) => state.tasks[t] && state.ran && state.ran.tasks[t]);

function chooseDefaultExplanation() {
  const tasks = explainable();
  if (!tasks.length) return;
  if (!tasks.includes(state.xai.task)) state.xai.task = tasks[0];
  const scan = currentScan();
  const keys = selectedAnalytes();
  if (!keys.includes(state.xai.analyte)) {
    const found = scan && scan.result && keys.find((a) => scan.result.detection[a].present);
    state.xai.analyte = found || keys[0];
  }
  if (state.xai.set === "RB" && currentSample().polymer !== "PVDF") state.xai.set = "RA";
}

function regionsFor(task, analyte) {
  const seed = task === "detection" ? state.manifest.xai.detection.seed : state.manifest.xai.regression.seeds[analyte];
  return state.manifest.xai.regions[String(seed)];
}

function segmentsOf(task, analyte, set) {
  return regionsFor(task, analyte)[set].map((s) => ({ ...s, name: set === "RA" ? `Zone ${s.label.slice(1)}` : segmentName(s) }));
}

function segmentName(s) {
  if (s.kind === "chemical") return `${analyteOf(s.label) ? analyteOf(s.label).label : s.label} Window`;
  if (s.label === "N0") return "Scan Start";
  if (s.label === "N1") return "Scan End";
  const [, pair] = s.label.split(":");
  return pair ? `Between ${pair.split("|").map((x) => (analyteOf(x) ? analyteOf(x).label : x === "N0" ? "Start" : x === "N1" ? "End" : x)).join(" and ")}` : s.label;
}

function xaiKey() {
  const x = state.xai;
  const s = currentSample();
  const unit = x.task === "detection" ? `scan${state.sel.scan}` : "sample";
  return [s.key, unit, x.task, x.analyte, x.method, x.fill, x.set].join("|");
}

function xaiAvailable() {
  const x = state.xai;
  const s = currentSample();
  if (!s || !state.ran || state.ran.sourceId !== state.sourceId) return { ok: false, why: "Press Analyze to see the explanation." };
  const tasks = explainable();
  if (!tasks.length) return { ok: false, why: "Explanations are available for Detection and Concentration." };
  if (!tasks.includes(x.task)) x.task = tasks[0];
  if (x.set === "RB" && s.polymer !== "PVDF") return { ok: false, why: "Peak windows are defined for PVDF scans." };
  if (x.task === "concentration" && x.method === "shapley" && x.fill === "line") return { ok: false, why: "Shapley with the straight-line fill is not part of the concentration protocol." };
  const scan = currentScan();
  if (x.task === "detection" && (!scan || !scan.result)) return { ok: false, why: "This scan did not pass the checks." };
  if (x.task === "concentration" && !s.scans.some((sc) => sc.result)) return { ok: false, why: "No scan of this sample passed the checks." };
  if (x.task === "concentration" && !(state.ran.analytes || []).includes(x.analyte)) return { ok: false, why: "Analyze again to add this analyte's concentration." };
  if (scan && scan.check.blankLike && !state.shown.has(`${state.sel.sample}:${state.sel.scan}`)) return { ok: false, why: "Hidden with the results: this scan may contain no analyte." };
  return { ok: true };
}

function cancelXai() {
  if (state.xaiRun) state.xaiRun.signal.cancelled = true;
  state.xaiRun = null;
}

function getGame() {
  const x = state.xai;
  const s = currentSample();
  const engine = state.engine;
  const segs = segmentsOf(x.task, x.analyte, x.set);
  if (x.task === "detection") {
    const scan = currentScan();
    const key = [s.key, state.sel.scan, x.set, x.fill].join("|");
    if (!state.xaiGames.has(key)) {
      const blank = scan.blankInfo.blank;
      const net = Float64Array.from(scan.I_uA, (v, i) => v - blank[i]);
      state.xaiGames.set(key, new X.DetectionGame(engine, { net, blank }, segs, x.fill));
    }
    const col = state.manifest.detection.columns.findIndex((c) => c.analyte === x.analyte);
    return { game: state.xaiGames.get(key).forAnalyte(col, state.manifest.detection.columns[col].threshold), seedKey: key };
  }
  const key = [s.key, x.analyte, x.set, x.fill].join("|");
  if (!state.xaiGames.has(key)) {
    const scans = s.scans.filter((sc) => sc.result).map((sc) => {
      const blank = sc.blankInfo.blank;
      return { blank, net: Float64Array.from(sc.I_uA, (v, i) => v - blank[i]) };
    });
    state.xaiGames.set(key, new X.ConcentrationGame(engine, scans, segs, x.fill, x.analyte));
  }
  return { game: state.xaiGames.get(key), seedKey: key };
}

async function computeXai() {
  const avail = xaiAvailable();
  if (!avail.ok) { renderExplain(); return; }
  const key = xaiKey();
  if (state.xaiResults.has(key)) { renderExplain(); return; }
  if (state.xaiRun && state.xaiRun.key === key) return;
  cancelXai();
  const run = { key, signal: { cancelled: false }, progress: 0 };
  state.xaiRun = run;
  renderExplain();
  const x = state.xai;
  try {
    const { game, seedKey } = getGame();
    const nPairs = (x.task === "detection" ? state.manifest.xai.detection.pairs_RA : state.manifest.xai.regression.pairs_RA)[x.analyte];
    const res = await X.explain(game, {
      method: x.method, exact: x.set === "RB", nPairs, seedKey,
      signal: run.signal,
      onProgress: (p) => { run.progress = p; updateComputing(); },
    });
    if (!run.signal.cancelled) state.xaiResults.set(key, { ...res, sign: game.sign });
  } catch (err) {
    if (!run.signal.cancelled) { console.error(err); run.error = err.message || String(err); state.xaiResults.set(key, { error: run.error }); }
  } finally {
    if (state.xaiRun === run) state.xaiRun = null;
    if (!run.signal.cancelled) renderExplain();
  }
}

function updateComputing() {
  const bar = $("#xai-bar");
  if (bar && state.xaiRun) bar.style.width = `${Math.round(state.xaiRun.progress * 100)}%`;
}

function validation(task, analyte, method, fill, set, coating) {
  if (!coating) return { kind: "not", text: "Coating Unknown", tip: "Whether this explanation type passed the project's tests depends on the coating (PVDF or P4VP)." };
  const key = `${method === "occlusion" ? "S1" : "S2"}|${set}|${fill}|${coating}`;
  const table = state.manifest.xai[task === "detection" ? "detection" : "regression"].validated[analyte] || {};
  if (!(key in table)) return { kind: "not", text: "Not Tested", tip: "This explanation type was not part of the project's tests." };
  return table[key]
    ? { kind: "valid", text: "Validated", tip: "This explanation type passed the project's tests: faithful to the model, stable across retrained models and repeats, and different from models trained on shuffled labels." }
    : { kind: "not", text: "Not Validated", tip: "This explanation type did not pass every one of the project's tests. Read it as a view of the model, not as evidence." };
}

function renderExplain() {
  const ctl = $("#explain-controls"), status = $("#explain-status"), plot = $("#plot"), foot = $("#explain-foot");
  const s = currentSample();
  hideTip();
  if (!s) {
    const why = state.source && state.source.tooMany ? `Your files hold ${plural(state.source.tooMany, "scan")}, more than one analysis takes (${nf0.format(MAX_SCANS)}).`
      : state.source && state.source.kind !== "example" ? "No scan to analyse in your files yet." : "Choose a sample or add your files.";
    ctl.innerHTML = ""; status.innerHTML = ""; plot.innerHTML = `<div class="plot-empty">${esc(why)}</div>`; foot.innerHTML = ""; renderChecksLine(); return;
  }
  const x = state.xai;
  const tasks = explainable();
  const keys = selectedAnalytes();
  const pvdf = s.polymer === "PVDF";
  const seg = (name, items, cur, strong) => `<div class="seg${strong ? " is-strong" : ""}" role="group" aria-label="${name}">${items.map((it) =>
    `<button type="button" data-${name}="${it.value}" aria-pressed="${String(it.value === cur)}"${it.disabled ? " disabled" : ""}${it.tip ? ` data-tip="${esc(it.tip)}"` : ""}>${it.html || esc(it.label)}</button>`).join("")}</div>`;
  const taskItems = [{ value: "detection", label: "Detection" }, { value: "concentration", label: "Concentration" }]
    .map((t) => ({ ...t, disabled: !tasks.includes(t.value), tip: tasks.includes(t.value) ? null : "Select the task and press Analyze" }));
  ctl.innerHTML = `
    <div class="ctl"><span class="ctl-label">Explain</span>${seg("task", taskItems, x.task, true)}</div>
    <div class="ctl"><span class="ctl-label">Analyte</span>${seg("analyte", keys.map((k) => ({ value: k, html: `${dot(k)}${esc(analyteOf(k).label)}`, tip: analyteOf(k).name })), x.analyte)}</div>
    <div class="ctl"><span class="ctl-label">Method</span>${seg("method", [{ value: "occlusion", label: "Occlusion", tip: "Remove one region at a time and watch the output change" }, { value: "shapley", label: "Shapley", tip: "Each region's average contribution over all combinations of regions; the shares add up" }], x.method)}</div>
    <div class="ctl"><span class="ctl-label">Fill</span>${seg("fill", [{ value: "line", label: "Straight Line", tip: "A removed region is bridged with a straight line", disabled: x.task === "concentration" && x.method === "shapley" }, { value: "blank", label: "Blank", tip: "A removed region is set to the blank (no net signal)" }], x.fill)}</div>
    <div class="ctl"><span class="ctl-label">Regions</span>${seg("set", [{ value: "RA", label: "40 mV Zones" }, { value: "RB", label: "Peak Windows", disabled: !pvdf, tip: pvdf ? "One region per analyte's peak window, plus the gaps between them" : "Peak windows are defined for PVDF scans" }], x.set)}</div>
    <div class="ctl"><span class="ctl-label">Curve</span>${seg("view", [{ value: "prepared", label: "Prepared" }, { value: "raw", label: "Raw" }], state.view)}</div>`;

  const avail = xaiAvailable();
  const res = avail.ok ? state.xaiResults.get(xaiKey()) : null;
  const computing = avail.ok && state.xaiRun && state.xaiRun.key === xaiKey();
  const an = analyteOf(x.analyte);
  const v = validation(x.task, x.analyte, x.method, x.fill, x.set, s.polymer);
  const where = x.task === "detection" ? (s.scans.length > 1 ? currentScan().label : "This Scan") : (s.scans.length > 1 ? `All ${s.scans.length} Scans` : "This Sample");
  status.innerHTML = `<span class="explain-title">${esc(an.name)} · ${x.task === "detection" ? "Detection" : "Concentration"} · ${esc(where)}</span>
    ${avail.ok ? `<span class="status-chip ${v.kind === "valid" ? "is-valid" : "is-not"}" data-tip="${esc(v.tip)}">${v.kind === "valid" ? SHIELD : ""}${esc(v.text)}</span>` : ""}
    ${computing ? `<span class="computing">Computing ${x.method === "shapley" ? "Shapley values" : "occlusion"}… <span class="bar"><i id="xai-bar" style="width:${Math.round(state.xaiRun.progress * 100)}%"></i></span><button class="btn-link" type="button" id="xai-cancel">Cancel</button></span>` : ""}
    ${!avail.ok && state.ran ? `<span class="st st-skip">${esc(avail.why)}</span>` : ""}`;

  // curves
  const scan = currentScan();
  const grid = state.manifest.input.grid_V;
  const prepared = state.view === "prepared";
  const curves = [];
  s.scans.forEach((sc) => {
    const y = prepared ? sc.check.prepared && sc.check.prepared.p4 : sc.I_uA;
    if (!y || y.length !== grid.length || Array.from(y).some((t) => !Number.isFinite(t))) return;
    curves.push({ y, kind: x.task === "concentration" || sc === scan ? "sel" : "other", name: sc.label });
  });
  if (!prepared && scan && scan.blankInfo && scan.blankInfo.blank) curves.push({ y: scan.blankInfo.blank, kind: "blank", name: "Blank" });
  if (!curves.length) {
    plot.innerHTML = '<div class="plot-empty">Nothing to draw: the scan could not be read.</div>';
    foot.innerHTML = "";
    renderChecksLine();
    return;
  }
  const segs = segmentsOf(x.task, x.analyte, avail.ok ? x.set : "RA");
  const win = pvdf ? regionsFor(x.task, x.analyte).windows[x.analyte] : null;
  const unit = x.task === "detection" ? "margin" : "nM";
  const pos = x.task === "detection" ? "Supports the Call" : "Raises the Value";
  const neg = x.task === "detection" ? "Argues Against" : "Lowers the Value";
  const strip = { segments: segs, values: res && !res.error ? res.values : null, se: res && res.se ? res.se : null, unit, pos, neg, status: computing ? "Computing…" : avail.ok ? "" : avail.why };
  const opts = {
    x: grid, curves, unit,
    yTitle: prepared ? "Prepared Curve (z-score)" : "Current (µA)",
    window: win ? { ...win, label: `${an.label} Peak Window` } : null,
    strip,
    label: `${an.name} ${x.task} explanation`,
    onHover: (i) => {
      if (!state.plot) return;
      if (i < 0 || x.method !== "occlusion" || !strip.values || !scan || !scan.blankInfo.blank) { state.plot.setOverlay(null); return; }
      const blank = scan.blankInfo.blank;
      const net = Float64Array.from(scan.I_uA, (t, k) => t - blank[k]);
      const filled = X.fillNet(net, X.removedPoints(segs, 2 ** i), x.fill);
      state.plot.setOverlay(prepared ? P.zscore(P.savgol9(filled)) : Float64Array.from(filled, (t, k) => t + blank[k]));
    },
  };
  state.plot = drawExplain(plot, opts);
  plot._opts = opts;

  // legend and the Shapley sum
  const legend = [`<li><span class="ln" style="--k:#0a7d74"></span>${x.task === "concentration" && s.scans.length > 1 ? "Scans" : s.scans.length > 1 ? "Selected Scan" : "Scan"}</li>`];
  if (curves.some((c) => c.kind === "other")) legend.push('<li><span class="ln" style="--k:rgba(10,125,116,.35)"></span>Other Scans</li>');
  if (curves.some((c) => c.kind === "blank")) legend.push('<li><span class="ln" style="--k:#7d8791"></span>Blank</li>');
  if (strip.values) {
    legend.push(`<li><span class="sw" style="--k:#0b7d6f"></span>${pos}</li>`, `<li><span class="sw" style="--k:#c2416f"></span>${neg}</li>`);
    if (x.method === "occlusion") legend.push('<li><span class="ln is-dash" style="--k:#1a2028"></span>Region Removed (Hover)</li>');
  }
  let sum = "";
  if (res && !res.error) {
    const f = (val) => (unit === "nM" ? `${fmtNM(val)} nM` : val.toFixed(2));
    sum = x.method === "shapley"
      ? `<span class="sum-line" data-tip="${esc(unit === "nM" ? "Shapley shares add up: every region removed, then all restored" : "Decision margin: how far the model's logit is from its threshold, positive on the side of its call")}">Every Region Removed <b>${f(res.empty)}</b> → This Curve <b>${f(res.full)}</b> · Shares Add Up to <b>${unit === "nM" ? fmtSigned(res.full - res.empty, "nM") : fmtSigned(res.full - res.empty, "margin")}</b></span>`
      : `<span class="sum-line">${unit === "nM" ? "Concentration Before the Gate" : "Decision Margin"} <b>${f(res.full)}</b></span>`;
  } else if (res && res.error) sum = `<span class="error-text">${esc(res.error)}</span>`;
  const hint = strip.values ? `<span class="hint">Hover a region for its value${x.method === "occlusion" ? " and the curve without it" : ""}</span>` : "";
  foot.innerHTML = `<ul class="legend">${legend.join("")}</ul>${sum}${hint}`;
  renderChecksLine();

  ctl.querySelectorAll("[data-task]").forEach((b) => b.addEventListener("click", () => { state.xai.task = b.dataset.task; if (state.xai.task === "concentration" && state.xai.method === "shapley") state.xai.fill = "blank"; afterXaiChange(); }));
  ctl.querySelectorAll("[data-analyte]").forEach((b) => b.addEventListener("click", () => { state.xai.analyte = b.dataset.analyte; afterXaiChange(); }));
  ctl.querySelectorAll("[data-method]").forEach((b) => b.addEventListener("click", () => { state.xai.method = b.dataset.method; if (state.xai.task === "concentration" && state.xai.method === "shapley") state.xai.fill = "blank"; afterXaiChange(); }));
  ctl.querySelectorAll("[data-fill]").forEach((b) => b.addEventListener("click", () => { state.xai.fill = b.dataset.fill; afterXaiChange(); }));
  ctl.querySelectorAll("[data-set]").forEach((b) => b.addEventListener("click", () => { state.xai.set = b.dataset.set; afterXaiChange(); }));
  ctl.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => { state.view = b.dataset.view; renderExplain(); }));
  const cancel = $("#xai-cancel");
  if (cancel) cancel.addEventListener("click", () => { cancelXai(); renderExplain(); });
}

function afterXaiChange() {
  renderExplain();
  renderResults();
  computeXai();
}

function renderChecksLine() {
  const box = $("#checks-line");
  const scan = currentScan();
  if (!scan) { box.innerHTML = ""; return; }
  const names = { format: "Format", blank: "Blank", units: "Units", signal: "Net Signal" };
  const items = ["format", "blank", "units", "signal"].map((id) => {
    const it = scan.check.items.find((c) => c.id === id);
    return it ? `<span class="st st-${it.status}" data-tip="${esc(`${names[id]}\n${it.detail}`)}">${names[id]}</span>` : `<span class="st st-skip" data-tip="${esc(names[id])}\nNot run">${names[id]}</span>`;
  }).join("");
  const problems = scan.check.items.filter((c) => c.status !== "pass").map((c) => `<span>${esc(names[c.id])}: ${esc(c.detail)}</span>`).join("");
  box.innerHTML = `<span class="ctl-label">Checks${scan && currentSample().scans.length > 1 ? ` · ${esc(scan.label)}` : ""}</span>${items}${problems ? `<div class="checks-detail">${problems}</div>` : ""}`;
}

/* ---------- results ----------------------------------------------------------------- */

function meter(score, thr, present, name) {
  const pct = (v) => `${(Math.min(1, Math.max(0, v)) * 100).toFixed(1)}%`;
  return `<div class="meter ${present ? "is-yes" : "is-no"}" data-tip="${esc(`${name}\nScore ${score.toFixed(3)} · Threshold ${thr.toFixed(3)}`)}" role="img" aria-label="Score ${score.toFixed(2)}, threshold ${thr.toFixed(2)}">
    <div class="meter-track"><div class="meter-fill" style="width:${pct(score)}"></div></div>
    <div class="meter-thr" style="left:${pct(thr)}"></div><div class="meter-dot" style="left:${pct(score)}"></div></div>`;
}

function ladder(c, levels, truth, name) {
  return `<div class="ladder" role="img" aria-label="Level probabilities">${c.probabilities.map((p, i) =>
    `<i class="${i === c.level ? "is-pred" : ""} ${i === truth ? "is-true" : ""}" style="--p:${(0.07 + 0.93 * p).toFixed(3)}" data-tip="${esc(`${name} · Level ${i}\n${fmtNM(levels[i])} nM · ${(p * 100).toFixed(1)}%${i === c.level ? "\nPredicted" : ""}${i === truth ? "\nTrue Level" : ""}`)}"></i>`).join("")}</div>`;
}

function renderResults() {
  const box = $("#results");
  const s = currentSample();
  if (!s) { box.innerHTML = '<div class="results-head"><span class="ctl-label">Results</span></div><p class="results-empty">The results of the selected scan appear here.</p>'; return; }
  const scan = currentScan();
  const multi = s.scans.length > 1;
  let html = `<div class="results-head"><span class="ctl-label">Results</span>
    ${multi ? `<span class="scan-nav"><button type="button" data-step="-1" aria-label="Previous scan"${state.sel.scan === 0 ? " disabled" : ""}>${CHEVRON("l")}</button><span>${esc(scan.label)} of ${s.scans.length}</span><button type="button" data-step="1" aria-label="Next scan"${state.sel.scan === s.scans.length - 1 ? " disabled" : ""}>${CHEVRON("r")}</button></span>` : ""}</div>`;
  if (state.samples.length > 1) {
    html += `<label class="field" style="margin-bottom:8px">Sample <select id="sample-select">${state.samples.map((x, i) => `<option value="${i}"${i === state.sel.sample ? " selected" : ""}>${esc(x.title)} (${x.scans.length})</option>`).join("")}</select></label>`;
  }
  const fresh = state.ran && state.ran.sourceId === state.sourceId;
  if (!fresh) {
    html += `<p class="results-empty">Press <b>Analyze</b> to run ${TASKS.filter((t) => state.tasks[t.key]).map((t) => t.name).join(", ").replace(/, ([^,]*)$/, " and $1")} for ${selectedAnalytes().length === 4 ? "all four analytes" : selectedAnalytes().map((k) => analyteOf(k).label).join(", ")} on this sample.</p>`;
    box.innerHTML = html;
    wireResults();
    return;
  }
  const id = `${state.sel.sample}:${state.sel.scan}`;
  if (!scan.result) {
    html += `<div class="hidden-results"><span class="st st-stop">Not Analysed</span><p>This scan did not pass the input checks, so the models did not run on it.</p></div>`;
    box.innerHTML = html; wireResults(); return;
  }
  if (scan.check.blankLike && !state.shown.has(id)) {
    const bo = state.manifest.checks.blank_only;
    html += `<div class="hidden-results"><span class="st st-warn">May Contain No Analyte</span>
      <p>This scan is about as close to its blank as two blank scans are to each other. The models never saw a scan without analytes, and on such scans they usually report one that is not there (${bo.any_false_present.all} of ${bo.scans} blank-only scans made from the dataset's blanks), so the results are hidden.</p>
      <button class="btn-ghost" type="button" id="show-anyway">Show Anyway</button></div>`;
    box.innerHTML = html; wireResults(); return;
  }
  if (scan.check.blankLike) html += '<p class="task-note" style="text-align:left;margin:4px 0 6px"><span class="st st-warn">Shown Anyway</span> very small net signal</p>';
  const keys = selectedAnalytes();
  const r = scan.result;
  const truth = s.truth;
  const x = state.xai;
  const shownTasks = TASKS.filter((t) => state.tasks[t.key] && state.ran.tasks[t.key]);

  for (const t of shownTasks) {
    if (t.key === "detection") {
      html += `<section class="task"><div class="task-head"><span class="task-name">Detection</span><span class="task-note">Score and Threshold</span></div><ul class="res">`;
      for (const a of keys) {
        const d = r.detection[a];
        const sel = x.task === "detection" && x.analyte === a;
        html += `<li><button type="button" class="res-row${sel ? " is-selected" : ""}" data-explain="detection" data-a="${a}" aria-pressed="${String(sel)}" aria-label="${esc(analyteOf(a).name)}: ${d.present ? "present" : "absent"}, score ${d.score.toFixed(2)}; show its explanation">
          <span class="res-name">${dot(a)}${esc(analyteOf(a).label)}</span>
          <span class="res-meter">${meter(d.score, d.threshold, d.present, analyteOf(a).name)}<span class="res-score">${d.score.toFixed(2)}</span></span>
          <span class="verdict ${d.present ? "is-yes" : "is-no"}">${d.present ? `${TICK}Present` : "Absent"}</span></button></li>`;
      }
      html += "</ul></section>";
    } else if (t.key === "level" && r.classification) {
      html += `<section class="task"><div class="task-head"><span class="task-name">Concentration Level</span><span class="task-note">Separate Model · No Explanation</span></div><ul class="res">`;
      for (const a of keys) {
        const c = r.classification[a];
        const head = state.manifest.classification.heads.find((h) => h.analyte === a);
        const tl = truth && truth.level && truth.level[a] !== undefined ? truth.level[a] : null;
        html += `<li><div class="res-row" data-level="${a}"><span class="res-name">${dot(a)}${esc(analyteOf(a).label)}</span>${ladder(c, head.levels_nM, tl, analyteOf(a).name)}
          <span class="res-val">L${c.level} · ${fmtNM(c.level_nM)} nM</span>
          <span class="res-sub">${(c.probability * 100).toFixed(0)}% probable${tl !== null ? ` · <span class="truth">True L${tl}</span>` : ""}</span></div></li>`;
      }
      html += "</ul></section>";
    } else if (t.key === "concentration" && r.regression) {
      const n = r.regression[keys.find((k) => r.regression[k])] ? r.regression[keys.find((k) => r.regression[k])].nScans : 1;
      html += `<section class="task"><div class="task-head"><span class="task-name">Concentration</span><span class="task-note">${n > 1 ? `Mean of ${n} Scans · ` : ""}0 When Absent</span></div><ul class="res">`;
      for (const a of keys) {
        const g = r.regression[a];
        if (!g) { html += `<li><div class="res-row"><span class="res-name">${dot(a)}${esc(analyteOf(a).label)}</span><span class="res-sub">Analyze again to add it</span></div></li>`; continue; }
        const sel = x.task === "concentration" && x.analyte === a;
        const tn = truth && truth.nM && truth.nM[a] !== undefined ? truth.nM[a] : null;
        const sub = [];
        if (!r.detection[a].present) sub.push(`Before the gate ${fmtNM(g.B)} nM`);
        if (tn !== null) sub.push(`<span class="truth">True ${fmtNM(tn)} nM</span>`);
        html += `<li><button type="button" class="res-row${sel ? " is-selected" : ""}" data-explain="concentration" data-a="${a}" aria-pressed="${String(sel)}" aria-label="${esc(analyteOf(a).name)}: ${fmtNM(g.G)} nM; show its explanation">
          <span class="res-name">${dot(a)}${esc(analyteOf(a).label)}</span><span class="res-mid">${sub.join(" · ")}</span>
          <span class="conc">${fmtNM(g.G)}<small>nM</small></span></button></li>`;
      }
      html += "</ul></section>";
    }
  }
  html += allValues(s, keys);
  box.innerHTML = html;
  wireResults();
}

function allValues(s, keys) {
  const has = (k) => s.scans.some((sc) => sc.result && sc.result[k]);
  const rows = [];
  s.scans.forEach((sc) => {
    if (!sc.result) return;
    const r = sc.result;
    for (const a of keys) {
      rows.push(`<tr><td>${esc(sc.label)}</td><td>${esc(analyteOf(a).label)}</td>
        <td class="num">${r.detection[a].score.toFixed(3)}</td>
        ${has("classification") ? `<td class="num">${r.classification ? `L${r.classification[a].level}` : ""}</td>` : ""}
        ${has("regression") ? `<td class="num">${r.regression && r.regression[a] ? fmtNM(r.regression[a].ens15) : ""}</td><td class="num">${r.regression && r.regression[a] ? fmtNM(r.regression[a].G) : ""}</td>` : ""}</tr>`);
    }
  });
  return `<details class="res-more"><summary>All Values</summary><div class="table-wrap"><table class="try-table">
    <thead><tr><th>Scan</th><th>Analyte</th><th class="num">Score</th>${has("classification") ? '<th class="num">Level</th>' : ""}${has("regression") ? '<th class="num">This Scan nM</th><th class="num">Reported nM</th>' : ""}</tr></thead>
    <tbody>${rows.join("")}</tbody></table></div></details>`;
}

function wireResults() {
  const box = $("#results");
  box.querySelectorAll("[data-step]").forEach((b) => b.addEventListener("click", () => {
    const s = currentSample();
    state.sel.scan = Math.min(s.scans.length - 1, Math.max(0, state.sel.scan + Number(b.dataset.step)));
    renderSampleHead(); renderResults(); renderExplain(); renderBatch(); computeXai();
  }));
  const ss = $("#sample-select");
  if (ss) ss.addEventListener("change", () => {
    cancelXai();
    state.sel = { sample: Number(ss.value), scan: 0 };
    if (state.xai.set === "RB" && currentSample().polymer !== "PVDF") state.xai.set = "RA";
    renderSampleHead(); renderResults(); renderExplain(); renderBatch(); computeXai();
  });
  const sa = $("#show-anyway");
  if (sa) sa.addEventListener("click", () => { state.shown.add(`${state.sel.sample}:${state.sel.scan}`); renderResults(); renderExplain(); renderBatch(); computeXai(); });
  box.querySelectorAll("[data-explain]").forEach((b) => b.addEventListener("click", () => {
    state.xai.task = b.dataset.explain;
    state.xai.analyte = b.dataset.a;
    if (state.xai.task === "concentration" && state.xai.method === "shapley") state.xai.fill = "blank";
    afterXaiChange();
  }));
}

/* ---------- all scans and the downloads -------------------------------------------- */

const BATCH_PAGE = 100;

/** Every scan of the input, in order, with its sample and position; the problem filter applied. */
function batchRows() {
  const rows = [];
  state.samples.forEach((s, si) => s.scans.forEach((sc, k) => {
    if (!state.batchProblems || sc.check.status !== "pass") rows.push({ s, si, sc, k });
  }));
  return rows;
}

function renderBatch() {
  const box = $("#batch");
  const s = state.source;
  const fresh = !!state.ran && state.ran.sourceId === state.sourceId;
  // The table is for uploads, and for any input once it has results to download.
  box.hidden = !s || !state.samples.length || (s.kind === "example" && !fresh);
  $("#dl-csv").disabled = !fresh;
  $("#dl-json").disabled = !fresh;
  if (box.hidden) return;
  const all = state.samples.flatMap((x) => x.scans);
  const count = (st) => all.filter((sc) => sc.check.status === st).length;
  $("#batch-summary").textContent = `${plural(all.length, "scan")} in ${plural(state.samples.length, "sample")} · ${nf0.format(count("pass"))} passed · ${nf0.format(count("warn"))} with a warning · ${nf0.format(count("stop"))} stopped`;
  $("#batch-problems").checked = state.batchProblems;

  const rows = batchRows();
  const pages = Math.max(1, Math.ceil(rows.length / BATCH_PAGE));
  state.batchPage = Math.min(state.batchPage, pages - 1);
  const page = rows.slice(state.batchPage * BATCH_PAGE, (state.batchPage + 1) * BATCH_PAGE);
  // Columns: the analytes that were run and are still selected, in the page's order.
  const shownKeys = fresh ? state.manifest.analytes.map((a) => a.key).filter((a) => state.ran.analytes.includes(a) && state.analytes[a]) : [];
  const t = fresh ? state.ran.tasks : {};
  const cols = [t.detection && "det", t.level && "lvl", t.concentration && "nm"].filter(Boolean);
  const sub = { det: "Detection", lvl: "Level", nm: '<span class="unit">nM</span>' };
  const head1 = `<tr><th rowspan="2">Sample</th><th rowspan="2" class="num">Scan</th><th rowspan="2">Checks</th>${shownKeys.map((a) => `<th class="grp" colspan="${cols.length}">${dot(a)}${esc(analyteOf(a).label)}</th>`).join("")}</tr>`;
  const head2 = `<tr>${shownKeys.map((a) => cols.map((c, i) => `<th class="${c === "det" ? "" : "num"}${i === 0 ? " first" : ""}">${sub[c]}</th>`).join("")).join("")}</tr>`;
  let prev = null;
  const body = page.map(({ s: smp, si, sc, k }) => {
    const repeat = prev === si;
    prev = si;
    const sel = si === state.sel.sample && k === state.sel.scan;
    const problems = sc.check.items.filter((x) => x.status !== "pass").map((x) => x.detail).join("\n");
    const status = `<span class="st st-${sc.check.status}" data-tip="${esc(problems || "All checks passed")}">${sc.check.status === "pass" ? "Passed" : sc.check.status === "warn" ? "Warning" : "Stopped"}</span>`;
    let cells = "";
    const hidden = sc.check.blankLike && !state.shown.has(`${si}:${k}`);
    if (fresh && !sc.result) cells = `<td class="not-run first" colspan="${shownKeys.length * cols.length}">Not analysed</td>`;
    else if (fresh && hidden) cells = `<td class="not-run first" colspan="${shownKeys.length * cols.length}">Hidden: may contain no analyte</td>`;
    else if (fresh) {
      const r = sc.result;
      cells = shownKeys.map((a) => cols.map((c, i) => {
        const cls = i === 0 ? ' class="first"' : "";
        if (c === "det") { const d = r.detection[a]; return `<td${cls}><span class="${d.present ? "yes" : "no"}" data-tip="${esc(`${analyteOf(a).name}
${d.present ? "Present" : "Absent"} · score ${d.score.toFixed(3)} · threshold ${d.threshold.toFixed(3)}`)}">${d.present ? TICK : "–"}<span class="sc">${d.score.toFixed(2)}</span></span><span class="sr-only">${d.present ? "present" : "absent"}</span></td>`; }
        if (c === "lvl") { const v = r.classification && r.classification[a]; return `<td class="num${i === 0 ? " first" : ""}">${v ? `L${v.level}` : ""}</td>`; }
        const g = r.regression && r.regression[a];
        const tn = smp.truth && smp.truth.nM && smp.truth.nM[a] ? smp.truth.nM[a] : null;
        return `<td class="num${i === 0 ? " first" : ""}">${g ? fmtNM(g.G) : '<span class="not-run">–</span>'}${tn !== null ? `<span class="truth" data-tip="True concentration">${fmtNM(tn)}</span>` : ""}</td>`;
      }).join("")).join("");
    }
    return `<tr data-s="${si}" data-k="${k}" class="${sel ? "is-selected" : ""}" tabindex="0" aria-selected="${String(sel)}">
      <td class="bt-sample${repeat ? " is-repeat" : ""}" title="${esc(smp.title)}">${repeat ? "″" : esc(smp.title)}</td>
      <td class="num bt-scan" title="${esc(sc.name || "")}">${k + 1}</td><td>${status}</td>${cells}</tr>`;
  }).join("");
  $("#batch-table").innerHTML = rows.length
    ? `<table class="bt"><thead>${head1}${fresh ? head2 : "<tr></tr>"}</thead><tbody>${body}</tbody></table>`
    : '<p class="batch-empty">No scan with a warning or a stop.</p>';
  $("#batch-pages").innerHTML = pages > 1
    ? `<span>${nf0.format(state.batchPage * BATCH_PAGE + 1)}–${nf0.format(Math.min(rows.length, (state.batchPage + 1) * BATCH_PAGE))} of ${nf0.format(rows.length)}</span>
       <button type="button" data-page="-1" aria-label="Previous page"${state.batchPage === 0 ? " disabled" : ""}>${CHEVRON("l")}</button>
       <button type="button" data-page="1" aria-label="Next page"${state.batchPage === pages - 1 ? " disabled" : ""}>${CHEVRON("r")}</button>`
    : "";
}

/** Opens a scan of the table in the panels above. */
function openScan(si, k) {
  cancelXai();
  state.sel = { sample: si, scan: k };
  if (state.xai.set === "RB" && currentSample().polymer !== "PVDF") state.xai.set = "RA";
  renderSampleHead(); renderResults(); renderExplain(); renderBatch(); computeXai();
  const top = $("#app").getBoundingClientRect().top;
  if (top < 0 || top > window.innerHeight * 0.5) $("#app").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}

function inputRecord() {
  const s = state.source;
  if (s.kind === "example") {
    return { kind: "example", id: s.example.id, title: s.example.title, block_id: s.example.block_id,
      source: "open SWV dataset (Duesselberg et al., ACS Electrochem. 2026), development (inner) rows; MIT licence" };
  }
  return { kind: s.kind, files: (s.inputFiles || []).map((f) => ({ ...f, role: s.kind === "chi" ? ((s.files || []).find((x) => x.name === f.name) || {}).role || null : "csv" })) };
}

function settingsRecord() {
  const s = state.source;
  return {
    blank_choice: state.chosenBlank || null,
    group_repeats: s.kind === "chi" ? state.groupRepeats : null,
    coating: s.kind === "chi" ? s.coating || null : null,
    shown_anyway: [...state.shown].map((id) => { const [si, k] = id.split(":").map(Number); return { sample: state.samples[si] ? state.samples[si].title : si, scan: k + 1 }; }),
  };
}

function baseName() {
  const s = state.source;
  const stem = s.kind === "example" ? `example-${s.example.id}` : (s.inputFiles && s.inputFiles[0] ? s.inputFiles[0].name.replace(/\.[^.]+$/, "") : "files");
  return `mavis_${stem.replace(/[^\w.-]+/g, "_").slice(0, 60)}`;
}

function wireBatch() {
  $("#batch-table").addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-s]");
    if (tr) openScan(Number(tr.dataset.s), Number(tr.dataset.k));
  });
  $("#batch-table").addEventListener("keydown", (e) => {
    const tr = e.target.closest("tr[data-s]");
    if (tr && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openScan(Number(tr.dataset.s), Number(tr.dataset.k)); }
  });
  $("#batch-pages").addEventListener("click", (e) => {
    const b = e.target.closest("[data-page]");
    if (b) { state.batchPage += Number(b.dataset.page); renderBatch(); }
  });
  $("#batch-problems").addEventListener("change", (e) => { state.batchProblems = e.target.checked; state.batchPage = 0; renderBatch(); });
  $("#dl-csv").addEventListener("click", () => {
    if (!state.ran || state.ran.sourceId !== state.sourceId) return;
    download(`${baseName()}.csv`, resultsCsv(state.samples, state.ran), "text/csv;charset=utf-8");
  });
  $("#dl-json").addEventListener("click", () => {
    if (!state.ran || state.ran.sourceId !== state.sourceId) return;
    const record = resultsRecord(state.samples, state.manifest, state.ran, inputRecord(), settingsRecord());
    download(`${baseName()}.json`, JSON.stringify(record, null, 1), "application/json");
  });
}

/* ---------- start ------------------------------------------------------------------- */

function renderAll() {
  renderSampleList();
  renderSampleHead();
  renderUploadState();
  renderRunRow();
  renderResults();
  renderExplain();
  renderBatch();
}

async function init() {
  initTips($("#tip"));
  try {
    const [manifest, ex] = await Promise.all([fetchJSON("models/manifest.json"), fetchJSON("data/examples.json")]);
    state.manifest = manifest;
    state.examples = ex.examples;
  } catch (err) {
    console.error(err);
    $("#plot").innerHTML = `<div class="plot-empty">The page could not load its data (${esc(err.message)}). Reload to try again.</div>`;
    return;
  }
  manifestDefaults();
  renderToggles();
  wireInput();
  wireBatch();
  let w = 0;
  if ("ResizeObserver" in window) {
    new ResizeObserver(() => {
      const box = $("#plot");
      if (Math.abs(box.clientWidth - w) > 8 && box._opts) { w = box.clientWidth; state.plot = drawExplain(box, box._opts); }
    }).observe($("#plot"));
  }
  await selectExample(state.examples.some((e) => e.id === "all4") ? "all4" : state.examples[0].id);
}

function manifestDefaults() {
  for (const a of state.manifest.analytes) state.analytes[a.key] = true;
  state.xai.analyte = state.manifest.analytes[0].key;
}

init();
