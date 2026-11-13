# Fleet traps the suite has already paid for

For playwright-test-author (and worth a reviewer's read). Each of these cost a run, a day or a VM
once. Read the whole file before writing the first line of spec, page-object or helper code, and
again when you come back to that work after a long session: it's under 200 lines.

Contents: Locators and UI state · Waiting · Data and state · API helpers · The instances

**Locators and UI state**
- **Locator order:** `getByRole` with a name, then `getByLabel`, `getByPlaceholder`, `getByText`. A class
  selector is a last resort: it lives in a page or component object, never in a spec, with an inline
  comment saying why nothing else works. Fleet adds a few
  `data-testid`s of its own: `dropdown-option` on the options of `DropdownWrapper` and `ActionsDropdown`,
  `<name>-icon` on every `Icon`, plus `card`, `user-menu` and `ace-editor`. Use one when no role or text
  names the element (an icon-only button); never add one to Fleet's source.
- **Names change under state.** A tab's accessible name gains a count (*Controls 1* once a profile fails,
  *Policies 3*, *Upcoming 1*). A `FormField`'s label is replaced by its error text. Row actions are
  hover-revealed (`clickHoverAction`). Match with a regex grounded in the component.
- **The Hosts list rewrites its URL just after it loads** and can undo a filter or search chosen before that
  (a label filter and a search have each been lost, and *Select all matching* once took a whole fleet): use `HostsListPage.searchFor` /
  `filterTo` / `filterByStatus` / `sortBy` / `LabelFilter.selectLabel`, never a bare `search.fill`, filter click
  or header click.
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
- **Set an Ace editor with `setAceValue`, read it with `getAceValue`** (`pages/components/aceEditor.ts`).
  Typed keys go through Ace's own handling, which auto-indents and closes quotes and brackets, so what is
  saved isn't what was typed; the DOM holds only the visible lines.
- **A guard on an optional element answers for one instant.** `isVisible()` and `count()` read the page as
  it is now, so a guard that runs before the page settles takes the "absent" branch and the helper quietly
  does nothing: a tier guard keyed on a missing dropdown turned every scope selection into a no-op when
  Fleet changed the markup, and a `deleteIfExists` skipped a row that hadn't rendered. Wait for one of the
  two states first (`await expect(row.or(emptyState)).toBeVisible()`; `DataTable.rowOrEmpty()` is that for
  a table), then branch. A tier switch is keyed on `SUITE`, never on whether markup is present.

**Waiting**
- **An action on a missing locator waits forever.** `click`, `fill`, `innerText` and `getAttribute` have no
  timeout of their own, so the test hangs to its timeout and its `finally` never runs: cleanup written
  there silently doesn't happen. Register it with the `cleanup` fixture, which runs after a timeout. Assert the element is visible first; for an optional one, guard as the
  trap above says.
- **Web-first assertions and auto-waiting, never `waitForTimeout`.** `toPass` around an action that can
  fail to take (a menu that closes on re-render) is fine.
- A table keeps its old rows under a loading overlay: `table.waitForSettled()` before reading after a
  filter, tab or page change.
- **A toast doesn't prove the second save.** Fleet's toasts stay up for seconds, so after saving the same
  form twice, `toast.expectSuccess` can match the first one. Poll the stored state through the API
  instead (`expect.poll`). A locator inside a toast (`toast.success.getByRole('link', …)`) also matches every
  toast still on screen and breaks strict mode: `toast.dismissAll()` between two runs of the same action.
- **A closed modal doesn't mean its save landed.** Reopening it straight away can load the pre-save state, and
  saving again then reverts the edit: confirm the write through the API before reopening.
- **An activity check at the end of a long test can be buried** past the dashboard feed walk's 15 pages by
  the other workers' activity: check right after the action, or through the API (`assertActivity`).
- **Host waits:** `waitForSoftwareSettled` / `waitForHostRefetch`. Never wait on `software_updated_at`, which
  moves only when the inventory *changes*. Wait out an outstanding refetch (`waitForNoPendingRefetch`)
  before requesting your own, because Fleet queues one after every install and a new request merges into
  it. A refetch also re-runs a host's policies immediately. `refetch_requested` is one bit with no author:
  any refetch's results landing clear it, so a read of it has to follow the moment it was set closely.
  **A host mid-refetch answers no live query** until the refetch lands (about a minute on a VM): osquery reports
  a batch only once every query in it has run, and a refetch's batch is Fleet's detail queries. `queryHost` waits
  out a pending refetch before asking; a UI live run just waits, so bound it to cover one.
