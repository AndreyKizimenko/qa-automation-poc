# Playwright test suite

This folder contains the Playwright end-to-end suite for Fleet. The standards below apply whenever you work in `playwright/`.

## Skills

- **playwright-test-author** — invoke it before writing or scaffolding tests, page objects, component objects, or fixtures; don't rely on it triggering on its own. Checked in at `.claude/skills/`.
- **playwright-test-reviewer** — invoke explicitly with `/playwright-test-reviewer` to audit existing specs and POMs. Checked in at `.claude/skills/`.
- **playwright-run-reviewer** — triage a finished run (CI or local): per failing/flaky test, decide flake vs test-bug vs product-defect. Invoke with `/playwright-run-reviewer`, or by pasting a Playwright Actions run URL / pointing at `playwright-report/`. Checked in at `.claude/skills/`.
- **fleet-upgrade-preflight** — run *before* upgrading the instance: diffs the Fleet release it runs today against the target and predicts which specs break. Invoke with `/fleet-upgrade-preflight`. Checked in at `.claude/skills/`. Its natural partner is playwright-run-reviewer, which triages the run afterwards.

All four live in the repo-root `.claude/skills/`, which is checked in. They must stay at the root: a nested `.claude/skills/` (e.g. under `playwright/`) is treated as directory-scoped, which renames the commands to `playwright:<name>` and ties them to files under that directory.

## Nested files

This file is the core. What matters only under one folder is in that folder's own `CLAUDE.md`, which loads
when work happens there: [`setup/`](setup/CLAUDE.md) (the cleanup projects, step by step),
[`tests/api/`](tests/api/CLAUDE.md), [`tests/cli/`](tests/cli/CLAUDE.md),
[`tests/loadtest/`](tests/loadtest/CLAUDE.md) and
[`tests/e2e/premium/gitops-mode/`](tests/e2e/premium/gitops-mode/CLAUDE.md). The real-host rules, the
fixtures, the projects and the CI facts stay here, because every spec depends on them.

## Comment style (always-on)

When you write or rewrite a comment in any file under this folder, describe what the code is *doing*. Never describe what changed, what was added, fixed, or how it differs from a previous version. The reader has not seen the prior state and the comment will outlive the change.

Bad: `// Removed the brittle nth-child locator and switched to getByRole`
Good: `// Targets the row's edit button by accessible name so reordering doesn't break the test`

## Layout

- `tests/e2e/` — browser specs in three sibling folders:
  - `shared/<area>/` — tier-agnostic flows (`account/`, `auth/`, `command-palette/`, `controls/`, `dashboard/`, `hosts/`, `labels/`, `policies/`, `reports/`, `settings/`, `software/`, plus `exclusive/`); both premium and free pick these up via folder structure.
  - `premium/<area>/` — premium-only flows. Each spec says which scope it works in: Unassigned, Workstations, All fleets, or a throwaway `pw-*` fleet of its own. The CRUD lifecycles and the setup-experience specs run once per scope; most specs work in one. `premium/matrix/` holds the per-OS smokes, which the `premium-matrix` project runs on its own (Projects).
  - `free/<area>/` — free-tier counterparts (no dropdown) + paywall-presence specs.
- `tests/api/gitops-verify/` — pure-API drift checks against a gitops target (no browser). Sits alongside `tests/api/*.spec.ts` (agnostic API contracts), `tests/api/premium/` and `tests/api/free/` (tier-only contracts), and `tests/api/role-access/{free,premium}/` (per-role endpoint allow/deny probes).
- `tests/cli/` — `fleetctl` specs, in the same `shared/` / `premium/` / `free/` split, plus `cli/nightly/` for the `gitops-nightly` project; [`tests/cli/CLAUDE.md`](tests/cli/CLAUDE.md).
- `tests/loadtest/` — page-load and API timing tests, run locally only against a high-scale instance;
  [`tests/loadtest/CLAUDE.md`](tests/loadtest/CLAUDE.md).
