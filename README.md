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
│   ├── css/site.css      shared chrome (global bar, section bar) + page shell
│   ├── js/site.js        menu disclosure + section scroll-spy
│   └── icons/favicon.svg
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

Every link on the site is relative, so the same files also work when the site is
served from a sub-path such as `https://<user>.github.io/peakdeconv-site/` — no
base URL or rewrite is needed.

## Navigation

- **Global bar** — Home, Dashboard, Presentations, Project, Team, Resources. Present on
  every page, including the dashboard. Below 880 px it collapses behind a **Menu** button
  (`aria-expanded`, closes on Escape with focus returned to the button, and on an outside
  tap). Without JavaScript the links simply stay in the bar.
- **Section bar** — one per page, linking only to headings that exist on that page. The
  dashboard keeps its own (Overview · Schedule · Packages · Tasks · Analytics · Milestones ·
  Team), driven by `dashboard/js/ui/nav.js`.
- Both bars sit in one fixed stack; `assets/css/site.css` publishes its height as
  `--site-h`, which `dashboard/css/styles.css` uses to offset the dashboard's floating
  section pill, its sticky table heads and its hero.

## Status

The dashboard is complete and runs on data generated from the project workbook. The other
pages are a shell: their structure and the schedule facts are real, the prose around them
is marked **Provisional** and will be replaced. No results or metrics are published yet.
