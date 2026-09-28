# Hosts — premium — test audit

**Specs covered:** 6 files · **Entries:** 12 (16 runtime `test()` declarations — three parameterized loops are collapsed into one entry each, with every generated title listed) · **Project:** premium

Premium-only host flows: moving hosts between fleets (bulk and single-host, per role), deleting hosts (bulk, from host details, and as a team admin), drilling a report card into one host's stored results, and the role/platform gating of the hosts-list CTAs and the host Actions menu. All six specs resolve their hosts through the API at runtime — never by name — because the premium QA instance is ~300 osquery-perf **simulations** plus one or two real MDM-enrolled VMs. Mutating specs draw disjoint slices of the simulated pool via `findSimulatedHostIds(platform, count, offset)`; read-only device-fidelity specs take the real VM via the `liveMacosHost` worker fixture.

> **Destructive-area warning.** [`host-delete.spec.ts`](../../tests/e2e/premium/hosts/host-delete.spec.ts) permanently deletes **4 online simulated hosts per full-file run** (2 macOS + 1 macOS + 1 Windows). Nothing in the suite restores them. See [HOSTP-06](#hostp-06--premium--hosts--bulk-delete--deletes-the-selected-hosts) for the exact restore procedure and cost.

## Contents

| ID | Spec | Test | Mode | Manual? |
|---|---|---|---|---|
| HOSTP-01 | `premium/hosts/bulk-transfer.spec.ts` | bulk transfer › transfers the selected hosts to another fleet | UI+API | ☐ |
| HOSTP-02 | `premium/hosts/bulk-transfer.spec.ts` | bulk transfer › fleet dropdown filters to a single match as you type | UI | ☐ |
| HOSTP-03 | `premium/hosts/bulk-transfer.spec.ts` | bulk transfer › a full page of selections offers to widen past the page | UI | ☐ |
| HOSTP-04 | `premium/hosts/host-transfer-permissions.spec.ts` | single-host transfer by role › global admin / global maintainer | UI+API | ☐ |
| HOSTP-05 | `premium/hosts/host-transfer-permissions.spec.ts` | single-host transfer by role › team admin is not offered Transfer | UI | ☐ |
| HOSTP-06 | `premium/hosts/host-delete.spec.ts` | bulk delete › deletes the selected hosts **(destructive)** | UI+API | ☐ |
| HOSTP-07 | `premium/hosts/host-delete.spec.ts` | delete by role › team admin can delete on a fleet they administer **(destructive)** | UI+API | ☐ |
| HOSTP-08 | `premium/hosts/host-delete.spec.ts` | delete from host details › deletes the host and returns to the list **(destructive)** | UI+API | ☐ |
| HOSTP-09 | `premium/hosts/host-report-details.spec.ts` | host report results › drills into this host and out to all hosts | UI+API | ☐ |
| HOSTP-10 | `premium/hosts/cta-visibility.spec.ts` | CTA visibility › global-admin / global-maintainer see all three CTAs | UI | ☐ |
| HOSTP-11 | `premium/hosts/cta-visibility.spec.ts` | CTA visibility › global observer sees only Export hosts | UI | ☐ |
| HOSTP-12 | `premium/hosts/mdm-actions-availability.spec.ts` | MDM action availability › macOS / Windows / Ubuntu matrix | UI | ☐ |

`Mode`: **UI** (all validation through the browser), **UI+API** (browser flow, some assertions via API), **API**, **PERF**.

---

### HOSTP-01 · Premium • Hosts • bulk transfer › transfers the selected hosts to another fleet

- **File:** [`playwright/tests/e2e/premium/hosts/bulk-transfer.spec.ts`](../../tests/e2e/premium/hosts/bulk-transfer.spec.ts)
- **Grep:** `npx playwright test -g "transfers the selected hosts to another fleet"`
- **Project:** premium · **Scope:** the **QA** fleet (staged) → Unassigned
- **Mode:** UI+API · **Isolation:** parallel, self-contained; `finally` restores
- **Preconditions:** QA fleet exists (`qaFleetId` worker fixture resolves it by name via `GET /fleets`, throws if missing); ≥3 **online, non-MDM-enrolled (simulated) macOS** hosts on the instance
- **Data created:** none permanent — 3 simulated macOS hosts are moved to QA and back to Unassigned

**Flow**

1. ☐ *(API setup)* `findSimulatedHostIds(request, 'darwin', 3)` → walks `GET /hosts?status=online&platform=darwin&mdm_enrollment_status=unenrolled&per_page=100&order_key=display_name&order_direction=desc`, page by page (max 10 pages), client-filtering each page on the host's real `platform` field, until 3 matches exist; takes slice `[0,3)`.
   - ✅ *(API)* exactly 3 simulated macOS hosts resolved (`toHaveLength(3)`).
2. ☐ *(API setup)* `POST /hosts/transfer { team_id: <QA>, hosts: [...] }` stages the 3 hosts into QA.
   - ✅ *(API)* transfer response is OK (asserted inside `transferHosts`).
3. ☐ Open **Hosts** at `/hosts/manage?fleet_id=<QA>` **via URL**.
   - ✅ *(UI)* the table's first row containing a link is visible (`HostsListPage.goto` anchor).
4. ☐ Select **QA** in the fleet dropdown (idempotent — no click if already showing QA).
   - ✅ *(UI)* the dropdown's current value reads exactly `QA` (`TeamDropdown.selectByLabel`).
   - ✅ *(UI)* first row with a link still visible (re-asserted in the spec).
5. ☐ Tick the table header's select-all checkbox.
   - ✅ *(UI)* the bulk-select bar (`thead.active-selection`) is visible (`selectAllOnPage`).
   - ✅ *(UI)* the tally reads `3 selected`.
   - ✅ *(UI)* **Select all matching hosts** is **hidden** — only a *full* page offers widening.
6. ☐ Click **Transfer** in the bulk bar.
   - ✅ *(UI)* the Transfer modal is visible (`openTransferForSelection`).
   - ✅ *(UI)* the modal's **Transfer** submit is **disabled** before a destination is picked.
   - ✅ *(UI)* the **Add a fleet** link is visible.
7. ☐ Open the fleet dropdown, pick **Unassigned**, click **Transfer**.
   - ✅ *(UI)* the modal closes (`transferTo`).
   - ✅ *(UI)* success toast `Hosts successfully removed`.
   - ✅ *(UI)* QA's table body now has **0** rows.
   - ✅ *(API)* `GET /hosts/:id` → `team_id === null` for each of the 3 hosts.
8. ☐ *(API teardown, `finally`)* `POST /hosts/transfer { team_id: null }` — a no-op after a successful UI transfer, the actual restore when the test fails mid-flight. `cleanup.steps.ts` never moves hosts, so without this a leaked transfer would persist.

**Assessment**
- *Value:* the whole bulk-transfer path — header checkbox → selection bar → modal gating → submit → toast → server truth. Would catch a broken bulk endpoint, a modal that submits without a destination, or a list that doesn't refresh after the move.
- *Coverage gaps:* the transfer *into* a named fleet is done by API, so the UI only ever transfers **to Unassigned**; no assertion the hosts show up under Unassigned in the list; no `transferred_hosts` activity-feed assertion; **Select all matching hosts** is never exercised (deliberate — it would target the whole load fleet).
- *Redundancy:* HOSTP-02 and HOSTP-03 repeat steps 3–6 for one extra assertion each; HOSTP-04 covers the same modal from host details with a real destination pick.
- *Efficiency / smells:* **cross-spec race** — the spec's docstring claims QA "holds exactly this test's hosts", but [`host-transfer-permissions.spec.ts:55`](../../tests/e2e/premium/hosts/host-transfer-permissions.spec.ts) transfers a Windows sim **into QA** and both files run in parallel (`fullyParallel: true`, 2 workers in CI). An overlapping window makes `3 selected` (`bulk-transfer.spec.ts:48`) see 4, or moves the other spec's host out from under it. The count assertion fails fast rather than mis-transferring, so this is a flake, not a data-loss risk. `hostsList.table.table.locator('tbody').getByRole('row')` at `:63` reaches through the component object instead of using a `DataTable` accessor.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOSTP-02 · Premium • Hosts • bulk transfer › fleet dropdown filters to a single match as you type

- **File:** [`playwright/tests/e2e/premium/hosts/bulk-transfer.spec.ts`](../../tests/e2e/premium/hosts/bulk-transfer.spec.ts)
- **Grep:** `npx playwright test -g "fleet dropdown filters to a single match as you type"`
- **Project:** premium · **Scope:** Unassigned (no staging)
- **Mode:** UI · **Isolation:** parallel; mutates nothing (never submits)
- **Preconditions:** at least one host in Unassigned; a fleet named `Workstations`
- **Data created:** none

**Flow**

1. ☐ Open `/hosts/manage?fleet_id=0` **via URL**; select **Unassigned** in the fleet dropdown.
   - ✅ *(UI)* first row with a link visible (goto anchor + explicit re-assert); dropdown value reads `Unassigned`.
2. ☐ Tick the header select-all checkbox (selects the whole 50-row page of the load fleet — safe because nothing is submitted).
   - ✅ *(UI)* bulk-select bar visible.
3. ☐ Click **Transfer** → ✅ *(UI)* the Transfer modal is visible.
4. ☐ Click the fleet dropdown and type `Workstations` into its combobox.
   - ✅ *(UI)* exactly **1** option remains.
   - ✅ *(UI)* that option's text is `Workstations`.

**Assessment**
- *Value:* proves the destination dropdown is searchable/filterable — a react-select regression would surface here.
- *Coverage gaps:* doesn't assert the current fleet is *excluded* from the options, doesn't assert `Unassigned` is offered when hosts are on a fleet, doesn't assert a no-match state.
- *Redundancy:* steps 1–3 duplicate HOSTP-01 steps 3–6 and HOSTP-03 steps 1–2. Cheapest merge in the area: fold this assertion into HOSTP-01, which already has the modal open with the dropdown untouched.
- *Efficiency / smells:* selects a full page of the shared load fleet purely to raise a modal; a single-row selection would do.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOSTP-03 · Premium • Hosts • bulk transfer › a full page of selections offers to widen past the page

- **File:** [`playwright/tests/e2e/premium/hosts/bulk-transfer.spec.ts`](../../tests/e2e/premium/hosts/bulk-transfer.spec.ts)
- **Grep:** `npx playwright test -g "a full page of selections offers to widen past the page"`
- **Project:** premium · **Scope:** Unassigned
- **Mode:** UI · **Isolation:** parallel; mutates nothing
- **Preconditions:** Unassigned holds more than one page (50) of hosts — true of the load fleet
- **Data created:** none

**Flow**

1. ☐ Open `/hosts/manage?fleet_id=0` **via URL**; select **Unassigned**.
   - ✅ *(UI)* first row with a link visible; dropdown reads `Unassigned`.
2. ☐ Tick the header select-all checkbox.
   - ✅ *(UI)* the selection bar contains `All hosts on this page are selected`.
   - ✅ *(UI)* **Select all matching hosts** is visible — observed, **never clicked** (clicking would widen the selection to the entire load fleet that sibling specs read).
3. ☐ Click **Clear selection**.
   - ✅ *(UI)* the selection bar is hidden.

**Assessment**
- *Value:* the positive counterpart of HOSTP-01's "widening affordance hidden" assertion, plus the only Clear-selection coverage in the area.
- *Coverage gaps:* doesn't assert the tally equals the page size (50), doesn't assert rows are visually deselected after Clear selection, and the widening button's *behaviour* is untested by design.
- *Redundancy:* steps 1–2 are shared with HOSTP-02. Both could live in one "selection bar" test.
- *Efficiency / smells:* none beyond the shared setup duplication.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOSTP-04 · Premium • Hosts • single-host transfer by role › a global admin / global maintainer can transfer a host to another fleet

- **File:** [`playwright/tests/e2e/premium/hosts/host-transfer-permissions.spec.ts`](../../tests/e2e/premium/hosts/host-transfer-permissions.spec.ts)
- **Grep:** `npx playwright test -g "can transfer a host to another fleet"` (two runtime tests: `a global admin can transfer a host to another fleet`, `a global maintainer can transfer a host to another fleet`)
- **Project:** premium · **Roles:** `global-admin` (host index 0), `global-maintainer` (host index 1) · **Destination:** the **QA** fleet
- **Mode:** UI+API · **Isolation:** parallel; each role claims its own host by index; `finally` restores
- **Preconditions:** static users `global-admin@fleetdm.com` / `global-maintainer@fleetdm.com` provisioned with `FLEET_STATIC_USER_PASSWORD`; ≥2 online simulated **Windows** hosts; QA fleet exists
- **Data created:** none permanent — one simulated Windows host moves to QA and back to Unassigned per role

**Flow**

1. ☐ *(API setup)* `findSimulatedHostIds(request, 'windows', 2)` — same paged, `desc`-ordered, unenrolled-only walk as HOSTP-01; each role then indexes into the slice.
   - ✅ *(API)* 2 simulated Windows hosts resolved.
2. ☐ Log in as the role in a fresh browser context (`withStaticUser` restores a cached `.auth/static-premium-<role>.json` session, re-logging in through the **/login** form only if the session bounced — Fleet rate-limits `POST /login` to 10/min suite-wide).
3. ☐ Open the host at `/hosts/:id` **via URL**.
   - ✅ *(UI)* the vitals label **Disk space available** is visible (`HostDetailsPage.goto` anchor).
4. ☐ Click **Actions** → **Transfer**.
   - ✅ *(UI)* the Transfer modal is visible.
   - ✅ *(UI)* the modal's **Transfer** submit is **disabled** before a destination is picked.
5. ☐ Open the fleet dropdown, pick **QA**, click **Transfer**.
   - ✅ *(UI)* the modal closes.
   - ✅ *(UI)* success toast `Host successfully transferred to QA.` (Fleet renders a double space before the fleet name; Playwright's whitespace normalisation makes the single-spaced form match).
   - ✅ *(UI)* the host's vitals **Fleet** value contains `QA`.
   - ✅ *(API)* `GET /hosts/:id` → `team_id === qaFleetId`.
6. ☐ *(API teardown, `finally`)* transfer the host back to `team_id: null`.

**Assessment**
- *Value:* Fleet's `canTransferTeam` gate for both global write roles, plus the single-host transfer path end to end (menu → modal → toast → vitals → server).
- *Coverage gaps:* no `transferred_hosts` activity-feed assertion; no negative case for `global-observer` / `global-observer-plus` / `global-technician`; transferring *between two named fleets* (rather than Unassigned → QA) is untested; nothing checks the host disappears from the Unassigned list.
- *Redundancy:* the modal-gating assertion (`Transfer` disabled) duplicates HOSTP-01 step 6; the destination-pick + toast overlaps HOSTP-01's transfer, and the QA fleet is shared with it — see the race noted in HOSTP-01.
- *Efficiency / smells:* both role cases run the full pool walk (`findSimulatedHostIds(..., 2)`) to use one host — two identical multi-page API walks. Tests running under `withStaticUser` operate on a **second** browser context, which the auto `pageHealth` fixture does not monitor (it watches the `page` fixture), so console/5xx errors in these flows go unobserved — true of HOSTP-05/07/10/11 as well.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOSTP-05 · Premium • Hosts • single-host transfer by role › a team admin is not offered Transfer on a host they administer

- **File:** [`playwright/tests/e2e/premium/hosts/host-transfer-permissions.spec.ts`](../../tests/e2e/premium/hosts/host-transfer-permissions.spec.ts)
- **Grep:** `npx playwright test -g "a team admin is not offered Transfer on a host they administer"`
- **Project:** premium · **Role:** `team-admin` (admin on **Workstations** + **VMs**)
- **Mode:** UI · **Isolation:** parallel; read-only
- **Preconditions:** the real, MDM-enrolled, online macOS VM (`liveMacosHost` worker fixture — `GET /hosts?status=online&platform=darwin&mdm_enrollment_status=enrolled`, first by display name; throws a setup error if none)
- **Data created:** none

**Flow**

1. ☐ Log in as `team-admin@fleetdm.com` in a fresh context (cached session, see HOSTP-04 step 2).
2. ☐ Open the real macOS VM at `/hosts/:id` **via URL**.
   - ✅ *(UI)* **Disk space available** vitals label visible.
3. ☐ Click **Actions**.
   - ✅ *(UI)* at least one option rendered (`openActions` anchor).
   - ✅ *(UI)* **Delete** is visible — the canary proving the menu rendered *for this role* rather than the next assertion passing on an unrendered menu (`canDeleteHost` admits team admins).
   - ✅ *(UI)* **Transfer** has count **0** (`canTransferTeam` requires a global role).

**Assessment**
- *Value:* the one negative-permission assertion in the transfer area, and a well-built one — the Delete canary rules out a false pass.
- *Coverage gaps:* ⚠️ the spec's header states the VM sits in the **VMs** fleet (which this team admin administers), but the fixture resolves it by platform + MDM enrollment only, never by fleet — if the VM were moved out of VMs/Workstations, the page would 403 and the Delete canary would fail (loud, not silent, so acceptable). No coverage of the other options a team admin should/shouldn't see (Run script, Lock, Wipe, Turn off MDM), and none for `ws-maintainer` / `ws-observer`.
- *Redundancy:* overlaps HOSTP-12 in mechanism (open Actions, count options) but asserts a different dimension (role, not platform).
- *Efficiency / smells:* uses the scarce real VM for a check that only needs a host inside the team admin's fleets — a simulated host staged into VMs would do, at the cost of a staging step. Second-context console errors unmonitored (see HOSTP-04).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOSTP-06 · Premium • Hosts • bulk delete › deletes the selected hosts

> **DESTRUCTIVE — deletes 2 online simulated macOS hosts. Nothing restores them.**

- **File:** [`playwright/tests/e2e/premium/hosts/host-delete.spec.ts`](../../tests/e2e/premium/hosts/host-delete.spec.ts)
- **Grep:** `npx playwright test -g "deletes the selected hosts"`
- **Project:** premium · **Scope:** the **Workstations** fleet (staged)
- **Mode:** UI+API · **Isolation:** parallel; pool slice `offset 10` keeps it clear of HOSTP-01 (`offset 0`) and HOSTP-07 (`offset 20`)
- **Preconditions:** ≥12 online simulated macOS hosts (needs `offset+count` = 12 platform matches to exist); Workstations holds **no other hosts** (see safety rails)
- **Data destroyed:** 2 simulated macOS hosts, permanently. No teardown, by design.

**Flow**

1. ☐ *(API setup)* `findSimulatedHostIds(request, 'darwin', 2, 10)` — paged, `desc` display-name order, `mdm_enrollment_status=unenrolled` so a real VM can never be returned; slice `[10,12)`.
   - ✅ *(API)* exactly 2 hosts resolved.
2. ☐ *(API setup)* `POST /hosts/transfer { team_id: <Workstations>, hosts: [...] }`.
   - ✅ *(API)* response OK.
3. ☐ Open `/hosts/manage?fleet_id=<Workstations>` **via URL**; select **Workstations** in the fleet dropdown.
   - ✅ *(UI)* first row with a link visible; dropdown reads `Workstations`.
4. ☐ Tick the header select-all checkbox.
   - ✅ *(UI)* bulk-select bar visible.
   - ✅ *(UI)* tally reads `2 selected` — **safety rail**, runs before any confirm.
5. ☐ Click **Delete** in the bulk bar.
   - ✅ *(UI)* the `.delete-host-modal` confirmation is visible.
   - ✅ *(UI)* the modal contains `This will remove 2 hosts` — **second safety rail**.
6. ☐ Click **Delete** in the modal.
   - ✅ *(UI)* the modal closes (`confirmDelete`).
   - ✅ *(UI)* success toast `Hosts successfully deleted.`
   - ✅ *(UI)* Workstations' table body has **0** rows.
   - ✅ *(API)* `GET /hosts/:id` is not OK (host gone) for both ids.

**Manual re-run cost / restore**

- The 2 hosts are gone for good. Simulations do **not** re-enroll: osquery-perf enrolls once at daemon startup and has no node-invalid recovery, so Fleet's delete-modal promise that hosts "will re-appear unless Fleet's agent is uninstalled" holds for real fleetd but not for the load fleet.
- Restoring the pool means restarting the simulator on the MacStadium VM: `sudo launchctl kickstart -k system/com.fleetqa.perf.premium` ([`tools/perf-hosts/README.md`](../../../tools/perf-hosts/README.md)). That enrolls a **brand-new ~300-host set with new ids** and abandons the old set; `host_expiry_settings = 1 day` then deletes the abandoned hosts within a day.
- ⚠️ The spec header says the pool "is repopulated by the scheduled daily refresh in `tools/perf-hosts/`". That refresh (`com.fleetqa.perf.refresh.plist`, 09:00 daily) is **optional** and only installed with `install.sh --daily-refresh`. If it isn't installed on the VM, nothing repopulates automatically and each full-file run shrinks the online pool by 4 hosts until someone kickstarts the daemon. Worth verifying on the VM and correcting one of the two docs.
- Practical manual-run guidance: running this file by hand a handful of times is harmless (pool ~300); running it in a loop is not. Check `GET /hosts?status=online&platform=darwin&mdm_enrollment_status=unenrolled` still returns ≥21 matches before a session, since HOSTP-07 needs slice index 20.

**Assessment**
- *Value:* the only coverage of bulk host deletion — the highest-consequence bulk action in the product. Both the "N selected" tally and the modal's "This will remove N hosts" copy are contract-checked before the irreversible click.
- *Coverage gaps:* no activity-feed assertion (`deleted_host` / bulk equivalent); no negative case (observer can't bulk-delete); no cancel path (open the modal, click Cancel, host survives) — a cheap and valuable addition given the risk; no assertion of the deleted hosts disappearing from the *global* list, only from the staged fleet.
- *Redundancy:* the delete-modal + toast + `hostExists` triple is repeated by HOSTP-07 and HOSTP-08 with different entry points.
- *Efficiency / smells:* **no `finally`** — if the UI leg fails after step 2, the 2 sims are left in **Workstations** and `cleanup.steps.ts` never moves hosts, so the *next* run's `2 selected` rail fails against 4 rows and the spec stays red until someone manually transfers them out. Staging into Workstations is also the riskiest fleet choice available: it is the fleet the whole premium suite exercises and that `cleanup-setup`/`cleanup-teardown` wipe the *content* of (not the host membership). A dedicated scratch fleet, or QA-style isolation with per-spec fleets, would remove both problems. Raw table reach-through at `host-delete.spec.ts:50`.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOSTP-07 · Premium • Hosts • delete by role › a team admin can delete a host on a fleet they administer

> **DESTRUCTIVE — deletes 1 online simulated macOS host. Nothing restores it.**

- **File:** [`playwright/tests/e2e/premium/hosts/host-delete.spec.ts`](../../tests/e2e/premium/hosts/host-delete.spec.ts)
- **Grep:** `npx playwright test -g "a team admin can delete a host on a fleet they administer"`
- **Project:** premium · **Role:** `team-admin` · **Scope:** the **VMs** fleet (staged)
- **Mode:** UI+API · **Isolation:** parallel; pool slice `offset 20`; staged into VMs rather than Workstations so it can't collide with HOSTP-06
- **Preconditions:** ≥21 online simulated macOS hosts; `team-admin@fleetdm.com` provisioned (admin on Workstations + VMs)
- **Data destroyed:** 1 simulated macOS host, permanently

**Flow**

1. ☐ *(API setup)* `findSimulatedHostIds(request, 'darwin', 1, 20)` → slice `[20,21)`.
   - ✅ *(API)* a host was resolved (`toBeDefined`).
2. ☐ *(API setup)* `POST /hosts/transfer { team_id: <VMs> }` — a team admin only sees hosts on their own fleets, so the host must be staged before they can act on it.
   - ✅ *(API)* response OK.
3. ☐ Log in as `team-admin` in a fresh context (cached session).
4. ☐ Open `/hosts/:id` **via URL** → ✅ *(UI)* **Disk space available** visible.
5. ☐ Click **Actions** → **Delete**.
   - ✅ *(UI)* the `.delete-host-modal` is visible.
6. ☐ Click **Delete** in the modal.
   - ✅ *(UI)* the modal closes.
   - ✅ *(UI)* success toast `Host "<display name>" was successfully deleted.`
7. ☐ ✅ *(API)* `GET /hosts/:id` is not OK — the host is gone.

**Assessment**
- *Value:* proves `canDeleteHost` admits a team admin for a host inside their fleets — the positive half of the RBAC pair whose negative half is HOSTP-05.
- *Coverage gaps:* no assertion the team admin lands back on the hosts list after deleting (HOSTP-08 does that as admin); no negative case (team **observer** must not be offered Delete; team admin must not delete a host *outside* their fleets); the modal's per-host copy isn't checked here (HOSTP-08 checks it).
- *Redundancy:* the delete flow itself is HOSTP-08 run as a different role — the only real delta is the role and the staging.
- *Efficiency / smells:* **no `finally`**, so a failure between steps 2 and 7 parks a simulated host permanently in the **VMs** fleet — the fleet that is supposed to hold only the real QA VMs, and which HOSTP-09 and `vmsFleetId` consumers reason about. Costs one destroyed host to assert a permission that a `GET`-level role probe under `tests/api/role-access/premium/` could establish more cheaply; the UI-level assertion worth keeping is the *offer* of Delete (already covered by HOSTP-05's canary).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOSTP-08 · Premium • Hosts • delete from host details › deletes the host and returns to the hosts list

> **DESTRUCTIVE — deletes 1 online simulated Windows host. Nothing restores it.**

- **File:** [`playwright/tests/e2e/premium/hosts/host-delete.spec.ts`](../../tests/e2e/premium/hosts/host-delete.spec.ts)
- **Grep:** `npx playwright test -g "deletes the host and returns to the hosts list"`
- **Project:** premium · **Scope:** Unassigned (no staging)
- **Mode:** UI+API · **Isolation:** parallel; Windows pool slice `offset 10`, clear of HOSTP-04's `offset 0`
- **Preconditions:** ≥11 online simulated Windows hosts
- **Data destroyed:** 1 simulated Windows host, permanently. Nothing is staged, so this case leaks nothing on failure.

**Flow**

1. ☐ *(API setup)* `findSimulatedHostIds(request, 'windows', 1, 10)` → slice `[10,11)`.
   - ✅ *(API)* a host was resolved.
2. ☐ Open `/hosts/:id` **via URL** as the suite admin → ✅ *(UI)* **Disk space available** visible.
3. ☐ Click **Actions** → **Delete**.
   - ✅ *(UI)* the `.delete-host-modal` is visible.
   - ✅ *(UI)* the modal contains `This will remove <display name>` — the per-host confirmation copy, and a rail against deleting the wrong host.
4. ☐ Click **Delete** in the modal.
   - ✅ *(UI)* the modal closes.
   - ✅ *(UI)* success toast `Host "<display name>" was successfully deleted.`
   - ✅ *(UI)* a hosts-list table with a linked first row is visible — stands in for "returned to the hosts list".
   - ✅ *(API)* `GET /hosts/:id` is not OK.

**Assessment**
- *Value:* the single-host delete path plus the post-delete redirect; the per-host modal copy assertion is the strongest anti-wrong-host check in the file.
- *Coverage gaps:* no URL assertion for the redirect; no cancel path; no activity-feed assertion; the deleted host isn't searched for in the list to prove it's gone from the UI (only the API says so).
- *Redundancy:* same flow as HOSTP-07 minus the role and staging; the API existence check is the third copy in the file.
- *Efficiency / smells:* the "returned to the hosts list" assertion uses the generic `DataTable` (`hostsList.table.firstRowWithLink`) with **no URL check** — any page rendering a table with a link would satisfy it. `await expect(page).toHaveURL(/\/hosts\/manage/)` would make it real. This is the one delete case that could be merged into HOSTP-07 (run it as team-admin and keep both the copy assertion and the redirect assertion) to save a destroyed host per run.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOSTP-09 · Premium • Hosts • host report results › a report with stored results drills into this host and out to all hosts

- **File:** [`playwright/tests/e2e/premium/hosts/host-report-details.spec.ts`](../../tests/e2e/premium/hosts/host-report-details.spec.ts)
- **Grep:** `npx playwright test -g "a report with stored results drills into this host and out to all hosts"`
- **Project:** premium · **Scope:** the **VMs** fleet
- **Mode:** UI+API · **Isolation:** parallel; read-only
- **Preconditions:** **instance furniture** — a report named `pw-host-report-results` on the VMs fleet with `interval: 300`, `platform: darwin`, `logging: snapshot`, query `SELECT 'bar' AS foo;`, plus at least one elapsed interval so the real macOS VM has a stored result. Deliberately not created by the test: global reports are wiped by `cleanup-setup`, and self-provisioning would cost ~3.5 min of waiting per run. The real macOS VM must be online (`liveMacosHost`).
- **Data created:** none

**Flow**

1. ☐ *(API precondition)* `findReportByName(request, 'pw-host-report-results', <VMs fleet id>)` — lists fleet-scoped reports.
   - ✅ *(API)* the seeded report exists (failure message points at the spec header's recreation recipe).
2. ☐ *(API precondition)* `getHostReportLastFetched` → `GET /hosts/<vm>/queries?per_page=100`.
   - ✅ *(API)* the report has a non-null `last_fetched` for the VM — the gate `HostReportCard.tsx` uses to offer **Show details**.
3. ☐ Open the VM at `/hosts/:id` **via URL** → ✅ *(UI)* **Disk space available** visible.
4. ☐ Click the **Reports** tab.
   - ✅ *(UI)* the URL ends in `/reports`.
   - ✅ *(UI)* report cards or the "No reports scheduled" empty state have rendered (`openReportsTab`).
5. ☐ Type the report name into **Search by name**.
   - ✅ *(UI)* a report card with that exact `h3` heading is visible.
6. ☐ Open that card's Actions menu → **Show details**.
   - ✅ *(UI)* the **Back to host details** button is visible (`HostQueryReportPage.waitForReady`).
   - ✅ *(UI)* URL matches `/hosts/<hostId>/reports/<reportId>`.
   - ✅ *(UI)* the page's `h1` equals the **host's** display name (the per-host results page titles itself with the host, not the report).
   - ✅ *(UI)* the first results row contains `bar` — the value the seeded query selects, proving real stored results rather than an empty shell.
7. ☐ Click **View data for all hosts**.
   - ✅ *(UI)* URL matches `/reports/<reportId>`.
   - ✅ *(UI)* the report-details `h1` contains the report name.

**Assessment**
- *Value:* the only coverage of per-host stored query results and the host↔report navigation pair; catches a broken `Show details` gate, a mis-routed drill-down, or results that render empty.
- *Coverage gaps:* doesn't assert the column header (`foo`), the row count, or the page's "last fetched" line; no negative case (a report *without* stored results must not offer **Show details**) — that's the other half of the `last_fetched` gate and would be cheap on a simulated host; no **Back to host details** round-trip.
- *Redundancy:* the Reports-tab search/sort surface is covered by [`shared/hosts/host-reports-tab.spec.ts`](../../tests/e2e/shared/hosts/host-reports-tab.spec.ts); this spec only re-uses the search to find its card.
- *Efficiency / smells:* the two API preconditions are guardrails rather than validations — good, they turn missing furniture into a clear message instead of a puzzling UI failure. Its dependency on hand-seeded furniture is the fragility to watch: a `cleanup.steps.ts` change that starts wiping fleet-scoped reports silently breaks this test.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOSTP-10 · Premium • Hosts • CTA visibility by role › global-admin / global-maintainer sees Add hosts, Enroll secrets, and Export hosts

- **File:** [`playwright/tests/e2e/premium/hosts/cta-visibility.spec.ts`](../../tests/e2e/premium/hosts/cta-visibility.spec.ts)
- **Grep:** `npx playwright test -g "sees Add hosts, Enroll secrets, and Export hosts"` (two runtime tests: `global-admin sees …`, `global-maintainer sees …`)
- **Project:** premium · **Roles:** `global-admin`, `global-maintainer` · **Scope:** whatever the fresh context defaults to (no fleet dropdown selection — role gating isn't scope-dependent)
- **Mode:** UI · **Isolation:** parallel; read-only
- **Preconditions:** the two static users provisioned; at least one host visible to them
- **Data created:** none

**Flow**

1. ☐ Log in as the role in a fresh context (cached session).
2. ☐ Open `/hosts/manage` **via URL** → ✅ *(UI)* first row with a link visible (goto anchor — so the role must be able to see ≥1 host).
3. ☐ ✅ *(UI)* **Add hosts** button visible.
4. ☐ ✅ *(UI)* **Enroll secrets** button visible (matched exactly, so the empty-state "Manage enroll secrets" banner link can't satisfy it).
5. ☐ ✅ *(UI)* **Export hosts** button visible.

**Assessment**
- *Value:* smoke-level RBAC on the hosts-list header for the two write roles.
- *Coverage gaps:* no fleet-scoped roles (`team-admin`, `ws-maintainer`, `ws-observer`) — the premium-specific dimension is entirely missing, which is odd for a premium-only spec; no `global-observer-plus` / `global-technician`; the CTAs are never clicked, so an enabled-but-broken modal passes.
- *Redundancy:* near-duplicate of [`free/hosts/cta-visibility.spec.ts`](../../tests/e2e/free/hosts/cta-visibility.spec.ts) — the premium file's only delta is the extra `global-maintainer` case; HOSTP-11 is the same body with inverted expectations. Add-hosts modal behaviour is covered by [`shared/hosts/add-hosts-download.spec.ts`](../../tests/e2e/shared/hosts/add-hosts-download.spec.ts) and export by [`shared/hosts/export-csv.spec.ts`](../../tests/e2e/shared/hosts/export-csv.spec.ts).
- *Efficiency / smells:* deviates from the suite rule of calling `teamDropdown.select(scope)` after a scope-aware `goto` — benign here (role gating is global), but it means the test asserts against whichever fleet localStorage remembers. Second-context console errors unmonitored (see HOSTP-04).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOSTP-11 · Premium • Hosts • CTA visibility by role › global observer sees only Export hosts

- **File:** [`playwright/tests/e2e/premium/hosts/cta-visibility.spec.ts`](../../tests/e2e/premium/hosts/cta-visibility.spec.ts)
- **Grep:** `npx playwright test -g "global observer sees only Export hosts"`
- **Project:** premium · **Role:** `global-observer`
- **Mode:** UI · **Isolation:** parallel; read-only
- **Preconditions:** `global-observer@fleetdm.com` provisioned; at least one host visible
- **Data created:** none

**Flow**

1. ☐ Log in as `global-observer` in a fresh context.
2. ☐ Open `/hosts/manage` **via URL** → ✅ *(UI)* first row with a link visible.
3. ☐ ✅ *(UI)* **Export hosts** visible (no role gate).
4. ☐ ✅ *(UI)* **Add hosts** count 0.
5. ☐ ✅ *(UI)* **Enroll secrets** count 0.

**Assessment**
- *Value:* the negative half of the CTA gating — catches a write CTA leaking to a read-only role.
- *Coverage gaps:* doesn't assert the observer is also denied the row-selection bulk actions (Transfer / Delete), which is the more consequential leak on this page.
- *Redundancy:* identical to the free mirror's observer case (`free/hosts/cta-visibility.spec.ts`); shares its whole body with HOSTP-10.
- *Efficiency / smells:* same missing-`teamDropdown.select` and unmonitored-second-context notes as HOSTP-10.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOSTP-12 · Premium • Hosts • MDM action availability › macOS / Windows / Ubuntu matrix

- **File:** [`playwright/tests/e2e/premium/hosts/mdm-actions-availability.spec.ts`](../../tests/e2e/premium/hosts/mdm-actions-availability.spec.ts)
- **Grep:** `npx playwright test -g "offers Lock"` (three runtime tests: `macOS (MDM-enrolled) offers Lock + Wipe + Turn off MDM`, `Windows (MDM-enrolled) offers Lock + Wipe`, `Ubuntu (no MDM) offers Lock + Wipe`)
- **Project:** premium · **Cases:** see matrix below
- **Mode:** UI · **Isolation:** parallel; read-only. **Only ever opens the Actions menu — nothing here clicks a destructive item.**
- **Preconditions:** an online real MDM-enrolled **macOS** VM and **Windows** VM; any online **Linux** host (the real Ubuntu VMs are not MDM-enrolled, so they fall inside the "simulated" set — fine, since the Linux gates read platform + tier only)
- **Data created:** none

| Case | Host resolved via | Lock | Wipe | Turn off MDM |
|---|---|---|---|---|
| macOS (MDM-enrolled) | `findOnlineHost('darwin', { kind: 'real' })` | offered | offered | offered |
| Windows (MDM-enrolled) | `findOnlineHost('windows', { kind: 'real' })` | offered | offered | **withheld** (`canTurnOffMdm` is gated on `isAppleDevice`) |
| Ubuntu (no MDM) | `findOnlineHost('linux', {})` | offered | offered | **withheld** (`isLinuxLike` needs no MDM for Lock/Wipe) |

**Flow** (per case)

1. ☐ *(API setup)* `findOnlineHost(platform, …)` → `GET /hosts?status=online[&platform=…][&mdm_enrollment_status=enrolled]&per_page=100&order_key=display_name&order_direction=asc`, re-filtered client-side on the host's real platform, then one `GET /hosts/:id` per candidate for vitals.
   - ✅ *(API)* a host was resolved (`not.toBeNull()`), so a downed VM fails loudly instead of skipping.
2. ☐ Open `/hosts/:id` **via URL** → ✅ *(UI)* **Disk space available** visible.
3. ☐ Click **Actions**.
   - ✅ *(UI)* at least one option rendered (`openActions` anchor) — this is what stops the absence assertions from passing on an unrendered menu.
4. ☐ For each of **Lock**, **Wipe**, **Turn off MDM**: ✅ *(UI)* the option's count is 1 (offered) or 0 (withheld) per the matrix, with a per-action failure message.

**Assessment**
- *Value:* the safe half of Lock/Wipe coverage — the permission/gating surface, asserted without firing a one-way action on a QA VM (no re-provisioning automation exists; see `docs/qawolf-migration/PARITY.md` §6). Encodes two counter-intuitive gates: Turn off MDM is Apple-only, and Lock/Wipe need no MDM on Linux. Answering the audit question directly: it asserts **presence/absence, not disabled states** — Fleet omits unavailable actions from the menu rather than disabling them — and simulated hosts can't be used for the macOS/Windows cases at all, because both gates require real MDM enrollment.
- *Coverage gaps:* **no role dimension** — the file's docstring says it "closes the RBAC/gating half" of the Lock/Wipe gap, but all three cases run as the suite admin, so only platform × tier is asserted. Whether a global observer / team admin / maintainer is offered Lock or Wipe is untested. Also untested: **Unlock** (offered on a locked host), an MDM-enrolled-but-*disconnected* Apple host, and the actions' behaviour (deliberately, and correctly, out of scope).
- *Redundancy:* [`free/hosts/mdm-actions-availability.spec.ts`](../../tests/e2e/free/hosts/mdm-actions-availability.spec.ts) is the same body with an inverted matrix (Lock/Wipe premium-gated, Turn off MDM not) — the pair is the paywall assertion, so the duplication is justified. Mechanically overlaps HOSTP-05 (open Actions, count options).
- *Efficiency / smells:* the macOS case re-resolves what the `liveMacosHost` worker fixture already resolves once per worker — using the fixture would drop a paged host list plus per-candidate vitals calls. The Linux case is a flake vector: `listOnlineHosts` omits the `platform` param for linux (there is no linux label group) and `findOnlineHost` scans only the alphabetically-first **100** online hosts of *any* platform ([`helpers/api/hosts.ts:303`](../../helpers/api/hosts.ts), `maxScan = 100`), so a pool skewed toward macOS/Windows names yields `null` and fails setup.

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
| Bulk transfer (list → selection bar → modal) | HOSTP-01 | UI-side transfer only ever targets **Unassigned**; no activity-feed assertion; no "Select all matching hosts" behaviour |
| Transfer-modal affordances (search, disabled submit, Add a fleet) | HOSTP-01, HOSTP-02, HOSTP-04 | current fleet not asserted absent from options; no no-match state |
| Selection bar (tally, widening affordance, clear) | HOSTP-01, HOSTP-03 | tally never compared to page size; bulk actions not asserted hidden for observers |
| Single-host transfer, per role | HOSTP-04 (admin, maintainer), HOSTP-05 (team admin denied) | observer / observer-plus / technician; fleet→fleet moves; activity feed |
| Bulk delete | HOSTP-06 | cancel path; observer denial; activity feed; no `finally` restore |
| Single-host delete | HOSTP-07 (team admin), HOSTP-08 (admin) | cancel path; team observer denial; cross-fleet denial; redirect asserted without a URL check |
| Host Actions menu gating by platform/MDM/tier | HOSTP-12 + free mirror | role dimension entirely absent; Unlock; enrolled-but-disconnected Apple host |
| Hosts-list header CTAs by role | HOSTP-10, HOSTP-11 (+ free mirror) | fleet-scoped roles (`team-admin`, `ws-*`); observer-plus; technician |
| Per-host stored report results | HOSTP-09 | negative case (no stored result → no **Show details**); column/row shape |
| Lock / Wipe / Unlock / Turn off MDM **execution** | — | intentionally uncovered (unrecoverable on QA VMs) |
| Hosts-list filters (status, label, OS, policy), pagination, sorting, columns, CSV export, host details vitals/software/policies | not this area — `shared/hosts/*` and other audit files | `LabelFilter`, `StatusFilter`, `Pagination`, `clickHoverAction` are unused by these six specs |

**Duplication**

1. **Selection-bar setup ×3** — HOSTP-01/02/03 each do goto → select scope → `selectAllOnPage` → (some) open Transfer modal. HOSTP-02 and HOSTP-03 add one assertion each on top of HOSTP-01's setup.
2. **Delete flow ×3** — HOSTP-06/07/08 all assert modal → confirm → toast → `hostExists === false`; the deltas are entry point (bulk vs details), role (admin vs team admin), and modal copy. Three destroyed hosts per run for two genuinely distinct behaviours.
3. **Free/premium CTA mirrors** — HOSTP-10/11 vs `free/hosts/cta-visibility.spec.ts`: identical bodies, premium adds only `global-maintainer`. Per the suite's tier-separation preference this duplication is accepted, but the premium file adds no premium-specific role.
4. **MDM matrix mirrors** — HOSTP-12 vs the free file: justified (the inverted matrix *is* the paywall assertion).
5. **Open-Actions-and-count-options** — HOSTP-05 and HOSTP-12 share the mechanism across different dimensions (role vs platform); a single matrix keyed on both would cover more with less.

**UI-vs-API balance**

Mostly healthy. The API is used for three distinct purposes and it's worth keeping them straight when re-running by hand:

- **Setup that must not be a UI flow** — `findSimulatedHostIds` + `transferHosts` staging (HOSTP-01, 06, 07). Correct: staging through the UI would double the runtime and test the same code twice.
- **Server-truth confirmation after a UI action** — `getHostFleetId` (HOSTP-01, 04) and `hostExists` (HOSTP-06, 07, 08). Justified: the list can serve a stale react-query page, and a UI-only delete assertion can't distinguish "removed from view" from "removed from Fleet".
- **Preconditions turned into clear failures** — HOSTP-09's `findReportByName` / `getHostReportLastFetched`. Good practice; these are guardrails, not substitutes for UI assertions.
- **The gap is the activity feed:** no test in this area asserts `transferred_hosts` / `deleted_host` activity copy, even though the suite has `dashboard.expectActivities` and `helpers/api/activity-copy.ts` for exactly this, and transfers/deletes are the canonical audit-trail events.

**Quick wins**

1. Wrap HOSTP-06 and HOSTP-07 in `try/finally` that transfers any surviving staged host back to Unassigned — today a mid-test failure parks sims in **Workstations**/**VMs** permanently and wedges the next run's `2 selected` rail ([`host-delete.spec.ts:34`](../../tests/e2e/premium/hosts/host-delete.spec.ts), `:70`).
2. Give HOSTP-01 and HOSTP-04 different destination fleets (or fold HOSTP-04's transfer into a fleet nobody select-alls) — both stage into **QA** in parallel, so HOSTP-01's `3 selected` can see 4 ([`bulk-transfer.spec.ts:48`](../../tests/e2e/premium/hosts/bulk-transfer.spec.ts), [`host-transfer-permissions.spec.ts:55`](../../tests/e2e/premium/hosts/host-transfer-permissions.spec.ts)).
3. Add `await expect(page).toHaveURL(/\/hosts\/manage/)` to HOSTP-08's post-delete assertion — the current `firstRowWithLink` check would pass on any table ([`host-delete.spec.ts:109`](../../tests/e2e/premium/hosts/host-delete.spec.ts)).
4. Point HOSTP-12's macOS case at the `liveMacosHost` worker fixture instead of re-running `findOnlineHost('darwin', { kind: 'real' })`, and raise/target the Linux scan so it can't return `null` from a name-skewed first 100 hosts ([`mdm-actions-availability.spec.ts:63`](../../tests/e2e/premium/hosts/mdm-actions-availability.spec.ts), [`helpers/api/hosts.ts:303`](../../helpers/api/hosts.ts)).
5. Reconcile the delete-pool restore story: either install `com.fleetqa.perf.refresh.plist` on the VM or correct HOSTP-06's header, which asserts a "scheduled daily refresh" that `install.sh` only sets up behind `--daily-refresh` ([`host-delete.spec.ts:18`](../../tests/e2e/premium/hosts/host-delete.spec.ts), [`tools/perf-hosts/README.md`](../../../tools/perf-hosts/README.md)).

**Bigger bets**

1. **A dedicated scratch fleet per mutating host spec** (gitops-provisioned, e.g. `pw-hosts-scratch-1..3`). It removes the QA collision, gets bulk-delete out of Workstations, and makes "select all on this page can only act on my hosts" a real invariant rather than a convention — which is what the safety rails are currently compensating for.
2. **Merge the three delete tests into two** and drop one destroyed host per run: keep bulk-delete (HOSTP-06, with a cancel-path assertion added), and merge HOSTP-07 + HOSTP-08 into one team-admin details-page delete that keeps both the per-host modal copy and a URL-asserted redirect. Move the pure "can this role delete" question to `tests/api/role-access/premium/`.
3. **Turn HOSTP-05 + HOSTP-12 into one role × platform Actions-menu matrix.** Both already open the menu and count options; one data-driven spec over (role, platform, MDM state) → offered actions would close the RBAC dimension HOSTP-12's docstring claims and give Lock/Wipe genuine permission coverage without ever firing them.
