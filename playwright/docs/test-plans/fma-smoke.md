# FMA smoke — design, plan, risks

The FMA smoke exists to catch, every night, a Fleet-maintained app that Fleet can no longer add, describe,
install, see in inventory, patch-check or uninstall. Each failure is labeled with the owner it belongs to. The
facts it builds on are in [`fma-smoke-analysis.md`](./fma-smoke-analysis.md).

This branch (`fma-smoke/catalog`) carries the **catalog layer**. The host layer, which installs on the real VMs,
lands in `fma-smoke/host` and fills in the sections marked *host layer* below.

**Assumptions**

- The smoke is premium-only, because free can't add software.
- The suite stays on Playwright 1.61.
- Fleet's API shapes are those of `fleetdm/fleet` `main` at `b27eebfbe6`.

---

## 1. App selection

The manifest is [`helpers/catalogs/fma-smoke.ts`](../../helpers/catalogs/fma-smoke.ts). Each entry has `slug`,
`platform`, `tier`, `installer` kind, `expectedBundleId` (macOS) or `expectedUpgradeCode` (Windows MSI), the
`programs` name and publisher for the Windows live query, `host` and `approxMb`.

**P0, nightly.** Picked to be small, inert (never launched), with no reboot and no license prompt, and to cover
four installer formats:

| Slug | Format | Size | Why |
|---|---|---|---|
| `rectangle/darwin` | .dmg | 4.5 MB | the dmg-mount path of Fleet's install script |
| `maccy/darwin` | .zip | 4.5 MB | the unzip path |
| `putty/windows` | .msi | 3.7 MB | per-machine MSI with an upgrade code; its catalog `unique_identifier` carries a stale version, which exercises Fleet's Windows title linking |
| `notepad++/windows` | .exe (NSIS) | 6.6 MB | the .exe path |

**P1, on demand** (`FMA_SMOKE_TIER=p1`): `stats/darwin` (dmg) and `keepassxc/windows` (msi, 34 MB).

**Rules the manifest obeys.** `tests/fma-smoke/offline.spec.ts` enforces them by reading the gitops YAML, never
a hard-coded list:

- A `host: true` app is a durable fixture declared in `gitops/premium-fleetqa/fleets/vms.yml`. There are none on
  this branch.
- Every other app is declared on **no** standing fleet, in either the baseline or the min config. The catalog
  layer adds and deletes it, so it must not collide with a title a fleet keeps.
- Nothing in the manifest is on the denylist: `7-zip/windows` (it merges with the VMs fleet's custom 7-Zip
  .exe), installers over a few hundred MB, and kernel or system extensions.

The guard was checked with a deliberate failure: swapping `maccy/darwin` for `claude/darwin` fails it, naming
both `qa.yml` and `vms.yml`.

---

## 2. Catalog layer

[`catalog.spec.ts`](../../tests/fma-smoke/catalog.spec.ts) is pure API (`@playwright/test`, no browser). There is
one `test()` per app, with a `test.step` per phase:

```
catalog entry → add (download + SHA check) → stored metadata vs catalog → patch policy created and linked →
remove (policy first, then title) → catalog says not added
```

- **Its own fleet.** Each worker creates `pw-fma-<runNonce>` and deletes it in `afterAll`. `cleanup-setup`'s
  `pw-*` sweep removes one that a killed run left. gitops never deletes an undeclared fleet, because no
  workflow passes `delete-other-fleets`.
- **The patch query's text is not asserted.** Fleet copies it from the app's manifest
  (`pkg/patch_policy/patch_policy.go:109-141`), so its wording is the manifest's to change. The step checks
  that a `patch` policy is created, is linked to the title, and has a non-empty query.
- **No assertion on Fleet's error text.** A refused add is classified by status and by Fleet's own error
  wraps. That classification feeds the report but never decides pass or fail. A duplicate add is
  identified by its **409 status** alone: `alreadyExists`, `server/datastore/mysql/software_installers.go:363-369`,
  mapped to 409 at `server/platform/endpointer/transport_error.go:160`.

### Whole-catalog pass

This runs only with `FMA_SMOKE_FULL_CATALOG=1`. Nothing is added to a fleet, so no installer is downloaded to
the instance.

