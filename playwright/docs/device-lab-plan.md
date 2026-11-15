# Device lab: the plan

The plan of record for moving the suite onto the device lab, kept current as each step lands. Tick a box in
the commit that does the work, and move a step to **Done** with its PR and what proved it.

The lab's manifest is [`lab-hosts.json`](../lab-hosts.json) in this repo: every host, with role, OS, package
type and fleet, and its only copy. How the lab is built and run stays outside this repo, in Andrey's private
`fleet/qa-stuff/device-lab/` (`README.md`, `PLAYWRIGHT-HANDOFF.md`, `REVIEW-2026-11-14.md`), because it maps
the machines' network and access. The `device-lab` skill checks and repairs the lab, and opens the PR that
keeps the manifest level with it. Read the handoff and the manifest before working on a step here; this file
records what the suite decided to do about them, and where the handoff turned out wrong.

**Where it stands, 2026-11-15.** Steps A, B and C are built. A is on `main` (PR #144). B + C are one PR
(PR #145): the manifest decides what each lab host is, each worker is handed its own pool VM, and the eight
pool VMs are on the VMs fleet. Its branch run, at the usual 3 and 2 workers, is the first full run of the
suite on the lab's VMs. C's trial of a fourth premium worker follows the merge as a run of its own, and the
last two boxes under C wait on its numbers. Step D is PR #146 (`playwright/device-lab-smokes`), awaiting
its branch run.

## What the suite has to work with

The three UTM VMs per tier (macOS 26.6, Windows 11 and Ubuntu 26.04, all ARM) went offline on 2026-11-14.
The lab replaced them. Its Linux and Windows VMs are x86_64; its Macs are Apple silicon VMs.

| Tier | Hosts | Role | Where |
|---|---|---|---|
| Free | `free-ubu2404d-01`, `free-win11-01`, `free-macos26-01` | pool | Unassigned (free has no fleets) |
| Premium | `prem-ubu2404d-01` to `-04` (Ubuntu 24.04), `prem-win11-01` and `-02` (Windows 11), `prem-macos15-01` (macOS 15.7) and `prem-macos26-01` (macOS 26.6) | pool | **VMs** fleet, all eight since 2026-11-14 |
| Premium | One VM per OS flavour: Ubuntu 22.04, 26.04 and 24.04 server, Debian 13, RHEL 9 and 10, Amazon Linux 2023, Fedora 45, openSUSE Leap 16.1, Kubuntu 24.04, Zorin OS 18, Omarchy 4.5, Windows 10, Windows Server 2022 and 2025 | matrix | **OS matrix** fleet. The per-OS smokes run on them (step D). Four are LUKS-encrypted |
| Premium | `prem-ubu2404-luks` (the LUKS escrow control) | special | **OS matrix** fleet. Waits for step E |

Every lab host runs fleetd 1.63.0. [`lab-hosts.json`](../lab-hosts.json) lists them all, with the role that
says what each is for; `helpers/lab-hosts.ts` reads it. A host the manifest doesn't list yet is still kept out
of the simulation pickers by its virtualized hardware (the model `VirtualMac2,1`, or the vendor `QEMU`).

## The steps

| Step | What | PR | Status |
|---|---|---|---|
| **A** | The suite runs on the lab's VMs with the coverage it had, and no picker can take a lab machine | #144 | Done, 2026-11-14 |
| **B + C** | The manifest decides what a lab host is and what it is for; each worker gets its own pool VM; a 4th worker | #145 | Built, 2026-11-15. The 4-worker trial follows its merge |
| **D** | A smoke per OS version, on the matrix and pool hosts | #146 | Built, 2026-11-15. Awaiting its branch run (`--ref`, `-f os-smokes=true`) |
| **E** | Disk encryption on real hosts, on a fleet of its own | its own PR | Last; needs Andrey's approval first |

One PR per step, one commit per concern, based on `main`, never on another open PR. Andrey dispatches the
branch run.

## Step A: done

PR #144, merged 2026-11-14 at `7855f9c`. What it changed is in its description. In short:

- A lab machine is never a simulation: no simulation picker and neither host sweep takes one, on any fleet.
  `kind: 'real'` was a lab machine on the VMs fleet (any lab machine on free), so the lab chose the suite's
  targets by where it put them, until step B gave that to the manifest's roles. The lab's "bridge" (four VMs
  made to report `QEMU Virtual Machine`) is not needed.
- The durable 7-Zip fixture is the x64 installer, and `deploy-install-retries` builds its package for the
  architecture the VM is not.
- OS matrix was listed as a hand-kept fleet for the gitops fleet-set check, until step B declared it.

Proven by scoped local runs on both tiers (in the PR), not by a branch run.

- [ ] Review the first full run on the lab's VMs with `playwright-run-reviewer`. That is the branch run of
      B + C: Andrey decided on 2026-11-14 to merge B + C before the next nightly, so no nightly runs step A
      alone. It is the first run on the lab's VMs for everything the scoped runs left out: every test
      without a `@vm-*` tag, `gitops-mode`, the exclusive specs but one, and the gitops chain end to end.

## Steps B + C: built, awaiting the branch run

PR #145. Its description has what each commit changed and every run behind it.

### B: the manifest and roles

- [x] `lab-hosts.json` lives in the suite and is loaded once (`helpers/lab-hosts.ts`). A Fleet host matches
      an entry by display name, lower-cased: Windows reports its name in upper case, and the RHEL hosts'
      `hostname` is fully qualified. A host's fleet follows from its role (pool: VMs on premium, Unassigned on
      free; matrix and special: OS matrix); its `fleet` field records the same, and `npm run lint:lab` fails
      when the two disagree. **This is the manifest's only copy** (Andrey, 2026-11-15): the lab's owner edits
      it here in a PR.
- [x] A host is a lab machine when the manifest lists it. The hardware check stays as the guard for a host
      nobody has added yet. The four physical Macs arriving in January report a real hardware model, so only
      the manifest will know them; the role `physical` exists for them: no worker is handed one, and the
      cleanup leaves one where the lab enrolled it.
- [x] `requireRealHost`, `findOnlineHost(…, { kind: 'real' })` and `liveMacosHost` return pool hosts of the
      run's tier, never a matrix or special host. A matrix host is asked for by its `os`, a special host by
      its purpose: `requireLabHost(request, matrixHostOfRun('rhel-9'))`, which step D is the first to call.
- [x] A preflight that names any pool host that is offline, on the wrong fleet or no longer enrolled:
      `tests/api/lab-hosts.spec.ts`, one test per pool host, tagged with its platform's VM tag. It is a test
      of its own, not a dependency of the main project: a missing pool host is one red row with its reason,
      and the rest of the run goes on with the hosts that are there. A matrix or special host that is
      missing is reported on its last test (an annotation, and a line in the job log), not failed, and so is
      an online host on lab hardware that the manifest doesn't list.
- [x] The cleanup returns every manifest host to its role's fleet (`returnLabHostsToTheirFleets`, inside the
      resting-state step; approved by Andrey 2026-11-14, every role). Every lab host enrolled with the VMs
      fleet's secret, so one that re-enrolls lands on VMs. `CLAUDE.md` and the skills' stop list now say
      this step is the only thing that moves a host onto or off OS matrix.
