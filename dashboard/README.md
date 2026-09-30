# Peak Deconvolution: Team 1 (DL) project dashboard

This is an interactive, static dashboard for the Team 1 deep-learning track. It covers:

- the 15-week Gantt
- work packages
- a task tracker with saved statuses
- analytics, milestones and the team

The cards sit on a light 3D background scene of our own, which sways with the pointer.

## Run it

Open `index.html` in any modern browser. There is no build step, no server and nothing to install.

Every path is relative, so you can copy the whole folder to another Windows, macOS or Linux machine and it keeps working.

It loads two things from the internet:

- Three.js r134 (cdnjs)
- Google Fonts

Offline, the dashboard still works on the plain light ground, without the 3D scene.

## File structure

```
dashboard/
├── index.html                       page structure + script order
├── css/
│   ├── styles.css                   dashboard design system (tokens, components)
│   └── depth.css                    spatial layer: scene ground + grain (isolated)
├── js/
│   ├── core/                        model.js · state.js · util.js
│   ├── ui/                          tooltip.js · drawer.js · nav.js
│   ├── views/                       hero · kpis · gantt · packages · tracker · charts · milestones · team
│   ├── app.js                       boot: render views, wire them to state
│   └── interactions/                spatial layer — no dashboard logic
│       ├── config.js                scene, camera sway and depth settings
│       ├── pointer-controller.js    one pointer listener + one rAF loop
│       ├── background-scene.js      light Three.js scene (ribbons, particles, camera sway)
│       └── parallax.js              moves [data-depth] dashboard layers
├── data/
│   ├── project-data.js              GENERATED (window.PD_DATA) — do not edit
│   └── source/PeakDeconv_Gantt_Chart.xlsx   source of truth
├── assets/
│   ├── spline/                      Spline reference scenes (interaction reference only, not loaded)
│   │   ├── interactive_3_d_parallax_scene.spline
│   │   └── telecom_dashboard.spline
│   └── icons/favicon.svg
├── tools/extract_project_data.py    xlsx → data/project-data.js
└── backups/phase-1-dashboard/       the untouched, still-working Phase 1 version
```

The scripts are classic `<script>` files that share one namespace, `window.PD`. They are deliberately not ES modules, because modules loaded from `file://` are blocked by browsers. That is what lets the folder run with a double-click.

## Project data

`data/project-data.js` is generated from the workbook. When the xlsx changes, regenerate it:

```
python tools/extract_project_data.py      # needs openpyxl
```

The extractor reads only the **Task overview** and **Team 1 · DL** sheets. It cross-checks them (weeks, durations, owners, fixed-delivery cells, ◆ final weeks) and asserts that no other-team or ML content is emitted. `Team 1 · DL` helper rows become `dl: true` on their modelling task; they are not treated as tasks.

> **Workbook note:** the WP4 heading bar starts at week 5, but WP4's earliest subtask (WP4.1) starts at week 6. Both are kept: `headingBar` is the bar as drawn, `taskWeeks` is the union of the subtasks. The script prints a warning on every run.

## Progress state

Statuses are dashboard state and were **not** read from the workbook. Every task starts as *Not started*.

| Status      | Weight |
|-------------|--------|
| Not started | 0      |
| In progress | 0.5    |
| Completed   | 1      |

Two metrics are shown, each with its own label:

- **Task completion** = completed ÷ 23
- **Weighted progress** = Σ(duration × weight) ÷ 70 task-weeks

Both come from `derive()` in `js/core/state.js`, and every view subscribes to its change event.

Statuses and filters are saved in `localStorage` under `pd-dashboard.team1.v1`. That storage belongs to this browser only.

**Reset progress:** go to **Tasks → Reset** and confirm. Alternatively, run `PD.reset()` in the console.

**Delivery lock:** every task's delivery week starts locked, as in the workbook. Click the lock on the task's last Gantt cell, in the Tasks table, or in the task drawer to unlock it, and click again to lock it. The choice is saved with the statuses (`unlocked` in the same `localStorage` entry). The Milestones lane and the "next" card count only locked deliveries. Reset progress does not change locks.

## Spatial layer

### Background scene

`js/interactions/background-scene.js` is our own light 3D scene, built with Three.js r134. It uses the global `THREE` from a script tag, with no modules and no build step.

It follows the interaction language of the reference scene `assets/spline/interactive_3_d_parallax_scene.spline`, but on a light ground and without its content, badge or cursor dot.

- **Ribbons:** three twisted ribbons at different depths. They use a soft iridescent shader (pastel teal, violet, rose and gold) that changes with the viewing angle, and they undulate slowly.
- **Particles:** fine particles drift through the volume.
- **Camera:** a perspective camera sways toward the pointer by ±7° horizontally and ±2.2° vertically, with an extra sideways pan. It uses the reference scene's damping of 0.125 per frame, returns to rest when the pointer leaves, and rises slightly as the page scrolls.
- **Softness and cost:** the scene is rendered at 0.6× resolution (`scene.renderScale`), which keeps it soft and light on the GPU. Film grain is a CSS layer (`.scene-grain`).

Everything is tunable in `js/interactions/config.js`: `camera`, and `scene` (ribbon control points, width, twist, opacity, hue, particle count).

### Dashboard depth

The dashboard's own layers move with the same damping as the scene camera (0.125 per 60 fps frame, converted so it behaves the same at any frame rate). The movement is mostly sideways, since `verticalRatio` is 0.4:

| Level (`data-depth`) | Element | Travel at full deflection |
|---|---|---|
| `section` | each section's `.wrap` | 10 px |
| `panel` | glass panels, on top of their section | 4.5 px |
| — | nav, drawer, tooltip | 0 (foreground) |

The movement uses the individual CSS `translate` property, so it composes with reveal and hover transforms. Hit-testing follows what you see.

### Performance

- The page uses one pointer listener, one scroll listener and one rAF loop. Per-frame writes go only to a few layer elements, so there are no layout passes.
- Measured in headless Chrome with the live 3D scene and continuous pointer motion: 61 fps, 0 layout passes, and about 19 ms of script time per second.
- Under `prefers-reduced-motion` the scene is rendered once and stays still.
- Touch devices get no parallax.

The Phase 1 version is preserved in `backups/phase-1-dashboard/`.
