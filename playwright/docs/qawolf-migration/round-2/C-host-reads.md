# Batch C — Live host, read-only

**8 source flows → 8 specs.** `Host detail reads`

**✅ Shipped 2026-09-28** — [PR #61](https://github.com/AndreyKizimenko/qa-automation-poc/pull/61). Three retargets (certificates landed `shared/`, both reports-recency rows were host-details flows) and the vitals-refetch row moved to batch D. See [DELIVERY-LOG § Round 2 · Batch C](../DELIVERY-LOG.md).

Read [README.md](README.md) first for the standing rules and how a batch runs. Source flows live in
`qa-wolf/Fleet_20260828 (1)/{Free,Premium}/src/tests/<path>` — the paths below are relative to that.

---

The first batch that needs the host pool, and all of it reads: host-details cards, inventory filters, report
results, OS drill-downs, affected-host counts. Nothing is installed or executed.

Seven of the eight targets are augments onto specs round 1 already built, so this batch is far smaller than
its source count suggests — mostly new cases in existing files.

### Hosts for this batch

Use the **real VMs**, not the simulations. Resolve them at run time —
`findOnlineHost(request, platform, { kind: 'real' })`, the `vmsFleetId` worker fixture for the premium VMs
fleet, `liveMacosHost` for a macOS one — never by stored name or id. Simulations answer every live query with one
canned row whatever the SQL, pass every policy and fake their script and install results, so a green assertion
against one proves nothing about the feature.

> **⚠️ Never deploy a passcode profile to a real host.** It blocks access permanently, there is no recovery,
> and there are only a few VMs per tier. No `com.apple.mobiledevice.passwordpolicy`, `forcePIN`, `minLength`,
> `maxInactivity` or `allowSimple` — nor screen lock, inactivity timeout, FileVault, login-window restrictions,
> or anything disabling SSH / remote management / the MDM channel. Uploading is delivering: on free, even an
> upload → delete lifecycle reaches the VMs. Only the inert `fleet-pw-inert.*` fixtures may be uploaded. See
> [README §5](README.md#5-test-hosts--use-the-real-vms-and-never-lock-yourself-out).

## Host detail reads

*8 source flows → 8 specs.*

Host-details cards, inventory filters, report results, OS drill-downs, affected-host counts.

**Resolve hosts by API, never by name.** Every source here hardcodes `macos15-prem` or
`qawolf-premium-ubuntu-2204`. Our load fleet regenerates names and ids on every daemon restart — use
`findOnlineHost(request, platform, { kind })`, with `kind: 'real'` when the assertion depends on genuine
device data (software inventory, certificates, agent versions) and `'simulated'` only for volume.

**POM work:** new `CertificatesCard` component on `HostDetailsPage`; `HostDetailsPage` — software-tab
top-level-application filter (`selectSoftwareView`), inventory item count, reports-tab sort value and per-card
result state, report-card first-result grid; `SoftwareOsPage` — row values, Hosts sort, OS drill-in;
`SoftwareOsDetailPage` — heading, host and vulnerability counts, column headers; `CveDetailPage` — affected-host
count, vulnerable-software row values, "View all hosts" hand-off; `VulnerabilitiesListPage` — `cveNames()`;
`FilterModal` — premium severity dropdown and its options; `HostsListPage` — results count.

| Target spec | Kind | Source flows folded in |
|---|---|---|
| ~~`tests/e2e/shared/hosts/host-details-smoke.spec.ts`~~ | **not shipped** | `automatic-host-vitals-refetch/installs-and-uninstalls-automatically-triggers-host-vitals-refetch-fleet-maintained` — see *Retargets* |
| `tests/e2e/shared/hosts/host-certificates.spec.ts` | **new** | `certificates/host-details-and-my-device-page-greater-certificates-add-more-columns` |
| `tests/e2e/shared/hosts/host-software.spec.ts` | augment | `hosts-details/host-details-software-filter-by-top-level-applications-installed-applications-appear-in-applications-filtered` |
| `tests/e2e/shared/hosts/host-reports-tab.spec.ts` | augment | `reports/reports-filter-by-newer-results`<br>`reports/reports-filter-by-newer-results [FREE]` |
| `tests/e2e/premium/hosts/host-report-details.spec.ts` | augment | `reports/reports-reports-show-first-result` |
| `tests/e2e/premium/software/vulnerabilities.spec.ts` | augment | `software-vulnerabilities/view-affected-hosts-on-vulnerability`<br>`uncategorized/vulnerability-severity-filter-lists-options-from-critical-down` (moved from [A](A-no-setup.md)) |
| `tests/e2e/free/software/vulnerabilities.spec.ts` | augment | free half of `view-affected-hosts-on-vulnerability` |
| `tests/e2e/premium/software/os.spec.ts` | augment | `software/view-software-os-tab-premium` |
| `tests/e2e/free/software/os.spec.ts` | **new** | free half of `view-software-os-tab-premium` |

### Retargets and one hand-off

Four rows moved once the existing specs and the live instance were read. Each is a change of *file*, never of
behaviour — the coverage is all shipped except where noted.

- **`host-certificates` is `shared/`, not `premium/`.** `HostDetailsPage.tsx` gates the card on
  `(isAppleDeviceHost || isWindowsHost) && certificates.length` — platform and data, no tier. Both tiers' real
  macOS VMs carry the same four system-keychain certificates, so free gets the coverage for free.
- **`reports-filter-by-newer-results` is a host-details flow, not a reports-list one.** Both source flows
  navigate Hosts → a host → the **Reports tab** and sort its cards; neither touches `/reports/manage`. It
  landed in `shared/hosts/host-reports-tab.spec.ts`, which already owns that tab's search and name sorts — and
  being shared, one test covers both the premium and the free row. `premium/reports/list-filters.spec.ts` and
  `free/reports/reports.spec.ts` were left alone.
- **`view-software-os-tab-premium` and `view-affected-hosts-on-vulnerability` gained free siblings.** Neither
  behaviour is premium-gated. Free's OS-vulnerability table does drop three columns
  (`SoftwareVulnerabilitiesTableConfig` filters `cvss_score`, `epss_probability` and `cve_published`
  off-premium), so the free spec asserts that absence rather than pretending the tables match.
- **The vitals-refetch flow is a hand-off to [D](D-host-execution.md), not a batch-C augment.** Its read-only
  half — refetch, then the header reports fresh vitals — is already covered by
  `shared/hosts/host-details-smoke.spec.ts`'s first test, which additionally proves the refresh through
  `detail_updated_at` rather than trusting the relative-time string. What is *not* covered is the source's
  actual subject: that an **install or uninstall** triggers the refetch automatically. That needs a real
  install, which batch C explicitly excludes ("nothing is installed or executed"), so it belongs with
  `premium/software/inventory-reflects-install.spec.ts` in batch D. Nothing was written here.

### Not covered, and why

- **The "N additional results not shown" banner** on a host report card (`reports-reports-show-first-result`).
  It renders only when `n_host_results > 1`, and the instance's one long-lived report
  (`pw-host-report-results` on the VMs fleet) returns a single row. Seeding a multi-row report in-test means
  waiting out a scheduled interval — measured at ~3.5 minutes — on every run, and mutating the existing
  fixture would break its own spec for one interval. The behaviour the flow is named for, *the card previews
  the stored result's first row*, **is** covered: the card's inline grid is compared cell-for-cell against the
  first row of the full report.
- **A free counterpart for `host-report-details`.** Free has no fleet to park a durable report on, and
  `cleanup-setup` wipes every global report at run start, so no report on free can ever hold a stored result
  when a test looks.
- **A free counterpart for the severity filter.** `SoftwareFiltersModal` renders the whole severity block
  behind `isPremiumTier`, so there is nothing to assert off-premium beyond its absence, which
  `tests/e2e/free/paywalls.spec.ts` territory already owns.

---

## Done when

- every target spec above exists and is green on each tier it targets;
- `npm run check` is clean;
- each spec ran at least once headed and at least once **with** dependencies (no `--no-deps`);
- anything timing-sensitive survived `--repeat-each=5`;
- a line per shipped slice is appended to [DELIVERY-LOG.md](../DELIVERY-LOG.md);
- anything parked has a row in [`../blocked-by-product-bugs.md`](../../blocked-by-product-bugs.md)
  or a reasoned note in this file — never a silent skip.