- [x] Every real-VM test records the host and OS it ran on in the report (agreed 2026-11-14): a `vm`
      annotation, `prem-macos26-01 (macOS 26.6.2)`, from the pickers. `run_timeline.py --platforms` tallies
      minutes per VM from it.
- [x] gitops declares OS matrix: `fleets/os-matrix.yml`, empty, disk encryption and key escrow declared off
      for every platform, applied and verified in both passes like `vms.yml`. `gitops-verify`'s `_sanity`
      spec fails the file if it ever declares an entity (`EMPTY_FLEETS`), and OS matrix is out of
      `HAND_KEPT_FLEETS`. The chain is sixteen Playwright jobs, from fourteen. A PR that changes a workflow
      file is dispatched with `--ref`.
- [x] gitops gives VMs and OS matrix a host-expiry window of their own: 30 days (Andrey, 2026-11-14). A
      fleet with expiry off uses the global window, which is one day on both instances
      (`CleanupExpiredHostsBatch` in Fleet's `server/datastore/mysql/hosts.go`): a lab VM that is offline for
      more than a day was deleted, and re-enrolled on VMs under a new id. Free has no fleets, so its three
      VMs stay under the global day.

### C: one pool VM per worker

- [x] The lease: the platform's online pool members, sorted by name, and `pool[parallelIndex %
      pool.length]`. A worker keeps one VM for as long as it stays online on its fleet, and is handed
      another from the pool as it then stands when it doesn't; two workers share one only when there are
      more workers than pool members. It lives in `findOnlineHost(…, { kind: 'real' })`, one level below
      `requireRealHost`, because `liveMacosHost` asks there too: no call site changed.
- [x] Everything the cleanup does "per VM" is done per pool member: the queue cancel, the durable
      fixtures' resting state, and the `fleet-pw-*` purge on every Ubuntu member.
- [x] Specs that change something every host on the VMs fleet receives were surveyed on 2026-11-14 (all 50
      spec files that touch the fleet). None asserts a fleet-wide count. One interfered with a neighbour
      and moved: the script-timeout case of `host-run-script` is now
      `shared/exclusive/script-execution-timeout.spec.ts`. The others were checked with the pool on VMs,
      and each header now says what the other VMs receive: `recovery-lock` (every pool Mac is sent a
      password; the spec waits until none holds one before it starts and before it ends),
      `install-on-host` and `deploy-install-retries` (the Deploy policy installs on every Linux member;
      the cleanup's purge covers them all), the all-hosts profile of `configuration-profiles`, and the
      no-target and exclude declarations of `profile-declarations` and `profile-label-targets` (inert, and
      removed in the test). `update-on-host`'s pin is fleet state nothing else reads.
- [x] Specs that lean on the VMs fleet without a tag were read: `premium/hosts/host-actions-role-access`,
      `premium/policies/policy-host-counts`, `premium/dashboard/fleet-scoped-cards`,
      `premium/reports/reports`, `premium/hosts/cta-visibility`, `premium/hosts/host-delete`. None needs
      one: each reads the fleet (a host of any platform, a recorded policy pass, a chart, a chip, a row) or
      stages a simulation on it, and none needs a particular platform's VM online.
- [x] The macOS pool is two versions until January (15 and 26, later 26 and 27). The macOS tests split
      between them by worker (agreed 2026-11-14); a spec that depends on the version asks for it:
      `requireRealHost(request, 'darwin', { os: 'macos-26' })`. No spec does today. Step D's smokes are
      what covers each version every night.
- [x] **Lab handshake.** The five parked pool VMs moved from OS matrix onto VMs on the night of 2026-11-14,
      through the API, on Andrey's word that the fleets should be as they will stay. The lab's manifest and
      README say so. Both new MDM members had Claude from the fleet's policy within minutes (a refetch
      runs the policies), and the new Mac its stored report result.
- [ ] A trial at 4 premium workers, as a run of its own once B + C are merged: `gh workflow run "QA — Branch
      run" -f branch=main -f workers=4`, read with `run_timeline.py --platforms` (its per-VM lines say which
      workers each VM served, and whether one held two results at once). The PR's own branch run stays at
      3 and 2, so that an instance problem at 4 can't hold up the merge, and `-f workers` sets premium's
      count only: free has one VM per platform and a smaller instance, and always runs at 2 (Andrey,
      2026-11-15). The 4-worker run of 2026-09-30 was red for three reasons, and the lease removes two:
      three specs on one Mac, and four Linux installs on one VM. The third, blank pages under load, is the
      instance.
