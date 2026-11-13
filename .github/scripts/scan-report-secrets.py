#!/usr/bin/env python3
"""Says which of the suite's secrets a Playwright report contains, and where.

Reports are encrypted before they leave CI because they hold live credentials.
This is the tool that found that out, kept so the question can be asked again:
after a change meant to keep a secret out of reports, or before a piece of a
report is pasted somewhere public (an issue, a PR, a run review).

It prints the NAMES of the env keys whose values it finds, with counts and
locations. It never prints a value.

Usage (from the repo root, on a report already decrypted by fetch_ci_run.sh):
  python3 -I .github/scripts/scan-report-secrets.py <report-dir> playwright/.env.premium [more .env files]

Looks in the report's own data (the zip embedded in index.html: step titles,
errors, stdout), in every trace under data/ (recorded requests, the action log,
response bodies) and in attached text files. Exits 0 whatever it finds.
"""
import base64
import collections
import io
import json
import pathlib
import re
import sys
import urllib.parse
import zipfile

SECRET_KEY = re.compile(r"TOKEN|PASSWORD|SECRET|PRIVATE|_KEY")
SKIP = (".png", ".webm", ".jpg", ".jpeg", ".woff", ".woff2", ".ttf")


def secrets_from(paths):
    found = {}
    for path in paths:
        for line in pathlib.Path(path).read_text().splitlines():
            m = re.match(r"\s*([A-Z0-9_]+)\s*=\s*\"?([^\"#\s]*)", line)
            # Short values would match by accident, and aren't secrets worth the name.
            if m and SECRET_KEY.search(m.group(1)) and len(m.group(2)) >= 10:
                found[m.group(1)] = m.group(2).encode()
    return found


def count(data, secrets, where, hits):
    for name, value in secrets.items():
        n = data.count(value)
        if n:
            hits[(name, where)] += n


def scan_trace(data, secrets, hits, requests):
    with zipfile.ZipFile(io.BytesIO(data)) as trace:
        for member in trace.namelist():
            body = trace.read(member)
            if member.endswith(".network"):
                where = "trace: recorded requests"
                for line in body.splitlines():
                    try:
                        request = (json.loads(line).get("snapshot") or {}).get("request") or {}
                    except ValueError:
                        continue
                    path = re.sub(r"/\d+", "/:id", urllib.parse.urlsplit(request.get("url", "")).path)
                    for header in request.get("headers", []):
                        for name, value in secrets.items():
                            if value in header.get("value", "").encode():
                                requests[(name, header.get("name", "").lower())][f"{request.get('method', '?')} {path}"] += 1
            elif member.endswith(".trace"):
                where = "trace: action log"
            elif member.startswith("resources/"):
                where = "trace: response bodies and snapshots"
            else:
                where = "trace: other"
            count(body, secrets, where, hits)


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    report = pathlib.Path(sys.argv[1])
    secrets = secrets_from(sys.argv[2:])
    if not (report / "index.html").is_file():
        sys.exit(f"{report} holds no index.html: point this at a decrypted report directory")
    hits = collections.Counter()
    requests = collections.defaultdict(collections.Counter)
    traces = 0
    for path in sorted(p for p in report.rglob("*") if p.is_file()):
        rel = path.relative_to(report).as_posix()
        if rel.startswith("trace/") or path.suffix.lower() in SKIP:
            continue  # the bundled trace viewer, and media
        data = path.read_bytes()
        if rel.startswith("data/") and path.suffix == ".zip":
            traces += 1
            try:
                scan_trace(data, secrets, hits, requests)
            except zipfile.BadZipFile:
                count(data, secrets, "data/: an attached archive", hits)
        elif rel == "index.html":
            count(data, secrets, "index.html: page source", hits)
            embedded = re.search(rb"data:application/zip;base64,([A-Za-z0-9+/=]+)", data)
            if embedded:
                with zipfile.ZipFile(io.BytesIO(base64.b64decode(embedded.group(1)))) as blob:
                    for member in blob.namelist():
                        count(blob.read(member), secrets, "report data: step titles, errors, stdout", hits)
        else:
            count(data, secrets, f"attached {path.suffix or 'file'}", hits)

    print(f"{report}: {traces} trace(s); checked {len(secrets)} secret value(s) from {len(sys.argv) - 2} env file(s)")
    if not hits:
        print("  none of them appear in this report")
        return
    for (name, where), n in sorted(hits.items()):
        print(f"  {name:34} {where}: {n}")
    for (name, header), paths in sorted(requests.items()):
        top = ", ".join(f"{p} ×{c}" for p, c in paths.most_common(4))
        print(f"  {name:34} sent as the `{header}` header of: {top}")


if __name__ == "__main__":
    main()
