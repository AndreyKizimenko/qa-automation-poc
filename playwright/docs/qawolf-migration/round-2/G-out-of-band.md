# Batch G — Out-of-band

**14 source flows → 7 specs.** `Policy automations and retries` · `gitops mode`

Read [README.md](README.md) first for the standing rules and how a batch runs. Source flows live in
`qa-wolf/Fleet_20260828 (1)/{Free,Premium}/src/tests/<path>` — the paths below are relative to that.

---

Two clusters that share one property: **neither belongs in the nightly run.** Both need their own Playwright
project, and gitops mode must be the very last thing that runs.

They are grouped because scheduling them is the same problem, not because the tests are alike.

## Policy automations and retries

*9 source flows → 5 specs.*

A failing policy triggers a script or an install; Fleet retries up to three times, or hourly for continuous
automations. Asserting this means waiting through real retry intervals — the hourly flow asserts gaps between
30 and 90 minutes.

**These do not belong in the nightly.** Give them their own project and schedule, the way `tests/loadtest/`
is scoped, and say so in every spec header.

**The precondition is already written down.** `util/createFailingPolicyThatRetriesEveryHour` (cut in triage,
group B) carries the reliably-failing SQL, the `continuous-automations-enabled` toggle and the exact activity
string. Read it before building.

**Assert attempt counts, not screenshots.** `expect(upcomingTimestamps.size).toEqual(3)` is the right idea and
one of the few QA Wolf assertions worth keeping close to as-is.

**POM work:** `PolicyEditPage` — automations panel (run_script / install_software / continuous toggles);
`HostDetailsPage` — upcoming-vs-past activity filtering by script name.

| Target spec | Kind | Source flows folded in |
|---|---|---|
| `tests/e2e/premium/policies/automation-retries.spec.ts` | **new** | `activity-feed/individual-activity-items-for-all-attempts-for-failed-software-scripts`<br>`policies/enabling-continuous-software-and-script-automations-on-a-policy-retries-every-hour`<br>`policies/script-run-retries-up-to-3-times-when-triggered-by-a-policy-automation`<br>`policies/software-installs-retry-up-to-3-times-when-triggered-by-a-policy-automation` |
| `tests/e2e/premium/policies/automation-run-script.spec.ts` | **new** | `fleet-maintained-filters/failing-policies/confirm-script-ran-in-ui-on-failing-host-policy`<br>`python/run-python-script-with-policy-automation-on-macos-host` |
| `tests/e2e/premium/policies/policies.spec.ts` | augment · check DUP | `policies/global-admin-able-to-create-and-delete-an-os-specific-policy-premium` |
| `tests/e2e/premium/policies/policy-automations.spec.ts` | augment | `policies/manage-all-automations-for-a-given-policy-at-once` |
| `tests/e2e/premium/policies/patch-policy.spec.ts` | **new** | `policies/patch-policy-fleet-maintained-apps` |

## gitops mode

*5 source flows → 2 specs.*

Runs only after every other batch is green. Its own Playwright project, one worker, with a teardown that
disables gitops mode whatever happened — an aborted run that leaves it on disables the next run's entire suite.

```ts
{
  name: 'gitops-mode',
  testDir: './tests/e2e/premium/gitops-mode',
  workers: 1,
  dependencies: ['premium'],
  teardown: 'gitops-mode-teardown',
}
```

**The five source flows are the floor, not the ceiling.** Gating is one component,
`GitOpsModeTooltipWrapper`, driven by `hooks/useGitOpsMode` — and **93 frontend files render it** across ten
areas we already have page objects for. QA Wolf covered three of those areas at surface level.

**The untested axis is exceptions.** `config.gitops.exceptions = { labels, software, secrets }`; when an
entity is excepted, gitops mode is treated as *disabled* for it, at 23 call sites. QA Wolf asserts none of
them. A change that stops honouring `exceptions.software` locks customers out of software management while
gitops mode is on, and nothing today would catch it.

**Over-gating matters as much as under-gating.** "Add hosts" must stay *enabled* in gitops mode — enrolling a
host is not a config change. Their own settings flow asserts this; keep it.

Full scope and the breadth-vs-depth question: [DECISIONS §5](DECISIONS.md#5-gitops-mode-scope).

**POM work:** new `helpers/api/gitops-mode.ts` to flip the flag and its exceptions; a shared assertion helper
for "control is disabled and shows the gitops tooltip".

| Target spec | Kind | Source flows folded in |
|---|---|---|
| `tests/e2e/premium/gitops-mode/navbar-and-links.spec.ts` | **new** | `gitops/gitops-gitops-mode-in-navbar-and-learn-more-url`<br>`gitops/gitops-mode-yaml-links-lead-to-repository-url` |
| `tests/e2e/premium/gitops-mode/gated-surface.spec.ts` | **new** | `gitops/gitops-mode-gated-areas-of-the-ui-controls`<br>`gitops/gitops-mode-gated-areas-of-the-ui-hosts`<br>`gitops/gitops-mode-gated-areas-of-the-ui-settings` |

**V1 shipped (2026-09-27).** Four specs rather than two, because the design in
[GITOPS-PLAN.md](GITOPS-PLAN.md) found that the right unit is one control per *gating pattern*, not per area:
`01-indicator-and-links` (the two source flows in the table above), `02-gated-surfaces` (all four disabled signatures plus
the over-gating half and the Change-management escape hatch), `03-exceptions` (the `labels` and `secrets`
axes), and `zz-everything-is-back`. Plus a free-tier premium-gate spec, which the plan had ruled out — the
paywall on Change management is assertable as *replacing* the form, not merely sitting above it.

**Parked for V2, deliberately:**

- **The `software` exception.** Both surfaces the plan probed are blocked by product bugs (setup-experience
  Install-software is unsavable while excepted; the Software-title Library accordion needs a seeded installer),
  and the one zero-seed surface that *does* honour it — the Fleet-maintained app details form — needs an API
  resolver for an app not yet added to the fleet. Encoding the broken behaviour as a passing assertion was
  rejected: a test that is green *because* the product is broken inverts the meaning of green.
- **Controls › Variables' split gating** (`Add variable` disabled, `Delete <name>` enabled) — the single best
  over-gating detector in the plan, but it needs a seeded variable and there is no create helper yet.
- **The Change-management UI write flow** (tick an exception, Save, assert the toast and the activity copy).
  V1 asserts the card is fully interactive; it drives the flag over the API.
- **Policies, Reports, Software-title details and Controls › OS settings** gated surfaces — same patterns as
  the five areas V1 covers, so they add breadth rather than signal.

Three product bugs came out of the design work; see
[`../../blocked-by-product-bugs.md`](../../blocked-by-product-bugs.md) for the two the suite already bends
around, and GITOPS-PLAN §8 for all three.

---

## Done when

- every target spec above exists and is green on each tier it targets;
- `npm run check` is clean;
- each spec ran at least once headed and at least once **with** dependencies (no `--no-deps`);
- anything timing-sensitive survived `--repeat-each=5`;
- a line per shipped slice is appended to [DELIVERY-LOG.md](../DELIVERY-LOG.md);
- anything parked has a row in [`../blocked-by-product-bugs.md`](../../blocked-by-product-bugs.md)
  or a reasoned note in this file — never a silent skip.
