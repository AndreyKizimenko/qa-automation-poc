# Batch B — Self-contained mutation

**13 source flows → 8 specs.** `Library CRUD` · `Global config`

**✅ Shipped 2026-09-28** — [PR #61](https://github.com/AndreyKizimenko/qa-automation-poc/pull/61). One source row dropped as a DUP; picked up the historical-data-collection row from batch A once it turned out to be a config write. See [DELIVERY-LOG § Round 2 · Batch B](../DELIVERY-LOG.md).

Read [README.md](README.md) first for the standing rules and how a batch runs. Source flows live in
`qa-wolf/Fleet_20260828 (1)/{Free,Premium}/src/tests/<path>` — the paths below are relative to that.

---

The first batches that write. Everything here creates something and removes it inside the same test body —
no host involvement, no long waits. This is where the parallel-isolation rules start to matter.

**Scope every assertion to your own record.** QA Wolf routinely asserts on "the first row" or a bare count.
Under `fullyParallel`, with a sibling worker adding software, that is a flake waiting to happen. Search by a
unique marker first.

## Library CRUD

*10 source flows → 6 specs.*

Create something, assert it, remove it, all inside one test body.

**Versions and pinning is the one genuinely new product area here** — three flows (pin to latest / major /
older version) collapse into one spec with a pin-target dimension.

The Android catalog flow is mapped as an augment on `library.spec.ts`, which already runs
`{ kind: 'android', applicationId: 'com.openai.chatgpt' }`. Check it before building: it may be a pure DUP.

**POM work:** `SoftwareTitleDetailPage` — custom-icon upload/replace/remove, display-name rename, Versions
modal entry. New `VersionsModal` component object for pinning.

| Target spec | Kind | Source flows folded in |
|---|---|---|
| `tests/e2e/premium/software/custom-icons.spec.ts` | **new** | `custom-icons/add-edit-and-delete-custom-icons`<br>`custom-icons/only-valid-icons-can-be-uploaded-size-dimensions-are-respected` (moved here from A, so icons have one owner) |
| `tests/e2e/premium/software/script-only-package.spec.ts` | **new** | `packages/add-custom-package-that-only-contains-a-script`<br>`scripts/Add a .sh script as a software package` |
| `tests/e2e/premium/software/version-pinning.spec.ts` | **new** | `software/Versions and Pinning/pin-fleet-maintained-app-software-versions-to-an-older-version`<br>`software/Versions and Pinning/pin-fleet-maintained-app-software-versions-to-latest`<br>`software/Versions and Pinning/pin-fleet-maintained-app-software-versions-to-major-version` |
| `tests/e2e/premium/software/package-scripts.spec.ts` | **new** | `software/download-scripts-on-software`<br>`software/view-installed-script-advanced-options` |
| `tests/e2e/premium/software/display-name.spec.ts` | **new** | `software/set-custom-display-names-for-software` |
| `tests/e2e/premium/software/library.spec.ts` | augment · **DUP confirmed** | `vpp/add-android-software-from-add-app-page` |

## Global config

*2 source flows → 1 specs.*

One spec, but it earns its own slot because of *how* it has to be written. The custom logo lives in
`org_info`, which every other settings spec reads.

**Snapshot and restore inside the test, never in a hook.** Round 1 lost a debugging cycle to exactly this: a
read-only sibling's `afterEach` restore rolled a mutating test back mid-flight. `helpers/api/config.ts` has
the helper; restore only what you changed, because `/config` rejects whole snapshotted subtrees with a 400
(they carry read-only members).

QA Wolf ran light and dark as two flows. One spec, theme as a dimension — round 1 already built the theme
helper in `shared/account/theme.spec.ts`.

**POM work:** `OrganizationInfoPage` — logo upload / preview / remove.

| Target spec | Kind | Source flows folded in |
|---|---|---|
| `tests/e2e/shared/settings/organization/custom-logo.spec.ts` | **new** | `general/upload-edit-delete-custom-logo-from-fleet-organization-dark-mode`<br>`general/upload-edit-delete-custom-logo-from-fleet-organization-light-mode` |
| `tests/e2e/premium/dashboard/historical-data-collection.spec.ts` | **new** · moved from [A](A-no-setup.md) | `general/disable-hosts-online-and-vulnerabilities-chart-fleets-only` |

The dashboard row arrived mid-batch: its subject is a fleet config write with a dashboard read-back, which is
this batch's shape rather than A's read-only one. A's `premium/dashboard/fleet-scoped-cards.spec.ts` keeps the
read-only half and the two point at different fleets on purpose — see the note below.

---

## What actually shipped

- **The custom logo went `shared/`, not `premium/`.** `OrgSettingsPage/cards/Info` has no tier gate: the two
  logo cards, the Replace / Remove buttons and the nav swap are identical on free, and the spec is green on
  both tiers. QA Wolf only ever ran it on premium, so this is net-new free coverage.
- **The Android flow was a DUP**, as the batch file suspected. `library.spec` already runs
  `{ kind: 'android', applicationId: 'com.openai.chatgpt' }` through add → delete → activity feed. The only
  assertion the source made that we lacked was the summary card's Type line ("Application (Android)"), so it
  became a short augment inside the existing `add` sub-test rather than a spec.
- **"Pin to an older version" collapsed into "pin to an exact version".** The three source flows relied on
  the instance having cached two AdGuard builds from earlier runs; a freshly-added app caches exactly one and
  Fleet only caches a second when upstream ships an update. An exact pin sends the version string verbatim
  whichever build it names, so `version-pinning.spec.ts` resolves the options from the app's own
  `fleet_maintained_versions` and pins the newest. The spec header says this at length so nobody "restores"
  the older-version case by hard-coding a version that will rot.
- **Running the script-only package on a host was left to batch D.** The source flow ends by running the
  package on a VM and reading the activity feed; that is a real execution round-trip and belongs with the
  other host-execution specs. What is unique to the script-only *shape* — the sh graphic and "macOS & Linux"
  subtext on the uploader, the Type line, and the install script Fleet derives from the file instead of
  generating — is covered here.
- **Two fixtures were generated so their titles can't collide.** Fleet names a `.deb` title after its
  `Package:` field and a script package after its filename, and a premium title can hold several packages —
  so two specs uploading a same-named fixture to one fleet leave the Library accordion ambiguous. See
  `test-data/linux/software/README.md` and `test-data/shared/images/README.md`.

- **Disabling historical reporting deletes the data already collected**, and Fleet says so in the
  confirmation: "Previously collected data will be deleted. This cannot be undone." So
  `historical-data-collection.spec.ts` **creates its own throwaway fleet and deletes it in a `finally`** — a
  sanctioned exception to `playwright/CLAUDE.md`'s "do not create or delete teams from test bodies", which
  exists to protect the gitops-provisioned Workstations. A fleet made seconds earlier is the only subject with
  no history to lose; a standing fleet always has some. The spec never touches the deployment-wide switches —
  those would wipe every fleet's history on a shared instance, including the 30 days `fleet-scoped-cards.spec`
  plots from the VMs fleet — and it requires global collection to be on, skipping otherwise, which is also the
  only state where the per-fleet checkboxes are editable.
- **`/charts/cve` takes ~11 s on the QA instances**, longer than the suite's 10 s assertion timeout, so every
  chart assertion in that spec waits on the `/charts/<metric>?…fleet_id=` response first — the same idiom
  `fleet-scoped-cards.spec` uses. Asserting on cells without it fails as an empty chart under any load.

Nothing is parked; no rows were added to `blocked-by-product-bugs.md`.

## Done when

- every target spec above exists and is green on each tier it targets;
- `npm run check` is clean;
- each spec ran at least once headed and at least once **with** dependencies (no `--no-deps`);
- anything timing-sensitive survived `--repeat-each=5`;
- a line per shipped slice is appended to [DELIVERY-LOG.md](../DELIVERY-LOG.md);
- anything parked has a row in [`../blocked-by-product-bugs.md`](../../blocked-by-product-bugs.md)
  or a reasoned note in this file — never a silent skip.
