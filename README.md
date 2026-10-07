# MAVIS — website

Static multi-page site for MAVIS, the Multi-Analyte Voltammetric Intelligence System.
No build step, no package manager: plain HTML, CSS and JavaScript.

```
.
├── index.html            Home: a scroll narrative (see "Home" below)
├── dashboard/            development plan and progress tracker (see dashboard/README.md)
├── presentations/        the presentation library: index.html, one self-contained HTML
│                         file per presentation, covers/ (see "Presentations")
├── team/                 the people behind MAVIS
├── project/, resources/  retired pages, kept for reference and not published (see "Retired pages")
├── assets/
│   ├── home/             Home only: styles.css, nav.css + nav.js (its menu), src/ (ES modules), media/, audio/
│   ├── css/site.css      shared chrome (global panel, page bar), page shell and the type tokens
│   ├── js/site.js        global panel controller + section scroll-spy
│   ├── css/ambient-scene.css, js/ambient-scene.js
│   │                     the light 3D background of Dashboard, Presentations and Team
│   └── icons/favicon.svg the MAVIS mark (see "Brand and type")
├── tools/
│   ├── stage-site.py                builds the directory GitHub Pages serves
│   ├── validate-site.py             checks that directory before it is published
│   └── check-schedule-snapshot.py   checks the retired Project page against the workbook data
└── .github/workflows/pages.yml      the deployment
```

## Run it locally

Serve the **repository root**, not a subfolder, so that the directory URLs below resolve
to their `index.html`:

```
python3 -m http.server 8000
```

Then open <http://localhost:8000/>. Home is built from ES modules, so it has to come from
a server like this one: opened straight from the file system it stays blank.

| Page                         | URL                                        |
|------------------------------|--------------------------------------------|
| Home                         | `/`                                        |
| Dashboard                    | `/dashboard/`                              |
| Presentations                | `/presentations/`                          |
| MAVIS Technical Overview     | `/presentations/technical-overview.html`   |
| Team                         | `/team/`                                   |

In-page anchors work too, for example `/dashboard/#tasks` or `/dashboard/#team`.

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

1. `python3 tools/stage-site.py _site` — copies the files the four pages and the
   presentations load at run time into `_site/`, each keeping its path so `index.html`
   stays at the top level and every relative link still resolves.
2. `python3 tools/validate-site.py _site` — prints the staged tree, then fails on a
   missing entry page or asset, a link that resolves to nothing, anything that must stay
   out of the artifact (the retired `project/` and `resources/` pages included), or a site
   or footer menu that does not list exactly Home, Dashboard, Presentations and Team.
3. `actions/upload-pages-artifact` uploads `_site`, and a second job deploys it with
   `actions/deploy-pages` in the `github-pages` environment.

`tools/stage-site.py` works from an allow-list, not an exclude-list: only the paths in its
`MANIFEST` are copied, and a path that has gone missing fails the run rather than
producing a thinner site. So the published artifact contains no `.git/`, `.github/`,
`README.md`, `tools/`, `dashboard/tools/`, `dashboard/data/source/` or `.xlsx` — and none
of the ~5.5 MB of `dashboard/assets/spline/` design files, which the dashboard names in
source comments but never loads. `_site/` is 68 files, about 4.4 MB: 1.9 MB of that is the
technical overview presentation (fetched only when it is opened) and 2 MB is Home's music,
which a browser fetches only when the music starts.

Home's modules and music are reached from JavaScript, not from an `href` or `src`, so the
link check in `validate-site.py` cannot see them. They are listed in its `REQUIRED` paths
instead: a module added to `assets/home/src/`, or a file added to `assets/home/media/`,
must go into both lists.

### Inspecting a deployment

Run the same three commands locally to get exactly what CI uploads:

```
python3 tools/stage-site.py _site
python3 tools/validate-site.py _site
python3 -m http.server 8000 --directory _site
```

`validate-site.py` lists every staged file with its size; the server then lets you walk
`/`, `/dashboard/`, `/presentations/` and `/team/` against the real artifact rather than
the repository. To reproduce the published URL's
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

**Global — the four destinations of the site: Home, Dashboard, Presentations, Team.** It
lives in a panel that slides in from the left, and it is the same panel and the same state
on every page, dashboard included — except Home, which has its own copy of it (see "Home"
below).

Every list of destinations names those four pages, in that order: the panel on the
Dashboard, Presentations and Team pages, Home's copy of it, the footers of Presentations
and Team, and Home's no-JavaScript links. `tools/validate-site.py` fails the deployment if
a site or footer menu (`<nav aria-label="Site">`, `<nav aria-label="Footer">`) disagrees.
Home's closing sheet is built from `assets/home/src/content.js` (`LEAD`) and lists the same
pages; the validator cannot see it, so keep it in step by hand.

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
  into the panel**, onto its Close button; Tab from there reaches the four links in order.
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
untouched, and the new stacking lives in `site.css`, not in `dashboard/css/styles.css`.

