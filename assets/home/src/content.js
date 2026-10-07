// All page copy and data for the MAVIS Home (temporary content pass).
//
// Layout and motion come unchanged from the lumen scroll study (reference commit 237293c);
// only the words, the chart series and the presentation assets wired in below are new. What
// must stay is STRUCTURE, so the measured layout still applies: the number of lines per block,
// roughly the same length, and where a highlighted word, an accent, a struck word or a
// flipping letter sits. Keep the counts (15 beats, 3 quote groups, 3 struck lines, 3
// disciplines, 5 board columns, 3 axis ticks, 4 chart label keys) and the markers:
//   [hl:words]   word(s) on a highlight box      [ac:words]   accent colour
//   [flip:x]     letter that flips when the palette inverts   \n   forced line break
// Beat 10's [flip:D] starts mirrored and flips to the normal letter (styles.css, #flipE).

import { SINGLES, E0, DE } from '../media/signals/pvdf-singles.js';

// `mark`: the MAVIS overlap mark before the name, two-tone: the measured curve in the text colour,
// its component peaks in teal (media/branding/mark-curve.svg + mark-peaks.svg).
export const BRAND = { name: 'MAVIS', mark: true };

export const HINT = 'Scroll';

// Chart: one square-wave voltammogram (0–0.8 V) of a sample holding four molecules, from the
// open dataset of Duesselberg et al., ACS Electrochem. 2026 (doi:10.1021/acselectrochem.6c00079,
// github.com/esemsc-ald24/ML-Biomarker-Sensing, MIT) — the measured mixture of the MAVIS
// presentation's "overlapping peaks" chart. The 200-point curve is resampled to 41 points,
// then offset and scaled to 0–1000; its shape is unchanged. It is a representative example,
// not one of our own measurements.
//
// The four label keys are left empty: the molecules are named by the component overlay
// (`parts`, drawn by dom.js inside #chartLabels), which labels each one at its own peak.
export const CHART = {
  values: [94, 102, 117, 134, 153, 173, 201, 237, 291, 362, 457, 569, 688, 804, 900, 973, 1000, 943, 828, 707, 603, 517, 445, 392, 365, 369, 404, 446, 450, 401, 336, 288, 266, 257, 225, 165, 103, 55, 25, 9, 0],
  vMax: 1042,
  todayIndex: 20,
  labels: { first: '', mid: '', today: '', projected: '' },
  labelIndex: { first: 19, mid: 12, today: 26, projected: 32 },
  years: ['0 V', '0.4 V', '0.8 V'],
  caption: 'Current vs. potential, one sweep',
  // Component overlay: the presentation's single-molecule curves (media/signals/), each
  // normalised to the same height as the mixture, as that chart draws them, and shown only
  // around its own peak. E runs over the same 0–0.8 V axis as `values`.
  parts: {
    E0, DE, E1: 0.8,
    curves: SINGLES.map((s, k) => ({ ...s, name: ['ascorbic acid', 'serotonin', 'estradiol', 'melatonin'][k] })),
  },
};

// Quotes shown over the climb (three groups; the third is never shown). The quotation
// marks are added by CSS.
export const VOICES = [
  { left: 'Is that one peak, or two peaks sitting so close together that they read as one?',
    right: 'A small peak can vanish inside the shoulder of a larger one.' },
  { left: 'The background current rises under every peak and shifts its height.',
    right: 'Change the electrode, and the same mixture draws another curve.' },
  { statement: 'None of this shows up as a clean, separate peak.' },
];