1. **Metadata, through Fleet.** `GET /fleet_maintained_apps/{id}` for every entry. It hydrates from the
   manifest without a download (Fleet `ee/server/service/maintained_apps.go:299-318`). It asserts a version, an
   https URL and both scripts.
2. **Installer URLs, from the runner only.** [`helpers/installer-urls.ts`](../../helpers/installer-urls.ts)
   sends nothing to the instance.
   - Each URL gets a `GET` with `Range: bytes=0-0`, not HEAD, which some vendors refuse, and a desktop
     browser user agent.
   - Each request has a 20 s timeout, at most 8 run in flight, and a network error gets one retry.
   - Redirects are counted by hand.
   - The body is cancelled as soon as the headers arrive, so a server that ignores `Range` and answers 200
     costs nothing.
   - The probe records final status, redirect count and the total size from `Content-Range` (or
     `Content-Length` on a 200).
   - Outcomes:
     - 206 or 200 → ok;
     - 4xx after redirects → **upstream**;
     - a network error after the retry → **infra**;
     - anything else → unclassified (`TODO` in code: settle vendor 5xx after the first runs).
3. **Manifest SHA-256, from the runner.** It reads `https://maintained-apps.fleetdm.com/manifests/<slug>.json`,
   which is Fleet's own manifest source (`server/mdm/maintainedapps/sync.go:32`, path at `:208`). The SHA-256 is
   hidden from the API (`json:"-"`, `server/fleet/maintained_apps.go:17`). Entries whose manifest says
   `no_check` are **listed, not failed**: Fleet stores those bytes unverified.
4. **Sizes.** Any p0/p1 entry whose served size is more than 2× away from `approxMb` is listed as a manifest
   finding, not a failure.

The pass fails on entries Fleet can't hydrate and on URLs the vendor refuses (`expect.soft`, so all of them
show). Everything goes to the `catalog-broken.txt` attachment, and the reporter adds a counts section.

Checked locally against live URLs:

| Entry | Result |
|---|---|
| Rectangle | 206, 4.5 MB, one redirect |
| PuTTY | 206, 3.7 MB |
| A bogus GitHub release URL | 404, `upstream` |
| `google-chrome/darwin` manifest | `no_check` |
| WinSCP | 403 to a browser-UA GET |

WinSCP's 403 is likely bot protection rather than a dead link: expect it as a known `upstream` false positive
until it's denylisted or the rule learns about it.

---

## 3. Host layer

*Host layer: lands in `fma-smoke/host`.*

---

## 4. Helpers

**Reused:** `findFmaIdBySlug`, `createFleet`, `deleteFleet`, `createFleetPolicy`, `deleteFleetPolicies`,
`deleteSoftwareTitle`, `runNonce`, `loadFleetConfig`.

**Added:**

| Helper | File | Why |
|---|---|---|
| `listAllFleetMaintainedApps` | `helpers/api/fma.ts` | nothing returned catalog entries; pages on `meta.has_next_results` |
| `getFleetMaintainedApp` | `helpers/api/fma.ts` | manifest metadata, no download |
| `tryAddFmaToFleet` | `helpers/api/fma.ts` | the add's outcome as data, so a refusal can be classified |
| `getFleetMaintainedTitleMetadata` | `helpers/api/fma.ts` | platform, FMA link, bundle id and upgrade code, which `getSoftwarePackage` lacks |
| `waitForSoftwareActionTerminal`, `getHostLastInstall`, `getSoftwareInstallResult` | `helpers/api/software.ts` | for the host layer: a fast-failing wait, then one read of the install's output once it's terminal |
| `classifyAddFailure`, `classifyScriptFailure`, `recordFmaSmokeResult`, `buildFmaSmokeSummary` | `helpers/fma-smoke.ts` | owner attribution and the run summary |
| `probeInstallerUrl`, `fetchManifestSha256`, `mapWithConcurrency` | `helpers/installer-urls.ts` | runner-side URL and manifest checks |

---

## 5. Timeouts, retries and polling

There are no fixed sleeps.