**Sections — headings of the page you are on.** These live in the bar at the top of each
page and only ever link to ids that exist on that page. The dashboard keeps its own bar
(Overview · Schedule · Packages · Tasks · Analytics · Milestones · Team) with its progress
ring, driven by `dashboard/js/ui/nav.js`. The static pages use `.pagebar`, which shows the
brand and the page's name; a longer page can add section links to it
(`<nav class="pagesections" data-section-nav>`), driven by the scroll-spy in
`assets/js/site.js`. Presentations and Team are one section each, so they have none.
Neither script touches the other: the dashboard's bar carries no `data-section-nav`.

**Without JavaScript** the panel is not a control at all, so the whole chrome drops out of
fixed positioning and into normal flow: the four global links render as a plain wrapped
list at the top of the page and the page bar follows underneath. All four stay visible and
clickable down to 390 px. Home shows a plain list of the other pages instead.

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
  the site's pages (Dashboard, Presentations, Team) instead of a contact form and opens the
  MAVIS Technical Overview from its primary button; beat 10's flipping letter, which starts
  mirrored and flips into the normal letter (so the word ends as "Deconvolution"); the
  closing beat, which has no fine print under its button and whose strip names only MAVIS
  (`dom.js` leaves out the parts left unset; the strip and Sources still fade in at the same
  point);
  beat 03's statement, widened so each of its two sentences keeps a line of its own; and the
  presentation assets below. They live in `dom.js`, `ui.js` and the `styles.css` blocks
  marked "MAVIS".
- `assets/home/media/` holds assets from the MAVIS presentation, each placed inside a slot
  the page already has, so no scene, timing or layer is added:
  - `signals/pvdf-singles.js`: the single-molecule curves of the presentation's
    "overlapping peaks" chart, drawn by `dom.js` as a component overlay inside the chart's
    label layer (it fades in and out with the chart labels) and named at each peak;
  - `branding/mavis-mark.svg`: the MAVIS mark (see "Brand and type"), on the board's
    "Identify & quantify" step; `mark-curve.svg` + `mark-peaks.svg` split it into the
    two-tone brand mark before the name (first peak in the text colour, second in teal);
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
- Its global menu is therefore a separate copy, `assets/home/nav.css` and `nav.js`, with
  every class prefixed `home-nav-`: one `position: fixed` layer inside `#root`, just before
  `#runway`, so it adds nothing to the document's height. It works as on the other pages
  (hover, click to pin, focus, Escape, click outside), except that its slim handle stays on
  the left edge at every width (the brand and the music button hold the top corners, so
  there is no Menu button), and that while the closing sheet is open the menu is closed,
  hidden and inert.
- The chart's curves are a representative example from an open dataset, not one of our
  measurements: a square-wave voltammogram of a four-molecule mixture, and the four single
  molecules, from Duesselberg et al., ACS Electrochem. 2026
  (doi:10.1021/acselectrochem.6c00079, MIT licence). The page itself names the source only
  in its Sources panel.
- The music (`assets/home/audio/lumen-ambient.mp3`) is the study's original loop,
  synthesised by its `tools/make-track.py`. Whether Home keeps it is not decided yet.

## Presentations

`presentations/index.html` is the library: one card per presentation, newest first. A
card's title is its only link (it stretches over the whole card), so a click anywhere on
the card, or Enter on the focused title, opens the presentation in the same tab.

Each presentation is a self-contained HTML file next to the library, so the same file
works from the file system and from Pages.

| Card                     | File                                     | Source                                      |
|--------------------------|------------------------------------------|---------------------------------------------|
| MAVIS Technical Overview | `presentations/technical-overview.html`  | `sunumlar/hafta02_mavis_sunum.html`, delivered 1 October 2026 |

The web copy of the technical overview differs from the delivered file only in its
branding layer; its slides, figures, data and results are unchanged:

- the page title is "MAVIS Technical Overview", and it links the site favicon
  (`../assets/icons/favicon.svg`, so no `/favicon.ico` request);
- the speaker notes (`<aside class="notes">`) and the reveal.js notes plugin are removed,
  and Reveal starts with no plugins;
- the course framing is gone: the university line on the title slide (the date stays),
  "Team 1 · Deep Learning" on the closing slide, and "Project Dashboard" on the
  "Where We Are" slide, which now says "Development Dashboard";
- the generated copy of the old dashboard that the deck carried (`window.MAVIS_DASH_DOC`)
  is removed, and its fallback image is a new shot of the current dashboard.

It inlines everything it needs (fonts, reveal.js, three.js, images). Its "Where We Are"
slide first looks for a live dashboard at `../dashboard/` and `../../dashboard/`; at
`presentations/` the first of those is the site's own dashboard, so the slide shows it live,
with no failed request on the way. Without a dashboard beside it (one folder deeper, or the
file opened on its own) the slide shows the fallback image instead.

