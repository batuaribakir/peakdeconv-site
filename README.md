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
│   ├── js/site.js        global panel controller + section scroll-spy
│   └── icons/favicon.svg
├── tools/
│   └── check-schedule-snapshot.py    verifies the values copied into the pages
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
rewrite is needed.

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
- **Tabbing** to the handle opens the panel, so the links are reachable by keyboard.
  **Escape** closes it and returns focus to the handle; focus then has to leave and come
  back before it opens again, so Escape is never undone by the focus it restores. Focus
  leaving the panel closes it too, unless a click pinned it open.
- Below 1024 px the handle gives way to a **Menu button in the bar at the top**, which
  opens the same panel with a dimming scrim behind it. The swap happens there, not at a
  phone width, because the left margin only clears a 34 px handle once the page gutter has
  grown past about 40 px. Exactly one of the two controls is on screen at any width.
- `aria-expanded` is mirrored on both controls, `aria-controls` points at the panel, and
  the closed panel is `visibility: hidden`, so its links are out of the tab order and out
  of the accessibility tree rather than merely off-screen.

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
The repository is private while the project is in progress, so the link on the Resources
page is marked team-only.