| What | Budget | Why |
|---|---|---|
| Catalog entry | 60 s request | manifest hydration is a server-side fetch |
| Add | 300 s request, 240 s test | a synchronous download; p0 apps are under 7 MB, but vendor CDNs vary; Fleet's cap is 15 min (`server/mdm/maintainedapps/installers.go:19`) |
| Whole-catalog test | 60 min | about 1,400 metadata reads plus as many URL probes, 8 at a time |
| `fma-smoke-catalog` retries | 1 | a vendor CDN blip shows as **flaky**, not red; a hash mismatch fails both attempts the same way |

**Flaky visibility.** The reporter keeps every attempt. A test that passed on retry N gets `⚠️ passed on retry N`
in the **Flaky** column, and its failed attempts stay in **Detail** as `attempt 1: <phase> (<owner>) <detail>`.

---

## 6. Isolation

The catalog layer runs on its own `pw-fma-*` fleet, which has no hosts and is invisible to gitops. Other
specs' FMA claims can't collide with a fleet nobody else uses, and the manifest guard keeps the catalog-only
apps off every standing fleet.

---

## 7. CI wiring

- **`playwright.config.ts`.** Adds the `fma-smoke-catalog` project (`testMatch: (catalog|offline).spec.ts`, 2
  workers, `retries: 1`, depends only on `premium-setup`, no teardown). It's registered in `PROJECT_TO_SUITE`,
  and `**/fma-smoke/**` is added to the `testIgnore` of both `premium` and `free`.
- **`playwright-premium.yml`.** Adds a catalog step inside the suite job, after gitops-mode
  (`--global-timeout=900000`), whose blob is merged into the one report. The job's 185-minute limit stays: the
  worst case is 190 and a real run takes about 70.
- **`fma-smoke.yml`** (new, `workflow_dispatch`, inputs `tier` and `full-catalog`). It joins
  `premium-fleetqa-instance`, because its downloads land on the same 2 GB box.
- **`package.json`** gets `test:fma-smoke:catalog`, and **`.env.premium.example`** documents `FMA_SMOKE_TIER`
  and `FMA_SMOKE_FULL_CATALOG`.

---

## 8. Reporting

[`helpers/fma-smoke-reporter.ts`](../../helpers/fma-smoke-reporter.ts) writes `buildFmaSmokeSummary` to
`$GITHUB_STEP_SUMMARY` and to `<outputDir>/fma-smoke-summary.md`.

- The summary opens with a fixed note: *"Windows results come from an ARM64 VM running x64 installers under
  emulation."*
- Columns: Result, Layer, App, Version, Failed phase, Owner, Patch check, Flaky, Detail, Install s.
- Failures sort first, and among them `unclassified` → `fleet` → `upstream` → `infra`.
- The whole-catalog pass adds a counts section: reachable, upstream, infra, unclassified, `no_check`, size
  findings.

**Owner rules:**

| Signal | Owner |
|---|---|
| Add refused with `mismatch in maintained app SHA256 hash` | upstream |
| `downloading app installer` + 4xx | upstream |
| `downloading app installer` + timeout or reset | infra |
| 502/503/504, or the request times out | infra |
| 409 (already on the fleet) | unclassified |
| Other 4xx/5xx; stored metadata ≠ catalog | fleet |
| Installer URL 4xx after redirects | upstream |
| Installer URL network error after retry | infra |

The unit checks in `offline.spec.ts` cover the summary (flaky marker, sort order, URL section) and both
classifiers. They need no instance.

---

## Implementation plan (catalog branch)

| # | Item | Effort |
|---|---|---|
| 1 | First instance run of `fma-smoke-catalog` p0, with deps and then `--repeat-each=3` (`TODO: first instance run`; there was no `.env.premium` here) | 0.25 d |
| 2 | One whole-catalog run; triage `catalog-broken.txt`; grow P1 and the denylist; settle vendor 5xx and the WinSCP-style 403 | 1 d |
| 3 | `docs/test-audit/` entry for the catalog layer | 0.25 d |

## Open questions (catalog)

1. Is a dedicated instance available for a real whole-catalog *add*? On the shared 2 GB box, only the
   metadata and URL pass is safe.
2. Should a vendor 5xx count as upstream or infra?
