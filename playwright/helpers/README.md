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
| [`auth.ts`](./auth.ts) | `loginAsAdmin()` (setup projects, writes `.auth/*.json`), plus `withCleanContext()` / `withStaticUser()` for specs that need a second browser context signed in as someone else, and `sessionBearerHeaders(page)` — the signed-in user's own bearer token, read from Fleet's session cookie, for calling the API as a `withStaticUser` user |
| [`console.ts`](./console.ts) | `monitorConsoleErrors()`, `monitorNetworkFailures()`, plus the default ignore lists. Wired into every test via the auto `pageHealth` fixture in `fixtures.ts`. |
| [`gitops-yaml.ts`](./gitops-yaml.ts) | Loads and flattens a gitops target's YAML `path:` refs into typed entries — the reader behind the `gitops-verify` specs |
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
| `hosts.ts` | `findOnlineHost` (resolve by platform + `kind: 'real' \| 'simulated'`), `findHostByPlatform`, `findHostWithSoftware`, `findSimulatedHostIds`, `findMdmSimulations` (MDM-enrolled simulations on Unassigned to borrow onto the VMs fleet as the "outside the label" host), `hostExists`, `getHostFleetId`, `getHostDetailUpdatedAt`, `requireRealHost` (the online real VM of a platform, or a failure), `listFleetHosts`, `waitForHostRefetch` / `waitForNoPendingRefetch`, `listUpcomingActivities` / `cancelUpcomingActivity` (a host's queue); `getHostCollectedAt` / `waitForHostRefetch` also take `policy_updated_at` (moves once a policy result has landed — after Fleet queued the automations it fired), `transferHosts`, `transferHostsByFilter`; `findMdmSimulations` / `findSimulations` (simulations on Unassigned to borrow onto the VMs fleet as the "outside the label" host, each spec on its own slice — registry in the docs), `listHostsRunningOs` (what "View all hosts" on an OS version lists); the host's end user — `putHostIdpUsername` (raw response: 402 on free), `deleteHostIdpUsername`, `getHostIdpUsername`; its Recovery Lock password — `getHostRecoveryLockStatus` (from `GET /hosts/:id`, which isn't a view) and `waitForRecoveryLockStatus` |
| `fleets.ts` | `findFleetByName`, `createFleet`, `deleteFleet`, `recreateFleet`, plus the per-fleet webhook / host-expiry getters and setters; a fleet's OS update settings — `getFleetOsUpdates`, `setFleetMacosUpdates`, `setFleetWindowsUpdates`, `clearFleetOsUpdates` (**Workstations only**: on a fleet with real hosts they force updates) — and `appleListedMacosVersions` (the versions Fleet accepts as a minimum, from Apple's feed); `getFleetRecoveryLock` / `setFleetRecoveryLock` (**only `recovery-lock.spec.ts` turns it on for the VMs fleet**) |
| `software.ts` | `uploadSoftwarePackage`, `findSoftwareTitleByPackageName`, `deleteSoftwareTitle*`, `getSoftwareTitle`, `getSoftwarePackage`, `findVulnerableSoftwareBySources`, `SoftwareTitleRef` / `SoftwarePackageRef`; `uploadSoftwarePackageBuffer` (a package built at run time; `automaticInstall` is the form's **Deploy**, which adds the `[Install software] …` policy; `preInstallQuery` — one that returns no rows is how to make an install fail without stalling orbit, fleetdm/fleet#54607); `hostsOfferedTitle` (which of a set of hosts a title is offered to — a label scope decides it); `getSoftwarePackage` also reads the package's label scope; `findRenderableCve(request, cves, fleetId)` — the first CVE whose detail page renders **in the page's scope** (200 only; a 204 means no host in that fleet), and `hostVulnerableVersions` — the vulnerable versions of one title a host has installed |
| `fma.ts` | `findFmaIdBySlug` (pages through the whole catalog — 1,424 entries on 4.93), `addFmaToFleet`, `countFleetMaintainedApps`, `listFleetMaintainedTitles`, `setPinnedVersion` (`''` = latest; writes its multipart body by hand, since Playwright drops an empty-string field and Fleet then changes nothing, and reads the pin back) |
| `app-store.ts` | `addAppStoreApp`, `AppStorePlatform` |
| `mdm.ts` | Bootstrap package, EULA, setup assistant, and setup-experience getters/deleters, plus the bulk `deleteAllConfigurationProfiles` / `deleteAllScripts` used by cleanup; `listHostMdmCommands` (a host's InstallProfile / RemoveProfile / … commands and their status) |
| `profiles.ts` | Configuration profiles three ways: the fleet's record (`uploadProfile` with label targets, `getProfile`, `listProfiles`, `findProfileByName`, `deleteProfile`; `targetsFor` / `targetsOf` to compare what the modal set with what Fleet stored), the host's (`listHostProfiles`, `hostsListingProfile` — which of a set of hosts Fleet lists it for, `profileListings` / `waitForProfileListings` for several profiles at once, `waitForHostProfileStatus`, `waitForHostProfileGone`), and the device's (`queryHost`, `readManagedPreferenceDomain`, `readWindowsPolicyValue` — always filtered to one domain or value) |
| `config.ts` | `getAppConfig`, `patchAppConfig`, `setGlobalDiskEncryption`, `canSendEmail` (SMTP or SES — what enables the user form's 2FA checkbox), and the typed `AppConfig` / `WebhookSettings` shapes |
| `policies.ts` | `createPolicy`, `deletePolicies`, `PolicyRef`, `listFleetPolicies`, `deleteFleetPolicies`, `listHostPolicyIds` (the policies Fleet runs on a host — a label target decides it); a fleet policy with its automations and patch fields — `createFleetPolicy`, `updateFleetPolicy`, `getFleetPolicy` (`FleetPolicyFields` in Fleet's own names; `FleetPolicy` read back: install title, script, continuous, patch flags), `findPatchPolicy` (a title's patch policy, by what it patches — Fleet names it) |
| `reports.ts` | `createReport`, `listReports`, `findReportBy{Id,Name}`, `deleteReport`, `deleteReportsMatching`, `getHostReportLastFetched`, `listHostReportIds` (the reports Fleet lists for a host — a label target decides it), `setReportInterval` |
| `labels.ts` | `deleteLabelsMatching`, `deleteLabelsWithPrefix` (the cleanup sweep's), `getLabelId`, `listLabelHostIds`, `createManualLabel` / `setManualLabelHosts` (a label holding exactly the hosts a targeting spec chose), `deleteLabelById` (returns the status — Fleet refuses to delete a targeted label) |
| `variables.ts` | `listVariables`, `deleteVariablesMatching` |
| `enroll-secrets.ts` | Global + per-team enroll-secret getters and setters |
| `users.ts` | `createUser` / `createApiUser`, `updateUser`, `deleteUser`, `findUserByEmail`, `requirePasswordReset`, `deleteUserSessions`, plus `qaTestEmail()` / `deleteAllQaTestUsers()` for disposable test users, and `deleteLeftoverApiTestUsers()` for the API-only ones (Fleet-generated emails, so matched by the specs' `QA API <label> <stamp>` naming — `QA_TEST_API_USER_NAME_RE` — never the static `QA Static API …` users) |
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
[`console.ts`](./console.ts) for new console-error noise.

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
