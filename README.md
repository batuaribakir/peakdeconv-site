# Peak Deconvolution — project site

Static multi-page site for the Peak Deconvolution project, Team 1 (Deep Learning track).
No build step, no package manager: plain HTML, CSS and JavaScript.

```
.
├── index.html            Home: a scroll narrative (see "Home" below)
├── presentations/        presentation weeks, format, materials
├── project/              problem, work packages, schedule, scope
├── team/                 members, roles, ways of working
├── resources/            repository, data sources, stack, reading
├── assets/
│   ├── home/             Home only: styles.css, src/ (ES modules), media/, audio/
│   ├── css/site.css      shared chrome (global panel, page bar) + page shell
│   ├── js/site.js        global panel controller + section scroll-spy
│   └── icons/favicon.svg
├── tools/
│   ├── check-schedule-snapshot.py   verifies the values copied into the pages
│   ├── stage-site.py                builds the directory GitHub Pages serves
│   └── validate-site.py             checks that directory before it is published
├── .github/workflows/pages.yml      the deployment
└── dashboard/            the project dashboard (see dashboard/README.md)
```

## Run it locally

Serve the **repository root**, not a subfolder, so that the directory URLs below resolve
to their `index.html`:

```
python3 -m http.server 8000
```

Then open <http://localhost:8000/>. Home is built from ES modules, so it has to come from
a server like this one: opened straight from the file system it stays blank.

| Page          | URL                             |
|---------------|---------------------------------|
| Home          | `/`                             |
| Dashboard     | `/dashboard/`                   |
| Presentations | `/presentations/`               |
| Project       | `/project/`                     |
| Team          | `/team/`                        |
| Resources     | `/resources/`                   |

In-page anchors work too, for example `/dashboard/#tasks` or `/project/#packages`.

Every link on the site is relative, so the same files also work when the site is served
from a sub-path such as `https://<user>.github.io/peakdeconv-site/` — no base URL or
rewrite is needed. That is what the deployment below relies on.

## Deployment

The site is published at **<https://batuaribakir.github.io/peakdeconv-site/>** by
`.github/workflows/pages.yml`, which runs on every push to `main` and can also be started
by hand from **Actions → Deploy site to GitHub Pages → Run workflow**. Pages is configured
with **Settings → Pages → Source: GitHub Actions**; there is no `gh-pages` branch and
nothing is committed by the deployment.

There is no build step. The workflow stages the files the site needs and uploads *only*
that directory:

1. `python3 tools/check-schedule-snapshot.py` — the run fails if Project or
   Presentations have fallen behind `dashboard/data/project-data.js`, so a stale page is
   never published.
2. `python3 tools/stage-site.py _site` — copies the files the six pages load at run
   time into `_site/`, each keeping its path so `index.html` stays at the top level and
   every relative link still resolves.
3. `python3 tools/validate-site.py _site` — prints the staged tree, then fails on a
   missing entry page or asset, a link that resolves to nothing, or anything that must
   stay out of the artifact.
4. `actions/upload-pages-artifact` uploads `_site`, and a second job deploys it with
   `actions/deploy-pages` in the `github-pages` environment.

`tools/stage-site.py` works from an allow-list, not an exclude-list: only the paths in its
`MANIFEST` are copied, and a path that has gone missing fails the run rather than
producing a thinner site. So the published artifact contains no `.git/`, `.github/`,
`README.md`, `tools/`, `dashboard/tools/`, `dashboard/data/source/` or `.xlsx` — and none
of the ~5.5 MB of `dashboard/assets/spline/` design files, which the dashboard names in
source comments but never loads. `_site/` is 66 files, about 2.4 MB; 2 MB of that is
Home's music, which a browser fetches only when the music starts.

Home's modules and music are reached from JavaScript, not from an `href` or `src`, so the
link check in `validate-site.py` cannot see them. They are listed in its `REQUIRED` paths
instead: a module added to `assets/home/src/`, or a file added to `assets/home/media/`,
must go into both lists.

### Inspecting a deployment

Run the same three commands locally to get exactly what CI uploads:

```
python3 tools/check-schedule-snapshot.py
python3 tools/stage-site.py _site
python3 tools/validate-site.py _site
python3 -m http.server 8000 --directory _site
```

`validate-site.py` lists every staged file with its size; the server then lets you walk
`/`, `/dashboard/`, `/presentations/`, `/project/`, `/team/` and `/resources/` against the
real artifact rather than the repository. To reproduce the published URL's
`/peakdeconv-site/` prefix, stage one level down and serve the parent:

