#!/usr/bin/env python3
"""Summarize a Playwright HTML report into compact triage JSON.

The Playwright HTML report (`index.html`) embeds the full structured result
set as a base64 gzip zip in a `data:application/zip;base64,...` blob. That zip
holds `report.json` (stats + a per-file index) plus one detail JSON per spec
file (the per-attempt results, errors, and attachment paths). Reading that blob
is far more reliable than scraping the rendered HTML or trusting the terminal
log, so every triage should start here.

Usage:
    parse_report.py <path>          # path = report dir OR index.html
    parse_report.py <path> --slow 10  # also list the 10 slowest tests

Output: JSON on stdout. Attachment paths are resolved to absolute paths on disk
so the caller can Read the screenshot / error-context.md / trace directly.
"""
import argparse
import base64
import io
import json
import os
import re
import sys
import zipfile

ANSI = re.compile(r"\x1b\[[0-9;]*m")


def strip_ansi(s):
    return ANSI.sub("", s or "")


def find_index_html(path):
    if os.path.isdir(path):
        candidate = os.path.join(path, "index.html")
        if not os.path.isfile(candidate):
            sys.exit(f"No index.html in {path}")
        return candidate
    return path


def load_embedded_zip(index_html_path):
    html = open(index_html_path, "r", encoding="utf-8", errors="replace").read()
    marker = "data:application/zip;base64,"
    i = html.find(marker)
    if i < 0:
        sys.exit(
            "No embedded report zip found in index.html. This parser expects the "
            "standard Playwright HTML reporter output."
        )
    start = i + len(marker)
    # The blob's terminator varies by reporter version: it may sit in a quoted
    # attribute or, as of recent versions, inside a bare <template> element that
    # ends with '<'. Scan to the first character outside the base64 alphabet so
    # every form is handled without guessing the delimiter.
    end = start
    b64_chars = set(
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="
    )
    while end < len(html) and html[end] in b64_chars:
        end += 1
    raw = base64.b64decode(html[start:end])
    return zipfile.ZipFile(io.BytesIO(raw))


def classify(outcome):
    # Playwright outcomes: 'expected' (passed as configured), 'unexpected'
    # (failed even after all retries), 'flaky' (failed then passed on retry),
    # 'skipped'. 'flaky' and 'unexpected' are the ones that need triage; a
    # 'flaky' outcome is the single strongest signal that a test is flaky
    # rather than genuinely broken, because Playwright observed both a fail and
    # a pass for the same code against the same environment moments apart.
    return outcome


def summarize(zf, data_dir, slow_n):
    main = json.loads(zf.read("report.json"))
    stats = main.get("stats", {})
    out = {
        "status": "passed" if stats.get("ok") else "failed",
        "stats": stats,
        "projects": main.get("projectNames", []),
        "startTime": main.get("startTime"),
        "duration_ms": main.get("duration"),
        "top_level_errors": [strip_ansi(e.get("message", "")) for e in main.get("errors", [])],
        "attention": [],  # flaky + unexpected tests, fully detailed
        "slowest": [],
    }

    all_tests = []  # (duration, title, project, file) for the slow list

    for f in main.get("files", []):
        detail = json.loads(zf.read(f["fileId"] + ".json"))
        for t in detail.get("tests", []):
            dur = t.get("duration", 0)
            all_tests.append((dur, t.get("title"), t.get("projectName"), detail.get("fileName")))
            outcome = classify(t.get("outcome"))
            if outcome not in ("unexpected", "flaky"):
                continue
            attempts = []
            for r in t.get("results", []):
                atts = {}
                for a in r.get("attachments", []):
                    p = a.get("path")
                    if p:
                        # paths in the report are relative to the report dir
                        atts[a.get("name")] = os.path.abspath(os.path.join(data_dir, p))
                errors = []
                for e in r.get("errors", []):
                    errors.append(strip_ansi(e.get("message", "")).strip())
                attempts.append(
                    {
                        "retry": r.get("retry"),
                        "status": r.get("status"),
                        "duration_ms": r.get("duration"),
                        "errors": errors,
                        "attachments": atts,
                    }
                )
            out["attention"].append(
                {
                    "title": t.get("title"),
                    "outcome": outcome,
                    "project": t.get("projectName"),
                    "file": detail.get("fileName"),
                    "line": (t.get("location") or {}).get("line"),
                    "num_attempts": len(t.get("results", [])),
                    "attempts": attempts,
                }
            )

    all_tests.sort(reverse=True)
    out["slowest"] = [
        {"duration_ms": d, "title": ti, "project": pr, "file": fi}
        for d, ti, pr, fi in all_tests[:slow_n]
    ]
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("path", help="report dir or index.html")
    ap.add_argument("--slow", type=int, default=5, help="how many slowest tests to list")
    args = ap.parse_args()

    index_html = find_index_html(args.path)
    data_dir = os.path.dirname(os.path.abspath(index_html))
    zf = load_embedded_zip(index_html)
    print(json.dumps(summarize(zf, data_dir, args.slow), indent=2))


if __name__ == "__main__":
    main()
