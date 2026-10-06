// Builds the page's DOM from content.js: the 15 beats, the chart and quote labels, the
// chrome (brand, music button, hint), and the end-state furniture (backed strip, docs
// toggle and panel, lead sheet). Layout lives in styles.css.

import { BRAND, HINT, CHART, VOICES, BEATS, DISCIPLINES, TEAM, BACKED, DOCS, LEAD } from './content.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Inline markup: [hl:..] highlight, [ac:..] accent, [flip:x] mirroring letter, \n line break. */
export function rich(text, { flipId = null } = {}) {
  let out = '', i = 0;
  const re = /\[(hl|ac|flip):([^\]]*)\]/g;
  let m;
  while ((m = re.exec(text))) {
    out += esc(text.slice(i, m.index));
    const body = esc(m[2]);
    if (m[1] === 'hl') out += `<span class="hl">${body}</span>`;
    else if (m[1] === 'ac') out += `<span class="accent">${body}</span>`;
    else out += `<span class="flip${flipId ? '' : ' on'}"${flipId ? ` id="${flipId}"` : ''}>${body}</span>`;
    i = re.lastIndex;
  }
  out += esc(text.slice(i));
  // a space before each break keeps words apart where portrait hides the <br>
  return out.replace(/\n/g, ' <br>');
}

const svg = (vb, body, cls = '') => `<svg viewBox="${vb}" ${cls ? `class="${cls}"` : ''} aria-hidden="true" focusable="false">${body}</svg>`;

// Original line icons (1.5 px strokes on a 20 px grid).
const ICON_SPEAKER = svg('0 0 20 20',
  '<path class="spk-body" d="M3.5 7.5h2.8L10 4.2v11.6L6.3 12.5H3.5z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>' +
  '<g class="spk-wave"><path class="w1" d="M12.6 7.6a3.4 3.4 0 0 1 0 4.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
  '<path class="w2" d="M14.9 5.4a6.6 6.6 0 0 1 0 9.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></g>' +
  '<g class="spk-mute"><path d="M13 7.8l4.4 4.4M17.4 7.8L13 12.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></g>', 'spk');
const ICON_CHEVRON = svg('0 0 12 12', '<path d="M2.5 7.5L6 4l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>');
const ICON_ARROW = svg('0 0 16 16', '<path d="M4.5 11.5l7-7M6 4.5h5.5V10" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>', 'arrow');

// MAVIS: a presentation asset inside an existing text slot (an SVG from media/, drawn in the
// slot's own text colour through a CSS mask; see .ga in styles.css). Empty when unset.
const asset = name => (name ? `<i class="ga ga-${name}" aria-hidden="true"></i>` : '');

// MAVIS: a figure from media/ under an existing text block (inside it, absolutely positioned,
// so it rides that block's fade and drift and moves no text). Spans only: it may sit in a <p>.
const MEDIA = './assets/home/media/';
function figure(f) {
  if (!f) return '';
  const img = (src, cls = '') => `<img class="${cls}" src="${MEDIA}${src}" alt="" decoding="async">`;
  let body = '';
  if (f.kind === 'molecules') body = f.items.map(([src, name]) => `<span class="mol">${img(src)}<span class="cap">${esc(name)}</span></span>`).join('');
  else if (f.kind === 'network') body = img(f.src) + f.outputs.map((n, k) => `<span class="out" style="top:${(f.outY[k] * 100).toFixed(1)}%">${esc(n)}</span>`).join('');
  else if (f.kind === 'evidence') body = `<span class="ans" style="left:${f.band * 100}%">${esc(f.answer)}</span>${img(f.src)}` +
    (f.caption ? `<span class="cap" style="left:${f.band * 100}%">${esc(f.caption)}</span>` : '');
  else body = img(f.src) + (f.caption ? `<span class="cap">${esc(f.caption)}</span>` : '');
  return `<span class="fig fig-${f.kind}" aria-hidden="true">${body}</span>`;
}

