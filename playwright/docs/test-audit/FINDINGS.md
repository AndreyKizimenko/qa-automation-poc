# Findings — quick wins and where to take this suite

Companion to the [per-area audit](README.md). Written 2026-07-29 against `main` @ `a420f1c`.

Claims marked **✅ verified** were checked directly against source while assembling this
document. Everything else is the area audit's reading — high-confidence, but confirm it
during the manual pass before acting on it.

---

## 1. The honest verdict

**The mechanical quality of this suite is already good.** Zero `waitForTimeout`,
`waitForLoadState`, or `waitForSelector` anywhere in the specs. One raw class locator in a
spec body across 8,564 lines. No inline auth headers, no `fetch()`, no duplicate console
listeners. Everything routes through page objects. The conventions in `CLAUDE.md` are
actually followed. Most suites this size fail those checks badly.

So the maturity work isn't cleanup. It's three other things:

1. **The suite proves pages *render* far more than it proves they're *right*.**
   266 of ~700 assertions (38%) are `toBeVisible()`. Content assertions
   (`toHaveText` / `toContainText` / `toHaveValue`) total ~117. Several page-object
   methods written specifically to verify saved values are **called by no spec** —
   `ReportEditPage.expectValues()`, the platform half of `PolicyEditPage.expectValues()`.
2. **A large fraction of runtime is spent re-running the same code path.** The free tree
   is ~85% a transcription of the premium tree in users; all 10 policy `sql-validation`
   free mirrors exercise tier-agnostic React components with zero server calls;
   `save-as-new` and `organization-info` are byte-identical across tiers.
3. **A handful of tests can pass while the product is broken.** Those matter more than
   everything else in this document, so they're first.

One framing note: several entries are unfalsifiable rather than wrong — they assert
something that is true regardless of whether the feature works (`rowOrEmpty()` after a
delete, `toHaveCount(0)` scoped to page 1, absence-only paywall checks). A test that
cannot fail is worse than no test, because it buys confidence you don't have.

---

## 2. Tests that can pass while the product is broken

Fix these first; they're small and they invalidate green runs.

