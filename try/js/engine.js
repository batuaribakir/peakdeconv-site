/* ==========================================================================
   Try MAVIS — model runner (no DOM)

   Runs the six ONNX graphs with ONNX Runtime Web (WebAssembly, one thread:
   GitHub Pages cannot send the cross-origin isolation headers threads need).
   The runtime module and a byte loader are passed in, so the same code runs
   in the page and in the Node test (tools/web_export/js/test_site.mjs).

   The graphs hold only the networks (tools/web_export/export_onnx.py):
     detection.onnx        P4 [n, 200] -> logits [n, 4]
     classification.onnx   P5 [n, 200] -> logits [n, 67]
     regression_<a>.onnx   P4 [n, 200] -> z [n, 15]
   Everything after them is pipeline.js, in float64.
   ========================================================================== */

import * as P from "./pipeline.js";

const CHUNK = { detection: 256, classification: 256, regression: 16 };

/** A macrotask break without setTimeout's 4 ms clamp (MessageChannel), so long runs stay quick. */
export function yieldToPage() {
  if (typeof MessageChannel === "undefined") return new Promise((r) => setTimeout(r, 0));
  return new Promise((r) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => { ch.port1.close(); r(); };
    ch.port2.postMessage(0);
  });
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export class Engine {
  /**
   * @param {object} ort         the onnxruntime-web module
   * @param {object} manifest    models/manifest.json
   * @param {Function} loadModel (file, onBytes) -> Promise<Uint8Array>
   */
  constructor(ort, manifest, loadModel) {
    this.ort = ort;
    this.manifest = manifest;
    this.loadModel = loadModel;
    this.sessions = new Map();
    this.pending = new Map();
    this.verified = new Set();
  }

  /** Files not yet loaded, and their total size, for a progress bar. */
  missing(files) {
    const todo = files.filter((f) => !this.sessions.has(f));
    return { files: todo, bytes: todo.reduce((s, f) => s + this.manifest.files[f].bytes, 0) };
  }

  session(file, onBytes) {
    if (this.sessions.has(file)) return Promise.resolve(this.sessions.get(file));
    if (!this.pending.has(file)) {
      this.pending.set(file, (async () => {
        const bytes = await this.loadModel(file, onBytes || (() => {}));
        const want = this.manifest.files[file].sha256;
        if (globalThis.crypto && crypto.subtle) {
          const got = await sha256Hex(bytes);
          if (got !== want) throw new Error(`${file}: the downloaded file does not match its checksum`);
          this.verified.add(file);
        }
        const s = await this.ort.InferenceSession.create(bytes, { executionProviders: ["wasm"] });
        this.sessions.set(file, s);
        this.pending.delete(file);
        return s;
      })().catch((err) => { this.pending.delete(file); throw err; }));
    }
    return this.pending.get(file);
  }

  /** Runs one graph on rows of 200 float64 values; returns one Float32Array per row. Calls are queued, so two
   *  runs (an analysis and an explanation) never use a session at the same time. */
  run(file, rows, chunk, onChunk) {
    const job = (this.queue || Promise.resolve()).then(() => this._run(file, rows, chunk, onChunk));
    this.queue = job.catch(() => {});
    return job;
  }

  async _run(file, rows, chunk, onChunk) {
    const session = await this.session(file);
    const n = this.manifest.input.points;
    const out = [];
    let shown = performance.now();
    for (let start = 0; start < rows.length; start += chunk) {
      const part = rows.slice(start, start + chunk);
      const data = new Float32Array(part.length * n);
      part.forEach((r, k) => data.set(r, k * n));
      const feeds = { [session.inputNames[0]]: new this.ort.Tensor("float32", data, [part.length, n]) };
      const result = await session.run(feeds);
      const tensor = result[session.outputNames[0]];
      const width = tensor.dims[1];
      for (let k = 0; k < part.length; k++) out.push(tensor.data.slice(k * width, (k + 1) * width));
      if (typeof tensor.dispose === "function") tensor.dispose();
      if (onChunk && performance.now() - shown > 60) {
        onChunk(Math.min(rows.length, start + chunk), rows.length);
        await yieldToPage();  // a long batch draws its progress and the page stays responsive
        shown = performance.now();
      }
    }
    return out;
  }

  /** Every file an analysis needs: detection always (it also gates the concentration), the level model for
   *  levels, one regression file per selected analyte for concentrations. */
  filesFor(tasks = { detection: true, level: true, concentration: true }, analytes = null) {
    const m = this.manifest;
    const keys = analytes || m.analytes.map((a) => a.key);
    const files = [m.detection.file];
    if (tasks.level) files.push(m.classification.file);
    if (tasks.concentration) files.push(...keys.map((a) => m.regression[a].file));
    return files;
  }

  /** Every file the full analysis needs. */
  allFiles() { return this.filesFor(); }

  /**
   * Runs the models on every scan that passed the checks and fills scan.result.
   * samples: [{scans: [{check: {status, prepared}, ...}]}]
   * opts: {tasks: {detection, level, concentration}, analytes: [keys]}; default: everything.
   * onStage({stage, done, total}) reports progress; stages: download, detection, levels, concentration.
   */
  async analyze(samples, onStage = () => {}, opts = {}) {
    const m = this.manifest;
    const tasks = opts.tasks || { detection: true, level: true, concentration: true };
    const keys = opts.analytes || m.analytes.map((a) => a.key);
    const runnable = samples.flatMap((s) => s.scans).filter((sc) => sc.check && sc.check.prepared);

    const need = this.missing(this.filesFor(tasks, keys));
    if (need.files.length) {
      const got = new Map();
      const tick = () => onStage({ stage: "download", done: [...got.values()].reduce((a, b) => a + b, 0), total: need.bytes });
      tick();
      await Promise.all(need.files.map((f) => this.session(f, (bytes) => { got.set(f, bytes); tick(); })));
    }
    for (const sc of samples.flatMap((s) => s.scans)) sc.result = null;
    if (!runnable.length) return samples;

    onStage({ stage: "detection", done: 0, total: 1 });
    const p4 = runnable.map((sc) => sc.check.prepared.p4);
    const det = await this.run(m.detection.file, p4, CHUNK.detection, (d, t) => onStage({ stage: "detection", done: d / t, total: 1 }));
    let cls = null;
    if (tasks.level) {
      onStage({ stage: "levels", done: 0, total: 1 });
      cls = await this.run(m.classification.file, runnable.map((sc) => sc.check.prepared.p5), CHUNK.classification,
        (d, t) => onStage({ stage: "levels", done: d / t, total: 1 }));
    }
    runnable.forEach((sc, i) => {
      sc.result = {
        detection: P.detect(det[i], m.detection.columns),
        classification: cls ? P.classify(cls[i], m.classification.heads) : null,
        regression: tasks.concentration ? {} : null,
        tasks: { ...tasks }, analytes: keys.slice(),
      };
    });
    if (!tasks.concentration) { onStage({ stage: "done", done: 1, total: 1 }); return samples; }

    for (const [k, a] of keys.entries()) {
      onStage({ stage: "concentration", done: k, total: keys.length, analyte: a });
      const z = await this.run(m.regression[a].file, p4, CHUNK.regression,
        (d, t) => onStage({ stage: "concentration", done: k + d / t, total: keys.length, analyte: a }));
      runnable.forEach((sc, i) => { sc.result.regression[a] = P.ensemble(z[i], m.regression[a].members); });
    }

    // B over the scans of each sample that reached the models, then G per scan.
    for (const sample of samples) {
      const ran = sample.scans.filter((sc) => sc.result);
      for (const a of keys) {
        if (!ran.length) continue;
        const B = P.sampleMean(ran.map((sc) => sc.result.regression[a].ens15));
        for (const sc of ran) {
          sc.result.regression[a].B = B;
          sc.result.regression[a].nScans = ran.length;
          sc.result.regression[a].G = P.gate(B, sc.result.detection[a].present);
        }
      }
    }
    onStage({ stage: "done", done: 1, total: 1 });
    return samples;
  }
}
