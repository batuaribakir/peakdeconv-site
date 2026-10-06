// Bootstrap and the single animation-frame loop.
//
// Scroll model (reference-spec.md §6): a passive scroll listener sets the target B; each
// frame eases L toward the target latched at the END of the previous frame (one frame of
// latency) with L += (B − L)(1 − e^(−4.5·dt)), dt ≤ 50 ms, snapping under 4e−4. Every DOM
// value and the canvas are then drawn from L.

import { EASE_K, EASE_SNAP, DT_MAX } from './config.js';
import { CHART } from './content.js';
import { buildDom } from './dom.js';
import { measureViewport, applyStage, watchViewport } from './stage.js';
import { createTimeline, portraitWarp } from './timeline.js';
import { setupMusic, setupDisciplines, setupDocs, setupLead } from './ui.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(any-hover: hover) and (any-pointer: fine)').matches;
// ?strict-ladder restores the reference's never-recovering quality ladder (for comparisons).
const strictLadder = new URLSearchParams(location.search).has('strict-ladder');

const stage = document.getElementById('stage');
const canvas = document.getElementById('dots');

function readPalette() {
  const cs = getComputedStyle(document.body), rgb = n => cs.getPropertyValue(n).trim().split(/\s+/).map(Number);
  return { ink: rgb('--ink-rgb'), cream: rgb('--cream-rgb'), teal: rgb('--teal-rgb'), dotLight: rgb('--dot-light-rgb'), dotDark: rgb('--dot-dark-rgb'), vignette: rgb('--vignette-rgb') };
}

async function loadField() {
  try { return (await import('./field/index.js')).createField; }
  catch (err) { console.warn('[lumen] particle field unavailable:', err.message); return null; }
}

const createField = await loadField();

let vp = measureViewport();
let cfg, scale, timeline, field = null, disciplines;
let target = 0, latched = 0, L = 0, last = null, maxScroll = 1;

function readTarget() {
  const s = maxScroll > 0 ? Math.min(1, Math.max(0, window.scrollY / maxScroll)) : 0;
  target = cfg.warp ? portraitWarp(s) : s;
}

function mount() {
  ({ cfg, scale } = applyStage(vp));
  buildDom(stage, cfg);
  disciplines = setupDisciplines(stage, cfg);
  timeline = createTimeline(stage, cfg, {
    onInvert: () => field?.refreshPalette(),
    onDisciplineScroll: k => disciplines.select(k),
  });
  field?.destroy();
  field = createField ? createField(canvas, { config: cfg, chart: CHART, reducedMotion, touch: !finePointer, random: Math.random, palette: readPalette, ladderRecovery: !strictLadder }) : null;
  field?.resize(scale, window.devicePixelRatio || 1);
  requestAnimationFrame(() => { maxScroll = document.documentElement.scrollHeight - vp.h; readTarget(); });
  maxScroll = document.documentElement.scrollHeight - vp.h;
  readTarget();
  latched = L = target;                                        // start settled
  timeline.apply(L);
}

mount();
setupMusic(stage);
setupDocs(stage);
setupLead(stage);

window.addEventListener('scroll', readTarget, { passive: true });

watchViewport(() => vp, next => {
  const before = cfg.name;
  vp = next;
  const applied = applyStage(vp);
  if (applied.cfg.name !== before || applied.cfg.stage.h !== cfg.stage.h) { mount(); return; }
  ({ cfg, scale } = applied);
  field?.resize(scale, window.devicePixelRatio || 1);
  maxScroll = document.documentElement.scrollHeight - vp.h;
  readTarget();
});

if (finePointer) {
  const toStage = e => {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width * cfg.stage.w, (e.clientY - r.top) / r.height * cfg.stage.h];
  };
  window.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' || e.pointerType === 'pen') field?.pointerMove(...toStage(e)); }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => field?.pointerLeave());
  window.addEventListener('blur', () => field?.pointerLeave());
}

function frame(now) {
  const dt = last === null ? 0 : Math.min(DT_MAX, (now - last) / 1000);
  last = now;
  if (reducedMotion) L = latched;
  else {
    L += (latched - L) * (1 - Math.exp(-EASE_K * dt));
    if (Math.abs(latched - L) < EASE_SNAP) L = latched;
  }
  timeline.apply(L);
  field?.frame(now, L);
  latched = target;                                            // latch after the update: 1-frame latency
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Test hook for the audit harness (reads only).
window.__lumen = { get L() { return L; }, get target() { return target; }, get config() { return cfg; }, get quality() { return field?.debug?.quality ?? null; } };
