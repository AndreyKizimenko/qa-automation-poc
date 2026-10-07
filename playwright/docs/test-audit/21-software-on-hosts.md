# Software on hosts — test audit

**Specs covered:** 8 files · **Entries:** 13 live + 3 retired stubs (SWH-01, SWH-02, SWH-04 — retired 2026-09-28) · **Runtime tests:** 22 (three parameterized loops collapsed into four entries — SWH-14's six durable fixtures, SWH-16's three VMs, and the Claude loop, which declares two tests per platform, SWH-09 and SWH-13 — every generated title listed; skips on a data-availability guard: SWH-10 always today, SWH-13's two tests on any day Claude is level with the library) · **Project:** premium

This area covers Fleet **delivering software to a real device**: a package the VMs fleet keeps for the purpose,
installed from the host's Library, followed until the host reports it back, then uninstalled and followed
until the host stops reporting it; plus the failure paths (a refused install, a failing uninstall), the
Library's **Update** button, the "Deploy" automatic-install policy, and the Add-software form at the size end.
Everything except SWH-11/12 happens on a real VM, and the host itself is the oracle — an installed version only
counts once the host's own inventory says so. **Adding** software through the UI without a host is area 06's
(`library.spec.ts`, SWL-01); here only SWH-03 (Deploy) adds through the form.

> **Restructured 2026-09-28** (branch `playwright/vms-durable-fixtures`). The install and uninstall loops
> (SWH-01, SWH-04) and the catalog-add FMA install (SWH-02) became one test per **durable fixture**,
> SWH-14 in `software-lifecycle-on-host.spec.ts`: each installs, checks, uninstalls and checks again, on a
> title gitops keeps on the VMs fleet and the test never deletes. `install-on-host.spec.ts` keeps only Deploy
> (SWH-03); `uninstall-from-host.spec.ts` keeps only the failing uninstall (SWH-05).

**This area is unlike every other one in the audit, in eight ways.** Read them before running anything.

**1. It runs on the real VMs, not the simulations.** Three genuine machines — **macOS, Windows 11 and
Ubuntu, all ARM** (Apple M4, ARM Windows, aarch64) — on the **VMs** fleet (id 103 on premium QA, resolved by
name through the `vmsFleetId` worker fixture). Specs pick them with `requireRealHost(request, platform)`
([`helpers/api/hosts.ts`](../../helpers/api/hosts.ts)), which wraps
`findOnlineHost(request, platform, { kind: 'real' })` — keyed on `hardware_model` matching
`/virtual|qemu/i`, **not** on MDM enrollment — and throws *"no online real <platform> VM on <url> … Check the
<platform> VM is powered on and enrolled."* when there is none. Never by name or id. An osquery-perf simulation never installs
anything, so a green assertion against one proves nothing. ARM decides which installers can land at all:
that is why the Windows `.exe` is `7z2601-arm64.exe` and why an `amd64` `.deb` is a *deterministic* failed
install on the Ubuntu VM.

**2. The VMs fleet is under gitops, and holds the software these specs install.**
`gitops/premium-fleetqa/fleets/vms.yml` declares the `pw-host-report-results` report, keeps **Claude**
installed on the macOS and Windows VMs via two **"Claude is installed"** *presence* policies (reinstall when
missing, never update), and declares the six **install/uninstall fixtures** below. It is applied **before
every nightly premium run**, in both the baseline and the min pass (`.github/workflows/gitops-premium.yml`,
`gitops-premium-min.yml`), and the Playwright premium workflow shares the `premium-fleetqa-instance`
concurrency group with the nightly apply, so an apply and a test run never overlap. Claude tracks latest (no
`version:` pin), so Fleet's hourly `maintained_apps_auto_update` cron downloads each new build and keeps the
previous one — the ingredient the update spec (SWH-09/10/13) needs. Design and rationale:
[D-host-execution.md → The FMA fixture set](../qawolf-migration/round-2/D-host-execution.md#the-fma-fixture-set)
and [→ Durable install/uninstall fixtures](../qawolf-migration/round-2/D-host-execution.md#durable-installuninstall-fixtures-2026-09-28-follow-up).
Everything else on the fleet is per-run (`fleet-pw-*` / `pw-*`), and a gitops apply deletes whatever the file
does not declare.

**3. Every fixture is inert, and most are durable.** Nothing a spec installs changes the machine beyond one
marker or one small app. Two kinds:

*Durable — declared in `vms.yml`, listed for the specs in
[`helpers/vm-fixtures.ts`](../../helpers/vm-fixtures.ts) (`VM_SOFTWARE_FIXTURES`; the two change together),
never deleted by any test.* **Their resting state is uninstalled.** Because the titles never leave the fleet,
Fleet always knows whether each is on its VM, and the `cleanup-setup` preflight uninstalls any a dead run left
installed (see *Cleaning up* below). The custom packages live under `gitops/lib/platforms/*/software/`, each a
`*.package.yml` pointing at a **commit-pinned `raw.githubusercontent.com` URL with a `hash_sha256`**, so the URL
never changes and Fleet skips the download once it holds the file. Consumed by SWH-14.

| fixture | title Fleet shows | built by | installs |
|---|---|---|---|
| `fleet-playwright-install-1.0.0.pkg` | from the package | [`test-data/apple/macos/software/make-pkg.sh`](../../test-data/apple/macos/software/make-pkg.sh) (committed output) | one empty app bundle, `/Applications/Fleet Playwright Install.app` — an app bundle because macOS inventory lists `.app` bundles only; a files-only `.pkg` installs but never shows up |
| `fleet-playwright-install-1.0.0.msi` | from the package | [`test-data/windows/software/make-msi.sh`](../../test-data/windows/software/make-msi.sh) (committed output) | one marker file under `C:\Program Files\Fleet Playwright Install\` |
| `7z2601-arm64.exe` | **7-Zip** (ProductName) when new, **7-zip** once Fleet's Windows-title reconcile links it — Windows lists it as **7-Zip 26.01 (arm64)** | committed vendor binary; install/uninstall scripts `gitops/lib/platforms/windows/software/7-zip-{install,uninstall}.ps1` (`/S`) | 7-Zip, into `C:\Program Files\7-Zip` — nothing else on the fleet uses 7-Zip |
| `fleet-playwright-install_1.0.0_all.deb` | from the package | [`test-data/linux/software/make-deb.py`](../../test-data/linux/software/make-deb.py) `fleet-playwright-install 1.0.0 all` (committed output) | one marker under `/usr/share/fleet-playwright-install/`, no maintainer scripts, `Architecture: all` |
| **Itsycal** (`itsycal/darwin`) | Itsycal | Fleet-maintained | a menu-bar calendar, never launched |
| **DB Browser for SQLite** (`db-browser-for-sqlite/windows`) | DB Browser for SQLite | Fleet-maintained | an MSI, no service, never launched |

*Per-run — for a test that changes the title itself* (a version swap, its own failing uninstall script, an
install policy), so it can't share a durable one: `fleet-pw-<purpose>-<base36>_<ver>_<arch>.deb`, built by
[`helpers/deb.ts`](../../helpers/deb.ts) **at run time** (`inertDeb`, `buildDeb`) — one marker at
`/usr/share/<name>/marker.txt`, no maintainer scripts, a per-run name so no other run can share the title.
Uploaded and deleted in the same test (SWH-03, SWH-05, SWH-06, SWH-07, SWH-08); the cleanup sweep removes a
dead run's.

A premium title can hold several packages, so two specs uploading the same file to the VMs fleet would share
one Library row — which is why each durable fixture belongs to one test, and a test that alters its title builds its own.

**4. The waits are the substance, and they are slow.** `waitForSoftwareSettled`
([`helpers/api/software.ts`](../../helpers/api/software.ts)) is the wait every flow here leans on, in three
steps: **(a)** the install/uninstall status settles (≤ 5 min — a VM works one queue, shared with every other
spec's scripts and installs); **(b)** a collection runs *after* that: wait until the host has no
refetch outstanding (≤ 4 min) — Fleet queues one after every install and uninstall, and one left by the
previous action can still be running on pre-install data, which a new request would merge into — then
baseline the host's `detail_updated_at`, ask for a refetch, wait for it to move (≤ 4 min) —
`detail_updated_at`, **not** `software_updated_at`, because the latter only moves when the inventory
*changes* and so never moves after a failed uninstall; **(c)** the inventory agrees with the status (≤ 1 min —
a refetch's detail results can be stored seconds before its software results); if it still disagrees, the
baseline-refetch-poll round runs once more. For a title Fleet may not have linked to what the host
reports (the `.exe`), `inventoryName` makes (c) also read the host's own inventory by the program's name. **A refetch
takes 60–120 s on a VM.** On a manual run, the equivalent is: wait for the Library Status to settle, wait
for "Last fetched" to move once on its own (Fleet's own refetch), then click **Refetch**, wait for it to
move again, and look.

**5. A failed install is retried.** Fleet makes `MaxSoftwareInstallAttempts` = **3** attempts and reports
`pending_install` between them, so "Failed" only sticks a minute or more after the click — several minutes
when the failure is a failed install *script*, because each one puts orbit's config loop into a 1, 2, 4… min
backoff that holds up everything queued on the host (fleetdm/fleet#54607). SWH-07 depends on this window and
fails its installs with a pre-install query, which doesn't trigger the backoff; a manual re-runner who expects
an instant red status will think the flow is stuck.

**6. The Upcoming activity item is not asserted in the UI.** An idle VM picks an install up within seconds —
often before the page that would show it has loaded — and a busy one after an unpredictable wait behind other
specs. The queued state is checked where it is deterministic, through the API (`status: pending_install` /
`pending_uninstall` the moment the click lands), and the UI asserts the outcome. On a manual run you will
usually see **Upcoming** flash "told Fleet to install …" and empty again; that is expected and unasserted.

**7. Two Fleet contracts are encoded here that you will not find elsewhere in the suite.**
- **Update vs Reinstall.** The Library row offers **Update** iff *any* installed version is below the
  library version, by Fleet's frontend `compareVersions` (`getUiStatus` → `getInstallerActionButtonConfig`),
  which **zero-pads missing segments** — Windows reporting `2.7032.0.0` against a library `2.7032.0` is
  *level*, not behind. Otherwise (equal, or host ahead) it offers **Reinstall**. After a failed install the
  button reads **Retry**; after a failed uninstall the uninstall side reads **Retry uninstall**.
- **The automatic-install policy's `created_policy` activity carries no fleet.** It reads
  "created a policy [Install software] … (deb)." with no "on the VMs fleet" suffix, where a hand-made fleet
  policy's does. Same activity type, two shapes — on the decision list, encoded in SWH-03.

**8. Runtime.** These six specs are the bulk of the premium nightly's **~40 min** (39.6 min at CI's two
workers on 2026-09-28, measured *before* the SWH-14 restructure, against a ~15 min nightly before batch D and
a 120-min job limit — Playwright's CI `globalTimeout` stops the run at 100 min with its report); each test takes **3–10 min**, SWH-14's two round-trips at the top of that. CI retries
twice, so a real failure here can cost half an hour.

The two **large-upload** tests (SWH-11/12) are the exception to all of the above: they never touch a host,
upload to **Workstations** (which `cleanup.steps.ts` wipes), and take seconds to a couple of minutes. The
size limit they read is **per instance** — **10 GiB** on premium QA, not QA Wolf's 1 GiB — and it is enforced
**in the browser on file selection**; the over-limit file is **sparse** (`ftruncate` to limit + 1 byte), so
it costs no disk and no time.

---

## ⚠️ Safety note for a manual re-runner

- **Install nothing on the VMs but the fixtures above.** They are shared by every real-host spec in the
  premium suite, and there are only three. The suite-wide rule applies with extra force: **never deploy a
  passcode, screen-lock or anything else gating entry to a real host** (`../../CLAUDE.md` → Test hosts) —
  nothing in this area does, and a manual run must not either.
- **Leave every durable fixture uninstalled, and never delete its title.** The six install/uninstall fixtures
  (Fleet Playwright Install `.pkg` / `.msi` / `.deb`, 7-Zip, Itsycal, DB Browser for SQLite) belong to the VMs
  fleet, not to your run: install one to walk SWH-14, then uninstall it before you stop. A deleted fixture title
  fails SWH-14 with *"… fixture is missing from the VMs fleet — re-apply gitops/premium-fleetqa/fleets/vms.yml"*
  until the next nightly apply puts it back.
- **Leave Claude alone.** Do not uninstall it from either VM, do not delete its titles, do not edit or delete
  the two **"Claude is installed"** policies, and **do not leave it pinned** — an exact pin freezes the
  auto-update cron for the title and stops the version history SWH-10 needs from growing. If you pin during
  SWH-10, unpin before you walk away (title → **Versions** → latest). `cleanup-setup` clears stranded pins on
  the QA and VMs fleets at the start of every premium run, but not between your clicks.
- **Don't run a manual flow while the nightly runs.** `QA — Nightly` is scheduled for 03:00 UTC, but GitHub has
  been starting it 4–6.5 h late since 2026-08-27, so check `gh run list`. It takes about 1.5 h: a Render redeploy, a 30-min wait, then the gitops apply, which
  re-applies `vms.yml` and deletes anything on the VMs fleet it doesn't declare — a `fleet-pw-*` title you
  uploaded included — and then the premium suite, which runs these same flows on the same VMs with the same
  durable fixtures; two installs of one title on one host will confuse both.

### Cleaning up by hand after an interrupted flow

`setup/cleanup.steps.ts` runs at the start and end of every run (`cleanup-setup` / `cleanup-teardown`) and does
two things for this area, in this order (both after the step that clears stranded version pins on
**QA** and **VMs**):

- **"sweep host-execution leftovers from the VMs fleet"** — premium. Deletes titles whose package matches
  **`^fleet-pw-`** only (never a durable fixture), `pw-` scripts, `pw-run-script-` reports and policies named
  `[Install software] fleet-pw-*`. **Deleting a title never uninstalls it**, and a per-run `.deb` never comes
  back to be uninstalled by a later run, so after the deletes the sweep checks the online Ubuntu VM's inventory for `fleet-pw-*` names and, if it finds any, queues one
  ad-hoc script on that VM — `dpkg-query -W -f='${Package}\n' 'fleet-pw-*' | xargs -r dpkg --purge`. A host
  runs scripts and installs from one queue, so the purge finishes before any install the run queues after it.
- **"bring the real VMs to their resting state"** — both tiers. Turns script execution on (uninstalls run as
  scripts), removes a `script_execution_timeout` override from the agent options (the VMs fleet's on premium,
  the global ones on free — the host-run-script timeout case lowers it to 60 s), and on each online real VM
  **cancels the suite's own queued upcoming activities**: `pw-` scripts, `fleet-pw-` packages and the durable
  fixtures' installs and uninstalls. On premium it then **uninstalls any durable fixture it finds installed**
  (`ensureVmFixtureUninstalled`, which waits for the inventory to agree). A VM that's offline is only logged; its
  specs then fail on it with their own message.

So by hand:

1. **A durable fixture left installed** (you stopped SWH-14 midway): host details → **Software** →
   **Library** → search the title → **Uninstall**, and wait for the Status to clear (a refetch lands 60–120 s
   later and the Installed version goes back to `---`; for 7-Zip, check the **Inventory** tab for
   `7-Zip 26.01 (arm64)` instead). Or leave it: the next run's preflight uninstalls it. **Never delete the
   title** to clean up.
2. **A per-run `fleet-pw-*` item** (you walked SWH-03/05/06/07/08 by hand): it needs deleting, in this order —
   - **If a "Deploy" policy exists**, delete it first: **Policies** → fleet **VMs** →
     `[Install software] <name> (deb)` → delete. A title an install policy points at cannot be deleted.
   - **Uninstall from the host** (Library → **Uninstall**, as above). Deleting the title first leaves the
     package on the machine.
   - **Delete the title.** **Software** → fleet **VMs** → the title → its installer card → **Delete this
     version** → **Delete**.

   If you forget, the next premium run's sweep deletes the title and purges the package from the Ubuntu VM —
   keep the `fleet-pw-` prefix so it can.

For SWH-05's package, whose uninstall script fails **by design**, the uninstall will fail again: either edit the
title's uninstall script first (title → **Edit software** → Advanced options) to
`apt-get remove --purge --assume-yes <name>`, or run that as an ad-hoc script on the Ubuntu VM
(`POST /api/v1/fleet/scripts/run` with `host_id` + `script_contents` — what the spec's `finally` does). Its
name starts `fleet-pw-`, so if you do neither, the next premium run's sweep purges it.

### Preparing a manual run

- **Find the VMs:** **Hosts** → fleet **VMs** → the one macOS, one Windows and one Ubuntu host. Identify them
  by platform (and "Virtual Machine" / QEMU hardware model on Details), not by a remembered name.
- **SWH-14 needs no files.** Its six fixtures are already titles on the VMs fleet, put there by gitops —
  check **Software** → fleet **VMs** lists them, and re-apply `vms.yml` (see `gitops/premium-fleetqa/README.md`)
  if one is missing rather than uploading it by hand.
- **The per-run tests need a `.deb` you build.** The committed `.deb`s are the wrong ones for them:
  `fleet-playwright-install_1.0.0_all.deb` *is* the durable Linux fixture (uploading it again would share its
  title), and `fleet-playwright-pkg_1.0.0_amd64.deb` is `amd64` — the right file for SWH-15 (wrong arch) and
  the wrong one for everything else. `test-data/linux/software/make-deb.py` takes `name version arch` and
  writes an installable one (`python3 test-data/linux/software/make-deb.py fleet-pw-manual 1.0.0 all`); or,
  from `playwright/`:

  ```bash
  npx --yes tsx -e "require('fs').writeFileSync('fleet-pw-manual_1.0.0_all.deb', require('./helpers/deb').inertDeb('fleet-pw-manual', '1.0.0'))"
  ```

  Keep the `fleet-pw-` prefix so the sweep recognises it if you forget it. Bump the version argument (and the
  file name) for SWH-08's 0.9.0 / 1.1.0 packages.

---

## Contents

| ID | Spec | Test | Mode | Manual? |
|---|---|---|---|---|
| SWH-14 | `premium/software/software-lifecycle-on-host.spec.ts` | a {macOS .pkg, Windows .msi, Windows .exe, Linux .deb, macOS Fleet-maintained app, Windows Fleet-maintained app} installs on the VM and uninstalls again — **6 variants** (listed first: the area's backbone) | UI+API | ☐ |
| ~~SWH-01~~ | ~~`premium/software/install-on-host.spec.ts`~~ | **Retired 2026-09-28** — the custom-package install loop; now SWH-14 | — | — |
| ~~SWH-02~~ | ~~`premium/software/install-on-host.spec.ts`~~ | **Retired 2026-09-28** — the FMA added from its catalog page and installed; now SWH-14 + SWL-01 | — | — |
| SWH-03 | `premium/software/install-on-host.spec.ts` | "Deploy" creates an install policy, and Fleet installs through it on the Linux VM | UI+API | ☐ |
| SWH-15 | `premium/exclusive/software/deploy-install-retries.spec.ts` | a Deploy whose install fails is tried 3 times, then reads Failed (listed beside SWH-03: its failure twin) | UI+API | ☐ |
| ~~SWH-04~~ | ~~`premium/software/uninstall-from-host.spec.ts`~~ | **Retired 2026-09-28** — the uninstall loop; now SWH-14 | — | — |
| SWH-05 | `premium/software/uninstall-from-host.spec.ts` | an uninstall that fails leaves the software installed, and the Library offers a retry | UI+API | ☐ |
| SWH-06 | `premium/software/inventory-reflects-install.spec.ts` | a package that installs appears in the Inventory once the host re-reports | UI+API | ☐ |
| SWH-07 | `premium/software/inventory-reflects-install.spec.ts` | a pending or failed install never appears in the Inventory, through every retry | UI+API | ☐ |
| SWH-08 | `premium/software/update-on-host.spec.ts` | a package the library moves ahead of is offered Update, and only then | UI+API | ☐ |
| SWH-09 | `premium/software/update-on-host.spec.ts` | Claude on the {darwin, windows} VM offers Update exactly when the library is ahead of it — **2 variants** | UI+API | ☐ |
| SWH-13 | `premium/software/update-on-host.spec.ts` | Claude on the {darwin, windows} VM updates to the library's build when it is behind — **2 variants**, **skip** on a day Claude is level (listed beside SWH-09: the same loop declares both) | UI+API | ☐ |
| SWH-10 | `premium/software/update-on-host.spec.ts` | Claude on the macOS VM: pinned back it is ahead, installed it is level, unpinned it updates — **skips** until a second Claude build is cached | UI+API | ☐ |
| SWH-11 | `premium/software/large-upload.spec.ts` | a package over the size limit is refused in the browser, before any upload | UI+API | ☐ |
| SWH-12 | `premium/software/large-upload.spec.ts` | a large upload shows its progress and ends in success | UI | ☐ |
| SWH-16 | `premium/software/host-library-tab.spec.ts` | on the {darwin, windows, linux} VM, counts what it offers and adds software on the {Fleet-maintained, Custom package} tab — **3 variants**, read-only | UI+API | ☐ |

`Mode` is one of: **UI** (all validation through the browser), **UI+API** (browser flow,
some assertions via API), **API** (no meaningful UI validation), **PERF** (timing).

### Running these

```bash
npm run test:premium -- -g "<title fragment>"            # with deps: premium-setup + cleanup-setup (the VMs sweep + resting-state preflight)
npm run test:premium:headed -- -g "<title fragment>"     # watch it
```

`-g` is a regex, and several titles contain `.` or `"` — quote the fragment with single quotes where it holds
double quotes. All six files run **fully parallel** (the suite default) except the `Claude` describe, which is
`mode: 'serial'` (its five tests — SWH-09 and SWH-13 per platform, then SWH-10 — one after another); with more
than one worker, the VM-bound tests queue on the VM of their platform: **six on the Ubuntu VM** (SWH-14's
`.deb`, SWH-03, SWH-05, SWH-06, SWH-07, SWH-08), **four on Windows** (SWH-14's `.msi`, `.exe` and DB Browser,
SWH-09) and **four on macOS** (SWH-14's `.pkg` and Itsycal, SWH-09, SWH-10), plus SWH-13 on each of the last
two on a day it runs. The CI workflows share a concurrency group with their tier's nightly gitops apply
(`premium-fleetqa-instance` / `free-fleetqa-instance`), so one test run also waits for another.

---

### SWH-14 · Premium • Software • Install and uninstall on host › a {macOS .pkg, Windows .msi, Windows .exe, Linux .deb, macOS Fleet-maintained app, Windows Fleet-maintained app} installs on the {darwin, windows, linux} VM and uninstalls again

- **File:** [`playwright/tests/e2e/premium/software/software-lifecycle-on-host.spec.ts`](../../tests/e2e/premium/software/software-lifecycle-on-host.spec.ts) · the fixture list and its helpers: [`helpers/vm-fixtures.ts`](../../helpers/vm-fixtures.ts)
- **Grep:** `npm run test:premium -- -g "VM and uninstalls again"` (six runtime tests: `a macOS .pkg installs on the darwin VM and uninstalls again`, `a Windows .msi installs on the windows VM and uninstalls again`, `a Windows .exe installs on the windows VM and uninstalls again`, `a Linux .deb installs on the linux VM and uninstalls again`, `a macOS Fleet-maintained app installs on the darwin VM and uninstalls again`, `a Windows Fleet-maintained app installs on the windows VM and uninstalls again`)
- **Project:** premium · **Scope:** the **VMs** fleet (no fleet dropdown — the flow starts on host details, by URL) · **Host:** the real VM of the row's platform
- **Mode:** UI+API · **Isolation:** parallel, one test per fixture; describe timeout **900 s**; two `test.step`s, **`install`** then **`uninstall`**, so a report names the half that failed. `finally` → `ensureVmFixtureUninstalled` (uninstalls, and waits for the inventory to agree, only if the fixture is still installed). **Never deletes the title** — it's the fleet's, not the test's.
- **Preconditions:** an online real VM of the platform (`requireRealHost`); the fixture's title on the VMs fleet, found by installer file name for a custom package and by name + platform among the fleet's Fleet-maintained titles for an FMA (`findVmFixtureTitle` — *"<label> fixture is missing from the VMs fleet — re-apply gitops/premium-fleetqa/fleets/vms.yml"* otherwise, and for an FMA *"<label> has no installer on the VMs fleet"*); the title offered to the VM with a library version (*"<title> isn't offered to <host>"*); the fixture **uninstalled** — the preflight's job, and the test calls `ensureVmFixtureUninstalled` once more before it starts (normally a no-op).
- **Data created:** nothing durable. The fixture is installed and uninstalled on one VM and left at rest; the host's Past activity gains one "installed" and one "uninstalled" item per run, with the same wording every run. A run that dies mid-flow leaves the fixture installed until `cleanup-teardown` (the same run's end) or the next `cleanup-setup` uninstalls it.

| variant | title | installer | uninstall script | inventory read by |
|---|---|---|---|---|
| macOS `.pkg` | from the package | `fleet-playwright-install-1.0.0.pkg` | Fleet's, from the package IDs | the title (linked) |
| Windows `.msi` | from the package | `fleet-playwright-install-1.0.0.msi` | Fleet's, from the product code | the title (linked) |
| Windows `.exe` | **`7-zip`** (reconciled; **`7-Zip`**, the ProductName, when new) | `7z2601-arm64.exe` | **ours**, declared in gitops — `7-zip-uninstall.ps1` runs `C:\Program Files\7-Zip\Uninstall.exe /S` (Fleet requires both scripts for an `.exe`) | **`7-Zip 26.01 (arm64)`**, the host's own name for it (unlinked, `linked = false`) |
| Linux `.deb` | from the package | `fleet-playwright-install_1.0.0_all.deb` | Fleet's `apt-get remove` | the title (linked) |
| macOS Fleet-maintained | **Itsycal** | the build Fleet cached — its file name read at run time | Fleet's, for the app | the title (linked) |
| Windows Fleet-maintained | **DB Browser for SQLite** | the build Fleet cached | Fleet's, for the app | the title (linked) |

**The `.exe` row has two states.** Fleet names a new custom `.exe` title from the installer's ProductName
(`7-Zip`) while Windows lists the program by its DisplayName (`7-Zip 26.01 (arm64)`), so it starts
**unlinked** ([fleetdm/fleet#20440](https://github.com/fleetdm/fleet/issues/20440)): no installed version in the
Library, and the inventory lists it under the DisplayName. Because 7-Zip is in the Fleet-maintained catalog,
Fleet's hourly `reconcile_windows_maintained_app_titles` cron then merges the DisplayName title into ours —
renamed **`7-zip`**, with 7-Zip's upgrade code — and it is **linked** from then on (observed 2026-09-28, within
an hour of the title's creation). The waits and `ensureVmFixtureUninstalled` count it installed if either
reading shows it; the test reads which state Fleet reports after the install and checks the Library's
installed version and the Inventory row for that state.

**Flow**

1. ☐ (No user action) Resolve the VM; find the fixture's title; read the title's state for this host (`GET /hosts/:id/software?available_for_install=true`).
   - ✅ *(API)* The title is on the VMs fleet (and, for an FMA, has an installer).
   - ✅ *(API)* It is offered to the VM with a library version.
2. ☐ (No user action) `ensureVmFixtureUninstalled` — if the VM still has the fixture (a linked title: status `installed` or any installed version; or, for the `.exe` while unlinked, the host's inventory lists `7-Zip 26.01 (arm64)`), uninstall it by API and wait for the inventory to agree.

   **`install` step**
3. ☐ Open the host's details page (via URL `/hosts/<id>`; anchored on **Disk space available**) → **Software** tab → **Library** tab → type the title in **Search by name**.
   - ✅ *(UI)* URL contains `/software/library`; the title's row is visible — `HostDetailsPage.openLibrary()`.
   - ✅ *(UI)* **Installed version** reads `---`.
   - ✅ *(UI)* **Library version** equals the version the API reported in step 1.
4. ☐ Click **Install** on the row.
   - ✅ *(UI)* Success toast **"Software is installing. To see details, go to Details > Activity."** — `HostSoftwareLibrary.install()`.
   - ✅ *(API)* The host's status for the title is `pending_install` immediately after the click.
5. ☐ Wait. By hand: watch the row's Status go from "Installing..." to **Installed**, wait for "Last fetched" to move once on its own, then click **Refetch** and wait for it to move again — `waitForSoftwareSettled(…, 'installed', { inventoryName })` (`inventoryName` set only for the `.exe`).
   - ✅ *(API)* Status reaches `installed` (≤ 5 min).
   - ✅ *(API)* No refetch outstanding (≤ 4 min), then `detail_updated_at` moves past a baseline taken after that (≤ 4 min, refetch requested).
   - ✅ *(API)* The inventory lists it (≤ 1 min; one more refetch round if not) — the title's installed versions, or for an unlinked `.exe` the host's inventory by `7-Zip 26.01 (arm64)`. The test records which: **linked** iff the title now shows an installed version (only the `.exe` may lack one).
6. ☐ Reload the host page → **Software** → **Library** → search the title.
   - ✅ *(UI)* **Installed version** equals the library version — or `---` for the `.exe` while unlinked.
   - ✅ *(UI)* The row's install-side button reads **Reinstall**.
7. ☐ Click the row's **Installed** status button.
   - ✅ *(UI)* The **Install details** modal (`.software-install-details-modal`) opens with a status line containing **"installed <title> (<package file>) on <host display name>"**.
   - ☐ Click **Close**. ✅ *(UI)* The modal is hidden.
8. ☐ (No user action) ✅ *(API)* The host's newest `installed_software` activity for the title is newer than the one baselined before the click — this install recorded its own.
   ☐ Reload the host page → in the **Activity** card, click the **Past** tab → click the **first** (newest) item matching "… installed <title> on this host." (word boundary, so not "uninstalled").
   - ✅ *(UI)* **Past** is selected; the Install details modal opens with **"installed <title> (<package file>)"**.
   - ☐ Click **Close**. ✅ *(UI)* hidden.
9. ☐ Reload the host page → **Software** → **Inventory** tab → type the **inventory name** in **Search by name or vulnerability (CVE)** (the title's name — `7-zip` for the linked `.exe`; `7-Zip 26.01 (arm64)` while it's unlinked).
   - ✅ *(UI)* A Name-column link reading exactly the inventory name is visible — `HostDetailsPage.softwareNameLink()`.

   **`uninstall` step**
10. ☐ Reload the host page → **Software** → **Library** → search the title → click **Uninstall**.
    - ✅ *(UI)* Toast **"Software is uninstalling. To see details, go to Details > Activity."**
    - ✅ *(API)* The host's status for the title is `pending_uninstall`.
11. ☐ Wait for the status to clear, then as step 5 — `waitForSoftwareSettled(…, null, { inventoryName })`.
    - ✅ *(API)* Status clears to `null` (≤ 5 min); a post-status refetch lands; the inventory no longer lists it (the title's installed versions, or the host's inventory by `7-Zip 26.01 (arm64)`).
12. ☐ Reload the host → **Software** → **Library** → search the title.
    - ✅ *(UI)* **Installed version** reads `---`.
    - ✅ *(UI)* The install-side button reads **Install**.
    - ✅ *(UI)* No **Uninstall** button on the row (`toHaveCount(0)`).
13. ☐ Reload the host → **Software** → **Inventory** → search the inventory name.
    - ✅ *(UI)* The table's **empty state** is visible — under a search it only appears once the filtered result came back empty, since a real host always reports some software.
    - ✅ *(UI)* No Name-column link reading exactly the inventory name (`toHaveCount(0)`).
14. ☐ (No user action) ✅ *(API)* The host's newest `uninstalled_software` activity for the title is newer than the one baselined before the click.
    ☐ Reload the host → **Activity** → **Past** → click the first (newest) item matching "uninstalled <title> on this host."
    - ✅ *(UI)* The **Uninstall details** modal (`.software-uninstall-details-modal`) opens with **"uninstalled <title> from <host display name>"**.
    - ☐ **Close**. ✅ *(UI)* hidden.
15. ☐ (No user action) `finally` — `ensureVmFixtureUninstalled` (a no-op after a pass). The title stays.

**Assessment**
- *Value:* the area's backbone, and a better one than the three tests it replaced. Every package type the suite installs — four custom (including the `.exe`, in whichever linkage state Fleet reports) and a Fleet-maintained app on **both** macOS and Windows — goes install → verify → uninstall → verify on a real device, each half checked on the same four surfaces: the Library row's state machine (`---` / Install → Reinstall + installed version → `---` / Install, no Uninstall), the details modal, the host's Past activity, and the **Inventory tab**.
  - **The Inventory tab is checked both ways, for all six.** This closes the old SWH-01 gap, where the Inventory tab was never opened after a `.pkg`, `.msi` or FMA install and "lands in its inventory" was proved only by API and the Library's derived column.
  - **FMA uninstall and Windows FMA install are new coverage.** SWH-02 only ever installed Itsycal and removed it silently in a `finally`; nothing installed a Windows FMA.
  - **Durable titles make cleanup deterministic.** Fleet always knows whether each fixture is on its VM, so the preflight can put a dead run's install right by uninstalling it, instead of hoping the next run's pre-clean catches it before the title is deleted — and it runs again at `cleanup-teardown`, so a timed-out test (whose `finally` Playwright skips) is healed in the same run.
  - **Half the host round-trips.** SWH-01 + SWH-04 did two installs and two uninstalls per platform (one of each silently, in cleanup or setup); this does one of each, all asserted.
- *Coverage gaps:*
  - **Adding and installing are no longer one flow.** A package uploaded through **Add software** reaching a device is now proved only by SWH-03 (`.deb`, via the Deploy policy); the fixtures here are added by gitops, and the UI add is SWL-01 on fleets with no real hosts. They share Fleet's installer store, so the risk is small, but the catalog **Add** → install path on one title (old SWH-02's `expectNotAddedFor` precondition) is gone.
  - **The library version is checked against the API's own reading**, not against the version the fixture is known to carry (`1.0.0` for the three inert packages). A Fleet parse that got the version wrong would be reported identically by the API and the UI and pass here.
  - The **Details** toggles in both modals (the scripts' output) are never opened. The dashboard-wide activity feed is not checked (only the host's). The Upcoming item is deliberately unasserted (intro §6).
- *Redundancy:* the Linux row and SWH-06 both install a `.deb` on the Ubuntu VM, wait for the same settle and look at the Inventory tab; SWH-06's unique content is now the pre-install absence, the exact one-row count, and the version and type columns (see Duplication).
- *Efficiency / smells:*
  - ~~⚠️ **The Past-activity checks couldn't tell this run's item from last night's.**~~ **Fixed 2026-09-28:** each half baselines the host's newest matching activity through the API before acting and requires a newer one after (server timestamps, so no clock skew), before the UI clicks the newest item. Original finding: The titles are durable, so every run — and every preflight uninstall — writes an item with the same wording and the same modal text. `.first()` takes the newest, which after a settled install *is* this run's in practice, but if Fleet stopped recording the activity the previous run's item would satisfy both steps 8 and 14. The fix is cheap: assert the item's relative time reads "less than a minute ago" / "… minutes ago", or read `GET /hosts/:id/activities` for an entry newer than the click.
  - ~~⚠️ **The Inventory absence check (step 13) could pass before the search landed.**~~ **Fixed 2026-09-28:** it now waits for the table's empty state (`HostDetailsPage.softwareEmptyState`), which a real host's unfiltered table never shows, so it can only pass on the filtered, empty result. Original finding: `openInventory` fills the search box and returns; `softwareRowOrEmpty()` then resolves on the *unfiltered* table's first row, and `toHaveCount(0)` passes at once unless the fixture happens to be on that page. The API wait in step 11 is what really proves absence. Waiting for the search's response (or for the "N items" count to change) before the negative assertion would make it bite. Inherited from the old SWH-04, which had the same code.
  - ~~**The `.exe` row's Library expectations are mostly non-discriminating.**~~ **Partly resolved 2026-09-28:** since Fleet's Windows-title reconcile linked the durable 7-Zip title, its Installed version shows `26.01` after the install and `---` after the uninstall like every other row; only a freshly created (unlinked) title falls back to the DisplayName reading. Original finding: Its Installed version reads `---` before the install, after it and after the uninstall; the **Reinstall** / **Installed** status button after the install and **Install** / no **Uninstall** after the uninstall come from Fleet's install record, not from the host. The host-side proof for this row is the Inventory tab by DisplayName (steps 9 and 13) — so the step-13 race above matters most here.
  - **The 900 s budget is a typical-case budget.** `waitForSoftwareSettled`'s worst case is 300 + 240 + 2 × (240 + 60) s ≈ 19 min per half, twice, against 15 min; a normal half takes 3–5 min. A slow VM ends as a test timeout, which skips the `finally` — harmless now that the preflight/teardown uninstalls the fixture, but it reads as a timeout rather than naming the wait that hung.
  - **Six tests contend for three VMs.** The Windows VM carries three of them (`.msi`, `.exe`, DB Browser — six queued round-trips) plus SWH-09/13, and every test's `waitForNoPendingRefetch` waits out the refetches its neighbours triggered. At CI's two workers it's bounded; at `--repeat-each` or four workers it's the queue-depth failure mode of 2026-09-28 again (Bigger bets 1).
  - The `pending_install` / `pending_uninstall` reads are one-shot right after the toast — deterministic in practice (orbit polls, so there are seconds before pickup), but an idle VM finishing a tiny `.deb` before the GET lands would fail them.
  - `VM_SOFTWARE_FIXTURES` and `vms.yml` must name the same packages; nothing checks they agree except this test failing with the "re-apply vms.yml" message when one is missing. A fixture added to `vms.yml` but not to the list is simply never tested.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWH-01 · Premium • Software • Install on host › a {macOS .pkg, Windows .msi, Linux .deb} added in the UI installs on the VM and lands in its inventory

> **Retired 2026-09-28** — the test no longer exists. Installing each package type from the host's Library,
> with the Library / details-modal / Past-activity checks it made, is **SWH-14** — now with the Inventory tab
> opened after the install and the `.exe` included, on durable titles instead of per-run uploads. Adding a
> custom package through **Add software** is area 06's **SWL-01** (no host); SWH-03 still adds one through the
> form before its policy installs it. The open points of this entry's assessment that still apply (library
> version from the API, modal **Details** unopened, one-shot `pending_install`) moved to SWH-14.

---

### SWH-02 · Premium • Software • Install on host › a Fleet-maintained app added from its catalog page installs on the macOS VM

> **Retired 2026-09-28** — the test no longer exists. Installing a Fleet-maintained app on a VM is **SWH-14**'s
> two FMA rows (Itsycal on macOS, now durable on the VMs fleet via `vms.yml`, and DB Browser for SQLite on
> Windows), which also uninstall it and check the Inventory tab. Adding one from the catalog is area 06's
> **SWL-01** (Airtame, 7-Zip; no host). What went with it: the catalog's "not added yet" precondition
> (`expectNotAddedFor`) and the add → install on one title; `OWN_FMA_TITLES` left the cleanup sweep with it.

---

### SWH-03 · Premium • Software • Install on host › "Deploy" creates an install policy, and Fleet installs through it on the Linux VM

- **File:** [`playwright/tests/e2e/premium/software/install-on-host.spec.ts`](../../tests/e2e/premium/software/install-on-host.spec.ts)
- **Grep:** `npm run test:premium -- -g 'creates an install policy, and Fleet installs through it'`
- **Project:** premium · **Scope:** the **VMs** fleet · **Host:** the real Ubuntu VM
- **Mode:** UI+API · **Isolation:** parallel; **timeout 900 s** (`test.setTimeout`) — the file's only test since 2026-09-28; `finally` deletes the policy first, then `removeTitleFromHost` (uninstall if the host has it, wait for the status to clear — **not** for the refetch — then delete the title)
- **Preconditions:** online real Ubuntu VM
- **Data created:** a per-run `fleet-pw-deploy-<base36>` `.deb` title, the policy **`[Install software] fleet-pw-deploy-<base36> (deb)`** on the VMs fleet, and the package on the VM — all removed in `finally` (the sweep also matches both names, and purges the package from the VM). It can't be one of the durable fixtures: the test adds the title and a policy that points at it. The `.deb` is written under the test's output dir.

**Flow**

1. ☐ (No user action) Build `fleet-pw-deploy-<base36>_1.0.0_all.deb`.
2. ☐ Dashboard → **Software** → fleet **VMs** → **Add software** → **Custom package** tab.
3. ☐ Choose the file. Once it is chosen, a **Deploy** switch appears — turn it **on**. Click **Add software**.
   - ✅ *(UI)* The Deploy switch reads `aria-checked="true"` (it has no accessible name; it is found through its slider wrapper).
   - ✅ *(UI)* Redirect to `/software/titles/<id>`; `/successfully added/` toast.
   - ✅ *(UI)* The title heading reads the package name.
4. ☐ Open **Policies** → fleet **VMs** and find the new policy *(the spec does this by API)*.
   - ✅ *(API)* A policy named exactly `[Install software] <name> (deb)` exists on the VMs fleet.
5. ☐ Open the dashboard and look at the activity feed.
   - ✅ *(UI)* An item reading **"… created a policy [Install software] <name> (deb)."** — with **no** "on the VMs fleet" suffix (intro §7). `DashboardPage.expectActivity` walks up to 15 pages and reloads up to 10 times for a late activity.
6. ☐ On the Ubuntu VM's page click **Refetch** — the refetch runs the fleet's policies, the new policy fails (the package is missing) and its automation queues the install *(the spec asks for the refetch by API)*.
   - ✅ *(API)* The host's status for the title reaches `installed` (≤ 7 min).
7. ☐ Open the VM's details page → **Activity** → **Past**.
   - ✅ *(UI)* An item matching "installed <name> on this host." is visible.
   - ✅ *(UI)* Its accessible name **starts with "Fleet installed"** — the actor is Fleet, not the admin: the install came from the policy, not a click.
8. ☐ (No user action) `finally` — delete the policy (a title an install policy points at can't be deleted), uninstall from the VM, delete the title.

**Assessment**
- *Value:* the only coverage of **Deploy** and of the policy-driven install path anywhere in the suite, and step 7's "Fleet installed" is exactly the right discriminator — it proves the install came through the automation rather than through something a test clicked. Step 5 also pins a real product inconsistency (the fleet-less `created_policy`) rather than papering over it.
- *Coverage gaps:* the policy is found by API, never looked at in the **Policies** UI (its install-software automation, its query, its fleet). Nothing checks the policy **passes** after the install — the other half of "the automation closed the loop". The Library row and the Inventory are not checked (status only, by API). Deploy on a `.pkg` / `.msi` is not covered.
- *Redundancy:* none. Since 2026-09-28 it is also the only test that takes a package **added through the Add software form** onto a device (SWH-14's fixtures come from gitops).
- *Efficiency / smells:*
  - The activity assertion encodes a behaviour that is **on the decision list** as a possible defect. If Fleet adds the suffix, this fails and the fix is to the regex; worth a comment pointing at the decision if it becomes an issue.
  - The Deploy switch is a class-scoped locator (`.software-deploy-slider__container`) — justified in the POM (Fleet's `Slider` names nothing), but a candidate for the preflight watch list.
  - It relies on a refetch triggering a policy run; if Fleet ever decouples those, the 7-minute wait becomes "the next scheduled policy run", which can be an hour.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWH-15 · Premium • Software • Deploy install retries › a Deploy whose install fails is tried 3 times, then reads Failed

- **File:** [`playwright/tests/e2e/premium/exclusive/software/deploy-install-retries.spec.ts`](../../tests/e2e/premium/exclusive/software/deploy-install-retries.spec.ts)
- **Grep:** `npx playwright test --project=premium-exclusive deploy-install-retries` (by file name)
- **Project:** `premium-exclusive` — alone after the main project: a policy's installs queue at priority 0, below every user-requested one, and each failed install script backs orbit off for 1, 2, 4… min (fleetdm/fleet#54607) · **Host:** the Ubuntu VM · **Timeout:** 15 min, CI `HOST_RETRIES`
- **Mode:** UI+API · **Source:** QA Wolf `policies/software-installs-retry-up-to-3-times-when-triggered-by-a-policy-automation` (round 2, batch G)
- **Preconditions (API):** a per-run `fleet-pw-deploy-fails-<stamp>` `.deb` built for **amd64**, uploaded to the VMs fleet with Deploy (`automatic_install`) — the aarch64 VM's dpkg refuses it, so every attempt fails without touching the host, and the package never arriving keeps Fleet's `[Install software] … (deb)` policy failing.
- **Data created:** the package and its policy, deleted in the `finally` (policy first, any queued attempt cancelled); the VMs sweep removes `[Install software] fleet-pw-*` policies and `fleet-pw-*` titles a dead run leaves.

**Flow**

1. ☐ *(API)* The `[Install software] <title> (deb)` policy exists on the VMs fleet.
2. ☐ *(API)* Wait out any refetch in flight, request one.
   - ✅ *(API)* once nothing is queued for the title, exactly **3** `installed_software` activities for it, all `failed_install`, each carrying the install policy's id and an empty actor (Fleet installed, no user); the host's status for the title settles at `failed_install`.
3. ☐ Host details → Activity → **Past**.
   - ✅ *(UI)* the newest item for the title reads *"Fleet failed to install `<title>` on this host."*
4. ☐ Host details → Software → **Library**, filtered to the title.
   - ✅ *(UI)* its status button reads **Failed**.

**Assessment**
- *Value:* the failure twin of SWH-03, and the only test of a policy-queued install's retries — a different path in Fleet from a direct install's (SWH-07): `shouldRetryPolicyAutomationSoftwareInstall`, which also needs the policy still failing and counts failures per host and installer (10 in 24 h, then Fleet stops — which is why the package is new every run).
- *Coverage gaps:* the 10-failure cap itself isn't reached (it would take four runs of three); a retry that succeeds isn't exercised; continuous automations for installs (re-fire on every failing result unless the last install succeeded within the policy interval) aren't — POL-27 covers continuous for scripts.
- *Efficiency:* three failed installs on the Ubuntu VM — dpkg refuses each at once, but each also puts orbit into its backoff (1, then 2 min), which is why the spec runs alone in `premium-exclusive`.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWH-04 · Premium • Software • Uninstall from host › a {macOS .pkg, Windows .msi, Windows .exe, Linux .deb} uninstalls from the VM and leaves its inventory

> **Retired 2026-09-28** — the test no longer exists. A clean uninstall of every package type, checked in the
> API, the Library, the Inventory tab and the Uninstall details modal, is **SWH-14**'s `uninstall` step — for
> the same four types plus both FMAs, on durable fixtures installed by the test's own `install` step rather
> than by an API precondition. Its uninstall-role fixtures (`fleet-playwright-uninstall-1.0.0.{pkg,msi}`) were
> deleted; the `.exe` scripts moved into gitops (`gitops/lib/platforms/windows/software/7-zip-*.ps1`). The
> failing uninstall stayed in `uninstall-from-host.spec.ts` as SWH-05.

---

### SWH-05 · Premium • Software • Uninstall from host › an uninstall that fails leaves the software installed, and the Library offers a retry

- **File:** [`playwright/tests/e2e/premium/software/uninstall-from-host.spec.ts`](../../tests/e2e/premium/software/uninstall-from-host.spec.ts)
- **Grep:** `npm run test:premium -- -g "an uninstall that fails leaves the software installed"`
- **Project:** premium · **Scope:** the **VMs** fleet · **Host:** the real Ubuntu VM
- **Mode:** UI+API · **Isolation:** parallel; describe timeout 600 s; `finally` queues an ad-hoc `apt-get remove --purge` on the VM **without waiting**, then deletes the title
- **Preconditions:** online real Ubuntu VM
- **Data created:** a per-run `fleet-pw-uninstall-fails-<base36>` title whose uninstall script is `echo "refusing to uninstall"; exit 1`, installed on the VM. Removed from the host by the ad-hoc script, title deleted. **See the intro's manual-cleanup note — Fleet's own uninstall of this title fails by construction.**

**Flow**

1. ☐ *(API setup, inline in the test)* Upload `fleet-pw-uninstall-fails-<base36>_1.0.0_all.deb` with the
   uninstall script `#!/bin/sh` / `echo "refusing to uninstall"` / `exit 1` (`uploadSoftwarePackageBuffer`,
   before the `try`); inside the `try`, queue the install (`installSoftwareOnHost`) and wait for it to settle —
   `waitForSoftwareSettled(…, 'installed')`: status `installed`, no refetch outstanding, a post-status refetch,
   inventory present.
   - ✅ *(API)* The host's inventory lists it (*"host <id>'s inventory never showed title <id> present after installed"* otherwise).
   - **By hand:** add the package through Add software on the VMs fleet with that uninstall script (Advanced options), install it from the VM's Library, wait for **Installed** and a refetch.
2. ☐ Host details → **Software** → **Library** → search the name → click **Uninstall**.
   - ✅ *(UI)* Toast "Software is uninstalling. To see details, go to Details > Activity."
3. ☐ Wait for the uninstall to fail, then **Refetch** and wait for "Last fetched" to move.
   - ✅ *(API)* Status reaches `failed_uninstall`; after a post-status refetch the inventory still lists it.
   - ✅ *(API)* Installed versions are exactly `['1.0.0']`.
4. ☐ Reload the host → **Software** → **Library** → search the name.
   - ✅ *(UI)* **Installed version** reads `1.0.0`.
   - ✅ *(UI)* The Status cell shows an **Installed** button — the software is still there.
   - ✅ *(UI)* The uninstall side reads **Retry uninstall**; the install side reads **Reinstall**.
5. ☐ Reload the host → **Activity** → **Past** → click the newest item matching "failed to uninstall <name> on this host."
   - ✅ *(UI)* The Uninstall details modal opens; its status line contains "uninstall <name> from <host display name>".
   - ☐ Click **Details**.
   - ✅ *(UI)* The revealed script output contains **"refusing to uninstall"**.
   - ☐ **Close**. ✅ *(UI)* hidden.
6. ☐ (No user action) `finally` — queue `apt-get remove --purge --assume-yes <name>` as an ad-hoc script on the VM (fire-and-forget), delete the title.

**Assessment**
- *Value:* the failure contract, asserted on every surface that could lie about it: status, inventory after a *fresh* read, the Library's version and both retry affordances, and the script's own output in the modal. It is also the flow that exposed `software_updated_at`'s semantics (it never moves after a failed uninstall), which is why the whole area waits on `detail_updated_at`.
- *Coverage gaps:* the **Inventory tab** is not opened — "still installed" is proved by API and the Library only (SWH-14 opens it for the success case). **Retry uninstall** is asserted visible, never clicked. Only Linux.
- *Redundancy:* none. It needs its own per-run package because it gives the title a failing uninstall script — a durable fixture's would carry that into every other run.
- *Efficiency / smells:*
  - **The cleanup is unverified.** The ad-hoc purge is queued and not awaited, and the title is deleted in the same breath; if the script fails (or the VM's queue drops it), the package stays on the Ubuntu VM with no title to show for it and nothing in this test reports it. ~~The sweep would never catch it either — it deletes titles, it doesn't uninstall.~~ **Partly fixed 2026-09-28:** the next premium run's sweep now purges any `fleet-pw-*` package the Ubuntu VM's inventory still lists, so a dropped purge is healed by the next run — though still never reported.
  - The modal's status assertion is the loose substring "uninstall <name> from <host>" — it matches "uninstalled …" as well as "failed to uninstall …", so the *failure* wording is carried by the activity matcher in step 5, not by the modal.
  - Showing an **Installed** status after a failed uninstall is Fleet's current UX, verified live; a manual re-runner should judge whether it reads well (the failure is only visible in the Retry uninstall label and the activity).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWH-06 · Premium • Software • Inventory reflects installs › a package that installs appears in the Inventory once the host re-reports

- **File:** [`playwright/tests/e2e/premium/software/inventory-reflects-install.spec.ts`](../../tests/e2e/premium/software/inventory-reflects-install.spec.ts)
- **Grep:** `npm run test:premium -- -g "a package that installs appears in the Inventory once the host re-reports"`
- **Project:** premium · **Scope:** the **VMs** fleet · **Host:** the real Ubuntu VM
- **Mode:** UI+API · **Isolation:** parallel; describe timeout 900 s; `finally` → `removeTitleFromHost`
- **Preconditions:** online real Ubuntu VM (`requireRealHost` throws `no online real linux VM on <url> …` otherwise)
- **Data created:** a per-run `fleet-pw-inventory-<base36>` **2.4.0** title, installed on the VM; removed in `finally`.

**Flow**

1. ☐ *(API setup)* Upload `fleet-pw-inventory-<base36>_2.4.0_all.deb` to the VMs fleet.
2. ☐ Host details → **Software** → **Inventory** → type the name in **Search by name or vulnerability (CVE)**.
   - ✅ *(UI)* The table settles (first row or empty state visible).
   - ✅ *(UI)* No name link for the package — *offered in the Library, but not software the host has*.
3. ☐ *(API)* Queue the install; wait for `installed` + refetch + inventory present. By hand: install it from the Library and refetch.
   - ✅ *(API)* Installed versions are exactly `['2.4.0']`.
4. ☐ Reload the host → **Software** → **Inventory** → search the name.
   - ✅ *(UI)* Exactly **one** row whose name link is the package name.
   - ✅ *(UI)* The row contains **2.4.0** and **Package (deb)**.
5. ☐ (No user action) `finally` — uninstall, delete the title.

**Assessment**
- *Value:* the positive half of the Library-vs-Inventory contract and the one place the **Inventory tab** is looked at after an install, with the row's version *and* type column checked. The non-default version (2.4.0) is a nice touch — it can't be confused with any other fixture's 1.0.0.
- *Coverage gaps:* the Library is not looked at; the install is by API (SWH-14 covers the Library install). Only `.deb` — SWH-14 now covers the Inventory tab after a `.pkg`, `.msi`, `.exe` and both FMAs.
- *Redundancy:* **largely SWH-14's Linux row.** Both install a `.deb` on the Ubuntu VM, wait for the same settle and look at the Inventory tab. What this test still adds: the pre-install absence (step 2), the **exact one-row** count, and the row's **version and type** columns — all of which would fit into SWH-14's step 9 (the durable fixture's `1.0.0` is fixed and known), making this test a candidate to drop and saving one install + refetch cycle (≈ 3–5 min) on the busiest VM.
- *Efficiency / smells:*
  - The row locator is built inline in the spec (`softwareRows.filter({ has: page.getByRole('link', …) })`, with a comment on why `has` must not be rooted at the table). `HostDetailsPage` has `softwareNameLink(name)` but no `softwareRow(name)`; the inline comment is the sign it belongs in the POM.
  - Step 2 is close to unfalsifiable — a brand-new name has never been installed anywhere. It guards the specific regression of Fleet listing Library titles in Inventory, which is legitimate, but it is the cheap half.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWH-07 · Premium • Software • Inventory reflects installs › a pending or failed install never appears in the Inventory, through every retry

- **File:** [`playwright/tests/e2e/premium/software/inventory-reflects-install.spec.ts`](../../tests/e2e/premium/software/inventory-reflects-install.spec.ts)
- **Grep:** `npm run test:premium -- -g "a pending or failed install never appears in the Inventory"`
- **Project:** premium · **Scope:** the **VMs** fleet · **Host:** the real **aarch64** Ubuntu VM
- **Mode:** UI+API · **Isolation:** parallel; describe timeout 900 s; `finally` waits (≤ 5 min, errors swallowed) for `failed_install` to stick, then deletes the title
- **Preconditions:** online real Ubuntu VM
- **Data created:** a per-run `fleet-pw-precondition-<base36>` title (arch `all`) with a **pre-install query that returns no rows** (`SELECT 1 WHERE 1 = 0;`). No install script ever runs, so nothing reaches the host. Deleted in `finally`.

**Flow**

1. ☐ *(API setup)* Upload `fleet-pw-precondition-<base36>_1.0.0_all.deb` with **Advanced options → Pre-install query** `SELECT 1 WHERE 1 = 0;`. (Not a package dpkg refuses: a failed install *script* backs orbit off for up to 5 min and stalls everything queued on the VM, fleetdm/fleet#54607; a failed pre-install query doesn't.)
2. ☐ Host details → **Software** → **Library** → search the name → click **Install**.
   - ✅ *(UI)* Toast "Software is installing. To see details, go to Details > Activity."
3. ☐ **Straight away**, reload the host → **Software** → **Inventory** → search the name.
   - ✅ *(UI)* The table settles; no name link for the package.
   - ✅ *(API)* The status is **still** `pending_install` — confirming the Inventory read in the step above happened inside the pending window, not after it.
4. ☐ Wait — **a minute or two**. Fleet tries three times (`MaxSoftwareInstallAttempts`), reporting pending between attempts; each stops at the pre-install query. Then **Refetch** and wait for "Last fetched" to move.
   - ✅ *(API)* Status reaches `failed_install` (≤ 10 min); after a post-status refetch, installed versions are `[]`.
   - ✅ *(API)* The host's activities (newest 50) hold exactly **three** `installed_software` entries for this title, each with status `failed_install`.
5. ☐ Reload the host → **Software** → **Inventory** → search the name.
   - ✅ *(UI)* Still no name link.
6. ☐ Reload the host → **Software** → **Library** → search the name.
   - ✅ *(UI)* The Status cell shows a **Failed** button.
   - ✅ *(UI)* The install-side button reads **Retry**.
7. ☐ (No user action) `finally` — wait for `failed_install` if not already there, delete the title.

**Assessment**
- *Value:* the best-designed failure in the area. The failure is **deterministic and harmless** (the pre-install query stops every attempt before the install script, so nothing touches the host — and orbit isn't put into the backoff a failed install script causes), the pending-window read is *proved* to be inside the window by reading the status after it, and the three-attempt assertion documents a Fleet behaviour (`MaxSoftwareInstallAttempts`) that would otherwise surprise every manual tester.
- *Coverage gaps:*
  - **The failure's reason is never read.** The **Failed** button opens the Install details modal with the pre-install query's empty result — the one assertion that would tell this failure from any other. `InstallDetailsModal.revealOutput()` exists.
  - **Retry** is asserted visible, never clicked. The per-attempt activities are asserted via API only, not as three items in the host's Past tab.
- *Redundancy:* none.
- *Efficiency / smells:*
  - **The exact count of three pins a Fleet constant.** Deliberate — but if `MaxSoftwareInstallAttempts` changes this fails on the count with a message about activities, not about retries. Worth a comment naming the constant at the assertion.
  - `listHostActivities` reads the newest **50**. The Ubuntu VM carries six parallel tests from this area plus the script specs; a busy window could push an attempt past 50 within the minute or two.
  - **Budget:** 600 + 240 + 120 s of waits inside a 900 s timeout, after an upload and an Inventory round-trip. A slow day ends in a timeout, and a timeout skips the `finally`.
  - The `finally` itself can add 5 min to a failing run (it waits for the retries to finish before deleting).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWH-08 · Premium • Software • Update on host › a package the library moves ahead of is offered Update, and only then

- **File:** [`playwright/tests/e2e/premium/software/update-on-host.spec.ts`](../../tests/e2e/premium/software/update-on-host.spec.ts)
- **Grep:** `npm run test:premium -- -g "a package the library moves ahead of is offered Update, and only then"`
- **Project:** premium · **Scope:** the **VMs** fleet · **Host:** the real Ubuntu VM
- **Mode:** UI+API · **Isolation:** parallel; describe timeout 600 s; `finally` → `removeTitleFromHost`
- **Preconditions:** online real Ubuntu VM
- **Data created:** a per-run `fleet-pw-update-<base36>` title whose package is replaced twice (0.9.0, then 1.1.0); installed on the VM at 1.0.0 and updated to 1.1.0. Removed in `finally`.

`expectLibraryAction(title, expected, { installed, library })` below means: reload the host → **Software** →
**Library** → search the title, then ✅ *(UI)* **Installed version** reads `installed`, ✅ *(UI)* **Library
version** reads `library`, ✅ *(UI)* the `expected` button (Update / Reinstall) is visible, ✅ *(UI)* the other
one is **not** offered (`toHaveCount(0)`).

**Flow**

1. ☐ *(API setup)* Upload `fleet-pw-update-<base36>_1.0.0_all.deb`, install it, wait for `installed` + refetch + inventory present.
2. ☐ Look at the Library row — **level**.
   - `expectLibraryAction(…, 'Reinstall', { installed: '1.0.0', library: '1.0.0' })`.
3. ☐ Replace the title's package with **0.9.0** (by hand: title → **Edit software** → choose the 0.9.0 file → Save; the spec does `PATCH /software/titles/:id/package`). The title keeps its id.
   - `expectLibraryAction(…, 'Reinstall', { installed: '1.0.0', library: '0.9.0' })` — **library behind the host: still no Update.**
4. ☐ Replace the package with **1.1.0**.
   - `expectLibraryAction(…, 'Update', { installed: '1.0.0', library: '1.1.0' })` — **library ahead: now Update.**
5. ☐ Click **Update** on the row.
   - ✅ *(UI)* The same install toast ("Software is installing. …") — Update queues an ordinary install of the current package.
6. ☐ Wait for installed, **Refetch**, wait for the inventory to report **1.1.0** (compared zero-padded).
   - ✅ *(API)* Installed versions are exactly `['1.1.0']`.
7. ☐ Look at the row again — **level after the update.**
   - `expectLibraryAction(…, 'Reinstall', { installed: '1.1.0', library: '1.1.0' })`.
8. ☐ (No user action) `finally` — uninstall, delete the title.

**Assessment**
- *Value:* the **deterministic** statement of the Update contract, on demand, with a fixed oracle (literal versions, not a re-implemented comparator): level → Reinstall, library behind → Reinstall, library ahead → Update, updated → level. Each state asserts both that the right button is there *and* that the wrong one isn't, which is the shape that catches a UI offering both. The companion to SWH-09, which depends on the vendor.
- *Coverage gaps:* the package swaps go through the API, not **Edit software** — the UI path by which a customer actually moves the library ahead is untested here. Only `.deb` on Linux: no deterministic Windows case for the zero-padding rule (`2.7032.0.0` vs `2.7032.0`), which only SWH-09 touches, and only on the days it happens to apply. **Reinstall with the library behind the host** (a downgrade) is asserted as the offered action but never clicked, so what it does is unknown. The Update's details modal / activity are not checked.
- *Redundancy:* none — it is the reference the Claude tests lean on.
- *Efficiency / smells:* clean. `expectLibraryAction` is a good local helper; it reloads the host each time, which is what makes each state a fresh render rather than a mutated one.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWH-09 · Premium • Software • Update on host › Claude › Claude on the {darwin, windows} VM offers Update exactly when the library is ahead of it

- **File:** [`playwright/tests/e2e/premium/software/update-on-host.spec.ts`](../../tests/e2e/premium/software/update-on-host.spec.ts)
- **Grep:** `npm run test:premium -- -g "offers Update exactly when the library is ahead of it"` (two runtime tests: `Claude on the darwin VM offers Update exactly when the library is ahead of it`, `Claude on the windows VM offers Update exactly when the library is ahead of it`)
- **Project:** premium · **Scope:** the **VMs** fleet · **Host:** the real macOS / Windows VM
- **Mode:** UI+API · **Isolation:** **serial** describe `Claude`, five tests in this order: darwin SWH-09 → darwin SWH-13 → windows SWH-09 → windows SWH-13 → SWH-10 — because SWH-10 pins the title these read and SWH-13's update changes what they see. A failure in the darwin run **skips every test after it**.
- **Preconditions:** an online real VM of the platform (`requireRealHost`); Claude (`claude/darwin`, `claude/windows`) is on the VMs fleet — *"Claude is missing from the VMs fleet — re-apply gitops/premium-fleetqa/fleets/vms.yml"* otherwise; Claude is **installed** on the VM — *"… its 'Claude is installed' policy reinstalls it at the VM's next policy run (a refetch triggers one)"* otherwise. Both checks live in the `claudeOn()` helper SWH-09, SWH-10 and SWH-13 share.
- **Data created:** none — it only reads. Taking the Update is SWH-13's job.

**Flow**

1. ☐ (No user action) `claudeOn()`: resolve the VM; find the Claude Fleet-maintained title for the platform (by name **and** platform — the two are separate titles with the same name).
   - ✅ *(API)* Claude is on the VMs fleet.
   - ✅ *(API)* The VM reports at least one installed Claude version.
   - Records a `claude-state` annotation on the test (`installed <versions>, library <version>`).
2. ☐ (No user action) Decide the state: **behind** iff any installed version is below the library version by Fleet's zero-padded rule (`isBehind`, over `compareVersions` from [`helpers/api/software.ts`](../../helpers/api/software.ts)).
3. ☐ Host details → **Software** → **Library** → search **Claude**.
   - ✅ *(UI)* **Library version** equals the API's.
   - ✅ *(UI)* **If behind:** **Update** is offered and **Reinstall** is not. **Otherwise:** **Reinstall** is offered and **Update** is not.

**Assessment**
- *Value:* the contract on a **real, vendor-moved** Fleet-maintained app on the two platforms the deb pair can't reach, and the only place Windows' four-segment versions meet a three-segment library. The precondition messages are exemplary: each tells the reader exactly how to restore the fixture.
- *Coverage gaps:*
  - ~~**Which branch runs is decided by the calendar.**~~ **Partly fixed 2026-09-28:** the update is its own test, SWH-13, which skips on a level day with the versions in the reason — so the report now shows whether the Update path ran (pass) or not (skip) without reading an annotation. What is left is the calendar itself: this test checks Update-offered only on a behind day, and SWH-13 only runs then. Original finding: most days the VM is level and only the Reinstall half runs; the Update half runs once per vendor release — the first run after the hourly cron fetches a new build — and then the VM is level again. Both outcomes were green, and only the `claude-state` annotation distinguished them. A regression in the Update branch can sit unnoticed until Claude next ships.
  - **Installed version text is not asserted** here (only Library version), unlike SWH-08 — because a VM can report several versions, or a four-segment one. That leaves the UI's rendering of the installed side on Windows unchecked.
- *Redundancy:* the Reinstall-when-level half duplicates SWH-08 step 2 on a different platform.
- *Efficiency / smells:*
  - ~~**The oracle is a re-implementation.**~~ **Partly fixed 2026-09-28:** `isBehind` now builds on `compareVersions` exported from `helpers/api/software.ts` — the same copy `waitForSoftwareSettled` compares versions with — so the suite holds one copy of the rule instead of two. It is still a copy of Fleet's frontend `compareVersions`, so the finding stands: if the product's rule changes, the test's copy and Fleet disagree and the test fails *for the right reason* — but if both are wrong the same way (a shared misunderstanding of padding, pre-release suffixes), it passes. SWH-08's literal versions are the counterweight; keep them.
  - Serial coupling: a flaky macOS VM costs the Windows assertion too.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWH-13 · Premium • Software • Update on host › Claude › Claude on the {darwin, windows} VM updates to the library's build when it is behind

- **File:** [`playwright/tests/e2e/premium/software/update-on-host.spec.ts`](../../tests/e2e/premium/software/update-on-host.spec.ts)
- **Grep:** `npm run test:premium -- -g "updates to the library's build when it is behind"` (two runtime tests: `Claude on the darwin VM updates to the library's build when it is behind`, `Claude on the windows VM updates to the library's build when it is behind`)
- **Project:** premium · **Scope:** the **VMs** fleet · **Host:** the real macOS / Windows VM
- **Mode:** UI+API · **Isolation:** serial describe `Claude`, each run straight after the same platform's SWH-09 (order under SWH-09).
- **Preconditions:** as SWH-09 (`claudeOn()`: the VM, Claude on the fleet, Claude installed). **Skips** when the VM is not behind, with *"installed <versions> is level with library <version>"* — only a vendor release since the last run puts the host behind, so **most days both runs skip**.
- **Data created:** none durable — **it updates Claude on the VM** (a real app update), which leaves it level for the runs after.

**Flow**

1. ☐ (No user action) `claudeOn()` — the same checks and `claude-state` annotation as SWH-09 step 1.
2. ☐ (No user action) If no installed version is below the library's (`isBehind`), skip with the versions in the reason.
3. ☐ Host details → **Software** → **Library** → search **Claude** → click **Update**.
   - ✅ *(UI)* Install toast.
4. ☐ Wait for installed, **Refetch**, and for the inventory to report the library version — `waitForSoftwareSettled(…, 'installed', { version: <library> })`.
   - ✅ *(API)* After the update, no installed version is below the library's (*"after updating, installed … vs library …"*).
5. ☐ Reload → **Software** → **Library** → search **Claude**.
   - ✅ *(UI)* **Reinstall** offered, **Update** not (`toHaveCount(0)`).

**Assessment**
- *Value:* the only test that takes **Update** on a real, vendor-moved app as it naturally arrives — the path a customer hits after a release — on both platforms, including Windows' four-segment report settling level against a three-segment library. Split out of SWH-09 so a skipped update reads as a skip, not as a pass.
- *Coverage gaps:*
  - **It runs only on a behind day** — once per Claude release, the first run after the hourly cron fetches it. Between releases it has nothing to test, and a regression in Update can sit behind a string of skips. SWH-08 (Linux, on demand) and SWH-10 (macOS, on demand once two builds are cached) are what cover Update between releases; nothing does for Windows.
  - Installed and Library version text are not asserted after the update (only the action), for SWH-09's reason — a VM can report several versions, or a four-segment one.
  - The Update's details modal / activity are not checked.
- *Redundancy:* SWH-10's last step is this update made deterministic on macOS, once SWH-10 runs.
- *Efficiency / smells:*
  - The oracle is `isBehind` over the suite's copy of Fleet's `compareVersions` — see SWH-09.
  - A real app update (~100 MB) on the shared Windows / macOS VM queue on the day it runs, inside the describe's 600 s timeout with `waitForSoftwareSettled`'s 5 + 4 + 2 min budget — the same over-budget shape as SWH-14.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWH-10 · Premium • Software • Update on host › Claude › Claude on the macOS VM: pinned back it is ahead, installed it is level, unpinned it updates

- **File:** [`playwright/tests/e2e/premium/software/update-on-host.spec.ts`](../../tests/e2e/premium/software/update-on-host.spec.ts)
- **Grep:** `npm run test:premium -- -g "pinned back it is ahead, installed it is level, unpinned it updates"`
- **Project:** premium · **Scope:** the **VMs** fleet · **Host:** the real macOS VM
- **Mode:** UI+API · **Isolation:** serial describe, test 5 of 5; `finally` **unpins** (`setPinnedVersion(…, '')`); `cleanup-setup` also clears any pin it finds on QA / VMs, for the timeout case where the `finally` never runs
- **Preconditions:** as SWH-09's `claudeOn()` for darwin — the macOS VM, Claude (darwin) on the VMs fleet, and Claude **installed** on the VM (checked before the skip, so a missing install fails this test even on a skip day); **at least two cached builds** (`fleet_maintained_versions`). **Skips** with *"the VMs fleet has cached one Claude build (…); the walk needs the previous one too"* until the vendor ships again and the hourly cron fetches it. **As of 2026-09-28 it skips** — one build cached. Also refuses to start on a pinned title (*"Claude arrived pinned — an earlier run died before restoring it"*).
- **Data created:** none durable — but it **downgrades Claude on the macOS VM to the previous build and updates it back**. Windows never takes this walk: Claude for Windows is an MSIX, and Windows refuses to provision an older MSIX over a newer one.

**Flow**

1. ☐ (No user action) `claudeOn()` for darwin (as SWH-09 step 1, including the `claude-state` annotation); read the title's cached versions, newest first: `[newest, previous]`.
   - ✅ *(API)* Claude is on the fleet and installed on the VM; the title is **not** pinned.
2. ☐ **Pin back.** Title → **Versions** → pick the **previous** build (the spec: `PATCH /software/titles/:id/package` with `version=<previous>`). The host now has a newer build than the library offers.
   - `expectLibraryAction('Claude', 'Reinstall', { installed: <what the host has>, library: previous })` — **host ahead: no Update.**
3. ☐ **Install the previous build** (the spec queues it by API; by hand, click **Reinstall**). Wait for installed, **Refetch**, and for the inventory to report `previous`.
   - ✅ *(API)* Installed versions are exactly `[previous]`.
   - `expectLibraryAction('Claude', 'Reinstall', { installed: previous, library: previous })` — **level.**
4. ☐ **Unpin** (Versions → latest; `version=''`). The library jumps to `newest`; the host is now behind.
   - `expectLibraryAction('Claude', 'Update', { installed: previous, library: newest })` — **behind: Update.**
5. ☐ Click **Update**. Wait for installed, **Refetch**, and the inventory to report `newest`.
   - ✅ *(UI)* Install toast.
   - ✅ *(API)* Installed versions are exactly `[newest]`.
   - `expectLibraryAction('Claude', 'Reinstall', { installed: newest, library: newest })` — **level again.**
6. ☐ (No user action) `finally` — unpin. **By hand, never skip this step.**

(`expectLibraryAction` as defined under SWH-08.)

**Assessment**
- *Value:* the full walk on a real app — ahead, level, behind, updated — made *on demand* from the durable ingredient (two cached builds and an installed copy) instead of waiting for the vendor. The design reasoning (make "behind" per run, never keep it; presence policies, not patch policies) is the most thoughtful fixture design in the batch, and the "arrived pinned" guard stops a stranded pin from being mistaken for a result.
- *Coverage gaps:*
  - **⚠️ It has never run past its skip.** Every green run to date is the skip. The walk — the pin, a macOS downgrade of a real app, the unpin, the update — is unverified end to end; treat its first real execution as an authoring check, not a regression result, and watch it.
  - The pin is set through the API, not the **Versions** modal it mimics; the downgrade is queued by API, not by clicking **Reinstall** in the "ahead" state (which would also cover SWH-08's unclicked downgrade).
- *Redundancy:* its states are SWH-08's states on a real app; its final Update is SWH-13 made deterministic.
- *Efficiency / smells:*
  - Step 2 uses `installedVersions[0]` — it assumes the VM reports exactly one Claude build; a VM with two would make the expected Installed-version text arbitrary.
  - If it dies *after* the downgrade (step 3) and before the update, the `finally` unpins but the VM is left **behind** — which self-heals, since the next run's SWH-13 then finds it behind and takes the Update. Worth knowing when reading the next run's `claude-state` annotation.
  - Three full install+refetch cycles of a real app (~100 MB) on one VM: the longest test in the area once it stops skipping.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWH-11 · Premium • Software • Large installers › a package over the size limit is refused in the browser, before any upload

- **File:** [`playwright/tests/e2e/premium/software/large-upload.spec.ts`](../../tests/e2e/premium/software/large-upload.spec.ts)
- **Grep:** `npm run test:premium -- -g "a package over the size limit is refused in the browser"`
- **Project:** premium · **Scope:** **Workstations** (no host involved)
- **Mode:** UI+API · **Isolation:** parallel; default 60 s timeout; the sparse file is deleted in `finally`
- **Preconditions:** `max_software_package_size` in `GET /config` is > 0 (*"the config reports no max_software_package_size"*). On premium QA it is **10 GiB**.
- **Data created:** none on the instance; a sparse local file (`fleet-pw-over-limit.pkg`, limit + 1 bytes, no disk used), removed.

**Flow**

1. ☐ (No user action) Read the limit from the config and create a sparse file one byte larger. By hand:
   `python3 -c "open('fleet-pw-over-limit.pkg','wb').truncate(<limit> + 1)"`.
   - ✅ *(API)* The limit is a positive number.
2. ☐ Dashboard → **Software** → fleet **Workstations** → **Add software** → **Custom package**.
3. ☐ Choose the file.
   - ✅ *(UI)* An **error** toast: **"Couldn't add. The maximum file size is <limit>."**, the limit formatted the way Fleet's `formatFileSize` does it (four significant digits, whichever of decimal/binary units reads shorter — `10GiB` for 10 GiB). The spec re-implements that formatter.
   - ✅ *(UI)* The form never took the file: the uploader still offers **Choose file** (`uploader.chooseFileButton`), and the file name **`fleet-pw-over-limit.pkg`** appears nowhere on the page (`toHaveCount(0)`).
   - ✅ *(UI)* **Add software** is **disabled** — there is nothing to submit.

**Assessment**
- *Value:* pins that the limit is **per instance** (it reads the config instead of trusting QA Wolf's 1 GiB) and that the check happens **client-side on selection**. The sparse file is a genuinely good trick: a 10 GiB test input that costs no disk and no time, and because the browser rejects it, not a byte is read.
- *Coverage gaps:* the **server-side** enforcement is not tested — an API upload over the limit (or a file that lies about its size) is the enforcement layer, and a UI-only check over a permissive server is the shape worth worrying about. The boundary (exactly the limit, accepted) is not tested — impractical at 10 GiB through the browser, but cheap at the API.
- *Redundancy:* none.
- *Efficiency / smells:*
  - ~~⚠️ **The "nothing was sent" assertion cannot fail as written.**~~ **Fixed 2026-09-28:** the request listener is gone; the test asserts instead that the form never took the file — the uploader still shows **Choose file**, the file name appears nowhere, and **Add software** is disabled — each of which a form that accepted the file would fail. Original finding: an upload is only sent when **Add software** is clicked, and the test never clicked it, so `uploads` was empty whether the browser refused the file or accepted it; the listener documented intent rather than proving it.
  - The formatter is copied from Fleet into the spec; a Fleet formatting change fails this on copy, which is acceptable but worth knowing when it goes red after an upgrade.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWH-12 · Premium • Software • Large installers › a large upload shows its progress and ends in success

- **File:** [`playwright/tests/e2e/premium/software/large-upload.spec.ts`](../../tests/e2e/premium/software/large-upload.spec.ts)
- **Grep:** `npm run test:premium -- -g "a large upload shows its progress and ends in success"`
- **Project:** premium · **Scope:** **Workstations** (no host involved)
- **Mode:** UI · **Isolation:** parallel; timeout 300 s; `finally` deletes the local file and the title (Workstations is also wiped by `cleanup.steps.ts`)
- **Preconditions:** none beyond an instance that will accept ~100 MB (premium QA is a 2 GB Render box — the size is deliberately modest)
- **Data created:** a per-run `fleet-pw-large-<base36>` title on Workstations, deleted in `finally`.

**Flow**

1. ☐ (No user action) Build `fleet-pw-large-<base36>_1.0.0_all.deb`: a valid package holding **100 MiB of random bytes, stored uncompressed** (`compressionLevel: 0`), so it is the full size on the wire and Fleet still accepts it. By hand: the `tsx` one-liner in the intro with `buildDeb({ …, files: [{ path, content: crypto.randomBytes(100 * 1024 * 1024) }], compressionLevel: 0 })`.
2. ☐ Dashboard → **Software** → fleet **Workstations** → **Add software** → **Custom package**; choose the file; click **Add software**.
3. ☐ Watch the upload modal.
   - ✅ *(UI)* The progress modal (`.file-progress-modal`) is visible.
   - ✅ *(UI)* A progress bar titled **upload progress bar** is visible inside it.
   - ✅ *(UI)* The percentage **advances** (polled ≤ 120 s). A reading is the modal's **N%** readout (`SoftwareCustomPackagePage.progressPercent` — matched by its text, `/^\d{1,3}%$/`); **0** while the modal is up but shows no readout (Fleet renders none at 0 %); **100** once the modal is gone. The poll expects a reading above `min(first, 99)`, so an upload that finishes between two readings passes.
4. ☐ Wait for it to finish.
   - ✅ *(UI)* The modal closes (≤ 240 s).
   - ✅ *(UI)* Success toast **"<file name> successfully added."** (exact file name).
   - ✅ *(UI)* Redirect to `/software/titles/<id>`.
5. ☐ (No user action) `finally` — delete the title.

**Assessment**
- *Value:* the QA Wolf "progress indicator appears without timeout" flow, re-scoped sensibly: a real, valid package large enough for the bar to move, small enough not to be a load test, generated rather than committed. Asserting that the percentage *moves* is better than asserting it exists.
- *Coverage gaps:* nothing checks the resulting title (version, size, type) beyond the toast and redirect. Cancelling mid-upload is untested.
- *Redundancy:* the add path is every custom-package upload in the suite; the progress half is unique.
- *Efficiency / smells:*
  - ~~⚠️ **It fails on a fast link.**~~ **Fixed 2026-09-28:** a reading that finds no readout returns 100 once the modal is gone (0 while it is still up), and the poll wants a reading above `min(first, 99)` — so a first reading of 100 %, or a modal that closes between readings, passes instead of timing out. Original finding: if the first reading was already 100 %, or the modal closed before a higher reading landed, `percent()`'s `innerText` on a detached `.file-details__progress-text` threw and the poll retried until its 120 s timeout — a *faster* instance or runner made it flakier.
  - ~~**`.file-details__progress-text` is a class locator with no comment justifying it.**~~ **Fixed 2026-09-28:** the readout is `SoftwareCustomPackagePage.progressPercent`, `progressModal.getByText(/^\d{1,3}%$/)` — reached by its text, scoped to the modal. Original finding: the class locator had no comment justifying it (the bar next to it is reached by title).
  - 100 MiB up through the browser to a 2 GB box while the rest of the suite runs in parallel: cheap as a test, not free as load.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

### SWH-16 · Premium • Software • a host's Library tab › on the {darwin, windows, linux} VM, counts what it offers and adds software on the {Fleet-maintained, Custom package} tab

- **File:** [`playwright/tests/e2e/premium/software/host-library-tab.spec.ts`](../../tests/e2e/premium/software/host-library-tab.spec.ts)
- **Grep:** `npx playwright test --project=premium host-library-tab` (three runtime tests: `on the darwin VM, … Fleet-maintained tab`, `on the windows VM, … Fleet-maintained tab`, `on the linux VM, … Custom package tab`)
- **Project:** premium · **Host:** the real VM of the row's platform, on the **VMs** fleet · **Read-only:** no VM time, nothing added
- **Mode:** UI+API · **Isolation:** one test per VM, independent
- **Source:** QA Wolf `general-library-verify-tab-availability-and-content` (round 1 C5 #13; round 3, batch G), reshaped at review: the flow read the header's static pieces and walked every row's action buttons, which the update, uninstall and inventory specs already act on. Free's side is HOST-27.
- **Preconditions:** the VM online (`requireRealHost`) and on the VMs fleet.

**Flow**

1. ☐ Open the VM's details (`/hosts/<id>`) → **Software** → **Library**.
   - ✅ *(UI)* URL contains `/software/library`; the card's subheader reads **"Software available to be installed on this host"**.
2. ☐ (Reload until a pair agrees, up to 60 s) Read the card's **"N items"**, and count the titles the host is offered (`GET /hosts/:id/software?available_for_install=true`).
   - ✅ *(API)* the VM is offered at least one title.
   - ✅ *(UI vs API)* **"N items"** equals that count. Other specs add and delete per-run `fleet-pw-*` packages on the VMs fleet meanwhile, so a pair read seconds apart can differ; a reload retries it.
3. ☐ Click **Add software** in the card.
   - ✅ *(UI)* macOS and Windows: the URL is `/software/add/fleet-maintained?fleet_id=<VMs>` and the **Fleet-maintained** tab is selected. Linux: `/software/add/package?fleet_id=<VMs>` and **Custom package** is selected.

**Assessment**
- *Value:* The routing is a per-platform decision in the Library card (`onAddSoftware`) that nothing else exercises, and the count is the only check that the card's total is the server's.
- *Coverage gaps:* The **All available / Self service** filter (no VMs-fleet title is self-service, so it would read an empty list), the search box, paging, and the iOS / Android branch (App Store tab), which needs a device the instances lack.
- *Efficiency / smells:* Seconds each. The count comparison retries by reload rather than pinning the fleet's library, which other specs change during a run.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

## Area observations

**Coverage map**

| Feature / user flow | Covered by | Gap |
|---|---|---|
| Custom package → install from the host's Library | SWH-14 (`.pkg` / `.msi` / `.exe` / `.deb`, durable, gitops-added) | `.rpm`, `.tar.gz`, script packages; installs started anywhere but the host's Library |
| Custom package → **UI add** → onto a device | SWH-03 only (`.deb`, through the Deploy policy); the UI add alone is SWL-01 (area 06, no host) | A UI-added `.pkg` / `.msi` / `.exe` installed from the Library |
| Fleet-maintained app → install / uninstall | SWH-14 (Itsycal on macOS, DB Browser for SQLite on Windows) | Self-service; the catalog **Add** → install on one title (catalog add is SWL-01, no host) |
| Deploy / automatic-install policy | SWH-03 (`.deb`) | The policy in the Policies UI; the policy passing afterwards; Deploy for `.pkg` / `.msi` |
| Uninstall | SWH-14 (six types, incl. the unlinked `.exe` and both FMAs) | Uninstall details **Details** output; uninstall started from the title page |
| Failed uninstall | SWH-05 | **Retry uninstall** clicked; the Inventory tab after a failure |
| Failed install + Fleet's 3 attempts | SWH-07 | The failure reason in the details modal; **Retry** clicked |
| Library vs Inventory distinction | SWH-14 (Inventory after install **and** uninstall, all six), SWH-06 (after install, row columns), SWH-07 (pending/failed) | The Inventory tab after a failed uninstall |
| Update / Reinstall contract | SWH-08 (fixed oracle, Linux), SWH-09 (Claude, both, state-dependent), SWH-13 (Claude's Update, both — **skips** on a level day), SWH-10 (Claude walk — **skipping**) | Deterministic Windows zero-padding case; library moved via **Edit software**; clicking Reinstall when the host is ahead |
| Version pinning on a host | SWH-10 only — **never executed yet** | Pin via the Versions modal |
| Upload size limit | SWH-11 (browser-side) | Server-side enforcement; the boundary |
| Upload progress | SWH-12 | Cancel mid-upload |
| Upcoming activity after a queue | **nothing, deliberately** (intro §6) | API `pending_*` stands in; nothing checks the Upcoming tab ever shows the item |

**Duplication**

1. **SWH-14 (Linux) vs SWH-06.** Same package type, same VM, same install-and-settle, and since 2026-09-28 both open the Inventory tab. SWH-06's unique content is the pre-install absence, the one-row count and the version/type columns; moving those into SWH-14's step 9 covers six install types and frees ~5 min on the busiest VM.
2. **SWH-08 vs SWH-09/13/10.** Intentional — a fixed oracle and a real app — but four Update tests share one describe's worth of meaning; SWH-10 is SWH-13 made deterministic, once it runs.
3. **Every per-run `finally` is a silent uninstall.** SWH-03/06/08 each end with `removeTitleFromHost` — correct hygiene, and the reason a Fleet uninstall regression could first surface as a cleanup error in an install test. ~~SWH-01/02 did too, doubling the uninstalls SWH-04 tested explicitly.~~ **Resolved 2026-09-28:** SWH-14 asserts its own uninstall, and its `finally` is a no-op after a pass.

**UI-vs-API balance**

- **Preconditions through the API are deliberate and right**: SWH-05 installs by API so its failure is about uninstalling; SWH-06/07/08 upload by API so the add form isn't under test four more times. SWH-03 carries the UI add path onto a host; SWH-14's titles come from gitops, so neither half of it is an add-form test.
- **Status waits are API by necessity.** The host is the oracle and it reports on its own schedule; the UI then asserts the outcome on a fresh render. The `(API)` checks inside the waits (`pending_*`, `detail_updated_at` moving, inventory agreeing) are contract checks, not shortcuts.
- **Where the API stands in for a UI check that should exist:** the Deploy policy in the Policies UI (SWH-03), the Inventory tab after a failed uninstall (SWH-05), and the Library-version expectation taken from the API rather than the fixture (SWH-14). ~~The Inventory tab after `.pkg` / `.msi` / FMA installs (SWH-01/02).~~ **Resolved 2026-09-28** by SWH-14's step 9.
- **Weak-assertion watch list:** ~~SWH-11's request listener (cannot fail — nothing submits)~~ (**fixed 2026-09-28:** replaced by the form's own state); SWH-14's `.exe` Installed version (`---` in every state); SWH-14's post-uninstall Inventory absence (can pass on the unfiltered table before the search lands); SWH-14's Past-activity items (the same wording every run, so `.first()` can't tell this run's from the last); SWH-06 step 2 (a brand-new name is trivially absent); SWH-05's modal substring (matches success wording too); ~~SWH-09's pass on whichever branch the calendar picked~~ (**partly fixed 2026-09-28:** the Update path is SWH-13, which skips visibly on a level day).

**Product and fixture context a re-runner should carry**

- **A new custom `.exe` title isn't linked to inventory** ([fleetdm/fleet#20440](https://github.com/fleetdm/fleet/issues/20440)),
  but 7-Zip's is linked once Fleet's hourly Windows-title reconcile merges it with 7-Zip's catalog entry (renamed
  `7-zip`). Either state is correct; the Library showing `---` for a freshly created 7-Zip title is not a regression.
- **The automatic-install `created_policy` activity has no fleet suffix** — on the decision list, encoded in SWH-03.
- **`software_updated_at` means "inventory last changed", not "last collected"** — don't wait on it by hand either; watch "Last fetched" (detail) instead.
- **The install/uninstall fixtures are the VMs fleet's, not a test's.** Declared in `vms.yml`, listed in `helpers/vm-fixtures.ts`, resting state uninstalled, re-applied every night. A missing one is a gitops problem (re-apply), never something to upload by hand; one found installed is a dead run's, and the next preflight uninstalls it.
- ~~**`vms.yml`'s header is partly stale.**~~ **Fixed 2026-09-28:** the header describes the durable fixtures, the per-run items and the sweep, and says the nightly applies it. Original finding: it said `cleanup.steps.ts` did not touch the fleet and a dead spec's leftovers stayed "until the next apply", and later that the sweep never uninstalls from a VM.

**Quick wins**

1. ~~**Poll the `.exe` row's inventory reads**~~ **Done 2026-09-28** — `waitForSoftwareSettled`'s `inventoryName` option, now used by SWH-14 and `ensureVmFixtureUninstalled`. Originally: poll the old SWH-04's `installedPackage` `.not.toEqual([])` and post-uninstall `.toEqual([])` the way `waitForSoftwareSettled` polls the linked path — they were single reads straight after a refetch whose software half can land seconds late.
2. **Assert the fixtures' known version** (`1.0.0`) as the Library version in SWH-14's three inert-package rows instead of the API's reading, so a version-parse bug can't pass on the API agreeing with itself — the version is read at [software-lifecycle-on-host.spec.ts:66](../../tests/e2e/premium/software/software-lifecycle-on-host.spec.ts#L66) and asserted at [:77](../../tests/e2e/premium/software/software-lifecycle-on-host.spec.ts#L77); a `version` field on the custom entries of `VM_SOFTWARE_FIXTURES` would carry it.
3. ~~**Open the Inventory tab in `installFromLibrary`** (SWH-01/02).~~ **Done 2026-09-28** — SWH-14 opens it after the install and after the uninstall, for all six fixtures. SWH-06 is now a merge candidate (Duplication 1).
4. **Read the failure reason in SWH-07**: click **Failed** → Install details → **Details**, assert dpkg's architecture error. One click, and it is the only assertion that proves *why* the install failed.
5. ~~**Make SWH-11's "nothing sent" claim bite or drop it**~~ **Done 2026-09-28** — dropped, for the form's own state (Choose file, no file name, Add software disabled). Was: [large-upload.spec.ts:89](../../tests/e2e/premium/software/large-upload.spec.ts#L89).
6. ~~**Stop SWH-12 failing on a fast upload**~~ **Done 2026-09-28** — a vanished modal reads as 100 %, and the readout is found by text. Was: treat a vanished modal + the success toast as completed progress, or read the bar's value rather than `innerText` of a node that disappears.
7. ~~**Fix the `vms.yml` header** to describe the sweep~~ (**done 2026-09-28**), and name `MaxSoftwareInstallAttempts` at SWH-07's `toEqual([… × 3])`.
8. ~~**Make SWH-14's negative Inventory check wait for the search**~~ **Done 2026-09-28** (empty state) — before `toHaveCount(0)` — for the search response, or for the item count to change — [software-lifecycle-on-host.spec.ts:122-124](../../tests/e2e/premium/software/software-lifecycle-on-host.spec.ts#L122-L124). It is the `.exe` row's only UI proof of the uninstall.
9. ~~**Tie SWH-14's Past-activity items to this run**~~ **Done 2026-09-28** (API baseline) — the relative time on the item, or an activity newer than the click by API — [:98](../../tests/e2e/premium/software/software-lifecycle-on-host.spec.ts#L98), [:128-131](../../tests/e2e/premium/software/software-lifecycle-on-host.spec.ts#L128-L131).

**Bigger bets**

1. **Budget the VMs, not just the tests.** With `fullyParallel`, six tests queue on the one Ubuntu VM, four on Windows and four on macOS (one more each on a day SWH-13 runs); each test's internal waits already sum past its own timeout, CI retries twice, and the job limit is 60 min against a ~40 min run. The 2026-09-28 `--repeat-each` failures were exactly this (one Ubuntu VM carrying ~50 serialized installs). **Partly addressed 2026-09-28:** SWH-14 does one install and one uninstall per fixture where SWH-01 + SWH-04 did two of each, and the CI workflows' shared concurrency group stops two runs (or a run and a gitops apply) overlapping on the VMs. Still open: a per-VM concurrency cap within a run — one worker-scoped lock per platform, or grouping each platform's tests into one serial describe — trades a little wall time for runs that fail for product reasons rather than queue depth.
2. ~~**Uninstall what the sweep deletes.**~~ **Done 2026-09-28**, in two parts. *Per-run packages:* after deleting `fleet-pw-*` titles, the sweep checks the Ubuntu VM's inventory for `fleet-pw-*` names and, if any, queues `dpkg-query -W -f='${Package}\n' 'fleet-pw-*' | xargs -r dpkg --purge` — a host runs scripts and installs from one queue, so the purge finishes before any install the run queues after it. *Fixed-name fixtures:* they are durable titles now, never deleted, so the sweep no longer touches them; the "bring the real VMs to their resting state" step uninstalls any found installed, at the start **and** end of every run. SWH-05's own purge is still unverified in-test. Original bet: the sweep removed titles but never touched the machine, so every timed-out run left its per-run `fleet-pw-*` `.deb` installed on the Ubuntu VM for good (the fixed-name `.pkg`/`.msi` were rescued by the next run's pre-clean; per-run names never were), and SWH-05's fire-and-forget purge was unverified.
3. **Watch SWH-10's first real run.** The whole pin-back walk is authored and reviewed but has only ever skipped. When Claude next ships, the first nightly after the cron fetches the build is the walk's real verification — worth a manual headed run that day rather than trusting the green.
4. **Cover the Update contract on Windows deterministically.** `make-msi.sh` already derives the UpgradeCode from the role so a newer build upgrades an older one; a 1.0.0 / 1.1.0 `.msi` pair (and a `1.0.0.0` vs `1.0.0` variant for the padding rule) would give Windows what SWH-08 gives Linux, and take SWH-09/13's calendar-dependence off the critical path. It would be per-run, like SWH-08's pair: a version swap changes the title.
