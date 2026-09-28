# GitOps mode — suite design

Batch G, second half. Design for `tests/e2e/premium/gitops-mode/`, its Playwright project, its
helpers, and its teardown.

Read [G-out-of-band.md](G-out-of-band.md) for the batch rules and
[DECISIONS §5](DECISIONS.md#5-gitops-mode-scope) for the scope analysis this document validates,
corrects and sizes.

**Every claim below is tagged.** `[live]` = verified against a Fleet **4.93.0-rc premium** instance by
driving the UI and flipping `config.gitops` over the API. `[src]` = read out of
`~/repositories/fleet/frontend` and not exercised in a browser. Nothing here is asserted from memory.

---

## 1. Headline

Three things this exploration changes about the plan:

1. **The disabled state is not one signature, it's four.** A shared "assert this control is gated"
   helper can't key on a single attribute or a single wrapper. §3 gives the four and the one thing
   they do have in common.
2. **The exceptions axis is broken in at least one place, and DECISIONS' map of it is incomplete.**
   `exceptions.software` unlocks two checkboxes on Controls › Setup experience › Install software but
   leaves the row checkboxes *and the Save button* on the same form disabled — the form becomes
   editable and unsavable. `[live]` + `[src]`. Separately, `exceptions.secrets` doesn't reach the
   "Manage enroll secrets" button that opens the only UI surface honouring it. `[live]` + `[src]`
   See §8.
3. **The breadth-first recommendation survives, but the unit changes.** "One representative control
   per area" is wrong for Software and Hosts, where the list pages render *zero* gated controls and
   the gating lives two clicks deep. The right unit is "one representative control per *gating
   pattern* per area". See §5.

Plus one reachable bypass (§8.3) and one stale count: DECISIONS says 93 files render the wrapper;
today's checkout has **88** `[src]`, and the exception call sites are **21** `entityType=` props, not
23 — but there are a further **15** direct `useGitOpsMode("<entity>")` calls DECISIONS never counted,
so the real exception surface is **36 sites**, not 23. `[src]`

---

## 2. The mechanism, precisely

### 2.1 The hook

`frontend/hooks/useGitOpsMode.ts` `[src]`:

```ts
const enabled  = !!config?.gitops?.gitops_mode_enabled;
const excepted = entity ? !!config?.gitops?.exceptions?.[entity] : false;
return { gitOpsModeEnabled: enabled && !excepted, repoURL: config?.gitops?.repository_url };
```

So `exceptions.X = true` means *"gitops mode is off for X"*. The naming is inverted relative to
intuition and the UI ("Exceptions: ☑ Labels" = labels are **not** gitops-managed). Get this backwards
in a helper and every exception test passes for the wrong reason.

### 2.2 gitops mode is a UI-only setting

The Change-management card's own tooltip says so: *"GitOps mode is a UI-only setting. API permissions
are restricted based on user role."* `[live]` Confirmed operationally: every `PATCH /api/v1/fleet/config`,
every read, and the whole cleanup surface kept working with gitops mode on. `[live]`

Two consequences for the suite:

- `cleanup-teardown` still works with gitops mode left on. The risk of a stuck flag is that the *next
  run's UI specs* all fail, not that cleanup breaks.
- The flip helper is an API call, never a UI flow — except in the one spec that tests the UI flow.

### 2.3 Who renders what

88 files render `GitOpsModeTooltipWrapper` `[src]`:

| Area | Files | Live-verified page(s) |
|---|---:|---|
| Controls — OS settings 10, Setup experience 7, Scripts 3, Variables 3, OS updates 2 | 25 | config profiles, scripts, variables, OS updates, setup-experience install-software `[live]` |
| Settings › Integrations (MDM, SSO, CAs, calendars, webhooks, IdP, provisioning) | 21 | MDM, SSO `[live]` |
| Settings › Org settings | 10 | Info, Advanced `[live]` |
| Software (add, details, deploy, versions, automations) | 9 | title details + library accordion `[live]` |
| Settings › Fleets (table, team settings, agent options) | 5 | fleets list, fleet settings `[live]` |
| Policies (form, table, automations, patch CTA) | 5 | policies list, new policy `[live]` |
| Shared components (enroll secrets ×2, FileUploader, FileDetails, ActionButtons) | 5 | enroll-secret modal `[live]` |
| Reports / queries (form, table, automations) | 3 | new report `[live]` |
| Hosts (filter block, activity automations, script details) | 3 | hosts + label filter `[live]` |
| Labels (new label page, label form) | 2 | /labels/new, /labels/manage `[live]` |

**And 31 files read `config.gitops.gitops_mode_enabled` directly, bypassing the hook** `[src]`. 24 of
those also render the wrapper (mixed in one file — e.g. `OrgSettingsPage/cards/Info/Info.tsx` wraps
its Save but sets `disabled={gitOpsModeEnabled}` straight onto the org-name input). 7 never use the
hook at all: `SiteTopNav`, `FleetsDropdown`, `CommandPalette/groups/derivations.ts`,
`ManageFleetsPage`, `ManagePoliciesPage`, `VppTable`, `AddTicketDestinationModal`.

Those 31 are structurally incapable of honouring an exception. Today none of them gate an excepted
entity, so it's latent, not broken — but it's the mechanism by which a future exception silently
fails to apply.

---

## 3. What "disabled" looks like — the four signatures

The wrapper calls `renderChildren(true)`; **the child decides what disabled means.** All four were
observed live.

| # | Pattern | DOM | `toBeDisabled()` works? | Example `[live]` |
|---|---|---|---|---|
| A | Native control inside the wrapper | `button[disabled]` / `input[disabled]`, plus class `button--disabled` | yes | "Add profile", "Save", "Delete this version" |
| B | Fleet `Checkbox` inside the wrapper | hidden `input[type=checkbox][disabled]` + `div[role=checkbox][aria-disabled=true]` | yes — Playwright's `kAriaDisabledRoles` includes `checkbox` | Org › Advanced "Host expiry", policies row select |
| C | react-select inside the wrapper | `div.actions-dropdown-select--is-disabled`, no `aria-disabled`, no accessible name; only a hidden `input[disabled]` | **no** | Settings › Fleets row Actions |
| D | Raw `disabled` with **no wrapper** | `input[disabled]` / `button[disabled]`, sometimes an ancestor `.disabled-by-gitops-mode` | yes, but no tooltip | Org › Info `orgName`, SSO form, OS-updates `target`, Settings › Fleets "Add fleet" |

### 3.1 The one invariant

`.gitops-mode-tooltip-wrapper` — a `<span id="gitops-mode-tooltip-wrapper-N" class="gitops-mode-tooltip-wrapper
gitops-mode-tooltip-wrapper--hug|--inputfield">` — **exists in the DOM if and only if gitops mode is
effectively enabled for that control**, exception included. With the flag off, or the entity excepted,
the wrapper is not rendered at all; children render bare. `[live]`, verified in both directions on
Org › Info, Software title details, /labels/new and the enroll-secret modal.

That makes the wrapper's presence the cleanest exception assertion there is:

```ts
// mode on, software not excepted
await expect(deleteVersion).toBeDisabled();
await expect(page.locator('.gitops-mode-tooltip-wrapper')).toHaveCount(1);
// exceptions.software = true → wrapper gone, control live
await expect(deleteVersion).toBeEnabled();
await expect(page.locator('.gitops-mode-tooltip-wrapper')).toHaveCount(0);
```

It is a class selector, so it needs the inline-comment justification the suite requires. It earns it:
Fleet emits no role, no accessible name and no attribute on this span, and no other element in the app
carries the marker.

### 3.2 The tooltip

`getGitOpsModeTipContent(repoURL)` renders `Manage in YAML` + a `CustomLink` + `(GitOps mode enabled)`.
Live: `[live]`

- Element: `div[role="tooltip"]`, class contains `gitops-mode-tooltip-wrapper__tip-text`.
- Text content: `Manage in YAML(GitOps mode enabled)` (no space — two `<span>`s with a `<br>`).
- Link: accessible name **`YAML`**, `target="_blank"`, `href="https://google.com/"`.
- **It is only in the DOM while shown** — 0 `[role=tooltip]` nodes on a fresh load. `delayShow` is
  250 ms, `delayHide` 250 ms.

Three gotchas, all live-verified:

1. **`href` is normalised.** `new URL(repoURL).toString()` turns `https://google.com` into
   `https://google.com/`. Asserting `toHaveAttribute('href', repoURL)` fails. Compare with
   `new URL(repoURL).toString()`, or assert `toHaveAttribute('href', new RegExp(...))`.
2. **The same tooltip content ships without the wrapper class.** Settings › Fleets "Add fleet" is
   pattern D and gets its tip from a plain `TooltipWrapper` fed by `getGitOpsModeTipContent` — same
   text, same link, class does *not* contain `gitops-mode-tooltip-wrapper__tip-text`. A shared helper
   must match on content, not class.
3. **Hovering the control can be blocked.** On Settings › Fleets, `button:has-text("Add fleet").hover()`
   fails with *"`div[data-tip] .component__tooltip-wrapper__element` intercepts pointer events"* — the
   tooltip wrapper sits over the disabled button. Hover the wrapper, not the button. For pattern-B
   fields the wrapper re-anchors to `.form-field__label` / `.form-field > label`, so hover the **label
   text**, not the input and never the help text (`.form-field__help-text` is deliberately excluded —
   there's a unit test for it).

### 3.3 The navbar indicator `[live]`

```html
<a class="gitops-mode-indicator__link" href="/settings/integrations/change-management">GitOps mode</a>
```

- `getByRole('link', { name: 'GitOps mode' })` — global admins only; other roles get plain text `[src]`.
- Hover tooltip: `Items managed in YAML are read-only.` + link **`Learn more`** →
  `https://fleetdm.com/learn-more-about/ui-gitops-mode`, `target="_blank"`.
- Note this is the **product docs** URL, not `repository_url`. The two YAML links in the product point
  at different things; QA Wolf's "learn more url" flow and "yaml links lead to repository_url" flow are
  testing two different links and both are worth keeping separate.

### 3.4 Where else a YAML link appears `[live]` unless noted

| Surface | Link | Destination |
|---|---|---|
| Any gated control's tooltip | `YAML` | `repository_url` (normalised) |
| Navbar indicator tooltip | `Learn more` | `fleetdm.com/learn-more-about/ui-gitops-mode` |
| Settings › Fleets "Add fleet" tooltip | `YAML` | `repository_url` |
| Labels table row Actions → disabled "Delete" tooltip | `YAML` | `repository_url` (tooltip content from `getGitOpsModeTipContent`) |
| Change-management card description | `Learn more about GitOps` | `fleetdm.com/learn-more-about/gitops` |
| `ManageLabelsPage`, `AppleBusinessManagerTable`, `VppTable`, `SoftwareDetailsSummary`, `PackageForm`, `useSoftwareInstallerMeta` | `YAML` | `repository_url` `[src]` |

---

## 4. What stays enabled

This is the half that matters most, and the live sweep found more of it than DECISIONS predicted.

| Surface | Stays enabled in gitops mode | Evidence |
|---|---|---|
| Fleet settings page | **Add hosts** (primary action — not `gitOpsModeCompatible`) | `[live]` + `[src]` |
| Settings › Org › **Advanced** | **Save**, plus `Domain`, `Verify SSL certs`, `Enable STARTTLS` — the page is only *partially* gated, and the wrapper has a prop comment saying so | `[live]` |
| Controls › Variables › Global | **Delete `<name>`** — source comment: *"Delete is allowed in GitOps mode, matching prior behavior."* | `[live]` + `[src]` |
| Controls › OS settings › Profiles | **View details**, **Edit**, **Download** per row (Edit opens a modal whose Save *is* gated) | `[live]` |
| Controls › Scripts | **Download `<name>`**, the script-name link (but **Edit is disabled** here — asymmetric with profiles) | `[live]` |
| Software › inventory / library | **Add software**, and the whole page: **zero** wrappers render | `[live]` |
| Software title details | **Edit software** (modal Save gated), **All hosts**, version links | `[live]` |
| Labels › Manage | **Add label**, row **Edit** (only row **Delete** is gated) | `[live]` |
| Policies › Manage | **Add policy**, **Manage automations** (only the row/select-all checkboxes are gated) | `[live]` |
| Policy / Report edit form | **Run policy** / **Live report**, the SQL editor | `[live]` |
| Enroll-secret modal | **Copy to clipboard**, **Show secret**, **Done** | `[live]` |
| Hosts list | **Add hosts**, **Export hosts**, **Edit columns**, **Hosts page settings**, **Remove `<label>` filter** — zero wrappers on the page itself | `[live]` |
| Settings › Integrations › MDM | **Edit**, **Setup**, **Connect** (navigation into sub-pages) | `[live]` |
| Settings › Integrations › **Change management** | **everything** — the gitops toggle, the repo URL, all three exception checkboxes, **Save**. Not gated, by necessity: this is the only way out. | `[live]` + `[src]` |
| Dashboard | **Manage automations**, **Configure chart filters** (gating is inside the modal) | `[live]` |
| Command palette | every entry except **Add fleet**, which is filtered out entirely | `[src]` |
| Fleets dropdown | the **Add fleet** affordance is *hidden*, not disabled | `[src]` |

**The Change-management card is the single most important "stays enabled" assertion in the suite.**
If it ever gets gated, gitops mode becomes a one-way door and the teardown can't recover through the
UI. It belongs in the always-on spec, not an optional one.

---

## 5. Coverage matrix

Axes: **area × control × (mode off · mode on · mode on + exception)**.

`—` = cell doesn't exist (no exception applies). `skip` = cell exists but isn't worth a test; the
reason is in the last column.

### 5.1 Area sweep (exceptions all off)

| # | Area | Representative control | Pattern | off | on | Worth it? |
|---|---|---|---|---|---|---|
| A1 | Controls › OS settings | `Add profile` + `Delete <name>` row action | A | enabled | **disabled + tip** | **yes** — richest Controls card, 10 files |
| A2 | Controls › Scripts | `Add script`, `Edit <name>`, `Delete <name>` | A | enabled | **disabled** | **yes** — and it pins the profiles/scripts Edit asymmetry |
| A3 | Controls › OS updates | `Save` | A | enabled | **disabled** | yes — cheap, and covers the D-pattern field disable alongside |
| A4 | Controls › Variables | `Add variable` **disabled** / `Delete <name>` **enabled** | A + none | both enabled | **split** | **yes** — the single best over-gating regression detector in the suite |
| A5 | Controls › Setup experience › Install software | row checkbox, `Cancel setup if software fails`, `Save` | B, B, A | enabled | **disabled** | **yes** — and it's the software-exception cell, see E2 |
| A6 | Settings › Org › Info | `Save` (A) + `orgName` input (D) | A + D | enabled | **disabled** | yes — cheapest demo of A and D side by side |
| A7 | Settings › Org › Advanced | `Host expiry` checkbox **disabled**, `Domain` + `Save` **enabled** | B + none | all enabled | **split** | **yes** — partial-form gating; a naive "Save is always disabled" test is wrong here |
| A8 | Settings › Integrations › SSO | whole form `.disabled-by-gitops-mode`, `Save` wrapped | D + A | enabled | **disabled** | yes — the whole-form pattern |
| A9 | Settings › Integrations › MDM | `Upload` (EULA), `Save` (end-user migration); `Edit`/`Setup`/`Connect` stay enabled | A | enabled | **split** | yes — 21 files, biggest area by count |
| A10 | Settings › Fleets (list) | `Add fleet` (D, tooltip without the wrapper class) + row Actions (C) | D + C | enabled | **disabled** | **yes** — only place C and no-wrapper-tooltip D appear together |
| A11 | Settings › Fleets (detail) | `Manage enroll secrets` / `Rename fleet` / `Delete fleet` disabled; `Add hosts` **enabled** | A | all enabled | **split** | **yes** — QA Wolf's original assertion; keep it |
| A12 | Policies | list row + select-all checkboxes disabled, `Add policy` enabled; form `Save` disabled | B, A | enabled | **split** | yes |
| A13 | Reports | `Save` on the edit form disabled; `Live report` enabled | A | enabled | **split** | yes |
| A14 | Hosts | `Edit label` / `Delete label` on `/hosts/manage/labels/:id` | A | enabled | **disabled** | yes — the only gated control in the Hosts area reachable without a modal; also the labels-exception cell |
| A15 | Labels | `/labels/new` `Save` disabled; `Add label` and row `Edit` enabled; row `Delete` disabled | A | enabled | **split** | yes |
| A16 | Software | `Delete this version` in the library accordion | A | enabled | **disabled** | yes — **not** the list page; see note |
| A17 | Shared › enroll secrets | `Add secret`, `Edit enroll secret`, `Delete enroll secret` | A | enabled | **disabled** | yes |
| A18 | Navbar | `GitOps mode` link + tooltip + `Learn more` href | link | **absent** | **present** | yes |
| A19 | Change management card | toggle, repo URL, 3 exception checkboxes, `Save` | none | enabled | **enabled** | **yes — highest value** |
| — | Dashboard activity automations modal | modal internals | A `[src]` | | | **skip** — one control behind a modal, same pattern as A13 |
| — | Host details script-details modal | `[src]` | | | | **skip** — needs a real host + a run script; cost ≫ signal |
| — | Settings › Fleets › Agent options | `[src]` | | | | **skip** — same pattern as A11, same page tree |
| — | Certificate authorities / calendars / webhooks / IdP / account provisioning | `[src]` | | | | **skip** — A8 and A9 already cover both Integrations patterns; adding 5 more is the per-area-depth shape we rejected |

**Why Software's cell is not the list page.** Both `/software/inventory` and `/software/library`
render **zero** gitops wrappers `[live]`. "Add software" is enabled; "Manage automations" is disabled
*for an unrelated reason* (it requires the "All fleets" scope). A breadth-first test that opened the
software list and asserted "something is gated" would have found nothing and, worse, a test asserting
"Manage automations is disabled" would pass on a fleet scope with gitops mode **off**. The gating is
on the title-details page, inside the expanded Library accordion.

The same trap applies to Hosts: `/hosts/manage` renders zero wrappers; you must select a custom label
filter to reach one.

### 5.2 Exception matrix (depth)

This is the half with no coverage anywhere today. Each row was flipped in both directions live.

| # | Exception | Probe control | mode off | on, excepted **false** | on, excepted **true** | Verdict |
|---|---|---|---|---|---|---|
| E1 | `labels` | `/labels/new` → `Save` | enabled | **disabled**, 1 wrapper | **enabled**, 0 wrappers `[live]` | correct |
| E1b | `labels` | `/hosts/manage/labels/:id` → `Edit label` / `Delete label` | enabled | **disabled**, wrapped `[live]` | expect enabled | correct, test it |
| E1c | `labels` | `/labels/manage` row Actions → `Delete` (`aria-disabled` on a role-less option) | enabled | **aria-disabled**, gitops tip `[live]` | expect enabled | correct, test it |
| E2 | `software` | Software title → Library accordion → `Delete this version` | enabled | **disabled**, 1 wrapper | **enabled**, 0 wrappers `[live]` | correct |
| E2b | `software` | Controls › Setup experience › Install software → `Cancel setup if software fails` | enabled | **disabled** | **enabled** `[live]` | correct |
| E2c | `software` | …same form → row checkbox **and** `Save` | enabled | **disabled** | **still disabled** `[live]` | **BUG** — see §8.1 |
| E3 | `secrets` | `/hosts/manage?fleet_id=N&manage_enroll_secrets=1` → `Add secret` / `Edit enroll secret` / `Delete enroll secret` | enabled | **disabled**, 2 wrappers | **enabled**, 0 wrappers `[live]` | correct |
| E3b | `secrets` | Fleet settings → `Manage enroll secrets` button | enabled | **disabled** | **still disabled** `[live]` | **BUG** — see §8.2 |
| — | `secrets` × `EnrollSecretModal` second `Add secret` (the `modal-cta-wrap` copy) | | | | | skip — same component, same `entityType`, renders only when secrets exist |
| — | `software` × the other 11 `entityType="software"` sites (DeployModal, VersionsModal, FMA form, VPP/Android forms, automations modal, …) | `[src]` | | | | skip as *individual* tests; E2 + E2b + E2c prove the wiring and E2c proves the failure mode. Revisit if a regression lands in one of them. |

**Recommendation: DECISIONS' "breadth-first for areas, depth on exceptions" stands.** The live sweep
strengthens it — the exception axis produced two real bugs in the first hour, the area sweep produced
one (§8.3) and it's viewport-conditional. The only amendment is the unit (per gating pattern, not per
area) and the two areas whose representative control can't live on the list page.

### 5.3 Cells deliberately not tested

- **Free tier.** `gitops` is premium-gated (`ChangeManagement` renders `PremiumFeatureMessage` on free
  `[src]`). No free-tier spec.
- **Non-admin roles.** The indicator degrades from link to text for non-admins `[src]`; the gated
  controls are mostly already role-gated. Covering the role × gitops product is per-area depth by
  another name. Park it with a note here.
- **`repository_url` empty.** `FleetsDropdown`, `ManageFleetsPage` and the command palette all
  require `gitops_mode_enabled && repository_url` `[src]`, so an empty URL produces a *different*
  gating set from a populated one. That's a real third state — but the Change-management form
  validates the URL as required, so reaching it needs an API write. One assertion, listed as a
  stretch in §6.

---

## 6. Proposed specs

All under `tests/e2e/premium/gitops-mode/`. Ordering inside the project is alphabetical by file, and
that ordering is load-bearing: `zz-everything-is-back.spec.ts` must run last.

| Spec | Asserts | Source flows folded in |
|---|---|---|
| `01-indicator-and-links.spec.ts` | mode off → no `GitOps mode` link anywhere; turn on → navbar link present, href `/settings/integrations/change-management`, hover tooltip reads `Items managed in YAML are read-only.` and its `Learn more` points at `fleetdm.com/learn-more-about/ui-gitops-mode`. Then one gated control's tooltip: `Manage in YAML`, link named `YAML`, href `new URL(repoURL).toString()`. | `gitops-gitops-mode-in-navbar-and-learn-more-url`, `gitops-mode-yaml-links-lead-to-repository-url` |
| `02-change-management-card.spec.ts` | **The escape hatch.** With mode on, the Change-management form is fully interactive: toggle, repo URL input, all three exception checkboxes and `Save` are enabled. Then drive the *UI* flow once: tick `Labels`, Save, expect the success toast and `GET /config` reflecting `exceptions.labels = true`; untick and Save back. Also asserts the dashboard activity copy (`enabled the labels exception for GitOps.`). | new |
| `03-gated-areas-controls.spec.ts` | A1–A5. Per card: the named control disabled, the wrapper present, and at least one sibling still enabled (`Download`, `Delete <variable>`, `View details`). | `gitops-mode-gated-areas-of-the-ui-controls` |
| `04-gated-areas-settings.spec.ts` | A6–A11. Includes the two "partial" cases explicitly: Advanced's `Save` **enabled**, fleet-detail `Add hosts` **enabled**. | `gitops-mode-gated-areas-of-the-ui-settings` |
| `05-gated-areas-workflows.spec.ts` | A12–A17 (Policies, Reports, Hosts, Labels, Software, enroll secrets) — the areas where the gated control isn't on the landing page. | `gitops-mode-gated-areas-of-the-ui-hosts` |
| `06-exception-labels.spec.ts` | E1, E1b, E1c across off / on / on+excepted. | new |
| `07-exception-software.spec.ts` | E2, E2b, and **E2c as an expected-failure guard** — see §8.1 for how to encode it. | new |
| `08-exception-secrets.spec.ts` | E3, and **E3b** as a guard. | new |
| `09-stays-enabled.spec.ts` | The consolidated over-gating sweep: every row in §4 that isn't already asserted inline. One test, mode on throughout. | partly from the settings flow |
| `zz-everything-is-back.spec.ts` | §9. | new |

Nine specs plus the safety net. That's larger than G's "2 specs" placeholder and smaller than a
per-area-depth build.

**Structure.** `03`–`05` and `09` are `test.describe.configure({ mode: 'serial' })` with one sub-test
per area — the project is `workers: 1` anyway, and serial sub-tests give per-area failure attribution
without re-flipping the flag between them. `06`–`08` are *not* serial across the exception values;
each test flips the exception it needs in a `beforeEach` and the helper restores in `afterEach`, so a
crashed test can't leave an exception in the wrong state for the next one.

**Preconditions each spec must seed itself.** `cleanup-setup` drains global reports, global policies,
profiles, scripts and setup-experience state before the run. Specs `03`, `05` and `07` need a profile,
a script, a global variable, a custom label and a library software title to *have a row to assert on*.
Each seeds its own via `helpers/api/*` with gitops mode **off**, then flips. This is the single
biggest authoring cost in the batch — budget for it.

---

## 7. Helpers and POM

### 7.1 `helpers/api/gitops-mode.ts`

New module, exported from the `@helpers/api` barrel.

```ts
import type { APIRequestContext } from '@playwright/test';

export type GitOpsEntity = 'labels' | 'software' | 'secrets';

export interface GitOpsExceptions {
  labels: boolean;
  software: boolean;
  secrets: boolean;
}

export interface GitOpsModeConfig {
  gitops_mode_enabled: boolean;
  repository_url: string;
  exceptions: GitOpsExceptions;
}

/** Read `config.gitops` as Fleet currently has it. */
export function getGitOpsMode(request: APIRequestContext): Promise<GitOpsModeConfig>;

/**
 * Write the whole `gitops` subtree. PATCH /config merges at the top level but
 * replaces `gitops` wholesale, so every field is sent — a partial write drops
 * the exceptions.
 */
export function setGitOpsMode(
  request: APIRequestContext,
  next: GitOpsModeConfig,
): Promise<GitOpsModeConfig>;

/**
 * Turn gitops mode on with an explicit exception set. Defaults to all three
 * off, which is the fully-gated state most specs want. `repositoryUrl` defaults
 * to the value already on the instance so a spec can't silently blank it.
 */
export function enableGitOpsMode(
  request: APIRequestContext,
  opts?: { exceptions?: Partial<GitOpsExceptions>; repositoryUrl?: string },
): Promise<GitOpsModeConfig>;

/**
 * Turn gitops mode off. Idempotent and safe to call when it's already off —
 * the teardown project and the cleanup steps both call it unconditionally.
 */
export function disableGitOpsMode(request: APIRequestContext): Promise<void>;

/** Flip one exception without touching the others or the mode flag. */
export function setGitOpsException(
  request: APIRequestContext,
  entity: GitOpsEntity,
  excepted: boolean,
): Promise<GitOpsModeConfig>;

/**
 * Snapshot the whole subtree and hand back a restorer, mirroring the
 * snapshot/restore shape helpers/api/config.ts already uses for org info and
 * webhooks.
 */
export function withGitOpsMode(
  request: APIRequestContext,
  next: Partial<GitOpsModeConfig>,
): Promise<() => Promise<void>>;
```

Two deliberate choices:

- **`repository_url` is never defaulted to a literal.** The instance's own value is the fixture; a
  spec that hard-codes `https://google.com` would rewrite the QA instance's config and then assert
  against its own write.
- **`enableGitOpsMode` always sends all three exceptions.** Omitting them is how you get a test that
  passes because the previous test left the exception on.

### 7.2 The shared assertion helper

`pages/components/gitopsMode.ts`, exported from `@pages`. It is a component-object-shaped module, not
a page object — it has no page of its own.

```ts
import { Locator, Page, expect } from '@playwright/test';

/**
 * The marker span GitOpsModeTooltipWrapper renders. Fleet gives it no role, no
 * accessible name and no attribute, so the class is the only handle — and it is
 * a reliable one: the span exists in the DOM if and only if gitops mode is
 * effectively enabled for the control it wraps, exceptions included.
 */
const WRAPPER = '.gitops-mode-tooltip-wrapper';

/** How the wrapped child expresses "disabled". See GITOPS-PLAN.md §3. */
export type GitOpsDisabledStyle = 'control' | 'react-select';

/**
 * Assert a control is gated: it is disabled, it sits inside the gitops wrapper,
 * and hovering it shows the "Manage in YAML" tooltip pointing at repoURL.
 *
 * `hoverTarget` exists because the tooltip re-anchors: a wrapped FormField
 * anchors to its label row, and a control covered by a TooltipWrapper can't be
 * hovered directly at all. Pass the label or the covering wrapper there.
 */
export async function expectGatedByGitOps(
  control: Locator,
  repoUrl: string,
  opts?: { hoverTarget?: Locator; style?: GitOpsDisabledStyle },
): Promise<void>;

/**
 * Assert a control is NOT gated: enabled, and no gitops wrapper anywhere in its
 * ancestry. Use for both "mode off" and "entity excepted" — they render
 * identically, which is the point.
 */
export async function expectNotGatedByGitOps(control: Locator): Promise<void>;

/**
 * The tooltip alone, for the pattern-D controls that carry the gitops tip
 * without the wrapper (Settings > Fleets "Add fleet", the labels row Delete
 * option). Matches on content because the class differs per call site.
 */
export async function expectGitOpsTooltip(
  page: Page,
  hoverTarget: Locator,
  repoUrl: string,
): Promise<void>;

/** Count of gitops wrappers currently rendered — the cheapest whole-page probe. */
export function gitopsWrappers(page: Page): Locator;
```

Implementation notes that the signatures encode:

- `expectGatedByGitOps` with `style: 'control'` (default) uses `expect(control).toBeDisabled()`, which
  covers patterns A **and** B — verified from Playwright's own `kAriaDisabledRoles`, which includes
  `checkbox`, `button`, `link`, `combobox` and `option`, so `div[role=checkbox][aria-disabled=true]`
  reads as disabled.
- `style: 'react-select'` (pattern C) skips `toBeDisabled()` entirely and asserts
  `.actions-dropdown-select--is-disabled` inside the wrapper, because react-select exposes no
  disabled accessible element.
- The tooltip assertion is
  `expect(page.getByRole('tooltip').filter({ hasText: 'Manage in YAML' }))`, then
  `.getByRole('link', { name: 'YAML' })` with `toHaveAttribute('href', new URL(repoUrl).toString())`.
  Scoping by `filter` rather than a bare `getByRole('tooltip')` matters — Fleet pages render other
  tooltips and strict mode will bite.
- It must `expect(page.getByRole('tooltip')).toHaveCount(0)` first, then hover, so a tooltip left over
  from a previous assertion can't produce a false pass. `delayHide` is 250 ms; move the mouse away and
  let the web-first assertion retry rather than sleeping.

### 7.3 POM additions

Everything else already exists. The gaps:

| POM | Addition |
|---|---|
| `pages/components/Navbar.ts` | `gitopsIndicator` locator (`getByRole('link', { name: 'GitOps mode' })`) |
| new `pages/settings/ChangeManagementPage.ts` | `goto()`, `gitopsModeToggle`, `repositoryUrlInput`, `exceptionCheckbox(entity)`, `saveButton`. **Fleet's `Checkbox` names itself after the form field**, so the accessible name is `gitOpsModeEnabled` / `exceptLabels` / `exceptSoftware` / `exceptSecrets`, *not* the visible text `[live]`. Map the friendly entity name to the field name inside the POM so specs never see the raw string. |
| `pages/hosts/HostsListPage.ts` | `editLabelButton` / `deleteLabelButton` (`getByRole('button', { name: 'Edit label' })` — Fleet does set `ariaLabel` here `[live]`) |
| `pages/software/SoftwareTitleDetailPage.ts` | `libraryAccordion` + `deleteVersionButton`. The accordion header is a plain `div.library-item-accordion-list` with **no role** — expand it by clicking the item's name text inside that container `[live]`. |
| `pages/settings/TeamSettingsPage.ts` | `addHostsButton`, `manageEnrollSecretsButton`, `renameFleetButton`, `deleteFleetButton` |
| new `pages/components/EnrollSecretModal.ts` | `addSecretButton`, `editSecretButton`, `deleteSecretButton`, `copyButton`, `showSecretButton`, `doneButton`. Open it via `/hosts/manage?fleet_id=N&manage_enroll_secrets=1` — the router strips the param and leaves the modal open `[live]`. |
| `pages/controls/*` | The Controls POMs already carry `Add profile` / `Add script` / `Add variable`; add the per-row `Delete <name>` / `Edit <name>` locators where missing. |

---

## 8. Product findings

Three, in descending order of severity. All need Fleet issues filed under the
[blocked-flows workflow](../../blocked-by-product-bugs.md) before the matching spec ships.

### 8.1 `exceptions.software` leaves the Install-software form unsavable — **functional dead end**

`[live]` + `[src]` `pages/ManageControlsPage/SetupExperience/cards/InstallSoftware/components/InstallSoftwareForm/InstallSoftwareForm.tsx`

With `gitops_mode_enabled: true` and `exceptions.software: true`, on
`/controls/setup-experience/install-software/macos?fleet_id=N`:

- `Cancel setup if software fails` → **enabled** (its wrapper carries `entityType="software"`, lines
  290 / 315)
- the per-software row checkbox → **still disabled** (`InstallSoftwareTableConfig.tsx:53`, wrapper has
  **no** `entityType`)
- `Save` → **still disabled** (`InstallSoftwareForm.tsx` ~337, wrapper has **no** `entityType`)

So the exception unlocks one control on a form you cannot save and whose primary input is still
locked. Wrapper count went 3 → 2 when the exception was turned on; Save stayed `disabled: true,
wrapped: true` `[live]`.

**Spec encoding:** assert the *current* behaviour with a `TODO(fleetdm/fleet#NNNNN)` comment and a row
in `blocked-by-product-bugs.md`, so the test fails loudly when Fleet fixes it rather than silently
locking in the bug. Do **not** skip it — a skip here hides the whole exception from coverage.

### 8.2 `exceptions.secrets` can't be reached from its own entry point

`[live]` + `[src]` `pages/admin/ManageFleetsPage/TeamDetailsWrapper/TeamDetailsWrapper.tsx:427`

`Manage enroll secrets` is an `ActionButtons` entry with `gitOpsModeCompatible: true` and therefore a
`GitOpsModeTooltipWrapper` with **no `entityType`**. The modal it opens is the *only* surface that
honours `entityType="secrets"`. With `exceptions.secrets: true` the button is still disabled `[live]`,
so the exception is unreachable through the documented path.

It *is* reachable via the command palette / `?manage_enroll_secrets=1` deep link on the Hosts page,
which has no gitops gate `[live]` — which is how E3 is testable at all, and is itself an
inconsistency worth mentioning on the issue.

### 8.3 `ActionButtons`' "More options" menu bypasses gitops mode entirely

`[live]` + `[src]` `components/buttons/ActionButtons/ActionButtons.tsx`

The component renders each secondary action **twice**: as an inline `Button` (gated when
`gitOpsModeCompatible`) and again as an option in a `DropdownButton` labelled "More options" —
`options={secondaryActions}`, raw, **ungated**.

CSS shows one or the other. Measured on a fleet's settings page with gitops mode on `[live]`:

| viewport | inline buttons | "More options" | app shell |
|---|---|---|---|
| 1280 / 1200 px | visible, **disabled** | `display:none` | visible |
| 1000 px | visible, **disabled** | `display:none` | visible |
| **900 px** | `display:none` | **visible, enabled** | **visible** |
| 760 px | hidden | rendered | `.core-wrapper { display:none }` — "This screen size is not supported yet." |

At **900 px the app renders normally and the ungated menu is the only control shown.** Clicking
`More options → Rename fleet` opened the rename modal with an enabled name input and an enabled
`Save` `[live]` (cancelled without submitting). Same for `Manage enroll secrets` and `Delete fleet`.

This is a reachable bypass at a supported width, not a theoretical one. Worth filing on its own.

### 8.4 Lower-severity notes

- **`Edit` is asymmetric between Controls cards.** Profiles keep `Edit` enabled and gate the modal's
  Save; Scripts disable `Edit` outright `[live]`. Probably intentional (the script editor is the
  content, a profile's metadata isn't) but worth a question on the issue.
- **31 files read `config.gitops.gitops_mode_enabled` without the hook** `[src]`, so they cannot honour
  an exception. None gates an excepted entity today. It's the mechanism §8.1 is an instance of.
- **`repository_url` is part of the gate for three surfaces.** `FleetsDropdown`, `ManageFleetsPage` and
  the command palette all require `gitops_mode_enabled && repository_url` `[src]`, so with an empty URL
  "Add fleet" stays enabled while everything else is gated. Inconsistent, and a third state nobody has
  tested.

---

## 9. Project wiring

### 9.1 `playwright.config.ts` diff

Four edits. The first is the one that will bite if it's forgotten — `resolveSuite()` throws at config
load for any `--project` it doesn't recognise.

```diff
 const PROJECT_TO_SUITE: Readonly<Record<string, Suite>> = {
   premium: 'premium',
   'premium-setup': 'premium',
+  'gitops-mode': 'premium',
+  'gitops-mode-teardown': 'premium',
   free: 'free',
   'free-setup': 'free',
   loadtest: 'loadtest',
   'loadtest-setup': 'loadtest',
 };
```

```diff
     {
       name: 'premium',
       testDir: './tests',
       testIgnore: [
         '**/gitops-verify/**',
         '**/cli/nightly/**',
         '**/free/**',
         '**/loadtest/**',
+        // gitops mode is a global config write; it gets its own
+        // single-worker project that runs after this one finishes.
+        '**/gitops-mode/**',
       ],
```

```diff
+    // ── GitOps mode (runs last, single worker) ────────────────────────────────
+    // Enabling gitops mode disables the UI controls every other mutating spec
+    // depends on, so this project runs only after `premium` has finished and
+    // pins itself to one worker. The teardown turns the flag back off however
+    // the run ended.
+    {
+      name: 'gitops-mode-teardown',
+      testDir: './setup',
+      testMatch: /gitops-mode\.teardown\.ts/,
+    },
+    {
+      name: 'gitops-mode',
+      testDir: './tests/e2e/premium/gitops-mode',
+      workers: 1,
+      fullyParallel: false,
+      use: {
+        ...devices['Desktop Chrome'],
+        storageState: '.auth/premium-admin.json',
+      },
+      dependencies: ['premium'],
+      teardown: 'gitops-mode-teardown',
+      retries: 0,
+    },
```

```diff
   "scripts": {
     "test:premium": "SUITE=premium playwright test --project=premium",
+    "test:gitops-mode": "SUITE=premium playwright test --project=gitops-mode",
+    "test:gitops-mode:only": "SUITE=premium playwright test --project=gitops-mode --no-deps",
```

Notes on the choices:

- `fullyParallel: false` is explicit even though `workers: 1` already serialises: the top-level
  `fullyParallel: true` would otherwise split a file's tests across the (single) worker's task queue in
  an order the specs don't control, and `02`/`zz` ordering matters.
- `retries: 0`. A retry re-enters a test whose `beforeEach` assumes a known exception state; the
  teardown/restore pairs make a retry safe in principle, but a gitops failure should be read, not
  papered over. It also matches `gitops-verify` and `gitops-nightly`.
- `dependencies: ['premium']` means `npm run test:gitops-mode` runs the **whole premium suite** first.
  That's correct for the nightly and unusable for local iteration — hence the `:only` script.
- Playwright runs a project's `teardown` after the project *and everything depending on it* completes,
  so `premium`'s existing `cleanup-teardown` now runs after `gitops-mode`. That's fine: the cleanup is
  pure API and gitops mode is UI-only `[live]`. But it does mean `cleanup-teardown` may run with the
  flag still on if `gitops-mode-teardown` ordering surprises us — which is the second reason for §9.2.

### 9.2 The teardown, and why it isn't enough on its own

`setup/gitops-mode.teardown.ts`:

```ts
import { test } from '@playwright/test';
import { disableGitOpsMode, getGitOpsMode } from '@helpers/api/gitops-mode';

test('disable gitops mode', async ({ request }) => {
  await disableGitOpsMode(request);
  const after = await getGitOpsMode(request);
  expect(after.gitops_mode_enabled).toBe(false);
});
```

A Playwright teardown project does not run on `SIGKILL`, on a machine losing power, or if the config
itself throws. The failure mode is the worst one in the suite: the *next* run's entire premium project
fails, and it fails in a way that looks like 400 unrelated UI regressions.

**So belt and braces: add the same call to `setup/cleanup.steps.ts`.** That file is already the
"self-heals the instance regardless of how state got there" project and already runs as a dependency
of both `premium` and `free`:

```diff
 test('wipe unassigned state', async ({ request }) => {
+  // gitops mode is a global UI lock; a previous run that died before its
+  // teardown leaves every mutating spec in this run disabled. Clearing it here
+  // makes the run self-healing the same way the resource wipes do.
+  await disableGitOpsMode(request);
   await resetSetupExperience(request, 0);
```

Two calls, two lifecycles: the teardown restores promptly and asserts; `cleanup-setup` guarantees the
next run starts clean no matter what. **This is the single most important change in the batch.**

One caveat to record: `disableGitOpsMode` must not touch `exceptions` or `repository_url`. Turning the
mode off while blanking the URL would silently change the QA instance's config, and §8.4 shows the URL
is itself part of the gate for three surfaces.

---

## 10. The "everything is back" spec

`tests/e2e/premium/gitops-mode/zz-everything-is-back.spec.ts`. The `zz-` prefix is doing real work —
with `workers: 1` and `fullyParallel: false`, Playwright runs files in the order it discovers them, so
the name is the ordering mechanism.

**What "core" means here.** Not an exhaustive sweep — that's specs `03`–`05` run backwards, and it
doubles the project's runtime for a check whose job is to be fast and unambiguous. The set is *one
control per gating pattern, plus the escape hatch, plus the global marker*. Six assertions, one
navigation each, under a minute.

```
beforeAll: disableGitOpsMode(request)      // the thing under test is that this worked

1. Navbar            — no link named "GitOps mode" on the dashboard        (global marker, pattern: link)
2. Whole-page probe  — gitopsWrappers(page).toHaveCount(0) on each page visited
3. Controls          — /controls/scripts  → "Add script" enabled           (pattern A)
4. Settings › Org    — /settings/organization/advanced → "Host expiry"
                       checkbox enabled                                     (pattern B, aria-disabled)
5. Settings › Fleets — /settings/fleets → "Add fleet" enabled, and no
                       role=tooltip containing "Manage in YAML" on hover    (pattern C + D, no-wrapper tooltip)
6. Change management — toggle unchecked, all three exception checkboxes
                       match GET /config, Save enabled                      (escape hatch + API/UI agreement)
```

Why these six:

- **1 + 2** catch a teardown that wrote the flag but the app cached it, or a partial write.
- **3, 4, 5** are the three signatures that fail differently. A native button, an `aria-disabled` div
  and a react-select each recover independently; asserting only buttons would miss a half-restored
  render.
- **5** also asserts the *absence* of the tooltip, which is the only way to catch a control that came
  back enabled but kept its gitops tip — the state a stale `config` in `AppContext` produces.
- **6** is the one that makes the suite recoverable by hand. If it fails, a human still needs the UI
  to fix the instance.

It also re-reads `GET /config` and asserts `gitops_mode_enabled === false` **and** that all three
exceptions are exactly where the spec found them at `beforeAll` of spec `02` — so a spec that flipped
an exception and died before restoring is caught here rather than in next week's triage.

**This spec must pass even if every spec before it failed.** It takes no state from them, seeds
nothing, and calls `disableGitOpsMode` itself rather than trusting the teardown project. It is a
verifier, not a beneficiary.

---

## 11. Risks and open questions

1. **`dependencies: ['premium']` makes local iteration cost a full suite run.** Mitigated by
   `test:gitops-mode:only` (`--no-deps`), but the skill's own rule is "run it at least once *with*
   dependencies". Budget one full-chain run per PR, not per edit.
2. **The `.gitops-mode-tooltip-wrapper` class is a single point of failure.** Every exception
   assertion leans on it. If Fleet renames the BEM base, all nine specs fail at once — which is loud
   and therefore acceptable, but it belongs in the `fleet-upgrade-preflight` watch list as a tracked
   constant. Add it.
3. **The seeding cost is real.** Five specs need a row to assert on (profile, script, variable, custom
   label, library title) and `cleanup-setup` deletes all of them before the run. If seeding turns out
   to dominate the runtime, the fallback is one shared serial seed step at the top of the project —
   at the cost of cross-test coupling the suite otherwise avoids.
4. **Pattern C has no accessible handle at all.** Settings › Fleets row actions can only be asserted
   via `.actions-dropdown-select--is-disabled` inside the wrapper. If that react-select class changes
   on a dependency bump, the assertion silently stops finding anything. Pair it with a positive
   assertion (the wrapper is present) so a vanished class can't read as "not disabled".
5. **Encoding §8.1 and §8.2 as passing tests bakes in a bug.** The alternative — skip them — loses the
   exception coverage entirely. Recommendation is to assert current behaviour with a
   `TODO(fleetdm/fleet#NNNNN)` and a `blocked-by-product-bugs.md` row, so the fix breaks the test. File
   the issues first; "make it green" is not the fix.
6. **Open: does anything gate on `repository_url` being empty that shouldn't?** Three surfaces do
   `[src]`. Worth one probe before deciding whether it needs a spec.
7. **Open: role × gitops.** The indicator degrades for non-admins and maintainers see a different
   control set. Parked, deliberately — but if the suite ever grows a gitops-mode role matrix, it
   belongs in `tests/api/role-access/` alongside the existing per-role probes, not here.
8. **Stale numbers in DECISIONS §5.** 93 files → **88**; 23 `entityType` call sites → **21** props
   plus **15** direct hook calls with an entity argument (36 total). The per-area table in DECISIONS is
   otherwise accurate. Worth a one-line correction there when this ships.
