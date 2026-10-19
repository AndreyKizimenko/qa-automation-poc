#!/usr/bin/env python3
"""Render an exploratory session's findings page (fleet-explore, step 4).

usage: findings_page.py <findings.json> --out <dir> [--out <dir> ...]

Reads the session's findings.json (schema: references/findings-page.md), converts the screenshots it
names to WebP (Pillow when installed; copied as-is otherwise) into <dir>/shots/, and writes
<dir>/index.html: an index of every finding, the findings grouped by mechanism with steps, raw
evidence and their screenshots inline (click to enlarge, arrow keys to step), questions for product
with a copy button, risks, suite candidates, what held up, a screenshot gallery and coverage.
Paths in the JSON are relative to the JSON file. Refuses token-shaped strings and missing files.
Prints a JSON line with file_path, root and files, ready for an Artifact publish.
"""
import argparse
import html
import json
import os
import re
import shutil
import sys

IMPACTS = [  # key, css class, filter label; this order is the severity order of the rail and index
    ("security", "i-sec", "Security & permissions"),
    ("data-loss", "i-loss", "Data loss"),
    ("wrong-settings", "i-config", "Wrong settings delivered"),
    ("wrong-data", "i-data", "Wrong data or status"),
    ("workflow", "i-flow", "Workflow"),
    ("cosmetic", "i-ugly", "Cosmetic"),
]
IMPACT_CLASS = {k: c for k, c, _ in IMPACTS}
IMPACT_RANK = {k: i for i, (k, _, _) in enumerate(IMPACTS)}
SECRET = re.compile(
    r"eyJ[A-Za-z0-9_-]{20,}|Bearer [A-Za-z0-9]{20,}|enroll_secret[= ]+[A-Za-z0-9]{12,}"
    r"|FLEET_API_TOKEN=[A-Za-z0-9]{8,}|node_key[\"': =]+[A-Za-z0-9+/]{20,}"
)

try:
    from PIL import Image  # optional: WebP conversion and thumbnail shape
except ImportError:  # pragma: no cover
    Image = None

errors = []


def fail(msg):
    errors.append(msg)


def esc(s):
    return html.escape(str(s), quote=True)


