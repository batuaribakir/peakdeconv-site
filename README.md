# Peak Deconvolution — project site

Static multi-page site for the Peak Deconvolution project, Team 1 (Deep Learning track).
No build step, no package manager: plain HTML, CSS and JavaScript.

```
.
├── index.html            Home
├── presentations/        presentation weeks, format, materials
├── project/              problem, work packages, schedule, scope
├── team/                 members, roles, ways of working
├── resources/            repository, data sources, stack, reading
├── assets/
│   ├── css/site.css      shared chrome (global panel, page bar) + page shell
│   ├── css/home.css      Home illustration and responsive layout
│   ├── js/site.js        global panel controller + section scroll-spy
│   ├── js/home-parallax.js  scroll animation for Home only
│   ├── vendor/gsap/      pinned GSAP 3.15.0 and ScrollTrigger browser files
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

Then open <http://localhost:8000/>.

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

1. `python3 tools/check-schedule-snapshot.py` — the run fails if Home, Project or
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
source comments but never loads. Home adds a self-hosted animation library and an SVG
drawn directly in `index.html`; use `validate-site.py` for the current file count and size.

## Home parallax prototype

Home's hero contains an SVG illustration of four Gaussian component peaks and their sum.
The curves are synthetic and labelled as such; they do not represent an experiment or a
model result. ScrollTrigger moves the decorative ambient glow, grid and entire graph at
different speeds on wide screens, then reveals the component strokes. The navigation,
copy and axis geometry remain readable in the normal page flow. There is no scroll pin,
video, Spline or extra scrolling container in this first prototype.

The browser-ready GSAP 3.15.0 core and ScrollTrigger distribution files are copied from
the published `gsap@3.15.0` npm package into `assets/vendor/gsap/`. Their included license
headers and the [standard license](https://gsap.com/standard-license) apply. If scripts
fail to load, the illustration remains complete and static; narrow viewports and users
who request reduced motion receive the static illustration by design. The Home-specific
CSS and JS do not load on Dashboard. To inspect the effect, scroll Home slowly from the
top on a desktop viewport, then compare it with a phone width and reduced motion.

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
the left, and it is the same panel and the same state on every page, dashboard included.

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
clickable down to 390 px. Verified with JavaScript disabled at 390 px on every page.

`prefers-reduced-motion: reduce` removes the panel's slide, its open/close delays and the
smooth scrolling.

## Schedule values on the static pages

The dashboard builds everything it shows from `dashboard/data/project-data.js` in the
browser, so it is never out of date. **Home, Project and Presentations do not.** They hold
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
