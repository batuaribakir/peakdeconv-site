#!/usr/bin/env python3
"""Copy the files GitHub Pages serves into a clean staging directory.

The repository holds more than the site needs: the workbook the schedule is
generated from, the Spline files the background scene was designed against,
the extraction and checking scripts, and the READMEs. None of that belongs in
a published artifact, so this script works from an allow-list rather than by
excluding things: only the paths named in MANIFEST are copied, and a path that
has gone missing is an error rather than a silently thinner site.

Every path keeps its place in the output, which is what makes the site's
relative links work unchanged -- index.html stays at the top level, the
dashboard stays in dashboard/.

project/ and resources/ are retired: they stay in the repository for reference
but are not listed here, so they are not published (validate-site.py refuses
them if they come back).

Usage, from the repository root:

    python3 tools/stage-site.py [output-directory]     # default: _site

Standard library only.
"""

import pathlib
import shutil
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

# Everything the four pages load at run time, and nothing else.
MANIFEST = [
    # Entry pages.
    "index.html",
    "presentations/index.html",
    "team/index.html",
    "dashboard/index.html",
    # Presentations: each one a self-contained HTML file, plus the cover its card shows.
    # A presentation that loads files of its own lists them here too.
    "presentations/technical-overview.html",
    "presentations/covers/technical-overview.webp",
    # Shared chrome: global panel, page bar, page shell.
    "assets/css/site.css",
    "assets/js/site.js",
    # Shared ambient scene: the background of the dashboard, Presentations and Team.
    "assets/css/ambient-scene.css",
    "assets/js/ambient-scene.js",
    "assets/icons/favicon.svg",
    # Home: the scroll narrative's styles, its ES modules (imported from main.js, so no
    # page names them) and its music (requested only when it starts playing).
    "assets/home/styles.css",
    "assets/home/src/main.js",
    "assets/home/src/config.js",
    "assets/home/src/content.js",
    "assets/home/src/dom.js",
    "assets/home/src/stage.js",
    "assets/home/src/timeline.js",
    "assets/home/src/ui.js",
    "assets/home/src/field/index.js",
    "assets/home/src/field/chart.js",
    "assets/home/src/field/circuit.js",
    "assets/home/src/field/math.js",
    "assets/home/src/field/particles.js",
    "assets/home/src/field/quality.js",
    "assets/home/src/field/sampler.js",
    "assets/home/src/field/schedule.js",
    "assets/home/src/field/travel.js",
    "assets/home/src/field/world.js",
    "assets/home/audio/lumen-ambient.mp3",
    # Home: its own copy of the global menu (it cannot load the shared chrome above).
    "assets/home/nav.css",
    "assets/home/nav.js",
    # Home: assets from the MAVIS presentation (the SVGs are CSS masks in styles.css; the
    # single-molecule curves are a module content.js imports).
    "assets/home/media/branding/mavis-mark.svg",
    "assets/home/media/system/lab.svg",
    "assets/home/media/system/data.svg",
    "assets/home/media/system/model.svg",
    "assets/home/media/system/app.svg",
    "assets/home/media/signals/pvdf-singles.js",
    "assets/home/media/branding/mark-curve.svg",
    "assets/home/media/branding/mark-peaks.svg",
    "assets/home/media/signals/electrode.svg",
    "assets/home/media/molecules/ascorbic-acid.svg",
    "assets/home/media/molecules/serotonin.svg",
    "assets/home/media/molecules/estradiol.svg",
    "assets/home/media/molecules/melatonin.svg",
    "assets/home/media/system/network.svg",
    "assets/home/media/vision/evidence.svg",
    # Dashboard styles, data and its own favicon.
    "dashboard/css/styles.css",
    "dashboard/css/depth.css",
    "dashboard/data/project-data.js",
    "dashboard/assets/icons/favicon.svg",
    # Dashboard scripts, in no particular order: index.html sets the load order.
    "dashboard/js/app.js",
    "dashboard/js/core/model.js",
    "dashboard/js/core/state.js",
    "dashboard/js/core/util.js",
    "dashboard/js/ui/drawer.js",
    "dashboard/js/ui/nav.js",
    "dashboard/js/ui/tooltip.js",
    "dashboard/js/views/charts.js",
    "dashboard/js/views/gantt.js",
    "dashboard/js/views/hero.js",
    "dashboard/js/views/kpis.js",
    "dashboard/js/views/milestones.js",
    "dashboard/js/views/packages.js",
    "dashboard/js/views/team.js",
    "dashboard/js/views/tracker.js",
    "dashboard/js/interactions/config.js",
    "dashboard/js/interactions/parallax.js",
]


def main():
    out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "_site")
    out = out.resolve()

    if out == ROOT:
        sys.exit("refusing to stage into the repository root: %s" % out)

    missing = [p for p in MANIFEST if not (ROOT / p).is_file()]
    if missing:
        for p in missing:
            print("missing from the repository: %s" % p, file=sys.stderr)
        sys.exit("%d file(s) in the manifest do not exist; nothing staged" % len(missing))

    if out.exists():
        shutil.rmtree(out)

    for rel in MANIFEST:
        dest = out / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / rel, dest)

    total = sum(f.stat().st_size for f in out.rglob("*") if f.is_file())
    print("Staged %d files (%.0f KB) into %s" % (len(MANIFEST), total / 1024, out))


if __name__ == "__main__":
    main()