- [ ] Decide from the numbers, not before: premium's CI worker count (`playwright.config.ts`, 3 today), D4
      (a minute budget per VM platform), and whether the audit's per-platform lanes (roadmap 5) are still
      needed. A dead pool member now shrinks the pool instead of failing 55 tests, which was the lanes'
      main reason.

Not in C: two runs on the instance at once (a branch run during the nightly). They share one concurrency
group and queue.

### What B + C close elsewhere

- [x] `architecture-audit.md`: tier 4's item 13 (leases) and the environment gate of item 5 are marked
      built. D4 and the lanes wait on the trial, and say so.
- [x] `TODO.md`: the `workers` row under *Config workarounds* names the trial as what lifts it.
- [x] `long-term-goals.md`: the opening of *Host types* and its closing paragraph on host plumbing.
- [x] `CLAUDE.md` › *Test hosts* (rewritten around the manifest and roles), `ci-pipeline.md` (its second
      constraint, and *What bounds a run*), `vms.yml`'s header, the skills' shared real-host block, the
      comment in `tests/cli/premium/fleets.spec.ts` that named an old VM, and `helpers/profiles.ts` (a
      physical Mac has a Wi-Fi interface).

### What proved it

Scoped local runs on 2026-11-15, on 4.95.0-rc.2611140456 (`d6df44a7b25e`); the PR's description has each.