```
python3 tools/stage-site.py /tmp/pages/peakdeconv-site
python3 tools/validate-site.py /tmp/pages/peakdeconv-site
python3 -m http.server 8000 --directory /tmp/pages
```

Then open <http://localhost:8000/peakdeconv-site/>.

On GitHub, **Actions** shows each run: the *Validate the staged directory* step holds the
file listing, and the `github-pages` deployment on the *Deploy* job links to the live URL.
`_site/` is build output — delete it when you are done, or leave it untracked.

## Navigation

There are two navigations, with one job each.

**Global — the six destinations of the site.** It lives in a panel that slides in from
the left, and it is the same panel and the same state on every page, dashboard included —
except Home, which carries no site chrome at all (see "Home" below).

- From 1024 px up, a **handle sits on the left edge** of the window at all times, in the
  page's left margin. Hovering it opens the panel after ~90 ms. The handle then rides out
  to the panel's right edge, so the two stay edge to edge: the pointer can cross between
  them without ever passing over the page, and the handle stays clickable. Leaving both
  closes the panel after ~220 ms of grace, which is what stops it flickering on the way
  across.
- **Clicking** the handle opens the panel and pins it: once clicked it no longer closes on
  pointer-out, only on a second click, a click outside, the close button, or Escape.
- **Tabbing** to the handle opens the panel: the handle is the element immediately
  before it in the document, so the next Tab walks straight into the links. **Escape**
  closes it and returns focus to the handle; focus then has to leave and come back before
  it opens again, so Escape is never undone by the focus it restores. Focus landing
  outside the panel and its controls closes it, so tabbing past the last link never
  leaves an open panel behind.
- Below 1024 px the handle gives way to a **Menu button in the bar at the top**, which
  opens the same panel with a dimming scrim behind it. The swap happens there, not at a
  phone width, because the left margin only clears a 34 px handle once the page gutter has
  grown past about 40 px. Exactly one of the two controls is on screen at any width.
- The button sits *after* the panel in the document, so Tab out of it would walk away from
  the panel rather than into it. **Enter or Space on the Menu button therefore moves focus
  into the panel**, onto its Close button; Tab from there reaches the six links in order.
  **Escape and the Close button** both close the panel and return focus to Menu. The
  button opens on activation only — focus-opening belongs to the handle, where Tab order
  makes it work.
- `aria-expanded` is mirrored on both controls, `aria-controls` points at the panel, and
  the closed panel is `visibility: hidden`, so its links are out of the tab order and out
  of the accessibility tree rather than merely off-screen.

