# The findings page

Every session ends with a page the engineer can open, skim and forward: an index of the findings,
each finding with its steps, raw evidence and screenshots inline (click to enlarge, arrow keys to
step), the questions for product with a copy button, risks, suite candidates, what held up, a
gallery of every screenshot, and the coverage table. `scripts/findings_page.py` renders it from a
`findings.json` the session writes next to its session file, so every page looks the same and
building one costs a JSON file, not a design pass.

The JSON carries the debrief's content, not new claims: every finding is a BUG row of the log,
every question a QUESTION row, and so on. When the debrief changes (a finding dropped, a bug filed),
edit the JSON and render again.

## Rendering and publishing

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/skills/fleet-explore/scripts/findings_page.py \
  <session dir>/findings.json --out <session dir>/page [--out <scratchpad>/<slug>-page]
```

- Paths in the JSON (screenshots) are relative to the JSON file. Screenshots become WebP under
  `<out>/shots/` (Pillow; copied unconverted without it).
- The script refuses token-shaped strings (`Bearer …`, JWTs, enroll secrets, node keys), unknown
  impacts or mechanisms, duplicate ids and missing screenshot files, and lists every problem at once.
- It prints one JSON line per `--out`: `file_path`, `root` and `files`, the arguments of an
  Artifact publish.
- `<session dir>/page/` is the record; it opens in a browser from disk. The Artifact tool publishes
  only files under the working directory or the scratchpad, so render a second `--out` into the
  scratchpad for publishing when the session folder is elsewhere (it usually is: the QA workspace).

## Schema

Top level (only `title` and `findings` are required; an empty section is left out of the page):

| Key | Type | What it is |
|---|---|---|
| `title` | string | The page's name, two to four words specific to the session: "Fleet Labels Exploration", "Policy Automations Exploration". Not "Findings". |
| `eyebrow` | string[] | Small caps line: session kind and area, build and commit, date and time span |
| `lede` | string | Two or three sentences: what was explored, how many findings, their origin, how they're grouped |
| `banner` | `{title, text}` | Only for a finding that may be security-sensitive: says which one and to keep the page internal until it's routed |
| `index_intro` | string | Line above the index table (default "For each one: file it, mention it, or drop it.") |
| `mechanisms` | object[] | Groups, in page order: `key`, `title`, `short` (index column), `extends` (the theme or area it extends), `summary`. Omit to list findings flat |
| `findings` | object[] | See below |
| `callouts` | `{title, text}`[] | After the findings: a theme the brief missed, a pattern across findings |
| `questions` | `{text, ref}`[] | QUESTION rows; `ref` points at the log row or finding |
| `risks` | `{lead, text}`[] | RISK rows |
| `candidates` | `{when, text}`[] | IDEA rows; `when` is "Now" or "After B" |
| `held_up` | `{heading, items[]}`[] | What held up, in one or two groups |
| `known_issues` | `{issue, text}`[] | Known issues met again, by number |
| `gallery` | screenshot[] | Shots not attached to a finding (held-up evidence, raw viewports, known issues) |
| `gallery_intro` | string | Where the shots were taken and what in them is simulated |
| `coverage` | `[area, status, gap]`[] | The debrief's coverage table |
| `setup` | string | One paragraph: instances, data, simulators |
| `footer` | string[] | Session file path, next charter |

A finding:

| Key | Required | What it is |
|---|---|---|
| `id` | yes | The letter or number used in chat and in the session file's decision list |
| `impact` | yes | `security`, `data-loss`, `wrong-settings`, `wrong-data`, `workflow` or `cosmetic`: drives the colour, the filter and the order of the index |
| `title` | yes | One sentence that states the defect |
| `summary` | yes | What happens and why it matters, in a short paragraph |
| `short` | | A few words for the side index (defaults to the title) |
| `mechanism` | | A `mechanisms[].key` (defaults to the first) |
| `impact_label` | | The impact in words: "Data loss · wrong settings", "Ugly", "500 instead of 4xx" |
| `origin` | | "Released", "This change", "Unreleased (RC only)" |
| `repro` | | "Reproduced 3/3 on default" |
| `filed` | | Issue number once filed ("Filed #55900"): shown as a chip |
| `steps` | | string[]: the reproduction |
| `evidence` | | Blocks, each `{title, pre}` (exact requests, responses, timelines, verbatim), `{title, table: {columns, rows}}` (a cell is a string or `{text, num, bad}`; `bad` marks the wrong value), or `{title, text}` |
| `evidence_kind` | | Word for the index's Evidence column (default "log") |
| `screenshots` | | screenshot[] |
| `where` | | Code locations, `file:line` |

A screenshot: `{file, caption, detail, label, wide}`. `caption` is the short line under the
thumbnail; `detail` is the full caption in the enlarged view (name the build); `label` prefixes the
gallery caption (defaults to the finding's id); `wide` overrides the automatic shape (stacked or
panoramic images show whole, others crop to the top).

Text fields accept `` `code` `` and `**bold**`; everything else is escaped, so names with `<`, `&`
or quotes are safe to paste as they are.

## What goes in, and what doesn't

- Every BUG row, cosmetic ones included, with the same id as the decision list. A finding the user
  dropped stays out; one they filed gets `filed`.
- Evidence is the exact request and response, or the timeline with real timestamps. A `pre` block
  is copied from the log, not paraphrased.
- Screenshots are the ticket-grade ones (boxed, captioned with the build) and the raw shots they
  came from. Re-read every image before it goes in: no tokens, enroll secrets, real customer data or
  someone else's hosts.
- No credentials, ever: the script refuses the obvious shapes, and the rest is on the author.
  Instance URLs are fine on a private page; leave them out if the page may be shared outside Fleet.

A worked example (17 findings, six mechanisms, 14 screenshots) is the labels session of 2026-10-18,
`<QA workspace>/explore/labels/findings.json`; when it's there, it's the fastest template to copy.