- Every `@vm-*` test and the preflight, with dependencies, at 2 workers: 65 passed and 2 skipped on premium
  (the two `update-on-host` guards), 27 passed on free. Worker slot 0 ran on `prem-ubu2404d-01`,
  `PREM-WIN11-01` and `prem-macos15-01`, slot 1 on `prem-ubu2404d-02`, `PREM-WIN11-02` and
  `prem-macos26-01`.
- Every `@vm-linux` test at 4 workers on premium: 19 passed in 5.9 minutes, each worker on an Ubuntu VM of
  its own and no VM holding two results at once (`run_timeline.py --platforms`).
- `script-execution-timeout` in both exclusive projects; `gitops-verify` for OS matrix, VMs and the fleet
  set after both files were applied to premium; the idempotence and dry-run CLI specs with fleetctl 4.94.1.
- Seen failing first: the preflight and `lint:lab` on a doctored manifest, `_sanity` on a doctored
  `os-matrix.yml`, and the OS matrix verify before the apply.
- Every simulation picker replayed on live data, 39 on premium and 21 on free: none handed out a lab
  machine.

Not proven by a run: the cleanup's return of a stray host has not yet moved a real host, since none was
astray (its decision was replayed on live data with doctored entries, and picked the right hosts and
fleets). And the full suite, which is the branch run's.

## Step D: built, awaiting its branch run

A smoke per OS version: `tests/e2e/premium/matrix/os-smokes.spec.ts`, one describe per manifest `os`, over the
fifteen matrix hosts **and** the pool's four OS versions (Ubuntu 24.04, Windows 11, macOS 15 and 26), so each
version gets the same checks every night while the main suite spreads over the pool by worker. 100 tests,
through the UI like the rest of the suite. PR #146, against `main`; its description has every run behind it.