def inline(s):
    """Escape text; allow `code` and **bold**."""
    out = []
    for part in re.split(r"(`[^`]+`)", str(s)):
        if len(part) >= 2 and part.startswith("`") and part.endswith("`"):
            out.append("<code>" + esc(part[1:-1]) + "</code>")
        else:
            out.append(re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", esc(part)))
    return "".join(out)


def plain(s):
    return re.sub(r"\*\*(.+?)\*\*", r"\1", str(s)).replace("`", "")


class Shots:
    """Converts each screenshot once and remembers its published path and shape."""

    def __init__(self, base):
        self.base = base
        self.items = {}  # source abs path -> dict(rel, wide)
        self.used = set()

    def add(self, src):
        path = os.path.normpath(os.path.join(self.base, src))
        if path in self.items:
            return self.items[path]
        if not os.path.isfile(path):
            fail(f"screenshot not found: {src}")
            return None
        stem, ext = os.path.splitext(os.path.basename(path))
        stem = re.sub(r"[^A-Za-z0-9._-]+", "-", stem)
        out_ext = ".webp" if Image is not None else ext.lower()
        name, n = stem + out_ext, 2
        while name in self.used:
            name, n = f"{stem}-{n}{out_ext}", n + 1
        self.used.add(name)
        wide = None
        if Image is not None:
            with Image.open(path) as im:
                w, h = im.size
                wide = w / max(h, 1) > 1.6
        self.items[path] = {"src": path, "rel": "shots/" + name, "wide": wide}
        return self.items[path]

    def write(self, out_dir):
        os.makedirs(os.path.join(out_dir, "shots"), exist_ok=True)
        for item in self.items.values():
            dst = os.path.join(out_dir, item["rel"])
            if Image is not None:
                with Image.open(item["src"]) as im:
                    im = im.convert("RGB")
                    if im.width > 1600:
                        im = im.resize((1600, round(im.height * 1600 / im.width)))
                    im.save(dst, "WEBP", quality=82, method=6)
            else:
                shutil.copyfile(item["src"], dst)


def thumb(shot, caption, detail, label, wide=None):
    if not shot:
        return ""
    is_wide = shot["wide"] if wide is None else wide
    cls = "thumb wide" if is_wide else "thumb"
    cap = detail or caption
    return (
        f'<figure class="{cls}"><button data-lb="{esc(shot["rel"])}" data-cap="{esc(plain(cap))}" '
        f'aria-label="Open screenshot: {esc(plain(caption))}"><img src="{esc(shot["rel"])}" '
        f'alt="{esc(plain(caption))}" loading="lazy"></button>'
        f'<figcaption>{"<b>" + esc(label) + "</b> " if label else ""}{inline(caption)}</figcaption></figure>'
    )


def evidence_block(ev):
    title = f'<span class="blk-title">{esc(ev.get("title", "Evidence"))}</span>'
    body = ""
    if "table" in ev:
        t = ev["table"]
        head = "".join(f"<th>{esc(c)}</th>" for c in t.get("columns", []))
        rows = []
        for r in t.get("rows", []):
            cells = []
            for c in r:
                if isinstance(c, dict):
                    cls = " ".join(x for x in ("num" if c.get("num") else "", "bad" if c.get("bad") else "") if x)
                    cells.append(f'<td{" class=" + chr(34) + cls + chr(34) if cls else ""}>{inline(c.get("text", ""))}</td>')
                else:
                    cells.append(f"<td>{inline(c)}</td>")
            rows.append("<tr>" + "".join(cells) + "</tr>")
        body += f'<div class="tbl-wrap"><table><thead><tr>{head}</tr></thead><tbody>{"".join(rows)}</tbody></table></div>'
    if "pre" in ev:
        body += f"<pre>{esc(ev['pre'])}</pre>"
    if "text" in ev:
        body += f"<p>{inline(ev['text'])}</p>"
    return f'<div class="blk">{title}{body}</div>'


def main():
    ap = argparse.ArgumentParser(description="Render a fleet-explore findings page.")
    ap.add_argument("findings_json")
    ap.add_argument("--out", action="append", required=True, help="output directory (repeatable)")
    a = ap.parse_args()

    raw = open(a.findings_json, encoding="utf-8").read()
    for m in SECRET.finditer(raw):
        fail(f"token-shaped string in {a.findings_json}: {m.group(0)[:12]}… (remove it before rendering)")
    d = json.loads(raw)
    base = os.path.dirname(os.path.abspath(a.findings_json))
    shots = Shots(base)

    for key in ("title", "findings"):
        if not d.get(key):
            fail(f"missing required key: {key}")
    mechs = d.get("mechanisms") or [{"key": "all", "title": "Findings"}]
    mech_keys = [m["key"] for m in mechs]
    findings = d.get("findings") or []
    seen = set()
    for f in findings:
        fid = f.get("id")
        if not fid or fid in seen:
            fail(f"finding id missing or duplicated: {fid!r}")
        seen.add(fid)
        if f.get("impact") not in IMPACT_CLASS:
            fail(f"{fid}: impact must be one of {list(IMPACT_CLASS)}")
        f.setdefault("mechanism", mech_keys[0])
        if f["mechanism"] not in mech_keys:
            fail(f"{fid}: unknown mechanism {f['mechanism']!r}")
        for key in ("title", "summary"):
            if not f.get(key):
                fail(f"{fid}: missing {key}")
        f["_shots"] = [(shots.add(s["file"]), s) for s in f.get("screenshots", [])]
    extra = [(shots.add(s["file"]), s) for s in d.get("gallery", [])]
    if errors:
        print("\n".join("error: " + e for e in errors), file=sys.stderr)
        sys.exit(2)

    by_rank = sorted(findings, key=lambda f: IMPACT_RANK[f["impact"]])
    page = []
    w = page.append

    # header
    w('<div class="wrap"><header class="masthead">')
    if d.get("eyebrow"):
        w('<div class="eyebrow">' + "".join(f"<span>{esc(x)}</span>" for x in d["eyebrow"]) + "</div>")
    w(f"<h1>{esc(d['title'])}</h1>")
    if d.get("lede"):
        w(f'<p class="lede">{inline(d["lede"])}</p>')
    if d.get("banner"):
        b = d["banner"]
        w(f'<div class="banner" role="note"><span class="dot" aria-hidden="true"></span><div><b>{inline(b.get("title", ""))}</b> {inline(b.get("text", ""))}</div></div>')
    n_shots = len(shots.items)
    stats = [(len(findings), "findings"), (len(mechs) if d.get("mechanisms") else 0, "mechanisms"),
             (len(d.get("questions", [])), "questions for product"), (len(d.get("risks", [])), "risks"),
             (len(d.get("candidates", [])), "suite candidates"), (n_shots, "screenshots")]
    w('<div class="strip" aria-label="Summary">' + "".join(f"<span><b>{n}</b> {esc(t)}</span>" for n, t in stats if n) + "</div>")
    w("</header>")

    # rail
    w('<div class="layout"><nav class="rail" aria-label="Findings"><div><h2>Findings</h2><ul class="rail-list findings">')
    for f in by_rank:
        w(f'<li><a href="#{esc(f["id"])}" class="{IMPACT_CLASS[f["impact"]]}"><span class="id id-chip">{esc(f["id"])}</span>{esc(plain(f.get("short") or f["title"]))}</a></li>')
    w('</ul></div><div><h2>Sections</h2><ul class="rail-list sections">')
    sections = [("index", "All findings at a glance"), ("findings", "Findings by mechanism" if d.get("mechanisms") else "Findings")]
    for key, label in (("questions", "Questions for product"), ("risks", "Risks"), ("candidates", "Candidates for the suite"),
                       ("held_up", "What held up"), ("gallery", "All screenshots"), ("coverage", "Coverage and setup")):
        if key == "gallery" and n_shots:
            sections.append(("gallery", label))
        elif key == "held_up" and (d.get("held_up") or d.get("known_issues")):
            sections.append(("held", label))
        elif key == "candidates" and d.get("candidates"):
            sections.append(("suite", label))
        elif key not in ("gallery", "held_up", "candidates") and d.get(key):
            sections.append((key, label))
    w("".join(f'<li><a href="#{k}">{esc(l)}</a></li>' for k, l in sections))
    w("</ul></div></nav><main>")

    # index table
    mech_title = {m["key"]: m.get("short") or m["title"] for m in mechs}
    w('<section id="index" aria-labelledby="index-h"><h2 id="index-h">All findings at a glance</h2>')
    w(f'<p class="section-intro">{inline(d.get("index_intro", "For each one: file it, mention it, or drop it."))}</p>')
    w('<div class="tbl-wrap"><table class="index-table"><thead><tr><th>ID</th><th>Finding</th><th>Impact</th>'
      + ("<th>Mechanism</th>" if d.get("mechanisms") else "") + "<th>Evidence</th></tr></thead><tbody>")
    for f in by_rank:
        ns = len([s for s, _ in f["_shots"] if s])
        ev = []
        if ns:
            ev.append(f"{ns} shot{'s' if ns != 1 else ''}")
        if f.get("evidence"):
            ev.append(f.get("evidence_kind", "log"))
        if f.get("filed"):
            ev.append(str(f["filed"]))
        w(f'<tr class="{IMPACT_CLASS[f["impact"]]}"><td><span class="id-chip">{esc(f["id"])}</span></td>'
          f'<td><a href="#{esc(f["id"])}">{inline(f["title"])}</a></td><td>{esc(f.get("impact_label", ""))}</td>'
          + (f"<td>{esc(mech_title[f['mechanism']])}</td>" if d.get("mechanisms") else "")
          + f'<td class="shots">{esc(" · ".join(ev))}</td></tr>')
    w("</tbody></table></div></section>")

    # findings by mechanism
    w('<section id="findings" aria-labelledby="findings-h">')
    w(f'<h2 id="findings-h">{"Findings by mechanism" if d.get("mechanisms") else "Findings"}</h2>')
    w('<p class="section-intro">Filter by impact. Click any screenshot to open it full size; use the arrow keys to move between images and Escape to close.</p>')
    w('<div class="filters" role="group" aria-label="Filter findings by impact"><span class="label">Show</span>')
    w(f'<button class="fbtn" data-f="all" aria-pressed="true">All <span class="fcount">{len(findings)}</span></button>')
    for key, cls, label in IMPACTS:
        n = sum(1 for f in findings if f["impact"] == key)
        if n:
            w(f'<button class="fbtn {cls}" data-f="{cls}" aria-pressed="false"><span class="sw"></span>{esc(label)} <span class="fcount">{n}</span></button>')
    n_with = sum(1 for f in findings if any(s for s, _ in f["_shots"]))
    if n_with:
        w(f'<button class="fbtn" data-f="shots" aria-pressed="false">With screenshots <span class="fcount">{n_with}</span></button>')
    w('</div><div style="display:grid;gap:40px">')
    for m in mechs:
        group = [f for f in findings if f["mechanism"] == m["key"]]
        if not group:
            continue
        w(f'<div class="mech" id="m-{esc(m["key"])}"><div class="mech-head">')
        if m.get("extends"):
            w(f'<span class="extends">{esc(m["extends"])}</span>')
        w(f"<h3>{inline(m['title'])}</h3>")
        if m.get("summary"):
            w(f"<p>{inline(m['summary'])}</p>")
        w("</div>")
        for f in group:
            cls = IMPACT_CLASS[f["impact"]]
            has = any(s for s, _ in f["_shots"])
            w(f'<article class="card {cls}" id="{esc(f["id"])}" data-impact="{cls}"{" data-shots=" + chr(34) + "1" + chr(34) if has else ""}>')
            w(f'<div class="card-head"><div class="big-id">{esc(f["id"])}</div><div><h4>{inline(f["title"])}</h4><div class="chips">')
            if f.get("impact_label"):
                w(f'<span class="chip impact">{esc(f["impact_label"])}</span>')
            if f.get("origin"):
                w(f'<span class="chip">{esc(f["origin"])}</span>')
            if f.get("repro"):
                w(f'<span class="chip repro">{esc(f["repro"])}</span>')
            if f.get("filed"):
                w(f'<span class="chip">{esc(f["filed"])}</span>')
            w("</div></div></div>")
            w(f"<p>{inline(f['summary'])}</p>")
            if f.get("steps"):
                w('<div class="blk"><span class="blk-title">Steps</span><ol>' + "".join(f"<li>{inline(s)}</li>" for s in f["steps"]) + "</ol></div>")
            for ev in f.get("evidence", []):
                w(evidence_block(ev))
            if has:
                w('<div class="blk"><span class="blk-title">Screenshots</span><div class="thumbs">')
                for s, spec in f["_shots"]:
                    w(thumb(s, spec.get("caption", ""), spec.get("detail"), spec.get("label"), spec.get("wide")))
                w("</div></div>")
            if f.get("where"):
                w(f'<div class="blk"><span class="blk-title">Where</span><span class="where">{esc(f["where"])}</span></div>')
            w("</article>")
        w("</div>")
    for c in d.get("callouts", []):
        w(f'<div class="callout"><h3>{inline(c.get("title", ""))}</h3><p>{inline(c.get("text", ""))}</p></div>')
    w("</div></section>")

    # questions
    if d.get("questions"):
        w('<section id="questions" aria-labelledby="q-h"><h2 id="q-h">Questions for product</h2>')
        w('<p class="section-intro">Behaviour that may be intended. Copy the block to post or forward it.</p><div class="qbox"><ol id="qlist">')
        for q in d["questions"]:
            ref = f' <span class="qref">({esc(q["ref"])})</span>' if q.get("ref") else ""
            w(f'<li data-q="{esc(plain(q["text"]))}">{inline(q["text"])}{ref}</li>')
        w('</ol><button class="copy" id="copyq" type="button">Copy questions</button></div></section>')

    # risks + candidates
    if d.get("risks") or d.get("candidates"):
        w('<section aria-label="Risks and suite candidates"><div class="two">')
        if d.get("risks"):
            w('<div class="panel" id="risks"><h3>Risks</h3><p class="section-intro" style="margin:0">Nothing broke yet, but each is one realistic step away. Mention or drop.</p><ul>')
            for r in d["risks"]:
                lead = f"<strong>{esc(r['lead'])}.</strong> " if r.get("lead") else ""
                w(f"<li>{lead}{inline(r.get('text', ''))}</li>")
            w("</ul></div>")
        if d.get("candidates"):
            w('<div class="panel" id="suite"><h3>Candidates for the suite</h3><p class="section-intro" style="margin:0">Stable, unambiguous, worth running nightly. "After X" waits for that fix.</p><ul>')
            for c in d["candidates"]:
                when = f"<strong>{esc(c['when'])}:</strong> " if c.get("when") else ""
                w(f"<li>{when}{inline(c.get('text', ''))}</li>")
            w("</ul></div>")
        w("</div></section>")

    # held up
    if d.get("held_up") or d.get("known_issues"):
        w('<section id="held" aria-labelledby="held-h"><h2 id="held-h">What held up</h2>')
        w('<p class="section-intro">The probes the feature handled correctly, so these don\'t need worrying about.</p><div class="two">')
        for g in d.get("held_up", []):
            w(f'<div class="panel held"><h3>{esc(g.get("heading", "Held up"))}</h3><ul>' + "".join(f"<li>{inline(i)}</li>" for i in g.get("items", [])) + "</ul></div>")
        w("</div>")
        if d.get("known_issues"):
            w('<div class="panel" style="margin-top:16px"><h3>Known issues met again</h3><ul>')
            for k in d["known_issues"]:
                w(f"<li><strong>{esc(k.get('issue', ''))}</strong> {inline(k.get('text', ''))}</li>")
            w("</ul></div>")
        w("</section>")

    # gallery: every finding screenshot (once) plus extras
    if n_shots:
        w('<section id="gallery" aria-labelledby="gal-h"><h2 id="gal-h">All screenshots</h2>')
        if d.get("gallery_intro"):
            w(f'<p class="section-intro">{inline(d["gallery_intro"])}</p>')
        w('<div class="thumbs">')
        done = set()
        for f in findings:
            for s, spec in f["_shots"]:
                if s and s["rel"] not in done:
                    done.add(s["rel"])
                    w(thumb(s, spec.get("caption", ""), spec.get("detail"), spec.get("label") or f["id"], False))
        for s, spec in extra:
            if s and s["rel"] not in done:
                done.add(s["rel"])
                w(thumb(s, spec.get("caption", ""), spec.get("detail"), spec.get("label"), False))
        w("</div></section>")

    # coverage
    if d.get("coverage"):
        w('<section id="coverage" aria-labelledby="cov-h"><h2 id="cov-h">Coverage and setup</h2><div class="tbl-wrap"><table><thead><tr><th>Area</th><th>Status</th><th>Gap</th></tr></thead><tbody>')
        for row in d["coverage"]:
            row = (list(row) + ["", "", ""])[:3]
            w("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in row) + "</tr>")
        w("</tbody></table></div>")
        if d.get("setup"):
            w(f'<p class="section-intro" style="margin-top:14px">{inline(d["setup"])}</p>')
        w("</section>")
    if d.get("footer"):
        w("<footer>" + "".join(f"<span>{inline(x)}</span>" for x in d["footer"]) + "</footer>")
    w("</main></div></div>")
    w('<div class="lb" id="lb" hidden role="dialog" aria-modal="true" aria-label="Screenshot viewer">'
      '<div class="lb-bar"><span class="ctr" id="lb-ctr"></span><span style="display:flex;gap:8px">'
      '<button class="lb-btn" id="lb-prev" type="button">← Prev</button><button class="lb-btn" id="lb-next" type="button">Next →</button>'
      '<button class="lb-btn" id="lb-close" type="button">Close</button></span></div>'
      '<div class="lb-stage"><img id="lb-img" alt=""></div><p class="lb-cap" id="lb-cap"></p></div>')

    # charset, viewport and the [hidden] rule repeat what the Artifact skeleton adds, so the page
    # also works opened straight from disk or a local server
    doc = ('<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
           f"<title>{esc(d['title'])}</title>\n"
           '<meta name="claude:viewport-fit-sides" content="cover">\n'
           '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
           '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
           '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans+Condensed:wght@500;600;700&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap">\n'
           f"<style>{CSS}</style>\n" + "\n".join(page) + f"\n<script>{JS}</script>\n")

    files = sorted(i["rel"] for i in shots.items.values())
    for out in a.out:
        os.makedirs(out, exist_ok=True)
        with open(os.path.join(out, "index.html"), "w", encoding="utf-8") as fh:
            fh.write(doc)
        shots.write(out)
        print(json.dumps({"file_path": os.path.abspath(os.path.join(out, "index.html")),
                          "root": os.path.abspath(out), "files": files}))
    print(f"{len(findings)} findings, {len(files)} screenshots, {len(doc) // 1024} KB page"
          + ("" if Image is not None else " (Pillow missing: screenshots copied unconverted)"), file=sys.stderr)


CSS = r"""
/* Layout: a QA evidence file. Left rail = finding index by impact; right = findings grouped by mechanism, each with steps, raw evidence and its screenshots inline. */
:root {
  --bg: #f4f6f8;
  --surface: #ffffff;
  --sunk: #eef1f4;
  --fg: #16202b;
  --muted: #586675;
  --line: #d9e0e7;
  --accent: #0d6b67;
  --accent-soft: #e2f1ef;
  --sev-sec: #8f1d3f;      --sev-sec-bg: #f8e6ec;
  --sev-loss: #b42318;     --sev-loss-bg: #fbe9e7;
  --sev-config: #a94a06;   --sev-config-bg: #fdf0e1;
  --sev-data: #1e5aa8;     --sev-data-bg: #e6eefa;
  --sev-flow: #5b3fa6;     --sev-flow-bg: #eee9fa;
  --sev-ugly: #4b5563;     --sev-ugly-bg: #eceff3;
  --ok: #18794e;           --ok-bg: #e4f4ec;
  --code-bg: #f1f4f7;
  --shadow: 0 1px 2px rgba(16, 32, 48, .06), 0 4px 16px rgba(16, 32, 48, .05);
  --font-display: "IBM Plex Sans Condensed", "Arial Narrow", "Helvetica Neue", Arial, sans-serif;
  --font-body: "IBM Plex Sans", "Helvetica Neue", Arial, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #0e1318; --surface: #151c23; --sunk: #1b232c; --fg: #e4eaf0; --muted: #9aa8b6; --line: #27323d;
    --accent: #45c2b8; --accent-soft: #15302e;
    --sev-sec: #f08aa9; --sev-sec-bg: #3a1823; --sev-loss: #ff8a7a; --sev-loss-bg: #3b1b17;
    --sev-config: #f5a65b; --sev-config-bg: #3a2814; --sev-data: #8ab4ff; --sev-data-bg: #182841;
    --sev-flow: #b9a3ff; --sev-flow-bg: #261e40; --sev-ugly: #b3bdc8; --sev-ugly-bg: #232c35;
    --ok: #5fd39a; --ok-bg: #12301f; --code-bg: #10161c; --shadow: 0 1px 2px rgba(0,0,0,.4);
    color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --bg: #0e1318; --surface: #151c23; --sunk: #1b232c; --fg: #e4eaf0; --muted: #9aa8b6; --line: #27323d;
  --accent: #45c2b8; --accent-soft: #15302e;
  --sev-sec: #f08aa9; --sev-sec-bg: #3a1823; --sev-loss: #ff8a7a; --sev-loss-bg: #3b1b17;
  --sev-config: #f5a65b; --sev-config-bg: #3a2814; --sev-data: #8ab4ff; --sev-data-bg: #182841;
  --sev-flow: #b9a3ff; --sev-flow-bg: #261e40; --sev-ugly: #b3bdc8; --sev-ugly-bg: #232c35;
  --ok: #5fd39a; --ok-bg: #12301f; --code-bg: #10161c; --shadow: 0 1px 2px rgba(0,0,0,.4);
  color-scheme: dark;
}
* { box-sizing: border-box; }
[hidden] { display: none !important; }
body { margin: 0; }
body { background: var(--bg); color: var(--fg); font-family: var(--font-body); font-size: 15px; line-height: 1.55; }
a { color: var(--accent); }
a:focus-visible, button:focus-visible, [tabindex]:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
code, .mono { font-family: var(--font-mono); font-size: .88em; }
h1, h2, h3 { font-family: var(--font-display); text-wrap: balance; line-height: 1.15; margin: 0; }

.wrap { max-width: 1320px; margin: 0 auto; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 28px 64px; }

/* header */
.masthead { display: grid; gap: 14px; padding-block-end: 22px; border-bottom: 1px solid var(--line); }
.eyebrow { font-family: var(--font-mono); font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); display: flex; flex-wrap: wrap; gap: 6px 14px; }
h1 { font-size: clamp(30px, 4.4vw, 46px); font-weight: 700; letter-spacing: -.01em; }
.lede { max-width: 72ch; color: var(--muted); margin: 0; font-size: 16px; }
.lede strong { color: var(--fg); }
.banner { display: flex; gap: 12px; align-items: flex-start; background: var(--sev-sec-bg); color: var(--fg); border: 1px solid color-mix(in srgb, var(--sev-sec) 35%, transparent); border-radius: 10px; padding: 12px 14px; max-width: 900px; }
.banner b { color: var(--sev-sec); }
.banner .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--sev-sec); margin-top: 6px; flex: none; }

/* stats strip */
.strip { display: flex; flex-wrap: wrap; gap: 8px 22px; font-size: 14px; color: var(--muted); }
.strip span b { font-family: var(--font-mono); color: var(--fg); font-weight: 600; font-variant-numeric: tabular-nums; }

/* layout */
.layout { display: grid; grid-template-columns: 250px minmax(0, 1fr); gap: 36px; margin-top: 28px; }
@media (max-width: 960px) { .layout { grid-template-columns: minmax(0, 1fr); gap: 20px; } }
.rail { position: sticky; top: calc(env(safe-area-inset-top, 0px) + 16px); align-self: start; max-height: calc(100vh - 32px); overflow: auto; display: grid; gap: 18px; padding-right: 4px; }
@media (max-width: 960px) { .rail { position: static; max-height: none; } }
.rail h2 { font-size: 13px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .07em; color: var(--muted); font-weight: 500; margin-bottom: 8px; }
.rail-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
@media (max-width: 960px) { .rail-list.findings { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); } }
.rail-list a { display: grid; grid-template-columns: 26px 1fr; gap: 8px; align-items: baseline; text-decoration: none; color: var(--fg); padding: 5px 8px; border-radius: 6px; font-size: 13.5px; line-height: 1.35; }
.rail-list a:hover { background: var(--sunk); }
.rail-list .id { font-family: var(--font-mono); font-weight: 600; text-align: center; border-radius: 4px; padding: 0 2px; font-size: 12.5px; }
.rail-list.sections a { grid-template-columns: 1fr; }

/* severity colors by impact class */
.i-sec    { --c: var(--sev-sec);    --cb: var(--sev-sec-bg); }
.i-loss   { --c: var(--sev-loss);   --cb: var(--sev-loss-bg); }
.i-config { --c: var(--sev-config); --cb: var(--sev-config-bg); }
.i-data   { --c: var(--sev-data);   --cb: var(--sev-data-bg); }
.i-flow   { --c: var(--sev-flow);   --cb: var(--sev-flow-bg); }
.i-ugly   { --c: var(--sev-ugly);   --cb: var(--sev-ugly-bg); }
.id-chip { color: var(--c); background: var(--cb); }

/* filters */
.filters { display: flex; flex-wrap: wrap; gap: 8px; margin: 4px 0 22px; align-items: center; }
.filters .label { font-size: 13px; color: var(--muted); margin-right: 4px; }
.fbtn { font: 500 13px var(--font-body); border: 1px solid var(--line); background: var(--surface); color: var(--fg); padding: 5px 11px; border-radius: 999px; cursor: pointer; display: inline-flex; gap: 7px; align-items: center; }
.fbtn .sw { width: 9px; height: 9px; border-radius: 50%; background: var(--c, var(--muted)); }
.fbtn[aria-pressed="true"] { border-color: var(--c, var(--accent)); background: var(--cb, var(--accent-soft)); }
.fcount { font-family: var(--font-mono); font-size: 12px; color: var(--muted); }

/* sections */
main { display: grid; gap: 44px; min-width: 0; }
/* grid items default to min-width:auto, so a wide <pre> or table would widen the page at phone width */
main > *, .mech, .mech > *, .card > *, .two > *, .blk > * { min-width: 0; }
section > h2 { font-size: 26px; font-weight: 600; margin-bottom: 6px; }
.section-intro { color: var(--muted); max-width: 78ch; margin: 0 0 18px; }
.mech { display: grid; gap: 16px; }
.mech-head { display: grid; gap: 4px; border-left: 3px solid var(--accent); padding: 2px 0 2px 14px; }
.mech-head h3 { font-size: 21px; font-weight: 600; }
.mech-head p { margin: 0; color: var(--muted); max-width: 80ch; }
.mech-head .extends { font-family: var(--font-mono); font-size: 12px; color: var(--accent); text-transform: uppercase; letter-spacing: .05em; }

/* finding card */
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--shadow); padding: 18px 20px 20px; display: grid; gap: 14px; scroll-margin-top: 16px; position: relative; overflow: hidden; }
.card::before { content: ""; position: absolute; inset: 0 auto 0 0; width: 4px; background: var(--c); }
.card-head { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 14px; align-items: start; }
.big-id { font-family: var(--font-mono); font-weight: 600; font-size: 22px; width: 44px; height: 44px; display: grid; place-items: center; border-radius: 10px; color: var(--c); background: var(--cb); }
.card h4 { font-family: var(--font-display); font-size: 19px; font-weight: 600; margin: 2px 0 8px; line-height: 1.25; text-wrap: balance; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { font-size: 12px; font-weight: 500; padding: 2px 9px; border-radius: 999px; border: 1px solid var(--line); color: var(--muted); background: var(--sunk); white-space: nowrap; }
.chip.impact { color: var(--c); background: var(--cb); border-color: transparent; }
.chip.repro { color: var(--ok); background: var(--ok-bg); border-color: transparent; }
.card p { margin: 0; max-width: 82ch; }
.blk { display: grid; gap: 6px; min-width: 0; }
.blk-title { font-family: var(--font-mono); font-size: 11.5px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
.card ol, .card ul { margin: 0; padding-left: 20px; display: grid; gap: 4px; max-width: 82ch; }
pre { margin: 0; background: var(--code-bg); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; overflow-x: auto; font-family: var(--font-mono); font-size: 12.5px; line-height: 1.5; white-space: pre; }
.tbl-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 8px; }
table { border-collapse: collapse; width: 100%; font-size: 13px; }
th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { background: var(--sunk); font-weight: 600; font-size: 12px; color: var(--muted); }
tr:last-child td { border-bottom: 0; }
td.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; text-align: right; }
td.bad { color: var(--sev-loss); font-weight: 600; }
.where { font-family: var(--font-mono); font-size: 12.5px; color: var(--muted); overflow-wrap: anywhere; }

/* thumbnails */
.thumbs { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.thumb { margin: 0; display: grid; gap: 6px; }
.thumb button { all: unset; cursor: zoom-in; display: block; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; background: var(--sunk); }
.thumb button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.thumb img { display: block; width: 100%; height: 170px; object-fit: cover; object-position: top left; }
.thumb.wide img { height: auto; max-height: 340px; object-fit: contain; background: var(--sunk); }
.thumb figcaption { font-size: 12.5px; color: var(--muted); line-height: 1.4; }
.thumb figcaption b { color: var(--fg); font-weight: 600; }

/* index table */
.index-table td:first-child { width: 44px; }
.index-table a { color: var(--fg); text-decoration: none; }
.index-table a:hover { text-decoration: underline; }
.index-table .id-chip { font-family: var(--font-mono); font-weight: 600; padding: 1px 7px; border-radius: 4px; }
.index-table .shots { font-family: var(--font-mono); font-size: 12px; color: var(--muted); white-space: nowrap; }

/* callout */
.callout { background: var(--accent-soft); border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent); border-radius: 12px; padding: 16px 18px; display: grid; gap: 6px; }
.callout h3 { font-size: 18px; }
.callout p { margin: 0; max-width: 85ch; }

/* questions */
.qbox { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 16px 18px; display: grid; gap: 12px; }
.qbox ol { margin: 0; padding-left: 22px; display: grid; gap: 10px; max-width: 85ch; }
.qbox .qref { font-family: var(--font-mono); font-size: 12px; color: var(--muted); }
.copy { justify-self: start; font: 500 13px var(--font-body); border: 1px solid var(--accent); background: var(--accent); color: var(--surface); padding: 6px 14px; border-radius: 8px; cursor: pointer; }
.copy[data-done="1"] { background: var(--ok-bg); color: var(--ok); border-color: var(--ok); }

.two { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
.panel { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 16px 18px; display: grid; gap: 10px; align-content: start; }
.panel h3 { font-size: 17px; }
.panel ul { margin: 0; padding-left: 18px; display: grid; gap: 7px; }
.panel li { max-width: 80ch; }
.held li::marker { color: var(--ok); }

footer { margin-top: 48px; padding-top: 18px; border-top: 1px solid var(--line); color: var(--muted); font-size: 13px; display: grid; gap: 6px; }

/* lightbox */
.lb { position: fixed; inset: 0; z-index: 50; background: rgba(8, 12, 16, .88); display: grid; grid-template-rows: auto minmax(0, 1fr) auto; padding: calc(env(safe-area-inset-top, 0px) + 12px) max(12px, env(safe-area-inset-right, 0px)) calc(env(safe-area-inset-bottom, 0px) + 12px) max(12px, env(safe-area-inset-left, 0px)); gap: 10px; }
.lb-bar { display: flex; justify-content: space-between; align-items: center; gap: 10px; color: #e8edf2; font-size: 13px; }
.lb-bar .ctr { font-family: var(--font-mono); }
.lb-btn { font: 500 13px var(--font-body); background: rgba(255,255,255,.12); color: #fff; border: 1px solid rgba(255,255,255,.25); border-radius: 8px; padding: 6px 12px; cursor: pointer; }
.lb-stage { display: grid; place-items: center; min-height: 0; overflow: auto; }
.lb-stage img { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 6px; background: #fff; }
.lb-cap { color: #e8edf2; font-size: 14px; max-width: 110ch; margin: 0 auto; text-align: center; }
@media (prefers-reduced-motion: no-preference) { .card { transition: opacity .15s; } }
"""

JS = r"""
(function () {
  // Filters
  const btns = [...document.querySelectorAll('.fbtn')];
  const cards = [...document.querySelectorAll('article.card')];
  const mechs = [...document.querySelectorAll('.mech')];
  function apply(f) {
    btns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.f === f)));
    cards.forEach(c => {
      const show = f === 'all' || (f === 'shots' ? c.dataset.shots === '1' : c.dataset.impact === f);
      c.hidden = !show;
    });
    mechs.forEach(m => { m.hidden = ![...m.querySelectorAll('article.card')].some(c => !c.hidden); });
  }
  btns.forEach(b => b.addEventListener('click', () => apply(b.dataset.f)));

  // Lightbox over every screenshot button on the page, in document order
  const lb = document.getElementById('lb'), img = document.getElementById('lb-img'), cap = document.getElementById('lb-cap'), ctr = document.getElementById('lb-ctr');
  let list = [], idx = 0, opener = null;
  function visibleTriggers() { return [...document.querySelectorAll('[data-lb]')].filter(el => el.offsetParent !== null); }
  function show(i) {
    idx = (i + list.length) % list.length;
    const el = list[idx];
    img.src = el.dataset.lb; img.alt = el.getAttribute('aria-label') || '';
    cap.textContent = el.dataset.cap || '';
    ctr.textContent = (idx + 1) + ' / ' + list.length;
  }
  function open(el) { opener = el; list = visibleTriggers(); lb.hidden = false; document.body.style.overflow = 'hidden'; show(list.indexOf(el)); document.getElementById('lb-close').focus(); }
  function close() { lb.hidden = true; document.body.style.overflow = ''; if (opener) opener.focus(); }
  document.querySelectorAll('[data-lb]').forEach(el => el.addEventListener('click', () => open(el)));
  document.getElementById('lb-close').addEventListener('click', close);
  document.getElementById('lb-prev').addEventListener('click', () => show(idx - 1));
  document.getElementById('lb-next').addEventListener('click', () => show(idx + 1));
  lb.addEventListener('click', e => { if (e.target === lb || e.target.classList.contains('lb-stage')) close(); });
  document.addEventListener('keydown', e => {
    if (lb.hidden) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') show(idx + 1);
    else if (e.key === 'ArrowLeft') show(idx - 1);
  });

  // Copy questions
  const copyBtn = document.getElementById('copyq');
  if (copyBtn) copyBtn.addEventListener('click', () => {
    const text = [...document.querySelectorAll('#qlist li')].map((li, i) => (i + 1) + '. ' + li.dataset.q).join('\n');
    const done = () => { copyBtn.dataset.done = '1'; copyBtn.textContent = 'Copied'; setTimeout(() => { copyBtn.dataset.done = ''; copyBtn.textContent = 'Copy questions'; }, 2000); };
    const fallback = () => { const r = document.createRange(); r.selectNodeContents(document.getElementById('qlist')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); copyBtn.textContent = 'Selected — press ⌘C'; };
    try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
  });
})();
"""

if __name__ == "__main__":
    main()