- `pages/` — page objects, with `pages/components/` for reusable UI widgets.
- `helpers/` — non-UI utilities (API client, auth, console monitoring, perf timing, `team-scope.ts` for mapping a scope to its `fleet_id`, `activity-copy.ts` for expected activity-feed strings, `own-name.ts` for the name of anything a test creates, `claims.ts` for which spec uses which simulations and catalog apps, `lab-hosts.ts` for the device lab's manifest: which real host is which, and what each is for).
- `fixtures.ts` — two test objects: `apiTest`, with the worker fixtures (fleet ids, `liveMacosHost`), the `cleanup` stack and the data fixtures built on it (`throwawayFleet`, `borrowSims`, `seed`), and nothing that needs a page, and `test`, which extends it with the page-object fixtures, the auto `pageHealth` fixture, and `palette` (the command palette — the one component object exposed as a fixture, since `CoreLayout` mounts it on every page and it belongs to no page object). Single file.
- `setup/` — auth and project-scoped setup/teardown specs.
- `eslint-rules/` — the suite's own lint rules (`suite/*`), their tests and the per-rule count; see *Pre-PR check*.
- `lab-hosts.json` — the device lab's manifest: every real host on the instances, with its tier, platform, OS and role (Test hosts).
- `scripts/` — `check-claims.js`, the check `npm run lint:claims` runs on `helpers/claims.ts`; `lab-manifest.js`, which `npm run lint:lab` runs on `lab-hosts.json`; and `catalogue.js`, which `npm run catalogue` runs to write the test catalogue (below).
- `test-data/` — fixtures consumed by specs, organised platform-first (`apple/macos/`, `linux/`, `windows/`, plus `shared/`), then by category — e.g. `apple/macos/scripts/macos-create-marker.sh`; see `test-data/README.md`.
- `docs/` — `ci-pipeline.md` (why the CI flow is shaped as it is and what bounds a run), `architecture-audit.md` (what has to change for the suite to grow fivefold, with the working list of next steps), `device-lab-plan.md` (the plan of record for moving the suite onto the device lab: what has landed, what is next, and what was checked on the instances), `blocked-by-product-bugs.md` (skips owed to confirmed Fleet defects), `long-term-goals.md` (coverage that waits on infrastructure the instances lack), `gitops-coverage/` (the plan for the nightly's gitops coverage), `loadtest-runs/` (dated load-test write-ups), `test-audit/` (the manual audit's per-test breakdown and `FINDINGS.md`, frozen on 2026-11-13: a test no longer adds or updates an entry there), `test-catalogue/` (every test, the projects that run it, its spec's header and its `test.step` titles: built on demand by `npm run catalogue` from the suite itself, and gitignored, so it never drifts), and `test-plans/` (per-feature E2E coverage plans: what E2E owns vs. what unit tests already cover, the case list, and the environment facts an author needs). `docs/run-reviews/` holds per-run triage write-ups and `docs/upgrade-preflight/` holds pre-upgrade impact reports; both are gitignored.
- `.auth/` — stored auth + setup state (gitignored).

## Test hosts

Two host populations share each instance and are good at opposite jobs. Resolve both at run time via
`findOnlineHost(request, platform, { kind })` — **never by stored name or id**, because the load-fleet daemons
regenerate both on every restart.

- **`kind: 'real'`** — the device lab's **pool** hosts of the tier: several genuine VMs per platform on
  premium's **VMs** fleet (`vmsFleetId` worker fixture), one per platform in Unassigned on free. They run real
  osquery, install real packages and receive real profiles, so anything asserting software inventory, script
  output, profile delivery, certificates or agent versions must use them.
- **Each worker is handed its own VM of a platform.** `requireRealHost(request, platform)` and `liveMacosHost`
  sort the platform's online pool hosts by name and return `pool[parallelIndex % pool.length]`: the same VM
  for every test the worker runs, and another worker's only where the platform has fewer VMs than the run has
  workers (premium: four Ubuntu, two Windows, two macOS). A VM that drops out mid-run is replaced from the pool as it
  then stands. The pool's Macs run two macOS versions and a worker's is either: a spec that depends on the
  version asks for it (`requireRealHost(request, 'darwin', { os: 'macos-26' })`). Each test's report notes the
  VM it ran on (`vm: prem-macos26-01 (macOS 26.6.2)`).
- **`lab-hosts.json` says what every lab machine is** (`helpers/lab-hosts.ts`): its tier, platform, `os` and
  **role**. `pool` is above. `matrix` is the one host of an OS flavour and `special` a host with a single
  purpose: both live on premium's **OS matrix** fleet, no worker is handed one, and a spec asks for one by its
  `os` or purpose (`requireLabHost(request, matrixHostOfRun('rhel-9'))`). `physical` is a bare-metal machine,
  which can't be rolled back: never the subject of anything that needs a reset to recover from. A Fleet host
  is matched to its entry by display name, lower-cased (Windows reports upper case). An entry also says what
  the lab knows of the OS: the `platform` Fleet reports for it, its package type and package manager, its
  desktop (`none`: headless, no Fleet Desktop) and whether it is in MDM. This file is the manifest's only
  copy: the lab's owner changes it in a PR when the lab changes (the `device-lab` skill scans the lab and
  opens that PR), and `npm run lint:lab`, inside `npm run check`, fails on an entry the suite can't place or
  a `fleet` that disagrees with the role. A spec that needs a host the manifest doesn't have asks the lab's
  owner for it; it doesn't add an entry for a machine that isn't there.
- **A lab machine is never a simulation.** Every simulation picker and both of the cleanup's host sweeps skip
  whatever the manifest lists and, as the guard for a host the lab enrolled and nobody has listed yet,
  whatever reports virtualized hardware (the model `VirtualMac2,1`, or the vendor `QEMU`).
- **A lab host's fleet follows from its role, and the cleanup puts it there**: the pool on VMs, the matrix and
  special hosts on OS matrix. Every lab host enrolled with the VMs fleet's secret, so one that re-enrolls
  lands on VMs, whatever it is for; the resting-state step returns each to its role's fleet before a run and
  after it. That step, and the disk-encryption tests below, are the only things that move a host onto or off
  OS matrix. Nothing is uploaded to OS matrix or set on it: gitops declares it empty, with disk encryption off,
  and `gitops-verify` holds it to that. **The one exception is the per-OS smokes** (`premium/matrix/os-smokes.spec.ts`), for the length of a test:
  a library script and a package nothing installs until the test asks its own host to, and a policy held to
  that host by a manual label holding only it. Whatever else goes on that fleet reaches all eighteen hosts, so
  never a package with automatic install, a profile, agent options, or an OS-update or disk-encryption
  setting; never `zenity` or `kdialog` on `prem-fedora45-luks` or `prem-omarchy-01`, which reproduce
  fleetdm/fleet#58776 by lacking them; and nothing that leaves a matrix host changed, since each has one
  baseline snapshot and only the lab's owner can roll it back.
- **The disk-encryption tests move their own host off OS matrix, for the length of a test** (the
  `premium-encryption` project, `tests/e2e/premium/encryption/`; approved by Andrey 2026-11-16, step E of
  `docs/device-lab-plan.md`). Each test takes one LUKS, BitLocker or Windows Server host onto a throwaway `pw-*`
  fleet with one platform's disk-encryption setting on (`setFleetDiskEncryption`, never the BitLocker PIN or a
  macOS setting), drives the flow, and moves it back, which drops Fleet's key and any failure; the cleanup
  returns a host a dead test left there. Only the hosts the lab built for it are changed on disk: a key slot
  on `prem-ubu2404-luks-02` and `prem-omarchy-02`, removed by the test, and BitLocker protectors on
  `prem-win11-bde`, which the test resets. On the matrix hosts and the control, a test clicks *Create key*
  and leaves the prompt unanswered, which changes nothing. A disk key reaches the page there, so the project
  keeps no trace, screenshot or video, and a key is checked in code, never printed or given to a matcher.