**Where it stands, 2026-11-15.** Everything below is in PR #146 (`playwright/device-lab-smokes`), rebased
onto `main` after #145 merged. Run on premium
(4.95.0-rc, `d6df44a`), all local: the whole project with its login and teardown at 3 workers, 109 of 109
(100 smokes, the cleanup's steps with the new sweep among them); before that at 4 workers without them, 99
of 100, the one red being the tarball's title, since fixed; and RHEL 9, Windows 10 and macOS 26 again after
the self-review's fixes, 17 of 17. Seen failing first, on scratch edits since reverted: a wrong OS major, a
wrong inventory type, a matrix host Fleet doesn't know (first smoke red with the reason, six skipped),
vulnerabilities on Debian 13, Fleet Desktop on the headless server. **Not run:** the CI step and its input,
`--repeat-each` and a headed pass, `UNUSABLE_HOST = 'skip'`, and the sweep with something to sweep (it has
only met a clean fleet: its uninstall-then-delete path and its `rpm -e` purge are untried on a host).
Premium was left at rest: nothing of the smokes on OS matrix, nothing queued on a host, no host moved.

| Smoke | Hosts | How |
|---|---|---|
| Online on its fleet, with the right OS name and major version, and its fleetd and osquery versions | all 19 | The host page's vitals and Agent tooltip; the `platform` Fleet records is checked against the manifest's `fleet_platform` through the API (Kubuntu `ubuntu`, Fedora `rhel`) |
| The software inventory lists a package known to be installed, as its package type | all 19 | fleetd's own package (`fleet-osquery`; `Fleet osquery` on Windows), Safari on macOS; the Type column reads Package (deb), Package (RPM), Package (pacman), App (Windows), App (macOS) |
| Fleet Desktop is running | the 17 with a desktop | A live report of `processes`, run from the host's Actions. Not Ubuntu server or Amazon Linux (`desktop: "none"`). The agent's "Fleet Desktop: 1.63.0" says only that the binary answers `--version` |
| A script runs and returns its output | all 19 | Run script modal; the script prints the host's own name |
| Vulnerabilities are listed for the OS | Ubuntu 22.04, 24.04 (pool) and 26.04, RHEL 9 and 10 | Software › OS on the host's fleet, then the OS's Kernels card |
| A custom package installs and uninstalls | all 19 | Per-test `.deb` (7 hosts) and `.rpm` (5), built in memory under a name of their own; openSUSE's `.rpm` with `zypper` scripts; a tarball on Omarchy; `fleet-playwright-smoke-1.0.0.msi` on Windows 10 and Server, which take turns; the VMs fleet's durable `.msi` and `.pkg` on Windows 11 and macOS |
| A package installed by a policy automation | Debian 13, RHEL 9 | A policy held to the host by a manual label, failing while the package is absent |

- [x] The spec, its project (`premium-matrix`, in `PROJECT_TO_SUITE`) and its own step in the premium job,
      last, skipped in a branch run unless dispatched with `-f os-smokes=true`. Every suite on an instance
      shares one concurrency group, so a separate workflow would queue behind the nightly, not overlap it;
      lift the step into its own workflow later if it proves noisy.
- [x] Its things go on the OS matrix fleet with `pw-*` / `fleet-pw-*` names, target one host, and are deleted
      in the test; `setup/cleanup.steps.ts` sweeps what a killed run left, on the fleet and on its hosts.
      (The nightly's apply of `fleets/os-matrix.yml` also deletes whatever is on the fleet, and its verify
      fails on anything left: the gitops chain runs before the suite, so only a leftover from a dead run
      meets it, and the apply has removed that by then.) Never disk encryption, an OS-update setting or a
      passcode profile on that fleet, and never `zenity` or `kdialog` on `prem-fedora45-luks` or
      `prem-omarchy-01`: they reproduce fleetdm/fleet#58776.
- [x] An `.rpm` to install: none on disk. `helpers/rpm.ts` builds a `noarch` one per test, as `helpers/deb.ts`
      does a `.deb`, because Fleet titles an `.rpm` after its `Name` and five rpm hosts install side by side
      on one fleet. Checked in containers of each rpm host's distribution before it met a host.
- [x] Closes `long-term-goals.md`'s Fedora, RHEL and Omarchy rows. The Omarchy row's `pkg.tar.zst` was the
      fleetd agent package, not a custom package: Fleet takes none of that type.
- [ ] Its branch run, which Andrey dispatches:
      `gh workflow run "QA — Branch run" --ref playwright/device-lab-smokes -f branch=playwright/device-lab-smokes -f os-smokes=true`
      (the branch changes workflow files, and a branch run leaves the smokes out unless asked). That run
      is the first time the new CI step and its `os-smokes` input run at all.
- [ ] macOS 27, when its VM exists, gets a DDM-focused smoke.
- [ ] openSUSE's `zypper` scripts are a workaround for a Fleet gap (its default `.rpm` scripts call `dnf`): a
      bug is drafted, and the workaround's `TODO(fleetdm/fleet#N)` and its row in
      `blocked-by-product-bugs.md` wait for Andrey to file it.

## Step E: disk encryption

Discussed last (Andrey, 2026-11-14). `CLAUDE.md` forbids FileVault and anything else that gates entry to a
real host, so nothing here starts without his approval of the hosts.

What was checked on 2026-11-14: disk encryption is off on every fleet, and no key is escrowed for any host.

| Platform | Hosts | What can run unattended | Limit |
|---|---|---|---|
| Linux | `prem-ubu2404-luks` (zenity), `prem-kubuntu2404-luks` (kdialog), `prem-zorin18-luks` (zenity) | The "Action required" status, the fleet's counts and the host filter; after one manual escrow per host, Verified and the key shown to an admin | A person types the passphrase into a desktop prompt, once per host, and the lab takes a new baseline after |
| Linux | `prem-fedora45-luks`, `prem-omarchy-01` | The failure state | fleetdm/fleet#58776 (no dialog tool); Omarchy escrow needs orbit 1.64 |
| Windows | `prem-win10-01`: fully decrypted, TPM 2.0 | The whole BitLocker flow | Never `require_bitlocker_pin` on a fleet with a host. The Windows 11 VMs are fully encrypted with protection off; probe by hand what Fleet does with that first |
| macOS | none | | FileVault ends auto-login on a Tart VM, so it needs a dedicated VM and a way to unlock it at boot; both Mac slots are pool. January |

Proposed: a standing fleet declared in gitops, with disk encryption on and nothing else, holding those hosts
for good. A standing fleet rather than a throwaway one, because a person types the LUKS passphrase once and
that state has to survive runs. Compliance can't be it: it holds no hosts by design and requires the
BitLocker PIN.

## Decided

- **`playwright/lab-hosts.json` is the manifest's only copy** (Andrey, 2026-11-15; it replaces the two-copy
  arrangement of 2026-11-14, whose original sat in a folder no repository tracked). The lab's owner changes it
  in a PR when the lab changes: the `device-lab` skill scans the lab, compares it with this file and opens
  that PR. `lab:sync` is gone; `lint:lab` checks the shape and that each `fleet` matches its role. The
  preflight's last test still notes an online host on lab hardware that the manifest doesn't list.
