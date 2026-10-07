#!/usr/bin/env python3
"""Check a staged site directory before it is published.

Four questions, in order:

1. Is everything there? The four entry pages, the presentations and the CSS,
   JS, data, icon and audio files they need -- including Home's ES modules,
   music and media, which are reached from JavaScript or CSS rather than from
   an href or src, so the link check below cannot see them.
2. Does anything resolve to nothing? Every local href and src in every staged
   page is followed to the file it names, so a page that survived staging
   while one of its assets did not is caught here rather than in the browser.
3. Is anything there that should not be? The workbook, the extracted source
   folder, the tooling, the READMEs and the repository's own metadata are all
   refused, as are the Spline design files, loose Python and Markdown, editor
   or OS droppings, and the retired project/ and resources/ pages.
4. Do the navigations agree? Every site menu (<nav aria-label="Site">) and
   footer menu (<nav aria-label="Footer">) must link to exactly the four
   destinations in SITE_NAV, in that order. Home's closing sheet is built by
   assets/home/src/content.js, so it is not covered here.

Usage:

    python3 tools/validate-site.py [staged-directory]     # default: _site

Exit status is 0 when the directory is publishable and 1 when it is not.
Standard library only.
"""

import pathlib
import posixpath
import re
import sys
from urllib.parse import unquote, urlsplit

ROOT = pathlib.Path(__file__).resolve().parent.parent

# Must be present, or the site is incomplete.
REQUIRED = [
    "index.html",
    "presentations/index.html",
    "team/index.html",
    "dashboard/index.html",
    "presentations/technical-overview.html",
    "presentations/covers/technical-overview.webp",
    "assets/css/site.css",
    "assets/js/site.js",
    "assets/css/ambient-scene.css",
    "assets/js/ambient-scene.js",
    "assets/icons/favicon.svg",
    "dashboard/css/styles.css",
    "dashboard/css/depth.css",
    "dashboard/data/project-data.js",
    "dashboard/assets/icons/favicon.svg",
    "dashboard/js/app.js",
    # Home: every module main.js imports (directly or through field/index.js) and the music
    # ui.js points at. None of them appears in an href or src.
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
    # Home: its own copy of the global menu (index.html also links both).
    "assets/home/nav.css",
    "assets/home/nav.js",
    # Home: presentation assets, reached from CSS url() and a module import.
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
]

# Must be absent. Each entry is (description, predicate over the staged path).
FORBIDDEN = [
    ("Excel workbook", lambda p: p.lower().endswith((".xlsx", ".xlsm", ".xls"))),
    ("extracted workbook source", lambda p: p == "dashboard/data/source" or p.startswith("dashboard/data/source/")),
    ("repository metadata", lambda p: p == ".git" or p.startswith(".git/")),
    ("workflow definitions", lambda p: p == ".github" or p.startswith(".github/")),
    ("tooling", lambda p: p == "tools" or p.startswith("tools/") or p.startswith("dashboard/tools/")),
    ("Markdown document", lambda p: p.lower().endswith(".md")),
    ("Python script", lambda p: p.lower().endswith(".py")),
    ("Spline design file", lambda p: p.lower().endswith(".spline")),
    ("tabular data export", lambda p: p.lower().endswith((".csv", ".tsv"))),
    ("archive", lambda p: p.lower().endswith((".zip", ".tar", ".gz", ".7z"))),
    ("dependency directory", lambda p: "node_modules" in p.split("/")),
    ("environment or secret file", lambda p: pathlib.PurePosixPath(p).name in (".env", ".env.local", ".npmrc", ".netrc")),
    ("editor or OS artefact", lambda p: pathlib.PurePosixPath(p).name in (".DS_Store", "Thumbs.db", ".gitignore", ".gitattributes")
        or pathlib.PurePosixPath(p).name.endswith(("~", ".swp", ".bak", ".orig", ".rej"))),
    ("retired page (kept in the repository, not published)",
        lambda p: p.split("/")[0] in ("project", "resources")),
]

# The site's destinations, in menu order, as staged files. Every site and footer
# menu links to exactly these.
SITE_NAV = ["index.html", "dashboard/index.html", "presentations/index.html", "team/index.html"]

LINK_RE = re.compile(r'(?:href|src)\s*=\s*"([^"]*)"', re.I)
ID_RE = re.compile(r'\bid\s*=\s*"([^"]*)"', re.I)
NAV_RE = re.compile(r'<nav\b[^>]*\baria-label\s*=\s*"(Site|Footer)"[^>]*>(.*?)</nav>', re.I | re.S)


