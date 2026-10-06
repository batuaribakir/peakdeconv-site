// Scroll → DOM. Every value is a pure function of the eased progress L (0..1), written as
// inline styles once per frame. The functions restate the measured curves
// (reference/revert/motion-states.json → domTimeline; verified against the reference
// frame by frame by tools/revert-audit/lib/motion-probe.mjs).

import { BEATS } from './config.js';

const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smooth = x => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const local = (L, k) => L * BEATS - k;              // position inside beat slice k (0-based)

const SPAN = 950;                                   // stage px from fully below to fully above
const FADE = SPAN * 0.26;                           // drift over which opacity ramps (247 px)
const EXPO = 1.7;
const bend = x => { const y = Math.max(-1.3, Math.min(1.3, x)); return 0.5 + 0.5 * Math.sign(y) * Math.abs(y) ** EXPO; };

/** Beat k state: { o, y } in stage px, or null when it is out of range (not written). */
export function beatState(L, k, portrait) {
  const x = local(L, k);
  const lo = k === 8 ? -0.9 : k === 9 ? -0.5 : -0.35;
  if (x < lo || x > 1.35) return null;
  let phase;
  if (k === 0) phase = 0.5 + x * 0.5;                          // hero: linear drift, full from the top
  else if (k === 8) phase = bend((x + 0.2) / 0.7);             // beat 09: earlier, shorter slice
  else if (k === 9) phase = bend((x - 0.25) / 0.75);           // beat 10: later slice
  else if (k === BEATS - 1) phase = Math.min(x, 1) * 0.5;      // beat 15: rise, then hold
  else if (k === 13 && portrait) {                             // portrait beat 14: ease in, hold, ease out
    const a = clamp01(x / 0.18), b = clamp01((x - 0.85) / 0.15);
    phase = 0.5 * (1 - (1 - a) ** 2) + 0.5 * b * b;
  } else phase = bend(2 * x - 1);
  const y = (0.5 - phase) * SPAN;
  return { o: smooth((SPAN / 2 - Math.abs(y)) / FADE), y };
}

export const turnOpacity = L => smooth((local(L, 4) - 1.45) / 0.2) * (1 - smooth((local(L, 4) - 2.7) / 0.25));
export const turnStruck = L => local(L, 4) >= 2.35;
export const invertAmount = L => smooth((local(L, 9) - 0.34) / 0.08);
const win = (x, a, b, c, d) => Math.min(smooth((x - a) / (b - a)), 1 - smooth((x - c) / (d - c)));
export const chartLabelsOpacity = L => win(local(L, 1), 0.06, 0.3, 0.56, 0.78);
export const marketLabelOpacity = L => smooth((local(L, 1) - 0.12) / 0.12) * (1 - smooth((local(L, 1) - 0.42) / 0.14));
export function voiceOpacity(L, k, n = 3) {
  if (k === n - 1) return 0;                                   // the last group never shows
  const m = clamp01((local(L, 4) - 0.87) / 0.91) * n - k;
  return smooth(m / 0.3) * (1 - smooth((m - 0.8) / 0.2));
}
export function forkColumns(L, mode) {
  const x = local(L, 3);
  if (mode === 'both') return { left: 1, right: smooth((x - 0.42) / 0.18), dyL: 0, dyR: 0 };
  const l = 1 - smooth((x - 0.3) / 0.14), r = smooth((x - 0.46) / 0.16);
  return { left: l, right: r, dyL: -36 * (1 - l), dyR: 18 * (1 - r) };
}
const STRIKE_AT = [0.14, 0.24, 0.34];
export const notStrike = (L, k) => smooth((local(L, 10) - STRIKE_AT[k]) / 0.15);
export const finelineOpacity = L => smooth((local(L, 14) - 0.55) / 0.3);
export const hintOn = L => L < 0.02;
export function discByScroll(L) {                              // portrait disciplines
  const x = local(L, 13), idx = x < 0.4 ? 0 : x < 0.63 ? 1 : 2, r = [[0.14, 0.4], [0.4, 0.63], [0.63, 0.88]][idx];
  return { index: idx, fill: clamp01((x - r[0]) / (r[1] - r[0])) };
}
/** Portrait scroll warp: raw scroll fraction s → progress. Beat 14 holds for 2/16 of the runway. */
export function portraitWarp(s) {
  const o = s * (BEATS + 1), t = smooth((o - 13) / 2);
  return (o - t) / BEATS;
}

