---
name: playwright-test-reviewer
description: Use when reviewing existing Playwright test *code* — specs, page objects, fixtures — for POM, locator, assertion, isolation, or fixture design issues. Triggers on "review this Playwright test", "audit our specs/POMs", "check for brittle selectors", "review my spec". NOT for triaging a test *run*'s results (flake vs bug vs product-defect) — that's playwright-run-reviewer; this skill reads source, not run reports.
---

Review this Playwright test suite as a strict senior automation engineer for a large app that uses POM.

> Scope note: this skill critiques **test code**. If the ask is "why did this run fail / was it a flake or a real bug", that's a run-triage job — use **playwright-run-reviewer**, which reads the run's report and artifacts. The two are complementary: run-reviewer decides *what's wrong*; this skill and playwright-test-author fix the code when the answer is a test-bug.

## Evaluate against

- https://playwright.dev/docs/best-practices
- https://playwright.dev/docs/pom
- https://playwright.dev/docs/locators
- https://playwright.dev/docs/test-assertions
- https://playwright.dev/docs/actionability
- https://playwright.dev/docs/test-fixtures
- https://playwright.dev/docs/auth

## Check for

1. Proper use of page objects.
2. Page objects that are too large or too low-level.
3. Missed opportunities for component objects.
4. Brittle selectors (long CSS chains, xpath, nth-child, implementation-detail selectors).
5. Locators that aren't grounded in the actual React component (`frontend/` in this repo, or `~/repositories/fleet/frontend/`) — verify the chosen role/text/class is what the source emits, not just what the rendered DOM shows. Use the Playwright MCP and `docs/REST API/rest-api.md` to cross-check.
6. Unnecessary waits (`waitForTimeout`, arbitrary sleeps).
7. Missing web-first assertions.
8. Poor test isolation (tests depending on order or shared mutable state). Exception: CRUD lifecycle specs (see `playwright/CLAUDE.md`) intentionally use `test.describe.configure({ mode: 'serial' })` with closure-shared identifiers across sub-tests — flag only if a non-CRUD spec does this.
9. Duplicated setup or login logic that should be a fixture or storage state.
10. Abstractions that make tests harder to read.
11. Places where Fleet-like repeated admin flows (team switching, table filter/sort, modal confirmation, policy/software/report actions) should be extracted into shared helpers.
12. Real-VM hygiene. The VMs fleet's durable software (`helpers/vm-fixtures.ts`, declared in `gitops/premium-fleetqa/fleets/vms.yml`) must be left **uninstalled** and never deleted, re-scoped, re-scripted or re-versioned — a test that changes a title needs a per-run `fleet-pw-*` package. Anything a timed-out test would leave behind (a title, a label, a profile, host state) needs a home in `setup/cleanup.steps.ts` — the VMs sweep or the resting-state step — because Playwright skips the `finally` on a timeout.
13. Host waits. Flag a wait on `software_updated_at` (it moves only when the inventory changes), a refetch requested without first waiting out an outstanding one (`waitForNoPendingRefetch`), and a VM wait whose budget can outlast the test's timeout.
14. Docs that should have moved with the code: a new or changed `test()` with no `docs/test-audit/` entry, a batch or test-plan file whose "What landed" doesn't list the spec, a new helper or page object missing from `helpers/README.md` / `pages/README.md`, a skip owed to a Fleet bug without its `docs/blocked-by-product-bugs.md` row. Report these as findings, not blockers.

## Always flag as a blocker

Three classes of finding are not style opinions — stop and call them out before anything else:

