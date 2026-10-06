#!/usr/bin/env python3
"""Compare the schedule values copied into the static pages with the workbook.

The dashboard builds everything it shows from dashboard/data/project-data.js at
load time, so it is never stale. Project and Presentations quote the same values
in plain HTML, which means they can fall behind once the workbook is
re-extracted. (Home quotes no schedule values, so it is not checked.) This script reads project-data.js, re-derives every quoted value
and reports the ones that no longer match.

Usage, from the repository root:

    python3 tools/check-schedule-snapshot.py

Exit status is 0 when every page matches and 1 when something needs editing.
Standard library only; it does not need openpyxl or the workbook itself.
"""

import html
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "dashboard" / "data" / "project-data.js"

problems = []
checks = 0


def load_data():
    src = DATA.read_text(encoding="utf-8")
    start = src.index("{")
    end = src.rindex("};") + 1
    return json.loads(src[start:end])


def text(fragment):
    """HTML fragment -> plain text, so &ndash; and &nbsp; compare as themselves."""
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", fragment))).strip()


def compare(page, label, found, expected):
    global checks
    checks += 1
    if found != expected:
        problems.append((page, label, found, expected))


def contains(page, source, label, expected):
    """expected is plain text; the page holds it with entities and markup."""
    global checks
    checks += 1
    if expected not in text(source):
        problems.append((page, label, "not found on the page", expected))


def span(weeks):
    lo, hi = min(weeks), max(weeks)
    return "Weeks %d–%d" % (lo, hi) if lo != hi else "Week %d" % lo


def main():
    data = load_data()
    packages = data["packages"]
    tasks = data["tasks"]
    weeks = data["weeks"]

    n_weeks = len(weeks)
    n_tasks = len(tasks)
    pres = [w["week"] for w in weeks if w["kind"] == "presentation"]
    midterm = [w["week"] for w in weeks if w["kind"] == "midterm"]

    # ---- Project ----------------------------------------------------------
    proj = (ROOT / "project" / "index.html").read_text(encoding="utf-8")
    for wp in packages:
        subs = [t for t in tasks if t["wp"] == wp["id"]]
        card = re.search(
            r'<div class="card" data-wp="%s">(.*?)</ul>' % wp["id"], proj, re.S)
        if not card:
            problems.append(("project/index.html", wp["id"], "card missing", wp["title"]))
            continue
        head = re.search(r"<h3>(.*?)</h3>", card.group(1), re.S)
        meta = re.search(r'<p class="wp-span">(.*?)</p>', card.group(1), re.S)
        items = [text(li) for li in re.findall(r"<li>(.*?)</li>", card.group(1), re.S)]
        compare("project/index.html", wp["id"] + " title",
                text(head.group(1)), "%s %s" % (wp["id"], wp["title"]))
        compare("project/index.html", wp["id"] + " meta", text(meta.group(1)),
                "%s · planned final week %d · %d subtasks"
                % (span(wp["taskWeeks"]), wp["finalWeek"], len(subs)))
        compare("project/index.html", wp["id"] + " subtasks",
                items, [t["name"] for t in subs])

    contains("project/index.html", proj, "duration", "%d project weeks." % n_weeks)
    contains("project/index.html", proj, "midterm", "Week %d." % midterm[0])
    contains("project/index.html", proj, "presentations",
             "Weeks " + ", ".join(str(w) for w in pres[:-1]) + " and %d" % pres[-1])
    contains("project/index.html", proj, "subtask total",
             "%d across the six packages." % n_tasks)

    # ---- Presentations ----------------------------------------------------
    pres_page = (ROOT / "presentations" / "index.html").read_text(encoding="utf-8")
    found = re.findall(r'<div class="week is-(pres|mid)">\s*<div class="wk">Week (\d+)</div>', pres_page)
    compare("presentations/index.html", "presentation weeks",
            [int(w) for kind, w in found if kind == "pres"], pres)
    compare("presentations/index.html", "midterm week",
            [int(w) for kind, w in found if kind == "mid"], midterm)

    # ---- report -----------------------------------------------------------
    print("Checked %d values against %s" % (checks, DATA.relative_to(ROOT)))
    if not problems:
        print("All pages match the current workbook data.")
        return 0
    print("\n%d value(s) need updating:\n" % len(problems))
    for page, label, found_v, expected_v in problems:
        print("  %s  %s" % (page, label))
        print("    page says : %s" % (found_v,))
        print("    data says : %s" % (expected_v,))
    print("\nEdit the pages above, then update the “checked on” dates in them.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