**The dashboard's task drawer outranks the menu.** The drawer is a modal dialog with its
own scrim. `assets/css/site.css` raises the two above the panel and the handle (scrim 48,
drawer 49, against panel 46 and handle 47; the dashboard's tooltip stays on top at 60), so
the scrim catches any click aimed at the handle behind it. `assets/js/site.js` watches the
drawer and, while it is open, closes the panel and takes both menu controls out of the
pointer and tab order, so nothing can be reached through the scrim by mouse or keyboard.
The drawer's own behaviour — focus trap, Escape, focus returning to the task row — is
untouched; `dashboard/css/styles.css` is not modified at all.

**Sections — headings of the page you are on.** These live in the bar at the top of each
page and only ever link to ids that exist on that page. The dashboard keeps its own bar
(Overview · Schedule · Packages · Tasks · Analytics · Milestones · Team) with its progress
ring, driven by `dashboard/js/ui/nav.js`; the static pages use `.pagebar`, driven by the
scroll-spy in `assets/js/site.js`. Neither script touches the other: the dashboard's bar
carries no `data-section-nav`.

**Without JavaScript** the panel is not a control at all, so the whole chrome drops out of
fixed positioning and into normal flow: the six global links render as a plain wrapped
list at the top of the page and the page bar follows underneath. All six stay visible and
clickable down to 390 px. Verified with JavaScript disabled at 390 px on every page but
Home, which shows a plain list of the other pages instead.

`prefers-reduced-motion: reduce` removes the panel's slide, its open/close delays and the
smooth scrolling.

## Home

Home introduces MAVIS, the Multi-Analyte Voltammetric Intelligence System. It is a scroll
narrative: a tall scroll runway with one sticky, scaled stage, where a
single animation-frame loop eases the scroll position into one progress value and draws
every text beat and a Canvas2D particle field from it. No libraries and no build step.

It is the "lumen" scroll study (<https://github.com/batuaribakir/lumen-scroll-study>),
copied from its commit `237293c` with only the content replaced; the study rebuilds the
scroll behaviour of revertai.com.br from measurements (see its README).

- `assets/home/src/content.js` holds every word and the chart data. Copy changes go there,
  keeping each block's line count and the counts listed at the top of the file.
- Everything else under `assets/home/src/` and `styles.css` is the study's implementation,
  kept as it is: scroll, timeline, particle field and their timing are untouched. The
  departures are the paths of the modules and the music; the closing sheet, which lists
  the site's pages instead of a contact form; beat 10's flipping letter, which starts
  mirrored and flips into the normal letter (so the word ends as "Deconvolution"); the
  closing beat, which has no fine print under its button and whose strip names only MAVIS and
  the university (`dom.js` leaves out the parts left unset; the strip and Sources still fade in
  at the same point);
  beat 03's statement, widened so each of its two sentences keeps a line of its own; and the
  presentation assets below. They live in `dom.js`, `ui.js` and the `styles.css` blocks
  marked "Peak Deconvolution" and "MAVIS".
- `assets/home/media/` holds assets from the MAVIS presentation, each placed inside a slot
  the page already has, so no scene, timing or layer is added:
  - `signals/pvdf-singles.js`: the single-molecule curves of the presentation's
    "overlapping peaks" chart, drawn by `dom.js` as a component overlay inside the chart's
    label layer (it fades in and out with the chart labels) and named at each peak;
  - `branding/mavis-mark.svg`: the overlap mark (the site favicon), on the board's
    "Identify & quantify" step; `mark-curve.svg` + `mark-peaks.svg` split it into the
    two-tone brand mark before the name (curve in the text colour, peaks in teal);
  - `system/lab.svg`, `data.svg`, `model.svg`, `app.svg`: stage icons of the presentation's
    system diagram, extracted from its source, on the board's other steps;
  - `signals/electrode.svg`: the screen-printed electrode in plan view, generated from the
    geometry constants of the presentation's 3D electrode scene (fork scene, left);
  - `molecules/*.svg`: the four molecules of the chart, drawn as atom dots and bonds from
    PubChem 2D depictions (estradiol and melatonin are the presentation's molecules; ascorbic
    acid and serotonin come from the same database) (fork scene, right);
  - `system/network.svg`: a static network with the layer layout of the presentation's
    network animation, fed by the chart's mixture and ending in the four molecules (beat 09);
  - `vision/evidence.svg`: the presentation's "why" idea (the stretch of the curve behind
    an answer) drawn on the chart's mixture curve, under beat 13's "Explainable AI" line. It
    illustrates the idea; it is not an output of a model, and the page does not caption it.
  The small marks are drawn through CSS masks in the text colour of their slot; the figures
  are images placed inside an existing text block (absolutely positioned, so no text moves).
- Home loads neither `assets/css/site.css` nor `assets/js/site.js`. Their global rules
  clash with the stage (fonts, smooth scrolling, a `.tag` class, and an `overflow` that
  pushes the sticky stage off-screen while the closing sheet is open). Nothing may be added
  to the page outside `#root` either: progress is the scroll position over the whole
  document's height.
- The chart's curves are a representative example from an open dataset, not one of our
  measurements: a square-wave voltammogram of a four-molecule mixture, and the four single
  molecules, from Duesselberg et al., ACS Electrochem. 2026
  (doi:10.1021/acselectrochem.6c00079, MIT licence). The page itself names the source only
  in its Sources panel.
- The music (`assets/home/audio/lumen-ambient.mp3`) is the study's original loop,
  synthesised by its `tools/make-track.py`. Whether Home keeps it is not decided yet.

## Schedule values on the static pages

The dashboard builds everything it shows from `dashboard/data/project-data.js` in the
browser, so it is never out of date. **Project and Presentations do not.** They hold
a hand-written snapshot of the same values — package spans, subtask counts and names,
the week totals, the midterm and presentation weeks — and those pages say so in place.

When `dashboard/data/project-data.js` is regenerated:

```
python3 dashboard/tools/extract_project_data.py   # xlsx -> project-data.js (needs openpyxl)
python3 tools/check-schedule-snapshot.py          # then check the pages against it
```

The checker re-derives every copied value from `project-data.js`, compares it with what
the pages actually say, and prints each mismatch with both versions. It exits non-zero
when anything needs editing, so it can be wired into CI later. After fixing a page, update
the "checked on" date it carries.

## Status

The dashboard is complete and runs on data generated from the project workbook. The other
pages are a shell: their structure and the schedule facts are real, the prose around them
is marked **Provisional** and will be replaced. No results or metrics are published yet.
The repository is public, and the site is deployed to GitHub Pages at
<https://batuaribakir.github.io/peakdeconv-site/>.
