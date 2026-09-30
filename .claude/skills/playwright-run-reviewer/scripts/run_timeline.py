#!/usr/bin/env python3
"""Lay a Playwright run out on one clock, from its HTML report.

parse_report.py says what failed; this says how the run *paced*: how many
workers the runner actually used and how busy each one was, what was still
running when the run ended, where the long host-bound tests sat, and how much
time went into failed attempts. Read it when a run's duration moved, when the
worker count changed, or when a red run ended with tests marked "did not run".

Every result in the report carries its startTime, duration and workerIndex, so
the whole run can be reconstructed without the terminal log. A merged report
(the main project and the exclusive specs as two invocations) reads the same
way: each invocation's login and teardown steps appear once, with their own
worker indices.

Usage:
    run_timeline.py <report-dir-or-index.html> [--tail 10] [--long 120] [--platforms]

  --tail N       every result still running in the last N minutes (default 10)
  --long S       every result longer than S seconds, in start order (default 120)
  --platforms    minutes per real-VM platform: from macOS / Windows / Linux
                 keywords in the test title, else from the platform the spec's
                 source resolves its host for (`findOnlineHost(…, 'linux', …)`,
                 `liveMacosHost`). "mixed" is a spec that names several and a
                 title that settles nothing; "?" is one that names none.
  --specs DIR    the playwright/ dir holding those sources (default: this repo's)
"""
import argparse
import base64
import io
import json
import os
import re
import sys
import zipfile
from collections import defaultdict
from datetime import datetime

B64 = set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=")
SETUP_PROJECTS = re.compile(r"-setup$|^cleanup-|-teardown$")
PLATFORM_PATTERNS = {
    "mac": re.compile(r"macos|darwin|\bmac\b|\.pkg\b|\bzsh\b", re.I),
    "win": re.compile(r"windows|powershell|\.msi\b|\.exe\b|bitlocker", re.I),
    "linux": re.compile(r"linux|ubuntu|\.deb\b|\bbash\b|python|dpkg", re.I),
}


def load_report(path):
    index_html = os.path.join(path, "index.html") if os.path.isdir(path) else path
    if not os.path.isfile(index_html):
        sys.exit(f"No index.html at {path}")
    html = open(index_html, encoding="utf-8", errors="replace").read()
    marker = "data:application/zip;base64,"
    start = html.find(marker)
    if start < 0:
        sys.exit("No embedded report zip in index.html (expected the standard HTML reporter output)")
    start += len(marker)
    end = start
    while end < len(html) and html[end] in B64:
        end += 1
    return zipfile.ZipFile(io.BytesIO(base64.b64decode(html[start:end])))


def to_ts(iso):
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp()


def collect(zf):
    main = json.loads(zf.read("report.json"))
    rows = []
    for f in main.get("files", []):
        detail = json.loads(zf.read(f["fileId"] + ".json"))
        for t in detail.get("tests", []):
            for r in t.get("results", []):
                if not r.get("startTime"):
                    continue
                rows.append({
                    "file": detail.get("fileName", ""),
                    "title": t.get("title", ""),
                    "project": t.get("projectName", ""),
                    "outcome": t.get("outcome"),
                    "status": r.get("status", ""),
                    "retry": r.get("retry", 0),
                    "start": to_ts(r["startTime"]),
                    "dur": (r.get("duration") or 0) / 1000.0,
                    "worker": r.get("workerIndex"),
                })
    return main, rows


SOURCE_PLATFORM_PATTERNS = {
    "mac": re.compile(r"'darwin'|liveMacosHost|macosHost"),
    "win": re.compile(r"'windows'"),
    "linux": re.compile(r"'linux'"),
}
_source_platforms = {}