To add a presentation:

1. Copy its HTML file (and any files it loads) into `presentations/`.
2. Make a cover: a 1280×720 WebP of its title slide in `presentations/covers/`. The cover
   is optional; a card without its `.deck-cover` block starts at its text.
3. Copy the `<li class="deck">` block in `presentations/index.html` to the top of the
   list and change its link, cover, date, slide count, title, description and topics.
4. Add the files to `MANIFEST` in `tools/stage-site.py` and to `REQUIRED` in
   `tools/validate-site.py`.
5. If it should become Home's closing button, change `LEAD.primary` in
   `assets/home/src/content.js`.

## Ambient scene

Dashboard, Presentations and Team share one background: the dashboard's light 3D scene
(three slowly undulating ribbons and drifting particles, Three.js r134 from cdnjs) seen
through a camera that sways toward the pointer and rises with page scroll. It is one
implementation, used as is by all three pages:

- `assets/css/ambient-scene.css`: `#scene-layer`, a fixed layer at z-index 0 with
  `pointer-events: none`, holding the ground gradients, the canvas and a film grain.
  Content sits above it (`.site-main` at 1, the dashboard's `.app` at 3).
- `assets/js/ambient-scene.js`: the scene, its settings (`MavisAmbient.config`) and the
  page's only pointer listener and `requestAnimationFrame` loop. The loop sleeps when
  nothing moves and while the tab is hidden; subscribers get the damped pointer state
  (`MavisAmbient.onFrame`).
- each page carries the `#scene-layer` markup, links the CSS, and loads Three.js and the
  script. On the dashboard, `dashboard/js/interactions/parallax.js` subscribes to the same
  loop to move its own panels; the static pages' content does not move.

The camera follows mouse and pen only. On touch screens it stays at rest while the ribbons
keep drifting; under `prefers-reduced-motion: reduce` the scene is drawn once and left
still. Without JavaScript, WebGL or the CDN the canvas stays transparent and the ground
gradients remain. Home has its own scroll scene and loads none of this.

The code moved here unchanged from the dashboard (`config.js`, `pointer-controller.js`,
`background-scene.js`, the scene rules of `depth.css`); with a seeded `Math.random` and a
paused clock the dashboard renders pixel-identically before and after the move, at rest
and after pointer movement.

## Brand and type

**The mark** is one stroke: two overlapping peaks that read as an M, the first in the text
colour and the second in teal (`#009289` on light grounds, `#22bec6` on Home and in the
favicon). It is inlined as SVG wherever the brand appears outside Home, in a 32-unit
viewBox:

```
M4 24.5C7.6 24.5 8.4 7.5 11.4 7.5C14 7.5 14.3 17 16.2 17          (first peak)
M16.2 17C18.1 17 18.6 9.5 21 9.5C23.8 9.5 24.6 24.5 28 24.5        (second peak)
```

`assets/icons/favicon.svg` and its copy `dashboard/assets/icons/favicon.svg` draw it on a
dark tile. Home draws it through CSS masks (`assets/home/media/branding/`), where the same
path is scaled into the 26-unit box of the mark it replaced: drawn in a 32-unit box, the
mask changed how Chrome rasterises Home's stage text (antialiasing on glyph edges, visible
only in a pixel diff), and in the 26-unit box it does not.

**Type.** Every page except Home uses the dashboard's two families: Instrument Sans for all
text and IBM Plex Mono for codes, dates and counts. The stacks are defined once, as
`--s-f-ui` and `--s-f-mono` in `assets/css/site.css`; the dashboard's `--f-display`,
`--f-ui` and `--f-mono` point at them. Each page requests the two families from Google
Fonts in its `<head>` with the same weights (400, 500, 600). Home keeps its own Jost.

## Retired pages

`project/` and `resources/` were part of the earlier course-project site. They are kept in
the repository for reference but are no longer linked or published: `tools/stage-site.py`
leaves them out and `tools/validate-site.py` refuses them. They still carry the old menu
and copy, and they are not maintained against the current `site.css`.

The Project page quotes the schedule from `dashboard/data/project-data.js` by hand.
`tools/check-schedule-snapshot.py` re-derives those values and prints every mismatch; no
published page quotes the schedule any more, so the deployment no longer runs it. Run it
before publishing the Project page again:

```
python3 dashboard/tools/extract_project_data.py   # xlsx -> project-data.js (needs openpyxl)
python3 tools/check-schedule-snapshot.py          # then check project/index.html against it
```

## Status

The dashboard is complete and runs on data generated from the project workbook.
Presentations holds one presentation, and Team lists the two developers. Outside that
presentation, the site publishes no results or metrics. The repository is public, and the site is
deployed to GitHub Pages at <https://batuaribakir.github.io/peakdeconv-site/>.