const fmt = v => (Math.round(v * 1000) / 1000).toString();

/** Binds the timeline to the built DOM. apply(L) writes one frame; returns change events. */
export function createTimeline(stage, cfg, { onInvert, onDisciplineScroll } = {}) {
  const portrait = cfg.name === 'portrait';
  const beats = [...stage.querySelectorAll('section.beat')];
  const $ = s => stage.querySelector(s);
  const el = {
    colL: $('.choice-cols .left'), colR: $('.choice-cols .right'),
    turn: $('#turnLine'), nots: [...stage.querySelectorAll('.nots span')],
    fineline: $('.fineline'), backed: $('#backedStrip'), docs: $('#docsToggle'),
    chart: $('#chartLabels'), market: $('.market-label'),
    voices: [...stage.querySelectorAll('#opsLabels .vgrp')],
    hint: $('#hint'), progress: $('#progress'), flip: $('#flipE'),
    disc: $('.beat.disciplinas'),
  };
  let inverted = null, live = null, struck = null, hint = null, discIdx = -1;
  const setOpacity = (node, v) => { const s = fmt(v); if (node.style.opacity !== s) node.style.opacity = s; };

  function apply(L) {
    for (let k = 0; k < beats.length; k++) {
      const node = beats[k];
      if (k === 6) {                                           // beat 07: own window, no drift
        const o = turnOpacity(L);
        setOpacity(node, o);
        node.style.transform = 'translateY(0px)';
        node.style.pointerEvents = o > 0.5 ? 'auto' : 'none';
        continue;
      }
      const s = beatState(L, k, portrait);
      if (!s) { setOpacity(node, 0); node.style.pointerEvents = 'none'; continue; }
      setOpacity(node, s.o);
      node.style.transform = `translateY(${Math.round(s.y * 10) / 10}px)`;
      node.style.pointerEvents = s.o > 0.5 ? 'auto' : 'none';
    }

    if (el.colL) {
      const f = forkColumns(L, cfg.forkColumns);
      setOpacity(el.colL, f.left); setOpacity(el.colR, f.right);
      el.colL.style.transform = `translateY(${fmt(f.dyL)}px)`;
      el.colR.style.transform = `translateY(${fmt(f.dyR)}px)`;
    }
    const st = turnStruck(L);
    if (st !== struck && el.turn) { struck = st; el.turn.classList.toggle('struck', st); }
    el.nots.forEach((n, k) => n.style.setProperty('--strike', fmt(notStrike(L, k))));

    const fl = finelineOpacity(L), last = beatState(L, BEATS - 1, portrait);
    if (el.fineline) setOpacity(el.fineline, fl);
    const strip = Math.min(last ? last.o : 0, fl);
    setOpacity(el.backed, strip); setOpacity(el.docs, strip);
    el.backed.style.pointerEvents = el.docs.style.pointerEvents = strip > 0.5 ? 'auto' : 'none';

    setOpacity(el.chart, chartLabelsOpacity(L));
    setOpacity(el.market, marketLabelOpacity(L));
    el.voices.forEach((v, k) => setOpacity(v, voiceOpacity(L, k, el.voices.length)));

    const h = hintOn(L);
    if (h !== hint) { hint = h; el.hint.style.opacity = h ? '1' : '0'; }

    el.progress.style.width = `calc((100% - var(--cropX, 0px) * 2) * ${L})`;

    const inv = invertAmount(L) > 0.5;
    if (inv !== inverted) {
      inverted = inv;
      document.body.classList.toggle('inverted', inv);
      el.flip?.classList.toggle('on', inv);
      onInvert?.(inv);
    }

    const isLive = Math.min(BEATS - 1, Math.floor(L * BEATS)) === 13;
    if (isLive !== live && el.disc) { live = isLive; el.disc.classList.toggle('live', isLive); }
    if (portrait && el.disc) {
      const d = discByScroll(L);
      if (d.index !== discIdx) { discIdx = d.index; onDisciplineScroll?.(d.index); }
      el.disc.style.setProperty('--fill', fmt(d.fill));
    }
  }
  return { apply };
}