// MAVIS: the presentation's "overlapping peaks" chart (single-molecule curves under the
// measured mixture), redrawn inside #chartLabels in the chart's own frame, so it fades in and
// out with the chart labels. Each curve keeps the presentation's normalisation, is scaled to
// PART_TOP of the mixture's top, shown only within PART_FADE volts of its own peak and named
// above that peak. Portrait staggers the names (LIFT rows) to keep them clear of each other
// and of the mixture curve.
const PART_TOP = 0.93, PART_FADE = 0.17;
const LIFT = { landscape: [0, 0, 0, 0], portrait: [2, 1, 0, 1] };
// stage-px nudge of a name: landscape moves "ascorbic acid" left, off the mixture's rising flank
const SHIFT = { landscape: [-30, 0, 0, 0], portrait: [0, 0, 0, 0] };
function partsOverlay(cfg) {
  const P = CHART.parts;
  if (!P) return '';
  const ch = cfg.chart, W = cfg.stage.w, H = cfg.stage.h, portrait = cfg.name === 'portrait';
  const X = e => ch.x0 + (ch.x1 - ch.x0) * (e - P.E0) / (P.E1 - P.E0);
  const Y = v => ch.yBase - (ch.yBase - ch.yTop) * v * PART_TOP * 1000 / CHART.vMax;
  const fs = portrait ? 28 : 15, gap = portrait ? 22 : 14, lift = LIFT[cfg.name] || LIFT.landscape, shift = SHIFT[cfg.name] || SHIFT.landscape;
  let defs = '', paths = '', names = '';
  P.curves.forEach((c, k) => {
    const xa = X(c.apexE), dx = X(c.apexE + PART_FADE) - xa;
    defs += `<linearGradient id="pf${k}" gradientUnits="userSpaceOnUse" x1="${(xa - dx).toFixed(1)}" x2="${(xa + dx).toFixed(1)}" y1="0" y2="0">` +
      '<stop offset="0" stop-color="currentColor" stop-opacity="0"/><stop offset=".3" stop-color="currentColor"/>' +
      '<stop offset=".7" stop-color="currentColor"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient>';
    let d = '';
    c.y.forEach((v, i) => {
      const e = P.E0 + P.DE * i;
      if (Math.abs(e - c.apexE) <= PART_FADE + P.DE) d += `${d ? 'L' : 'M'}${X(e).toFixed(1)},${Y(v).toFixed(1)}`;
    });
    paths += `<path d="${d}" stroke="url(#pf${k})"/>`;
    names += `<text x="${(xa + shift[k]).toFixed(1)}" y="${(Y(1) - gap - lift[k] * fs * 1.75).toFixed(1)}" text-anchor="middle">${esc(c.name)}</text>`;
  });
  return `<svg class="parts" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false"><defs>${defs}</defs><g class="curves">${paths}</g><g class="names">${names}</g></svg>`;
}

function beatInner(b) {
  switch (b.layout) {
    case 'hero':
      return `<h1>${rich(b.title)}</h1><p class="sub">${rich(b.sub)}</p>`;
    case 'market':
      return `<div class="market-right"><div class="kicker">${esc(b.kicker)}</div>` +
        `<p class="statement">${rich(b.statement)}</p><p class="sub">${rich(b.sub)}</p></div>`;
    case 'statement': {
      const flipId = b.num === '10' ? 'flipE' : null;
      return `<p class="statement">${rich(b.statement, { flipId })}${b.sub ? '' : figure(b.figure)}</p>` + (b.sub ? `<p class="sub">${rich(b.sub)}${figure(b.figure)}</p>` : '');
    }
    case 'choice':
      return `<div class="choice-cols"><div class="col left"><div class="tag">${esc(b.left.tag)}</div><p>${rich(b.left.text)}</p>${figure(b.left.figure)}</div>` +
        `<div class="col right"><div class="tag">${esc(b.right.tag)}</div><p>${rich(b.right.text)}</p>${figure(b.right.figure)}</div></div>`;
    case 'trava':
      return `<p class="statement" id="turnLine">${esc(b.lead)}<br><span id="turnWord">${esc(b.word)}</span>` +
        `<span id="turnNew" class="hl"> ${esc(b.struck)}</span></p>`;
    case 'nots':
      return `<p class="statement">${rich(b.statement)}</p><div class="nots">${b.nots.map(n => `<span>${esc(n)}</span>`).join('')}</div>`;
    case 'disciplines':
      return `<div class="disc-wrap"><div class="disc-head"><p class="statement">${rich(b.statement)}</p></div>` +
        `<div class="fb"><div class="fb-chips" id="teamChips" role="tablist">` +
        DISCIPLINES.map((d, k) => `<button class="fb-chip${k === 0 ? ' on' : ''}" type="button" role="tab" aria-selected="${k === 0}" data-d="${d.id}"><span class="cidx">${esc(d.index)}</span><span>${esc(d.name)}</span></button>`).join('') +
        `</div><div class="fb-board" id="teamBoard">` +
        TEAM.map(m => `<div class="fb-col"><div class="head"><div class="nm">${asset(m.icon)}${esc(m.name)}</div><div class="role">${esc(m.role)}</div></div>` +
          DISCIPLINES.filter(d => m.frags[d.id]).map(d => `<div class="fb-frag" data-d="${d.id}"><div class="tx">${esc(m.frags[d.id])}</div></div>`).join('') + `</div>`).join('') +
        `</div></div></div>`;
    case 'cta':
      return `<p class="statement">${rich(b.statement)}</p><p class="sub">${rich(b.sub)}</p>` +
        `<a class="btn" href="#lead" id="ctaBtn"><span>${rich(b.button)}</span><span aria-hidden="true">→</span></a>` +
        (b.fineline ? `<p class="fineline">${rich(b.fineline)}</p>` : '');
    default:
      return '';
  }
}

