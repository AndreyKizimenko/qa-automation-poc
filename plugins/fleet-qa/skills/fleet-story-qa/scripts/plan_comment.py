#!/usr/bin/env python3
"""Build a story's sign-off comment from the ticket's own test plan.

  plan_comment.py --list <body.md>                     number the plan's checkbox rows
  plan_comment.py <body.md> <results.json> <out.md>    write the comment

<body.md> is the issue body (`gh issue view <N> -R fleetdm/fleet --json body --jq .body`).
Rows come from the "### Test plan" section, minus "#### Setup" and any subsection without
checkbox rows; row text, order and sub-bullets are kept as written.

results.json:
  {"verdict": "QA **Pass** on `<branch>` (<sha>), <one line of scope>.",
   "rows": [["pass", ""], ["pass", "short note"], ["fail", "#123"], ["wait", "#456 still open"],
            ["skip", "why it didn't run"]],
   "issues": [["#123", "This story (unreleased)", "High: ..."]]}
One "rows" entry per checkbox row, in --list order.
"""
import json
import re
import sys


def plan_sections(body):
    text = body.replace('\r', '')
    m = re.search(r'^### Test plan\s*$', text, re.M)
    if not m:
        sys.exit('no "### Test plan" section in the body')
    rest = text[m.end():]
    nxt = re.search(r'^### ', rest, re.M)
    plan = rest[:nxt.start()] if nxt else rest
    plan = re.sub(r'<!--.*?-->', '', plan, flags=re.S)
    sections = []
    for part in re.split(r'^(?=#### )', plan, flags=re.M):
        if not part.startswith('#### '):
            continue
        heading, _, content = part.partition('\n')
        if heading.strip().lower() == '#### setup':
            continue
        lines = content.rstrip().split('\n')
        if any(l.startswith('- [ ] ') or l.startswith('- [x] ') for l in lines):
            sections.append((heading.strip(), lines))
    return sections


def rows_of(sections):
    for heading, lines in sections:
        for line in lines:
            if line.startswith('- [ ] ') or line.startswith('- [x] '):
                yield heading, line[6:]


def build(sections, results):
    rows = results['rows']
    total = sum(1 for _ in rows_of(sections))
    if len(rows) != total:
        sys.exit(f'{len(rows)} results for {total} checkbox rows')
    out, i = [], 0
    for heading, lines in sections:
        out += ['', heading]
        for line in lines:
            if line.startswith('- [ ] ') or line.startswith('- [x] '):
                status, note = rows[i]
                i += 1
                row = line[6:]
                if status == 'pass':
                    line = f'- [x] {row}' + (f' _{note}_' if note else '')
                elif status == 'fail':
                    line = f'- [ ] {row} **❌ {note}**'
                elif status == 'wait':
                    line = f'- [ ] {row} **⏳ {note}**'
                elif status == 'skip':
                    line = f'- [ ] {row} **Not run:** {note}'
                else:
                    sys.exit(f'row {i}: unknown status {status!r}')
            out.append(line)
    md = results['verdict'].strip() + '\n' + '\n'.join(out).rstrip() + '\n'
    if results.get('issues'):
        md += '\n**Issues found**\n| Issue | Origin | Severity |\n|---|---|---|\n'
        md += ''.join(f'| {a} | {b} | {c} |\n' for a, b, c in results['issues'])
    return md


def main(argv):
    if len(argv) == 3 and argv[1] == '--list':
        for n, (heading, row) in enumerate(rows_of(plan_sections(open(argv[2]).read())), 1):
            print(f'{n:3}. [{heading[5:]}] {row[:110]}')
        return
    if len(argv) != 4:
        sys.exit(__doc__)
    body, results, out = argv[1:]
    md = build(plan_sections(open(body).read()), json.load(open(results)))
    open(out, 'w').write(md)
    print(f'wrote {out}')


if __name__ == '__main__':
    main(sys.argv)