export const BEATS = [
  { num: '01', name: 'MAVIS', layout: 'hero',
    title: 'Crowded signals. Clear answers.\nMeet [hl:MAVIS].',
    // the no-break space keeps "System." off a line of its own where portrait lets the sub flow
    sub: 'Multi-Analyte Voltammetric Intelligence\u00a0System.' },
  { num: '02', name: 'Signal', layout: 'market',
    kicker: 'The signal MAVIS works with',
    statement: 'Different molecules, [ac:different peaks.]',
    sub: 'When peaks come together,\nthe signal becomes harder to interpret.' },
  { num: '03', name: 'Problem', layout: 'statement',
    // one sentence per line (styles.css widens this statement so the first fits on one line)
    statement: 'When peaks [ac:overlap,] their identities blur.\nMAVIS separates them.' },
  { num: '04', name: 'Problem', layout: 'choice',
    left: { tag: 'What we measure', text: 'One curve with a few broad bumps.',
      figure: { kind: 'electrode', src: 'signals/electrode.svg', caption: 'screen-printed electrode' } },
    right: { tag: 'What it holds', text: 'A separate peak for every molecule, each at its own potential.',
      figure: { kind: 'molecules', items: [['molecules/ascorbic-acid.svg', 'ascorbic acid'], ['molecules/serotonin.svg', 'serotonin'],
        ['molecules/estradiol.svg', 'estradiol'], ['molecules/melatonin.svg', 'melatonin']] } } },
  { num: '05', name: 'Problem', layout: 'statement',
    statement: 'Merged peaks hide [ac:their true identities.]' },
  { num: '06', name: 'Problem', layout: 'empty' },
  { num: '07', name: 'Turn', layout: 'trava',
    lead: 'Every overlap ends in', word: 'guesswork.', struck: 'an answer.' },
  { num: '08', name: 'Turn', layout: 'empty' },
  { num: '09', name: 'Analysis', layout: 'statement', sub: 'Here, a neural network is being built to do the job,\none that reads the whole measured curve at once.',
    statement: 'This is the job of [hl:deconvolution.]',
    // outY: the four output nodes' heights in network.svg (fractions), where the names sit
    figure: { kind: 'network', src: 'system/network.svg', outputs: ['ascorbic acid', 'serotonin', 'estradiol', 'melatonin'], outY: [0.137, 0.379, 0.621, 0.862] } },
  { num: '10', name: 'Deconvolution', layout: 'statement',
    statement: '[flip:D]econvolution reads a mixture\nas [ac:several answers added up.]' },
  { num: '11', name: 'Deconvolution', layout: 'nots',
    statement: 'Deconvolution keeps the curve and drops the [hl:assumptions.]',
    nots: ['Guessing how many peaks there are.', 'Assuming every peak has the same shape.', 'Reading one height per molecule.'] },
  { num: '12', name: 'System', layout: 'statement',
    statement: 'MAVIS is being built as [ac:one system,] from each measurement to identified, quantified molecules with evidence.' },
  { num: '13', name: 'Explanation', layout: 'statement',
    statement: 'Explainable AI, designed to show\n[ac:the evidence behind each answer.]',
    // The figure illustrates the idea (it is not a model output): the stretch of the mixture curve
    // an answer rests on, highlighted. band: centre of that stretch in evidence.svg (fraction of its width)
    figure: { kind: 'evidence', src: 'vision/evidence.svg', answer: 'estradiol', band: 0.63 } },
  { num: '14', name: 'System', layout: 'disciplines',
    statement: 'Five connected steps take a measurement to an answer with its evidence, end to end.' },
  { num: '15', name: 'Vision', layout: 'cta',
    statement: 'MAVIS aims to turn crowded signals into [hl:chemical information] you can interpret.',
    sub: 'Designed as one connected system, from measurement to explanation.',
    // no fine print under the button (the reference's `fineline`); the strip and Sources still
    // fade in at the point it would have
    button: 'Explore MAVIS' },
];

// System board (beat 14): three lenses (chips) over the five steps of the end-to-end system
// (columns). `frags` are keyed by lens id. The pattern of which columns light up per lens is
// the reference's (col 1: 1+2, col 2: 1+3, col 3: 2+3, col 4: 2, col 5: 3), so no lens
// lights more than three columns — portrait shows only the lit ones. `icon` names a stage
// icon from the presentation's system diagram (media/system/) or the overlap mark.
export const DISCIPLINES = [
  { id: 'measure', index: '01', name: 'Measure the signal' },
  { id: 'separate', index: '02', name: 'Separate the peaks' },
  { id: 'answer', index: '03', name: 'Reach an answer' },
];
export const TEAM = [
  { name: 'Measurement', role: 'Electrode and potential sweep', icon: 'lab',
    frags: { measure: 'A screen-printed electrode sweeps its potential through the sample and records the current it draws, one curve per scan. Blank runs record the background.',
             separate: 'Molecules are measured alone first, then in pairs.' } },
  { name: 'Signal', role: 'One voltammogram per scan', icon: 'data',
    frags: { measure: 'Each scan is checked for quality before anything else reads it.',
             answer: 'Each scan is matched with its blank and labelled, so answers reflect the molecules, not the background.' } },
  { name: 'Analysis', role: 'A neural network reads the curve', icon: 'model',
    frags: { separate: 'Reads the whole curve, not one peak.', answer: 'Is each molecule there, or not?' } },
  { name: 'Identify & quantify', role: 'Which molecule, and how much of it', icon: 'mark',
    frags: { separate: 'Works out which molecule is behind each part of the curve and how much of it there is, even when two of their peaks share a single bump in the signal.' } },
  { name: 'Explained output', role: 'The answer and its evidence', icon: 'app',
    frags: { answer: 'An answer you can check: the curve behind it, and how sure it is.' } },
];

// The strip is the reference's partner row, holding only the product's name: MAVIS signs off the
// page on its own. Its "Backed by" + bold name (`lead`, `name`) and the small teal word before the
// partners (`label`) are left out; dom.js skips them when unset.
export const BACKED = { partners: ['MAVIS'] };

export const DOCS = {
  toggle: 'Sources',
  links: [
    { text: 'Example data: open dataset', href: 'https://github.com/esemsc-ald24/ML-Biomarker-Sensing' },
    { text: 'Dataset paper (ACS Electrochem.)', href: 'https://doi.org/10.1021/acselectrochem.6c00079' },
    { text: 'Source code of this site', href: 'https://github.com/batuaribakir/peakdeconv-site' },
    { text: 'About the scroll design', href: 'https://github.com/batuaribakir/lumen-scroll-study#readme' },
  ],
};

// Closing sheet (opened by the beat-15 button): the site's other pages. Three rows take the
// places of the reference's three form fields (the same three pages as the site menu, in its
// order); the latest presentation takes the submit button's.
export const LEAD = {
  title: 'Explore MAVIS',
  sub: 'Each page goes one step deeper than this introduction.',
  links: [
    { label: 'Development plan and progress', text: 'Dashboard', href: './dashboard/' },
    { label: 'Technical briefings', text: 'Presentations', href: './presentations/' },
    { label: 'The people behind MAVIS', text: 'Team', href: './team/' },
  ],
  primary: { text: 'Open the technical overview', href: './presentations/technical-overview.html' },
};
