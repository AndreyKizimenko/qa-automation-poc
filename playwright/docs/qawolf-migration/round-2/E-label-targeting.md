# Batch E — Label targeting

**21 source flows → 10 specs.** `Label targeting`

> ## ▶ Start here — handoff, 2026-09-29
>
> A–D and gitops-mode V1 are all on `main` (#61, #62, #63). **Branch from `main`.**
>
> **Invoke the `playwright-test-author` skill first** (Skill tool) and follow it. Then read, in order:
> [README.md §9](README.md#9-working-a-batch-since-d) — **how batches run since D: which skills, how much to
> run, which docs move with the code** — then README §5 (never lock a VM), `playwright/CLAUDE.md` (**Test
> hosts**, the cleanup pipeline, the exclusive projects),
> [D-host-execution.md → What landed](D-host-execution.md#what-landed-and-what-changed-from-the-plan), then this
> file.
>
> **The three rules this handoff adds most to:** run only the specs you changed until the end (§9); keep the
> batch file, DELIVERY-LOG and the test-audit entries current in the same commits; run
> `playwright-test-reviewer` on your own work before the PR, and the full suite once, on CI, at the end.
>
> Facts below were checked against the live instances on 2026-09-28/29.

---

### 1. Write the inert profile fixtures before anything else

> **Done, 2026-09-29 — and it was worse than this section said.** The "library upload/download/delete only"
> exemption below was wrong on free: free has no fleets, so the lifecycle spec's uploads went to the free VMs.
> The free Windows VM had received the DeviceLock profile 32 times, the free macOS VM the passcode profile 7
> times. See [What landed](#what-landed). The table is kept as the record of what the two fixtures were.

README §5 makes this the batch's blocker, and it is bigger than it says. **Two** committed fixtures lock a
real VM, not one:

| fixture | what it does | safe where |
|---|---|---|
| `test-data/apple/macos/profiles/fleet-test-passcode.mobileconfig` | passcode policy (`forcePIN`, `minLength`, `maxInactivity`, `allowSimple`) | ~~library upload/download/delete only~~ nowhere on free |
| `test-data/windows/profiles/fleet-test-screenlock.xml` | Windows **DeviceLock**: password enforcement, 15-min inactivity lock, PIN length | ~~library upload/download/delete only~~ nowhere on free |

Neither may ever be delivered to a VM. Write an inert pair — one `.mobileconfig`, one Windows `.xml` — whose
only job is to be observable: a custom preference domain on macOS; on Windows, a CSP that changes nothing about
access. **If you are unsure a payload is safe, ask Andrey before delivering it.** Put the reasoning in a README
next to the fixtures, the way `test-data/linux/software/README.md` does.

**Verify delivery on the device, like D verified scripts.** D proved a script's effect with a report the VM ran
itself; the same works here. osquery's `managed_policies` table (macOS) lists every delivered preference — and
`registry` / `mdm_bridge` exist on the Windows VM. But **filter by your own domain**: an unfiltered
`managed_policies` read returns fleetd's own config, *including the enroll secret*, which would then sit in
stored report results and failure screenshots.

**Check what removal does, per platform, before relying on it.** Deleting a profile from a fleet makes Fleet
remove it from macOS hosts; confirm what it does on Windows before a test counts on "deleted, so gone from the
VM". Whatever the answer, a profile a test delivers must be removed in that test *and* by the cleanup (§2).

### 2. Labels — only manual ones are assertable

- **Dynamic labels are unusable as targets.** The osquery-perf pool answers every label query, so the
  gitops-provisioned "Apple Silicon macOS hosts" holds 172 hosts and "Debian-based Linux hosts" 563. The
  built-in platform labels are the same (see the audit README).
- **Manual labels** with explicit members give a host set you control. Resolve membership through the API
  (`getLabelId` / `listLabelHostIds` in `helpers/api/labels.ts`, from D) and assert **set membership** — the
  profile is on exactly these hosts and none outside — never a count.
- **There is one real VM per platform.** "A host of the same platform outside the label" has to be a
  simulation. That's sound for what Fleet decides server-side — which hosts a profile is *listed* for, which are
  *offered* software — and meaningless for what the host does (delivered, verified, installed): that needs the
  VM. Put the real VM inside the label and a simulation outside it (README §9 → *Server-side vs host-side*).
- **Nothing cleans up labels, profiles or declarations yet.** Name yours with a `pw-` prefix and extend
  `setup/cleanup.steps.ts`: the VMs sweep (*sweep host-execution leftovers from the VMs fleet*) for what Fleet
  stores by name, and the resting-state step (*bring the real VMs to their resting state*) for anything left on
  a VM. A timed-out test never reaches its `finally`.
- **Custom targets are premium-only.** The profile modals only load labels when `isPremiumTier`. Free still
  delivers profiles to all hosts — ask per flow whether there is a free half.

### 3. Hosts and where profiles go

- The real VMs: macOS and Windows are MDM-enrolled ("On (manual)"); **Ubuntu has no MDM**, so it can't take a
  profile. All three are ARM. On premium they are on the **VMs** fleet, under gitops
  (`gitops/premium-fleetqa/fleets/vms.yml`) and **re-applied before every nightly** — a profile you add there
  is yours to remove, and the nightly deletes anything undeclared.
- **macOS takes an MDM command in seconds** (D's `UserList` acknowledged within one poll). A profile's status
  still goes through *verifying → verified*, which needs the host's next detail collection — use
  `waitForHostRefetch` rather than polling copy. Windows delivery rides SyncML check-ins; measure it before
  budgeting.

### 4. Never touch OS updates on the VMs fleet

The `macos-updates` and `ddm-conflict` flows need OS-update settings and DDM software-update declarations.
**Setting a minimum macOS version or deadline, a Windows update deadline, or a software-update enforcement
declaration on the VMs fleet makes the real VMs download and install an OS update** — reboots mid-suite, and
possibly a version the suite doesn't expect. The DDM flows are about Fleet *refusing* the combination; run them
on a fleet with no real hosts (Workstations), and restore whatever you set in the same test.

### 5. Software targeting changes a title, so it can't use D's durable fixtures

`software-label-targets` is D's install path plus a **label scope on the installer** — which changes the title
for everyone. The durable fixtures in `helpers/vm-fixtures.ts` must never carry one (the lifecycle spec and the
resting-state step assume them plain). So:

- Linux: a per-run `fleet-pw-label-*` `.deb` from `helpers/deb.ts` — the sweep already covers `^fleet-pw-`.
- macOS / Windows: a committed inert `.pkg` / `.msi` of its own (a new role for `make-pkg.sh` / `make-msi.sh`),
  so it doesn't share a Library row with D's. Their output names start `fleet-playwright-`, which the sweep
  deliberately **doesn't** match (those are durable) — either name the new file `fleet-pw-…` or add its exact
  name to the sweep's `OWN_PACKAGE`.
- Reuse `uploadSoftwarePackageBuffer`, `installSoftwareOnHost`, `waitForSoftwareSettled`, and leave the VM with
  it uninstalled. A host outside the label must not be **offered** the title at all — assert that on its
  Library (a simulation, per §2), not only on the VM inside.

### Traps this batch will hit

- **Runtime.** Premium is ~43 min in CI after D, and the VM-bound specs stay in the main suite. The job limit is
  120 min and Playwright stops the run at 100 in CI, report included. This batch adds more VM time: price it,
  and report the end-of-batch CI runtime. If it passes ~80 min, raise it rather than trimming coverage.
- **Don't run the full suite while you build** — README §9. Your specs, both tiers, with deps once;
  `--workers=2` on VM specs; the full suite once, at the end, via `QA — Branch run`.
- **Nothing else may be using the VMs** when you run a VM spec: `gh run list --limit 5` first, and stay clear of
  the nightly — `QA — Nightly`, scheduled for 03:00 UTC but started hours late by GitHub, about 1.5 h long.
- **`fleetctl` must stay within a minor of the server.** Several of these flows shell out to it. The released
  4.92.1 against the 4.93 RC is fine; what silently broke gitops `software:` was the 4.85 client CI used to fall
  back to. If a flow needs output only the RC's client prints, build one from `~/repositories/fleet`
  (`go build -o <scratchpad>/fleetctl ./cmd/fleetctl`) and point `FLEETCTL_BIN` at it. `generate-gitops` on
  Free fails with any current client (#53965).
- **A missing locator's `click()` has no action timeout** — it waits out the whole test, and the `finally` then
  runs on a closed request context, so its cleanup silently doesn't happen. Probe a locator before relying on
  it; rely on the cleanup for anything left on the VMs fleet.
- **Global switches go in `exclusive/`.** If a flow has to flip something global (a label every profile depends
  on, an org-wide MDM setting), put it under `tests/e2e/<tier>/exclusive/` — the single-worker project that runs
  after the main one.
- **Never assert a count on a shared list**, and never an absolute host count behind a label.

### Done when

The batch's own **Done when** below, plus:

- the inert fixtures are committed with their safety reasoning written down;
- every profile, declaration and label a test creates is removed in the same test *and* covered by the cleanup;
- every targeting assertion is set membership;
- `playwright-test-reviewer` has been run on the batch's specs and page objects, and its findings fixed or
  answered;
- the docs in README §9's table are current — this file's *What landed*, DELIVERY-LOG, and a test-audit entry
  for every new test (the audit README's counts too);
- the full suite ran once via `QA — Branch run` on the branch, and anything red is triaged
  (`playwright-run-reviewer`) and fixed, skipped behind a filed bug, or explained in the PR.

> **Status (2026-09-29):** in review as [PR #65](https://github.com/AndreyKizimenko/qa-automation-poc/pull/65) —
> everything above except the last item. Andrey dispatches the branch run himself,
> clear of the nightly — which GitHub has been starting 4–6.5 h after its 05:00 UTC schedule since 2026-08-27,
> and which this PR also turns into one chain (`QA — Nightly`), ordered by dependency rather than by clock.

---

## What landed

| target | status | notes |
|---|---|---|
| inert profile fixtures | ✅ | `test-data/{apple/macos,windows}/profiles/fleet-pw-inert.*` + READMEs; both lifecycle specs moved onto them; the two lock fixtures deleted |
| `premium/controls/os-settings/profile-delivery-retry.spec.ts` | ✅ | install → Activity names the InstallProfile → **Resend** on the Controls tab (a second InstallProfile, verified again) → delete → the RemoveProfile; and a Wi-Fi profile with no SSID the Mac refuses: four InstallProfile commands, all Error — the first and Fleet's 3 retries — then **Failed** on the Controls tab and in the Activity card |
| `premium/controls/os-settings/profile-declarations.spec.ts` | ✅ | three declarations of Apple's no-op test type — no target, include all, exclude — over the VM + two borrowed simulations; *verified* is the device's DDM report. QA Wolf's second flow (the refused delete) is `profile-broken-labels`'s declaration case |
| `premium/controls/os-settings/profile-broken-labels.spec.ts` | ✅ **retargeted** | the refused delete — manual and dynamic labels, targeted by a `.mobileconfig`, a declaration or a Windows `.xml`; the label and target survive it, and the delete goes through once the profile is gone. Workstations, so nothing is delivered |
| `premium/controls/os-settings/profile-label-targets.spec.ts` | ✅ | macOS: three profiles (include all · include any + exclude · exclude) over the VM + two borrowed simulations; Windows: include all + exclude, then an Edit that excludes the VM and takes the profile back off it. Set membership server-side, the setting read back on the device |
| `premium/controls/os-settings/configuration-profiles.spec.ts` | ✅ augment | fixture swap, and a delivery case: an untargeted (All hosts) profile on the VMs fleet, verified and read back on the Mac, deleted through the UI and gone from the device |
| `premium/exclusive/os-updates/macos-updates.spec.ts` | ✅ **moved to `exclusive/`** | Custom version + deadline save, read back and clear; the form's refusals, asserted where Fleet puts them (the label); "View all hosts" lists exactly the hosts on that version; the preview's link and image instead of QA Wolf's screenshot. Workstations only |
| `premium/exclusive/os-updates/ddm-conflict.spec.ts` | ✅ **moved to `exclusive/`** | both directions, macOS and Windows: an update profile refused while OS updates are set, and OS updates refused while one exists. Workstations only, checked host-free before each test |
| `premium/software/software-label-targets.spec.ts` | ✅ | a per-run `.deb` through all three scopes over the Ubuntu VM + two Linux simulations, offered to exactly its labels' hosts; installed by the VM inside the scope; the refused label delete's software twin |
| `premium/policies/policy-label-targets.spec.ts` | ✅ | three policies — include all, include any + exclude any, exclude all (policies only) — each on exactly its hosts; the VM's Policies tab |
| `premium/reports/report-label-targets.spec.ts` | ✅ | include all and include any, each listed for exactly its hosts; the VM stores the include-all report's row and the simulations outside it don't |
| `free/controls/os-settings/profile-delivery.spec.ts` | ✅ **new** | the free half: delivery, the Activity's commands, Resend and removal on the free Mac, and a declaration verified and removed — free has no targets, but all of that is free |

### The free VMs had been receiving both lock profiles (found 2026-09-29)

§1 said the passcode and DeviceLock fixtures were safe in the library lifecycle. **On free they weren't.** Free
has no fleets, so `free/controls/os-settings/configuration-profiles.spec.ts` uploaded them to Unassigned, where
the free macOS and Windows VMs are, and whenever Fleet's 30-second profile reconciler ticked between the upload
and the delete step it sent them. The VMs' MDM command history:

| free VM | received | most recent |
|---|---|---|
| Windows | `fleet-test-screenlock.xml` (password required, 15-min inactivity lock, 10-char minimum) — **32 times, 23 days** | 2026-09-28 03:41 UTC, the nightly |
| macOS | `Fleet Test Passcode`, acknowledged 7 times | 2026-08-30 |

Fleet removed each about 90 s later — the delete step — and that is the only reason neither VM locked. Read on
the devices afterwards (filtered to the lock keys only): no `passwordpolicy` on the Mac; the DeviceLock values
back at Windows' defaults. Premium was never exposed: its Unassigned and Workstations fleets hold no real host,
and the premium VMs' histories show no delivery.

What was done: the free spec was skipped on `main` the same night
([PR #64](https://github.com/AndreyKizimenko/qa-automation-poc/pull/64)); this batch's first slice moved both
lifecycle specs onto the inert pair and deleted the two lock fixtures, re-signing the inert profile for the
signed-upload rejection test. `CLAUDE.md`, both authoring skills and the fixture READMEs now say it the way it
is: **uploading a profile is delivering it.**

### Decisions taken (2026-09-29)

- **The inert pair** — macOS: a custom preference domain nothing reads (`com.fleetdm.qa.playwright.inert`);
  Windows: `ApplicationManagement/AllowGameDVR = 0`. Approved by Andrey for delivery to the real VMs.
- **The "outside the label" host is a simulation moved onto the VMs fleet** for the test (from a distinct
  slice, as the transfer specs do) and moved back, with a cleanup sweep for any left there. One profile then
  shows both halves: delivered on the VM inside the label, not listed on the simulation outside it.
- **Two more payloads approved for the VMs** (same day): Apple's no-op test declaration,
  `com.apple.configuration.management.test` (only an `Echo` string), for `profile-declarations`; and, for the
  retry case, a profile macOS refuses at install — an unknown **`com.apple.`** PayloadType, as in
  `~/Desktop/test-data/organized/apple/macos/profiles/invalid/device-rejects/macos-unknown-payload-type.mobileconfig`.
  An unknown type *outside* `com.apple.` is not refused: macOS installs it as a custom preference domain,
  which is exactly what the inert profile relies on. **On macOS 26.6 the `com.apple.` one isn't refused
  either** — the VM acknowledged it and Fleet verified it. Andrey then approved a **Wi-Fi payload with no
  `SSID_STR`** (`device-rejects/macos-wifi-missing-ssid.mobileconfig`, built with `AutoJoin` off): macOS refuses
  it — *"ConfigProfilePluginDomain (-307): Some required information in the profile is missing."* — and the Mac
  VM (`VirtualMac2,1`) has no Wi-Fi interface for it to touch, only ethernet (read on the device). The VPN
  candidate was passed over: a VPN payload, if ever accepted, is one that can reroute the MDM channel.
- **A failed control puts a count on the host's Controls tab** — "Controls 1" — and its panel takes the same
  name, so both are matched as `/^Controls( \d+)?$/`. The exact name hung the first run of the retry case.
- **`profile-broken-labels` covers the refused delete.** Since Fleet 4.87 (`DeleteLabel` in
  `server/datastore/mysql/labels.go`) a label that a profile or declaration targets can't be deleted — 422,
  *"Couldn't delete. A configuration profile targets this label. Please delete the profile and try again."* —
  and 4.91 removed the "broken" modal the three QA Wolf flows asserted. The broken state is no longer reachable
  through the product, so the spec asserts the refusal across `.mobileconfig`, declaration and Windows `.xml`,
  and that the label and the profile's targeting both survive it.

### Built for every targeting spec

- **`TargetLabelSelector`** (`pages/components/`) — the plan's `ProfileTargetsForm`, named after Fleet's
  component. It serves the tabbed widget (profiles, declarations, policies); the dropdown variant's methods
  come with the software and report specs, once probed. Two traps it absorbs: the radios are hidden inputs
  (it clicks the `<label>` wrapping the radio), and a tab's accessible name — and its panel's — gains
  " check" once the tab holds a label.
- `ConfigurationProfilesPage` — targets on upload, the **Edit profile** modal (hover-revealed, like download
  and delete), "N labels", the broken-label warning; `HostDetailsPage` — the **Controls** tab and its rows.
- `helpers/profiles.ts` — inert profiles generated per run; `helpers/api/profiles.ts` — the fleet, host and
  device views of a profile; `createManualLabel` / `setManualLabelHosts` / `deleteLabelById`;
  `findMdmSimulations` — the borrowable simulations, past the transfer specs' slice of the pool.
- The VMs sweep in `setup/cleanup.steps.ts` deletes `pw-*` profiles, returns borrowed simulations and deletes
  `pw-*` labels — proven against a run that timed out with all three left behind.
- **The Labels page pages now.** About 19 visible labels sort ahead of `pw-` and the list pages at 20, so a
  spec with two or three labels has one on page 2. `LabelsPage.locateRow` pages with `Pagination`, which used
  to compare the first row's *link* — Labels rows have none, and reading a missing link has no timeout, so the
  lookup hung until the test's 15 minutes ran out. `Pagination` falls back to the whole row on a link-less
  table, and `runRowAction` reopens the Actions menu until the option shows (it can close under a re-render).
  Both were behind `software-label-targets`' two timeouts in a 5× repeat.

### Fixed on the way: an un-pin that never un-pinned (found 2026-09-29)

The 09-29 premium nightly failed D's `update-on-host` Claude walk. `setPinnedVersion(…, '')` — the walk's own
un-pin, its `finally`, `version-pinning`'s restore and the cleanup step that clears stranded pins — had never
changed anything: Playwright 1.61 leaves an empty-string field out of a `multipart` request (a `FormData` one
too), and Fleet reads a missing `version` as "no change", answering 200. The walk only reaches that path once
Fleet has cached two Claude builds, which first happened that morning. The helper now writes the multipart
body by hand and reads the pin back; the two pins the run stranded (VMs and QA) were cleared by hand. Verified:
`version-pinning` 2/2, and the Claude group with every un-pin in the activity feed.

### Two OS updates specs run in `exclusive/`

`macos-updates` and `ddm-conflict` both set and clear Workstations' OS update settings. Side by side under
`fullyParallel`, one test's `finally` would clear what another relies on, so they live under
`tests/e2e/premium/exclusive/os-updates/` and run in the single-worker `premium-exclusive` project after the
main one. They can't run "with dependencies" on their own — the exclusive project's dependency is the whole
premium project — so the branch run is their with-dependencies run. The Workstations wipe in
`setup/cleanup.steps.ts` now also clears OS updates.

### The simulation pool

Only profiles need MDM-enrolled simulations, and there are few: 8 macOS ones past the transfer specs' part of
the pool. So `findMdmSimulations` serves the profile specs, `findSimulations` (the hosts *not* enrolled) serves
software, policies, reports and label membership — disjoint pools — and each spec claims a slice (registry in
`helpers/api/hosts.ts`). The ordering spans every fleet, so a borrowed host keeps its place and nobody else's
slice moves.

### What the source flows turned out to be

- **Two targeting widgets, not one.** Profiles, declarations and policies use Fleet's tabbed
  `TargetLabelSelector` (All hosts / Custom → Include with Any/All, Exclude); software and reports use
  `DropdownTargetLabelSelector` (Include any / Include all / Exclude any). They share the root class and the
  All hosts / Custom radios.
- **Profiles have an Edit modal** since 4.91, with the target editable — the lifecycle specs' headers said
  otherwise.
- **None of QA Wolf's payload files are in the export.** Two of the ones they uploaded were likely unsafe:
  `macos-softwareupdate.json` (by name, an OS-update enforcement) and `Windows_Password.xml` (a DeviceLock).
- Fleet retries a failed Apple or Windows profile **3 times** (`MaxAppleProfileRetries` /
  `MaxWindowsProfileRetries` in `server/mdm/mdm.go`) before reporting Failed.
- The macOS updates flow never picks "Custom version", which the minimum-version fields now require; it
  passed on QA Wolf's instance only because its own leftover setting kept the team in custom mode.

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
> or anything disabling SSH / remote management / the MDM channel. Uploading is delivering: on free, even an
> upload → delete lifecycle reaches the VMs. Only the inert `fleet-pw-inert.*` fixtures may be uploaded. See
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
