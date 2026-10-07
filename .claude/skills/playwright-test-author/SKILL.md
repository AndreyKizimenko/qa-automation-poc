---
name: playwright-test-author
description: Write, extend or fix tests in Fleet's Playwright QA suite (`playwright/` in qa-automation) — new specs, augments to existing ones, page objects, component objects, API helpers, fixtures and test data, and QA Wolf migration batches. Use it before adding or changing anything under `playwright/tests`, `pages`, `helpers`, `setup` or `test-data`, including "write a test for…", "port this QA Wolf flow", "work batch F", "add free coverage for…", "augment the policies spec", "create a page object", "fix this test-bug from the run review" — even when the request doesn't say "Playwright". It carries the suite's safety rules for the real VMs, how to verify without disrupting the shared instances, and which docs move with the code.
---

# Writing tests for Fleet's QA suite

The suite drives Fleet through its UI and API against two shared QA instances (free and premium). Each
has ~300 osquery-perf simulated hosts and three real VMs (macOS, Windows, Ubuntu). Writing a Playwright test
is the easy part. The mistakes that cost the most here are: locking a real VM, asserting against a simulated
host that can't answer, leaving state behind for the next run, and running far more than you changed. Most
of this skill is about not doing those.

`playwright/CLAUDE.md` is the suite contract: layout, projects, host populations, the cleanup pipeline,
imports, skips, and a **CI and the shared instances** table with the facts that change (the nightly, workers,
timeouts, runtimes). Read it before you start; this skill doesn't repeat it.

## Stop and ask before any of these

Each has happened, or nearly happened, and none can be undone from a test.

- **Delivering a configuration profile to a real host that could lock it.** No passcode payload
  (`com.apple.mobiledevice.passwordpolicy`, `forcePIN`, `minLength`, `maxInactivity`, `allowSimple`), no
  screen lock, inactivity timeout, FileVault or login-window restriction, nothing that disables SSH, remote
  management or MDM. There are three VMs per tier and no way to rebuild one from here. **Uploading a
  profile is delivering it:** on free, Unassigned is where the real VMs are, and Fleet's reconciler sends
  whatever it finds within 30 s. The suite's old "library-only" passcode and DeviceLock fixtures reached the
  free VMs 7 and 32 times before anyone noticed.
- **Any new payload type, even one you believe is inert.** Get Andrey's approval first. macOS 26.6 happily
  installed a "must be refused" payload everyone expected it to reject, so "inert" is a claim to check on
  the device, not a property of the XML. The approved fixtures are the inert pair
  `test-data/{apple/macos,windows}/profiles/fleet-pw-inert.*` (see their READMEs), plus generators on the
  same pattern in `helpers/profiles.ts`.
- **Settings that update, reboot or lock a real host:** an OS-update minimum version or deadline, a DDM
  software-update declaration, Recovery Lock password enforcement. Exercise them only on a fleet with no
  real hosts (Workstations), and restore them in the same test. On **free**, global settings reach the free
  VMs, because they're in Unassigned. The one approved exception is `recovery-lock.spec.ts`, which sets,
  rotates and clears Recovery Lock on the premium Mac (`playwright/CLAUDE.md` → Test hosts).