/** Chart label positions: offsets from the chart point they annotate (config.chartLabelOffset). */
export function chartLabelLayout(cfg) {
  const { values, vMax, labelIndex } = CHART, n = values.length, ch = cfg.chart;
  const X = i => ch.x0 + (ch.x1 - ch.x0) * i / (n - 1), Y = v => ch.yBase - (ch.yBase - ch.yTop) * v / vMax;
  const at = k => { const i = labelIndex[k], [dx, dy] = cfg.chartLabelOffset[k]; return [Math.round(X(i) + dx), Math.round(Y(values[i]) + dy)]; };
  return { first: at('first'), mid: at('mid'), today: at('today'), projected: at('projected') };
}

export function buildDom(stage, cfg) {
  // beats, inserted before the end-state furniture so the stacking order matches
  stage.querySelectorAll('section.beat').forEach(s => s.remove());
  const anchor = stage.querySelector('#backedStrip');
  for (const b of BEATS) {
    const s = document.createElement('section');
    s.className = 'beat' + (b.layout === 'market' ? ' market' : b.layout === 'disciplines' ? ' disciplinas' : '');
    s.dataset.num = b.num;
    s.dataset.name = b.name;
    s.dataset.layout = b.layout;
    s.innerHTML = beatInner(b);
    stage.insertBefore(s, anchor);
  }

  const pos = chartLabelLayout(cfg), yr = cfg.chartYears;
  stage.querySelector('#chartLabels').innerHTML = partsOverlay(cfg) +
    `<span class="num" style="left:${pos.first[0]}px;top:${pos.first[1]}px">${esc(CHART.labels.first)}</span>` +
    `<span class="num" style="left:${pos.mid[0]}px;top:${pos.mid[1]}px">${esc(CHART.labels.mid)}</span>` +
    `<span class="num today" style="left:${pos.today[0]}px;top:${pos.today[1]}px">${esc(CHART.labels.today)}</span>` +
    `<span class="num" style="left:${pos.projected[0]}px;top:${pos.projected[1]}px">${esc(CHART.labels.projected)}</span>` +
    CHART.years.map((y, k) => `<span class="yr" style="left:${yr.x[k]}px;top:${yr.y}px">${esc(y)}</span>`).join('');
  stage.querySelector('.market-label').textContent = CHART.caption;

  stage.querySelector('#opsLabels').innerHTML = VOICES.map(v => `<div class="vgrp">` +
    (v.statement ? `<div class="vq stmt">${esc(v.statement)}</div>` : `<div class="vq">${esc(v.left)}</div><div class="vq r">${esc(v.right)}</div>`) + `</div>`).join('');

  stage.querySelector('.brand').innerHTML = (BRAND.mark ? `<span class="mark" aria-hidden="true">${asset('mark-curve')}${asset('mark-peaks')}</span>` : '') + esc(BRAND.name);
  stage.querySelector('#bgmBtn').innerHTML = ICON_SPEAKER;
  stage.querySelector('#hint').innerHTML = `<span>${esc(HINT)}</span><div class="mouse"></div>`;

  stage.querySelector('#backedStrip').innerHTML =
    (BACKED.name ? `<div class="by"><span class="lead">${esc(BACKED.lead)}</span><span class="name">${esc(BACKED.name)}</span></div><span class="sep"></span>` : '') +
    `<div class="pf">${BACKED.label ? `<span class="lbl">${esc(BACKED.label)}</span>` : ''}<span class="cos">${BACKED.partners.map(esc).join('<i>·</i>')}</span></div>`;

  stage.querySelector('#docsToggle').innerHTML = `<span>${esc(DOCS.toggle)}</span>${ICON_CHEVRON}`;
  stage.querySelector('#docsPanel').innerHTML = `<ul>${DOCS.links.map(l => `<li><a href="${esc(l.href)}" tabindex="-1"${/^https?:/.test(l.href) ? ' target="_blank" rel="noopener"' : ''}>${esc(l.text)}${ICON_ARROW}</a></li>`).join('')}</ul>`;

  // The sheet lists the site's pages: each link row takes a form field's place (.fld), the
  // primary page takes the submit button's (.btn).
  stage.querySelector('#leadSheet').innerHTML =
    `<div class="shade"></div><div class="sheet"><button class="x" type="button" aria-label="Close">×</button>` +
    `<nav aria-labelledby="leadTitle"><div class="shTitle" id="leadTitle">${esc(LEAD.title)}</div><div class="shSub">${esc(LEAD.sub)}</div>` +
    LEAD.links.map(l => `<a class="fld" href="${esc(l.href)}"><span class="lbl">${esc(l.label)}</span><span class="val">${esc(l.text)}</span></a>`).join('') +
    `<a class="btn" href="${esc(LEAD.primary.href)}"><span>${esc(LEAD.primary.text)}</span><span aria-hidden="true">→</span></a>` +
    `</nav></div>`;
}
