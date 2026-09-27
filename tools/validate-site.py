#!/usr/bin/env python3
"""Check a staged site directory before it is published.

Three questions, in order:

1. Is everything there? The six entry pages and the CSS, JS, data and icon
   files they need.
2. Does anything resolve to nothing? Every local href and src in every staged
   page is followed to the file it names, so a page that survived staging
   while one of its assets did not is caught here rather than in the browser.
3. Is anything there that should not be? The workbook, the extracted source
   folder, the tooling, the READMEs and the repository's own metadata are all
   refused, as are the Spline design files, loose Python and Markdown, and
   editor or OS droppings.

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
    "project/index.html",
    "team/index.html",
    "resources/index.html",
    "dashboard/index.html",
    "assets/css/site.css",
    "assets/js/site.js",
    "assets/icons/favicon.svg",
    "dashboard/css/styles.css",
    "dashboard/css/depth.css",
    "dashboard/data/project-data.js",
    "dashboard/assets/icons/favicon.svg",
    "dashboard/js/app.js",
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
]

LINK_RE = re.compile(r'(?:href|src)\s*=\s*"([^"]*)"', re.I)
ID_RE = re.compile(r'\bid\s*=\s*"([^"]*)"', re.I)


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

    for w in warnings:
        print("warning: %s" % w)
    if warnings:
        print()

    if problems:
        for p in problems:
            print("FAIL: %s" % p, file=sys.stderr)
        sys.exit("\n%d problem(s); the artifact is not publishable." % len(problems))

    print("Checked %d required paths, %d local links and %d exclusion rules."
          % (len(REQUIRED), followed, len(FORBIDDEN)))
    print("The staged directory is publishable.")


if __name__ == "__main__":
    main()
