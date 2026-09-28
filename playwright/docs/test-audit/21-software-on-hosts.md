# Software on hosts — test audit

**Specs covered:** 5 files · **Entries:** 12 · **Runtime tests:** 18 (three parameterized loops collapsed into one entry each, every generated title listed; 1 skips on a data-availability guard today) · **Project:** premium

This area covers Fleet **delivering software to a real device**: an installer added through Add software,
installed from the host's Library, followed until the host reports it back, then uninstalled; plus the
failure paths (a refused install, a failing uninstall), the Library's **Update** button, the "Deploy"
automatic-install policy, and the Add-software form at the size end. Everything except SWH-11/12 happens on
a real VM, and the host itself is the oracle — an installed version only counts once the host's own
inventory says so.

**This area is unlike every other one in the audit, in eight ways.** Read them before running anything.

**1. It runs on the real VMs, not the simulations.** Three genuine machines — **macOS, Windows 11 and
Ubuntu, all ARM** (Apple M4, ARM Windows, aarch64) — on the **VMs** fleet (id 103 on premium QA, resolved by
name through the `vmsFleetId` worker fixture). Specs pick them with
`findOnlineHost(request, platform, { kind: 'real' })`, which keys on `hardware_model` matching
`/virtual|qemu/i`, **not** on MDM enrollment. Never by name or id. An osquery-perf simulation never installs
anything, so a green assertion against one proves nothing. ARM decides which installers can land at all:
that is why the Windows `.exe` is `7z2601-arm64.exe` and why an `amd64` `.deb` is a *deterministic* failed
install on the Ubuntu VM.