- **A live report or policy run started in the UI has no timeout.** It finishes only once every online
  targeted host has answered (`FLEET_LIVE_QUERY_REST_PERIOD` bounds only the REST endpoint), so bound the
  wait on the finished heading, and target hosts you know answer: the real VMs by host search, never a
  Platforms chip or All hosts.
- **To make an install fail, prefer a pre-install query that returns no rows** (`preInstallQuery` on
  `uploadSoftwarePackageBuffer`) over a package the host refuses: a failed install *script* puts orbit's
  config loop into a backoff of 1, 2, 4, then 5 min that stalls every install and script queued on that VM
  (fleetdm/fleet#54607, fixed in fleetd 1.63.0: the rule holds while a VM runs an older agent). Where the
  script failure itself is the point, the spec goes in `exclusive/`.
- **Budget VM time:** a round trip is 1–5 min, and a retried VM test costs 5–15. Give VM specs their own
  timeout, and keep every wait inside it.
- **A policy's result on a host moves only on a refetch** (or the hourly policy interval), not on the
  host's 10-second check-in: request a refetch inside the poll that waits for a pass or fail.
- **A stored report's `last_fetched` doesn't move on every run.** For unchanged results Fleet rewrites it
  only once the stored value is 50 minutes old (fleetdm/fleet#54897), so a freshness bound on a
  constant-result report allows 50 min plus two intervals; to see a run land sooner, change the result.

**Data and state**
- **Key an activity check to what this test did** when the other scope's copy of the test, another spec or an
  earlier run can log the same type: `latestActivityId` before the action, then `assertActivityAfter` matching
  the fleet (`fleet_id`) and the content. A name that is the same in both scopes (a fixture file's name) is
  exactly that case. Match on ids (`software_title_id`, `app_store_id`), not on a vendor's display name:
  Fleet keeps a title's first name when the store renames the app. Fleet records a JSON detail with its keys
  in its own order, so compare fields, never `JSON.stringify`.
- **`assertActivity` expects the browser's admin as the actor.** An activity a spec causes through `fleetctl` or
  an API helper is attributed to the API token's user instead: look it up with `findActivity` (or
  `assertActivityAfter` with its `actor` left out) and match it by its content.
- **Seed your own preconditions.** The cleanup projects delete gitops-provisioned global reports and
  policies at run start. Team-scoped reports survive; global ones never do.
- **"The first one" of live data is a different one tomorrow.** The first host, row, title or CVE a list
  returns changes with the simulations' daily refresh and Fleet's hourly counts, and the new one may lack
  what the test needs. Pick by the property the test requires and throw when nothing has it
  (`requireRealHost`, `findRenderableCve`, `findOnlineHost`'s `withUsers` / `withOrbit`), or seed it.
- **A retry of a serial lifecycle starts over with its `delete` skipped.** What the failed attempt created
  is still there, so a resource Fleet refuses twice fails the retry at the first step with "already exists"
  and hides the real failure. The first step removes its own leftovers under `testInfo.retry > 0`
  (`premium/software/edit-package.spec.ts`).
- **Snapshot global config before changing it, and restore it with `cleanup.add` or an `afterEach`**
  (`getAppConfig` / `patchAppConfig` in `helpers/api/config.ts`). A timed-out test skips its `finally`, not
  its hooks or its fixtures' teardown. Key the
  restore to the test that changed something (a describe-level variable only that test sets), so a parallel
  sibling's hook can't roll it back mid-flight. Restore only the keys you changed: `PATCH /config` refuses some
  whole snapshotted subtrees with a 400 (`smtp_settings.configured` is read-only). Restore the fields you
  wrote, not a flag Fleet derives from them: `mdm.enable_disk_encryption` is the AND of the per-platform
  controls, and writing it back turns every platform on (`setGlobalDiskEncryption` round-trips the
  per-platform fields for that reason).
- **A report created in the UI runs hourly on every host in scope** (it defaults to *Every hour* on all four
  platforms, and automations need an interval): keep its SQL benign and delete it. Never untick all
  automations on Workstations, whose gitops reports carry them.
- **`organization-info.spec.ts` renames the organization for a few seconds** on both tiers. A spec that compares
  the page's org name with the config re-reads both until they agree (`shared/settings/apple-mdm.spec.ts`).
- **Two specs writing the same global key race.** Tests are kept apart only inside one file, so a new test
  that writes a key another spec writes joins that spec's describe, and the describe runs its tests one at
  a time: `test.describe.configure({ mode: 'default' })` when they don't depend on each other (as
  `software/vulnerabilities.spec.ts` does), `serial` only when later steps need an earlier one's result. A
  write that breaks tests in *other* files goes in `exclusive/`.
  Org settings › Advanced's Save posts `server_settings`, `smtp_settings`, `host_expiry_settings`,
  `activity_expiry_settings`, `features.historical_data`, `mdm.apple_server_url` /
  `apple_require_hardware_attestation` / `only_allow_apple_business_enrollment` and
  `sso_settings.sso_server_url` as loaded. `shared/settings/organization/advanced-options.spec.ts` asserts
  they're unchanged, so no main-project spec writes them.
- **A fleet subtree Fleet replaces wholesale has one writer per fleet.** A fleet's enroll secrets and its
  `webhook_settings` are saved whole, so two specs writing them on the same fleet undo each other's write through
  their snapshot restores. Before 4.95, saving a fleet's policy automations or its Settings tab also sent the
  whole `webhook_settings` and wiped the webhook the other one owned (fleetdm/fleet#54619); the snapshot
  restores still collide. Use a throwaway `pw-*` fleet for a fleet-level write. The static users never belong
  to one, so a fleet-scoped *role* write there needs a disposable `qa-test-*` user given that fleet.
- **The gitops-mode exceptions act with the mode off.** `fleetctl gitops` reads them on every apply, and
  premium's YAML declares no `secrets:`, so `secrets: false` left behind makes the next apply delete every
  enroll secret. Only the `gitops-mode` project writes them, it restores them in a hook, and its
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
- **A file every worker writes is written whole or not at all.** Workers share the disk: the fleetctl config
  and the cached sessions under `.auth/`. A file rewritten in place is read half-written by a neighbour (148
  of 240 fleetctl reads, measured). Write a temp file and rename it into place, as `helpers/fleetctl.ts` does.

**API helpers**
- Build URLs with `apiUrl()` and send `authHeaders()`, through the `request` fixture.
- **Throw on a non-OK response, with `expectOk(res, what)`.** A discovery helper that turns a 500 into
  `null` turns an infra failure into a silent skip; that hid MySQL "table is full" errors for weeks. Name a
  status that is an answer (`404`, `402`) before the check. Never `expect(res).toBeOK()`: its failure
  prints the request's headers, the bearer token among them.
- **Playwright drops an empty-string field from a `multipart` request** (from `FormData` too), and Fleet
  reads a missing field as "no change" and answers 200. A helper that must send `''` writes the multipart
  body by hand (`setPinnedVersion`), and reads the result back.

**The instances**
- **The instances redeploy the RC tag nightly, and a failed deploy is silent.** When Fleet behaves
  unexpectedly, check `GET /api/latest/fleet/version`'s revision and `GET /debug/migrations` before blaming
  your spec.
- **`fleetctl` must be within a minor of the server**, and `fleetctl gitops` reads `~/.fleet/config`, not
  `FLEET_URL`. Pass `--context`.
- **Apple's tokens fail quietly.** A revoked VPP token leaves `GET /vpp_tokens` looking healthy while every
  App Store list fails; `expectVppAppsListable` gives Apple's reason. An Apple Business token Apple rejects
  answers 403 `token_rejected` and breaks the setup assistant. Check both before debugging a spec that adds
  an App Store app or reads the setup experience.
- **Premium's firewall refuses realistic install scripts.** A request whose body carries `rm -rf`,
  `msiexec` or `installer -pkg` comes back as an HTML "Blocked" page: test scripts stay benign (`echo`).
