// Viewport measurement, orientation, stage fit and runway height.
//
// Measured behaviour kept on purpose (reference-spec.md §4.2):
//  - the viewport width is documentElement.clientWidth, the height the larger of 100lvh
//    and clientHeight; both are read at mount and again only on a window resize;
//  - a height-only shrink (a mobile URL bar collapsing back) is ignored until the width
//    changes, so the stage does not jump while scrolling on phones.

import { configFor, stageScale } from './config.js';

function lvh() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100lvh;visibility:hidden;pointer-events:none';
  document.body.appendChild(probe);
  const h = probe.getBoundingClientRect().height;
  probe.remove();
  return h;
}

export function measureViewport(prev = null) {
  const d = document.documentElement, h = lvh();
  return { w: d.clientWidth, h: Math.max(h, d.clientHeight, prev && prev.w === d.clientWidth ? prev.h : 0) };
}

/** Applies config + fit for viewport vp. Returns { cfg, scale } . */
export function applyStage(vp) {
  const cfg = configFor(vp.w, vp.h), scale = stageScale(cfg, vp.w, vp.h);
  const root = document.documentElement, stage = document.getElementById('stage'), runway = document.getElementById('runway');
  const cropX = Math.max(0, (cfg.stage.w - vp.w / scale) / 2), cropY = Math.max(0, (cfg.stage.h - vp.h / scale) / 2);
  const runwayPx = Math.round(cfg.runwayVh / 100 * vp.h);
  root.dataset.orientation = cfg.name;
  root.style.setProperty('--vp-h', `${vp.h}px`);
  root.style.setProperty('--runway-px', `${runwayPx}px`);
  runway.style.height = `${runwayPx}px`;
  stage.style.setProperty('--stage-w', cfg.stage.w);
  stage.style.setProperty('--stage-h', cfg.stage.h);
  stage.style.setProperty('--sk', cfg.yScale);
  stage.style.setProperty('--stage-scale', scale);
  stage.style.setProperty('--cropX', `${cropX}px`);
  stage.style.setProperty('--cropY', `${cropY}px`);
  return { cfg, scale };
}

/** Calls onChange(vp) when a resize changes the width or grows the height. */
export function watchViewport(getVp, onChange) {
  const handler = () => {
    if ((window.visualViewport?.scale ?? 1) !== 1) return;     // pinch zoom: leave the layout alone
    const prev = getVp(), d = document.documentElement;
    if (d.clientWidth === prev.w && d.clientHeight <= prev.h) return;
    const next = measureViewport(prev);
    if (next.w !== prev.w || next.h > prev.h) onChange(next);
  };
  window.addEventListener('resize', handler, { passive: true });
  window.visualViewport?.addEventListener('resize', handler, { passive: true });
  return () => { window.removeEventListener('resize', handler); window.visualViewport?.removeEventListener('resize', handler); };
}
