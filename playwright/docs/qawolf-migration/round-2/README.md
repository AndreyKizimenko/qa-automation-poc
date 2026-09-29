# Round 2 — the work

QA Wolf's second and final export. **127 source flows → 60 target specs, in seven batches.**

| | |
|---|---|
| **what we're building** | the batch files, [A](A-no-setup.md) → [G](G-out-of-band.md) |
| **what happened to one specific flow** | [INDEX.md](INDEX.md) |
| **why 29 flows were cut** | [TRIAGE.md](TRIAGE.md) |
| **the scope decisions behind all this** | [DECISIONS.md](DECISIONS.md) |
| **how to run an intake like this** | [../PLAYBOOK.md](../PLAYBOOK.md) — round 1's method, still current |

---

## 1. The goal, stated precisely

**Do not lose coverage when QA Wolf goes away.** That is the only hard requirement. It does *not* mean port
their tests — it means every behaviour they verify must still be verified here.

So the unit of work is the **behaviour**, not the file. A source flow can become one spec, several specs, a
case inside a spec we already have, or a row in a parameterised list. That is why 127 flows become 60 specs
and not 127.

Their tests lose a lot in the telling, and copying them would import the losses:

| what they do | how often | what we do instead |
|---|---|---|
| `toHaveScreenshot` on a modal or chart | 14 flows | assert the status text, the output, the value |
| assertions that cannot fail — `toBeGreaterThanOrEqual(hostCount, 2)` on a targeting flow | throughout batch E | resolve both host sets by API, assert set membership |
| hosts by hardcoded name — `macos15-prem`, `TEST-WIN-11`, `_.EBE1e` | ~40 flows | `findOnlineHost(request, platform, { kind })` |
| column assertions by index, skipping index 3 unexplained | the 4 role flows | a named column list |
| one file per role × tier × platform | ~35 flows | one spec, with role/tier/platform as a dimension |
| `slowMo`, `waitForTimeout`, a homegrown `waitForPageLoad` | throughout | web-first assertions and auto-waiting |
| CSS internals — `.name__header .ascending .descending-arrow` | throughout | role and accessible name, class only where Fleet emits no alternative |

## 2. What we already have

The suite is not starting from zero, which is why so many targets are augments rather than new files.

| | count |
|---|---:|
| e2e specs | 95 |
| pure-API specs | 16 |
| CLI specs | 13 |
| loadtest specs | 11 |
| **page objects** | **77** |

E2e specs by area — settings 24 · hosts 15 · controls 11 · software 10 · reports 7 · command-palette 7 ·
policies 6 · auth 5 · account 4 · labels 3 · dashboard 1 · packs 1.

`pages/` already has directories for `software/`, `controls/`, `hosts/`, `settings/`, `policies/`, `reports/`,
`labels/`, `account/`, `auth/`, `packs/` and `components/` — which map almost exactly onto the areas round 2
touches. **16 of the 60 targets are augments onto specs round 1 shipped**, and most of the remaining page-object
work is growth, not greenfield.

## 3. The batches

Ordered by **how much setup each needs** — nothing first, new infrastructure and out-of-band work last.

### Shipped