| # | What | Where | Why it's wrong |
|---|---|---|---|
| 1 | **Label delete asserts absence on page 1 only** ✅ *Fixed 2026-10-02 (round 3 batch A): both deletes now page the list with `locateRow`; the spec moved to `shared/labels/`.* | `labels.spec.ts` delete steps (then `premium/labels/`) | `rowFor(name)` matches the *current* page; the list pages at 20. The spec's own header (line 8) says a label "can land on a later page; `locateRow` pages to it" — and create/edit *do* use `locateRow`. The one assertion that must prove absence is the only one that can't see past page 1. A failed delete passes green. |
| 2 | **The deny half of the role matrix passes vacuously on a stale token** ✅ | [role-access.ts:35-78](../../helpers/api/role-access.ts#L35-L78) | `expectDeny` accepts `{401,403}`. A revoked or expired static-user bearer token returns **401** → scores as "correctly denied". Every deny probe in all 5 specs would still pass. Fix: assert **403** specifically; treat 401 as a setup failure. |
| 3 | **`expectAllow` counts 402 / 404 / 500 as "allowed"** ✅ | same file | It asserts only `status ∉ {401,403}`. Free `POST /fleets` skips authz → 402 for every role; deprecated v1 `/global/policies` → 404; a 500 also passes. The docstring intends this for 400/422 validation errors — widen deliberately, not accidentally: assert an explicit allow-set. |
| 4 | **`assertActivity` predicates match on name with no fleet discriminator** | controls CRUD specs (area 11); same shape in policies/reports | Concurrent Unassigned and Workstations describes can satisfy *each other's* activity assertion. Add the scope/fleet to the predicate. |
| 5 | **Two destructive host specs have no `finally`** | area 03, HOSTP-06/07 | A mid-test failure parks simulated hosts in Workstations/VMs permanently, which then wedges the *next* run's `2 selected` safety rail. |
| 6 | **Two specs stage into the `QA` fleet in parallel** | area 03, HOSTP-01 + HOSTP-04 | Both add hosts to QA concurrently, so an assertion expecting `3 selected` can see 4. |
| 7 | **API-only users leak permanently** | areas 08/09 | Server-stamped emails fall outside `QA_TEST_EMAIL_RE`, so cleanup never matches them, and `if (id !== null)` guards skip cleanup silently. The leaked users crowd the 10-per-page list that the *shared* pagination and search specs assert against — a slow-acting cross-area failure. |
| 8 | **`findHostByPlatform` swallows API errors** | area 07, SWV-07/14 | An API failure becomes "no host found" → `test.skip`. The test reports green-ish instead of failing. |
| 9 | **GitOps verify can pass having asserted nothing** | area 16 | A team target silently skips 7 tests; `GITOPS_TARGET` defaults to the **free** YAML regardless of `SUITE`; 10 loops are unguarded against zero iterations; two `continue`s are silent. |
| 10 | **Two "persistence" tests never reload** | SETUP-07 (area 12), SET-06 (area 10) | SETUP-07's "round-trip" proves only that a toast appeared. SET-06 confirms via `GET /config` without re-reading the page — so a UI that fails to rehydrate saved config passes. |

**Also worth filing, not fixing:** the `vulnerable=true` sweep in
`findVulnerableSoftwareBySources` runs in `test.beforeAll`, and because
`fullyParallel: true` that re-runs **per worker** — 2–4 concurrent 5-page sweeps per
project. That's the strongest available explanation for the QA instance's
"table is full" 500s, and it *throws*, taking down a whole worker chunk. Worth
confirming against the DB error timestamps.

---

## 3. Quick wins — delete or collapse

Ranked by runtime saved per hour of work.

| # | Action | Evidence |
|---|---|---|
| 1 | **Delete `helpers/catalogs/` (485 LOC)** ✅ | Zero importers in the repo. The only two matches are a comment in its own `index.ts` and a doc comment in `helpers/api/fma.ts` — while `helpers/README.md` *and* `helpers/catalogs/README.md` both advertise it as in use. Either wire it in or delete it and the README claims. |
| 2 | **Delete `SoftwareOsDetailPage` + its fixture** ✅ | No consumer anywhere. |
| 3 | **Stop launching Chromium for pure-API tests** ✅ | 9 of 16 API specs import `@fixtures`, which pulls the auto `pageHealth` fixture, which depends on `page` → a browser context per test. Only 3 of the 9 need anything from `@fixtures` (the fleet-id worker fixtures) and none needs a page. ≈22 tests pay a browser launch to make HTTP calls. Fix: export an `apiTest` from `fixtures.ts` carrying the worker fixtures without the page-dependent `pageHealth`. |
| 4 | **Collapse the gitops-verify cliché** | 18 of 22 tests are count / every-declared-exists / no-extra repeated per entity family. One `expectExactNameSet()` helper collapses 6 files to ~6 tests losing nothing. GV-11 ≡ GV-21 verbatim. |
| 5 | **Drop `edit-package`'s lifecycle preamble** | It re-runs the whole custom-package add→delete→feed lifecycle — **including a 16 MB upload** — to reach one edit assertion already covered by `library.spec`'s Linux case. |
| 6 | **Delete SETUP-02** | Fully contained in SETUP-03's nine cases, *and* it heads a `mode: 'serial'` chain, so its flake skips 10 tests per scope. Worst value-to-blast-radius ratio in the suite. |
| 7 | **Collapse the user role permutations** | USRP-02 (6 API roles) + USRP-12 (5 human roles) drive one identical dropdown → `.role__cell` path. Only Observer / Observer+ is distinct behaviour. Fleet permutations (USRP-03/04/05 vs 13/14/15) test the same shared cell renderer twice, once per form. |
| 8 | **Delete the subsumed singles** | USRF-25 (⊂ USRF-26), USRP-30, AUTH-07 + AUTH-08 (⊂ AUTH-06), AUTH-16 (= AUTH-17 minus one assertion), MISC-06/07 (exact duplicates), ROLE-04 (asserts nothing observer doesn't). |
| 9 | **Trim the loadtest fan-out** | 12 asc/desc sort pairs and 26 platform/scope variants, all single-sample. 5 measurements are heading-anchored only, so they time a shell, not the data. |
| 10 | **Cut the doubled activity assertions** | Every CRUD lifecycle asserts each activity **twice** — `assertActivity` in the sub-test *and* the rendered feed in the final sub-test — on top of `tests/api/activity-copy.spec.ts` locking the same strings. In reports that's 12 assertions for 6 strings. Keep the UI walk (that's the user-visible contract) and thin the API half to the events the UI doesn't render. |
| 11 | **Fix the two stale docs** ✅ | `tests/README.md:154` claims the vulnerability flow "builds up `softwareByOS` across ordered tests" — it doesn't; both maps are filled in `beforeAll` and read-only after, so every test is independently `-g`-runnable. And `activity-copy.spec.ts`'s docstring claims it "fails before the CRUD specs when Fleet changes copy" — it makes **zero** HTTP calls, so an upstream rename leaves it green. Its real value is helper-refactor regression + executable documentation of the copy matrix; say that instead. |

### On the free/premium mirroring

This is the single biggest runtime lever, and it cuts against your stated preference for
explicit tier separation over parameterized specs — so to be clear about what I'm *not*
proposing: **not** one spec with a tier parameter.

The distinction that matters is whether the code under test is tier-aware at all:

- **Delete the mirror** where the component is provably tier-agnostic and no server call
  happens. All 10 policy `sql-validation` free mirrors test `PlatformCompatibility` /
  `PolicyForm` client-side, with zero server calls — free cannot diverge. Same for the
  controls mirrors CTL-15…17 / CTL-19…22 (non-tier-gated handlers); only CTL-18 earns its
  keep (free's `all <hostsPhrase>` profile suffix).
- **Move to `shared/`** where the flow is identical and *should* run on both tiers —
  `organization-info` (byte-identical, tier-agnostic form) and `save-as-new` (byte-identical;
  premium's stated justification, the modal's Fleet dropdown, is never tested).
- **Keep the mirror** where the tier changes behaviour: `mdm-actions-availability`'s
  free/premium inversion is load-bearing. `cta-visibility`'s is not — it's straight
  duplication with no license gate.

The real tier-coverage gap is the inverse of the duplication: **no free test asserts that
anything is hidden on free.** No missing Permissions radio, no absent
Observer+/Technician/GitOps options. 20 free user tests, and none of them checks the one
thing that makes free different.

---

## 4. Assertion strengthening

This is where the "are we testing like Playwright intends" question actually bites. Each of
these is a one-to-three-line change.

- **Call the verification methods that already exist.** `ReportEditPage.expectValues()` is
  invoked by no spec. `PolicyEditPage.expectValues()`'s platform assertions are dead — so
  an edited policy's platform set is never checked after save, in either tier.
- **RPT-02 / RPT-15 are titled "run live report" and never click Run.** They stop at the
  Select-targets screen. The assertable plumbing — finished heading, `% responded`,
  results-or-no-results as alternatives — is unused. Either rename them to what they test or
  extend them to the finished state. (Real live-result coverage exists in exactly one place:
  `shared/hosts/host-live-query.spec.ts`, against the real macOS VM.)
- **Replace unfalsifiable asserts.** `rowOrEmpty()` after a delete passes either way — it
  appears in both policy delete steps, the software delete sub-test, and reports. Assert the
  specific row is gone *after paging*, plus the expected list state.
- **Paywalls never assert the gated control is absent** (area 13, MISC-20). They confirm the
  paywall renders; they'd pass if the premium control leaked onto free alongside it. MISC-21
  is vacuous outright — no positive control.
- **Profile *delivery status* to a host is never asserted** — only library presence
  (area 11). Same shape in software: nothing anywhere verifies an install or uninstall
  actually reached a host.
- **Toast-only confirmations.** USRF-24 / USRF-11 / USRP row actions and SETUP-07 accept a
  toast as proof of a state change. A toast proves the request was accepted, not that state
  changed — reload or re-read.
- **`.first()` on unordered lists** — `clickFirstSoftwareTitle` and the host-live-query
  chains bind to whatever the server happens to return first.
- **Pin the copy** where a tooltip or validation message is the actual assertion (SWL-12,
  USRP-23/24/17 assert button state where they claim to assert validation copy).

---

## 5. Coverage gaps, consolidated

Grouped by how much they should worry you.

**Whole features with no functional coverage** (page objects exist; only the local-only
loadtest project touches them, or nothing does) ✅:
- **The dashboard itself.** In e2e, `dashboard` is used 32× purely as a nav entry point
  (`goto` 46, `navbar` 25) plus activity-feed assertions. Its cards, host counts, platform
  tiles, and software table are asserted only in `loadtest/dashboard.spec.ts`.
- **Controls › OS updates** and **Controls › OS settings › Certificates** — perf-only.
- **Scripts › batch progress** and **Software › Versions list** — perf-only.
- **Software OS detail page** — nothing at all.

**Things only a real device can prove, currently proven nowhere:**
- No software install or uninstall is ever executed on a host.
- No script is ever *run* on a host (the marker fixtures in `test-data/` are unused).
- Setup experience can only be authored, never exercised — that needs a wiped,
  ABM-enrolled device going through DEP. Worth stating explicitly in the docs as
  permanently-manual territory so nobody mistakes the config tests for coverage.
- Profile delivery, disk-encryption enforcement: same class of gap.

**Within-feature gaps worth filling** (highest value first):
- Hosts list **filters, search, and pagination** — the component objects exist and are
  unused. This is the most-used screen in the product.
- Users: endpoint allow-list persistence is never verified anywhere; edit-form hydration.
- Auth: MFA, session lifecycle, Get API token.
- Reports/policies: list sort, filter, columns; **Run policy**; policy automations beyond
  the webhook (install-software, run-script, calendar).
- Software: Advanced options (scripts / pre-install query / categories), Library columns,
  sorting, pagination, Download, Self-service filter.
- Vulnerabilities: CVE enrichment fields, severity and exploit filters.
- Labels: dynamic-label SQL is never entered (`selectPlatform` / `queryEditorContent` are
  dead code); manual-label membership never verified post-save; Host-vitals type untested.
- GitOps: no test compares any entity's **contents** — only name sets. A swapped script
  body, rewritten `.mobileconfig`, or altered policy SQL is undetectable drift. Also zero
  coverage of `agent_options`, `server_settings`, `host_expiry_settings`, enroll secrets,
  premium `mdm` (EUA/ABM/VPP), and the team `settings:` block.
- Role access: only 24 of 42 premium global cells are filled; 5 of 49 rego object types
  touched; `api-ws-admin` is provisioned but unused, so fleet admin / technician /
  observer+ / gitops are untested.

---

## 6. Structural bets

1. **Give the loadtest project a threshold, or stop calling it a test suite.** There is no
   budget or regression gate anywhere — the only numeric comparison is terminal colour in
   `perf-teardown.ts`. A 29 s page load passes. All 73 numbers are single-sample, taken with
   4 workers self-contending, mixing cold (~50) and warm (~23) loads in one unmarked column.
   Results land in gitignored `.perf-history/`, where only 3 of 10 stored runs are complete
   and the newest is **2026-05-12**. Either add per-measurement budgets that fail the run
   and publish the history somewhere durable, or rename it a benchmark script and drop it
   from the suite's mental model.

2. **Build the `disposableUser` fixture and `UsersPage.expectRow()`.** Already on your
   deferred list, and the audit priced it: the row-assertion block is written 4 different
   ways, `assertApiUserRow` is copy-pasted verbatim into the free spec, and a shared
   `expectRow()` would replace ~45 lines across 6 files. The fixture also fixes leak #7
   above by owning cleanup.

3. **Split the fixture surface so API specs don't inherit a browser.** See quick win #3.
   The current convention ("import from `@fixtures` if you need a worker fixture") forces
   pure-API specs to take the page-dependent `pageHealth` with it.

4. **Decide packs' fate.** Deprecated Fleet feature, its execution test is skipped on a 405,
   it carries the last react-select v1 class locators
   ([PackEditPage.ts:42-48](../../pages/packs/PackEditPage.ts#L42-L48)), and it runs in
   *both* tiers. Either accept it as frozen smoke coverage and stop maintaining it, or delete
   it. It shouldn't sit in between.

5. **Add a scoped `pageHealth.ignore(pattern)`.** All 7 `disable()` sites are legitimately
   justified and commented ✅ — but `disable()` also switches off **5xx** detection for the
   whole test. A pattern-scoped ignore keeps server-error detection live while silencing the
   one known-noisy step.

6. **Fix the nightly ordering race.** The Playwright nightly's 05:30 `cleanup-setup` deletes
   exactly the entities GV-08…22 verify, while the 05:00 gitops chain is still mid-flight.
   Worth confirming against recent run timings — if real, gitops-verify results are partly
   noise. **Resolved 2026-09-29:** `QA — Nightly` (`qa-nightly.yml`) starts each tier's suite
   only once its gitops chain has finished, so `cleanup-setup` can't run mid-verify.

7. **Write down which flows are permanently manual.** Setup experience / DEP, real MDM
   commands, install/uninstall on a device. Right now their absence looks like a gap in the
   backlog rather than a deliberate boundary, which is how manual coverage quietly stops
   happening.

---

## 7. Things that look wrong but are load-bearing

Don't let a cleanup pass break these.

- **`test.describe.configure({ mode: 'serial' })` on CRUD lifecycles.** Deliberate, and the
  granular failure attribution is worth the coupling.
- **`mdm-actions-availability`'s free/premium inversion.** Genuine tier behaviour, unlike
  `cta-visibility` next to it.
- **All 7 `pageHealth.disable()` sites** ✅ — each has an inline reason (negative-path auth
  ×4, benign 4xx while typing in the label host-search, deliberate 4xx upload rejections ×2).
  Improve the granularity, don't remove the calls.
- **`change-password` needs no password restore** — it rotates a disposable `qa-test-*` user
  deleted in `afterAll`. No suite-wide leakage.
- **`activity-copy.spec.ts` is worth keeping** — just not for the reason its docstring gives.
- **The class fallbacks catalogued in the reviewer skill** (modal containers, react-select
  triggers, card/section wrappers, empty states, truncated cells). Area 18 checks the
  *uncatalogued* ones against Fleet's React source.
- **API use for setup and teardown is correct and should increase, not decrease.** The
  UI-vs-API concern is about *validation*. Only a handful of API assertions are genuine
  shortcuts (SET-06, RPT-08/19, SWL-06); the rest are either record-level contract checks or
  legitimate staging.

---

## 8. Locators — and a correction to the reviewer skill

Full detail in [18-locator-verification.md](18-locator-verification.md). 102 distinct
class-based locator strings across 43 page objects, every one resolved against the React
component that emits it: **16 replace · 32 keep · 54 sanctioned · 0 unverified**. No xpath,
no `nth-child` anywhere.

The headline is that **the reviewer skill's sanctioned-fallback list contains two claims
that source verification does not support**, and it should be corrected — otherwise every
future review either mis-flags correct code or waves through replaceable code:

1. **react-select v1's options are *not* role-less.** v1.3.0 emits `role: 'option'` plus
   `aria-label` — verified directly at
   `~/repositories/fleet/node_modules/react-select/lib/Option.js:116` ✅ (v5.4.0, by
   contrast, emits neither `role="option"` nor `role="listbox"`). So `.Select-option` in
   [ReportEditPage.ts:217,297](../../pages/reports/ReportEditPage.ts) should become
   `getByRole('option', { name })`. The skill's blanket "react-select v1 selectors are
   library CSS, leave them" needs narrowing to the placeholder/menu/input cases.
2. **The `data-testid="dropdown-option"` rule is narrower than the skill states.** That
   testid comes from `DropdownWrapper` **only**. `ActionsDropdown`, `TeamsDropdown`, and
   `LabelFilterSelect` are separate react-select-v5 call sites with no testid and no option
   role — so `.actions-dropdown__option`, `.actions-dropdown-select__option`,
   `.team-dropdown__option`, and `.label-filter-select__option` are **correct as written**
   and must not be flagged. Every actual `DropdownWrapper` site already uses the testid.

Conversely, the audit found **hard evidence supporting** the v5 *trigger* sanction: with
`isSearchable={false}` react-select renders a `DummyInput` styled
`width:1px; opacity:0; left:-100px; transform:scale(.01)`. It carries `role="combobox"` and
so is usable for assertions, but it is not a clickable target — `.…__control` has to stay
the click handle. Same for Fleet's `Radio` (`opacity:0; width:0; height:0`); Fleet's
`Checkbox`, however, *does* expose a clickable `<div role="checkbox" aria-label>`.

**The three replacements worth doing first:**
- `.Select-option` → `getByRole('option', { name })` (above).
- `.selected-teams-form__team-item` →
  `getByRole('listitem').filter({ has: getByRole('checkbox', { name, exact: true }) })` —
  which also fixes a live substring-match bug, where a fleet named `QA` matches `QA Staging`.
- `.compatible-platform` → `getByTestId('check-icon')`. Fleet's `Icon` stamps
  `data-testid="{name}-icon"` on **every** icon, which also cleans up the setup-assistant
  download/delete buttons and the EULA trash button.

**One real locator defect:** `.create-api-user-page form .dropdown-wrapper` + `.first()` at
[CreateApiUserPage.ts:82](../../pages/settings/users/CreateApiUserPage.ts#L82) — a CSS chain
plus positional index, exactly the pattern `tests/README.md` says to reject. Two minor ones
(`…__search-dropdown tbody tr`, `.targets-input__hosts-selected-table .display_name__cell`).

---

## 9. Suggested order of work

1. Section 2, top to bottom. These are hours, not days, and they're the difference between a
   green run meaning something and not.
2. The three verified deletions (§3.1–3.3) — pure subtraction, no risk.
3. Work the manual audit area by area, recording verdicts in the Notes blocks. Let your own
   observations decide §3's collapse candidates rather than taking this document's word.
4. Then the assertion strengthening (§4), guided by what the manual pass showed you actually
   couldn't see.
5. Structural bets (§6) last, once the suite is smaller and the notes tell you where the real
   pain is.
