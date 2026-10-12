# FMA smoke — analysis of the existing suite (Parts 1–2)

Baseline: `qa-automation-poc` `main` at `ad6d121` (2026-10-10). Fleet API facts were checked against
`fleetdm/fleet` `main` at `30e080ccb6`, re-checked at `b27eebfbe6` (both 2026-10-12). Paths are relative to the repo root; line numbers are
`main`'s, before the `fma-smoke/*` branches touched anything. The design that answers this analysis is
[`fma-smoke.md`](./fma-smoke.md).

The suite is in better shape than a POC usually is. Most of what an FMA smoke needs already exists as helpers,
and the hard-won rules about the real VMs are written down. The gaps are narrow ones:

- there is no fast-fail install wait;
- nothing reads install output;
- nothing walks the FMA catalog;
- nothing installs through self-service;
- nothing runs a patch policy on a host;
- the VMs-fleet sweep can't see a runtime-added FMA.

---

## Part 1 — How the suite works

### 1. Architecture

**Projects are folder-scoped, not tag-scoped.** See `playwright/playwright.config.ts:188-412`.

- `premium` and `free` both use `testDir: ./tests`.
- Each project excludes everything outside its tier through `testIgnore`: `**/free/**` or `**/premium/**`,
  plus `**/exclusive/**`, `**/gitops-mode/**`, `**/gitops-verify/**`, `**/loadtest/**` and `**/cli/nightly/**`
  (`:216-237`, `:310-327`).
- Exclusive specs run in their own projects, with one worker and no parallelism, as a **separate invocation**
  after the main project (`:239-266`, `:328-340`). This is deliberate: as a dependency, one red main-project
  test would skip all of them.
- `gitops-mode` is the same idea: a third invocation, `retries: 0` (`:279-302`).
- `gitops-verify`, `gitops-nightly`, `loadtest` and `loadtest-api` are the remaining projects.
- The config refuses unsafe combinations at load time (`:99-133`):
  - a main project and its exclusive one in a single invocation;
  - two tiers in a single invocation;
  - `gitops-mode` beside anything else.
- It also refuses an unknown `--project` name (`PROJECT_TO_SUITE`, `:12-31`). **A new project must be
  registered there.**

**Tier and instance selection.**

- `SUITE` or the `--project` name picks `.env.<suite>` (`:63-141`).
- CI uses `retries: 2`, 3 workers on premium and 2 on free, and a `globalTimeout` of 100 min (`:145-164`).
- Test timeout is 60 s and `expect` timeout is 10 s (`:171-175`).

**Fixtures.** Everything is in `playwright/fixtures.ts`:

- page-object fixtures;
- worker fixtures that resolve standing fleets by name: `workstationsFleetId`, `qaFleetId`, `vmsFleetId`
  (`:270-281`);
- `liveMacosHost` (`:283-294`);
- `pageHealth`, an auto fixture that monitors console errors, page exceptions and 5xx responses
  (`:296-321`). Because it requests `page`, **any spec that imports `@fixtures` starts a browser**. Pure-API
  specs import `@playwright/test` instead, which `playwright/CLAUDE.md:133` explicitly allows;
- `HOST_RETRIES` is 1 in CI and 0 locally, for describes that wait on a VM (`:540`).

**Page objects and API helpers are strictly separated.**

- `pages/` holds about 90 page and component objects. `HostDetailsPage` exposes `.library`, a
  `HostSoftwareLibrary` (`pages/components/HostSoftwareLibrary.ts`).
- `helpers/api/` holds per-area modules behind a barrel (`helpers/api/index.ts`).
- `helpers/README.md` forbids `getByRole` in helpers.

**Auth.**

- UI specs use storage state written by `setup/premium.setup.ts` (admin form login, `helpers/auth.ts`).
- API calls send `Authorization: Bearer $FLEET_API_TOKEN` through `authHeaders()`
  (`helpers/api/core.ts:44-46`). `getApiToken` falls back to a fresh login (`:49-67`).
- Role coverage uses **static, pre-provisioned users** whose tokens can't be re-minted
  (`helpers/api/static-users.ts`; `FLEET_STATIC_TOKEN_*` in `.github/workflows/playwright-premium.yml:80-91`).
- `withStaticUser` caches sessions because `POST /login` is throttled to 10 per minute across the suite
  (`playwright/CLAUDE.md:147`).

### 2. API layer

