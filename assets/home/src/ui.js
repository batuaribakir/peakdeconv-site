// Interactive pieces: music button, discipline chips, docs popover, lead sheet.
// Behaviour follows reference-spec.md §13; nothing here talks to a network.

import { DISCIPLINES } from './content.js';

// Original ambient loop generated for this page by tools/lumen/make-track.py (no samples,
// recordings or existing melodies). Set to null to ship without music; the button still works.
// The path resolves against the page (the root index.html), not this module.
export const AUDIO_SRC = './assets/home/audio/lumen-ambient.mp3';
const AUDIO_KEY = 'lumen-bgm';
const TARGET_VOLUME = 0.35;

function ramp(audio, to, ms = 1200) {
  const from = audio.volume, t0 = performance.now();
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    audio.volume = from + (to - from) * k;
    if (k < 1) setTimeout(step, 50);
    else if (to === 0) audio.pause();
  };
  step();
}

export function setupMusic(stage) {
  const btn = stage.querySelector('#bgmBtn'), audio = stage.querySelector('#bgm');
  if (AUDIO_SRC) audio.src = AUDIO_SRC;
  let state = 'pending';
  const store = v => { try { sessionStorage.setItem(AUDIO_KEY, v); } catch { /* private mode */ } };
  const stored = (() => { try { return sessionStorage.getItem(AUDIO_KEY); } catch { return null; } })();
  const show = s => { state = s; btn.className = s; btn.setAttribute('aria-pressed', String(s === 'on')); };

  const start = () => {
    if (!AUDIO_SRC) { show('on'); store('on'); return; }
    audio.muted = false; audio.volume = 0;
    audio.play().then(() => { show('on'); store('on'); ramp(audio, TARGET_VOLUME); }).catch(() => show('pending'));
  };
  const stop = () => { show('muted'); store('off'); if (AUDIO_SRC) ramp(audio, 0, 500); };

  if (stored === 'off') show('muted');
  btn.addEventListener('click', e => { e.stopPropagation(); state === 'on' ? stop() : start(); });

  // First trusted pointer/key interaction anywhere starts the track (only when one ships).
  const first = e => {
    if (!AUDIO_SRC || state !== 'pending' || e.target.closest?.('#bgmBtn')) return;
    for (const t of ['pointerdown', 'keydown', 'touchend']) window.removeEventListener(t, first, true);
    start();
  };
  for (const t of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(t, first, { capture: true, passive: true });
}

export function setupDisciplines(stage, cfg) {
  const chips = [...stage.querySelectorAll('.fb-chip')], cols = [...stage.querySelectorAll('.fb-col')];
  if (!chips.length) return { select: () => {} };
  let current = 0;
  function select(k) {
    current = k;
    const id = DISCIPLINES[k].id;
    chips.forEach((c, i) => { c.classList.toggle('on', i === k); c.setAttribute('aria-selected', String(i === k)); });
    for (const col of cols) {
      const frags = [...col.querySelectorAll('.fb-frag')];
      frags.forEach(f => f.classList.toggle('lit', f.dataset.d === id));
      col.classList.toggle('off', !frags.some(f => f.dataset.d === id));
    }
  }
  select(0);
  if (cfg.disciplines === 'timer') {
    // The chip fill is an 8 s CSS animation; its end advances to the next discipline.
    stage.addEventListener('animationend', e => { if (e.animationName === 'chip-fill') select((current + 1) % chips.length); });
    chips.forEach((c, i) => c.addEventListener('mouseenter', () => { if (i !== current) select(i); }));
  }
  chips.forEach((c, i) => c.addEventListener('click', () => select(i)));
  return { select };
}

export function setupDocs(stage) {
  const toggle = stage.querySelector('#docsToggle'), panel = stage.querySelector('#docsPanel');
  const links = [...panel.querySelectorAll('a')];
  const set = open => {
    panel.classList.toggle('open', open);
    panel.setAttribute('aria-hidden', String(!open));
    toggle.setAttribute('aria-expanded', String(open));
    links.forEach(a => (a.tabIndex = open ? 0 : -1));
  };
  toggle.addEventListener('click', e => { e.stopPropagation(); set(!panel.classList.contains('open')); });
  document.addEventListener('click', e => { if (!panel.contains(e.target)) set(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
}

export function setupLead(stage) {
  const sheet = stage.querySelector('#leadSheet'), cta = stage.querySelector('#ctaBtn');
  let lastFocus = null;
  const focusables = () => [...sheet.querySelectorAll('button, input, a[href]')].filter(n => !n.disabled);
  const open = () => {
    lastFocus = document.activeElement;
    sheet.classList.add('open'); sheet.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('sheet-open');
    sheet.querySelector('input, a[href]')?.focus({ preventScroll: true });
  };
  const close = () => {
    sheet.classList.remove('open'); sheet.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('sheet-open');
    lastFocus?.focus?.({ preventScroll: true });
  };
  cta?.addEventListener('click', e => { e.preventDefault(); open(); });
  sheet.querySelector('.shade').addEventListener('click', close);
  sheet.querySelector('.x').addEventListener('click', close);
  document.addEventListener('keydown', e => {
    if (!sheet.classList.contains('open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') {                                     // keep focus inside the dialog
      const f = focusables(), i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f.at(-1).focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });
}