- **Changing what other specs stand on:** the durable VM software (`helpers/vm-fixtures.ts`, declared in
  `gitops/premium-fleetqa/fleets/vms.yml`), renaming a fleet gitops declares (VMs, Workstations), gitops
  config, static users (their tokens can't be re-minted).
- **Starting a full suite run.** Andrey dispatches `QA — Branch run`. Your runs are scoped (below), and
  never while something else is using the instances (`gh run list --limit 5`).

When in doubt, the answer is to ask. A blocked afternoon costs less than a VM rebuilt by hand.

## How the work goes

1. **Know what exists.** Open every spec you're augmenting before writing anything; titles lie. Check
   `pages/README.md` and `helpers/README.md` before writing a helper that already exists. On a migration
   batch, the batch file's *Start here* block and `docs/qawolf-migration/round-2/README.md` §9 come first.
2. **Ground it in the product, not in the screen.** Probe the live page with the Playwright MCP
   (`browser_snapshot` shows the accessibility tree `getByRole` will target). Read the React component in
   `~/repositories/fleet/frontend/` for roles, names and conditional rendering. Read `docs/REST API/rest-api.md`
   before writing an API helper; the UI says reports and fleets where the API still says queries and teams.
   For claims about behaviour (tier gating, retries, what a setting does), read the server code in
   `~/repositories/fleet/server/` and `ee/`. An hour of reading has repeatedly replaced a day of guessing.
3. **Decide the tiers: free coverage is a standing goal.** QA Wolf's suite was almost all premium, so
   free coverage has to be found. Check the component (`isPremiumTier`) and the server (`premium:"true"`
   struct tags, license checks) for what free has. Use `tests/e2e/shared/` when the behaviour is identical,
   an explicit `free/` sibling when it differs, and never one spec with `if (isPremium)`. A premium-only
   surface often gives free a check anyway: the paywall (`tests/e2e/free/paywalls.spec.ts`), an absent
   control, or the API's 402.
4. **Decide the hosts.** What Fleet decides **server-side** (which hosts a profile, title, policy or report
   reaches; an IdP username; a transfer) a simulation answers as well as a VM. What the host **does**
   (installs, runs, verifies, reports inventory) only a real VM can answer: `findOnlineHost(request,
   platform, { kind: 'real' })`, `vmsFleetId`, `liveMacosHost`. To put simulations on a fleet beside a VM,
   borrow them with `findMdmSimulations` (profiles; a scarce pool) or `findSimulations` (everything else),
   claim your own slice in the registry in `helpers/api/hosts.ts`, and return them in the `finally`.
5. **Build the page objects first, then the spec.** Page objects expose intent (`openControlsTab()`,
   `runRowAction(name, 'Delete')`) and locators; assertions live in the spec. Grow an existing page object
   before creating a new one, and turn a widget two pages share into a component object in
   `pages/components/`.
6. **Assert what can fail.** Set membership over hosts you control, never a count on a shared list
   (QA Wolf's `toBeGreaterThanOrEqual(hostCount, 2)` passes whatever happens). Confirm through the API that a
   UI write happened. Scope every assertion to records you created.
7. **Give everything you create a home.** Remove it in the test's `finally`. Playwright skips the `finally`
   when a test times out, so anything that could survive on the VMs fleet also needs a home in
   `setup/cleanup.steps.ts`: the VMs sweep for things Fleet stores by name, the resting-state step for state
   on a host. Name per-run things `pw-*` (packages `fleet-pw-*`) so the sweep recognises them, and never
   give a durable thing those prefixes.
8. **Verify, scoped** (next section).
9. **Update the docs in the same commit** (the table below).
10. **Review your own work** with `playwright-test-reviewer` on the branch's diff, fix what it finds or
    write down why not, then open the PR and tell Andrey it's ready for its branch run.

## Verifying without disrupting anyone

`npm run check` (tsc + eslint) is the floor, not proof. A green local run is easy to get for the wrong
reason, so:

- **Run only what you changed, on every tier it targets:** `npx playwright test --project=premium
  <spec-file-names>`, and `--project=free` for anything in `shared/` or `free/`. That runs the setup and
  cleanup projects, including the VM resting-state step, and then only your tests. **Never
  `npm run test:<tier> -- <spec>`:** it runs the whole main project, then the exclusive one, and your
  arguments reach only the second. For an `exclusive/` spec: `--project=premium-exclusive <file-name>`, by
  file name (it runs only the login setup and `cleanup-teardown` around it). Never name a main project and
  its exclusive one in one invocation: they'd run side by side, and the config refuses to.
- **Run once with dependencies** (no `--no-deps`). `cleanup-setup` drains global reports and policies
  before the first test, so a spec leaning on pre-existing data passes with `--no-deps` and fails every
  nightly.
- **Run once headed.** Headless on an idle machine hides render-order races that show up under load.
- **`--repeat-each=5`** for anything timing-sensitive; **`--workers=2`** on anything touching the real VMs,
  since each VM works one queue and more workers stack it into timeouts; **`--output=<scratchpad>/<run>`**
  so artifacts stay out of the repo.
- **`gh run list --limit 5` right before any run that touches the instances.** Two runs on one VM corrupt
  each other, and the nightly starts hours after its cron time.
- On free, run what touches Unassigned knowing the real VMs are there.

## Docs move with the code

A change isn't done until the docs describing it are current, in the same commit:

| you changed | update |
|---|---|
| a `test()` | its `docs/test-audit/` area entry (steps a person would perform, validations tagged *(UI)* / *(API)*, an honest assessment) and the audit README's index and counts |
| a migration batch's spec | the batch file's *What landed*, and a `docs/qawolf-migration/DELIVERY-LOG.md` line |
| a helper or page object | `helpers/README.md` / `pages/README.md` |
| a fixture | its `test-data/` README: what it does, why it's safe on a real VM, how to rebuild it |
| gitops | the fleet file's header and `gitops/premium-fleetqa/README.md`; apply it, and say so in the PR |
| a rule every spec should follow | `playwright/CLAUDE.md`, and this skill or the reviewer's |
| a skip owed to a Fleet bug | a row in `docs/blocked-by-product-bugs.md` and `TODO(fleetdm/fleet#N)` on the skip (file the bug first; only when Andrey agrees it's one) |
| an env-gated or deferred skip | a `TODO.md` row |

## Fleet traps the suite has already paid for

**Locators and UI state**
- **Locator order:** `getByRole` with a name, then `getByLabel`, `getByPlaceholder`, `getByText`. A class
  selector is a last resort and needs an inline comment saying why nothing else works. Fleet emits no
  `data-testid`, except `dropdown-option` on react-select v5 options.
- **Names change under state.** A tab's accessible name gains a count (*Controls 1* once a profile fails,
  *Policies 3*, *Upcoming 1*). A `FormField`'s label is replaced by its error text. Row actions are
  hover-revealed (`clickHoverAction`). Match with a regex grounded in the component.
- **The Hosts list rewrites its URL just after it loads** and can undo a filter or search chosen before that
  (C and D each lost one, and *Select all matching* took the whole fleet): use `HostsListPage.searchFor` /
  `filterTo` / `LabelFilter.selectLabel`, never a bare `search.fill` or filter click.
- **Built-in platform labels are osquery-perf answers** (the macOS label holds the Ubuntu simulations): pick
  hosts by `platform`, and never target a Platforms chip.
- **Lists page at 20, and searches hit the server.** Act on a row after a search that narrows to exactly
  it; never scan page 1. A name that is a prefix of a sibling's breaks strict mode.
- **`Pagination.nextIfEnabled`** compares the first row's link text, or the whole row on a table without
  links. Use it rather than clicking Next.
- **A column index read from the header goes stale when the table re-renders** (the reports list after its
  Manage automations modal saves): `DataTable.cellByColumn` then lands on the neighbouring cell. Match the cell
  by its content instead (`ReportsListPage.automationsCell`).
- **An absence check on a menu passes when the menu never opened.** Assert one option that should be there
  before asserting the one that shouldn't.
- **The report edit form fills itself twice:** from report state that survives client-side navigation, then
  again when its own fetch returns. An edit made right after *Edit report* can be overwritten and save nothing,
  with no prompt. Load `/reports/:id/edit` with `gotoEdit()` and wait for the saved values, or use `fillAll()`.
- **Root a `filter({ has })` locator at the page.** One built from a scoped locator (`section.getByRole(…)`)
  looks for that scope inside each candidate and matches nothing, so the click waits out the test's timeout.
  `filter({ has: this.page.getByRole(…) })` is relative to each candidate, as intended.
- **Fleet's radio inputs are visually hidden** behind a styled control: click the `<label>` that wraps the
  radio, then assert the radio is checked (`TargetLabelSelector`, `IntegrationsPage.chooseMigrationMode`).

**Waiting**
- **An action on a missing locator waits forever.** `click`, `fill`, `innerText` and `getAttribute` have no
  timeout of their own, so the test hangs to its timeout and its `finally` runs on a closed context: the
  cleanup silently doesn't happen. Assert the element is visible first, or use a `count()` check for
  optional ones.
- **Web-first assertions and auto-waiting, never `waitForTimeout`.** `toPass` around an action that can
  fail to take (a menu that closes on re-render) is fine.
- A table keeps its old rows under a loading overlay: `table.waitForSettled()` before reading after a
  filter, tab or page change.
- **A toast doesn't prove the second save.** Fleet's toasts stay up for seconds, so after saving the same
  form twice, `toast.expectSuccess` can match the first one. Poll the stored state through the API
  instead (`expect.poll`). A locator inside a toast (`toast.success.getByRole('link', …)`) also matches every
  toast still on screen and breaks strict mode: `toast.dismissAll()` between two runs of the same action.
- **Host waits:** `waitForSoftwareSettled` / `waitForHostRefetch`. Never wait on `software_updated_at`, which
  moves only when the inventory *changes*. Wait out an outstanding refetch (`waitForNoPendingRefetch`)
  before requesting your own, because Fleet queues one after every install and a new request merges into
  it. A refetch also re-runs a host's policies immediately.
- **To make an install fail, prefer a pre-install query that returns no rows** (`preInstallQuery` on
  `uploadSoftwarePackageBuffer`) over a package the host refuses: a failed install *script* puts orbit's
  config loop into a backoff of 1, 2, 4, then 5 min that stalls every install and script queued on that VM
  (fleetdm/fleet#54607). Where the script failure itself is the point, the spec goes in `exclusive/`.
- **Budget VM time:** a round trip is 1–5 min, and a retried VM test costs 5–15. Give VM specs their own
  timeout, and keep every wait inside it.

**Data and state**
- **Key an activity check to what this test did** when the other scope's copy of the test, another spec or an
  earlier run can log the same type: `latestActivityId` before the action, then `assertActivityAfter` matching
  the fleet (`fleet_id`) and the content. Fleet records a JSON detail with its keys in its own order, so compare
  fields, never `JSON.stringify`.
- **Seed your own preconditions.** The cleanup projects delete gitops-provisioned global reports and
  policies at run start. Team-scoped reports survive; global ones never do.
- **Snapshot global config before changing it, and restore it in an `afterEach`** (`getAppConfig` /
  `patchAppConfig` in `helpers/api/config.ts`). A timed-out test skips its `finally`, not its hooks. Key the
  restore to the test that changed something (a describe-level variable only that test sets), so a parallel
  sibling's hook can't roll it back mid-flight.
- **Two specs writing the same global key race.** A serial describe serialises only within its file, so a new
  test that writes a key another spec writes joins that spec's serial describe (or goes in `exclusive/`).
  Org settings › Advanced's Save posts `server_settings`, `smtp_settings`, `host_expiry_settings`,
  `activity_expiry_settings`, `features.historical_data`, `mdm.apple_server_url` /
  `apple_require_hardware_attestation` / `only_allow_apple_business_enrollment` and
  `sso_settings.sso_server_url` as loaded. `shared/settings/organization/advanced-options.spec.ts` asserts
  they're unchanged, so no main-project spec writes them.
- **A fleet subtree Fleet replaces wholesale has one writer per fleet.** A fleet's enroll secrets and its
  `webhook_settings` are saved whole, so two specs writing them on the same fleet undo each other's write through
  their snapshot restores. Saving a fleet's policy automations or its Settings tab sends `webhook_settings` and
  wipes the webhook the other one owns (fleetdm/fleet#54619); a `PATCH /teams/:id` carrying only `mdm` is safe.
  Use a throwaway `pw-*` fleet for a fleet-level write. The static users never belong to one, so a fleet-scoped
  *role* write there needs a disposable `qa-test-*` user given that fleet.
- **The gitops-mode exceptions act with the mode off.** `fleetctl gitops` reads them on every apply, and
  premium's YAML declares no `secrets:`, so `secrets: false` left behind makes the next apply delete every
  enroll secret. Only the `gitops-mode` project writes them, it restores them in an `afterEach`, and its
  teardown and every premium apply put back `GITOPS_EXCEPTIONS_BASELINE`. Never tick Enroll secrets in a UI test.
- A spec that flips a switch other specs depend on goes in `tests/e2e/<tier>/exclusive/`, and so does one that
  needs a real VM's queue to itself: Fleet runs a policy automation's scripts and installs below every
  user-requested activity, so beside the install specs they starve.
- **Logins are throttled:** `POST /login` allows 10 a minute in one bucket shared by every user and worker. In
  the browser, sign in through `withStaticUser`'s cached sessions; for an API-only login use `apiLogin`, which
  waits out a 429.
- **Some deletes take more with them.** Deleting a script deletes its batch runs (a foreign-key cascade), so a
  spec reads a batch before it deletes the script. Deleting a fleet returns its hosts to Unassigned, so a
  throwaway `pw-*` fleet is a staging area the fleet sweep cleans up after. Deleting a software title cancels
  its pending installs and runs.
- **`browser.newContext()` inherits `storageState`,** so an argument-less context is still the admin. Use
  `withCleanContext` from `@helpers/auth` for a genuinely signed-out one.

**API helpers**
- Build URLs with `apiUrl()` and send `authHeaders()`, through the `request` fixture.
- **Throw on a non-OK response.** A discovery helper that turns a 500 into `null` turns an infra failure
  into a silent skip; that hid MySQL "table is full" errors for weeks.
- **Playwright drops an empty-string field from a `multipart` request** (from `FormData` too), and Fleet
  reads a missing field as "no change" and answers 200. A helper that must send `''` writes the multipart
  body by hand (`setPinnedVersion`), and reads the result back.

**The instances**
- **The instances redeploy the RC tag nightly, and a failed deploy is silent.** When Fleet behaves
  unexpectedly, check `GET /api/latest/fleet/version`'s revision and `GET /debug/migrations` before blaming
  your spec.
- **`fleetctl` must be within a minor of the server**, and `fleetctl gitops` reads `~/.fleet/config`, not
  `FLEET_URL`. Pass `--context`.

## Code style

- Write comments for a reader who has never seen the previous version: say what the code *does* and why,
  never what changed or what it replaced.
- Spec headers carry the reasoning: why this host, this fleet, this locator, and what breaks if someone
  "simplifies" it. Most of the suite's hard-won knowledge lives in spec headers.
- Imports come from `@fixtures` in browser specs, and path aliases (`@helpers/*`, `@pages`) across modules.

## When you're done

Say what landed (specs, page objects, helpers, docs), what you ran and how it came out (tiers, headed,
with deps, repeats), and anything that needs Andrey: approvals, decisions, bugs to file. Keep it short. The
PR description is where the detail goes.
