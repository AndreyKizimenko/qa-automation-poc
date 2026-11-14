# Device lab: the plan

The plan of record for moving the suite onto the device lab, kept current as each step lands. Tick a box in
the commit that does the work, and move a step to **Done** with its PR and what proved it.

The lab itself is documented outside this repo, in Andrey's `fleet/qa-stuff/device-lab/`: `README.md` (how it
is built), `PLAYWRIGHT-HANDOFF.md` (what the lab asks of the suite), `lab-hosts.json` (every host, with role,
OS, package type and fleet) and `REVIEW-2026-11-14.md`. The `device-lab` skill checks and repairs it. Read the
handoff and the manifest before working on a step here; this file records what the suite decided to do about
them, and where the handoff turned out wrong.

**Where it stands, 2026-11-14.** Step A is on `main` (PR #144), merged without a branch run: the nightly of
2026-11-15 is its first full run, and it needs a review. Steps B and C are next, as one PR.

## What the suite has to work with

The three UTM VMs per tier (macOS 26.6, Windows 11 and Ubuntu 26.04, all ARM) went offline on 2026-11-14.
The lab replaced them. Its Linux and Windows VMs are x86_64; its Macs are Apple silicon VMs.

| Tier | Hosts | Where |
|---|---|---|
| Free | `free-ubu2404d-01`, `free-win11-01`, `free-macos26-01` | Unassigned (free has no fleets). All three are the suite's targets |
| Premium, **VMs** fleet | `prem-ubu2404d-01` (Ubuntu 24.04), `prem-win11-01` (Windows 11), `prem-macos15-01` (macOS 15.7) | The suite's targets today: one per platform |
| Premium, **OS matrix** fleet | Five more pool VMs, parked: `prem-ubu2404d-02`, `-03`, `-04`, `prem-win11-02`, `prem-macos26-01` | Wait for step C |
| Premium, **OS matrix** fleet | One VM per OS flavour: Ubuntu 22.04, 26.04 and 24.04 server, Debian 13, RHEL 9 and 10, Amazon Linux 2023, Fedora 45, openSUSE Leap 16.1, Kubuntu 24.04, Zorin OS 18, Omarchy 4.5, Windows 10, Windows Server 2022 and 2025; and `prem-ubu2404-luks` | Wait for steps D and E. Five are LUKS-encrypted |

Every lab host runs fleetd 1.63.0. A lab machine reports virtualized hardware (the model `VirtualMac2,1`, or
the vendor `QEMU`), and since step A that is how the suite tells one from a simulation.

## The steps

| Step | What | PR | Status |
|---|---|---|---|
| **A** | The suite runs on the lab's VMs with the coverage it had, and no picker can take a lab machine | #144 | Done, 2026-11-14 |
| **B + C** | The manifest decides what a lab host is and what it is for; each worker gets its own pool VM; a 4th worker | one PR | **Next** |
| **D** | A smoke per OS version, on the matrix and pool hosts | its own PR | After B + C |
| **E** | Disk encryption on real hosts, on a fleet of its own | its own PR | Last; needs Andrey's approval first |

One PR per step, one commit per concern, based on `main`, never on another open PR. Andrey dispatches the
branch run.

## Step A: done

PR #144, merged 2026-11-14 at `7855f9c`. What it changed is in its description. In short:

- A lab machine is never a simulation: no simulation picker and neither host sweep takes one, on any fleet.
  `kind: 'real'` is a lab machine on the VMs fleet (any lab machine on free), so the lab chooses the suite's
  targets by where it puts them. The lab's "bridge" (four VMs made to report `QEMU Virtual Machine`) is no
  longer needed.
- The durable 7-Zip fixture is the x64 installer, and `deploy-install-retries` builds its package for the
  architecture the VM is not.
- OS matrix is listed as a hand-kept fleet for the gitops fleet-set check.

Proven by scoped local runs on both tiers (in the PR), not by a branch run.

- [ ] Review the nightly of 2026-11-15 with `playwright-run-reviewer`. It is the first run of the whole
      suite on the lab's VMs, and the first on macOS 15 and Ubuntu 24.04 for everything the scoped runs left
      out: `host-delete`, `bulk-transfer`, `host-transfer-permissions`, `gitops-mode` and the gitops chain.

## Steps B + C: next

### B: the manifest and roles

- [ ] `lab-hosts.json` lives in the suite and is loaded once. A Fleet host matches an entry by display name,
      lower-cased: Windows reports its name in upper case, and the RHEL hosts' `hostname` is fully
      qualified. Its `fleet`, `parked` and `legacy_real` fields describe the lab's bridge, not a rule: derive
      a host's fleet from its role (pool: VMs on premium, Unassigned on free; matrix and special: OS matrix).
- [ ] A host is a lab machine when the manifest lists it. The hardware check stays as the guard for a host
      nobody has added yet. The four physical Macs arriving in January report a real hardware model, so only
      the manifest will know them; they get a role of their own (`physical`) and no destructive spec.
- [ ] `requireRealHost`, `findOnlineHost(…, { kind: 'real' })` and `liveMacosHost` return pool hosts of the
      run's tier, never a matrix or special host. A matrix host is asked for by its `os`, a special host by
      its purpose (both are needed from step D on).
- [ ] A preflight that names any pool host that is offline or on the wrong fleet. It is a test of its own,
      not a dependency of the main project: a missing pool host is one red row with its reason, and the rest
      of the run goes on with the hosts that are there. A matrix host that is missing is reported, not failed.
- [ ] The cleanup returns every manifest host to its role's fleet. Every lab host enrolled with the VMs
      fleet's secret, so one that re-enrolls lands on VMs. This has the suite move real hosts between fleets:
      `CLAUDE.md` and the skills' stop list say no host is moved onto or off OS matrix, and they change in
      the same commit.
- [ ] Every real-VM test records the host and OS it ran on in the report (agreed 2026-11-14).
- [ ] gitops declares OS matrix: `fleets/os-matrix.yml`, empty, disk encryption off, applied in both passes
      like `vms.yml`. It touches `gitops-premium.yml`, `gitops-premium-min.yml`, the verify jobs in
      `nightly-qa-gitops-premium.yml`, `tests/cli/nightly/gitops-idempotence.spec.ts`,
      `tests/cli/premium/gitops-dry-run.spec.ts`, the `test:gitops-verify:*` scripts and the READMEs, and
      takes OS matrix out of `HAND_KEPT_FLEETS`. A PR that changes a workflow file is dispatched with `--ref`.
- [ ] gitops gives VMs and OS matrix a host-expiry window of their own. A fleet with expiry off uses the
      global window, which is one day on both instances (`CleanupExpiredHostsBatch` in Fleet's
      `server/datastore/mysql/hosts.go`): a lab VM that is offline for more than a day is deleted, and
      re-enrolls on VMs under a new id. The window is Andrey's to choose.

### C: one pool VM per worker

- [ ] The lease: the platform's online pool members, sorted by name, and `pool[parallelIndex %
      pool.length]`. A worker keeps one VM for the run; two workers share one only when there are more
      workers than pool members. `requireRealHost` already reads `test.info()`, so the lease can live inside
      it and no call site changes.
- [ ] Everything the cleanup does "per VM" is done per pool member: the queue cancel, the durable
      fixtures' resting state, and the `fleet-pw-*` purge on every Ubuntu member.
- [ ] Specs that change something every host on the VMs fleet receives were surveyed on 2026-11-14. None
      asserts a fleet-wide count. One interferes with a neighbour and has to move to `exclusive/` or to a
      throwaway fleet: `shared/hosts/host-run-script.spec.ts` lowers the fleet's script timeout to 60 s
      (the global one on free) while another worker's script may be running on another VM. Check each of
      the others once the pool is on VMs: `recovery-lock` (enforces for the whole fleet), `update-on-host`'s
      pin walk, the Deploy install policies of `install-on-host` and `deploy-install-retries` (they install
      on every Linux member), the all-hosts profile of `configuration-profiles` and `profile-declarations`.
- [ ] Specs that lean on the VMs fleet without a tag: `premium/hosts/host-actions-role-access`,
      `premium/policies/policy-host-counts` (it counts on "the Mac VM keeps Claude installed"),
      `premium/dashboard/fleet-scoped-cards`, `premium/reports/reports`, `premium/hosts/cta-visibility`,
      `premium/hosts/host-delete`.
- [ ] The macOS pool is two versions until January (15 and 26, later 26 and 27). The macOS tests split
      between them at random, by worker (agreed 2026-11-14); a spec that depends on the version asks for it
      by `os`. Step D's smokes are what covers each version every night.
- [ ] **Lab handshake.** The five parked pool VMs move from OS matrix onto VMs when C is ready to test, not
      before: until each worker has its own VM, an extra host on VMs only receives other tests' fleet-wide
      installs and settings. The handoff says to move them after B; this is the one place the plan differs.
      A new pool member gets Claude from the fleet's policy at its first policy run, and the durable
      report's first stored result within five minutes.
- [ ] A trial at 4 workers (`-f workers=4` on the branch run), read with `run_timeline.py --platforms`.
      The 4-worker run of 2026-09-30 was red for three reasons, and the lease removes two: three specs on
      one Mac, and four Linux installs on one VM. The third, blank pages under load, is the instance.
- [ ] Decide from the numbers, not before: D4 (a minute budget per VM platform), and whether the audit's
      per-platform lanes (roadmap 5) are still needed. A dead pool member now shrinks the pool instead of
      failing 55 tests, which was the lanes' main reason.

Not in C: two runs on the instance at once (a branch run during the nightly). They share one concurrency
group and queue.

### What B + C close elsewhere

- [ ] `architecture-audit.md`: tier 4's item 13 (leases) and the environment gate of item 5; D4.
- [ ] `TODO.md`: the `workers` row under *Config workarounds*.
- [ ] `long-term-goals.md`: the opening of *Host types* and its closing paragraph on host plumbing.
- [ ] `CLAUDE.md` › *Test hosts* (rewritten around the manifest and roles), `ci-pipeline.md` ("One real VM
      per platform per tier"), `vms.yml`'s header, the skills' shared real-host block ("three VMs per
      tier"), a comment in `tests/cli/premium/fleets.spec.ts` that names an old VM, and
      `helpers/profiles.ts` ("the VMs have no Wi-Fi interface", untrue of a physical Mac).

## Step D: a smoke per OS version

One spec, parametrized by the manifest's `os`, over the matrix hosts **and** the pool's OS versions, so each
version gets the same checks every night while the main suite splits across the pool at random. Through the
UI, like the rest of the suite.

| Smoke | Hosts | Notes |
|---|---|---|
| Online, with the right OS name and major version, and its fleetd and osquery versions | all | Kubuntu reports `ubuntu`, Fedora `rhel`. Fleet showed Zorin OS 18.1 as 18.0.0 on 2026-11-14: check which is right before asserting a full version |
| The software inventory lists a package known to be installed | all | deb, rpm and pacman sources |
| A script runs and returns its output | all | |
| A custom package installs and uninstalls | deb: Ubuntu, Debian, Kubuntu, Zorin. rpm: RHEL 9 and 10, Fedora, Amazon Linux, openSUSE. `.msi`: Windows 10 and Server | No `.rpm` fixture exists yet: add an inert `noarch` one. **openSUSE has no `dnf`** (checked on the host), and Fleet's default rpm install script calls it: either a custom install script with `zypper`, or a Fleet bug to file. **Fleet has no `.pkg.tar.zst` custom packages**, so Omarchy takes a `.sh` or `.tar.gz` package, which also installs everywhere |
| A package installed by a policy automation | one deb host, one rpm host | |
| Fleet Desktop is running | hosts with a desktop | Not Ubuntu server or Amazon Linux (`desktop: "none"`) |
| Vulnerabilities are reported for the OS | RHEL 9 and 10, the Ubuntu LTS versions | |

- [ ] The spec, its project (`premium-matrix`, in `PROJECT_TO_SUITE`) and its own step in the premium job,
      after the main project, skipped in a branch run unless asked for. Every suite on an instance shares
      one concurrency group, so a separate workflow would queue behind the nightly, not overlap it; lift the
      step into its own workflow later if it proves noisy.
- [ ] Its things go on the OS matrix fleet with `pw-*` names, target one host, and are deleted in the test;
      a sweep takes what a dead run left. Never disk encryption, an OS-update setting or a passcode profile
      on that fleet. Don't install `zenity` or `kdialog` on `prem-fedora45-luks` or `prem-omarchy-01`: they
      reproduce fleetdm/fleet#58776.
- [ ] macOS 27, when its VM exists, gets a DDM-focused smoke.
- [ ] Closes `long-term-goals.md`'s Fedora, RHEL and Omarchy rows. The Omarchy row's `pkg.tar.zst` is the
      fleetd agent package, not a custom package.

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

## Open questions for Andrey

- Who moves the five parked pool VMs onto VMs when C is ready to test: the agent through the API, or he.
  Asked 2026-11-14, not yet answered.
- May the cleanup move lab hosts back to their role's fleet (step B)?
- The host-expiry window for VMs and OS matrix.
- Whether the suite's copy of `lab-hosts.json` is the source of truth, with the lab's scripts reading it, or
  the lab's copy stays first.
- A matrix host that is offline: does its smoke fail or skip?

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
