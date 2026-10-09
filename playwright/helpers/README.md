# Helpers

This directory holds **non-UI utilities** — API calls, console monitoring,
performance measurement. UI interactions belong in `../pages/` (page objects
and component objects). See [`../pages/README.md`](../pages/README.md).

## When to reach for helpers vs pages

| Need | Use |
|------|-----|
| Click a button / fill a field / assert a UI element | A page object method (`pages/`) |
| Call the Fleet REST API | `@helpers/api` (or a specific module under `api/`) |
| Monitor console / network errors on a page | `@helpers/console` — usually consumed via the auto `pageHealth` fixture |
| Measure a page's load time | `@helpers/perf` |
| Log in the admin at setup time, or open a second context as another user | `@helpers/auth` |
| Act as a specific pre-provisioned role (API token or UI login) | `@helpers/api/static-users` |
| Assert an endpoint is allowed / denied for a role | `@helpers/api/role-access` |
| Resolve a live host to test against | `findOnlineHost` from `@helpers/api/hosts` |
| Assert activity-feed wording | `@helpers/activity-copy` |
| Pick a known FMA / VPP / Android app for an API or UI search test | `@helpers/catalogs` |

If you catch yourself writing `page.getByRole(...)` in a helper, stop —
that's a page-object responsibility.

## Files

