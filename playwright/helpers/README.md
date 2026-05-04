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
| Log in a user (setup-time only) | `@helpers/auth` |
| Pick a known FMA / VPP / Android app for an API or UI search test | `@helpers/catalogs` |

If you catch yourself writing `page.getByRole(...)` in a helper, stop —
that's a page-object responsibility.

## Files

| Path | Purpose |
|------|---------|
| [`api/`](./api/) | Per-area Fleet API helpers (see below). The barrel `@helpers/api` re-exports everything. |
| [`auth.ts`](./auth.ts) | `loginAsAdmin()` — used by setup projects to write `.auth/*.json` |
| [`console.ts`](./console.ts) | `monitorConsoleErrors()`, `monitorNetworkFailures()`, plus the default ignore lists. Wired into every test via the auto `pageHealth` fixture in `fixtures.ts`. |
| [`perf.ts`](./perf.ts) | `measureNav()`, `measureSearch()` — time user-perceived loads |
| [`perf-teardown.ts`](./perf-teardown.ts) | Performance summary table + historical comparison |
| [`vuln.ts`](./vuln.ts) | Vulnerability column assertions (`expectRowHasVulnData`, `expectSingleCve`, `assertVulnTooltip`) for specs that drill into the "Vulnerabilities" column of the DataTable |
| [`catalogs/`](./catalogs/) | Typed app-store reference catalogs: `fmaApps`, `vppApps`, `vppUiSearchNames`, `androidApps`. Pick (id + platform) for API/GitOps tests; pick a name for UI search tests |

### `api/` modules

| Module | What's inside |
|--------|---------------|
| `core.ts` | `apiUrl`, `authHeaders`, `sessionAuthHeaders`, `getApiToken`, shared `HostRef` / `FleetRef` types |
| `activities.ts` | `findActivity` |
| `hosts.ts` | `findHostByPlatform`, `transferHosts`, `transferHostsByFilter` |
| `fleets.ts` | `findFleetByName`, `createFleet`, `deleteFleet`, `recreateFleet` |
| `software.ts` | `uploadSoftwarePackage`, `findSoftwareTitleByPackageName`, `deleteSoftwareTitle*`, `getSoftwareTitle`, `findVulnerableSoftwareBySource`, `SoftwareTitleRef` / `SoftwarePackageRef` |
| `fma.ts` | `findFmaIdBySlug`, `addFmaToFleet` |
| `app-store.ts` | `addAppStoreApp`, `AppStorePlatform` |
| `mdm.ts` | `getBootstrapMetadata`, `deleteBootstrapPackage` |

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

### API calls — use `authHeaders()` (or `sessionAuthHeaders()`)

```ts
import { apiUrl, authHeaders, findActivity } from '@helpers/api';

const res = await request.get(apiUrl('config'), { headers: authHeaders() });

const activity = await findActivity(request, 'created_pack', (d) => d.pack_name === name);
```

Never inline `{ Authorization: \`Bearer ${process.env.FLEET_API_TOKEN}\` }` — one place to update when auth semantics change.

`sessionAuthHeaders()` is the storage-state-cookie variant — use it for
endpoints that the API-only `FLEET_API_TOKEN` user can't reach (currently
software/package, packs, and admin queries/policies — tracked upstream as
fleetdm/fleet#38044).

### Page health monitoring — automatic via the fixture

The `pageHealth` fixture in `fixtures.ts` is `auto: true`, so every test
imported from `@fixtures` already has console-error and 4xx/5xx network
monitoring running. Adjust the global ignore lists in
[`console.ts`](./console.ts) when Fleet introduces a new "expected" 4xx
empty-state probe.

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

test('Software page', { tag: '@loadtest' }, async ({ page }, testInfo) => {
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
import { apiUrl, sessionAuthHeaders } from '@helpers/api';

// API: pick the first macOS VPP entry and add it to the fleet
const vpp = vppApps.find((a) => a.platform === 'darwin')!;
await request.post(apiUrl('software/app_store_apps'), {
  headers: sessionAuthHeaders(),
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