- **No generated client.** The client is hand-typed. Each helper narrows the JSON it reads into a small
  interface, for example `SoftwarePackageDetail` (`helpers/api/software.ts:274-341`) and `FleetPolicy`
  (`helpers/api/policies.ts:167-221`).
- URLs come from `apiUrl()`, which is pinned to `/api/v1/fleet` (`core.ts:14-20`). gitops-verify reads
  `/api/latest` (`:27`).
- Helpers throw on a non-OK response by convention (author skill, "Throw on a non-OK response"), because a
  swallowed 500 once hid MySQL "table is full" errors. **One exception remains:** `findHostByPlatform` uses raw
  `fetch` and returns null on error (`helpers/api/hosts.ts:44-53`).
- **Polling.** There is no generic retry wrapper. Waits are `expect.poll` with explicit `timeout` and
  `intervals`, wrapped in purpose-built helpers:

  | Helper | Waits for | Budget |
  |---|---|---|
  | `waitForHostSoftwareStatus` (`software.ts:677`) | one named status | 300 s at 5 s |
  | `waitForSoftwareSettled` (`software.ts:796`) | status, then pending refetch drained, then baseline `detail_updated_at`, then refetch, then inventory agrees | up to 2 rounds; ~19 min worst case |
  | `waitForNoPendingRefetch` / `waitForHostRefetch` (`hosts.ts:680`, `:724`) | `refetch_requested` false / a collected-at timestamp moving past a baseline | 240 s |
  | `waitForBatchFinished` (`scripts.ts:281`) | a script batch | 480 s |
  | `queryHost` (`profiles.ts:225`) | a synchronous live query, after waiting out a refetch (a host mid-refetch can't answer) | 3 attempts |

- **How async work is awaited.**
  - Installs and uninstalls go through `installSoftwareOnHost` / `uninstallSoftwareOnHost`. Fleet answers 202
    with no body and no UUID (`server/service/software_installers.go:777-783` on Fleet main). The wait is
    therefore always "poll the host's Library row status".
  - Scripts use `getScriptResult` by execution id.
  - MDM commands use `listHostMdmCommands`.
- **Gap for a smoke suite.** `waitForHostSoftwareStatus` waits for one *named* status. A `failed_install` sits
  out the whole 300 s before the poll gives up, and nothing reads the install's script output
  (`GET /software/install/:uuid/results`).

### 3. Test data and state

- **Standing fleets are never created or deleted.** Workstations, VMs, QA and Compliance are gitops-declared;
  Mobile is kept by hand.
- A spec that needs a fleet creates a throwaway **`pw-*`** fleet (`createFleet` / `deleteFleet`,
  `helpers/api/fleets.ts:116-152`). `cleanup-setup` sweeps it (`setup/cleanup.steps.ts:104-109`).
- **Per-run names.** Packages are `fleet-pw-*`; scripts, policies, labels and fleets are `pw-*`. The suffix is
  `runNonce()` (`helpers/profiles.ts:235`) or `Date.now().toString(36)`. Three specs still copy their own
  `nonce` instead of using `runNonce`.
- **Two-sided cleanup.** `cleanup-setup` and `cleanup-teardown` run the same `setup/cleanup.steps.ts`:
  - wipe Unassigned (`:62-98`) and Workstations (`:126-157`);
  - clear version pins on QA and VMs (`:160-182`);
  - sweep the VMs fleet by prefix (`:184-247`);
  - return the real VMs to their resting state: cancel the suite's queued work, reset the script timeout,
    uninstall durable fixtures (`:249-330`).
- **Isolation with `workers > 1`.**
  - Specs avoid each other by **claiming** distinct fixtures: FMA slugs per spec (claims table in
    `docs/test-audit/06-software-library.md:53-66`) and simulation slices (registry in `hosts.ts`).
  - Collisions are avoided by convention only. No lock enforces it.
- **Exclusive specs** (`tests/e2e/{shared,premium}/exclusive/`):
  - `shared/exclusive/script-execution-disabled.spec.ts` flips a global switch.
  - `premium/exclusive/os-updates/{ddm-conflict,macos-updates}.spec.ts` change OS-update settings.
  - `premium/exclusive/policies/policy-automation-runs.spec.ts` needs a VM queue to itself: policy
    automations queue at priority 0, below user work.
  - `premium/exclusive/software/deploy-install-retries.spec.ts` deliberately fails install scripts. That puts
    orbit into a 1/2/4/5-minute backoff (fleetdm/fleet#54607) which stalls the VM.

### 4. Real hosts

- **Two populations.**
  - Real VMs: macOS 26.6, Windows 11 and Ubuntu 26.04, all ARM, on the **VMs** fleet.
  - About 300 osquery-perf simulations per tier.
- A host's kind is read from its **hardware model**: `/virtual|qemu/i` means real (`hosts.ts:144-157`). MDM
  enrollment is deliberately not the signal.
- **Picking a host.**
  - `requireRealHost(request, platform)` (`hosts.ts:905-927`) pages `findOnlineHost(kind:'real')` and throws
    with a diagnosis from `missingRealHostReason`: offline, details unreadable, or not enrolled.
  - Never pick a host by stored name or id (`playwright/CLAUDE.md:41-45`).
- **Simulations prove nothing about installs.** They report random install results and answer every live query
  with the same canned row (`playwright/CLAUDE.md:63-68`).
- **Waiting for check-in and inventory.**
  - `waitForSoftwareSettled` posts its own refetch and waits on `detail_updated_at`, never on
    `software_updated_at`, which moves only when inventory changes.
  - The measured refetch is 70–120 s on a VM (`hosts.ts:718-723`).
  - `refetch_requested` is set by Fleet after every install, so the helper waits that refetch out first.

### 5. Existing software coverage

There are 36 specs plus a few peripheral ones. No spec uses a fixed sleep: the only `setTimeout` sleep in the
repo is in an unconditionally skipped packs test (`tests/e2e/shared/packs/packs.spec.ts:132`).

| Spec (`tests/e2e/premium/…` unless noted) | Asserts | Host | Skips |
|---|---|---|---|
| `software/library.spec.ts` | UI add → activity → Library row → delete for pkg/msi/deb, **FMA Airtame (macOS), 7-Zip (Windows)**, VPP Bear, Android; serial per scope | none | — |
| `software/fleet-maintained-filters.spec.ts` | FMA catalog count = `countFleetMaintainedApps` per platform; "Hide added apps"; search | none | — |
| `software/custom-icons.spec.ts` | icon upload/replace/remove on FMA anydesk / archaeology | none | — |
| `software/display-name.spec.ts` | display name on FMA clockify | none | — |
| `software/version-pinning.spec.ts` | Versions modal; exact/major/latest pins stored (QA shelf, Postman) | none | `:217` until 2 cached versions |
| `software/patch-policy.spec.ts` | Deploy → Patch options stored per option (LocalSend macOS, KeePassXC Windows); Windows refuses notify (400) | none (Workstations) | — |
| `software/software-lifecycle-on-host.spec.ts` | install → Library/details/activity/inventory → uninstall, for six durable fixtures incl. **FMA Itsycal + DB Browser for SQLite** | real, all 3 | — |
| `software/update-on-host.spec.ts` | Update vs Reinstall contract; Claude (durable FMA) update; pin walk | real, all 3 | `:185` host already level; `:213` <2 Claude builds — "has never run past its skip" (doc 21:784) |
| `software/install-on-host.spec.ts` | Deploy creates `[Install software]` policy; VM installs through it | real Linux | — |
| `software/inventory-reflects-install.spec.ts` | install → Inventory; failing pre-install query → 3× failed | real Linux | TODO #54607 |
| `software/uninstall-from-host.spec.ts` | failing uninstall script → `failed_uninstall`, still listed | real Linux | — |
| `software/script-only-package.spec.ts` | .sh package Run/Rerun on the Mac | real macOS | — |
| `software/software-label-targets.spec.ts` | include/exclude label scoping offered set; install under include-all | real Linux + 2 sims | — |
| `software/package-scripts.spec.ts`, `edit-package.spec.ts`, `add-software-validation.spec.ts`, `large-upload.spec.ts` | custom-package scripts, SHA-256, edit, client validation, upload progress | none | — |
| `software/host-library-tab.spec.ts` | Library count = API on each VM | real, all 3 | — |
| `software/no-teams-views.spec.ts`, `titles-table.spec.ts`, `role-access.spec.ts`, `manage-automations-access.spec.ts`, `os.spec.ts`, `vulnerabilities.spec.ts` | listing, scope, roles, vulns | mixed | vulnerabilities `:109` (#50059), several #49913 |
| `exclusive/software/deploy-install-retries.spec.ts` | failed Deploy installs retried 3×, policy-attributed | real Linux | TODO #54607 |
| `controls/setup-experience/install-software.spec.ts` | setup-experience selection for pkg/msi/deb, **FMA 1Password**, VPP, Android; pagination with 11 FMAs | none | per-case cleanup is inline, not in a `finally` |
| `policies/policy-automations.spec.ts` | install-software automation stored on a policy | none | `:188` #54623 |
| `tests/api/gitops-verify/software.spec.ts` | live software set == gitops (FMA by slug, pins, self_service, categories, labels, scripts, icon fetch) | none | `:54` no-team scope |
| `tests/api/gitops-verify/policies.spec.ts` | `install_software` + `patch_software` targets | none | — |
| `tests/e2e/shared/hosts/host-software.spec.ts`, `free/hosts/host-software-tab.spec.ts`, `tests/api/host-software-payload.spec.ts`, `tests/loadtest/software*.spec.ts` | inventory views and timings | sims / real Mac | — |

**Not covered anywhere:**

- self-service install, through the device page or `POST /device/{token}/software/install/{id}`;
- a patch policy evaluated on a host (patch-policy.spec runs on Workstations, which has no hosts);
- any FMA install beyond Itsycal, DB Browser and Claude;
- the catalog as a whole.

### 6. Gitops interplay

| Config | `fleet_maintained_apps` | Other software |
|---|---|---|
| `gitops/premium-fleetqa/fleets/qa.yml:45-68` | 20 slugs, no pins (1password, claude, firefox, google-chrome, notion, postman, slack, visual-studio-code, zed, zoom × darwin/windows): the version-pinning "shelf" | — |
| `gitops/premium-fleetqa/fleets/vms.yml:105-115` | `claude/{darwin,windows}`, `itsycal/darwin`, `db-browser-for-sqlite/windows` | 4 packages incl. `7-zip.package.yml` (ARM64 .exe); policies "Claude is installed" with `install_software.fleet_maintained_app_slug` (`:86-103`) |
| `gitops/premium-fleetqa/fleets/compliance.yml:165-207` | `itsycal/darwin` (self_service, setup_experience, labels, post-install), `db-browser-for-sqlite/windows` (`version: "^3"`) | `type: patch` policies for both (`:254-265`) |
| `premium-fleetqa-min/fleets/compliance.yml` | same, minus a few keys | patch policies kept |
| Workstations, every `default.yml`, free configs | no `software:` key | — |

**What an apply deletes.**

- **Undeclared software inside a declared fleet.** vms.yml says so (`:51-55`), as does qa.yml (`:7-8`).
  Software isn't a gitops exception (`.github/scripts/restore-gitops-exceptions.sh:24` sets
  `software: false`).
- **Not undeclared fleets.** No workflow passes `delete-other-fleets` (`.github/gitops-action/action.yml:13-17`,
  `:60-62`).

**What that means for runtime FMAs.**

- A `pw-fma-*` fleet is invisible to gitops. Only the suite's `pw-*` sweep removes it.
- An FMA a spec adds to **VMs** or **QA** survives until either the suite's sweep or the next apply. The apply
  deletes it, but only if the apply runs, and it shares `premium-fleetqa-instance` with the suite.
- **Adding a slug a fleet already declares is a conflict.** Fleet allows one installer per software title per
  fleet (`docs/Configuration/yaml-files.md` on Fleet main, ~line 664), and deleting it removes the durable
  copy. On VMs that covers the four FMAs above, plus `7-zip/windows`: the custom 7-Zip .exe title merges into
  the 7-zip FMA title through `reconcile_windows_maintained_app_titles`
  (`helpers/vm-fixtures.ts:20-28`).

### 7. CI

- **Nightly.** `qa-nightly.yml`:
  1. Render deploy.
  2. Settle and health check.
  3. Per tier: `nightly-qa-gitops-<tier>.yml`, then `playwright-<tier>.yml` (`:152-180`).
- **Branch run.** `qa-branch-run.yml` runs the same chain against a branch. Andrey dispatches it.
- **`playwright-premium.yml` has three test steps:**
  - `--project=premium`;
  - `premium-exclusive` (`if: !cancelled()`, `--global-timeout=3600000`);
  - `gitops-mode`;
  - then the blobs are merged into one HTML report (`:131-160`).

  Job timeout is 185 min (`:48`). Measured runtime is about 63.5 min for the job, of which about 85
  test-minutes wait on VMs (`playwright/CLAUDE.md:273`).
- **Concurrency.** Every premium workflow that touches the instance holds `premium-fleetqa-instance`
  (`playwright-premium.yml:31-33`, `nightly-qa-gitops-premium.yml:31-32`). The comment says why: "the real VMs
  work one queue each". A new FMA smoke workflow **must join that group, not take its own**. A separate group
  would let it run beside the suite on the same VM queues, and beside a gitops apply that deletes its titles.
- **Static gate.** `playwright-check.yml` runs `npm run check` (tsc + eslint) on every PR.

### 8. Quality issues

**Flakiness sources**

- **No fixed sleeps in live code.** The one `setTimeout` sleep (`packs.spec.ts:132`) sits in an
  unconditionally skipped test.
- **Compound waits can exceed their test budget.** `waitForSoftwareSettled` can run about 19 minutes in the
  worst case against 900 s test budgets (`software-lifecycle-on-host.spec.ts:118`,
  `software-label-targets.spec.ts:56`, `inventory-reflects-install.spec.ts:52`). A slow VM then shows up as a
  test timeout, the `finally` is skipped, and cleanup depends on the sweep.
- **Six polls in `patch-policy.spec.ts`** (`:96`, `:118`, `:132`, `:146`, `:160`, `:192`) have no explicit
  timeout, so they inherit the 10 s `expect.timeout`. That is tight on a loaded instance.
- **Order dependence.**
  - gitops-mode files run as `01-` … `zz-` by design.
  - premium-exclusive relies on path order (`deploy-install-retries.spec.ts:27-29`).
  - About 35 `mode: 'serial'` describes chain state, five of them in software: `edit-package`, `library`,
    `update-on-host` Claude, `version-pinning`, setup-experience `install-software`. A failure in the
    `update-on-host` darwin run skips the Windows one.
- **Shared mutable state.**
  - Fixed-name titles are claimed only by convention.
  - Durable VM fixtures are shared across specs.
  - `--repeat-each` on `software-lifecycle-on-host` races itself (author skill).

**Dead code and duplication**

- **All of `helpers/catalogs/`** (`fma.ts` with 276 slugs, `vpp.ts`, `android.ts`): about 600 lines with no
  importer. It is also stale: it lacks `localsend/darwin` (used by patch-policy), `itsycal/darwin` and
  `db-browser-for-sqlite/windows` (both on VMs), and the live catalog has 1,422 entries. FINDINGS §3 #1
  already proposes deleting it.
- **Unused exports:** `deleteSoftwareTitleByPackageName` (`software.ts:200`), `cancelScriptBatch`,
  `transferHostsByFilter`, `recreateFleet`, `setManualLabelHosts`, `updateUser`, `requirePasswordReset`,
  `deleteUserSessions`, `staticUsersForTier`, `fleetctl.clientVersion`.
- **Duplicated helpers:**
  - `GET software/titles` is wrapped five ways (`software.ts:~79`, `~134`, `~228`, `872`; `fma.ts:147`).
  - `GET hosts/:id/software` is wrapped four ways (`software.ts:631`, `662`, `845`, `898`).
  - The "installed? then uninstall" logic exists twice (`software.ts:709-750` vs `vm-fixtures.ts:90-115`).
  - `escapeRegExp` ×4, `nonce` ×3, `rand` ×3.
- **Latent bugs and stale docs:**
  - `getHostSoftwareState` reads one page of 100 (`software.ts:637`). A host offered more than 100 titles
    would read as "not offered".
  - `TODO.md:27-29` says three product-defect skips; there is now one.

**From `docs/blocked-by-product-bugs.md`, relevant to software**

- **#54607** (orbit backoff after a failed install script) shapes everything about installing on VMs (`:54`).
- **#50059** (`vulnerable=true` not fleet-scoped) is the only active software skip (`:33`).
- **#49913** (CVE detail 404s) is a workaround (`:50-51`).
- **#54845** is an ignored console error on Android configuration (`:69`).
- **#20440** means a new `.exe` title starts unlinked from inventory (cited in `vm-fixtures.ts` and doc 21).

---

## Part 2 — Gap analysis for an FMA smoke

| Need | State | Where / what's missing |
|---|---|---|
| List the catalog per platform | **Partial** | `findFmaIdBySlug` pages the list (`helpers/api/fma.ts:21-48`) but keeps only id↔slug. `countFleetMaintainedApps` (`:59-76`) gives counts. Nothing returns the entries. Fleet paginates by app token and signals the end with `meta.has_next_results` (Fleet `server/datastore/mysql/maintained_apps.go:552+`), so a row-count stop is only incidentally right. *Scaffolded:* `listAllFleetMaintainedApps`. |
| Read one catalog entry's manifest metadata without downloading | **Missing** | `GET /software/fleet_maintained_apps/{id}` hydrates version, url and scripts from the manifest with no download (Fleet `ee/server/service/maintained_apps.go:299-318`). *Scaffolded:* `getFleetMaintainedApp`. |
| Add an FMA (API) | **Exists** | `addFmaToFleet` (`fma.ts:105-122`). It asserts OK, so a refusal can't be classified. *Scaffolded:* `tryAddFmaToFleet`. |
| Add an FMA (UI) | **Exists** | `library.spec.ts` through `FleetMaintainedAppsPage` / `FleetMaintainedAppDetailPage`. |
| Validate stored metadata | **Partial** | `getSoftwarePackage` (`software.ts:306-341`) reads version, SHA-256 and scripts, but not platform, the FMA link or the title-level `bundle_identifier` / `upgrade_code`. The catalog object hides `SHA256` and `UniqueIdentifier` (`json:"-"`, Fleet `server/fleet/maintained_apps.go:17-18`). The stored title exposes `hash_sha256` (`software_installer.go`) plus `bundle_identifier` / `upgrade_code` (`software.go` `SoftwareTitle`). *Scaffolded:* `getFleetMaintainedTitleMetadata`. |
| Install on a real macOS host and Windows host, polling to a terminal state | **Partial** | `installSoftwareOnHost` + `waitForHostSoftwareStatus`, used for Itsycal / DB Browser in `software-lifecycle-on-host.spec.ts`. No fast-fail on `failed_install`, and no output capture. *Scaffolded:* `waitForSoftwareActionTerminal`, `getHostLastInstall`, `getSoftwareInstallResult`. |
| Presence in software inventory | **Exists** | `waitForSoftwareSettled` with `version` (`software.ts:796-835`). |
| Presence by live osquery (`apps` / `programs`) | **Exists** (helper), **Missing** (for software) | `queryHost` (`helpers/api/profiles.ts:225-246`) is used only for profiles and policy values. |
| Uninstall and verify removal | **Exists** | `uninstallSoftwareOnHost` + `waitForSoftwareSettled(null)`; `ensureNotInstalled`. |
| Self-service install (premium) | **Missing** | No spec. `SoftwareLibraryPage.selfServiceSwitch` is unused. The API path exists: `GET /hosts/{id}/device_url` (Fleet handler.go:539) gives the device token, and `POST /device/{token}/software/install/{title_id}` (handler.go ~1005) installs. **Not scaffolded** (plan item 7). |
| Patch policy: created for the FMA | **Exists** (server-side) | `createFleetPolicy({type:'patch', patch_software_title_id})`, `findPatchPolicy` (`policies.ts:223-275`). `patch-policy.spec.ts` covers the options on Workstations. |
| Patch policy: fails when outdated, passes after update | **Partial → Missing** | Never evaluated on a host. Fleet's patch query *passes* on a host without the app: it is the manifest's `patched` query, or a default of the same shape, `SELECT 1 WHERE NOT EXISTS (… version_compare(…) < 0)` (Fleet `pkg/patch_policy/patch_policy.go:109-151`). So "passes after install" proves only that the policy evaluated again; the meaningful check is "outdated fails, then patched passes", which needs the host on n-1 (a second cached build, `update-on-host.spec.ts:213`, never run past its skip). The host layer records its check as `weak` and plan item 8 owns the real one. |
| Gitops path | **Partial** | `gitops-verify/software.spec.ts` asserts the applied FMA set and options for declared fleets. Nothing applies a per-run fleet YAML. `tests/cli/*` drives `fleetctl gitops --dry-run` only. Plan item 9. |
| Teardown without orphans | **Partial** | Throwaway `pw-*` fleets are swept, and deleting a fleet takes its installers and policies with it. On VMs the sweep removes only `fleet-pw-*` titles and `pw-*` policies (`cleanup.steps.ts:202-247`): an FMA added there at run time keeps its vendor file name and would be invisible to it. The design avoids the problem rather than widening the sweep: the catalog layer uses its own `pw-fma-*` fleet, and the host layer's apps are durable VMs-fleet fixtures declared in `vms.yml` (pending Andrey's approval; see the design). |
