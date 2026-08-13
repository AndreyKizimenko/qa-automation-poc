# Fleet failure-signature catalog

Read this when classifying a specific failure. It records the Fleet-specific
patterns that decide *flaky vs test-bug vs product-defect*, and a worked
example. The core principle it exists to enforce: **the error message tells you
where the assertion gave up, not why the page was in that state.** Always look
at what the page actually rendered (the `error-context` accessibility snapshot,
then the screenshot) before you trust the surface reading of the error.

## The four verdicts

| Verdict | Meaning | Who owns the fix |
|---|---|---|
| `flaky` | Test logic and product are both correct; the failure is non-deterministic (timing, ordering, shared-instance contention). | Test suite — stabilize the wait/isolation. |
| `test-bug` | The product behaved correctly; the test asserted the wrong thing (stale locator, wrong expected value, bad assumption about seed data, missing scope select). | Test suite — fix the assertion/locator. |
| `product-defect` | The test is correct and the product is genuinely wrong or regressed. | Fleet — file a bug. |
| `infra-env` | Neither product logic nor test logic; the environment failed (instance down, auth/secret expired, gitops seed didn't run, network to the QA instance, runner OOM). | Ops / re-run after the environment is healthy. |

A verdict is a hypothesis with a confidence level, not a certainty. Say what
would confirm it (re-run, a source line, a manual repro) when you're not sure.

## Retry pattern is the first discriminator

CI runs with `retries: 2`, so Playwright's own `outcome` is strong evidence:

- **`outcome: flaky`** (failed then passed on retry) → almost always `flaky` or a
  genuine race in the product. Start from the flake hypothesis; only escalate to
  product-defect if the transient failure exposes a real race users would hit.
- **`outcome: unexpected`** with **identical errors across all 3 attempts** →
  deterministic. This is *not* a timing flake, no matter how much the error looks
  like a timeout. A deterministic "element not found after 10s" means the element
  was never going to appear in that state — dig into test-bug vs product-defect.
- **`outcome: unexpected`** with **errors that differ across attempts** (fails at
  different steps, different locators) → suspect environment/contention or a
  cascading earlier failure; look at the first attempt's first error, the rest is
  often noise.

Locally (`retries: 0`) there is no retry signal — a flake looks identical to a
real failure. To separate them, re-run the single test a few times (a scoped
single-test run is fine to just do; see the SKILL's "Re-running locally" section
for what it costs on the shared instance):

```bash
cd playwright && npm run test:premium -- <spec> -g "<test title>" --repeat-each=5 --workers=1
```

Mixed pass/fail across repeats → `flaky`. Uniform failure → real; triage further.

A related use: when many specs fail on the same changed locator or the instance
looks degraded, re-running the *current* local suite for one representative spec
disambiguates fast. If it **passes locally on today's code**, CI ran a stale
snapshot (or hit a transient) — not a live defect. If it **fails the same way
locally**, the problem is live; triage it as product/test/infra.

## Reading the evidence, in order

1. **`error-context` (.md)** — the accessibility snapshot of the page at the
   moment of failure. This is the highest-value artifact: it shows the DOM the
   user's assertion actually saw. A "heading not found" whose snapshot shows a
   fully-rendered page with a *different* heading is a product/data signal, not a
   slow-load flake.
2. **Screenshot (.png)** — `Read` it. Confirms visually what the snapshot says
   (error banners, empty states, wrong tab, paywall, spinner still spinning).
3. **The failing line** — open the page object / spec at the reported line. Is the
   locator what the current Fleet React source emits? Is the expected value
   derived from live data or hardcoded?
4. **Trace (.zip, on first retry only)** — deepest source. Unzip it; `*.network`
   entries show the API calls and their status/response. Use when you need to
   know whether an API returned an error, empty data, or the wrong shape. A 5xx
   on a core request → product-defect or infra; a 200 with empty results where
   the test expected data → seed-data/test-bug or a product query regression.

## Cross-checking against the product

The local Fleet checkout is at `~/repositories/fleet`. Use it to adjudicate:

- **Locator questions** → the React component under `frontend/`. Verify the
  role/label/text/class the test targets is what the source currently emits. A
  renamed heading or restructured component makes a correct-looking test a
  `test-bug`. (The `playwright-test-reviewer` skill catalogs Fleet's legitimate
  class fallbacks — a class-based locator is not automatically wrong.)
- **API shape / behavior** → `docs/REST API/rest-api.md` is authoritative; the
  handler lives under `server/service/`. If the test's API-derived expectation no
  longer matches the documented/implemented response, that's the fault line.
- **Activity-feed assertions** → `server/service/activities/` for the exact verb
  and payload strings.
- **Terminology drift** → Fleet renamed *queries → reports* and *teams → fleets*
  in the UI while the API kept the old names. A test asserting UI text "Query"
  where the product now says "Report" is a `test-bug`; the reverse (API still
  says `team_id`) is expected, not a bug.

Before calling something a product-defect, check the Fleet git log / recent
merged PRs for a matching intentional change — a deliberate UI/label/behavior
change makes it a `test-bug` (the test is stale), not a regression.

## Worked example — the CVE-detail failure

**Error surface:** `expect(getByRole('heading', { name: 'CVE-2026-61898', level: 1
})).toBeVisible()` timed out after 10s at `CveDetailPage.ts:44`. The page-object
comment even says "the page hydrates from an enrichment API that's slow on a cold
cache" — inviting the lazy read *"slow API → flake → bump the timeout."*

**What the evidence actually shows:**
- `outcome: unexpected`, identical error on all 3 attempts (retry 0/1/2), ~19–20s
  each → deterministic, not timing.
- The `error-context` snapshot shows the page fully rendered — nav, the scope
  dropdown, and crucially: `heading "Vulnerability not detected" [level=2]` and
  `paragraph: "No hosts are affected by CVE-2026-61898."`

So the page loaded fine and Fleet actively reported the CVE as affecting no
hosts. Yet the test reached that CVE by asking the API for a *vulnerable* deb
package on a live host and drilling in. That's an internal contradiction: the
software-vuln association said the CVE was present; the CVE-detail "hosts
affected" view said zero.

**Verdict:** `product-defect` (suspected), not flaky, not a locator bug. The
timeout framing is a red herring — bumping the timeout would never help because
the heading was never going to render; Fleet was showing an empty state. What
would confirm it: re-derive the CVE via the API and hit the CVE-detail endpoint
directly to see whether affected-hosts is genuinely 0, and check whether vuln
processing recomputed between the software query and the page load. The bug is
worth filing against Fleet with the snapshot as evidence.

**The lesson generalized:** a timeout on `toBeVisible` is only a flake if the
element was *on its way* to appearing. When the snapshot shows a settled page in
a different state, the timeout is just how the test noticed a real disagreement
about state — triage the disagreement, not the timeout.

## Known-legitimate noise (don't over-report)

- **Skipped tests** are usually intentional: `test.skip(!hostByOS[osKey], ...)`
  fires when the QA instance has no host of that platform enrolled. Note them,
  but a skip is not a failure unless a platform that *should* be present is
  missing.
- **`cleanup-setup` / `cleanup-teardown` / `*-setup` projects** are fixtures. A
  failure *there* is infra-env (bad seed / instance state), and it typically
  cascades into many downstream failures — triage the setup failure first; the
  downstream ones are usually collateral.
- **Slow-but-passing** tests belong in the perf note, not the defect list —
  unless one is trending toward the 60s timeout, which is a flake waiting to
  happen and worth flagging.