1. **A configuration profile deployed to a real host that gates access to it.** Any passcode payload
   (`com.apple.mobiledevice.passwordpolicy`, `forcePIN`, `minLength`, `maxInactivity`, `allowSimple`), screen
   lock, inactivity timeout, FileVault, login-window restriction, or anything disabling SSH / remote
   management / the MDM channel. There are only a few real VMs per tier and no re-provisioning automation, so
   this permanently blocks access and ends every other real-host spec until the machine is rebuilt by hand.
   **Any upload counts as deploying**, including a lifecycle spec that deletes the profile a step later: on free,
   Unassigned holds the real VMs, and Fleet's profile reconciler (every 30 s) delivers whatever it finds. Flag any committed profile fixture that
   isn't inert (the suite's are `test-data/{apple/macos,windows}/profiles/fleet-pw-inert.*`), wherever it's used.
2. **An assertion against a simulated host that only a real host can answer.** Software inventory, script
   output, profile delivery, certificates and agent versions all need `kind: 'real'`; osquery-perf simulations
   ignore live-query SQL, return no rows ~20% of runs and never install anything, so the test passes without
   testing anything. (What Fleet decides server-side — which hosts a profile is listed for, which are offered
   software — a simulation answers correctly; don't flag that.)
3. **A setting on the VMs fleet that updates, reboots or locks its real hosts.** An OS-update minimum version or
   deadline, a DDM software-update enforcement declaration, or Recovery Lock password enforcement makes the
   real VMs download an OS update, reboot mid-suite, or take a password on recovery. Those settings belong on a
   fleet with no real hosts (Workstations), restored in the same test.

## Output format

- **Problems found** — concise list, each tied to one of the checks above.
- **Refactored code** — show the improved version of any block you call out.
- **Why each change improves maintainability or reduces flakiness** — short rationale per change, tied to a Playwright best practice.
- **Suggested folder structure** — only if relevant to the issues found.

## Class fallbacks that are legitimate today

Do not flag the following class-based locators as bugs — they are deliberate fallbacks for Fleet React components that expose no role, label, text, or testid. Each one already has an inline comment in the code:

- **Modal containers** — Fleet's `Modal` (`frontend/components/Modal/Modal.tsx`) renders the title in a `<span>` with no `role="dialog"`. Specs target either a dedicated modal class (e.g. `.delete-bootstrap-package-modal`, `.script-upload-modal`) or `.modal__modal_container` filtered by visible title text.
- **react-select v5 triggers** — `TeamDropdown`, `LabelFilter`, and `StatusFilter` components target `.team-dropdown__control`, `.label-filter-select__control`, and `.manage-hosts__status-filter .react-select__control`. The visible click target is a role-less `<div>` and the accessible `<input role="combobox">` is hidden. Options use `data-testid="dropdown-option"` (Fleet's `DropdownWrapper` emits it) — flag if options aren't using the testid.
- **react-select v1** in `PackEditPage` — `.Select-placeholder`, `.Select-input input`, `.Select-menu`, `.target-option__*`. These come from the library's own CSS, not Fleet's; they go away when the picker migrates.
- **Section / card wrappers** — `.bootstrap-package`, `.run-script`, `.script-library`, `.host-activity-card` — Fleet's `<section>` and `<Card>` components have no role. The H2 heading in each section is the canonical ready-state anchor; the wrapper class is kept for nested-query scoping.
- **List items / cards** — `.bootstrap-package-list-item`, `.script-list-item`, `.setup-experience-script-card`, `.software-installer-card`. Fleet's `ListItem` and `Card` render as role-less `<div>`s.
- **Empty / loading states** — `.empty-state`, `.loading-overlay`. Role-less.
- **Truncated table cells** — `.data-table__tooltip-truncated-text` on `TooltipTruncatedTextCell`. Role-less span.

What to *still* flag: brittle CSS chains (`.foo .bar:nth-child(3) > div`), xpath, implementation-detail selectors, raw class fallbacks not in the list above without an inline comment, role-bearing alternatives that the spec ignored, and any class-targeting where a heading / button / role / text-based locator would have worked.

## Comment style in any code you produce

When writing or rewriting comments, describe what the code is *doing*. Never describe what changed, what was fixed, or what differs from the prior version. The reader has not seen the old code.
