# Evidence screenshots

Shared by every QA skill here and by fleet-bug-file. Read it before the first evidence PNG. A
screenshot the engineer attaches to a public ticket has to show the thing, show nothing secret, and
be one paste per point it makes.

## Capture

- **Evidence files come from `screenshot.mjs`** (headless, signed in with the context's token), or a
  `pw.mjs` driver for a longer click flow. Prefer `--clip <selector>` on the element over `--full`
  (long pages render washed out); `--caret` for caret and focus bugs; `--wait <selector>` when the
  page is mid-transition. The full option list is in the script's header.
- The browser pane's `browser_take_screenshot` saves only under `.playwright-mcp/` in the
  qa-automation checkout, the whole viewport or one element by ref, unannotated. That's a working
  record. Move the files you keep into the run's `screenshots/`.
- **Rendering, hover, focus and scroll** need a headed browser before they count: the in-app browser
  pane, Claude in Chrome, or a `pw.mjs` driver opened with `{ headed: true }` when the pane isn't
  signed in (`instance-traps.md` § Auth). Headless Playwright has no real pointer, fonts or display
  scaling, and has produced both a false "not reproducible" and a false "reproduces".
- Name pairs alike: the same number, then `prefix` or `fixed` (`01-prefix-transfer-modal.png`,
  `01-fixed-transfer-modal.png`). A before/after compares two identical scenarios, the same object,
  input and action on both builds, so only the behaviour differs.

## Read every PNG before it leaves

It must show the thing: not a spinner, a login page or the wrong tab. For a public `fleetdm/fleet`
ticket it must not show secrets or someone's data: enroll secrets in URLs (host and enroll pages have
them), tokens, DPC extras, real user data, another session's hosts. Crop or retake.

## Make it ticket-grade

- **One image per point.** Shots that are read together (before and after, a click and where it
  lands, a fleet against All fleets, two roles on the same page) become one image:
  `stack.py <out.png> <a.png> <b.png> ...` stacks top to bottom, `--side` puts narrow clips side by
  side. Crop each to the same region first, so the stack stays legible and carries nothing unrelated.
  Shots for different rows or findings stay separate.
- **Annotate when it helps a developer find the problem at a glance**: box the wrong state (and, in a
  before/after, the right one in another colour), put a short label beside it, and caption each panel
  with its build. Draw with PIL on the captured PNG and re-read the result: a box that clips the
  neighbouring line points at the wrong thing. Keep the raw shot beside the annotated one.
- A finding's evidence is made **before cleanup**. The data a run built is gone afterwards.

## Send

Send with `SendUserFile` (display `attach`) as each area finishes, one caption line per image naming
its row or finding and the panel order ("top: pre-fix, bottom: fixed"). Where `SendUserFile` isn't
available, list the paths, one per line with the same caption. `gh` can't upload images, so pasting
them into the ticket is the engineer's one manual step: say where each one goes.