- **The cleanup returns every lab host to its role's fleet**, the matrix and special hosts included (Andrey,
  2026-11-14).
- **The fleets are as they will stay**: the pool on VMs, everything else on OS matrix, from 2026-11-14, and
  B + C merge before the next nightly (Andrey, 2026-11-14).
- **Host expiry on VMs and OS matrix is 30 days** (Andrey, 2026-11-14).
- **The three old UTM VMs' records were deleted from the VMs fleet** (Andrey, 2026-11-15): under the fleet's
  own 30 days they would no longer have expired in a day. The fleet holds exactly the eight pool VMs. Free's
  three old records are on Unassigned and expire by themselves under the global day.
- **The PR's branch run is at 3 and 2 workers, the trial of a fourth premium worker is a run of its own after
  the merge, and free stays at 2 for good** (Andrey, 2026-11-15). `-f workers=N` on a branch run sets
  premium's count only.

## Open questions for Andrey

- A matrix host that is offline: does its smoke fail or skip? Built as one switch, `UNUSABLE_HOST` in
  `os-smokes.spec.ts`, set to **fail**: the first smoke of that OS fails with `labHostProblem`'s reason and
  the rest of that OS skip, naming it, so an offline host is one red row a night, not seven. Set to `skip`,
  the first one skips too and the night stays green. (The pool's versions follow the same rule: a version
  with no pool VM left.)
- Fleet's default scripts for an `.rpm` call `dnf`, which openSUSE lacks, so a custom `.rpm` fails to install
  there unless it comes with `zypper` scripts (seen on `prem-opensuse16-01`, 2026-11-15: `dnf: command not
  found`). A bug is drafted; file it? The smoke installs with `zypper` scripts either way.
- Two things Fleet shows that may be worth a report of their own: a Linux OS version built from
  `VERSION_ID` alone (Zorin OS 18.1 as "18.0.0", Amazon Linux 2023.12 as "2023.0.0", Debian 13.7 as
  "13.0.0"), and Software › OS listing `prem-omarchy-01` as "Arch Linux Rolling" while its host page says
  "Omarchy 4.5.0".
- Free's three VMs stay under the global one-day expiry: one that is offline for over a day is deleted and
  comes back under a new id. The suite finds a host by name, so nothing breaks, but the host's history in
  Fleet is gone. Accept it, or cull the abandoned simulations another way?
- After the trial: premium's worker count, D4 and the lanes (C's last box).

## Facts worth not rediscovering

- **The handoff says lab hosts are out of the simulation pickers' reach by name order. They were not.**
  Simulation names are random and redrawn every day; on 2026-11-14 the first seven hosts of the Linux `plain`
  pool were lab VMs. Step A closed it by hardware; the manifest closes it by name.
- **fleetdm/fleet#54607 is closed in fleetd 1.63.0**, which every lab host runs, so a failed install script
  no longer stalls a VM. Its row in `blocked-by-product-bugs.md` stands until someone retests it and lifts
  the workaround.
- **`update-on-host`'s two "updates when it is behind" tests skip on a fresh VM.** Claude is level with the
  library until the vendor ships a build; the guard lifts by itself.