def listing(site):
    """Every staged path, relative and posix-style, files and directories."""
    return sorted(p.relative_to(site).as_posix() for p in site.rglob("*"))


def check_links(site, files, problems):
    """Follow every local href/src in every staged page to the file it names."""
    pages = [f for f in files if f.endswith(".html")]
    ids = {}
    for page in pages:
        ids[page] = set(ID_RE.findall((site / page).read_text(encoding="utf-8")))

    followed = 0
    warnings = []
    for page in pages:
        base = posixpath.dirname(page)
        for raw in LINK_RE.findall((site / page).read_text(encoding="utf-8")):
            if "${" in raw or "'+" in raw or '"+' in raw:
                continue  # markup inside a script, with the URL filled in at run time
            url = urlsplit(raw.strip())
            if url.scheme or url.netloc or raw.startswith("//") or raw.startswith("data:"):
                continue  # external, or an inline data URI
            target, frag = unquote(url.path), unquote(url.fragment)

            if not target:
                dest = page  # bare "#id": the page itself
            else:
                if target.startswith("/"):
                    problems.append(
                        "%s: root-relative link %r breaks under the /peakdeconv-site/ prefix" % (page, raw))
                    continue
                dest = posixpath.normpath(posixpath.join(base, target))
                if dest.startswith(".."):
                    problems.append("%s: link %r escapes the site root" % (page, raw))
                    continue
                if target.endswith("/") or dest not in files:
                    dest = posixpath.join(dest, "index.html") if dest != "." else "index.html"
                if dest not in files:
                    problems.append("%s: link %r resolves to %s, which is not staged" % (page, raw, dest))
                    continue
            followed += 1

            if frag and dest in ids and frag not in ids[dest]:
                warnings.append("%s: %r points at #%s, which no static id in %s matches" % (page, raw, frag, dest))

    return followed, warnings


def check_navs(site, files, problems):
    """Every site and footer menu links to SITE_NAV, in order, and nothing else."""
    menus = 0
    for page in (f for f in files if f.endswith(".html")):
        base = posixpath.dirname(page)
        for label, body in NAV_RE.findall((site / page).read_text(encoding="utf-8")):
            menus += 1
            dests = []
            for raw in re.findall(r'href\s*=\s*"([^"]*)"', body, re.I):
                dest = posixpath.normpath(posixpath.join(base, urlsplit(raw).path))
                dests.append("index.html" if dest == "." else
                             dest if dest in files else posixpath.join(dest, "index.html"))
            if dests != SITE_NAV:
                problems.append("%s: the %s menu links to %s, not to %s" % (page, label, dests, SITE_NAV))
    return menus


def main():
    site = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "_site").resolve()
    if not site.is_dir():
        sys.exit("no staged directory at %s -- run tools/stage-site.py first" % site)

    everything = listing(site)
    files = [p for p in everything if (site / p).is_file()]

    print("Staged tree (%s)" % site)
    for p in everything:
        marker = "    " if (site / p).is_file() else "  / "
        size = "%7d B" % (site / p).stat().st_size if (site / p).is_file() else "        "
        print("  %s %s %s" % (size, marker, p))
    print("  %d files, %d bytes total" % (len(files), sum((site / f).stat().st_size for f in files)))
    print()

    problems = []

    for rel in REQUIRED:
        if rel not in files:
            problems.append("required file is missing: %s" % rel)

    if "index.html" not in files:
        problems.append("index.html is not at the top level of the artifact")

    for path in everything:
        for label, matches in FORBIDDEN:
            if matches(path):
                problems.append("%s must not be published: %s" % (label, path))

    followed, warnings = check_links(site, files, problems)
    menus = check_navs(site, files, problems)
    for page in SITE_NAV:
        if page in files and not NAV_RE.search((site / page).read_text(encoding="utf-8")):
            problems.append("%s has no site menu (<nav aria-label=\"Site\">)" % page)

    for w in warnings:
        print("warning: %s" % w)
    if warnings:
        print()

    if problems:
        for p in problems:
            print("FAIL: %s" % p, file=sys.stderr)
        sys.exit("\n%d problem(s); the artifact is not publishable." % len(problems))

    print("Checked %d required paths, %d local links, %d exclusion rules and %d menus."
          % (len(REQUIRED), followed, len(FORBIDDEN), menus))
    print("The staged directory is publishable.")


if __name__ == "__main__":
    main()
