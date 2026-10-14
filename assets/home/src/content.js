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

import { COMPONENTS, VALUES, E0, DE } from '../media/signals/illustrative.js';

// `mark`: the MAVIS overlap mark before the name, two-tone: the measured curve in the text colour,
// its component peaks in teal (media/branding/mark-curve.svg + mark-peaks.svg).
export const BRAND = { name: 'MAVIS', mark: true };

export const HINT = 'Scroll';

// Chart: an ILLUSTRATIVE voltammogram (0–0.8 V) of a sample holding the three molecules MAVIS
// works with: dopamine, serotonin and melatonin. It is a model, not a measurement (see
// media/signals/illustrative.js): no recorded mixture of these three molecules is available, so
// the curve is the sum of three model peaks, and the caption says it is illustrative.
// (Until October 2026 this chart showed measured mixtures from the open dataset of Duesselberg et
// al., ACS Electrochem. 2026, first with estradiol, then of ascorbic acid, serotonin and melatonin.
// Neither ascorbic acid nor estradiol is part of MAVIS any more, and that dataset has no dopamine.)
//
// The four label keys are left empty: the molecules are named by the component overlay
// (`parts`, drawn by dom.js inside #chartLabels), which labels each one at its own peak.
export const CHART = {
  values: VALUES,
  vMax: 1042,
  todayIndex: 20,
  labels: { first: '', mid: '', today: '', projected: '' },
  labelIndex: { first: 19, mid: 12, today: 26, projected: 32 },
  years: ['0 V', '0.4 V', '0.8 V'],
  caption: 'Illustrative curve, not measured',
  // Component overlay: the model's three peaks (media/signals/), drawn at their true share of
  // the composite (they add up to the curve above them) and shown only around their own peak.
  // E runs over the same 0–0.8 V axis as `values`.
  parts: {
    E0, DE, E1: 0.8,
    curves: COMPONENTS.map((c, k) => ({ ...c, name: ['dopamine', 'serotonin', 'melatonin'][k] })),
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
    statement: 'When peaks [ac:merge,] their identities blur.\nMAVIS separates them.' },
  { num: '04', name: 'Problem', layout: 'choice',
    left: { tag: 'What we measure', text: 'One curve with a few broad bumps.',
      figure: { kind: 'electrode', src: 'signals/electrode.svg', caption: 'screen-printed electrode' } },
    right: { tag: 'What it holds', text: 'A separate peak for every molecule, each at its own potential.',
      figure: { kind: 'molecules', items: [['molecules/dopamine.svg', 'dopamine'], ['molecules/serotonin.svg', 'serotonin'],
        ['molecules/melatonin.svg', 'melatonin']] } } },
  { num: '05', name: 'Problem', layout: 'statement',
    statement: 'Merged peaks hide [ac:their true identities.]' },
  { num: '06', name: 'Problem', layout: 'empty' },
  { num: '07', name: 'Turn', layout: 'trava',
    lead: 'A merged peak ends in', word: 'guesswork.', struck: 'an answer.' },
  { num: '08', name: 'Turn', layout: 'empty' },
  { num: '09', name: 'Analysis', layout: 'statement', sub: 'Here, a neural network is being built to do the job,\none that reads the whole measured curve at once.',
    statement: 'This is the job of [hl:deconvolution.]',
    // outY: the three output nodes' heights in network.svg (fractions), where the names sit
    figure: { kind: 'network', src: 'system/network.svg', outputs: ['dopamine', 'serotonin', 'melatonin'], outY: [0.2, 0.5, 0.8] } },
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
    // an answer rests on, highlighted — here the melatonin peak (0.65 V) of the chart's illustrative curve.
    // band: centre of that stretch in evidence.svg (fraction of its width)
    figure: { kind: 'evidence', src: 'vision/evidence.svg', answer: 'melatonin', band: 0.7996 } },
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