A–C and gitops-mode V1 merged in [PR #61](https://github.com/AndreyKizimenko/qa-automation-poc/pull/61)
(2026-09-28), D in [PR #63](https://github.com/AndreyKizimenko/qa-automation-poc/pull/63) (2026-09-29). Per-batch
detail — what landed, what was retargeted, what was found — is in
[DELIVERY-LOG.md](../DELIVERY-LOG.md).

| batch | theme | flows | specs | notes |
|---|---|---:|---:|---|
| **[A](A-no-setup.md)** ✅ | No setup — read-only surfaces, validation, API size limits | 28 | 14 | 2 DUPs dropped; `titles-table` split shared + premium |
| **[B](B-self-contained.md)** ✅ | Self-contained mutation — library CRUD, global config | 13 | 8 | 1 DUP dropped; took the historical-data row from A |
| **[C](C-host-reads.md)** ✅ | Live host, read-only | 8 | 8 | 3 retargets; the vitals-refetch row moved to D |
| **[D](D-host-execution.md)** ✅ | Execution on hosts — scripts, MDM commands, install/uninstall/update, batch runs | 31 | 10 | durable VM software in `vms.yml`; resting-state preflight; `QA — Branch run` workflow |
| **[G](G-out-of-band.md)** ◐ | gitops mode **V1** — its own project, runs last | 5 | 5 | retries half not started; gitops V2 parked |

That is **85 of the 127 flows**, and the whole `gitops-mode` project. The suite went from 113 spec files to
**168**; D added the `premium-exclusive` / `free-exclusive` projects for specs that flip a global switch.

### Remaining

| batch | theme | setup needed | flows | specs |
|---|---|---|---:|---:|
| **[E](E-label-targeting.md)** | Label targeting — profiles, declarations, software, policies | labels + several hosts | 21 | 10 |
| **[F](F-provisioning.md)** | Provisioning-gated — MFA mailbox, IdP, Fedora, recovery lock | new instance setup | 13 | 9 |
| **[G](G-out-of-band.md)** (rest) | Policy automations and retries | its own project and schedule | 9 | 5 |
| | | **remaining** | **43** | **24** |

**E is in review** — [PR #65](https://github.com/AndreyKizimenko/qa-automation-poc/pull/65), awaiting its branch run. The handoff is at the top of
[E-label-targeting.md](E-label-targeting.md), progress in its *What landed*. Its first slice, the inert profile
fixtures, found the free VMs had been receiving the suite's lock profiles (§5).

**F is less blocked than its title** — checked live on 2026-09-29, see the top of
[F-provisioning.md](F-provisioning.md). The technician-transfer and both team-admin flows need nothing, the IdP
username UI exists, and the manual enrollment profile is a download. Still blocked: the three MFA flows (no
SMTP on either tier), the RPM case (no Fedora host online) and the recovery-lock *act* (a decision, not a
setup). F's ready rows can run before or beside E.

**Before either, read §9** — how batches run since D: which skills, how much to run, and which docs move with
the code.

Batch G's retry half is last on purpose: those specs wait through real 30–90 minute intervals and belong on
their own schedule, not in the nightly.

## 4. Page objects and helpers to build

Consolidated from the batch files, so the dependency graph is visible in one place.

### New component objects

| component | batch | what it wraps |
|---|---|---|
| **`TargetLabelSelector`** (planned as `ProfileTargetsForm`) | E | include-all / include-any / exclude label targeting. The highest-leverage new object in round 2. Fleet has two variants sharing one root — tabbed (profiles, declarations, policies) and dropdown (software, reports) — and one component object covers both. |
| `RunScriptModal` | D | Actions → Run script: script picker, Run now vs Schedule for later |
| `ScriptDetailsModal` | D | script output, exit status, status message line |
| `MdmCommandDetailsModal` | D | request payload and response textareas |
| `UninstallDetailsModal` | D | uninstall status icon and detail text |
| `VersionsModal` | B | version list, pin to latest / major / older |
| `CertificatesCard` | C | host-details certificates table and its columns |

### Page objects to grow

| page object | batch | what to add |
|---|---|---|
| `DashboardPage` | A | platform cards, host-count links, chart cards by name |
| `SoftwareTitlesPage` | A | column-sort toggles, installable/vulnerable filters |
| `FleetMaintainedAppsPage` | A | platform filter, hide-added toggle, text search |
| `FileUploader` / `EditSoftwareModal` | A | rejection-toast and validation-error accessors |
| `SoftwareTitleDetailPage` | B, D, E | custom icon, display-name rename, Versions entry, install/uninstall, label targeting |
| `OrganizationInfoPage` | B | logo upload / preview / remove |
| `HostDetailsPage` | C–G | software-tab top-level filter, certificates card, Run script entry, upcoming/past activity by name, end-user / IdP card |
| `SoftwareInstallerCard` | D | install and uninstall status accessors |
| `ScriptsLibraryPage` | D | batch-run entry, target selection |
| `ConfigurationProfilesPage` | E | custom-targets tab, declarations |
| `OsUpdatesPage` | E | DDM conflict error surface |
| `PolicyEditPage` | E, G | automations panel — run_script, install_software, continuous toggles |

### New helpers

| helper | batch | why |
|---|---|---|
| `helpers/api/labels.ts` (grow) | E | resolve the exact host set a label matches, so targeting is asserted as set membership |
| `helpers/mailbox.ts` | F | read a magic link out of a mailbox for the MFA flows |
| `helpers/api/gitops-mode.ts` | G | flip `gitops_mode_enabled` and the `labels` / `software` / `secrets` exceptions |

**Large test data is already solved** — see [DECISIONS §3](DECISIONS.md#3-test-data). Round 1's
`tests/api/premium/max-request-file-sizes.spec.ts` generates every payload at run time with `Buffer.alloc`;
nothing multi-MB is committed. The one case that still needs a decision is the >1 GB installer in batch D.

## 5. Test hosts — use the real VMs, and never lock yourself out

Batches C through F all touch hosts. **Use the real VMs, not the simulations**, wherever the assertion depends
on a real answer — software inventory, script output, profile delivery, certificates, agent versions. An
osquery-perf simulation ignores live-query SQL, returns no rows ~20% of runs, and never actually installs
anything, so a green test against one proves nothing about the feature.

The suite already resolves them; nothing new is needed:

| | how |
|---|---|
| premium VMs | the **VMs** fleet — `vmsFleetId` worker fixture (resolves by name, currently fleet 103) |
| free VMs | resolved by name/platform through the same API path |
| a real macOS VM | the `liveMacosHost` worker fixture |
| any real host by platform | `findOnlineHost(request, platform, { kind: 'real' })` |

`kind: 'real'` keys on `hardware_model` matching `/virtual|qemu/i` — **not** on MDM enrollment, which is why it
still works now that ~30% of the simulated pool is MDM-enrolled. Resolve at run time, never by stored name or
id: the load-fleet daemons regenerate both on every restart.

### ⚠️ Never deploy a passcode profile. Ever.

**A passcode profile blocks access to the host. There is no recovery and no exception.** There are only a few
real VMs per tier and no re-provisioning automation, so one deployed passcode payload ends every other
real-host spec until somebody rebuilds the VM by hand.

The same is true of anything else that gates getting into the machine: screen lock, inactivity timeout,
FileVault, login-window restrictions, or disabling SSH / remote management / the MDM channel itself.

This was not hypothetical. The suite shipped a passcode profile (`fleet-test-passcode.mobileconfig`) and a
Windows DeviceLock profile (`fleet-test-screenlock.xml`) for a lifecycle spec that "never reaches a host" — but
**on free, Unassigned is where the real VMs are**, and Fleet's profile reconciler delivers whatever it finds on its 30-second tick. By 2026-09-29
the free Windows VM had received the DeviceLock profile 32 times and the free macOS VM had acknowledged the
passcode profile 7 times; each was removed about 90 s later, which is the only reason neither was locked.
Batch E replaced both with an inert pair and deleted them (see
[E-label-targeting.md → What landed](E-label-targeting.md#what-landed)). **Uploading a profile is delivering
it.**

The suite's profile fixtures are the inert pair `test-data/{apple/macos,windows}/profiles/fleet-pw-inert.*`,
each with a README saying why it is safe and how to prove it arrived. Rules for anything deployed to a real VM —
which, on free, means anything uploaded at all:

- **never a passcode payload** (`com.apple.mobiledevice.passwordpolicy`, `forcePIN`, `minLength`,
  `maxInactivity`, `allowSimple`) — this one is absolute;
- no screen-lock, inactivity, FileVault or login-window payloads;
- no payload that disables SSH, remote management, or the MDM channel;
- prefer an inert custom preference domain whose only job is to be observable;
- remove the profile in the same test that deployed it;
- if you are unsure whether a payload is safe, it is not — ask before deploying it.

The same caution governs the recovery-lock specs in batch F, which is why they are scoped to the permission
surface rather than the act ([F](F-provisioning.md)).

## 6. Standing rules

Not new — the round-1 lessons that cost the most, restated where builders will read them.
[../PLAYBOOK.md](../PLAYBOOK.md) has the long form; `playwright/CLAUDE.md` is the suite contract.

1. **Ground every locator in the product source, then probe the live page.** Their selectors are hints. Read
   the React component for the role and accessible name, then confirm against the live DOM for anything
   conditional — a field's label is swapped for an error message when invalid, so `getByLabel` stops resolving
   exactly when the test needs it.
2. **Resolve hosts through the API, never by name.** The pools are osquery-perf simulations whose names and
   ids change on every daemon restart. `kind: 'real'` for behaviour, `'simulated'` for volume.
3. **Scope every assertion to your own records.** Never an absolute count on a shared list.
4. **Snapshot and restore global config inside the test, not in a hook.**
5. **Assert what the user sees, then confirm the write via API.** Catches the bug where the form looks right
   and the write silently didn't happen.
6. **No `toHaveScreenshot` for behaviour.** If a snapshot is genuinely the only way, say why in the header.
7. **Write the header comment for the next reader** — why this host, why this fleet, why this locator, what
   breaks if someone "simplifies" it. Most of round 1's hard-won knowledge lives in spec headers.
8. **Verify before calling it done:** `npm run check`, then run on every tier the spec targets, once headed,
   at least once *with* dependencies (no `--no-deps`), and `--repeat-each=5` for anything timing-sensitive —
   **scoped to the specs you changed**. The full suite runs once, at the end of the batch, on CI (§9).

## 7. How a batch runs

1. **Invoke the `playwright-test-author` skill first**, via the Skill tool, and follow it. `CLAUDE.md`
   describes it as auto-invoked; do not rely on that — call it explicitly before writing anything. It carries
   the locator priority, the POM rules, the Fleet-specific traps and the verification bar this suite is held
   to. `playwright-test-reviewer` is the explicit counterpart when auditing existing specs rather than
   writing new ones.
2. **Read the sources.** Paths in each batch file are relative to
   `qa-wolf/Fleet_20260828 (1)/{Free,Premium}/src/tests/`. Mine `node-20-helpers-premium.js` for toast copy
   and nav paths; port none of it.
3. **Open the existing spec for every augment row before writing anything.** Titles lie. Round 1's most common
   rework was rebuilding something we already had.
4. **Build the page objects first.** The POM table is the batch's real dependency graph.
5. **Ship in slices** — one concern per commit: POM + spec + doc update, `npm run check` clean, live-run green.
   Don't batch five specs and run them at the end; you lose failure attribution.
6. **Append to [../DELIVERY-LOG.md](../DELIVERY-LOG.md)** when a slice lands. Claims are verified by `grep`ing
   the spec path, not by ticking a box — round 1's per-batch checkbox trackers drifted and were deleted.
7. **When a flow won't go green,** decide which of the three it is — test bug, infrastructure gap, or real
   product defect — and act accordingly. "Make it green" is the wrong instinct; see
   [../PLAYBOOK.md §8](../PLAYBOOK.md#8-when-a-flow-wont-go-green) and
   [`../blocked-by-product-bugs.md`](../../blocked-by-product-bugs.md).

## 8. Standing preconditions this round adds

Round 1's rule ([PLAYBOOK §9](../PLAYBOOK.md#9-reconcile-dont-skip-the-accounting)) still holds: anything the
suite assumes but does not create has to be written down where whoever re-provisions the instance will find
it, and the spec has to fail loud with recreation instructions. The canonical list is the table in
[../README.md](../README.md#standing-instance-preconditions). Round 2 adds one entry.

### A durable Fleet-maintained-app shelf on the **QA** fleet (premium)

`gitops/premium-fleetqa/fleets/qa.yml` parks ten frequently-updated apps — each on macOS and Windows, 20
catalog entries — on the QA fleet permanently. They are never installed on anything; they exist to be listed.

**What it buys.** Fleet caches installer builds **per fleet**, and adding an app caches exactly one, so
"pin to an *older* version" has nothing to pin to. QA Wolf's original flow only passed because their instance
had accumulated builds over months. Fleet's hourly `maintained_apps_auto_update` cron downloads each
latest-tracking app's newest build and keeps the previous one, so an app that *stays* on a fleet grows a
version history by itself. Provisioning beats seeding for anything whose value is accumulated state.

**Why the QA fleet specifically.** `setup/cleanup.steps.ts` wipes installable software on Unassigned
(`fleet_id=0`) and Workstations before and after every run and touches no other fleet — so those two are out.
QA held nothing at all, which is what made it safe to bring under gitops: **a fleet named in a gitops run has
everything not declared deleted.** The shelf is kept off the VMs fleet because nothing on it is meant to be
installed; VMs is under gitops too since batch D (`fleets/vms.yml`), for the fixtures that *are* installed —
see [D-host-execution.md](D-host-execution.md#the-fma-fixture-set).

**Consumed by** `tests/e2e/premium/software/version-pinning.spec.ts`, which throws with the re-apply path when
an app is missing, and skips its older-version case (only that case) until some app on the shelf has cached a
second build.

**Two traps for whoever re-provisions it:**

- **`fleetctl gitops` ignores `FLEET_URL` / `FLEET_API_TOKEN`.** It reads `~/.fleet/config`, whose `default`
  context on a Fleet developer's machine is usually their own dev instance. Sourcing `.env.premium` does not
  aim it anywhere. Pass `--context qa-premium`, and check the `Server Version:` line against
  `GET /api/v1/fleet/version` on premium-fleetqa — the RC build timestamps differ per instance.
- **The client must be within a minor of the server.** One minor behind is fine (the released 4.92.1 applied
  `qa.yml` and `vms.yml` against the 4.93 RC correctly, 2026-09-28); far behind is not — a 4.85.1 client
  against a 4.93 server printed `gitops succeeded` while silently writing no software at all.

## 9. Working a batch since D

Batch D's lessons, as rules for E, F and G. The suite now takes **~43 min on premium and ~10 on free** in CI, and
most of it is real-VM work that doesn't get faster with more workers — so *how much you run* matters as much as
what you write, and the docs have to move with the code or the next audit pays for it.

### Skills — call them, don't wait for them

| when | skill |
|---|---|
| before writing anything | **`playwright-test-author`** (Skill tool) — the rules, the traps, the verification bar |
| before opening the PR, on your own specs and page objects | **`playwright-test-reviewer`** — fix what it finds, or write down why not |
| a run went red and you need a verdict (flake, test bug, product bug, infra) | **`playwright-run-reviewer`** |
| Andrey has decided a finding is a Fleet bug | **`/fleet-bug-file`** — only when he says so. Search first: both of D's "new" bugs (#53186, #53965) were already filed |

### How much to run

- **While building, run only what you changed**, on every tier it targets:
  `npx playwright test --project=premium <spec-file-names>` (and `--project=free` for anything in `shared/`).
  That runs `premium-setup` and `cleanup-setup` — including the VM resting-state step — and then only your
  tests. **Don't use `npm run test:premium -- <spec>`**: it also names the exclusive project, whose dependency
  is the *whole* main project. `--no-deps` for fast iteration; with deps at least once before you call it done.
- An exclusive spec: `npx playwright test --project=premium-exclusive <file-name> --no-deps` — by file name,
  not path.
- `--repeat-each=5` for anything timing-sensitive, scoped the same way. Keep **`--workers=2`** for anything on
  the real VMs: it's CI's shape, and 4 workers stack a VM's queue deep enough to time tests out.
- Write artifacts outside the repo: `--output=<scratchpad>/<run-name>`.
- **The full suite runs once, at the end of the batch, on CI**:
  `gh workflow run "QA — Branch run" -f branch=<branch>` — each tier's nightly gitops chain, then its suite,
  both tiers side by side. Triage it with `playwright-run-reviewer`. Run the full suite locally only if CI
  can't, and say so.
- **Before any run that touches the real VMs, check nothing else is:** `gh run list --limit 5`. The nightly
  is scheduled for 05:00 UTC (gitops) and 05:30 (Playwright), but GitHub has been starting it 5–6.5 h late
  (2026-09-26 09:42, 09-27 10:22, 09-28 11:27 UTC) — check `gh run list --workflow "Playwright — Premium" --event schedule`
  for today's, and `gh run list` right before you run. Two runs on the same VMs corrupt each other — one queue per VM, and
  shared fixtures each run's cleanup removes. CI's concurrency groups only keep CI from colliding with itself.

### Which docs move with the code — in the same commit

| you changed | update |
|---|---|
| a spec | the batch file's *What landed* table; a [DELIVERY-LOG](../DELIVERY-LOG.md) line; the [test-audit](../../test-audit/README.md) area file — one entry per `test()`, steps as a person would do them, validations tagged *(UI)* / *(API)*, an honest Assessment — and the audit README's index and counts |
| a helper or page object | `helpers/README.md` / `pages/README.md` |
| a fixture | the `test-data/` README: what it does, why it's safe on a real VM, how to rebuild it, and its hash if gitops pins one |
| gitops | the fleet file's header and `gitops/premium-fleetqa/README.md`; apply it, and say so in the PR |
| a rule every spec should follow | `playwright/CLAUDE.md`, and the author / reviewer skill when it's about writing or reviewing |
| a skip owed to a Fleet bug | a row in [`blocked-by-product-bugs.md`](../../blocked-by-product-bugs.md) + `TODO(fleetdm/fleet#N)` on the skip |
| something the next batch will trip on | that batch file's *Start here* block |

### The real VMs, as they are now

- **Their software is durable.** `gitops/premium-fleetqa/fleets/vms.yml` keeps an inert `.pkg` / `.msi` / `.deb`,
  7-Zip's `.exe`, Itsycal and DB Browser for SQLite on the VMs fleet, listed for specs in
  `helpers/vm-fixtures.ts`; their resting state is **uninstalled**. Never delete those titles or change their
  scripts, labels or versions. A test that changes a title — a label scope, its own scripts, a version swap —
  uses a **per-run** package named `fleet-pw-*` (`helpers/deb.ts`; for a `.pkg` / `.msi`, a committed fixture
  whose *file name* starts `fleet-pw-`, so the cleanup sweep recognises it).
- **Every run starts and ends the VMs at rest** — `cleanup.steps.ts` → *bring the real VMs to their resting
  state*: the suite's queued work cancelled, the script timeout at Fleet's default, the fixtures uninstalled.
  A batch that leaves a new kind of state on a VM — a profile, a label membership, an OS setting — extends it
  there: the sweep for things Fleet stores by name, the resting-state step for what's on the host.
- **Server-side vs host-side.** Which hosts Fleet *targets* — a profile listed for a host, software offered in
  its Library — is Fleet's decision, and a simulation shows it as well as a VM. What the host *does* —
  delivered, verified, installed — needs a real VM. There is one real VM per platform, so "a host of the same
  platform outside the label" has to be a simulation.
- **Waits:** `waitForSoftwareSettled` / `waitForHostRefetch`. Never wait on `software_updated_at` (it moves only
  when the inventory *changes*), and wait out a refetch already outstanding (`waitForNoPendingRefetch`) before
  requesting your own — Fleet queues one after every install and uninstall, and a new request merges into it.
- **Budget VM time:** a round trip is 1–5 min; a retried VM test costs 5–15. The CI job's limit is 120 min and
  Playwright stops itself at 100 in CI, report included.

### Fleet behaviour the suite already accounts for

- [fleetdm/fleet#54262](https://github.com/fleetdm/fleet/issues/54262) — the script details modal takes "after N
  seconds" from the output, not the timeout (asserted as today's copy, `TODO`).
- [fleetdm/fleet#53965](https://github.com/fleetdm/fleet/issues/53965) — `fleetctl generate-gitops` fails on Free
  with Apple MDM on; every Free `generate-gitops` test skips behind it.
- [fleetdm/fleet#53186](https://github.com/fleetdm/fleet/issues/53186) — a gitops apply reports
  `[-] deleted software - …` for packages it keeps. Check the installer id before believing it.
- [fleetdm/fleet#20440](https://github.com/fleetdm/fleet/issues/20440) — a new `.exe` title isn't linked to what
  Windows reports; one in the Fleet-maintained catalog (7-Zip) is linked once the hourly
  `reconcile_windows_maintained_app_titles` cron merges it.
- `fleetctl`: CI installs the server's release when published, else the latest — at most a minor behind, which
  Fleet supports.