**2. The VMs fleet is under gitops since this batch.** `gitops/premium-fleetqa/fleets/vms.yml` declares the
`pw-host-report-results` report and keeps **Claude** installed on the macOS and Windows VMs via two
**"Claude is installed"** *presence* policies (reinstall when missing, never update). It is **applied by
hand**, not by the nightly. Claude tracks latest (no `version:` pin), so Fleet's hourly
`maintained_apps_auto_update` cron downloads each new build and keeps the previous one — the ingredient the
update spec (SWH-09/10) needs. Design and rationale:
[D-host-execution.md → The FMA fixture set](../qawolf-migration/round-2/D-host-execution.md#the-fma-fixture-set).
Everything else on the fleet is per-run, and a gitops apply deletes whatever the file does not declare.

**3. Every fixture is inert.** Nothing a spec installs changes the machine beyond one marker:

| fixture | built by | installs |
|---|---|---|
| `fleet-playwright-install-1.0.0.pkg` / `fleet-playwright-uninstall-1.0.0.pkg` | [`test-data/apple/macos/software/make-pkg.sh`](../../test-data/apple/macos/software/make-pkg.sh) (committed output) | one empty app bundle, `/Applications/Fleet Playwright <Role>.app` — an app bundle because macOS inventory lists `.app` bundles only; a files-only `.pkg` installs but never shows up |
| `fleet-playwright-install-1.0.0.msi` / `fleet-playwright-uninstall-1.0.0.msi` | [`test-data/windows/software/make-msi.sh`](../../test-data/windows/software/make-msi.sh) (committed output) | one marker file under `C:\Program Files\Fleet Playwright <Role>\` |
| `7z2601-arm64.exe` | committed vendor binary | 7-Zip, into `C:\Program Files\7-Zip` — nothing else on the fleet uses 7-Zip |
| `fleet-pw-<purpose>-<base36>_<ver>_<arch>.deb` | [`helpers/deb.ts`](../../helpers/deb.ts) **at run time** (`inertDeb`, `buildDeb`) | one marker at `/usr/share/<name>/marker.txt`, no maintainer scripts; per-run name so no other run can share the title |

One package **per spec** (the `install` / `uninstall` roles): a premium title can hold several packages, so
two specs uploading the same file to the VMs fleet would share one Library row. The one non-inert thing
installed is the Fleet-maintained **Itsycal** (a menu-bar calendar, never launched) in SWH-02.

**4. The waits are the substance, and they are slow.** `waitForSoftwareSettled`
([`helpers/api/software.ts`](../../helpers/api/software.ts)) is the wait every flow here leans on, in three
steps: **(a)** the install/uninstall status settles (≤ 5 min — a VM works one queue, shared with every other
spec's scripts and installs); **(b)** a collection runs *after* that: baseline the host's
`detail_updated_at`, ask for a refetch, wait for it to move (≤ 4 min) — `detail_updated_at`, **not**
`software_updated_at`, because the latter only moves when the inventory *changes* and so never moves after a
failed uninstall; **(c)** the inventory agrees with the status (≤ 2 min — a refetch's detail results can be
stored seconds before its software results). **A refetch takes 60–120 s on a VM.** On a manual run, the
equivalent is: wait for the Library Status to settle, click **Refetch** on the host, wait for "Last fetched"
to update, then look.

**5. A failed install is retried.** Fleet makes `MaxSoftwareInstallAttempts` = **3** attempts and reports
`pending_install` between them, so "Failed" only sticks **~6 minutes** after the click. SWH-07 depends on this
window; a manual re-runner who expects an instant red status will think the flow is stuck.

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

**8. Runtime.** These five specs are the bulk of the premium nightly's **~40 min** (39.6 min at CI's two
workers on 2026-09-28, against a ~15 min nightly before batch D and a 60 min job limit); each test takes
**3–10 min**. CI retries twice, so a real failure here can cost half an hour.

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
- **Leave Claude alone.** Do not uninstall it from either VM, do not delete its titles, do not edit or delete
  the two **"Claude is installed"** policies, and **do not leave it pinned** — an exact pin freezes the
  auto-update cron for the title and stops the version history SWH-10 needs from growing. If you pin during
  SWH-10, unpin before you walk away (title → **Versions** → latest). `cleanup-setup` clears stranded pins on
  the QA and VMs fleets at the start of every premium run, but not between your clicks.
- **Don't run a manual flow at 05:30–06:15 UTC** — the premium Playwright nightly runs these same flows on
  the same VMs then, with the same fixed-name `.pkg` / `.msi` fixtures, and two installs of one title on one
  host will confuse both.

### Cleaning up by hand after an interrupted flow

Each test removes its title in a `finally`, and `setup/cleanup.steps.ts` sweeps what these specs name as their
own from the VMs fleet at the start and end of every premium run: titles whose package matches
`fleet-pw-*` / `fleet-playwright-*` / `7z2601-arm64.exe`, the Fleet-maintained **Itsycal**, and policies named
`[Install software] fleet-pw-*`; plus it clears version pins on **QA** and **VMs**. **The sweep deletes
titles; it never uninstalls from a host.** So if you stop a manual flow midway, clean up in this order:

1. **Uninstall from the host.** Host details → **Software** → **Library** → search the title → **Uninstall**.
   Wait for the Status to clear (a refetch lands 60–120 s later and the Installed version goes back to `---`).
   Deleting the title first leaves the software on the machine, and the next run's Library then shows it as
   already installed.
2. **If a "Deploy" policy exists**, delete it first: **Policies** → fleet **VMs** →
   `[Install software] <name> (deb)` → delete. A title an install policy points at cannot be deleted.
3. **Delete the title.** **Software** → fleet **VMs** → the title → its installer card → **Delete this
   version** → **Delete**.

For SWH-05's package, whose uninstall script fails **by design**, step 1 will fail again: either edit the
title's uninstall script first (title → **Edit software** → Advanced options) to
`apt-get remove --purge --assume-yes <name>`, or run that as an ad-hoc script on the Ubuntu VM
(`POST /api/v1/fleet/scripts/run` with `host_id` + `script_contents` — what the spec's `finally` does).

### Preparing a manual run

- **Find the VMs:** **Hosts** → fleet **VMs** → the one macOS, one Windows and one Ubuntu host. Identify them
  by platform (and "Virtual Machine" / QEMU hardware model on Details), not by a remembered name.
- **Fixtures:** the `.pkg`, `.msi` and `.exe` are committed under `test-data/`. There is **no committed
  installable `.deb`** — the specs build theirs in memory. `test-data/linux/software/make-deb.py` writes the
  fixed `fleet-playwright-pkg_1.0.0_amd64.deb`, which is the right file for SWH-07 (wrong arch) and the wrong
  one for everything else. For an installable one, from `playwright/`:

  ```bash
  npx --yes tsx -e "require('fs').writeFileSync('fleet-pw-manual_1.0.0_all.deb', require('./helpers/deb').inertDeb('fleet-pw-manual', '1.0.0'))"
  ```

  Keep the `fleet-pw-` prefix so the sweep recognises it if you forget it. Bump the version argument (and the
  file name) for SWH-08's 0.9.0 / 1.1.0 packages.

---

## Contents

| ID | Spec | Test | Mode | Manual? |
|---|---|---|---|---|
| SWH-01 | `premium/software/install-on-host.spec.ts` | a {macOS .pkg, Windows .msi, Linux .deb} added in the UI installs on the VM and lands in its inventory — **3 variants** | UI+API | ☐ |
| SWH-02 | `premium/software/install-on-host.spec.ts` | a Fleet-maintained app added from its catalog page installs on the macOS VM | UI+API | ☐ |
| SWH-03 | `premium/software/install-on-host.spec.ts` | "Deploy" creates an install policy, and Fleet installs through it on the Linux VM | UI+API | ☐ |
| SWH-04 | `premium/software/uninstall-from-host.spec.ts` | a {macOS .pkg, Windows .msi, Windows .exe, Linux .deb} uninstalls from the VM and leaves its inventory — **4 variants** | UI+API | ☐ |
| SWH-05 | `premium/software/uninstall-from-host.spec.ts` | an uninstall that fails leaves the software installed, and the Library offers a retry | UI+API | ☐ |
| SWH-06 | `premium/software/inventory-reflects-install.spec.ts` | a package that installs appears in the Inventory once the host re-reports | UI+API | ☐ |
| SWH-07 | `premium/software/inventory-reflects-install.spec.ts` | a pending or failed install never appears in the Inventory, through every retry | UI+API | ☐ |
| SWH-08 | `premium/software/update-on-host.spec.ts` | a package the library moves ahead of is offered Update, and only then | UI+API | ☐ |
| SWH-09 | `premium/software/update-on-host.spec.ts` | Claude on the {darwin, windows} VM offers Update exactly when the library is ahead of it — **2 variants** | UI+API | ☐ |
| SWH-10 | `premium/software/update-on-host.spec.ts` | Claude on the macOS VM: pinned back it is ahead, installed it is level, unpinned it updates — **skips** until a second Claude build is cached | UI+API | ☐ |
| SWH-11 | `premium/software/large-upload.spec.ts` | a package over the size limit is refused in the browser, before any upload | UI+API | ☐ |
| SWH-12 | `premium/software/large-upload.spec.ts` | a large upload shows its progress and ends in success | UI | ☐ |

`Mode` is one of: **UI** (all validation through the browser), **UI+API** (browser flow,
some assertions via API), **API** (no meaningful UI validation), **PERF** (timing).

### Running these

```bash
npm run test:premium -- -g "<title fragment>"            # with deps: premium-setup + cleanup-setup (runs the VMs sweep)
npm run test:premium:headed -- -g "<title fragment>"     # watch it
```

`-g` is a regex, and several titles contain `.` or `"` — quote the fragment with single quotes where it holds
double quotes. All five files run **fully parallel** (the suite default) except the `Claude` describe, which is
`mode: 'serial'`; with more than one worker, the Linux tests of all four VM specs queue on the **same Ubuntu
VM** — seven of them.

---

### SWH-01 · Premium • Software • Install on host › a {macOS .pkg, Windows .msi, Linux .deb} added in the UI installs on the VM and lands in its inventory

- **File:** [`playwright/tests/e2e/premium/software/install-on-host.spec.ts`](../../tests/e2e/premium/software/install-on-host.spec.ts)
- **Grep:** `npm run test:premium -- -g "added in the UI installs on the"` (three runtime tests: `a macOS .pkg added in the UI installs on the darwin VM and lands in its inventory`, `a Windows .msi added in the UI installs on the windows VM and lands in its inventory`, `a Linux .deb added in the UI installs on the linux VM and lands in its inventory`)
- **Project:** premium · **Scope:** the **VMs** fleet (selected by label in the Software page's fleet dropdown) · **Host:** the real VM of the row's platform
- **Mode:** UI+API · **Isolation:** parallel, self-contained; describe timeout 600 s. `finally` → `removeTitleFromHost` (uninstall if the host has it, wait for the status to clear — **not** for the refetch — then delete the title).
- **Preconditions:** an online real VM of the platform (the spec throws `no online real <platform> VM on <url>` otherwise); the VMs fleet exists; the macOS/Windows rows' fixed-name fixture is not already a title on the fleet (pre-cleaned if it is).
- **Data created:** one title on the VMs fleet + the fixture installed on one VM — both removed in `finally`. The `.deb` row's file is written under the test's output dir.

| variant | file | package name the details modal quotes |
|---|---|---|
| macOS `.pkg` | `test-data/apple/macos/software/fleet-playwright-install-1.0.0.pkg` | `fleet-playwright-install-1.0.0.pkg` |
| Windows `.msi` | `test-data/windows/software/fleet-playwright-install-1.0.0.msi` | `fleet-playwright-install-1.0.0.msi` |
| Linux `.deb` | built per run: `fleet-pw-install-<base36>_1.0.0_all.deb` | the same |

**Flow**

1. ☐ (No user action) Resolve the VM for the row's platform; for the `.deb` row, build the package.
2. ☐ (No user action) Pre-clean: if a title whose package file name matches already exists on the VMs fleet (a dead run's leftover), uninstall it from the VM and delete it.
3. ☐ Open the dashboard → click **Software** in the navbar → pick **VMs** in the fleet dropdown → click **Add software**.
   - ✅ *(UI)* URL is `/software/add/fleet-maintained` — Add software opens on the Fleet-maintained tab — `SoftwareTitlesPage.clickAddSoftware()`.
   - ✅ *(UI)* The fleet dropdown reads exactly **VMs** after the pick — `TeamDropdown.selectByLabel('VMs')`.
4. ☐ Click the **Custom package** tab.
   - ✅ *(UI)* URL is `/software/add/package`; the **Add software** heading and the selected tab are visible — `SoftwareCustomPackagePage.openTab()`.
5. ☐ Choose the file (Deploy left **off**) and click **Add software** — `uploadPackage(file)`.
   - ✅ *(UI)* **Add software** is enabled once a file is chosen.
   - ✅ *(UI)* If the upload progress modal appears, it clears (≤ 45 s).
   - ✅ *(UI)* Fleet redirects to `/software/titles/<id>`; a success toast matching `/successfully added/` shows.
6. ☐ Read the title's name off the summary card (the element labelled `software display name`). **On a manual run, note it** — Fleet derives it from the package; the spec never assumes it.
   - ✅ *(API)* The title is offered to the VM: `GET /hosts/:id/software?available_for_install=true` has a row for it with a library version (*"<name> isn't offered to <host>"* otherwise).
7. ☐ (No user action) `ensureNotInstalled` — if the VM still reports this title from a dead run (the title's return makes an old install visible again), uninstall it and wait for the inventory to agree.
8. ☐ Open the host's details page (via URL `/hosts/<id>`; anchored on **Disk space available**) → **Software** tab → **Library** tab → type the title name in **Search by name**.
   - ✅ *(UI)* URL contains `/software/library`; the title's row is visible — `HostDetailsPage.openLibrary()`.
   - ✅ *(UI)* **Installed version** reads `---`.
   - ✅ *(UI)* **Library version** equals the version the API reported in step 6.
9. ☐ Click **Install** on the row.
   - ✅ *(UI)* Success toast **"Software is installing. To see details, go to Details > Activity."** — `HostSoftwareLibrary.install()`.
   - ✅ *(API)* The host's status for the title is `pending_install` immediately after the click.
10. ☐ Wait. By hand: watch the row's Status go from "Installing..." to **Installed**, then click **Refetch** on the host and wait for "Last fetched" to update — `waitForSoftwareSettled(…, 'installed')`.
    - ✅ *(API)* Status reaches `installed` (≤ 5 min).
    - ✅ *(API)* `detail_updated_at` moves past a baseline taken *after* the status settled (≤ 4 min, refetch requested).
    - ✅ *(API)* The host's inventory lists an installed version for the title (≤ 2 min).
11. ☐ Reload the host page → **Software** → **Library** → search the title.
    - ✅ *(UI)* **Installed version** equals the library version.
    - ✅ *(UI)* The row's install-side button now reads **Reinstall**.
12. ☐ Click the row's **Installed** status button.
    - ✅ *(UI)* The **Install details** modal (`.software-install-details-modal`) opens with a status line containing **"installed <title> (<package file>) on <host display name>"**.
    - ☐ Click **Close**. ✅ *(UI)* The modal is hidden.
13. ☐ Reload the host page → in the **Activity** card, click the **Past** tab → click the newest item matching "… installed <title> on this host." (the regex has a word boundary, so it does not match "uninstalled").
    - ✅ *(UI)* **Past** is selected; the Install details modal opens again with **"installed <title> (<package file>)"**.
    - ☐ Click **Close**. ✅ *(UI)* hidden.
14. ☐ (No user action) `finally` — uninstall from the VM, delete the title.

**Assessment**
- *Value:* the area's backbone and the only path that drives a custom package **through the Add software UI and onto a device** on all three platforms. The Library row's state machine (`---` → Install → Reinstall + installed version), the details modal and the host activity are all read off one real install, and the pre-clean (`ensureNotInstalled`) is genuinely careful: it handles the case where a dead run's install becomes visible again only once the title returns.
- *Coverage gaps:*
  - **The Inventory tab is never opened.** The title promises "lands in its inventory", and the inventory is checked — but only by API (step 10) and through the Library's *Installed version* column, which is derived from it. The Inventory tab itself is asserted only for the Linux `.deb`, in SWH-06. For `.pkg`, `.msi` and the FMA, no test ever looks at Host → Software → Inventory after an install.
  - **The library version is checked against the API's own reading**, not against the version the fixture is known to carry (`1.0.0` is in every file name). A Fleet parse that got the version wrong would be reported identically by the API and the UI and pass here.
  - The **Details** toggle in the Install details modal (the install script's output) is never opened. The dashboard-wide activity feed is not checked (only the host's). The Upcoming item is deliberately unasserted (see intro §6).
- *Redundancy:* the Linux row and SWH-06 both install a per-run `.deb` on the Ubuntu VM and wait for it to reach inventory; SWH-06's only addition is the Inventory-tab view this entry lacks. The shared `installFromLibrary` helper is also run by SWH-02.
- *Efficiency / smells:*
  - **Worst-case budgets exceed the test timeout.** `waitForSoftwareSettled` alone may take 300 + 240 + 120 s = 11 min against a 10 min describe timeout, before `ensureNotInstalled` and the upload. A slow VM therefore ends as a *test timeout*, which aborts before the `finally` — cleanup then falls to the sweep, and the software stays installed on the VM (the sweep never uninstalls).
  - The `pending_install` read (step 9) is one-shot right after the toast. The header calls it deterministic; it is in practice (orbit polls, so there are seconds before pickup), but an idle VM completing and reporting a tiny `.deb` before the GET lands would fail it.
  - The macOS/Windows rows use **fixed file names**. Two concurrent copies of the same row (`--repeat-each` across workers) would share one title and step on each other's install; the per-run `.deb` naming exists precisely to avoid this and the committed fixtures cannot.
  - The pre-clean in step 2 is dead code for the `.deb` row (a per-run name can never have a leftover).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWH-02 · Premium • Software • Install on host › a Fleet-maintained app added from its catalog page installs on the macOS VM

- **File:** [`playwright/tests/e2e/premium/software/install-on-host.spec.ts`](../../tests/e2e/premium/software/install-on-host.spec.ts)
- **Grep:** `npm run test:premium -- -g "a Fleet-maintained app added from its catalog page installs on the macOS VM"`
- **Project:** premium · **Scope:** the **VMs** fleet · **Host:** the real macOS VM
- **Mode:** UI+API · **Isolation:** parallel; describe timeout 600 s; `finally` → `removeTitleFromHost`
- **Preconditions:** online real macOS VM; **Itsycal** is *not* already added to the VMs fleet for macOS (a leftover is pre-cleaned by API, then the catalog is asserted to show **Add**); Fleet can fetch Itsycal from its catalog source (an external download).
- **Data created:** the Itsycal title on the VMs fleet + Itsycal installed on the macOS VM — both removed in `finally`. **Not Claude on purpose**: the fleet keeps Claude installed (intro §2).

**Flow**

1. ☐ (No user action) Resolve the macOS VM. If an Itsycal (darwin) Fleet-maintained title is already on the VMs fleet, uninstall it from the VM and delete it.
2. ☐ Dashboard → **Software** → fleet **VMs** → **Add software** (lands on the **Fleet-maintained** tab).
   - ✅ *(UI)* URL `/software/add/fleet-maintained`; heading and selected tab visible (≤ 15 s — the Add software bundle is slow under load) — `FleetMaintainedAppsPage.openTab()`.
3. ☐ Search the catalog for **Itsycal** and look at its **macOS** column.
   - ✅ *(UI)* The macOS cell shows an **Add** button and no success (✓) icon — `expectNotAddedFor('Itsycal', 'macOS')`.
4. ☐ Click that **Add** → on the app's page click **Add software**; wait for "Uploading software…" to clear if it shows (≤ 45 s; absent when Fleet has it cached).
   - ✅ *(UI)* URL becomes `/software/titles/<id>` (≤ 60 s).
   - ✅ *(UI)* The title heading reads **Itsycal**; the header pills include **Fleet-maintained**.
5. ☐ (No user action) Read the title's state and installer.
   - ✅ *(API)* The title is offered to the macOS VM with a library version.
   - ✅ *(API)* The title has an installer package on the VMs fleet (its file name — the one Fleet fetched — is what the details modal quotes).
6. ☐ Steps 7–13 of **SWH-01**, with title **Itsycal**: host → Library shows `---` / the library version → **Install** (toast; ✅ *(API)* `pending_install`) → wait for installed + refetch + inventory → Library shows the version and **Reinstall** → **Installed** status → Install details "installed Itsycal (<package>) on <host>" → Past activity item → same modal.
7. ☐ (No user action) `finally` — uninstall Itsycal from the VM, delete the title.

**Assessment**
- *Value:* the only test that takes a Fleet-maintained app from the **catalog page** to a device — a different add path (Fleet fetches the installer server-side) and a different uninstall script (Fleet's own, for a third-party app) from SWH-01. The explicit "not added yet" precondition is good: without it, a leftover would make step 4 a silent no-op.
- *Coverage gaps:* no toast is asserted after the FMA add, and the catalog is not re-checked for the ✓ afterwards (`expectAddedFor` exists and is unused here). The version and installer name come from the API because they are genuinely unknowable in advance (the cached build moves with the vendor) — fine, but it means the Library-version assertion is the API agreeing with itself. Same Inventory-tab gap as SWH-01.
- *Redundancy:* SWH-01's post-add half verbatim, via the shared helper. That is the right shape.
- *Efficiency / smells:*
  - **External dependency.** Itsycal's download is fetched from the vendor/CDN on add; an outage there reads as a Fleet failure. Itsycal is also the one non-inert install in the area — a real third-party app on the macOS VM, albeit never launched.
  - The title id is parsed from the URL inline (`page.waitForURL` + `split('/').pop()`); `SoftwareCustomPackagePage.uploadPackage` returns the id, and `FleetMaintainedAppDetailPage.confirmAdd` could too.
  - `OWN_FMA_TITLES` in the cleanup sweep hard-codes `Itsycal`: change the app here and the sweep silently stops covering it.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWH-03 · Premium • Software • Install on host › "Deploy" creates an install policy, and Fleet installs through it on the Linux VM

- **File:** [`playwright/tests/e2e/premium/software/install-on-host.spec.ts`](../../tests/e2e/premium/software/install-on-host.spec.ts)
- **Grep:** `npm run test:premium -- -g 'creates an install policy, and Fleet installs through it'`
- **Project:** premium · **Scope:** the **VMs** fleet · **Host:** the real Ubuntu VM
- **Mode:** UI+API · **Isolation:** parallel; **timeout 900 s** (the longest in the file); `finally` deletes the policy first, then `removeTitleFromHost`
- **Preconditions:** online real Ubuntu VM
- **Data created:** a per-run `fleet-pw-deploy-<base36>` `.deb` title, the policy **`[Install software] fleet-pw-deploy-<base36> (deb)`** on the VMs fleet, and the package on the VM — all removed in `finally` (the sweep also matches both names).

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
- *Redundancy:* none.
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

### SWH-04 · Premium • Software • Uninstall from host › a {macOS .pkg, Windows .msi, Windows .exe, Linux .deb} uninstalls from the VM and leaves its inventory

- **File:** [`playwright/tests/e2e/premium/software/uninstall-from-host.spec.ts`](../../tests/e2e/premium/software/uninstall-from-host.spec.ts)
- **Grep:** `npm run test:premium -- -g "uninstalls from the .* VM and leaves its inventory"` (four runtime tests: `a macOS .pkg uninstalls from the darwin VM and leaves its inventory`, `a Windows .msi uninstalls from the windows VM and leaves its inventory`, `a Windows .exe uninstalls from the windows VM and leaves its inventory`, `a Linux .deb uninstalls from the linux VM and leaves its inventory`)
- **Project:** premium · **Scope:** the **VMs** fleet (no fleet dropdown — the flow starts on host details) · **Host:** the real VM of the row's platform
- **Mode:** UI+API · **Isolation:** parallel; describe timeout 600 s; `finally` → `removeTitleFromHost`. **The install is a precondition done through the API**, so a failure here is about uninstalling.
- **Preconditions:** online real VM of the platform
- **Data created:** one title on the VMs fleet + one install on the VM, uninstalled by the test itself and deleted in `finally`.

| variant | file | uninstall script | name the host's inventory uses |
|---|---|---|---|
| macOS `.pkg` | `fleet-playwright-uninstall-1.0.0.pkg` | Fleet's, from the package IDs | the title's |
| Windows `.msi` | `fleet-playwright-uninstall-1.0.0.msi` | Fleet's, from the product code | the title's |
| Windows `.exe` | `7z2601-arm64.exe` | **ours** — Fleet requires both scripts for `.exe`: `Start-Process $env:INSTALLER_PATH /S` and `C:\Program Files\7-Zip\Uninstall.exe /S` | **`7-Zip 26.01 (arm64)`** (the title is named `7-Zip`, from ProductName) |
| Linux `.deb` | per run: `fleet-pw-uninstall-<base36>_1.0.0_all.deb` | Fleet's `apt-get remove` | the title's |

**The `.exe` row is different by design.** Fleet names a custom `.exe` title from the installer's
ProductName (`7-Zip`) while Windows lists the program by its DisplayName (`7-Zip 26.01 (arm64)`), and Fleet
never links the two — custom `.exe` titles are not matched to inventory, by design since
[fleetdm/fleet#20440](https://github.com/fleetdm/fleet/issues/20440). So the Library never shows it an
installed version, and the row is checked against the host inventory **by DisplayName** instead
(`inventoryName` in the spec; `linked = false`).

**Flow**

1. ☐ *(API setup)* Pre-clean a leftover title with the same package file name. Upload the package to the VMs fleet (with the row's scripts), queue the install, and wait for it to settle — status `installed`, a post-status refetch, and the inventory **present** (linked rows) or **any** (the `.exe` row).
   - ✅ *(API)* The host's inventory lists the inventory name with at least one version (*"<title> installed but the host's inventory never listed <name>"* otherwise).
   - **By hand:** add the package through Add software on the VMs fleet (for the `.exe`, paste both scripts from the table into the form), install it from the VM's Library, wait for **Installed** and a refetch.
2. ☐ Open the host's details page → **Software** → **Library** → search the title.
   - ✅ *(UI)* *(linked rows only)* **Installed version** is not `---`.
3. ☐ Click **Uninstall** on the row.
   - ✅ *(UI)* Toast **"Software is uninstalling. To see details, go to Details > Activity."**
   - ✅ *(API)* The host's status for the title is `pending_uninstall`.
4. ☐ Wait for the status to clear, then **Refetch** and wait for "Last fetched" to move — `waitForSoftwareSettled(…, null, { inventory: 'absent' | 'any' })`.
   - ✅ *(API)* Status clears to `null` (≤ 5 min); `detail_updated_at` moves (≤ 4 min); *(linked rows)* the inventory no longer lists an installed version (≤ 2 min).
   - ✅ *(API)* The host inventory, searched by the inventory name, returns no versions.
5. ☐ Reload the host → **Software** → **Library** → search the title.
   - ✅ *(UI)* **Installed version** reads `---`.
   - ✅ *(UI)* The install-side button reads **Install**.
   - ✅ *(UI)* No **Uninstall** button on the row (`toHaveCount(0)`).
6. ☐ Reload the host → **Software** → **Inventory** → search the **inventory name** (for the `.exe`: `7-Zip 26.01 (arm64)`).
   - ✅ *(UI)* The table has settled (a first row or the empty state is visible).
   - ✅ *(UI)* No name link matching the inventory name exactly (`toHaveCount(0)`).
7. ☐ Reload the host → **Activity** → **Past** → click the newest item matching "uninstalled <title> on this host."
   - ✅ *(UI)* The **Uninstall details** modal (`.software-uninstall-details-modal`) opens with **"uninstalled <title> from <host display name>"**.
   - ☐ **Close**. ✅ *(UI)* hidden.
8. ☐ (No user action) `finally` — `removeTitleFromHost` (already uninstalled, so this only deletes the title).

**Assessment**
- *Value:* the strongest multi-surface check in the area — the uninstall is observed in the API, the Library, the **Inventory tab** and the activity/modal, across all four package types including the `.exe` Fleet can't link. The Library-and-Inventory pair is exactly the Library/Inventory distinction this batch was built to keep straight.
- *Coverage gaps:* the Uninstall details modal's **Details** (the uninstall script's output) is not opened. For linked rows the "before" state is asserted as `not '---'` rather than `1.0.0`. The uninstall is only ever started from the host's Library — not from the title page or the host's Inventory.
- *Redundancy:* SWH-05 reuses the same precondition helper; SWH-01's cleanup performs the same uninstall silently by API every run.
- *Efficiency / smells:*
  - **The `.exe` row's inventory checks are one-shot reads that can race.** With `inventory: 'any'`, `waitForSoftwareSettled` returns as soon as the refetch lands — but its own doc says a refetch's software results can land *seconds after* its detail results, which is why the linked path polls for 2 min. The `.exe` row then reads the inventory once: in step 1 (`.not.toEqual([])`) and step 4 (`.toEqual([])`). Either can fail on a refetch whose software half is a beat late. The fix is a short poll on `getHostInventoryVersions`, not a longer sleep.
  - For the `.exe` row, step 5's **Installed version `---`** is non-discriminating — it read `---` before the uninstall too, since the title is never linked. The **Install** button and the absent **Uninstall** carry that row.
  - Two Windows rows (plus SWH-01's `.msi` and SWH-09's Windows Claude) share the one Windows VM's queue in a parallel run.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SWH-05 · Premium • Software • Uninstall from host › an uninstall that fails leaves the software installed, and the Library offers a retry

- **File:** [`playwright/tests/e2e/premium/software/uninstall-from-host.spec.ts`](../../tests/e2e/premium/software/uninstall-from-host.spec.ts)
- **Grep:** `npm run test:premium -- -g "an uninstall that fails leaves the software installed"`
- **Project:** premium · **Scope:** the **VMs** fleet · **Host:** the real Ubuntu VM
- **Mode:** UI+API · **Isolation:** parallel; describe timeout 600 s; `finally` queues an ad-hoc `apt-get remove --purge` on the VM **without waiting**, then deletes the title
- **Preconditions:** online real Ubuntu VM
- **Data created:** a per-run `fleet-pw-uninstall-fails-<base36>` title whose uninstall script is `echo "refusing to uninstall"; exit 1`, installed on the VM. Removed from the host by the ad-hoc script, title deleted. **See the intro's manual-cleanup note — Fleet's own uninstall of this title fails by construction.**

**Flow**

1. ☐ *(API setup)* Upload `fleet-pw-uninstall-fails-<base36>_1.0.0_all.deb` with the uninstall script
   `#!/bin/sh` / `echo "refusing to uninstall"` / `exit 1`; install it; wait for `installed` + refetch + inventory present.
   - ✅ *(API)* The host's inventory lists it.
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
- *Coverage gaps:* the **Inventory tab** is not opened — "still installed" is proved by API and the Library only (SWH-04 does open it for the success case). **Retry uninstall** is asserted visible, never clicked. Only Linux.
- *Redundancy:* none.
- *Efficiency / smells:*
  - **The cleanup is unverified.** The ad-hoc purge is queued and not awaited, and the title is deleted in the same breath; if the script fails (or the VM's queue drops it), the package stays on the Ubuntu VM with no title to show for it and nothing reports it. The sweep would never catch it either — it deletes titles, it doesn't uninstall.
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
- **Preconditions:** online real Ubuntu VM (`expected an online real Linux VM`)
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
- *Coverage gaps:* the Library is not looked at; the install is by API (SWH-01 covers the UI install). Only `.deb` — nothing asserts a `.pkg`, `.msi` or FMA lands in the Inventory tab (see SWH-01).
- *Redundancy:* **largely SWH-01's Linux row.** Both upload a per-run `.deb`, install it on the Ubuntu VM and wait for the same settle; this test's unique content is step 4. Adding an Inventory-tab check to `installFromLibrary` would cover all three platforms and the FMA in SWH-01/02, and make this test a candidate to drop — saving one install + refetch cycle (≈ 3–5 min) on the busiest VM.
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
- **Preconditions:** online real Ubuntu VM that is **not amd64** — the whole test rests on dpkg refusing the architecture
- **Data created:** a per-run `fleet-pw-wrong-arch-<base36>` **amd64** title. Nothing reaches the host. Deleted in `finally`.

**Flow**

1. ☐ *(API setup)* Upload `fleet-pw-wrong-arch-<base36>_1.0.0_amd64.deb` (built with `Architecture: amd64`). By hand: `test-data/linux/software/fleet-playwright-pkg_1.0.0_amd64.deb` is an equivalent wrong-arch file.
2. ☐ Host details → **Software** → **Library** → search the name → click **Install**.
   - ✅ *(UI)* Toast "Software is installing. To see details, go to Details > Activity."
3. ☐ **Straight away**, reload the host → **Software** → **Inventory** → search the name.
   - ✅ *(UI)* The table settles; no name link for the package.
   - ✅ *(API)* The status is **still** `pending_install` — confirming the Inventory read in the step above happened inside the pending window, not after it.
4. ☐ Wait — **about 6 minutes**. Fleet tries three times (`MaxSoftwareInstallAttempts`), reporting pending between attempts; dpkg refuses each. Then **Refetch** and wait for "Last fetched" to move.
   - ✅ *(API)* Status reaches `failed_install` (≤ 10 min); after a post-status refetch, installed versions are `[]`.
   - ✅ *(API)* The host's activities (newest 50) hold exactly **three** `installed_software` entries for this title, each with status `failed_install`.
5. ☐ Reload the host → **Software** → **Inventory** → search the name.
   - ✅ *(UI)* Still no name link.
6. ☐ Reload the host → **Software** → **Library** → search the name.
   - ✅ *(UI)* The Status cell shows a **Failed** button.
   - ✅ *(UI)* The install-side button reads **Retry**.
7. ☐ (No user action) `finally` — wait for `failed_install` if not already there, delete the title.

**Assessment**
- *Value:* the best-designed failure in the area. The failure is **deterministic and harmless** (the architecture mismatch means nothing touches the host), the pending-window read is *proved* to be inside the window by reading the status after it, and the three-attempt assertion documents a Fleet behaviour (`MaxSoftwareInstallAttempts`) that would otherwise surprise every manual tester.
- *Coverage gaps:*
  - **The failure's reason is never read.** The **Failed** button opens the Install details modal with dpkg's architecture error in **Details** — the most informative thing on screen, and the one assertion that would tell a wrong-arch refusal from any other failure. `InstallDetailsModal.output()` exists.
  - **Retry** is asserted visible, never clicked. The per-attempt activities are asserted via API only, not as three items in the host's Past tab.
- *Redundancy:* none.
- *Efficiency / smells:*
  - **The exact count of three pins a Fleet constant.** Deliberate — but if `MaxSoftwareInstallAttempts` changes this fails on the count with a message about activities, not about retries. Worth a comment naming the constant at the assertion.
  - `listHostActivities` reads the newest **50**. The Ubuntu VM carries seven parallel tests from this area plus the script specs; a busy window could push an attempt past 50 within the ~6 minutes.
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
- **Mode:** UI+API · **Isolation:** **serial** describe `Claude` (darwin → windows → SWH-10), because SWH-10 pins the title these read. A failure in the darwin run **skips the Windows run and SWH-10**.
- **Preconditions:** Claude (`claude/darwin`, `claude/windows`) is on the VMs fleet — *"Claude is missing from the VMs fleet — re-apply gitops/premium-fleetqa/fleets/vms.yml"* otherwise; Claude is **installed** on the VM — *"… its 'Claude is installed' policy reinstalls it at the VM's next policy run (a refetch triggers one)"* otherwise.
- **Data created:** none — **but when the library is ahead, it updates Claude on the VM** (a real app update).

**Flow**

1. ☐ (No user action) Resolve the VM; find the Claude Fleet-maintained title for the platform (by name **and** platform — the two are separate titles with the same name).
   - ✅ *(API)* Claude is on the VMs fleet.
   - ✅ *(API)* The VM reports at least one installed Claude version.
2. ☐ (No user action) Decide the state: **behind** iff any installed version is below the library version by Fleet's zero-padded rule. Recorded as a `claude-state` annotation on the test (`installed <versions>, library <version>`) — **read it in the report** to know which branch ran.
3. ☐ Host details → **Software** → **Library** → search **Claude**.
   - ✅ *(UI)* **Library version** equals the API's.
   - ✅ *(UI)* **If behind:** **Update** is offered and **Reinstall** is not. **Otherwise:** **Reinstall** is offered and **Update** is not.
4. ☐ **Only if behind:** click **Update**; wait for installed, **Refetch**, and for the inventory to report the library version.
   - ✅ *(UI)* Install toast.
   - ✅ *(API)* After the update, no installed version is below the library's (*"after updating, installed … vs library …"*).
   - ☐ Reload → Library → search Claude.
   - ✅ *(UI)* **Reinstall** offered, **Update** not.

**Assessment**
- *Value:* the contract on a **real, vendor-moved** Fleet-maintained app on the two platforms the deb pair can't reach, and the only place Windows' four-segment versions meet a three-segment library. The precondition messages are exemplary: each tells the reader exactly how to restore the fixture.
- *Coverage gaps:*
  - **Which branch runs is decided by the calendar.** Most days the VM is level and only the Reinstall half runs; the Update half runs once per vendor release — the first run after the hourly cron fetches a new build — and then the VM is level again. Both outcomes are green, and only the `claude-state` annotation distinguishes them. A regression in the Update branch can sit unnoticed until Claude next ships.
  - **Installed version text is not asserted** here (only Library version), unlike SWH-08 — because a VM can report several versions, or a four-segment one. That leaves the UI's rendering of the installed side on Windows unchecked.
- *Redundancy:* the Reinstall-when-level half duplicates SWH-08 step 2 on a different platform.
- *Efficiency / smells:*
  - **The oracle is a re-implementation.** `isBehind` copies Fleet's `compareVersions` into the spec; if the product's rule changes, the test's copy and Fleet disagree and the test fails *for the right reason* — but if both are wrong the same way (a shared misunderstanding of padding, pre-release suffixes), it passes. SWH-08's literal versions are the counterweight; keep them.
  - Serial coupling: a flaky macOS VM costs the Windows assertion too.

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
- **Mode:** UI+API · **Isolation:** serial describe, step 3 of 3; `finally` **unpins** (`setPinnedVersion(…, '')`); `cleanup-setup` also clears any pin it finds on QA / VMs, for the timeout case where the `finally` never runs
- **Preconditions:** Claude (darwin) on the VMs fleet; **at least two cached builds** (`fleet_maintained_versions`). **Skips** with *"the VMs fleet has cached one Claude build (…); the walk needs the previous one too"* until the vendor ships again and the hourly cron fetches it. **As of 2026-09-28 it skips** — one build cached. Also refuses to start on a pinned title (*"Claude arrived pinned — an earlier run died before restoring it"*).
- **Data created:** none durable — but it **downgrades Claude on the macOS VM to the previous build and updates it back**. Windows never takes this walk: Claude for Windows is an MSIX, and Windows refuses to provision an older MSIX over a newer one.

**Flow**

1. ☐ (No user action) Find the Claude (darwin) title; read its cached versions, newest first: `[newest, previous]`.
   - ✅ *(API)* Claude is on the fleet; the title is **not** pinned.
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
- *Redundancy:* its states are SWH-08's states on a real app; its final Update is SWH-09's behind branch made deterministic.
- *Efficiency / smells:*
  - Step 2 uses `installedVersions[0]` — it assumes the VM reports exactly one Claude build; a VM with two would make the expected Installed-version text arbitrary.
  - If it dies *after* the downgrade (step 3) and before the update, the `finally` unpins but the VM is left **behind** — which self-heals, since the next run's SWH-09 then takes its Update branch. Worth knowing when reading the next run's `claude-state` annotation.
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
3. ☐ Start watching network requests (DevTools → Network, filter `software/package`), then choose the file.
   - ✅ *(UI)* An **error** toast: **"Couldn't add. The maximum file size is <limit>."**, the limit formatted the way Fleet's `formatFileSize` does it (four significant digits, whichever of decimal/binary units reads shorter — `10GiB` for 10 GiB). The spec re-implements that formatter.
   - ✅ *(UI)* **Add software** is **disabled** — the form never took the file.
   - ✅ *(UI — network)* No request to `/software/package` was made after the page loaded.

**Assessment**
- *Value:* pins that the limit is **per instance** (it reads the config instead of trusting QA Wolf's 1 GiB) and that the check happens **client-side on selection**. The sparse file is a genuinely good trick: a 10 GiB test input that costs no disk and no time, and because the browser rejects it, not a byte is read.
- *Coverage gaps:* the **server-side** enforcement is not tested — an API upload over the limit (or a file that lies about its size) is the enforcement layer, and a UI-only check over a permissive server is the shape worth worrying about. The boundary (exactly the limit, accepted) is not tested — impractical at 10 GiB through the browser, but cheap at the API.
- *Redundancy:* none.
- *Efficiency / smells:*
  - **The "nothing was sent" assertion cannot fail as written.** An upload is only sent when **Add software** is clicked, and the test never clicks it — so `uploads` is empty whether the browser refused the file or accepted it. The load-bearing checks are the error toast and the disabled button; the request listener documents intent rather than proving it. To make it bite, try the click (a disabled button can't be clicked — use `{ force: true }` or `dispatchEvent`) and *then* assert no request, or drop the claim.
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
   - ✅ *(UI)* The percentage text **advances**: a later reading is higher than the first (polled ≤ 120 s).
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
  - **It fails on a fast link.** If the first reading is already 100 %, or the modal closes before a higher reading lands, `percent()`'s `innerText` on a detached `.file-details__progress-text` throws and the poll retries until its 120 s timeout — a *faster* instance or runner makes it flakier. Reading the bar's value attribute, or treating "modal gone + success toast" as progress completed, would remove the inversion.
  - `.file-details__progress-text` is a class locator with no comment justifying it (the bar next to it is reached by title).
  - 100 MiB up through the browser to a 2 GB box while the rest of the suite runs in parallel: cheap as a test, not free as load.

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
| Custom package → UI add → install from Library | SWH-01 (`.pkg` / `.msi` / `.deb`) | `.exe`, `.rpm`, `.tar.gz`, script packages; installs started anywhere but the host's Library |
| Fleet-maintained app → catalog add → install | SWH-02 (Itsycal, macOS) | Windows FMA install; self-service |
| Deploy / automatic-install policy | SWH-03 (`.deb`) | The policy in the Policies UI; the policy passing afterwards; Deploy for `.pkg` / `.msi` |
| Uninstall | SWH-04 (four types, incl. the unlinked `.exe`) | Uninstall details **Details** output; uninstall started from the title page |
| Failed uninstall | SWH-05 | **Retry uninstall** clicked; the Inventory tab after a failure |
| Failed install + Fleet's 3 attempts | SWH-07 | The failure reason in the details modal; **Retry** clicked |
| Library vs Inventory distinction | SWH-04 (Inventory after uninstall), SWH-06 (after install), SWH-07 (pending/failed) | The Inventory tab after a `.pkg`, `.msi` or FMA install |
| Update / Reinstall contract | SWH-08 (fixed oracle, Linux), SWH-09 (Claude, both, state-dependent), SWH-10 (Claude walk — **skipping**) | Deterministic Windows zero-padding case; library moved via **Edit software**; clicking Reinstall when the host is ahead |
| Version pinning on a host | SWH-10 only — **never executed yet** | Pin via the Versions modal |
| Upload size limit | SWH-11 (browser-side) | Server-side enforcement; the boundary |
| Upload progress | SWH-12 | Cancel mid-upload |
| Upcoming activity after a queue | **nothing, deliberately** (intro §6) | API `pending_*` stands in; nothing checks the Upcoming tab ever shows the item |

**Duplication**

1. **SWH-01 (Linux) vs SWH-06.** Same package type, same VM, same install-and-settle; SWH-06's unique content is one Inventory-tab look. Moving that look into `installFromLibrary` covers four install types and frees ~5 min on the busiest VM.
2. **SWH-08 vs SWH-09/10.** Intentional — a fixed oracle and a real app — but three Update tests share one describe's worth of meaning; SWH-10 is SWH-09's Update branch made deterministic, once it runs.
3. **Every `finally` is a silent uninstall.** SWH-01/02/03/06/08 each end with the uninstall SWH-04 tests explicitly — correct hygiene, and the reason a Fleet uninstall regression would first surface as a cleanup error in an install test.

**UI-vs-API balance**

- **Preconditions through the API are deliberate and right**: SWH-04/05 install by API so their failures are about uninstalling; SWH-06/07/08 upload by API so the add form isn't under test four more times. SWH-01/02/03 carry the UI add path.
- **Status waits are API by necessity.** The host is the oracle and it reports on its own schedule; the UI then asserts the outcome on a fresh render. The `(API)` checks inside the waits (`pending_*`, `detail_updated_at` moving, inventory agreeing) are contract checks, not shortcuts.
- **Where the API stands in for a UI check that should exist:** the Inventory tab after `.pkg` / `.msi` / FMA installs (SWH-01/02), the Deploy policy in the Policies UI (SWH-03), the Inventory tab after a failed uninstall (SWH-05), and the Library-version expectation taken from the API rather than the fixture (SWH-01).
- **Weak-assertion watch list:** SWH-11's request listener (cannot fail — nothing submits); SWH-04's `.exe` `---` after uninstall (it was `---` before); SWH-06 step 2 (a brand-new name is trivially absent); SWH-05's modal substring (matches success wording too); SWH-09's pass on whichever branch the calendar picked.

**Product and fixture context a re-runner should carry**

- **Custom `.exe` titles are never linked to inventory** — by design since
  [fleetdm/fleet#20440](https://github.com/fleetdm/fleet/issues/20440). The Library will never show 7-Zip an installed version; that is not a regression.
- **The automatic-install `created_policy` activity has no fleet suffix** — on the decision list, encoded in SWH-03.
- **`software_updated_at` means "inventory last changed", not "last collected"** — don't wait on it by hand either; watch "Last fetched" (detail) instead.
- **`vms.yml`'s header is partly stale:** it says `cleanup.steps.ts` does not touch the fleet and a dead spec's leftovers stay "until the next apply". The sweep now removes the specs' named titles and install policies every run (it still never uninstalls from a host).

**Quick wins**

1. **Poll the `.exe` row's inventory reads** in SWH-04 (`installedPackage`'s `.not.toEqual([])` and the post-uninstall `.toEqual([])`), the way `waitForSoftwareSettled` polls the linked path. As written they are single reads straight after a refetch whose software half can land seconds late — [uninstall-from-host.spec.ts:84](../../tests/e2e/premium/software/uninstall-from-host.spec.ts#L84), [:168](../../tests/e2e/premium/software/uninstall-from-host.spec.ts#L168).
2. **Assert the fixtures' known version** (`1.0.0`) as the Library version in SWH-01's custom-package rows instead of the API's reading, so a version-parse bug can't pass on the API agreeing with itself — [install-on-host.spec.ts:180](../../tests/e2e/premium/software/install-on-host.spec.ts#L180).
3. **Open the Inventory tab in `installFromLibrary`** (SWH-01/02). Covers `.pkg`, `.msi` and the FMA, and makes SWH-06 a merge candidate.
4. **Read the failure reason in SWH-07**: click **Failed** → Install details → **Details**, assert dpkg's architecture error. One click, and it is the only assertion that proves *why* the install failed.
5. **Make SWH-11's "nothing sent" claim bite or drop it** — [large-upload.spec.ts:89](../../tests/e2e/premium/software/large-upload.spec.ts#L89).
6. **Stop SWH-12 failing on a fast upload**: treat a vanished modal + the success toast as completed progress, or read the bar's value rather than `innerText` of a node that disappears.
7. **Fix the `vms.yml` header** to describe the sweep, and name `MaxSoftwareInstallAttempts` at SWH-07's `toEqual([… × 3])`.

**Bigger bets**

1. **Budget the VMs, not just the tests.** With `fullyParallel`, seven tests queue on the one Ubuntu VM, four on Windows and five on macOS; each test's internal waits already sum past its own timeout, CI retries twice, and the job limit is 60 min against a ~40 min run. The 2026-09-28 `--repeat-each` failures were exactly this (one Ubuntu VM carrying ~50 serialized installs). A per-VM concurrency cap — one worker-scoped lock per platform, or grouping each platform's tests into one serial describe — trades a little wall time for runs that fail for product reasons rather than queue depth.
2. **Uninstall what the sweep deletes.** The sweep removes titles but never touches the machine, so every timed-out run leaves its per-run `fleet-pw-*` `.deb` installed on the Ubuntu VM for good (the fixed-name `.pkg`/`.msi` are rescued by `ensureNotInstalled` on the next run; per-run names never are), and SWH-05's fire-and-forget purge is unverified. One ad-hoc script in `cleanup.steps.ts` — `dpkg-query -W -f '${Package}\n' 'fleet-pw-*' | xargs -r apt-get remove --purge -y` on the Ubuntu VM — would keep the VM's inventory from accumulating fixtures across months.
3. **Watch SWH-10's first real run.** The whole pin-back walk is authored and reviewed but has only ever skipped. When Claude next ships, the first nightly after the cron fetches the build is the walk's real verification — worth a manual headed run that day rather than trusting the green.
4. **Cover the Update contract on Windows deterministically.** `make-msi.sh` already derives the UpgradeCode from the role so a newer build upgrades an older one; a 1.0.0 / 1.1.0 `.msi` pair (and a `1.0.0.0` vs `1.0.0` variant for the padding rule) would give Windows what SWH-08 gives Linux, and take SWH-09's calendar-dependence off the critical path.