def platforms_in_source(spec_file, specs_dir):
    """The real-VM platforms a spec resolves hosts for, read from its source.

    Titles rarely name the platform ("a package that installs appears in the
    Inventory…" runs on the Linux VM), but the spec's `findOnlineHost(request,
    'linux', …)` call does. Cached per file; an unreadable file yields nothing.
    """
    if spec_file not in _source_platforms:
        found = set()
        path = os.path.join(specs_dir, spec_file)
        if os.path.isfile(path):
            src = open(path, encoding="utf-8", errors="replace").read()
            found = {name for name, pat in SOURCE_PLATFORM_PATTERNS.items() if pat.search(src)}
        _source_platforms[spec_file] = found
    return _source_platforms[spec_file]


def platform_of(row, specs_dir):
    """Title keywords first; then the spec's source when it names one platform."""
    text = f"{row['title']} {os.path.basename(row['file'])}"
    hits = [name for name, pat in PLATFORM_PATTERNS.items() if pat.search(text)]
    if len(hits) == 1:
        return hits[0]
    if len(hits) > 1:
        return "mixed"
    in_source = platforms_in_source(row["file"], specs_dir)
    if len(in_source) == 1:
        return next(iter(in_source))
    return "mixed" if in_source else "?"


def fmt_m(seconds):
    return f"{seconds / 60:.1f}m"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("path", help="report dir or index.html")
    ap.add_argument("--tail", type=int, default=10, help="minutes of tail to list (default 10)")
    ap.add_argument("--long", type=int, default=120, help="list results longer than this many seconds (default 120)")
    ap.add_argument("--platforms", action="store_true", help="tally host-bound minutes per real-VM platform")
    ap.add_argument("--specs", default=os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "..", "playwright")),
                    help="the playwright/ dir whose spec sources --platforms reads (default: this repo's)")
    args = ap.parse_args()

    zf = load_report(args.path)
    report, rows = collect(zf)
    if not rows:
        sys.exit("The report holds no results with start times")

    t0 = min(r["start"] for r in rows)
    t1 = max(r["start"] + r["dur"] for r in rows)
    span = t1 - t0
    at = lambda ts: f"{(ts - t0) / 60:6.1f}m"
    meta = report.get("metadata") or {}
    stats = report.get("stats") or {}

    print(f"projects: {', '.join(report.get('projectNames', []))}")
    print(f"stats:    {stats}")
    # A merged report's metadata sums actualWorkers across its invocations, so
    # the peak number of results in flight is the count to trust.
    peak_in_flight = 0
    for tick in range(int(span // 10) + 1):
        at_ts = t0 + tick * 10
        peak_in_flight = max(peak_in_flight, sum(1 for r in rows if r["start"] <= at_ts < r["start"] + r["dur"]))
    print(f"run span: {span / 60:.1f} min over {len(rows)} results  |  peak in flight: {peak_in_flight}"
          f"  |  actualWorkers per metadata: {meta.get('actualWorkers', '?')} (summed across invocations in a merged report)"
          f"  |  test-minutes: {sum(r['dur'] for r in rows) / 60:.1f}")

    # ── workers ────────────────────────────────────────────────────────────────
    per_worker = defaultdict(list)
    for r in rows:
        per_worker[r["worker"]].append(r)
    print("\nworkers (index, projects, first start -> last end, busy, results):")
    for w in sorted(per_worker, key=lambda k: (k is None, k)):
        rs = per_worker[w]
        first = min(r["start"] for r in rs)
        last = max(r["start"] + r["dur"] for r in rs)
        busy = sum(r["dur"] for r in rs)
        projects = ",".join(sorted({r["project"] for r in rs}))
        print(f"  w{str(w):<3s} {projects:24s} {at(first)} -> {at(last)}  busy {fmt_m(busy):>6s}  n={len(rs)}")

    # ── concurrency per minute ────────────────────────────────────────────────
    # Sampled every 10 s and reported as the minute's peak, so a worker handing
    # over to its replacement inside a minute counts once, not twice.
    buckets = []
    m = 0
    while m * 60 < span:
        peak = 0
        for tick in range(6):
            at_ts = t0 + m * 60 + tick * 10
            peak = max(peak, sum(1 for r in rows if r["start"] <= at_ts < r["start"] + r["dur"]))
        buckets.append(peak)
        m += 1
    print(f"\nresults in flight per minute, sampled every 10 s (peak {max(buckets)}):")
    print("  " + " ".join(f"{i}:{n}" for i, n in enumerate(buckets)))

    # ── setup / teardown ──────────────────────────────────────────────────────
    steps = [r for r in rows if SETUP_PROJECTS.search(r["project"])]
    if steps:
        print("\nsetup and teardown steps:")
        for r in sorted(steps, key=lambda r: r["start"]):
            print(f"  {at(r['start'])} +{fmt_m(r['dur']):>5s}  w{str(r['worker']):<3s} {r['project']:20s} {r['status']:8s} {r['title']}")

    # ── slowest files ─────────────────────────────────────────────────────────
    per_file = defaultdict(lambda: [0, 0.0, 0.0])
    for r in rows:
        entry = per_file[r["file"]]
        entry[0] += 1
        entry[1] += r["dur"]
        entry[2] = max(entry[2], r["dur"])
    print("\nslowest files (total, longest single, results):")
    for f, (n, total, longest) in sorted(per_file.items(), key=lambda x: -x[1][1])[:15]:
        print(f"  {fmt_m(total):>6s} {fmt_m(longest):>6s} {n:4d}  {f}")

    # ── long results ──────────────────────────────────────────────────────────
    print(f"\nresults over {args.long}s, in start order:")
    for r in sorted(rows, key=lambda r: r["start"]):
        if r["dur"] >= args.long:
            print(f"  {at(r['start'])} +{fmt_m(r['dur']):>5s}  w{str(r['worker']):<3s} {r['status']:8s} r{r['retry']}  "
                  f"{r['file']} :: {r['title'][:60]}")

    # ── tail ──────────────────────────────────────────────────────────────────
    print(f"\nstill running in the last {args.tail} min:")
    for r in sorted(rows, key=lambda r: r["start"] + r["dur"]):
        if r["start"] + r["dur"] >= t1 - args.tail * 60:
            print(f"  {at(r['start'])} -> {at(r['start'] + r['dur'])}  w{str(r['worker']):<3s} {r['status']:8s} r{r['retry']}  "
                  f"{r['file']} :: {r['title'][:60]}")

    # ── failed attempts ───────────────────────────────────────────────────────
    failed = [r for r in rows if r["status"] not in ("passed", "skipped")]
    retried = sum(1 for r in rows if r["retry"] > 0)
    print(f"\nfailed attempts: {len(failed)} ({fmt_m(sum(r['dur'] for r in failed))} of worker time)  |  retry attempts: {retried}")
    for r in sorted(failed, key=lambda r: r["start"]):
        print(f"  {at(r['start'])} +{fmt_m(r['dur']):>5s}  w{str(r['worker']):<3s} {r['status']:9s} r{r['retry']}  "
              f"{r['file']} :: {r['title'][:60]}")

    # ── per-platform host-bound minutes ───────────────────────────────────────
    if args.platforms:
        threshold = 30
        tally = defaultdict(float)
        first_start = {}
        placed = {}
        for r in rows:
            if r["dur"] < threshold:
                continue
            p = platform_of(r, args.specs)
            placed[id(r)] = p
            tally[p] += r["dur"]
            first_start[p] = min(first_start.get(p, r["start"]), r["start"])
        print(f"\nminutes per platform, results over {threshold}s, by title keyword then spec source (heuristic):")
        for p in sorted(tally, key=lambda k: -tally[k]):
            print(f"  {p:6s} {fmt_m(tally[p]):>7s}   first such test at {at(first_start[p]).strip()}")
        for label in ("mixed", "?"):
            group = [r for r in rows if placed.get(id(r)) == label]
            if group:
                print(f"  {label} — longest first:")
                for r in sorted(group, key=lambda r: -r["dur"])[:8]:
                    print(f"    +{fmt_m(r['dur']):>5s}  {r['file']} :: {r['title'][:60]}")


if __name__ == "__main__":
    main()
