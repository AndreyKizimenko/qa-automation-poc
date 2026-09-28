# Batch E — Label targeting

**21 source flows → 10 specs.** `Label targeting`

> ## ▶ Start here — handoff, 2026-09-28
>
> Batches A–C and gitops-mode V1 are merged (#61, #62). **Batch D is in PR #63** — if it hasn't merged when you
> start, branch from `playwright/qawolf-round2-batch-d`, not `main`: this batch reuses D's helpers, fixtures,
> cleanup sweep and the VMs-fleet gitops file.
>
> **Invoke the `playwright-test-author` skill first** (Skill tool) and follow it. Then read, in order:
> [README.md](README.md) (standing rules; §5 is about exactly this batch), `playwright/CLAUDE.md` (**Test
> hosts**, the exclusive projects), [D-host-execution.md → What landed](D-host-execution.md#what-landed-and-what-changed-from-the-plan)
> for what D built, then this file.
>
> Every fact below was checked against the live instances on 2026-09-28.

---

### 1. Write the inert profile fixtures before anything else

README §5 makes this the batch's blocker, and it is bigger than it says. **Two** committed fixtures lock a
real VM, not one:

| fixture | what it does | safe where |
|---|---|---|
| `test-data/apple/macos/profiles/fleet-test-passcode.mobileconfig` | passcode policy (`forcePIN`, `minLength`, `maxInactivity`, `allowSimple`) | library upload/download/delete only |
| `test-data/windows/profiles/fleet-test-screenlock.xml` | Windows **DeviceLock**: password enforcement, 15-min inactivity lock, PIN length | library upload/download/delete only |

Neither may ever be delivered to a VM. Write an inert pair — one `.mobileconfig`, one Windows `.xml` — whose
only job is to be observable: a custom preference domain on macOS; on Windows, a CSP that changes nothing about
access. **If you are unsure a payload is safe, ask Andrey before delivering it.** Put the reasoning in a README
next to the fixtures, the way `test-data/linux/software/README.md` does.

**Verify delivery on the device, like D verified scripts.** D proved a script's effect with a report the VM ran
itself; the same works here. osquery's `managed_policies` table (macOS) lists every delivered preference — and
`registry` / `mdm_bridge` exist on the Windows VM. But **filter by your own domain**: an unfiltered
`managed_policies` read returns fleetd's own config, *including the enroll secret*, which would then sit in
stored report results and failure screenshots.

### 2. Labels — only manual ones are assertable

- **Dynamic labels are unusable as targets.** The osquery-perf pool answers every label query, so the
  gitops-provisioned "Apple Silicon macOS hosts" holds 172 hosts and "Debian-based Linux hosts" 563. The
  built-in platform labels are the same (see the audit README).
- **Manual labels** with the real VMs as explicit members give a host set you control. Resolve membership
  through the API and assert **set membership** — the profile is on exactly these hosts and none outside —
  never a count.
- **Nothing cleans up labels.** `cleanup.steps.ts` doesn't touch them. Name yours with a prefix and extend D's
  VMs sweep (`sweep host-execution leftovers from the VMs fleet`) to cover labels, profiles and declarations by
  that prefix — a timed-out test never reaches its `finally`.
- **Custom targets are premium-only.** The profile modals only load labels when `isPremiumTier`. Free still
  delivers profiles to all hosts — ask per flow whether there is a free half.

### 3. Hosts and where profiles go

- The real VMs: macOS and Windows are MDM-enrolled ("On (manual)"); **Ubuntu has no MDM**, so it can't take a
  profile. All three are ARM. On premium they are on the **VMs** fleet, which is under gitops since D
  (`gitops/premium-fleetqa/fleets/vms.yml`) — a profile you add there is yours to remove, and a re-apply of that
  file deletes anything undeclared.
- **macOS takes an MDM command in seconds** (D's `UserList` acknowledged within one poll). A profile's status
  still goes through *verifying → verified*, which needs the host's next detail collection — use
  `waitForHostRefetch` from D rather than polling copy. Windows delivery rides SyncML check-ins; measure it
  before budgeting.

### 4. Never touch OS updates on the VMs fleet

The `macos-updates` and `ddm-conflict` flows need OS-update settings and DDM software-update declarations.
**Setting a minimum macOS version or deadline, a Windows update deadline, or a software-update enforcement
declaration on the VMs fleet makes the real VMs download and install an OS update** — reboots mid-suite, and
possibly a version the suite doesn't expect. The DDM flows are about Fleet *refusing* the combination; run them
on a fleet with no real hosts (Workstations), and restore whatever you set in the same test.

### 5. Software targeting reuses D

`software-label-targets` is D's install path plus a label scope. Reuse `uploadSoftwarePackageBuffer`,
`installSoftwareOnHost`, `waitForSoftwareSettled`, `helpers/deb.ts`, and add a third role to
`make-pkg.sh` / `make-msi.sh` rather than sharing D's packages — a premium title holds several packages, so two
specs on one title share a Library row. A host outside the label must not be offered the title at all; assert
that on its Library, not only on the one inside.

### Traps this batch will hit

- **Runtime.** The premium nightly is ~40 min of a 60-min job limit after D, and Andrey chose to keep the
  VM-bound specs in the main suite for now. This batch adds more. Measure `WORKERS=2 npm run test:premium` at
  the end and report it; if it passes ~50 min, raise it rather than trimming coverage.
- **`fleetctl` must match the server's minor version.** Several of these flows shell out to it. The npm/released
  client is 4.92.1 against a 4.93 RC server; build one from `~/repositories/fleet`
  (`go build -o <scratchpad>/fleetctl ./cmd/fleetctl`) and point `FLEETCTL_BIN` at it.
- **A missing locator's `click()` has no action timeout** — it waits out the whole test, and the `finally` then
  runs on a closed request context, so its cleanup silently doesn't happen. Probe a locator before relying on
  it; rely on the cleanup sweep for anything left on the VMs fleet.
- **Global switches go in `exclusive/`.** If a flow has to flip something global (a label that every profile
  depends on, an org-wide MDM setting), put it under `tests/e2e/<tier>/exclusive/` — the single-worker
  project that runs after the main one.
- **Never assert a count on a shared list**, and never an absolute host count behind a label.
- **The nightly runs at 05:00 (gitops) and 05:30 UTC (Playwright).** Don't let a long verification run overlap.

### Done when

The batch's own **Done when** below, plus: the inert fixtures are committed with their safety reasoning written
down; every profile a test delivers is removed in the same test *and* covered by the cleanup sweep; and every
targeting assertion is set membership.

---

Read [README.md](README.md) first for the standing rules and how a batch runs. Source flows live in
`qa-wolf/Fleet_20260828 (1)/{Free,Premium}/src/tests/<path>` — the paths below are relative to that.

---

The largest batch and the one with the most new page-object work: include-all / include-any / exclude label
targeting for configuration profiles, declarations, software and policies, plus the broken-label and
DDM-conflict edge cases.

**This is where their coverage is most worth preserving and least worth copying.** The flows are long,
hardcode host and label names, shell out to `fleetctl`, and assert with
`expect(currVerifiedHostsCount).toBeGreaterThanOrEqual(2)` — which passes whether targeting worked or not. The
behaviour they describe is valuable; the assertion is worthless.

### Hosts for this batch

Use the **real VMs**, not the simulations. Resolve them at run time —
`findOnlineHost(request, platform, { kind: 'real' })`, the `vmsFleetId` worker fixture for the premium VMs
fleet, `liveMacosHost` for a macOS one — never by stored name or id. Simulations ignore live-query SQL, return
no rows ~20% of runs and never install anything, so a green assertion against one proves nothing about the
feature.

> **⚠️ Never deploy a passcode profile to a real host.** It blocks access permanently, there is no recovery,
> and there are only a few VMs per tier. No `com.apple.mobiledevice.passwordpolicy`, `forcePIN`, `minLength`,
> `maxInactivity` or `allowSimple` — nor screen lock, inactivity timeout, FileVault, login-window restrictions,
> or anything disabling SSH / remote management / the MDM channel. `fleet-test-passcode.mobileconfig` is one of
> these: safe in the library lifecycle where round 1 uses it, never safe to deliver. See
> [README §5](README.md#5-test-hosts--use-the-real-vms-and-never-lock-yourself-out).

## Label targeting

*21 source flows → 10 specs.*

Include-all / include-any / exclude targeting across profiles, declarations, software and policies.

**Re-author the assertion.** For label targeting the meaningful check is that the profile applies to exactly
the hosts in the label set and to none outside it. Resolve both sets through the API and assert set
membership, not a count floor.

**Build the targets form once.** Include-all / include-any / exclude appears on profiles, declarations,
software and policies as the same component. One `ProfileTargetsForm` component object serves all four — the
highest-leverage new object in round 2.

**POM work:** new `ProfileTargetsForm`; `ConfigurationProfilesPage` — custom-targets tab and declarations;
`OsUpdatesPage` — DDM conflict errors; label-scoped variants on `SoftwareTitleDetailPage` and
`PolicyEditPage`. Grow `helpers/api/labels.ts` to resolve the exact host set a label matches.

| Target spec | Kind | Source flows folded in |
|---|---|---|
| `tests/e2e/premium/controls/os-settings/profile-delivery-retry.spec.ts` | **new** | `activity-feed/host-activity-show-configuration-profile-name-and-status`<br>`configuration-profiles/macos-configurations-profiles-retry-3-times`<br>`configuration-profiles/resend-configuration-profile` |
| `tests/e2e/premium/controls/os-settings/profile-declarations.spec.ts` | **new** | `configuration-profiles/configuration-profile-declarations-including-excluding-labels-macos`<br>`configuration-profiles/configuration-profiles-declarations-broken-state-declarations-are-not-applied-macos` |
| `tests/e2e/premium/controls/os-settings/profile-broken-labels.spec.ts` | **new** | `configuration-profiles/configuration-profiles-broken-deleted-label-profiles-are-not-applied-to-hosts-macos`<br>`configuration-profiles/configuration-profiles-broken-deleted-label-profiles-are-not-applied-to-hosts-windows`<br>`controls/controls-macos-custom-settings-verify-warning-symbol-upon-deleting-custom-label-from-hosts` |
| `tests/e2e/premium/controls/os-settings/profile-label-targets.spec.ts` | **new** | `configuration-profiles/configuration-profiles-custom-targets-with-include-all-and-exclude`<br>`configuration-profiles/configuration-profiles-custom-targets-with-include-any-and-exclude`<br>`configuration-profiles/configuration-profiles-include-any-label-on-custom-targets-macos`<br>`configuration-profiles/configuration-profiles-include-exclude-labels-macos-hosts`<br>`configuration-profiles/configuration-profiles-include-exclude-labels-windows-hosts` |
| `tests/e2e/premium/controls/os-settings/configuration-profiles.spec.ts` | augment | `controls/controls-macos-custom-settings-upload-and-remove-configuration-profile` |
| `tests/e2e/premium/controls/os-updates/macos-updates.spec.ts` | **new** | `controls/controls-macos-updates-ui-validation` |
| `tests/e2e/premium/controls/os-updates/ddm-conflict.spec.ts` | **new** | `custom-software-updates-ddm/cannot-deploy-custom-software-update-enforcement-declaration-ddm-when-manage-os-settings-are-set-macos`<br>`custom-software-updates-ddm/cannot-deploy-custom-software-update-enforcement-declaration-ddm-when-manage-os-settings-are-set-windows` |
| `tests/e2e/premium/software/software-label-targets.spec.ts` | **new** | `hosts/labels-include-all-install-software-on-hosts-that-include-all-labels-and-hosts-that-do-not-include-all-labels-do-not-install-software`<br>`hosts/labels-include-any-add-software-to-hosts-that-include-any-labels-and-hosts-that-do-not-include-any-labels-cannot-install-software` |
| `tests/e2e/premium/policies/policy-label-targets.spec.ts` | **new** | `policies/policies-include-all` |
| `tests/e2e/premium/reports/report-label-targets.spec.ts` | **new** | `policies/report-include-all` |

---

## Done when

- every target spec above exists and is green on each tier it targets;
- `npm run check` is clean;
- each spec ran at least once headed and at least once **with** dependencies (no `--no-deps`);
- anything timing-sensitive survived `--repeat-each=5`;
- a line per shipped slice is appended to [DELIVERY-LOG.md](../DELIVERY-LOG.md);
- anything parked has a row in [`../blocked-by-product-bugs.md`](../../blocked-by-product-bugs.md)
  or a reasoned note in this file — never a silent skip.