- **The skip for fleetdm/fleet#50059** was reproduced by `fuse3` on the old Ubuntu VM. Check it still
  reproduces before trusting the row.
- **To read the instances without a browser:** the lab folder's `scripts/fleetapi.sh <qa-premium|qa-free>
  GET <path>` uses the fleetctl context's token and never prints it; `scripts/lab-status.sh` says whether
  every lab host is online and in its fleet.
- **Free and premium are separate instances with separate VMs**, so a scoped run on each can go at the same
  time. Two runs on one instance cannot.
- **Fleet's host search finds every manifest host by name.** `GET /hosts?query=<name>` returned exactly one
  record for each of the 27 (2026-11-14), Windows' upper-case names and the RHEL hosts' qualified hostnames
  included. `listLabHostRecords` is one such search per host.
- **What a spec puts on the VMs fleet, the other workers' VMs receive.** Seven specs do: a Deploy install
  policy (every Linux member installs the package), agent options (the script timeout), Recovery Lock (every
  Mac), a profile or declaration with no label target or an exclude-only one (every Mac or Windows VM outside
  the label), a scheduled report (every Mac runs it). `CLAUDE.md` › *Test hosts* has the rule for a new one.
- **A pool VM new to the fleet is ready within minutes.** Claude comes from the fleet's install policies at
  the host's next policy run, and a refetch triggers one; the durable report stores its first result inside
  its 5-minute interval. The cleanup asks a returned host for that refetch.
- **`fleetctl gitops` 4.94.1 applies `os-matrix.yml` to the 4.95 RC**, per-platform disk-encryption keys
  included: dry-run and apply both succeeded on 2026-11-14, with nothing proposed for deletion.
- **Zorin OS 18.1 is right, and so is Fleet's "18.0.0", after a fashion.** The host's `os-release` says
  `VERSION="18.1"` and `VERSION_ID="18"`; osquery reads major, minor and patch from `VERSION_ID`, and Fleet
  prints the three for every Linux but Ubuntu (`parseOSVersion`). The same makes Amazon Linux 2023.12
  "2023.0.0" and Debian 13.7 "13.0.0". The smokes assert the name and the major version only.
- **What installs an unsigned local `.rpm`.** `dnf install <file>` does, on RHEL 9 and 10, Amazon Linux 2023
  and Fedora 45, whose rpm 6 enforces signatures by itself (`%_pkgverify_level all`) while dnf5 skips the
  check for a file on the command line. `zypper install` refuses ("File is unsigned") without
  `--allow-unsigned-rpm`. openSUSE Leap 16.1 has no `dnf` at all.
- **Fleet titles a tarball after its whole file name**, `.tar.gz` included, and an `.msi` after the product
  inside it whatever the file is called. A `.deb` and an `.rpm` are titled after the package name.
- **Premium's firewall and install scripts, as measured on 2026-11-15** on `POST /software/package` (requests
  with no file, which can't succeed): `msiexec /i …` in `install_script` came back as the HTML "Blocked"
  page; `rm -rf`, `installer -pkg`, `dnf`, `zypper` and `rpm -e` reached Fleet. A JSON body to
  `POST /scripts/run` with `rm -rf` reached Fleet too. So an `.msi` is uploaded without scripts (Fleet fills
  in its own), and a script that has to name `msiexec` can't be sent.
- **"Fleet Desktop: 1.63.0" in the Agent tooltip is not "Fleet Desktop is running".** orbit reports what
  `fleet-desktop --version` printed when orbit started (`orbit/cmd/orbit/orbit.go`); the two headless hosts
  report "unknown". The smoke asks the host for the process instead.
- **A per-OS smoke run is about a quarter of an hour.** 100 tests in 15.6 min at 3 workers with login and
  teardown, 12.2 at 4 without them (2026-11-15, local). An install and an uninstall are 1.0 to 1.7 min a
  host when followed to their status; the Windows matrix hosts, which take turns, are the last five minutes.
- **The steps of `setup/cleanup.steps.ts` run in parallel** (`fullyParallel`), so one step can't count on
  another having run. That is why the return of lab hosts to their fleets sits inside the resting-state
  step, ahead of its walk through the pool, and not in a step of its own.
