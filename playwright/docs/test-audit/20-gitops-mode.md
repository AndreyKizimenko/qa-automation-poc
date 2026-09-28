# GitOps mode — test audit

**Specs covered:** 5 files · **Entries:** 21 · **Test declarations:** 21 (1 skipped) · **Projects:** gitops-mode (19), free (2)

GitOps mode is Fleet's "the YAML is the source of truth" lock: with
`config.gitops.gitops_mode_enabled = true`, every control that would change
configuration through the UI renders disabled and carries a **Manage in YAML**
tooltip pointing at the customer's own repository. This area is the suite's
coverage of that lock — that it engages, that it engages *only* where it should,
that three named entities can be exempted from it, and that it comes back off.

**This area is unlike every other one in the audit, in five ways.** Read all of
them before running anything.

**1. It is its own Playwright project.** The four premium specs live in
`tests/e2e/premium/gitops-mode/`, which the `premium` project explicitly ignores
(`testIgnore: '**/gitops-mode/**'`). They run in a dedicated `gitops-mode`
project pinned to `workers: 1`, `fullyParallel: false` and `retries: 0`, with
`dependencies: ['premium']` — i.e. it runs *after* the entire premium suite has
finished — plus a `gitops-mode-teardown` project ([playwright.config.ts:180](../../playwright.config.ts#L180)).
The fifth spec, `free/settings/gitops-mode.spec.ts`, is not in that folder and
runs in the ordinary **free** project; it is the premium-gate check and needs no
special handling.

**2. Enabling gitops mode is a global config write.** `PATCH /api/v1/fleet/config`
with `{"gitops": {...}}` disables the Add / Save / Delete controls that every
other mutating spec in the suite depends on. That is the whole reason this area
cannot share a run with anything else — not test hygiene, not speed. The lock is
**UI-only**: the API keeps accepting writes from anyone whose role allows them,
which is why a stuck flag does not self-correct — the instance keeps answering
while the next run's browser specs fail en masse.

**3. The teardown matters more than the tests.** A run that ends with gitops mode
still on disables the *next* run's entire suite, and it fails in a way that looks
like hundreds of unrelated UI regressions. There are deliberately two lifecycles:

- the **`gitops-mode-teardown`** project ([setup/gitops-mode.teardown.ts](../../setup/gitops-mode.teardown.ts)) —
  runs whatever the project's result was, calls `disableGitOpsMode` and then
  re-reads `GET /config` to assert the flag really is off. Survives a failing
  run, a `SIGINT` (Ctrl-C), and an assertion explosion.
- a **`disableGitOpsMode(request)`** call at the top of
  [`setup/cleanup.steps.ts`](../../setup/cleanup.steps.ts#L51) — the `cleanup-setup`
  dependency of both `premium` and `free`. This is the one that recovers from a
  `SIGKILL`, a lost machine or a config that threw, where the teardown project
  never runs at all. It no-ops when the flag is already off, which is every run
  on free.

Both were verified during the design work; see [GITOPS-PLAN §9.2](../qawolf-migration/round-2/GITOPS-PLAN.md).
Neither touches `repository_url` or the exceptions, on purpose — the URL is
itself part of the gate for three surfaces, so blanking it would quietly change
the instance's configuration.

**4. "Disabled" has four distinct DOM signatures**, because
`GitOpsModeTooltipWrapper` hands its child a `disableChildren` flag and lets the
child decide what that means:

| # | Pattern | DOM | `toBeDisabled()` | Seen in |
|---|---|---|---|---|
| A | native control inside the wrapper | `button[disabled]` / `input[disabled]` | works | GITOPS-03, 04, 07, 08, 10 |
| B | Fleet `Checkbox` | hidden `input[disabled]` + `div[role=checkbox][aria-disabled=true]` | works (Playwright reads `aria-disabled` for the `checkbox` role) | GITOPS-05 |
| C | react-select | `div.actions-dropdown-select--is-disabled` — **no** `aria-disabled`, no accessible name, only a class | **does not work** | GITOPS-06 |
| D | raw `disabled`, no wrapper, no tooltip | `input[disabled]` / `button[disabled]` | works, but there is no tip to assert | GITOPS-04 (org name), GITOPS-06 (Add fleet — has a tip, from a *plain* `TooltipWrapper`) |

The one reliable invariant across all four is the marker span:
**`.gitops-mode-tooltip-wrapper` is in the DOM if and only if gitops mode is
effectively enabled for that control, exceptions included.** Every assertion in
[`pages/components/gitopsMode.ts`](../../pages/components/gitopsMode.ts) is built
on that, and `gitopsWrappers(page).toHaveCount(0)` is the cheapest whole-page
probe in the suite.

**5. Over-gating is a bug too.** "Add hosts" on a fleet's settings page must stay
*enabled* under gitops mode — enrolling a host is not a config change. Several
assertions here exist to catch over-gating rather than under-gating:
GITOPS-05 (SMTP `Domain` + `Save` on Advanced options), GITOPS-07 (**Add hosts**),
GITOPS-08 (**Copy to clipboard** / **Show secret** / **Done**) and GITOPS-09
(the whole Change-management card). GITOPS-09 is the most important assertion in
the area: gate anything on that card and gitops mode becomes a one-way door with
no supported way back out through the UI.

**The exception axis.** `config.gitops.exceptions = { labels, software, secrets }`.
When an entity is excepted, gitops mode is treated as **disabled** for it — the
naming is inverted relative to the UI ("Exceptions: ☑ Labels" means labels are
*not* gitops-managed), and reading it backwards makes every test in
`03-exceptions` pass for the wrong reason. An excepted entity renders exactly
like the mode being off: no wrapper, no tooltip, control live. Only `labels` and
`secrets` are covered; `software` is parked (see *Area observations*).

---

## ⚠️ Safety note for a manual re-runner

**If you interrupt a run — or a flow — while gitops mode is on, the instance
stays locked.** Most UI editing on that instance stops working until you clear
the flag: every Add / Save / Delete in Controls, Settings, Labels, Policies,
Reports and the enroll-secret modal renders disabled, for every user. Nothing
clears it automatically outside a Playwright run.

Turn it back off by hand:

```bash
curl -sk -X PATCH "$FLEET_URL/api/v1/fleet/config" \
  -H "Authorization: Bearer $FLEET_API_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"gitops":{"gitops_mode_enabled":false}}'
```

Or, through the UI (this page is never gated — that is what GITOPS-09 defends):
**Settings › Integrations › Change management** → untick **GitOps mode** → **Save**.

Confirm with `GET /api/v1/fleet/config` → `.gitops.gitops_mode_enabled === false`.

Two cautions on the manual write:

- `PATCH /config` merges at the top level but **replaces `gitops` wholesale**, so
  the one-liner above also blanks `repository_url` and resets the exceptions.
  That is *not* what the suite's `disableGitOpsMode` does. To flip only the flag,
  read the current subtree first and send it back with `gitops_mode_enabled`
  false — `repository_url` is part of the gate for the Fleets dropdown, the
  Fleets page and the command palette, so an accidentally blank URL produces a
  *different* gating set rather than an unlocked instance.
- Running `npm run test:premium` (or `test:free`) also clears the flag as its
  first act, via `cleanup-setup`. That is the lazy recovery path if you would
  rather not curl.

---

## Contents

| ID | Spec | Test | Mode | Manual? |
|---|---|---|---|---|
| GITOPS-01 | `premium/gitops-mode/01-indicator-and-links.spec.ts` | with gitops mode off, nothing on the dashboard is marked or gated | UI | ☐ |
| GITOPS-02 | `premium/gitops-mode/01-indicator-and-links.spec.ts` | the navbar indicator links to Change management and to the docs | UI | ☐ |
| GITOPS-03 | `premium/gitops-mode/01-indicator-and-links.spec.ts` | a gated control's tooltip links to the configured repository | UI+API | ☐ |
| GITOPS-04 | `premium/gitops-mode/02-gated-surfaces.spec.ts` | Organization info — Save is gated and the org name is locked | UI | ☐ |
| GITOPS-05 | `premium/gitops-mode/02-gated-surfaces.spec.ts` | Advanced options — host expiry is gated, SMTP and Save stay editable | UI | ☐ |
| GITOPS-06 | `premium/gitops-mode/02-gated-surfaces.spec.ts` | Fleets list — Add fleet and the row actions are gated | UI | ☐ |
| GITOPS-07 | `premium/gitops-mode/02-gated-surfaces.spec.ts` | Fleet settings — management actions are gated, Add hosts stays enabled | UI | ☐ |
| GITOPS-08 | `premium/gitops-mode/02-gated-surfaces.spec.ts` | Enroll secrets stay readable but not editable | UI | ☐ |
| GITOPS-09 | `premium/gitops-mode/02-gated-surfaces.spec.ts` | Change management stays fully editable — the way back out | UI | ☐ |
| GITOPS-10 | `premium/gitops-mode/03-exceptions.spec.ts` | labels — the new-label form is gated while labels are managed in YAML | UI | ☐ |
| GITOPS-11 | `premium/gitops-mode/03-exceptions.spec.ts` | labels — the exception unlocks the new-label form | UI | ☐ |
| GITOPS-12 | `premium/gitops-mode/03-exceptions.spec.ts` | enroll secrets — the exception unlocks the enroll-secret modal | UI | ☐ |
| GITOPS-13 | `premium/gitops-mode/03-exceptions.spec.ts` | enroll secrets — the exception reaches the fleet settings entry point — **skipped** (fleetdm/fleet#48218) | UI | ☐ |
| GITOPS-14 | `premium/gitops-mode/zz-everything-is-back.spec.ts` | the config says gitops mode is off | API | ☐ |
| GITOPS-15 | `premium/gitops-mode/zz-everything-is-back.spec.ts` | the navbar marker is gone | UI | ☐ |
| GITOPS-16 | `premium/gitops-mode/zz-everything-is-back.spec.ts` | Controls — Add script is editable again | UI | ☐ |
| GITOPS-17 | `premium/gitops-mode/zz-everything-is-back.spec.ts` | Advanced options — the host-expiry checkbox is editable again | UI | ☐ |
| GITOPS-18 | `premium/gitops-mode/zz-everything-is-back.spec.ts` | Fleets — Add fleet and the row actions are editable again | UI | ☐ |
| GITOPS-19 | `premium/gitops-mode/zz-everything-is-back.spec.ts` | Change management agrees with the API and is still the way out | UI+API | ☐ |
| GITOPS-20 | `free/settings/gitops-mode.spec.ts` | Change management offers no gitops controls | UI | ☐ |
| GITOPS-21 | `free/settings/gitops-mode.spec.ts` | no gitops marker or gated control anywhere on the core pages | UI | ☐ |

`Mode` is one of: **UI** (all validation through the browser), **UI+API** (browser flow,
some assertions via API), **API** (no meaningful UI validation), **PERF** (timing).

### Running these

The premium nineteen need `--project=gitops-mode`, not `--project=premium` —
the premium project does not see the folder at all:

```bash
npm run test:gitops-mode:only -- -g "<title>"   # --no-deps, for local iteration
npm run test:gitops-mode                        # full chain: runs the whole premium suite first
npm run test:gitops-mode:headed -- -g "<title>" # watch it
```

`test:gitops-mode:only` passes `--no-deps`, which skips `premium-setup` and
`cleanup-setup`. That is what you want while iterating, but it also skips the
belt-and-braces `disableGitOpsMode` — so a `:only` run that you kill mid-flow
leaves the flag set. The free two run in the ordinary free project:
`npm run test:free -- -g "Free • gitops mode"`.

---

### GITOPS-01 · Premium • gitops mode — indicator and YAML links › with gitops mode off, nothing on the dashboard is marked or gated

- **File:** [`playwright/tests/e2e/premium/gitops-mode/01-indicator-and-links.spec.ts`](../../tests/e2e/premium/gitops-mode/01-indicator-and-links.spec.ts)
- **Grep:** `npm run test:gitops-mode:only -- -g "with gitops mode off, nothing on the dashboard is marked or gated"`
- **Project:** gitops-mode · **Scopes:** none (global config; the dashboard is loaded unscoped)
- **Mode:** UI · **Isolation:** serial describe, step 1 of 3. The describe's `beforeAll` snapshots the whole `config.gitops` subtree via `withGitOpsMode(request, { gitops_mode_enabled: false })` and keeps the restorer; `afterAll` calls it. Snapshotting the subtree rather than flipping the flag is deliberate — the instance's own exception set is part of its configuration and must come back as found.
- **Preconditions:** premium license; `FLEET_API_TOKEN` admin; nothing else — this test *creates* its own precondition by writing the flag off.
- **Data created:** none. Mutates `config.gitops`, restored in `afterAll`.

**Flow**

1. ☐ (No user action) `PATCH /config` sets `gitops.gitops_mode_enabled = false`, keeping `repository_url` and the exceptions as found.
2. ☐ Open the dashboard (via URL `/dashboard`).
   - ✅ *(UI)* First dashboard card is visible — `DashboardPage.goto()`.
3. ☐ Look at the navbar and at the page as a whole.
   - ✅ *(UI)* No navbar link named **GitOps mode** (`toHaveCount(0)`) — `Navbar.gitopsIndicator`, scoped inside the `nav` element.
   - ✅ *(UI)* Zero `.gitops-mode-tooltip-wrapper` spans anywhere on the page — `gitopsWrappers(page)`.

**Assessment**
- *Value:* the negative baseline for GITOPS-02/03 — proves the indicator and the wrapper are genuinely conditional rather than always-present-but-hidden, which is what makes every later `toHaveCount(0)` in this area meaningful.
- *Coverage gaps:* the page chosen is the dashboard, which is exactly where nothing is ever gated. Nothing here asserts that an actually-gatable control (Add script, Save, Add fleet) is live with the mode off — that baseline exists only in the `zz-` spec, at the other end of the run.
- *Redundancy:* structurally identical to GITOPS-15, which asserts the same two things on the same page. GITOPS-15 earns its place (it verifies the teardown); this one is the "before" half of a before/after pair whose "after" is 15 tests away.
- *Efficiency / smells:*
  - **Weak assertion:** the dashboard renders **zero** gitops wrappers even with the mode *on* (verified live, [GITOPS-PLAN §4](../qawolf-migration/round-2/GITOPS-PLAN.md)) — "Manage automations" and "Configure chart filters" stay enabled and the gating lives inside their modals. So `gitopsWrappers(page).toHaveCount(0)` here passes in **both** states and proves nothing. The navbar half is the only load-bearing assertion in the test.
  - Costs a full config write + a dashboard load to assert the absence of one link.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GITOPS-02 · Premium • gitops mode — indicator and YAML links › the navbar indicator links to Change management and to the docs

- **File:** [`playwright/tests/e2e/premium/gitops-mode/01-indicator-and-links.spec.ts`](../../tests/e2e/premium/gitops-mode/01-indicator-and-links.spec.ts)
- **Grep:** `npm run test:gitops-mode:only -- -g "the navbar indicator links to Change management and to the docs"`
- **Project:** gitops-mode · **Scopes:** none
- **Mode:** UI · **Isolation:** serial describe, step 2 of 3 — turns the mode **on** and leaves it on for step 3; restored by the describe's `afterAll`
- **Preconditions:** logged in as a **global admin** (the suite's stored `.auth/premium-admin.json`). The indicator degrades to plain text with no link for every other role, so this test is admin-only by construction.
- **Data created:** none. Leaves `gitops_mode_enabled = true` for the next test in the describe.

**Flow**

1. ☐ (No user action) `enableGitOpsMode(request)` — `PATCH /config` with `gitops_mode_enabled: true`, `repository_url` left as the instance has it, and **all three exceptions forced off** (defaulting to all-off rather than to whatever the instance carries is what stops a test passing because a previous one left an exception on).
2. ☐ Open the dashboard (via URL `/dashboard`).
   - ✅ *(UI)* First dashboard card visible.
3. ☐ Look at the navbar.
   - ✅ *(UI)* A link named **GitOps mode** is visible.
   - ✅ *(UI)* Its `href` is exactly `/settings/integrations/change-management` — i.e. the badge is the signposted way back out.
4. ☐ Hover the **GitOps mode** badge.
   - ✅ *(UI)* A `role="tooltip"` containing **"Items managed in YAML are read-only."** is visible.
   - ✅ *(UI)* Inside that tooltip, a link named **Learn more** whose `href` is `https://fleetdm.com/learn-more-about/ui-gitops-mode`.

**Assessment**
- *Value:* pins the global "you are in gitops mode" signal and, crucially, the fact that the badge's link is the **product docs** URL and not `repository_url`. Those are two different links in two different tooltips, and conflating them is the mistake this test and GITOPS-03 exist to keep apart.
- *Coverage gaps:* the indicator is only checked on the dashboard — nothing confirms it persists across navigation, which is the whole point of a navbar badge. The non-admin degradation (plain text, no link) is not covered anywhere, and is exactly the kind of thing that breaks silently. No assertion on `target="_blank"` even though the link opens a new tab.
- *Redundancy:* the negative of this assertion is made twice (GITOPS-01 and GITOPS-15).
- *Efficiency / smells:*
  - The tooltip locator is built inline in the spec (`page.getByRole('tooltip').filter({ hasText: … })`) rather than in `Navbar` or in `pages/components/gitopsMode.ts`, where the sibling helper `expectGitOpsTooltip` already lives. The badge's tip is the one gitops tooltip with no helper.
  - Unlike `expectGitOpsTooltip`, this inline version does not assert the tooltip is absent *before* hovering and does not park the pointer afterwards — so a leftover tooltip from an earlier interaction would satisfy it.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GITOPS-03 · Premium • gitops mode — indicator and YAML links › a gated control's tooltip links to the configured repository

- **File:** [`playwright/tests/e2e/premium/gitops-mode/01-indicator-and-links.spec.ts`](../../tests/e2e/premium/gitops-mode/01-indicator-and-links.spec.ts)
- **Grep:** `npm run test:gitops-mode:only -- -g "a gated control's tooltip links to the configured repository"`
- **Project:** gitops-mode · **Scope:** Unassigned (`fleetId: 0` on the scripts library)
- **Mode:** UI+API · **Isolation:** serial describe, step 3 of 3
- **Preconditions:** the instance has a non-empty `config.gitops.repository_url` — asserted, with the message *"the instance has no gitops repository_url configured"*. Without it the tooltip helper's `new URL('')` would throw a `TypeError` instead of failing an assertion.
- **Data created:** none

**Flow**

1. ☐ (No user action) `enableGitOpsMode(request)` again (idempotent), and read back `repository_url`.
   - ✅ *(API)* `repository_url` is not the empty string.
2. ☐ Open `/controls/scripts/library?fleet_id=0` via URL.
   - ✅ *(UI)* The Scripts heading is visible — `ScriptsLibraryPage.goto({ fleetId: 0 })`.
3. ☐ Look at the **Add script** button and hover its wrapper — `expectGatedByGitOps(addScriptButton, repoUrl)`, pattern **A**:
   - ✅ *(UI)* Exactly one `.gitops-mode-tooltip-wrapper` ancestor-or-self of the button (`toHaveCount(1)`).
   - ✅ *(UI)* The button is disabled.
   - ✅ *(UI)* **Before hovering:** no `role="tooltip"` containing "Manage in YAML" exists on the page (the tooltip is only in the DOM while showing).
   - ☐ Hover the wrapper (not the button — a disabled button swallows pointer events).
   - ✅ *(UI)* The "Manage in YAML" tooltip becomes visible.
   - ✅ *(UI)* Its link named **YAML** has `href` equal to `new URL(repoUrl).toString()` — the trailing-slash normalisation matters: `https://example.com` becomes `https://example.com/` and a raw string comparison fails.
   - ☐ Move the pointer to (0, 0).
   - ✅ *(UI)* The tooltip is gone again (so the next assertion cannot pass on a leftover).

**Assessment**
- *Value:* the canonical pattern-A gate, and the only place the `YAML` → `repository_url` link is asserted. Together with GITOPS-02 it covers both YAML-ish links in the product. The hover-clean-up discipline in `expectGitOpsTooltip` is genuinely good — it is what stops the other twelve `expectGatedByGitOps` calls in this area from passing on a stale tooltip.
- *Coverage gaps:* only one control on one page. Controls › Scripts also disables **Edit** while Profiles keeps **Edit** enabled and gates the modal's Save — that asymmetry ([GITOPS-PLAN §8.4](../qawolf-migration/round-2/GITOPS-PLAN.md)) is documented and untested. `target="_blank"` on the YAML link is not asserted. The scripts library is loaded empty (`cleanup-setup` wipes scripts), so no row-level gating is reachable.
- *Redundancy:* the tooltip mechanics are re-run by every `expectGatedByGitOps` call in GITOPS-04/06/07/08/10/12 — this entry is where the mechanism is *named*, the others get it for free.
- *Efficiency / smells:*
  - `enableGitOpsMode` is called a second time in the same serial describe where step 2 already enabled it. Harmless (it re-PATCHes the same values) but it is a config round-trip per test.
  - `.gitops-mode-tooltip-wrapper` is a class selector and the single point of failure for the whole area — if Fleet renames the BEM base, all nineteen premium tests fail at once. [GITOPS-PLAN §11.2](../qawolf-migration/round-2/GITOPS-PLAN.md) says it should be a tracked constant in the `fleet-upgrade-preflight` watch list; check whether that was actually added.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GITOPS-04 · Premium • gitops mode — gated surfaces › Organization info — Save is gated and the org name is locked

- **File:** [`playwright/tests/e2e/premium/gitops-mode/02-gated-surfaces.spec.ts`](../../tests/e2e/premium/gitops-mode/02-gated-surfaces.spec.ts)
- **Grep:** `npm run test:gitops-mode:only -- -g "Organization info — Save is gated and the org name is locked"`
- **Project:** gitops-mode · **Scopes:** none (global settings)
- **Mode:** UI · **Isolation:** serial describe, step 1 of 6. The describe's `beforeAll` turns the mode **on with all three exceptions explicitly false** and captures `repoUrl`; `afterAll` restores the whole subtree. `mode: 'serial'` means a failure here **skips GITOPS-05 through GITOPS-09**.
- **Preconditions:** premium license; non-empty `repository_url` (asserted in `beforeAll`)
- **Data created:** none — nothing is saved, only inspected

**Flow**

1. ☐ Open `/settings/organization/info` via URL.
   - ✅ *(UI)* The **Organization info** heading and the **Organization name** textbox are visible — `OrganizationInfoPage.goto()`.
2. ☐ Look at **Save** and hover its wrapper — `expectGatedByGitOps`, pattern **A**:
   - ✅ *(UI)* Exactly one gitops wrapper around **Save**; **Save** is disabled; the "Manage in YAML" tooltip appears on hover with a `YAML` link to `repository_url`; the tooltip clears afterwards.
3. ☐ Look at the **Organization name** field.
   - ✅ *(UI)* It is disabled — pattern **D**. The field reads `config.gitops.gitops_mode_enabled` itself instead of going through the wrapper, so it locks with **no tooltip at all**; the spec asserts the lock and deliberately not the tip.

**Assessment**
- *Value:* the cheapest place patterns A and D sit side by side, and the clearest demonstration that "gated" is not one thing. The inline comment explaining why no tooltip is asserted on the org-name field is exactly the kind of note that stops a future author "fixing" the test.
- *Coverage gaps:* only two of the page's controls. The support-URL field, the two logo cards (**Replace logo** / **Remove logo**, both `ariaLabel`-ed and modelled in the POM) and the contact-URL field are untouched, so a regression that un-gates the logo cards would not be caught. Nothing asserts the *values* survive — a gated form that silently discarded its content would pass.
- *Redundancy:* none within the area.
- *Efficiency / smells:*
  - **The pattern-D assertion is one-directional.** `toBeDisabled()` on `orgNameInput` would still pass if Fleet started wrapping the field — there is no paired `gitopsWrapperFor(orgNameInput).toHaveCount(0)`, so the test cannot tell pattern D from pattern A and the comment's claim ("locks without a tooltip") is documented, not verified.
  - Entered by direct URL rather than the dashboard → user menu → Settings click-through the suite's e2e convention prescribes. Defensible for a gating check (and consistent with the rest of this file), but worth noting it is the whole area's habit, not a one-off.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GITOPS-05 · Premium • gitops mode — gated surfaces › Advanced options — host expiry is gated, SMTP and Save stay editable

- **File:** [`playwright/tests/e2e/premium/gitops-mode/02-gated-surfaces.spec.ts`](../../tests/e2e/premium/gitops-mode/02-gated-surfaces.spec.ts)
- **Grep:** `npm run test:gitops-mode:only -- -g "Advanced options — host expiry is gated, SMTP and Save stay editable"`
- **Project:** gitops-mode · **Scopes:** none
- **Mode:** UI · **Isolation:** serial describe, step 2 of 6
- **Preconditions:** mode on, no exceptions (from the describe's `beforeAll`)
- **Data created:** none

**Flow**

1. ☐ Open `/settings/organization/advanced` via URL.
   - ✅ *(UI)* The **Host lifecycle** heading is visible (the page has no title of its own; its first section is the anchor) — `OrganizationAdvancedPage.goto()`.
2. ☐ Look at the **Host expiry** checkbox and hover its wrapper — `expectGatedByGitOps`, pattern **B**:
   - ✅ *(UI)* Exactly one gitops wrapper; the checkbox reads as disabled (Fleet's `Checkbox` renders `div[role=checkbox][aria-disabled=true]`, which Playwright's `toBeDisabled()` honours for the `checkbox` role); the "Manage in YAML" tooltip with the `YAML` → `repository_url` link appears on hover and clears.
   - **Note for a manual run:** the control is found by `getByRole('checkbox', { name: 'enableHostExpiry' })` — Fleet names the interactive element after the *form field*, not the visible label "Host expiry". On screen you are looking for the "Host expiry" tick box under Host lifecycle.
3. ☐ Look at the SMTP **Domain** field — `expectNotGatedByGitOps`:
   - ✅ *(UI)* Visible, **no** gitops wrapper around it (`toHaveCount(0)`), and enabled.
4. ☐ Look at **Save** — `expectNotGatedByGitOps`:
   - ✅ *(UI)* Visible, unwrapped, enabled.

**Assessment**
- *Value:* the best over-gating detector in the shipped set. This card is only *partially* gated — a naive "in gitops mode, Save is disabled" test would be wrong here, and Fleet's own source carries a prop comment saying so. If someone ever gates the whole form, this is the test that catches it.
- *Coverage gaps:* the other two ungated fields verified during design (**Verify SSL certs**, **Enable STARTTLS**) are not asserted, nor are the Activity & data-retention checkboxes that the POM does model. Nothing clicks **Save** to prove the ungated half is actually *savable* while gated fields sit on the same form — which is precisely the failure mode that made `exceptions.software` look broken during the design sweep.
- *Redundancy:* the host-expiry half is re-asserted in the opposite direction by GITOPS-17.
- *Efficiency / smells:*
  - `page.getByRole('checkbox', { name: 'enableHostExpiry' })` is built **inline in the spec** while `OrganizationAdvancedPage` already models three other checkboxes on the same page by the same naming rule. GITOPS-17 repeats the identical inline locator. A POM gap, duplicated.
  - `expectNotGatedByGitOps` asserts visibility first, deliberately — every other assertion in it is a `toHaveCount(0)`, which an un-rendered control satisfies instantly. Worth knowing when reading a green result: the visibility check is the thing stopping a slow page from reading as an ungated one.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GITOPS-06 · Premium • gitops mode — gated surfaces › Fleets list — Add fleet and the row actions are gated

- **File:** [`playwright/tests/e2e/premium/gitops-mode/02-gated-surfaces.spec.ts`](../../tests/e2e/premium/gitops-mode/02-gated-surfaces.spec.ts)
- **Grep:** `npm run test:gitops-mode:only -- -g "Fleets list — Add fleet and the row actions are gated"`
- **Project:** gitops-mode · **Scopes:** none (the fleets list itself)
- **Mode:** UI · **Isolation:** serial describe, step 3 of 6
- **Preconditions:** mode on, no exceptions; **at least one fleet row exists** so that `.actions-dropdown` resolves (Workstations is gitops-provisioned and always present)
- **Data created:** none

**Flow**

1. ☐ Open `/settings/fleets` via URL (raw `page.goto` — there is no page object for this list).
2. ☐ Look at **Add fleet**.
   - ✅ *(UI)* The button is visible and disabled.
   - ✅ *(UI)* It has **no** `.gitops-mode-tooltip-wrapper` ancestor (`toHaveCount(0)`) — pattern **D**: this button gets its gitops tip from a plain `TooltipWrapper` fed by the same content function, so there is no marker span to find.
3. ☐ Hover the tooltip overlay that sits over the button (`.component__tooltip-wrapper__element` filtered to the one containing **Add fleet**) — hovering the button itself fails with *"intercepts pointer events"*.
   - ✅ *(UI)* No "Manage in YAML" tooltip before hovering; the tooltip appears on hover; its `YAML` link points at `repository_url`; it clears when the pointer moves away.
4. ☐ Look at the first row's **Actions** dropdown — `expectGatedByGitOps(..., { style: 'react-select' })`, pattern **C**:
   - ✅ *(UI)* Exactly one gitops wrapper around it.
   - ✅ *(UI)* Exactly one `.actions-dropdown-select--is-disabled` element at or below it. react-select exposes **no** `aria-disabled`, no accessible name and no disabled accessible element — the class is the only handle, and `toBeDisabled()` does not work here.
   - ✅ *(UI)* The "Manage in YAML" tooltip appears on hovering the wrapper, with the `YAML` → `repository_url` link.

**Assessment**
- *Value:* the only place patterns C and no-wrapper-D appear together, and the only coverage of react-select gating anywhere in the suite. The wrapper assertion is deliberately paired with the class check so that a react-select which *stopped* emitting the class on a dependency bump fails rather than silently reading as "not disabled" — the exact trap [GITOPS-PLAN §11.4](../qawolf-migration/round-2/GITOPS-PLAN.md) warned about.
- *Coverage gaps:* the dropdown is never **opened**, so the gated state of the individual actions inside it is unverified. The design notes that the Fleets *dropdown* (the scope picker) *hides* its "Add fleet" affordance rather than disabling it, and that the command palette filters "Add fleet" out entirely — both untested, both a different mechanism from this page. The `repository_url`-empty third state (where "Add fleet" stays **enabled** while everything else is gated) is unreached.
- *Redundancy:* GITOPS-18 is the same page in the opposite direction.
- *Efficiency / smells:*
  - `page.locator('.actions-dropdown').first()` — an unscoped `.first()` chain on a class, which [`tests/README.md`](../../tests/README.md) lists as an anti-pattern. It does not target a *named* fleet's row, so which row is asserted depends on the list's sort order; on an instance with one fleet this is fine and on a fuller one it is arbitrary.
  - Three raw class-based locators in one test (`.component__tooltip-wrapper__element`, `.actions-dropdown`, and the wrapper class inside the helper). Each is justified in a comment, and there genuinely is no role/name alternative for pattern C — but this is the highest class-dependency concentration in the area.
  - No page object for `/settings/fleets` at all; the spec does its own `page.goto` and builds its own locators.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GITOPS-07 · Premium • gitops mode — gated surfaces › Fleet settings — management actions are gated, Add hosts stays enabled

- **File:** [`playwright/tests/e2e/premium/gitops-mode/02-gated-surfaces.spec.ts`](../../tests/e2e/premium/gitops-mode/02-gated-surfaces.spec.ts)
- **Grep:** `npm run test:gitops-mode:only -- -g "Fleet settings — management actions are gated, Add hosts stays enabled"`
- **Project:** gitops-mode · **Scope:** Workstations (via the `workstationsFleetId` worker fixture)
- **Mode:** UI · **Isolation:** serial describe, step 4 of 6
- **Preconditions:** mode on, no exceptions; the `Workstations` gitops-provisioned fleet exists
- **Data created:** none — **do not click any of these**; they open rename / delete / enroll-secret flows against a gitops-provisioned fleet
- **Cross-link:** the skipped GITOPS-13 targets the **Manage enroll secrets** button on this same page.

**Flow**

1. ☐ Open `/settings/fleets/settings?fleet_id=<workstationsFleetId>` via URL.
2. ☐ For each of **Manage enroll secrets**, **Rename fleet**, **Delete fleet** — `expectGatedByGitOps`, pattern **A**:
   - ✅ *(UI)* Exactly one gitops wrapper around the button; the button is disabled; the "Manage in YAML" tooltip with a `YAML` → `repository_url` link appears on hover and clears afterwards.
   - **Each locator is `getByRole('button', { name, exact: true }).filter({ visible: true })`.** `ActionButtons` renders every secondary action **twice** — once inline and once as an option inside a "More options" menu that CSS hides at this viewport — so each name matches two elements and the filter narrows to the rendered one.
3. ☐ Look at **Add hosts** — `expectNotGatedByGitOps`:
   - ✅ *(UI)* Visible, **no** gitops wrapper, enabled. Enrolling a host is not a config change, so the primary action stays live.

**Assessment**
- *Value:* the original QA Wolf assertion, and the sharpest over-gating check in the area: three gated actions and one that must stay live, on the same row of buttons. If Fleet ever marks `Add hosts` as `gitOpsModeCompatible`, this is the only test that notices.
- *Coverage gaps:* the fleet's **Agent options** tab (same page tree, same pattern) is deliberately out of scope. Nothing asserts the gated buttons are still *readable* (labels, not just disabled).
- *Redundancy:* the **Manage enroll secrets** assertion overlaps GITOPS-08 and GITOPS-12, which reach the same modal through the un-gated Hosts-page deep link.
- *Efficiency / smells:*
  - ⚠️ **The `.filter({ visible: true })` is a documented work-around for a real product bug** — [fleetdm/fleet#54168](https://github.com/fleetdm/fleet/issues/54168), row 39 of [`docs/blocked-by-product-bugs.md`](../blocked-by-product-bugs.md). `ActionButtons`' "More options" dropdown renders the same secondary actions **ungated**, and CSS reveals it at ~900 px — a supported width and a genuinely reachable gitops-mode bypass (clicking `More options → Rename fleet` opens the rename modal with an enabled name field and an enabled Save). **This test asserts the gated copies and never asserts the ungated copy is absent**, so when Fleet fixes #54168 nothing will fail to prompt dropping the filter, and today nothing guards the bypass itself. A `toHaveCount(1)` on the unfiltered name — or a 900 px-viewport assertion — would encode the bug the way the blocked-flows workflow intends.
  - Three full hover round-trips (each with a before/after tooltip-count assertion) on one page; the slowest test in the file.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GITOPS-08 · Premium • gitops mode — gated surfaces › Enroll secrets stay readable but not editable

- **File:** [`playwright/tests/e2e/premium/gitops-mode/02-gated-surfaces.spec.ts`](../../tests/e2e/premium/gitops-mode/02-gated-surfaces.spec.ts)
- **Grep:** `npm run test:gitops-mode:only -- -g "Enroll secrets stay readable but not editable"`
- **Project:** gitops-mode · **Scope:** Workstations
- **Mode:** UI · **Isolation:** serial describe, step 5 of 6
- **Preconditions:** mode on, no exceptions; the Workstations fleet has **at least one enroll secret** (otherwise `Edit enroll secret` / `Delete enroll secret` / `Show secret` do not render and the `.first()` locators resolve to nothing)
- **Data created:** none — **do not click Add / Edit / Delete**; enroll secrets are shared, gitops-provisioned state

**Flow**

1. ☐ Open `/hosts/manage?fleet_id=<workstationsFleetId>&manage_enroll_secrets=1` via URL — `EnrollSecretModal.goto()`. This entry point has **no gitops gate of its own**, which is the only reason the modal is reachable at all while the mode is on (the documented button on the fleet settings page is gated — see GITOPS-07 and GITOPS-13).
   - ✅ *(UI)* The `.enroll-secret-modal` container is visible.
2. ☐ For each of **Add secret**, **Edit enroll secret**, **Delete enroll secret** — `expectGatedByGitOps`, pattern **A**:
   - ✅ *(UI)* One gitops wrapper each; disabled; "Manage in YAML" tooltip on hover with the `YAML` → `repository_url` link.
3. ☐ For each of **Copy to clipboard**, **Show secret**, **Done** — `expectNotGatedByGitOps`:
   - ✅ *(UI)* Visible, unwrapped, enabled. Reading a secret is not a config change.

**Assessment**
- *Value:* the cleanest read-vs-write split in the area — three gated and three live controls in one modal — and it establishes the un-gated deep link that GITOPS-12 depends on to test the `secrets` exception at all.
- *Coverage gaps:* **Show secret** is asserted enabled but never *clicked*, so nothing proves the secret is actually readable while the mode is on; same for **Copy to clipboard**. The modal is never closed via **Done** (the POM has `close()`), so the "way out" of the modal is unverified. Fleet also renders a second **Add secret** in the modal's `modal-cta-wrap` when secrets exist — same component, same `entityType`, not asserted.
- *Redundancy:* GITOPS-12 re-asserts `addSecretButton` gated, immediately before flipping the exception. That first half of GITOPS-12 is this test again.
- *Efficiency / smells:*
  - Three of the six locators in `EnrollSecretModal` end in `.first()` (`editSecretButton`, `deleteSecretButton`, `copyButton`, `showSecretButton`) — unavoidable for a per-row control in a modal that lists every secret, but it means the test only ever inspects the first secret's row.
  - The modal is constructed with `new EnrollSecretModal(page)` in the spec body; it is not a fixture, unlike almost every other page object this area uses.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GITOPS-09 · Premium • gitops mode — gated surfaces › Change management stays fully editable — the way back out

- **File:** [`playwright/tests/e2e/premium/gitops-mode/02-gated-surfaces.spec.ts`](../../tests/e2e/premium/gitops-mode/02-gated-surfaces.spec.ts)
- **Grep:** `npm run test:gitops-mode:only -- -g "Change management stays fully editable"`
- **Project:** gitops-mode · **Scopes:** none
- **Mode:** UI · **Isolation:** serial describe, step 6 of 6 — **skipped if any of GITOPS-04…08 fails**
- **Preconditions:** mode on, no exceptions
- **Data created:** none — the form is inspected, never saved

**Flow**

1. ☐ Open `/settings/integrations/change-management` via URL.
   - ✅ *(UI)* The **Change management** heading is visible — `ChangeManagementPage.goto()`.
2. ☐ For each of the **GitOps mode** toggle, the **Git repository URL** field, the three **Exceptions** checkboxes (Labels / Software / Secrets) and **Save** — `expectNotGatedByGitOps`:
   - ✅ *(UI)* Visible, **no** gitops wrapper, enabled.
   - **Note for a manual run:** the accessible names are the form-field names, not the visible labels — `gitOpsModeEnabled`, `exceptLabels`, `exceptSoftware`, `exceptSecrets`. `ChangeManagementPage.exceptionCheckbox(entity)` does the mapping so specs never see the raw strings.
3. ☐ Look at the page as a whole.
   - ✅ *(UI)* **Zero** `.gitops-mode-tooltip-wrapper` spans anywhere on the page.

**Assessment**
- *Value:* **the single most important assertion in this area.** Gate anything on this card and gitops mode becomes a one-way door: the teardown project could still recover via the API, but a human staring at a locked instance could not. The whole-page `toHaveCount(0)` is the right shape here — it catches a *newly* gated control nobody thought to enumerate, which is the actual risk.
- *Coverage gaps:* the card is proved *interactive*, not *functional* — nothing ticks an exception, clicks **Save** and asserts the `Successfully updated settings` toast, so the UI write path (and its activity-feed copy) is untested end to end. `ChangeManagementPage.save()` exists and is unused by any spec. The "Learn more about GitOps" link in the card description is not asserted. The repository-URL field is enabled only *because* the mode is on — the form disables it while the mode is off, and that inverse is untested.
- *Redundancy:* GITOPS-19 covers the same card with the mode off; the two are complementary, not duplicated.
- *Efficiency / smells:*
  - **Ordering risk:** `mode: 'serial'` means this test — the most important one in the file — is skipped whenever any of the five gating checks before it fails. Those five are the ones most likely to break on a Fleet upgrade (they lean on class names and role names); the escape-hatch check does not depend on them at all and would be safer first, or in its own describe.
  - Six `expectNotGatedByGitOps` calls plus a page-wide probe is the densest assertion set in the area for one navigation — cheap, and correctly so.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GITOPS-10 · Premium • gitops mode — exceptions › labels — the new-label form is gated while labels are managed in YAML

- **File:** [`playwright/tests/e2e/premium/gitops-mode/03-exceptions.spec.ts`](../../tests/e2e/premium/gitops-mode/03-exceptions.spec.ts)
- **Grep:** `npm run test:gitops-mode:only -- -g "labels — the new-label form is gated while labels are managed in YAML"`
- **Project:** gitops-mode · **Scopes:** none (labels are global)
- **Mode:** UI · **Isolation:** independent test, **not** a serial describe. Each test's `beforeEach` snapshots `config.gitops` and sets `gitops_mode_enabled: true` with all three exceptions false; `afterEach` restores the snapshot — so a test that dies mid-flip cannot leave an exception set for the next one.
- **Preconditions:** premium license; a `repository_url` on the instance (**not asserted here** — spec 01 and 02 assert it, this spec does not)
- **Data created:** none — the new-label form is opened and abandoned

**Flow**

1. ☐ (No user action) `PATCH /config`: mode on, `exceptions = { labels: false, software: false, secrets: false }`; read back `repository_url`.
2. ☐ Open `/labels/manage` via URL.
   - ✅ *(UI)* The **Labels** heading is visible — `LabelsPage.goto()`.
3. ☐ Click **Add label**.
   - ✅ *(UI)* URL is `/labels/new`; the **Name** textbox is visible — `clickAddLabel()`. Note **Add label** itself is *not* gated; only the form's Save is.
4. ☐ Look at **Save** and hover its wrapper — `expectGatedByGitOps`, pattern **A**:
   - ✅ *(UI)* One gitops wrapper; **Save** disabled; "Manage in YAML" tooltip on hover with the `YAML` → `repository_url` link; tooltip clears.

**Assessment**
- *Value:* the "excepted = false" control case for GITOPS-11 — without it, GITOPS-11's green could mean "the exception works" or "labels were never gated in the first place". Also incidentally pins that **Add label** stays clickable, which is the over-gating half nobody asserts explicitly.
- *Coverage gaps:* only the *new-label* form. The design identified two more `labels`-exception surfaces — the row **Delete** action on `/labels/manage` (an `aria-disabled` option on a role-less element, a fifth DOM shape) and **Edit label** / **Delete label** on `/hosts/manage/labels/:id` — neither covered. The label form's other fields (Name, Description, the SQL editor, Platform) are not checked for locking.
- *Redundancy:* the gated-Save half duplicates the shape of GITOPS-03/04 on a different page.
- *Efficiency / smells:*
  - Unlike specs 01 and 02, this spec never asserts `repository_url` is non-empty. On an instance with a blank URL, `expectGitOpsTooltip`'s `new URL('')` throws a `TypeError` mid-test instead of failing with the clear "the instance has no gitops repository_url configured" message the other two specs produce.
  - `beforeEach`/`afterEach` means **two config writes per test** in this file, four tests deep — including for the skipped one (see GITOPS-13).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GITOPS-11 · Premium • gitops mode — exceptions › labels — the exception unlocks the new-label form

- **File:** [`playwright/tests/e2e/premium/gitops-mode/03-exceptions.spec.ts`](../../tests/e2e/premium/gitops-mode/03-exceptions.spec.ts)
- **Grep:** `npm run test:gitops-mode:only -- -g "labels — the exception unlocks the new-label form"`
- **Project:** gitops-mode · **Scopes:** none
- **Mode:** UI · **Isolation:** independent; `beforeEach` sets mode on / no exceptions, `afterEach` restores
- **Preconditions:** premium license
- **Data created:** none. **Do not click Save** — the form is left filled-out-able but abandoned.
- **Cross-link:** the control case is **GITOPS-10**.

**Flow**

1. ☐ (No user action) `beforeEach` puts the instance in "mode on, nothing excepted".
2. ☐ (No user action) `setGitOpsException(request, 'labels', true)` — flips *only* the labels exception, leaving the other two and the mode flag alone. Remember the inversion: `exceptions.labels = true` means **labels are not gitops-managed**, i.e. in the UI the "Exceptions: Labels" box is **ticked**.
3. ☐ Open `/labels/manage`, click **Add label**.
   - ✅ *(UI)* `/labels/new` with the **Name** textbox visible.
4. ☐ Look at **Save** — `expectNotGatedByGitOps`:
   - ✅ *(UI)* Visible, **no** gitops wrapper, enabled.
5. ☐ Look at the page as a whole.
   - ✅ *(UI)* **Zero** `.gitops-mode-tooltip-wrapper` spans — an excepted entity renders exactly like the mode being off, which is the point.

**Assessment**
- *Value:* one half of the only exception coverage that exists anywhere. The whole-page wrapper probe is the right assertion: it proves the exception removed the marker rather than merely re-enabling a button, and it would catch a partially-honoured exception (a form that unlocks one control while leaving a wrapper on another) — the exact failure shape the design found on the Install-software form.
- *Coverage gaps:* the exception is never exercised *through the UI* (tick the Labels box on Change management, Save, then observe) — only over the API, so the Change-management form's own write path for exceptions is untested. Nothing asserts that with `labels` excepted, the *other* entities stay gated (a blanket "exception disables gitops mode entirely" regression would pass). Nothing saves the label, so "excepted really means editable" is proved at the DOM level, not functionally.
- *Redundancy:* none.
- *Efficiency / smells:*
  - The exception is set *before* the first navigation, so this test never observes the transition — it observes a page rendered under an already-excepted config. GITOPS-12 does it the better way (assert gated, flip, re-navigate, assert ungated) in one test.
  - Same missing `repository_url` guard as GITOPS-10 (harmless here, since no tooltip is asserted).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GITOPS-12 · Premium • gitops mode — exceptions › enroll secrets — the exception unlocks the enroll-secret modal

- **File:** [`playwright/tests/e2e/premium/gitops-mode/03-exceptions.spec.ts`](../../tests/e2e/premium/gitops-mode/03-exceptions.spec.ts)
- **Grep:** `npm run test:gitops-mode:only -- -g "enroll secrets — the exception unlocks the enroll-secret modal"`
- **Project:** gitops-mode · **Scope:** Workstations
- **Mode:** UI · **Isolation:** independent; `beforeEach` / `afterEach` as above
- **Preconditions:** the Workstations fleet exists and has at least one enroll secret
- **Data created:** none — **do not click Add / Edit / Delete secret**

**Flow**

1. ☐ (No user action) mode on, nothing excepted.
2. ☐ Open `/hosts/manage?fleet_id=<workstationsFleetId>&manage_enroll_secrets=1` — the un-gated deep link.
   - ✅ *(UI)* The enroll-secret modal is visible.
3. ☐ Look at **Add secret** — `expectGatedByGitOps`, pattern **A**:
   - ✅ *(UI)* One wrapper; disabled; "Manage in YAML" tooltip with the `YAML` → `repository_url` link.
4. ☐ (No user action) `setGitOpsException(request, 'secrets', true)`.
5. ☐ Re-open the same deep link (a full navigation — the app reads `config` at load).
   - ✅ *(UI)* The modal is visible again.
6. ☐ Look at **Add secret**, **Edit enroll secret** and **Delete enroll secret** — `expectNotGatedByGitOps` each:
   - ✅ *(UI)* Visible, unwrapped, enabled.
7. ☐ Look at the page as a whole.
   - ✅ *(UI)* **Zero** gitops wrappers.

**Assessment**
- *Value:* the best-shaped test in the area — it asserts the *transition*, in one test, on the same control, so "gated → excepted → live" is proved rather than inferred from two separate tests' preconditions. If a manual re-runner only has time for one exception flow, run this one.
- *Coverage gaps:* the exception is set over the API, not through the Change-management form (same gap as GITOPS-11). The ungated controls are never clicked, so "excepted" is proved as DOM state, not as a working Add-secret. There is no coverage of the *second* `Add secret` in the modal's CTA wrap.
- *Redundancy:* step 3 repeats GITOPS-08's `addSecretButton` assertion verbatim. Deliberate — it is this test's control case — but it is the same assertion in the same run.
- *Efficiency / smells:*
  - The re-navigation in step 5 is load-bearing and undocumented in the spec: the app reads `config` from `AppContext` at page load, so without the full `goto` the flipped exception would not be observed. Worth a comment.
  - Two config writes (`beforeEach`, the flip) plus the `afterEach` restore = three `PATCH /config` calls for one test.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GITOPS-13 · Premium • gitops mode — exceptions › enroll secrets — the exception reaches the fleet settings entry point — **SKIPPED**

- **File:** [`playwright/tests/e2e/premium/gitops-mode/03-exceptions.spec.ts`](../../tests/e2e/premium/gitops-mode/03-exceptions.spec.ts#L81)
- **Grep:** `npm run test:gitops-mode:only -- -g "the exception reaches the fleet settings entry point"` (reports as skipped)
- **Project:** gitops-mode · **Scope:** Workstations
- **Mode:** UI · **Isolation:** independent; `beforeEach` / `afterEach` still run for it (the skip is evaluated inside the test body)
- **Preconditions:** none reachable — the test never executes
- **Data created:** none

**Status: skipped, blocked by a confirmed Fleet defect**

- **Issue:** [fleetdm/fleet#48218](https://github.com/fleetdm/fleet/issues/48218) — *"`Manage enroll secrets` ignores `exceptions.secrets`"*. Filed against 4.87.0, re-confirmed on v4.93.0-rc during the round-2 design work (2026-09-27).
- **Mechanism:** the **Manage enroll secrets** button on a fleet's settings page is an `ActionButtons` entry with `gitOpsModeCompatible: true`, so it gets a `GitOpsModeTooltipWrapper` with **no `entityType`**. The modal it opens is the *only* surface that honours `entityType="secrets"`. With `exceptions.secrets: true` the button therefore stays disabled, leaving the exception unreachable from the only documented way into the modal it governs. (It *is* reachable via the `?manage_enroll_secrets=1` deep link, which has no gitops gate at all — which is how GITOPS-08 and GITOPS-12 can test the modal, and is itself an inconsistency noted on the issue.)
- **Unblock condition:** when that wrapper carries `entityType="secrets"`, remove the `test.skip(true, …)` — the test body is already written and should pass as-is. Tracked in [`docs/blocked-by-product-bugs.md`](../blocked-by-product-bugs.md) (row 24), with a matching `TODO(fleetdm/fleet#48218)` on the skip so the two cannot drift.

**Flow (what it would do, once unblocked)**

1. ☐ (No user action) mode on, nothing excepted, then `setGitOpsException(request, 'secrets', true)`.
2. ☐ Open `/settings/fleets/settings?fleet_id=<workstationsFleetId>`.
3. ☐ Look at **Manage enroll secrets** (narrowed with `.filter({ visible: true })` for the same `ActionButtons` double-render as GITOPS-07) — `expectNotGatedByGitOps`:
   - ✅ *(UI)* Visible, no gitops wrapper, enabled.

**Assessment**
- *Value (once unblocked):* closes the loop between GITOPS-07 (button gated, no exception) and GITOPS-12 (modal excepted, reached by deep link) — the only assertion that the exception is usable the way a customer would actually reach it.
- *Coverage gaps:* while skipped, the exception axis has a hole exactly where the product is broken. The suite is *aware* of the bug but asserts nothing about it, so a Fleet fix produces no signal.
- *Redundancy:* none.
- *Efficiency / smells:*
  - `test.skip(true, …)` is called **inside the test body**, so Playwright runs `beforeEach` and `afterEach` for it first — two `PATCH /config` round-trips per run for a test that does nothing. A declaration-level `test.skip('…', async () => {…})` or `test.fixme` would cost nothing. Minor, but this project is single-worker and every config write is serial.
  - The suite chose *skip* here while [GITOPS-PLAN §8.2](../qawolf-migration/round-2/GITOPS-PLAN.md) recommended asserting the *current* (broken) behaviour with a TODO so a Fleet fix breaks the test loudly. The as-shipped choice is defensible — [G-out-of-band](../qawolf-migration/round-2/G-out-of-band.md) argues "a test that is green *because* the product is broken inverts the meaning of green" — but it means the unblock depends on someone re-reading the blocked-bugs table rather than on CI going red.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GITOPS-14 · Premium • gitops mode — everything is back › the config says gitops mode is off

- **File:** [`playwright/tests/e2e/premium/gitops-mode/zz-everything-is-back.spec.ts`](../../tests/e2e/premium/gitops-mode/zz-everything-is-back.spec.ts)
- **Grep:** `npm run test:gitops-mode:only -- -g "the config says gitops mode is off"`
- **Project:** gitops-mode · **Scopes:** none
- **Mode:** API · **Isolation:** independent. The describe's `beforeAll` calls `disableGitOpsMode` **itself** rather than trusting the teardown project — this file is a verifier, not a beneficiary, and must pass even if every spec before it failed. It takes no state from specs 01–03 and seeds nothing.
- **Preconditions:** none. The `zz-` filename prefix is **load-bearing**: with `workers: 1` and `fullyParallel: false`, file-discovery order is the running order, so `zz-` guarantees this file runs after everything that turns the mode on.
- **Data created:** none — `disableGitOpsMode` writes only when the flag is actually on, and never touches `repository_url` or the exceptions.

**Flow**

1. ☐ (No user action) `disableGitOpsMode` — reads `config.gitops`, returns immediately if the flag is already off, otherwise `PATCH`es the same subtree with `gitops_mode_enabled: false`.
2. ☐ (No user action) Re-read the config.
   - ✅ *(API)* `GET /config` → `gitops.gitops_mode_enabled === false`, with the failure message *"gitops mode is still enabled"*.

**Assessment**
- *Value:* the contract-level half of the safety net — one HTTP call, no browser, unambiguous. If this fails, the instance is locked and the manual recovery in the safety note above is required before anything else runs.
- *Coverage gaps:* only the flag. `repository_url` and the three exceptions are not asserted here (GITOPS-19 looks at the exceptions, but see its assessment for why that check is weaker than it reads). A run that turned the mode off *and* blanked the repository URL would pass.
- *Redundancy:* [`setup/gitops-mode.teardown.ts`](../../setup/gitops-mode.teardown.ts) makes the identical assertion a minute later, and `cleanup-setup` clears the flag again at the start of the next run. Three layers is deliberate: this one tells you *inside the report* that the instance is fine; the teardown guarantees it after a failure; `cleanup-setup` recovers from a `SIGKILL` where no teardown runs.
- *Efficiency / smells:* none — the cheapest test in the area and the highest value per millisecond.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GITOPS-15 · Premium • gitops mode — everything is back › the navbar marker is gone

- **File:** [`playwright/tests/e2e/premium/gitops-mode/zz-everything-is-back.spec.ts`](../../tests/e2e/premium/gitops-mode/zz-everything-is-back.spec.ts)
- **Grep:** `npm run test:gitops-mode:only -- -g "the navbar marker is gone"`
- **Project:** gitops-mode · **Scopes:** none
- **Mode:** UI · **Isolation:** independent
- **Preconditions:** the describe's `beforeAll` has cleared the flag
- **Data created:** none

**Flow**

1. ☐ Open the dashboard (via URL `/dashboard`).
   - ✅ *(UI)* First dashboard card visible.
2. ☐ Look at the navbar and the page.
   - ✅ *(UI)* No **GitOps mode** link (`toHaveCount(0)`).
   - ✅ *(UI)* Zero `.gitops-mode-tooltip-wrapper` spans.

**Assessment**
- *Value:* catches the case the API check cannot — the flag written but the front end still rendering the old `config` from `AppContext` (a stale cache, a partial write, a CDN-served stale bundle). "The API says off but the UI says on" is a real state and this is where it surfaces.
- *Coverage gaps:* the dashboard is the weakest page to prove this on (see the smell below).
- *Redundancy:* **byte-identical** to GITOPS-01 apart from how the mode got turned off. One is the "before", one the "after"; the assertions are the same two lines.
- *Efficiency / smells:*
  - **Weak assertion:** `gitopsWrappers(page).toHaveCount(0)` on the dashboard passes with the mode *on* as well — the dashboard renders zero wrappers in both states. Only the navbar half discriminates. The page-wide probe does real work in GITOPS-16/17/18 (pages that *do* render wrappers when gated); here it is decoration.
  - `toHaveCount(0)` on a navbar that has not rendered yet passes instantly; `dashboard.goto()`'s `firstCard` anchor is what stops that, so the ordering matters and is easy to break.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GITOPS-16 · Premium • gitops mode — everything is back › Controls — Add script is editable again

- **File:** [`playwright/tests/e2e/premium/gitops-mode/zz-everything-is-back.spec.ts`](../../tests/e2e/premium/gitops-mode/zz-everything-is-back.spec.ts)
- **Grep:** `npm run test:gitops-mode:only -- -g "Add script is editable again"`
- **Project:** gitops-mode · **Scope:** Unassigned (`fleetId: 0`)
- **Mode:** UI · **Isolation:** independent
- **Preconditions:** mode cleared by `beforeAll`
- **Data created:** none
- **Cross-link:** the gated direction is **GITOPS-03**.

**Flow**

1. ☐ Open `/controls/scripts/library?fleet_id=0` via URL.
   - ✅ *(UI)* Scripts heading visible.
2. ☐ Look at **Add script** — `expectNotGatedByGitOps`:
   - ✅ *(UI)* Visible, no gitops wrapper, enabled.
3. ☐ Look at the page as a whole.
   - ✅ *(UI)* Zero gitops wrappers.

**Assessment**
- *Value:* pattern **A** recovery. A native button, an `aria-disabled` div and a react-select each recover independently, so this is one of three tests that would catch a *half*-restored render — asserting only buttons would miss the other two.
- *Coverage gaps:* the button is not clicked, so "editable again" is proved as DOM state; the upload modal is never opened. The **Edit** action on an existing script (which gitops mode disables, unlike Profiles) is not checked — and cannot be, since `cleanup-setup` leaves the library empty.
- *Redundancy:* exact inverse of GITOPS-03.
- *Efficiency / smells:* none. The page-wide wrapper probe is meaningful here (this page *does* render a wrapper when gated), unlike in GITOPS-15.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GITOPS-17 · Premium • gitops mode — everything is back › Advanced options — the host-expiry checkbox is editable again

- **File:** [`playwright/tests/e2e/premium/gitops-mode/zz-everything-is-back.spec.ts`](../../tests/e2e/premium/gitops-mode/zz-everything-is-back.spec.ts)
- **Grep:** `npm run test:gitops-mode:only -- -g "the host-expiry checkbox is editable again"`
- **Project:** gitops-mode · **Scopes:** none
- **Mode:** UI · **Isolation:** independent
- **Preconditions:** mode cleared by `beforeAll`
- **Data created:** none
- **Cross-link:** the gated direction is **GITOPS-05**.

**Flow**

1. ☐ Open `/settings/organization/advanced` via URL.
   - ✅ *(UI)* **Host lifecycle** heading visible.
2. ☐ Look at the **Host expiry** checkbox (`getByRole('checkbox', { name: 'enableHostExpiry' })`) — `expectNotGatedByGitOps`:
   - ✅ *(UI)* Visible, no gitops wrapper, enabled — i.e. the `div[role=checkbox]` no longer carries `aria-disabled=true`.
3. ☐ Look at the page as a whole.
   - ✅ *(UI)* Zero gitops wrappers.

**Assessment**
- *Value:* pattern **B** recovery — the `aria-disabled` shape, which recovers through a different code path from a native `disabled` attribute.
- *Coverage gaps:* the checkbox is not toggled, and the ungated-but-adjacent controls this page is interesting for (Domain, Save) are not re-checked — reasonable, since they were never gated.
- *Redundancy:* inverse of GITOPS-05.
- *Efficiency / smells:* the same inline `getByRole('checkbox', { name: 'enableHostExpiry' })` as GITOPS-05 — the locator now appears twice in the area and zero times in `OrganizationAdvancedPage`, which models three other checkboxes on that page. One-line POM fix.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GITOPS-18 · Premium • gitops mode — everything is back › Fleets — Add fleet and the row actions are editable again

- **File:** [`playwright/tests/e2e/premium/gitops-mode/zz-everything-is-back.spec.ts`](../../tests/e2e/premium/gitops-mode/zz-everything-is-back.spec.ts)
- **Grep:** `npm run test:gitops-mode:only -- -g "Add fleet and the row actions are editable again"`
- **Project:** gitops-mode · **Scopes:** none
- **Mode:** UI · **Isolation:** independent
- **Preconditions:** mode cleared; at least one fleet row exists
- **Data created:** none — **do not click Add fleet**; teams are gitops-provisioned and must never be created by hand
- **Cross-link:** the gated direction is **GITOPS-06**.

**Flow**

1. ☐ Open `/settings/fleets` via URL.
2. ☐ Look at **Add fleet**.
   - ✅ *(UI)* Enabled.
3. ☐ Look at the first row's **Actions** dropdown — `expectNotGatedByGitOps(..., { style: 'react-select' })`:
   - ✅ *(UI)* Visible, no gitops wrapper, and **no** `.actions-dropdown-select--is-disabled` at or below it.
4. ☐ Look at the page as a whole.
   - ✅ *(UI)* Zero gitops wrappers.
5. ☐ Hover **Add fleet**.
   - ✅ *(UI)* **No** `role="tooltip"` containing "Manage in YAML" (`toHaveCount(0)`).

**Assessment**
- *Value:* patterns **C** and **D** recovery in one navigation, and step 5 is the only assertion in the whole suite that catches *"the control came back enabled but kept its gitops tooltip"* — which is precisely what a stale `config` in `AppContext` looks like. The wrapper probe alone would not catch it, because the Add-fleet tip never came from the wrapper in the first place.
- *Coverage gaps:* the dropdown is not opened; the row actions are not exercised.
- *Redundancy:* inverse of GITOPS-06.
- *Efficiency / smells:*
  - Same unscoped `page.locator('.actions-dropdown').first()` as GITOPS-06.
  - Step 5 hovers the button directly, where GITOPS-06 had to hover the overlay because it intercepts pointer events. With the mode off the overlay is gone, so this works — but it means the two directions use different hover targets, and a regression that left the overlay in place would surface as a hover timeout rather than a clear assertion failure.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GITOPS-19 · Premium • gitops mode — everything is back › Change management agrees with the API and is still the way out

- **File:** [`playwright/tests/e2e/premium/gitops-mode/zz-everything-is-back.spec.ts`](../../tests/e2e/premium/gitops-mode/zz-everything-is-back.spec.ts)
- **Grep:** `npm run test:gitops-mode:only -- -g "Change management agrees with the API and is still the way out"`
- **Project:** gitops-mode · **Scopes:** none
- **Mode:** UI+API · **Isolation:** independent
- **Preconditions:** mode cleared by `beforeAll`
- **Data created:** none

**Flow**

1. ☐ (No user action) Read `GET /config` → `gitops.exceptions`.
2. ☐ Open `/settings/integrations/change-management` via URL.
   - ✅ *(UI)* The **Change management** heading is visible.
3. ☐ Look at the **GitOps mode** toggle.
   - ✅ *(UI)* It is **not** checked.
4. ☐ For each of **Labels**, **Software**, **Secrets** under Exceptions:
   - ✅ *(UI)* The checkbox is **enabled** (labelled per entity in the failure message, e.g. `"labels exception"`).
   - ✅ *(UI+API)* Its checked state matches `config.gitops.exceptions[entity]` read in step 1 — checked when the API says `true`, unchecked when `false`.
5. ☐ Look at **Save**.
   - ✅ *(UI)* Enabled.

**Assessment**
- *Value:* the assertion that makes the instance recoverable **by hand**. If everything else in the suite fails, a human still needs this card to work — and this is the test that says whether it does. Steps 3 and 5 are that check; step 4's enabled-ness half belongs to it too.
- *Coverage gaps:* `repository_url` is not read back or compared, even though `disableGitOpsMode` is specifically documented as not touching it — so the one field the teardown promises to preserve is the one field nobody verifies.
- *Redundancy:* the escape-hatch half overlaps GITOPS-09, in the opposite mode state. Complementary.
- *Efficiency / smells:*
  - ⚠️ **The exception comparison is weaker than its own comment claims.** The spec reads the exceptions from `GET /config` and asserts the UI matches *that same response*. Its inline comment says *"A spec that flipped an exception and died before restoring shows up here rather than in next week's triage"* — but it would not: the API would report `labels: true`, and the test would dutifully assert the box is ticked and pass. [GITOPS-PLAN §10](../qawolf-migration/round-2/GITOPS-PLAN.md) designed this as a comparison against the values captured at spec `02`'s `beforeAll`; as shipped it is a UI-vs-API agreement check with no baseline. The comment is stale relative to the code. **Resolved 2026-09-28 by rewriting the comment**, not the assertion: this file's stated design is to take nothing from the specs before it and to pass even if every one of them failed, which a baseline would contradict. The comment now says the check proves UI-vs-API agreement and names the drift case it does *not* catch.
  - Loop-with-`if`/`else` in the spec body rather than a data-driven assertion; fine, but it is the only branching assertion in the area.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GITOPS-20 · Free • gitops mode › Change management offers no gitops controls

- **File:** [`playwright/tests/e2e/free/settings/gitops-mode.spec.ts`](../../tests/e2e/free/settings/gitops-mode.spec.ts)
- **Grep:** `npm run test:free -- -g "Change management offers no gitops controls"`
- **Project:** **free** (not gitops-mode — this spec is not in the `gitops-mode/` folder and runs in the ordinary free suite) · **Scopes:** n/a
- **Mode:** UI · **Isolation:** independent, read-only
- **Preconditions:** free-tier instance. Nothing writes `config.gitops` here and nothing can — the feature is premium-gated.
- **Data created:** none

**Flow**

1. ☐ Open `/settings/integrations/change-management` via URL.
   - ✅ *(UI)* The **Change management** heading is visible (so the route exists and renders).
2. ☐ Look for the gitops form.
   - ✅ *(UI)* No checkbox named `gitOpsModeEnabled` (`toHaveCount(0)`).
   - ✅ *(UI)* No checkbox named `exceptLabels`, `exceptSoftware` or `exceptSecrets`.
   - ✅ *(UI)* No field labelled **Git repository URL**.
   - ✅ *(UI)* No **Save** button (exact match).

**Assessment**
- *Value:* goes one step further than [`paywalls.spec.ts`](../../tests/e2e/free/paywalls.spec.ts), which only asserts the premium banner renders on this page. This asserts the banner is *instead of* the form, not sitting above a working one — a paywall that rendered alongside a live toggle would let a free instance lock its own UI with no supported way back out, since free has no Change-management form to un-lock it with. That is a genuinely different failure than "the upsell is missing", and it is the reason this spec exists at all despite the design having ruled a free-tier spec out.
- *Coverage gaps:* the premium banner itself is not asserted here (deliberately — `paywalls.spec.ts` owns that), so read as a standalone test it would also pass on a 404 page that happened to carry the right heading. Nothing asserts the **API** refuses `PATCH /config` with a `gitops` subtree on free, which is the actual enforcement layer; a UI-only paywall over a live API is exactly the shape this spec is worried about, one level down.
- *Redundancy:* partial overlap with the `paywalls.spec.ts` row for this URL — different assertion, same navigation.
- *Efficiency / smells:*
  - Every locator is built inline in the spec, while [`ChangeManagementPage`](../../pages/settings/ChangeManagementPage.ts) models all six of them (`gitopsModeToggle`, `repositoryUrlInput`, `exceptionCheckbox()`, `saveButton`) and is already a fixture. Using the POM would make the free/premium mirror explicit and keep the `exceptLabels`-style field names in one place — they are currently duplicated as string literals here.
  - `getByRole('button', { name: 'Save', exact: true }).toHaveCount(0)` is page-wide: any future unrelated **Save** on the Integrations page would fail this test for the wrong reason.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GITOPS-21 · Free • gitops mode › no gitops marker or gated control anywhere on the core pages

- **File:** [`playwright/tests/e2e/free/settings/gitops-mode.spec.ts`](../../tests/e2e/free/settings/gitops-mode.spec.ts)
- **Grep:** `npm run test:free -- -g "no gitops marker or gated control anywhere on the core pages"`
- **Project:** **free** · **Scopes:** n/a
- **Mode:** UI · **Isolation:** independent, read-only
- **Preconditions:** free-tier instance
- **Data created:** none

**Flow**

1. ☐ Open the dashboard (via URL).
   - ✅ *(UI)* First dashboard card visible.
   - ✅ *(UI)* No **GitOps mode** navbar link.
   - ✅ *(UI)* Zero `.gitops-mode-tooltip-wrapper` spans.
2. ☐ Open `/controls/scripts/library` (no `fleet_id` — free has no teams).
   - ✅ *(UI)* Scripts heading visible.
   - ✅ *(UI)* Zero gitops wrappers.
3. ☐ Open `/settings/organization/advanced`.
   - ✅ *(UI)* **Host lifecycle** heading visible.
   - ✅ *(UI)* Zero gitops wrappers.

**Assessment**
- *Value:* a leak check — it would catch a Fleet build that started rendering the gating chrome on free (a `useGitOpsMode` hook that stopped consulting the license, or a `config.gitops` subtree that came back populated on a free instance). Cheap, three navigations.
- *Coverage gaps:* the two non-dashboard pages are chosen because they are the premium suite's pattern-A and pattern-B surfaces, but on free the assertion is close to unfalsifiable: with the feature premium-gated, `config.gitops.gitops_mode_enabled` can never be `true`, so the wrappers *cannot* render. It is a guard against a hypothetical rather than a test of behaviour.
- *Redundancy:* the navbar check duplicates GITOPS-01/15 on the other tier.
- *Efficiency / smells:*
  - Three page-object fixtures (`dashboard`, `scriptsLibrary`, `organizationAdvanced`) resolved for one `toHaveCount(0)` each.
  - Each `goto()` anchors on a heading before the probe, which is what keeps the `toHaveCount(0)`s honest — worth preserving if anyone trims this test.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

## Area observations

**Coverage map**

| Feature / user flow | Covered by | Gap |
|---|---|---|
| Navbar indicator + its docs link | GITOPS-02 (present), GITOPS-01 / 15 / 21 (absent) | Non-admin roles (the badge degrades to plain text with no link — untested); persistence across navigation; `target="_blank"` |
| `YAML` → `repository_url` tooltip | GITOPS-03, and incidentally every `expectGatedByGitOps` call | The `repository_url`-empty third state, where the Fleets dropdown, the Fleets page and the command palette gate *differently* from a populated URL |
| Pattern A (native control) | GITOPS-03, 04, 07, 08, 10; recovery in GITOPS-16 | Controls › OS settings, OS updates, SSO, MDM, Policies, Reports, Software title details — all pattern A, all uncovered (deliberately: same pattern, breadth not signal) |
| Pattern B (Fleet `Checkbox`) | GITOPS-05; recovery in GITOPS-17 | Policies list row / select-all checkboxes; Setup-experience Install-software row checkboxes |
| Pattern C (react-select) | GITOPS-06; recovery in GITOPS-18 | Only one instance in the product is tested, and it is located by class with a `.first()` |
| Pattern D (raw `disabled`, no wrapper) | GITOPS-04 (org name, no tip), GITOPS-06 (Add fleet, tip from a plain `TooltipWrapper`) | SSO whole-form `.disabled-by-gitops-mode`; OS-updates `target` field |
| Over-gating (must stay enabled) | GITOPS-05, 07, 08, 09 | Controls › Variables' split gating (`Add variable` disabled / `Delete <name>` enabled) — called the best over-gating detector in the design, parked for want of a create helper; Profiles' **View details / Edit / Download**; Hosts list actions; Software **Add software** |
| Escape hatch (Change management never gated) | GITOPS-09 (mode on), GITOPS-19 (mode off) | The UI *write* path — tick an exception, Save, assert the toast and the activity copy. `ChangeManagementPage.save()` is modelled and unused |
| `exceptions.labels` | GITOPS-10 (gated), GITOPS-11 (excepted) | The `/labels/manage` row **Delete** action (a fifth DOM shape: `aria-disabled` on a role-less option); **Edit label** / **Delete label** on `/hosts/manage/labels/:id` |
| `exceptions.secrets` | GITOPS-12 (both directions, one test) | GITOPS-13 skipped — the only documented entry point ignores the exception ([fleetdm/fleet#48218](https://github.com/fleetdm/fleet/issues/48218)) |
| **`exceptions.software`** | **nothing** | Parked deliberately. Both probed surfaces were blocked (the Setup-experience Install-software form needs a DOM-level re-check — see the withdrawal note below; the Software-title Library accordion needs a seeded installer), and the one zero-seed surface that honours it (the FMA details form) needs an API resolver for an app not yet added to the fleet. **One third of the exception axis has no coverage at all.** |
| Teardown / recovery | GITOPS-14 (API), 15–19 (UI), plus `gitops-mode-teardown` and `cleanup-setup` | `repository_url` is never read back, though preserving it is the one thing `disableGitOpsMode` explicitly promises |
| Free-tier premium gate | GITOPS-20, 21 | The API-side gate (`PATCH /config` with a `gitops` subtree on free) is unasserted |
| **The `ActionButtons` bypass** | **nothing** | [fleetdm/fleet#54168](https://github.com/fleetdm/fleet/issues/54168): "More options" renders every secondary action **ungated** and CSS reveals it at ~900 px, a supported width. GITOPS-07 filters the duplicates away rather than asserting them |

**Duplication**

1. **GITOPS-01 vs GITOPS-15.** The same two assertions on the same page, fifteen tests apart. GITOPS-15 earns its place as the teardown verifier; GITOPS-01 is a "before" baseline on the one page where neither assertion discriminates.
2. **The gated/ungated mirror pairs.** GITOPS-03↔16, 05↔17, 06↔18, 09↔19. This is the design working as intended — one control per gating pattern, asserted in both directions — but it does mean eight of the nineteen premium tests are the same four pages twice.
3. **GITOPS-08 vs GITOPS-12 step 3.** `addSecretButton` is asserted gated twice per run, in two files, under the same config.
4. **GITOPS-07 vs GITOPS-13.** Same button on the same page; one asserts it gated, the other (skipped) would assert it un-gated under an exception.
5. **The tooltip mechanics** (absent → hover → visible → `href` → move away → absent) run inside every one of the twelve `expectGatedByGitOps` calls. Correct and cheap, but a manual re-runner should know they are re-testing the same tooltip twelve times.

**UI-vs-API balance**

- **Every state change in this area is an API write**, and that is the right call: the alternative is driving the Change-management form through the UI for every test, which would make each spec depend on the very form GITOPS-09 exists to protect. The cost is that the Change-management *write* path is never exercised — the suite can prove the card is interactive but not that saving it does anything.
- **`getGitOpsMode` in GITOPS-03 / 14 / 19 is a genuine contract check**, not a shortcut: `repository_url` is an input to a UI assertion (03), the flag is the thing under test (14), and the exceptions are compared against what the UI renders (19 — though see its assessment for how weak that comparison actually is).
- **Everything else is UI**, including all the negative assertions. The helper pair `expectGatedByGitOps` / `expectNotGatedByGitOps` is the strongest piece of infrastructure in the area: it pairs a positive assertion (the wrapper is present / absent) with the pattern-specific disabled check, so a locator that silently stops matching cannot read as "not disabled".
- **Weak-assertion watch list:** `gitopsWrappers(page).toHaveCount(0)` on the **dashboard** (GITOPS-01, 15 — passes in both mode states); `orgNameInput` `toBeDisabled()` with no paired unwrapped assertion (GITOPS-04); the exception loop in GITOPS-19 (compares the UI against the API response it just read, with no baseline); the free spec's wrapper probes (GITOPS-21 — cannot fail while the feature is premium-gated).

**Product-bug context a re-runner should carry**

Three findings came out of the design work; all three are worth knowing before you conclude a manual run found something new:

- [fleetdm/fleet#48218](https://github.com/fleetdm/fleet/issues/48218) — `Manage enroll secrets` ignores `exceptions.secrets`. **Open**, GITOPS-13 skipped for it.
- [fleetdm/fleet#54168](https://github.com/fleetdm/fleet/issues/54168) — the `ActionButtons` "More options" bypass at ~900 px. **Open**, worked around by a visibility filter in GITOPS-07.
- fleetdm/fleet#54169 — "`exceptions.software` leaves the Install-software form unsavable". **Withdrawn and closed as not reproducible** (2026-09-28). The re-check found that form's controls are disabled with GitOps mode entirely *off* too, so whatever disables it is unrelated. The original evidence was a dotted underline (TooltipWrapper styling), which says nothing about enabled state. **Do not re-file without a DOM check across all three states** (exception on / exception off / GitOps mode off).

**Quick wins**

1. **Fix GITOPS-19's stale comment, or make the assertion match it.** As written, a run that left an exception flipped passes. Either capture the exception baseline in `zz`'s `beforeAll` (before anything can have changed it) and compare against *that*, or rewrite the comment to say "UI agrees with the API", which is what it does. Right now the file claims a safety property the suite does not have — [zz-everything-is-back.spec.ts:84](../../tests/e2e/premium/gitops-mode/zz-everything-is-back.spec.ts#L84).
2. **Model `enableHostExpiry` on `OrganizationAdvancedPage`.** The same inline `getByRole('checkbox', { name: 'enableHostExpiry' })` appears in GITOPS-05 and GITOPS-17 while three sibling checkboxes on that page are already POM'd — [02-gated-surfaces.spec.ts:66](../../tests/e2e/premium/gitops-mode/02-gated-surfaces.spec.ts#L66), [zz-everything-is-back.spec.ts:54](../../tests/e2e/premium/gitops-mode/zz-everything-is-back.spec.ts#L54).
3. **Move GITOPS-09 out of the serial chain** (its own describe, or first in the file). The most important assertion in the area is currently skipped whenever any of the five upgrade-fragile gating checks ahead of it fails.
4. **Add the `repository_url` guard to `03-exceptions.spec.ts`'s `beforeEach`.** Specs 01 and 02 both assert it is non-empty with a clear message; spec 03 does not, so on a mis-configured instance it fails with a `TypeError` from `new URL('')` inside the tooltip helper instead.
5. **Assert the `ActionButtons` bypass rather than filtering it away.** A `toHaveCount(1)` on the unfiltered `getByRole('button', { name: 'Rename fleet', exact: true })` would fail today (there are two), encoding #54168 the way the blocked-flows workflow intends — so Fleet's fix turns CI red and prompts dropping the `.filter({ visible: true })` in GITOPS-07 and GITOPS-13.
6. **Use `ChangeManagementPage` in the free spec.** All six locators in GITOPS-20 are inline duplicates of POM properties, including the `exceptLabels` / `exceptSoftware` / `exceptSecrets` field names — the exact strings most likely to change in a Fleet refactor, currently written in two places.
7. **Declare GITOPS-13's skip at the declaration level** so its `beforeEach` / `afterEach` stop making two config writes for a test that never runs.

**Bigger bets**

1. **Cover `exceptions.software` — it is a third of the axis and it has nothing.** The blocker is seeding: the surfaces that honour it need an installed software title or an FMA resolver. With `cleanup-setup` wiping software before the run and `gitops-mode` running *after* the premium project, the cheapest route is a serial seed step at the top of the project that adds one small package over the API, asserts the Library accordion's **Delete this version** is gated, flips `exceptions.software`, re-asserts it live, and deletes the title. That is one upload's worth of runtime for the only exception with zero coverage — and the entity whose breakage ("customers locked out of software management while gitops mode is on") is the most expensive of the three.
2. **Add a viewport axis instead of a visibility filter.** The `ActionButtons` bypass is real, reachable and currently invisible to the suite. One test at 900 px on the fleet-settings page — assert **More options** is visible and its entries are gated — would turn #54168 from a comment into a regression net, and would generalise: `ActionButtons` is used on host details and software details too, so the same bypass shape exists on pages this area does not touch.
3. **Decide what "the exception axis" is worth and test it through the UI once.** Every exception today is set over the API, which means the Change-management form's write path — the only way a customer ever sets one — is asserted as *interactive* and never as *working*. One test that ticks **Labels**, clicks **Save**, asserts the `Successfully updated settings` toast, and then observes `/labels/new` unlocked would cover the form, the persistence and the exception in one flow, and would make GITOPS-09's "the way back out" claim true end to end rather than structurally.
4. **Track `.gitops-mode-tooltip-wrapper` as a preflight constant.** Nineteen tests fail at once if Fleet renames that BEM base. That is loud and therefore survivable, but [GITOPS-PLAN §11.2](../qawolf-migration/round-2/GITOPS-PLAN.md) asked for it to be added to the `fleet-upgrade-preflight` watch list and it is worth confirming that happened before the next upgrade — this area is the suite's single largest concentration of class-dependent locators, and it runs last, when a run is already hours old.