- **The per-OS smokes run the same few checks on every OS version every night**: on the matrix host of each
  flavour and on a pool VM of each version the pool holds (the `premium-matrix` project; in CI the
  `Playwright — OS smokes` workflow, after premium's suite). They are where a flavour's own behaviour is asserted: what Fleet shows for its OS and reads of the machine, its inventory's
  package type, its answer to a live report, its package manager's install and uninstall and the inventory that follows each. A spec in the main project that needs one OS
  version of the pool still asks `requireRealHost` for it by `os`.
- **The lab preflight** (`tests/api/lab-hosts.spec.ts`) is one test per pool host. One that is offline, on the
  wrong fleet or no longer enrolled is a red row naming it and saying which, while the workers go on with the
  rest of the pool. Hosts outside the pool, and online lab machines the manifest doesn't list, are noted on
  its last test's report and in the job log, not failed.
- **What a spec puts on the VMs fleet reaches every pool VM of the platform, not only its own.** A profile
  with no label target, a policy with an install or script automation, a report, agent options, Recovery Lock:
  each is the fleet's, and another worker's VM receives it mid-test. Scope it to the test's own host with a
  label (`policy-automation-runs`), or keep it inert and say in the header what the other VMs get
  (`install-on-host`, `profile-declarations`); what a neighbour must not receive at all goes in `exclusive/`
  (`script-execution-timeout` lowers the fleet's script timeout). Assert on the test's own host, or on set
  membership over hosts the test controls, never on a count over the fleet.
- **A test that needs a real VM is tagged with it**: `@vm-macos`, `@vm-windows` or `@vm-linux`, on the test or
  its describe (`{ tag: '@vm-linux' }`; `vmTag(platform)` in a loop over platforms). `requireRealHost` and
  `liveMacosHost` refuse a test that lacks the tag of the VM it asks for, and lint allows no other tag. So the
  tags list every test a platform's outage takes down: `npx playwright test --project=premium --grep @vm-macos`
  runs them, and `--grep-invert` leaves them out. The tag means "needs a VM of this platform online", a read
  of its name included, not "waits on its queue".
- **Software on the real VMs is durable.** The VMs fleet keeps one inert custom package per platform (plus
  7-Zip's `.exe` on Windows) and one Fleet-maintained app each for macOS and Windows, declared in
  `gitops/premium-fleetqa/fleets/vms.yml` and listed in `helpers/vm-fixtures.ts`, so every pool VM has the same. A spec that installs or
  uninstalls on a VM uses one of those and leaves it **uninstalled** — never deletes it. Only a spec that
  changes the title itself (a version swap, its own scripts, an install policy) uploads a per-run
  `fleet-pw-*` package, and deletes it in the same test.
- **A failed install costs its VM only the attempts.** Fleet tries a failed install three times, half a
  minute to a minute apart, before the failure sticks, and fleetd 1.63.0, which every lab host runs, doesn't
  back its config loop off after one (fleetdm/fleet#54607), so nothing else queued on the VM waits. To make an
  install fail on the host, build the package for the architecture the VM isn't (`foreignDebArch`,
  `inventory-reflects-install.spec.ts`): its dpkg refuses the package before unpacking, so nothing is left
  behind. To stop one before it reaches the host, give it a pre-install query that returns no rows
  (`preInstallQuery` on `uploadSoftwarePackageBuffer`). A *policy's* failing install still goes in
  `exclusive/` (`deploy-install-retries.spec.ts`): Fleet queues it below every user-requested install.
- **`kind: 'simulated'`** — ~300 osquery-perf simulations per tier for volume work (bulk select, transfer,
  pagination). They answer every live query with the same canned row, whatever the SQL (the daemons run with
  `--live_query_no_results_prob 0`, so they always answer), and pass every policy except `SELECT 0;`. The ~half
  that simulate orbit report script runs and installs they never performed: random output and exit code, and
  an install that fails ~5% of the time. So a green assertion against one proves nothing about the feature. A
  deleted simulation never comes back on its own.
- **Built-in platform labels hold whatever osquery-perf answers**, not hosts of that platform: on both
  instances the built-in **macOS** label holds the *Ubuntu* simulations. Pick hosts by their `platform` field
  (`findOnlineHost` and the simulation finders already do), never by built-in-label membership, and never target
  a Platforms chip for a live run. `premium/controls/scripts/batch-run.spec.ts`' scale test batches every online
  macOS-label member on Unassigned, so a script or install run now on a Linux simulation there can queue behind
  it, and moving Linux simulations off Unassigned shrinks its pool (it needs 50+).
- **Each tier also holds ~300 offline simulations**: the set the perf daemons abandon at their daily refresh
  (09:00 VM-local time), which host expiry deletes a day later. Every picker takes online hosts, so nothing reads them;
  a spec that needs dozens of hosts to move (not to answer anything) draws them with `findOfflineSimulations`
  and stages them on a throwaway `pw-*` fleet (`premium/hosts/bulk-transfer.spec.ts`).
- **A simulation can answer what Fleet decides server-side** — which hosts a profile is listed for, which are
  offered a software title, which a policy or report targets — so a label-targeting spec moves two onto the VMs
  fleet as the "outside the label" hosts beside the real VM. Borrow them with the `borrowSims` fixture, which
  moves them and returns them to Unassigned after the test, on the spec's own claim.
- **Every simulation a spec uses is claimed in `helpers/claims.ts`**, and the pickers take the claim's key,
  not a number: `findSimulations(request, 'e2e/shared/hosts/sort#linux')`. A claim names its pool (`plain`;
  `mdm` only for profiles, since MDM-enrolled simulations are scarce; `transfer` for moving or deleting
  hosts; `offline`; `fleetctl-mdm`), platform, slice and what the spec does to the hosts (`read`, `changed`,
  `moved`, `deleted`). `npm run lint:claims`, inside `npm run check`, fails on two claims sharing hosts on a
  tier unless all of them only read, on a claim bigger than its pool measured, and on a key its spec
  doesn't use or another spec does. A Fleet-maintained app a spec adds to a fleet is claimed there too
  (`CATALOG_CLAIMS`); `addFmaToFleet` takes only a claimed slug. The VMs sweep returns any simulation a
  killed run left.
- **The simulations re-enroll with the global enroll secret** on every daemon restart. Never replace the global
  list from a snapshot or post it empty: `restoreGlobalEnrollSecrets` is the one write a spec makes there, and
  `EnrollSecretModal` acts on a secret by its value only (`shared/settings/enroll-secrets.spec.ts`).

### Never deploy a passcode profile to a real host

**A passcode profile locks the VM out of reach.** The suite has no way back: only the device lab's owner can
recover it, by rolling the VM back to its baseline by hand, and until then one deployed passcode payload ends
every real-host spec on that VM. This is absolute: no `com.apple.mobiledevice.passwordpolicy` payload, no `forcePIN`, `minLength`,
`maxInactivity` or `allowSimple`, on any real host, for any reason.

The same caution covers anything else gating entry to the machine — screen lock, inactivity timeout,
FileVault, login-window restrictions, or disabling SSH / remote management / the MDM channel.

**Uploading a profile is delivering it.** There is no "library-only" profile: on **free** there are no fleets,
so Unassigned is where the real VMs are, and Fleet's profile reconciler — every 30 s — sends them whatever it
finds. A lifecycle spec's upload → delete window is a race against that tick, not a guarantee. The suite once kept a passcode profile and a Windows DeviceLock profile for
"upload → download → delete only"; the free VMs received them 7 and 32 times before anyone noticed. The only
profiles in `test-data/` are the inert pair `fleet-pw-inert.{mobileconfig,xml}` (a preference domain nothing
reads; Game DVR off), plus `fleet-pw-inert-signed.mobileconfig`, the same inert payload signed for the rejection
test — see their READMEs. Build any new one on the same pattern, remove it in the test that
delivered it, and never commit a lock profile, even for a spec that "only uploads" it.

If you are unsure whether a payload is safe to deploy, it is not. Ask first.

The same goes for fleet settings that act on the VMs: on the **VMs** fleet, never set an OS-update minimum
version or deadline, or a DDM software-update enforcement declaration — they make the real hosts download an
OS update or reboot mid-suite. Exercise those settings on Workstations and restore them in the same test.
**OS matrix** holds lab machines too, two MDM-enrolled Windows hosts and six encrypted Linux ones among
them, so all of this section applies to it, and so does disk encryption, which stays off for that fleet.
Windows enforcement turned on there acts on both Windows hosts: fleetd encrypts `prem-win10-01`'s `C:` by
itself, and on `prem-win11-bde`, which the lab keeps in Windows 11's stock BitLocker state for tests, it
adds protectors and turns protection on. Nothing in Fleet undoes either. Linux key escrow turned on
prompts nobody by itself: fleetd acts only after *Create key* is clicked on a host's My device page, and
until then the encrypted hosts read "Action required" (seen on the lab's hosts on 2026-11-16;
[`docs/device-lab-step-e-analysis.md`](docs/device-lab-step-e-analysis.md)). The disk-encryption tests turn
these settings on only on a throwaway fleet of their own, holding the one host they moved there (*Test hosts*).

**Recovery Lock password enforcement is the one exception, and only for `recovery-lock.spec.ts`** (approved
2026-09-29). It guards only entry to macOS Recovery — not login, SSH or MDM — Fleet escrows the password, and
turning it off makes Fleet clear it from the Mac. That spec turns it on for the VMs fleet and off in an
`afterEach`, and the resting-state step turns it off after a dead run. Enforcement is the fleet's, so every
pool Mac is sent a password while it is on: the spec waits until none holds one before it starts and before it
ends. Nothing else sets it on the VMs fleet, and nothing sets it on free, where the global setting would reach
the free Mac.

### Ask before any of these, too

None can be undone from a test. The `playwright-test-author` skill's stop list carries the detail.

- **A new profile payload type, even one believed inert.** macOS 26.6 installed a payload everyone expected it
  to refuse, so "inert" is a claim to check on the device, not a property of the XML. `helpers/profiles.ts`
  builds the approved ones.
- **The Fleet web address or the global end-user authentication (IdP) settings, saved changed.** Either
  re-syncs every fleet's DEP profile with Apple Business Manager, and the web address also feeds the Apple MDM
  URL, Windows MDM discovery, the Android callback and the SSO ACS URL. No test saves either: the IdP form is
  filled and validated, never submitted (`automatic-enrollment.spec.ts`).
- **An Android web app.** Fleet can create one and never delete it, so coverage that needs one is cut, not
  pinned as a durable fixture.
- **The org-wide *Store report results* setting.** It has no confirmation, and turning it off across the
  hourly cleanup deletes every stored result. It is never toggled.
- **Fleet's crons, triggered** (`POST /trigger`, `fleetctl trigger`: vulnerabilities, aggregation, the
  batch-activity checker). They are global, and every other run on the instance sees the effect: wait for the
  cron, or read the API.

## Locators and waits (Fleet-specific gotchas)

General locator priority and wait rules — see the `playwright-test-author` skill. The Fleet-specific rules that always apply:

- We do **not** add `data-testid` to Fleet's React source. Class fallbacks require an inline comment explaining why no role/text alternative exists; legitimate fallbacks are catalogued in the `playwright-test-reviewer` skill.
- No `page.waitForLoadState('networkidle')` — unreliable for SPAs that poll.
- Each page object's `goto()` must anchor on a stable element so callers don't need their own readiness wait.
- **The Hosts list rewrites its own URL** from the filters its table last queried with, so a filter or search
  chosen just after the page loads can be silently undone, and *Select all matching* then takes every host on the
  fleet. Choose them through `HostsListPage.searchFor`, `HostsListPage.filterTo`, `HostsListPage.filterByStatus`,
  `HostsListPage.sortBy` or `LabelFilter.selectLabel`, which remake a choice until the settled table's URL still
  carries it.

## Imports + fixtures

- Browser specs (under `tests/e2e/`) import `test` and `expect` from `'@fixtures'`, never from `@playwright/test`. Setup specs (`setup/*.ts`), pure-API specs under `tests/api/` (including `tests/api/gitops-verify/`), the `fleetctl` specs under `tests/cli/`, and `helpers/auth.ts` are the exceptions — they don't use page-object fixtures or the auto `pageHealth` fixture, so importing from `@playwright/test` is fine there. A pure-API or CLI spec that wants a worker fixture (`workstationsFleetId`, `vmsFleetId`, `liveMacosHost`) imports `apiTest` instead: `import { apiTest as test, expect } from '@fixtures'`. It never imports the browser `test`, whose `pageHealth` gives every test a page and so launches a browser the test doesn't use; lint refuses that import under `tests/api/` and `tests/cli/`.
- Cross-module imports use the path aliases configured in `tsconfig.json`: `@fixtures`, `@helpers/*`, `@pages`, `@pages/*`. Sibling imports inside a module stay relative (`./Foo`) to keep intra-module coupling visible.
- Specs target one of three scopes: Unassigned (no team), Workstations (the gitops-provisioned premium team), or All fleets (the global aggregate, used for reports/policies). Selection happens via `<page>.teamDropdown.select(scope)`, which is idempotent and a no-op on free (free has no dropdown). **Call it right after every `goto({ fleetId })` to one of those scopes, in every spec**: some of Fleet's pages keep the last-used fleet in localStorage and render that scope under a URL that names another.
- Premium specs that need to call `<page>.goto({ fleetId })` for the Workstations variant pull the fleet id from the `workstationsFleetId` worker fixture (resolved once per worker via the Fleet API).
- Do not create, rename or delete the instance's standing fleets: Workstations, VMs, QA, OS matrix and Compliance (declared in gitops) and Mobile (kept by hand, see `gitops/premium-fleetqa/README.md`). Compliance is gitops coverage only — it holds no hosts and no spec reads it, so the nightly's apply can change every control on it; a spec never puts a host there. It has end-user authentication on, so a global gitops file dry-run or applied against premium must declare the IdP (`org_settings.mdm.end_user_authentication`): fleetctl — and the server, under `--delete-other-fleets` — refuses a global file that would clear the IdP a fleet depends on. `carryLiveEndUserAuth` (`helpers/fleetctl.ts`) writes the instance's IdP into a `fleetctl new` scaffold for that reason. A spec that needs a fleet of its own takes a **throwaway `pw-*` fleet** from the `throwawayFleet` fixture, which deletes it after the test, a timed-out one included; the `cleanup-setup` / `cleanup-teardown` sweep removes any `pw-*` fleet a killed run left (approved by Andrey 2026-10-02; `fleets-lifecycle.spec.ts`, `historical-data-collection.spec.ts`). Scope a per-run fleet by URL (`<page>.goto({ fleetId })`), not by picking its name in the dropdown. One made without the fixture is deleted with `deleteFleet`, which deletes the fleet's bootstrap package first (a fleet delete leaves it behind). Never give a durable fleet a `pw-` name. Workstations is provisioned by gitops and never deleted; its content (all but its gitops reports) is wiped by the `cleanup-setup` project (pre-test) and the `cleanup-teardown` project (post-test) — both reference the same `setup/cleanup.steps.ts`.
- The `pageHealth` fixture is **auto-applied** to every test — it monitors uncaught page exceptions, console errors and 5xx server errors, and asserts at teardown. Uncaught exceptions come from `page.on('pageerror')`: Chromium doesn't surface them as console messages, so without that listener a render that throws passes silently. Tests that intentionally trigger console errors (negative-path auth, post-logout 401) opt out with `pageHealth.disable()`. An uncaught error owed to a filed, cosmetic Fleet defect is ignored by name instead, in `DEFAULT_IGNORED_PAGE_ERRORS` (`helpers/console.ts`), with its `TODO(fleetdm/fleet#N)` and a row in `docs/blocked-by-product-bugs.md`. 4xx is not flagged: it's normal app behaviour (auth probes, "no resource yet" 404s, premium-gated 402s) and assertions catch the meaningful ones. New specs need no setup to participate.
- For per-test state (a script, a custom package), create it as a precondition and register its undo with the `cleanup` fixture the moment it exists: `cleanup.add('delete script', (r) => deleteScript(r, id))`. The undo actions run after the test, last registered first, whether it passed, failed or **timed out**: Playwright skips the rest of a timed-out test, its `finally` included, but still tears down its fixtures. Each undo gets an API context of its own and treats "already gone" as done, since the test may have deleted the thing itself. `apiTest` carries it, so API and CLI specs have it too. The common things come from fixtures that name them with `ownName` and register their own undo: `throwawayFleet(kind)` (premium), `borrowSims({ claim, to })` (premium) and `seed.label` / `seed.policy` / `seed.report` / `seed.script`. Specs written before it use an `afterEach` with a describe-level tracker, which is also timeout-safe; a `finally` that calls the API is not, and lint fails a new one.

## API access

- Build URLs through `apiUrl(path)` from `@helpers/api`. Never inline `/api/v1/...` or `/api/latest/...` in test code.
- API helpers are split per area under `helpers/api/` (`core`, `activities`, `app-store`, `cleanup`, `config`, `enroll-secrets`, `fleets`, `fma`, `gitops-mode`, `hosts`, `labels`, `mdm`, `policies`, `profiles`, `reports`, `role-access`, `scripts`, `software`, `static-users`, `users`, `variables`). The barrel `@helpers/api` re-exports everything; specs can also reach for a specific module (`@helpers/api/software`) when they want narrower deps.
- Check a response with `expectOk(res, what)` from `@helpers/api`, never `expect(res).toBeOK()`: when that assertion fails, Playwright prints the request's headers with it, the bearer token among them, into the job log and the report. A helper throws on a response it didn't expect; it never returns `null` or an empty list for one, because a failed request is not "nothing there". A status that *is* an answer (a `404` for something already gone, a `402` on free) is named before the check.
- Use `authHeaders()` for every API call. The `FLEET_API_TOKEN` env user has admin perms across `/software`, `/queries`, `/policies`, etc.
- Use the Playwright `request` fixture; do not use raw `fetch()` from inside specs.
- `POST /login` is throttled to 10 a minute in one bucket shared by every user and worker. Browser specs sign in through `withStaticUser`'s cached sessions; an API-only login uses `apiLogin` (`helpers/api/users.ts`), which waits out a 429. A throttled UI login lands back on `/login` looking like a wrong password.

## Projects (folder-based)

Ten browser/API/CLI projects target three Fleet environments. Each has its own env file
(`.env.<suite>`) and its own auth state (`.auth/<suite>-admin.json`).
Project scope is determined purely by folder. The only tags are the real-VM ones (Test hosts), and no project selects by them yet. The `testIgnore`
matrix in `playwright.config.ts` is the source of truth:

| Project | Picks up | Skips | Auth state |
|---|---|---|---|
| `premium` | `tests/e2e/{shared,premium}/**`, `tests/cli/{shared,premium}/**`, `tests/api/**` outside `free/` and `gitops-verify/` | `**/free/**`, `**/loadtest/**`, `**/gitops-verify/**`, `**/cli/nightly/**`, `**/gitops-mode/**`, `**/exclusive/**`, `**/matrix/**`, `**/encryption/**` | `.auth/premium-admin.json` |
| `free` | `tests/e2e/{shared,free}/**`, `tests/cli/{shared,free}/**`, `tests/api/**` outside `premium/` and `gitops-verify/` | `**/premium/**`, `**/loadtest/**`, `**/gitops-verify/**`, `**/cli/nightly/**`, `**/exclusive/**` | `.auth/free-admin.json` |
| `loadtest` | `tests/loadtest/**` only (`testDir`), one worker | `**/api/**` | `.auth/loadtest-admin.json` |
| `loadtest-api` | `tests/loadtest/api/**` only (`testDir`), one worker, no browser | n/a | bearer token |
| `gitops-verify` | `tests/api/gitops-verify/**` only (`testDir`) | n/a | bearer token |
| `gitops-nightly` | `tests/cli/nightly/**` only (`testDir`), 180 s timeout, no retries | n/a | `fleetctl` with `FLEET_API_TOKEN` |
| `gitops-mode` | `tests/e2e/premium/gitops-mode/**` only (`testDir`), one worker, its own invocation after `premium-exclusive` | n/a | `.auth/premium-admin.json` |
| `premium-exclusive` | `tests/e2e/{shared,premium}/exclusive/**`, one worker, its own invocation after `premium` | n/a | `.auth/premium-admin.json` |
| `premium-matrix` | `tests/e2e/premium/matrix/**` only (`testDir`), its own invocation after the others | n/a | `.auth/premium-admin.json` |
| `premium-encryption` | `tests/e2e/premium/encryption/**` only (`testDir`), its own invocation after the smokes; no trace, screenshot or video | n/a | `.auth/premium-admin.json` |
| `free-exclusive` | `tests/e2e/{shared,free}/exclusive/**`, one worker, its own invocation after `free` | n/a | `.auth/free-admin.json` |

Folder conventions:

- Premium-only flow → `tests/e2e/premium/<area>/` (or `tests/api/role-access/premium/`).
- Free-only flow (paywall checks, free-license assertions) → `tests/e2e/free/<area>/` (or `tests/api/free/`, `tests/api/role-access/free/`).
- Tier-agnostic flow (auth, generic API contracts) → `tests/e2e/shared/<area>/` or root of `tests/api/`.
- Loadtest spec → `tests/loadtest/**`.
- Anything that turns gitops mode **on** → `tests/e2e/premium/gitops-mode/`. Enabling it is a global config
  write that makes every mutating control in the UI read-only, so it cannot share a window with any other
  project: the `gitops-mode` project runs alone, as CI's third step and `npm run test:premium`'s third
  invocation, and the config refuses to run it beside another browser project. Adding a `--project` name also
  means adding it to `PROJECT_TO_SUITE` in `playwright.config.ts`, which throws at config load for a name it
  doesn't know.
- A spec that flips a global setting which breaks specs running beside it goes under an `exclusive/` folder in its tier's tree (`tests/e2e/shared/exclusive/`, …). So does one that
  needs a real VM's queue to itself: Fleet runs a policy automation's scripts and installs at priority 0, below
  every user-requested one, so beside the install specs its attempts wait out their budget
  (`premium/exclusive/policies/policy-automation-runs.spec.ts`). And so does one that changes what every VM on
  the fleet runs under while other workers are on theirs (`shared/exclusive/script-execution-timeout.spec.ts`
  lowers the fleet's script timeout). The
  `premium-exclusive` / `free-exclusive` projects run those on one worker, **in their own `playwright test`
  invocation after the main project has finished** — whether or not it passed. CI runs them as a second step
  (`if: !cancelled()`) and merges both into one report; `npm run test:premium` / `test:free` run the two in
  sequence. They depend only on the tier's login setup and share `cleanup-teardown`, so **never name a main
  project and its exclusive one in the same invocation**: they'd run side by side, and the config refuses to.
  Filter by file name, not path, when running one (`playwright test --project=free-exclusive
  script-execution-timeout`): the exclusive projects' `testDir` is `tests/e2e`, so a `tests/e2e/…` path filter
  never matches.
- A check every OS version should get → a smoke in `tests/e2e/premium/matrix/os-smokes.spec.ts`, not a spec
  of its own: one describe per OS version of `lab-hosts.json`, each host's smokes in order in one worker, the
  hosts side by side. The `premium-matrix` project runs it **in its own invocation** (`npm run
  test:premium:matrix`; in CI its own workflow, `Playwright — OS smokes`, which the nightly runs after
  premium's suite and a branch run only when dispatched with `-f os-smokes=true`). It works the pool's VMs too, so the config refuses it beside `premium` or
  `premium-exclusive`; like them it depends only on login and shares `cleanup-teardown`. Filter by OS:
  `--project=premium-matrix -g "rhel-9 \("`.
- A disk-encryption flow on a real host → `tests/e2e/premium/encryption/`, the `premium-encryption` project
  (`npm run test:premium:encryption`; in CI `Playwright — Disk encryption`, which the nightly runs after the
  smokes and a branch run only with `-f encryption=true`). It takes OS matrix hosts, so the config refuses it
  beside `premium`, `premium-exclusive` or `premium-matrix`.

## Project pipeline (premium)

1. `premium-setup` — admin login, writes `.auth/premium-admin.json`.
2. `cleanup-setup` — pre-test dependency. Wipes what specs create on Unassigned and Workstations — but not
   Workstations' gitops reports beyond the copies specs save there by exact prefix (`pw-role-`, `Copy of
   playwright-saveasnew-`) — and throwaway `pw-*` fleets, test-added (`pw-enroll-`) global enroll secrets and
   `PW_VAR_*` variables; on the VMs fleet it takes `pw-*` things and borrowed simulations, reports only by exact
   prefix (`pw-run-script-`, `pw-rl-`, `pw-stored-results-`, since gitops declares `pw-host-report-results`
   there). A spec that leaves a new kind of per-run report on Workstations or VMs adds its prefix to that
   sweep. It also clears version pins on QA's and VMs' Fleet-maintained apps, turns gitops mode off,
   returns every lab host to its role's fleet, brings every pool VM to its resting state, and takes what a dead run of the per-OS smokes left on the OS matrix fleet and its hosts. It does **not** reset disk encryption or the
   BitLocker PIN, `macos_end_user_local_account_type`, the global macOS migration settings or the global end-user
   authentication (IdP) settings: no spec saves the IdP settings (Test hosts → *Ask before any of these,
   too*), and a spec that writes one of the others restores it, or works on a throwaway `pw-*` fleet.
   [`setup/CLAUDE.md`](setup/CLAUDE.md) has each step.
3. `cleanup-teardown` — same wipe steps run again at end of project regardless of pass/fail, so a crashed worker still leaves a clean instance. Both projects point at the same `setup/cleanup.steps.ts`.

Admin SSO and end-user auth (EUA) are assumed to be pre-configured on the instance — the suite does not provision them.

The `free` project runs the **same cleanup chain**, minus the fleet steps (fleets are premium-only). **Do not
plan a free spec around "nothing wipes this on free"** — global reports, policies, installable
software, profiles and scripts are all wiped on free too. The other way round, `pw-*` labels are swept on
premium only (inside the VMs-fleet step), so a free spec deletes its own.

The `gitops-mode` project runs alone, in its own invocation after the exclusive specs, and puts the flag and
its exceptions back after itself ([`tests/e2e/premium/gitops-mode/CLAUDE.md`](tests/e2e/premium/gitops-mode/CLAUDE.md)).
A spec never writes `secrets: false` outside it: a stuck one makes the next gitops apply delete every enroll
secret.

## Env vars

Every var in `.env.<suite>.example` that the suite reads is required — specs fail rather than skip when one is missing. The example files also carry the vars the gitops configs reference (`FLEET_ENROLL_SECRET`, `FLEET_SSO_METADATA_URL`, and on premium the ABM / VPP / EUA vars), grouped under their own comment header. The browser projects never read them, but a local `fleetctl gitops` apply and the `gitops-verify` / `gitops-nightly` projects do: `helpers/gitops-yaml.ts` expands `$VAR`s the way fleetctl does and throws on an unset one.

The static-user credentials (`FLEET_STATIC_USER_PASSWORD`, `FLEET_STATIC_TOKEN_*`) are shared and live in 1Password — never mint a replacement locally. The bearer tokens are shown once at user-creation time and cannot be rotated, so a locally-created user diverges from what CI uses.

Do not introduce new env-var skip gates without a load-bearing reason.

## E2E vs. performance specs

**E2E specs** (`tests/e2e/`) verify user-visible behaviour. Each area keeps **one** test that enters through the dashboard and clicks through the navbar / tabs / subnav to the feature (the first step of its CRUD lifecycle, where it has one), so the way in is covered once. Every other test goes straight to its page with the page object's `goto()`, which anchors on a ready element.

Default: a spec is a single end-to-end flow; cleanup runs at the end of the same test (no shared mutable state between tests).

**Exception — CRUD lifecycle specs** (policies, reports, scripts, profiles, software). These split each lifecycle step (create / edit / delete + a final dashboard activity-feed assertion) into its own sub-test inside a `test.describe.configure({ mode: 'serial' })` block, sharing identifiers via closure (`let policyId`, `let titleName`, etc.). The win is granular failure attribution while flake-fixing. Conventions:
- Only the first sub-test does the dashboard → navbar → list dropdown dance. Subsequent sub-tests go straight to the master list with `<page>.goto({ fleetId })`, resolving `fleetId` via `fleetIdFor(scope, workstationsFleetId)` from `@helpers/team-scope` (`'Workstations'` → the worker fixture, `'Unassigned'` → `0`, `'All fleets'` → `undefined`).
- Each of those `goto({ fleetId })` calls is followed by `<page>.teamDropdown.select(scope)`, as after any scoped `goto` (Imports + fixtures).
- The final sub-test asserts the dashboard activity feed via `dashboard.expectActivities([matcher, …])`: every matcher must match a row, and it reloads and re-walks the feed while one is missing. Build the strings with `activityCopy` (`@helpers/activity-copy`). Matchers use explicit verbs and the rendered scope suffix — they differ per resource and per tier, so scout the live feed when authoring a new one.
- Cleanup still runs inside the same describe block (the `delete` sub-test), so an aborted create still leaves the cleanup-teardown project to wipe state. The `cleanup` fixture and the data fixtures belong to one test: what a later step still uses is not registered with them, or it is gone before that step runs.

**Performance and API timing specs** (`tests/loadtest/`) follow rules of their own: [`tests/loadtest/CLAUDE.md`](tests/loadtest/CLAUDE.md).

## Skips

Every `test.skip(...)` or `test.describe.skip(...)` needs an inline comment naming the reason and what unblocks it. If a skip is gated on an env var, document the var in `.env.<suite>.example`. Where the skip gets recorded depends on why it exists:

- **Blocked by a confirmed Fleet defect** → a row in `docs/blocked-by-product-bugs.md` with the filed issue and the unblock condition, and a matching `TODO(fleetdm/fleet#NNNNN)` comment on the skip so the two can't drift. File the Fleet issue first — "make it green" is not the fix.
- **Env-gated, or deliberately deferred** → a row in `TODO.md`.
- **Data-availability guard** (`test.skip(!host, 'no macOS host')`, `gitopsConfig.scope !== 'no-team'`) → inline reason only. These are preconditions, not debt, and don't get tracked.

Lint holds a skip to this (`suite/skip-needs-reason`, under *Pre-PR check*): one that takes a test out of every run fails without `TODO(fleetdm/fleet#N)` or `TODO.md` in the comment directly above it, and a conditional one fails without its reason argument. So a `.skip` left over from debugging can't reach `main`.

## CI and the shared instances — current facts

The one place for facts that change. Skills and docs point here rather than restating them, so when one
changes, change it here. The reasoning behind the flow — why the chain is ordered as it is, what bounds a run,
how to change it safely — is [`docs/ci-pipeline.md`](docs/ci-pipeline.md).

| | |
|---|---|
| **the nightly** | `QA — Nightly` (`.github/workflows/qa-nightly.yml`): both Render deploy hooks → wait for the deploys (polls Render's API when `RENDER_API_KEY` + the two service ids are set, else 30 min) → both instances' `/healthz` → a notice with each instance's build → per tier, the nightly gitops chain, then that tier's suite (whatever gitops did), then on premium the per-OS smokes. Cron `17 3 * * *`, but GitHub starts it late: every scheduled run from 2026-10-01 to 10-10 started 5.9–7.3 h after the cron (09:09–10:35 UTC) and took 1 h 29 m–1 h 44 m, 30 min of it the fixed Render wait, finishing around 11:15–12:15 UTC. If the deploy wait fails, neither tier's gitops chain or suite runs |
| **a branch's full run** | `QA — Branch run` (`qa-branch-run.yml`): each tier's gitops chain, then its suite, against the branch; the suite runs whatever gitops did, as in the nightly, and a red gitops step still fails the run. `-f workers=N` runs premium's suite at that count, for a trial without a config commit; free always runs at its configured count (it has one VM per platform and a smaller instance). `-f os-smokes=true` adds the per-OS smokes, which a branch run otherwise leaves to the nightly. **Andrey dispatches it**: at the end of a piece of work, open the PR and tell him it's ready. A PR that changes a workflow file is dispatched with `--ref <branch>`: without it the run uses `main`'s workflow YAML, and `-f branch=` supplies only the tests and config |
| **the per-OS smokes** | `Playwright — OS smokes` (`playwright-os-smokes.yml`): the `premium-matrix` project against premium, as a workflow of its own. The nightly runs it after premium's suite, whatever that did; a branch run only with `-f os-smokes=true`; and it runs alone with `gh workflow run "Playwright — OS smokes"` (`--ref <branch>` for a branch's smokes). It holds premium's concurrency group, so it waits for a suite or a gitops apply that is running. Its report is its own artifact, `playwright-report-os-smokes` |
| **the disk-encryption tests** | `Playwright — Disk encryption` (`playwright-encryption.yml`): the `premium-encryption` project against premium, after the smokes in the nightly, with `-f encryption=true` in a branch run, or alone with `gh workflow run "Playwright — Disk encryption"`. Premium's concurrency group, 6 workers (one host each), report `playwright-report-encryption` |
| **is anything running?** | `gh run list --limit 5`, before any run that touches the instances. Two runs on one VM corrupt each other: one queue per VM, and each run's cleanup removes the other's state |
| **workers** | CI: free 2, premium 4 (`playwright.config.ts`); local default 4; `--workers=2` for anything on the real VMs. A worker has a VM of a platform to itself up to the pool's size (premium: 4 Ubuntu, 2 Windows, 2 macOS; free: 1 each), so premium's four have an Ubuntu VM each and share the Windows VMs and the Macs two ways. Premium went from 3 to 4 on 2026-11-15, on one green trial (branch run 43753582054: the main project 27 min against 33–36, still worker-bound; `docs/device-lab-plan.md`), so a flake that first shows in a nightly after that date is read against the count first, and 3 is the way back. The per-OS smokes run at 6 (`playwright-os-smokes.yml`): one worker walks one host through its smokes, so their count follows from their hosts, not from a pool |
| **retries and timeouts** | CI `retries: 2` (a report's `outcome: flaky` means it passed on a retry), local 0 — except the describes that wait on a real VM, which take `HOST_RETRIES` from `@fixtures` (1 in CI): a 15-min attempt three times is 45 min of one worker. The `gitops-mode`, `gitops-verify` and `gitops-nightly` projects take `retries: 0`, so the suite's `trace: 'on-first-retry'` never fires there; `gitops-mode` keeps the trace of a failed attempt instead (`retain-on-failure`). Test timeout 60 s unless a spec sets its own (the VM describes mostly 10–15 min; `policy-automation-runs` 20, `recovery-lock` 25); `expect` 10 s. In CI Playwright stops the main run at 100 min (`globalTimeout`), premium's exclusive step at 60 (free's at 15) and the gitops-mode step at 15, reports included; the premium job's limit is 185, free's 120. The per-OS smokes stop at 45 in a job whose limit is 60 |
| **runtime** | premium's main project ~27 min at 4 workers (job 44 min with the exclusive step's 13.3 and gitops-mode's 1.6; 2026-11-15, branch run 43753582054, the one run at 4 so far), free's job ~16 at 2. At 3 workers premium's were ~33 and 50 (the same day, branch run 43667531465: 711 and 373 results, each worker on a pool VM of its own), and ~42 and 57, with free's ~15, on 2026-11-13 (nightly 43413291769), with one VM per platform. Both are worker-bound to the last minute: premium's main project was 108 test-minutes / 4 (97 to 106 / 3 the same day, 123 / 3 on 2026-11-13), and free's 25 / 2. The pool removed queueing, not work: at 3 workers the main project's tests over 30 s that wait on a real VM took 53 test-minutes, from 81 (Linux 15 from 33, macOS 20 from 27, Windows 7 from 8, several platforms 12 from 13). The exclusive step runs on one worker after the main project, so its 14 minutes (`policy-automation-runs` 8, `deploy-install-retries` 4) stay whatever the worker count: the 4th worker took five to eight minutes off the main project, and the same off the job. `run_timeline.py` in the run-reviewer skill reconstructs this per worker, and `--platforms` splits it by VM. The per-OS smokes add about a quarter of an hour to the nightly, as a job of their own after premium's: 140 tests in 12.0 min at 6 workers, login and teardown included, the job 13.5 (2026-11-15, branch run 43690094173: 57 test-minutes; 9.2 min and 45 on a laptop), an install and an uninstall with the inventory after each 1.2–2.5 min a host; the three Windows matrix hosts' turn is the floor |
| **a run's reports** | a green `QA — Nightly` or `QA — Branch run` run uploads two artifacts, the suites' HTML reports: `playwright-report-{premium,free}` (the main project, its exclusive specs and, on premium, gitops-mode run as separate steps and merge into this one report), and where the per-OS smokes ran, a third, `playwright-report-os-smokes`. The gitops chains' sixteen Playwright jobs upload a report only when they fail, named for the job: `gitops-verify-report-<tier>-<target>` (premium verifies its no-team config, Workstations, Compliance, QA, VMs and OS matrix after each of its two applies, the QA, VMs and OS matrix ones suffixed `-baseline` / `-min`; free verifies its no-team config after each) or `gitops-nightly-cli-report-<tier>`. A green gitops job uploads nothing and adds no annotation to the run page: its log lists each check it ran (the config's CI reporter is `list`; the suites pass `github,blob`, so the page's annotations are the suites' run summaries and their failures). Each artifact is one **encrypted** file, `<name>.tar.gz.enc`, because a report holds typed passwords and the API token and this repository's artifacts are public: `fetch_ci_run.sh` (the run-reviewer's) downloads and decrypts them with the report key at `~/.config/qa-automation/report-private-key.pem` (or `QA_REPORT_KEY`). The two suite reports also hold `results.json`, the merged run as data, and are kept 90 days (the others 7); the run-reviewer's `run_history.py` builds each test's history from them. The run's last job, `run-history`, writes that history into the run's summary: how each failed or flaky test fared in the 14 nightlies before, and whether the error is the same one. Never paste a report's request headers or typed values into an issue, PR or review ([`docs/ci-pipeline.md`](docs/ci-pipeline.md)) |
| **a failure in the main project** | doesn't skip the exclusive or gitops-mode specs: each runs as its own step afterwards, pass or fail. Nor the per-OS smokes, which are a job of their own after premium's, whatever it did |
| **the instances' gitops state** | every gitops chain (the nightly, a branch run) applies the full config, verifies it, then applies the **min** config (`gitops/premium-fleetqa-min`, `free-fleetqa-min`) and ends there; the suite's cleanup then wipes every global report, policy, script and profile and Workstations' policies, profiles, scripts and software. So between runs an instance holds **min's org settings, labels and custom host vitals, Workstations' reports (3 of its 5), everything on QA, VMs and Compliance (min's version of it), and OS matrix declared empty**, and none of the rest until the next chain. Before calling a declared item missing, check which of those it is; a spec reads an item both configs declare and the cleanup keeps ("Collect default browser on macOS") |
| **the instances' build** | both redeploy the 4.95 RC tag every night, and a failed deploy is silent: Render keeps the old instance serving. `GET /api/latest/fleet/version` gives the `revision`; `GET /debug/migrations` (admin token) gives `status_code`, where 2 means every migration is applied |

## Pre-PR check

```bash
npm run check          # tsc --noEmit + the lint rules' own tests + the claims check + the lab manifest check + eslint
```

This is the pre-PR gate — it catches the common mistakes locally. The premium and free suites also run nightly in CI (`QA — Nightly`, above), but don't rely on that to catch what `npm run check` would.

**Lint prints nothing, or it fails.** No rule is a warning (`eslint . --max-warnings 0`), so every line it prints is a line to act on. Beside ESLint's and the Playwright plugin's rules it carries the suite's own contract, as the `suite/*` rules in `eslint-rules/`:

| Rule | Fails on | Write instead |
|---|---|---|
| `suite/no-class-locator-in-spec` | `locator('.some-class')` in a spec, on any receiver | a locator on the page object or component that owns the element, with the comment that says why no role or text works |
| `suite/no-page-locator-in-spec` | `page.getBy*()` in a browser spec (also `adminPage.…`, `dashboard.page.…`) | a named locator or method on a page object or component; a locator chained off one the page object returned is fine |
| `suite/no-date-now-in-name` | `Date.now()` that ends up in a string: `` `pw-${Date.now()}` ``, or a `stamp` variable used that way | `ownName(kind)` from `@helpers/own-name`, or `runNonce()` from `@helpers/profiles` for a name that can't open with `pw-` (an email, a `PW_VAR_` name); time arithmetic (`Date.now() - start`) is not flagged |
| `suite/use-own-name` | a `pw-` name built at run time: `` `pw-policy-${runNonce()}` ``, `'pw-report-' + suffix` | `ownName('policy')`: `pw-<kind>-<run>-w<worker>-<nonce>`, so a leftover names the run and worker that made it, and the sweeps' prefixes still match; an extension goes outside it (`` `${ownName('script')}.sh` ``) |
| `suite/modal-in-component`, `suite/react-select-in-component`, `suite/actions-menu-in-component`, `suite/sql-editor-in-component` | in a page object outside `pages/components/`, a shared widget's selector: the modal container class (`modal__modal_container`), a `react-select__…` class, an `actions-dropdown…` class, the `.sql-editor` class | the widget's component: `fleetModal(page, '<title>')` (`pages/components/Modal`), `new ReactSelect(<container>)` or `new ActionsMenu(row)` (`pages/components/dropdowns`), `new SqlEditor(page)` (`pages/components/SqlEditor`) |
| `suite/no-toast-copy-in-spec` | copy typed into `toast.expectSuccess(…)` / `toast.expectError(…)` in a spec: a string, a template or a regex | `toastCopy.<area>.<entry>` from `@helpers/toast-copy`, adding the entry there with the Fleet source that renders it; when Fleet rewords a toast, one line changes |
| `suite/no-api-cleanup-in-finally` | in a spec, a `finally` that uses `request` (outside an `afterEach` / `afterAll`): a timed-out test skips it | `cleanup.add(what, (request) => …)` right after the thing exists, or create through `throwawayFleet`, `borrowSims` or `seed`, which register their own; a `finally` that only closes a local file or context is not flagged |
| `suite/activity-needs-baseline` | every `assertActivity(…)` | `latestActivityId()` before the action, then `assertActivityAfter(…)`: without the baseline a retry, the other scope of a loop or an earlier run satisfies the check |
| `suite/no-swallowed-response` | in `helpers/`, `setup/` and `fixtures.ts`: `if (!res.ok())` whose branch neither throws nor returns the status | throw with the status and body, and name an expected status (`404`, `402`) before it: a dropped 5xx reads as "nothing there" |
| `suite/no-to-be-ok` | `expect(res).toBeOK()` anywhere: a failure prints the bearer token | `expectOk(res, what)` from `@helpers/api` |
| `suite/skip-needs-reason` | a skip that takes a test out of every run (`test.skip('title', …)`, `test.describe.skip`, a bare `test.skip()`, and the same with `fixme`) with no `TODO(fleetdm/fleet#N)` or `TODO.md` in the comment directly above it; a conditional skip with no reason argument | what *Skips* asks for: the tracking comment, or `test.skip(!host, 'no online macOS host')` |

`{ force: true }` fails as well (`playwright/no-force-option`). Where a user really can't act on the control (a disabled button's tooltip), keep it under `// eslint-disable-next-line playwright/no-force-option -- <why>`. The same directive, with its reason, is the way past any rule that is wrong for one line.

**Code written before a rule is recorded, not rewritten.** `eslint-suppressions.json` holds, per file and rule, how many places predate the rule; `npm run lint:contract` counts the same places from the code. ESLint keeps a file quiet while it has no more than its recorded count, so:

- A new violation fails. In a file that has recorded ones, ESLint then lists every place of that rule in the file, old and new: fix yours, and the old ones can go with it.
- Fixing an old one fails with "suppressions left that do not occur anymore": run `npm run lint:prune` and commit the smaller record.
- The record only shrinks. Never add to it, and never re-create it (`--suppress-all`, `--suppress-rule`) to get a change through. A file that moves takes its entry along: rename its key.
- ESLint applies the record only from the command line, so an editor's ESLint integration may underline the recorded places in a file you open.

While building, run only the specs you changed — `npx playwright test --project=<tier> <spec-file-names>` on every tier they target, with dependencies at least once, `--workers=2` for anything on the real VMs, and nothing else running against the instance (`gh run list`). The full suite runs once, at the end, as `QA — Branch run`, which Andrey dispatches (facts above). The `playwright-test-author` skill has the detail.