| Path | Purpose |
|------|---------|
| [`api/`](./api/) | Per-area Fleet API helpers (see below). The barrel `@helpers/api` re-exports everything. |
| [`activity-copy.ts`](./activity-copy.ts) | `activityCopy` — the expected activity-feed strings, shared by the specs that assert the feed and by the copy-contract API spec, so wording lives in one place |
| [`auth.ts`](./auth.ts) | `loginAsAdmin()` (setup projects, writes `.auth/*.json`), plus `withCleanContext()` / `withStaticUser()` for specs that need a second browser context signed in as someone else (a cached session is reused only while both its cookie and Fleet's session are alive), and `sessionBearerHeaders(page)` — the signed-in user's own bearer token, read from Fleet's session cookie, for calling the API as a `withStaticUser` user |
| [`csv.ts`](./csv.ts) | `parseCsv` / `csvRecords` / `readCsvDownload` — read the CSV Fleet's frontend exports (every field quoted, `""` for a quote, `="0123"` for leading zeros) into a header and records keyed by it |
| [`console.ts`](./console.ts) | `monitorConsoleErrors()`, `monitorPageErrors()`, `monitorNetworkFailures()`, plus the default ignore lists (`DEFAULT_IGNORED_CONSOLE_ERRORS`, `DEFAULT_IGNORED_PAGE_ERRORS`). Wired into every test via the auto `pageHealth` fixture in `fixtures.ts`. |
| [`gitops-yaml.ts`](./gitops-yaml.ts) | Loads a gitops target — a directory's `default.yml` with the names of its sibling `fleets/*.yml`, or one fleet file — into typed entries: `path:` refs, `paths:` globs and inline entities alike, each entity with its option fields, plus the org or fleet settings, `agent_options`, the `controls` flags, `software` (packages through their package files) and `custom_host_vitals`. Expands `$VAR`s the way fleetctl does and throws on an unset one. The reader behind the `gitops-verify` specs and `tests/cli/nightly/` |
| [`perf.ts`](./perf.ts) | `measureNav()`, `measureSearch()` — time user-perceived loads |
| [`perf-teardown.ts`](./perf-teardown.ts) | Performance summary table + historical comparison; also folds in the API run via `finishApiRun()` |
| [`perf-api.ts`](./perf-api.ts) | API timing engine for the `loadtest-api` project: shape expansion, one-in-flight sampling with per-request and per-shape caps, severity, run history under `.perf-history-api/` |
| [`team-scope.ts`](./team-scope.ts) | `fleetIdFor(scope, workstationsFleetId)` — maps `'All fleets'` / `'Unassigned'` / `'Workstations'` to the `fleet_id` URL value (`undefined` / `0` / wsId) for scope-aware page-object `goto({ fleetId })` calls; `fleetIdFromUrl(url)` — the fleet a page is scoped to, from its `fleet_id` param |
| [`profiles.ts`](./profiles.ts) | `inertMobileconfig(name)` / `inertWindowsProfile(name)` / `inertDeclaration(name)` (Apple's no-op `management.test`) / `rejectedMobileconfig(name)` (a Wi-Fi payload with no SSID, which macOS refuses — for Fleet's retries) — configuration profiles generated at run time on the pattern of the committed inert pair (`writeProfile` puts one where the upload modal can take it), each with a name, `PayloadIdentifier` and preference domain of its own so parallel uploads never collide; `runNonce()`. Every name starts `pw-` for the cleanup sweep. One generated Windows profile per fleet at a time: they share the one approved LocURI. At the end, fenced off: `updateEnforcementDeclaration` / `windowsUpdateProfile` — real OS update payloads, which force updates on a host, for the DDM-conflict spec on Workstations only; each demands `noRealHostsOnFleet: true` |
| [`vm-fixtures.ts`](./vm-fixtures.ts) | `VM_SOFTWARE_FIXTURES` — the VMs fleet's durable install/uninstall software (declared in `gitops/premium-fleetqa/fleets/vms.yml`), `findVmFixtureTitle`, `isVmFixtureInstalled`, `ensureVmFixtureUninstalled`. Shared by `software-lifecycle-on-host.spec.ts` and the cleanup preflight |
| [`vuln.ts`](./vuln.ts) | Vulnerability column assertions (`expectRowHasVulnData`, `expectSingleCve`, `assertVulnTooltip`) for specs that drill into the "Vulnerabilities" column of the DataTable |
| [`catalogs/`](./catalogs/) | Typed app-store reference catalogs: `fmaApps`, `vppApps`, `vppUiSearchNames`, `androidApps`. Pick (id + platform) for API/GitOps tests; pick a name for UI search tests |

### `api/` modules

| Module | What's inside |
|--------|---------------|
| `core.ts` | `apiUrl`, `apiLatestUrl`, `authHeaders`, `getApiToken`, `withApiRequest`, shared `HostRef` / `FleetRef` types |
| `activities.ts` | `assertActivity` (test-side check; fails the test if missing), `findActivity` (lower-level lookup); `latestActivityId` + `assertActivityAfter` — an activity newer than the log's last entry before the step, for ones an earlier run (or the test's own setup) could have left identical; `listHostActivities` — a host's Past activities with their id and actor (empty for what Fleet does on its own, like a policy automation) |
| `hosts.ts` | `findOnlineHost` (resolve by platform + `kind: 'real' \| 'simulated'`), `findHostByPlatform`, `findHostWithSoftware`, `findSimulatedHostIds`, `findMdmSimulations` (MDM-enrolled simulations on Unassigned to borrow onto the VMs fleet as the "outside the label" host), `hostExists`, `getHostFleetId`, `getHostDisplayName` (pairs with the simulation finders, which return ids), `getHostPlatform` (Fleet's `os_version.platform` for the host — what a live query of that column returns), `getHostDetailUpdatedAt`, `requireRealHost` (the online real VM of a platform, or a failure saying why — `missingRealHostReason`: offline since its last check-in, online but unreadable, or not enrolled at all), `listFleetHosts`, `waitForHostRefetch` / `waitForNoPendingRefetch`, `getHostRefetchRequested` (whether a refetch is outstanding — Fleet sets it after a successful install or uninstall, and the flag doesn't say who set it), `listUpcomingActivities` / `cancelUpcomingActivity` (a host's queue); `getHostCollectedAt` / `waitForHostRefetch` also take `policy_updated_at` (moves once a policy result has landed — after Fleet queued the automations it fired), `transferHosts`, `transferHostsByFilter`; `findMdmSimulations` / `findSimulations` (simulations on Unassigned to borrow onto the VMs fleet as the "outside the label" host, each spec on its own slice — the registry is in `hosts.ts`), `findScriptableSimulations` (the simulations of a `findSimulations` slice that can run a shell script now: online on Unassigned, simulating orbit, scripts enabled), `findOfflineSimulations` (yesterday's abandoned simulations, offline until host expiry deletes them — a pool nothing else reads, for a spec that needs dozens of hosts), `listHostsRunningOs` (what "View all hosts" on an OS version lists); the host's end user — `putHostIdpUsername` (raw response: 402 on free), `deleteHostIdpUsername`, `getHostIdpUsername`; its Recovery Lock password — `getHostRecoveryLockStatus` (from `GET /hosts/:id`, which isn't a view) and `waitForRecoveryLockStatus` |
| `fleets.ts` | `findFleetByName`, `createFleet`, `deleteFleet` (deletes the fleet's bootstrap package first: a fleet delete leaves it behind), `recreateFleet`, `deleteFleetsWithPrefix` (the cleanup sweep for throwaway `pw-*` fleets), plus the per-fleet webhook / host-expiry getters and setters; a fleet's OS update settings — `getFleetOsUpdates`, `setFleetMacosUpdates`, `setFleetWindowsUpdates`, `clearFleetOsUpdates` (**Workstations only**: on a fleet with real hosts they force updates) — and `appleListedMacosVersions` (the versions Fleet accepts as a minimum, from Apple's feed); `getFleetRecoveryLock` / `setFleetRecoveryLock` (**only `recovery-lock.spec.ts` turns it on for the VMs fleet**); `getFleetWindowsDiskEncryption` (a fleet's Windows enforcement and BitLocker PIN, read back) |
| `software.ts` | `uploadSoftwarePackage`, `findSoftwareTitleByPackageName`, `deleteSoftwareTitle*`, `getSoftwareTitle`, `getSoftwarePackage`, `getAppStoreAppConfiguration` (an App Store or Play Store app's stored managed configuration on one fleet), `findVulnerableSoftwareBySources`, `SoftwareTitleRef` / `SoftwarePackageRef`; `uploadSoftwarePackageBuffer` (a package built at run time; `automaticInstall` is the form's **Deploy**, which adds the `[Install software] …` policy; `preInstallQuery` — one that returns no rows is how to make an install fail without stalling orbit, fleetdm/fleet#54607); `hostsOfferedTitle` (which of a set of hosts a title is offered to — a label scope decides it); `countHostLibraryTitles` (the count behind a host Library's "N items"); `getSoftwarePackage` also reads the package's label scope; `findRenderableCve(request, cves, fleetId)` — the first CVE whose detail page renders **in the page's scope** (200 only; a 204 means no host in that fleet), and `hostVulnerableVersions` — the vulnerable versions of one title a host has installed; `listVulnerabilities` (the Vulnerabilities list for a scope, `exploit` / `query`, with each CVE's count, CISA flag and EPSS), `listVulnerabilityHosts` (the hosts a CVE's "View all hosts" opens, read live), `listHostCves` (the CVEs of a host's own installed software — live, unlike a fleet's hourly counts) |
| `fma.ts` | `findFmaIdBySlug` (pages through the whole catalog — 1,424 entries on 4.93), `addFmaToFleet`, `countFleetMaintainedApps`, `findAvailableFleetMaintainedApp` (the first app a fleet hasn't added, from `available=true`), `listFleetMaintainedTitles`, `setPinnedVersion` (`''` = latest; writes its multipart body by hand, since Playwright drops an empty-string field and Fleet then changes nothing, and reads the pin back) |
| `app-store.ts` | `addAppStoreApp`, `AppStorePlatform` |
| `mdm.ts` | Bootstrap package, EULA, setup assistant, and setup-experience getters/deleters, plus the bulk `deleteAllConfigurationProfiles` / `deleteAllScripts` used by cleanup; `listHostMdmCommands` (a host's InstallProfile / RemoveProfile / … commands and their status); `uploadBootstrapPackage` (an API precondition); `getMacosSetupSettings` (a scope's stored end-user auth, Lock end user info and manual agent install — `/config` for Unassigned, `/teams/:id` otherwise); `patchSetupExperience` and `setSetupExperienceSoftware` (return the response, so a spec can assert a refusal); `resetManualAgentInstall` (part of `resetSetupExperience`: while "Install fleetd manually" is on, a fleet's Install software (macOS) and Run script cards are disabled); `getAppleApnsInfo` (the push certificate's common name and renew date) |
| `profiles.ts` | Configuration profiles three ways: the fleet's record (`uploadProfile` with label targets, `getProfile`, `listProfiles`, `findProfileByName`, `deleteProfile`; `targetsFor` / `targetsOf` to compare what the modal set with what Fleet stored), the host's (`listHostProfiles`, `hostsListingProfile` — which of a set of hosts Fleet lists it for, `profileListings` / `waitForProfileListings` for several profiles at once, `waitForHostProfileStatus`, `waitForHostProfileGone`), and the device's (`queryHost` — waits out a pending refetch before each attempt, since a host mid-refetch can't answer within Fleet's 25 s; `readManagedPreferenceDomain`, `readWindowsPolicyValue` — always filtered to one domain or value) |
| `config.ts` | `getAppConfig`, `patchAppConfig`, `setGlobalDiskEncryption`, `canSendEmail` (SMTP or SES — what enables the user form's 2FA checkbox), `getMacosMigration` (the global end user migration workflow), and the typed `AppConfig` / `WebhookSettings` / `MacosMigration` shapes |
| `gitops-mode.ts` | The `config.gitops` subtree, which `PATCH /config` replaces whole: `getGitOpsMode`, `setGitOpsMode`, `enableGitOpsMode` (exceptions default to all off), `disableGitOpsMode` (the flag only), `setGitOpsException`, `withGitOpsMode` (snapshot, apply, restorer), and `resetGitOpsMode`: the mode off and the exceptions at `GITOPS_EXCEPTIONS_BASELINE`, which `fleetctl gitops` reads even with the mode off (a stuck `secrets: false` makes the next apply delete every enroll secret). The baseline is pinned again in `.github/scripts/restore-gitops-exceptions.sh`; change both together |
| `policies.ts` | `createPolicy` (optionally for some platforms), `deletePolicies`, `PolicyRef`, `getGlobalPolicy` (a global policy read back, its stored `platform` included), `listFleetPolicies`, `deleteFleetPolicies`, `listHostPolicyIds` (the policies Fleet runs on a host — a label or platform target decides it), `getHostPolicyResponses` (what a host last answered per policy: `pass`, `fail`, or `''` before it has run it), `listPolicyHosts` (the hosts a policy's Pass / Fail "View all hosts" opens, read live); a fleet policy with its automations and patch fields — `createFleetPolicy`, `updateFleetPolicy`, `getFleetPolicy` (`FleetPolicyFields` in Fleet's own names; `FleetPolicy` read back: its fleet, its author's email, install title, script, continuous, patch flags), `findPatchPolicy` (a title's patch policy, by what it patches — Fleet names it) |
| `reports.ts` | `createReport` (scheduled, with Discard data — the kind a host's Reports tab hides by default — or with Observers can run), `listReports`, `findReportBy{Id,Name}`, `deleteReport`, `deleteReportsMatching`, `getHostReportLastFetched`, `listHostReportIds` (the reports Fleet lists for a host — a label target decides it), `setReportInterval` |
| `labels.ts` | `deleteLabelsMatching`, `deleteLabelsWithPrefix` (the cleanup sweep's), `getLabelId`, `listLabelHostIds`, `createManualLabel` / `setManualLabelHosts` (a label holding exactly the hosts a targeting spec chose), `deleteLabelById` (returns the status — Fleet refuses to delete a targeted label); `findLabelByName` (a label read back with its author and fleet — every label made in the UI is global) |
| `scripts.ts` | Library scripts: `uploadScript` (no `fleet_id` for Unassigned, which free refuses as `0`), `deleteScript` (a 404 is fine; deleting a script deletes its batch runs). One host's run: `queueAdHocScript` / `postAdHocScript`, `getHostScriptLastExecution`, `getScriptResult`; a fleet's (or the global) agent options, where the script timeout lives, via `getAgentOptions` / `setAgentOptions`. Batch runs: `runScriptBatch` (by host ids, now or at `notBefore`; every host must be on the script's fleet), `cancelScriptBatch`, `findBatchId` (the newest batch for a per-run script name), `getBatchSummary` (status, `notBefore`, `batchCanceled`, per-status counts), `listBatchHostIds` (a status tab's hosts), `waitForBatchFinished` (the 5-minute completion check, 480 s) |
| `variables.ts` | `createVariable` (a global custom variable, referenced as `$FLEET_SECRET_<name>`), `listVariables`, `deleteVariablesMatching` (ignores Fleet's refusal to delete a variable a script still uses — delete the script first) |
| `enroll-secrets.ts` | Global + per-fleet enroll-secret getters; `setTeamEnrollSecrets` (a fleet's full list, for snapshot restores); `restoreGlobalEnrollSecrets` — the **only** global write: live list minus the named markers plus any original that went missing, never a snapshot replace and never an empty list, because the simulations re-enroll with the global secret; `GLOBAL_ENROLL_MARKER` (`pw-enroll-`, in every test-added global secret) and `removeGlobalEnrollMarkers` (the cleanup sweep for one a killed run left) |
| `users.ts` | `createUser` / `createApiUser`, `updateUser`, `deleteUser`, `findUserByEmail`, `requirePasswordReset`, `deleteUserSessions`, `apiLogin` (a cookie-less `POST /login` that waits out Fleet's suite-wide login throttle), plus `qaTestEmail()` / `deleteAllQaTestUsers()` for disposable test users, and `deleteLeftoverApiTestUsers()` for the API-only ones (Fleet-generated emails, so matched by the specs' `QA API <label> <stamp>` naming — `QA_TEST_API_USER_NAME_RE` — never the static `QA Static API …` users) |
| `static-users.ts` | The `STATIC_USERS` registry of pre-provisioned accounts (never created by the suite) and the accessors that resolve one to its password, bearer token, or expected role display |
| `role-access.ts` | `expectAllow` / `expectDeny` plus the per-role `PROBES_*` endpoint sets the role-access specs iterate |
| `cleanup.ts` | Bulk wipes for queries, packs, and global/team policies — used by `setup/cleanup.steps.ts` |

Specs default to importing from the barrel:

```ts
import { addFmaToFleet, getSoftwareTitle } from '@helpers/api';
```

A spec can also reach for a specific module when it wants narrower deps or
to make the call site easier to grep:

```ts
import { addFmaToFleet } from '@helpers/api/fma';
```

## Conventions

### API calls — use `authHeaders()`

```ts
import { apiUrl, authHeaders, findActivity } from '@helpers/api';

const res = await request.get(apiUrl('config'), { headers: authHeaders() });

const activity = await findActivity(request, 'created_pack', (d) => d.pack_name === name);
```

Never inline `{ Authorization: \`Bearer ${process.env.FLEET_API_TOKEN}\` }` — one place to update when auth semantics change.

### Page health monitoring — automatic via the fixture

The `pageHealth` fixture in `fixtures.ts` is `auto: true`, so every test
imported from `@fixtures` already has console-error and 5xx server-error
monitoring running. 4xx isn't flagged: it's normal app behaviour
(auth probes, "no resource yet" 404s, premium-gated 402s) and assertions
catch the meaningful ones. Adjust `DEFAULT_IGNORED_CONSOLE_ERRORS` in
[`console.ts`](./console.ts) for new console-error noise, and
`DEFAULT_IGNORED_PAGE_ERRORS` for an uncaught exception owed to a filed, cosmetic
Fleet defect (each entry carries its `TODO(fleetdm/fleet#N)` and a row in
`docs/blocked-by-product-bugs.md`).

If a test legitimately triggers errors (negative-path auth, post-logout
401), it can opt out at the top of the test body:

```ts
test('rejects bad credentials', async ({ loginPage, pageHealth }) => {
  pageHealth.disable();
  await loginPage.login('nope@example.com', 'wrong');
  await expect(loginPage.authFailedMessage).toBeVisible();
});
```

The lower-level `monitorConsoleErrors` / `monitorNetworkFailures` helpers
are still exported for one-off diagnostic use, but specs should reach for
the fixture rather than wiring listeners by hand.

### Performance — use `measureNav` / `measureSearch`

```ts
import { measureNav } from '@helpers/perf';

test('Software page', async ({ page }, testInfo) => {
  await measureNav(page, testInfo, 'Software page', async () => {
    await page.goto('/software/titles');
    await expect(page.getByRole('table').locator('tbody tr').first()).toBeVisible();
  });
});
```

Results are aggregated into a summary table at the end of the run with deltas against the 3 previous runs. See `perf-teardown.ts`.

### App-store catalogs — pick by id (API) or name (UI)

```ts
import {
  fmaApps,
  vppApps,
  vppUiSearchNames,
  androidApps,
} from '@helpers/catalogs';
import { apiUrl, authHeaders } from '@helpers/api';

// API: pick the first macOS VPP entry and add it to the fleet
const vpp = vppApps.find((a) => a.platform === 'darwin')!;
await request.post(apiUrl('software/app_store_apps'), {
  headers: authHeaders(),
  data: { app_store_id: vpp.appStoreId, platform: vpp.platform, fleet_id: fleet.id },
});

// UI: search through the App Store list for a name we know exists
for (const name of vppUiSearchNames) {
  await page.getByRole('searchbox').fill(name);
  await expect(page.getByRole('row', { name: new RegExp(name) })).toBeVisible();
}
```

The catalogs hold *identifiers only* — never bake `self_service` or
`setup_experience` into entries; tests set those on the request.

## Related READMEs

- [`../pages/README.md`](../pages/README.md) — Page Object Model, locator priority, authoring guide
- [`../pages/components/README.md`](../pages/components/README.md) — Component objects (DataTable, Navbar, etc.)
- [`../tests/README.md`](../tests/README.md) — Writing tests that use the POM + helpers
