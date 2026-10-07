# Hosts — premium — test audit

**Specs covered:** 9 files · **Entries:** 21 (33 runtime `test()` declarations — three parameterized loops are collapsed into one entry each, with every generated title listed) · **Project:** premium

Premium-only host flows: moving hosts between fleets (bulk and single-host, per role), deleting hosts (bulk, from host details, and as a team admin), drilling a report card into one host's stored results, the role/platform gating of the hosts-list CTAs and the host Actions menu, a host's **IdP username** (the host details **User** card, by UI and API, and its role gate), and the **Recovery Lock password** on the real Mac. All eight specs resolve their hosts through the API at runtime — never by name — because the premium QA instance is ~300 osquery-perf **simulations** plus three real VMs. Mutating specs draw disjoint slices of the simulated pool via `findSimulatedHostIds(platform, count, offset)` (transfer, delete) or `findSimulations(platform, count, offset)` (the IdP-username spec, which starts 40 hosts further in); read-only device-fidelity specs take the real VM via the `liveMacosHost` worker fixture. The Recovery Lock spec takes the same VM and **changes its state**.

> **Destructive-area warning.** [`host-delete.spec.ts`](../../tests/e2e/premium/hosts/host-delete.spec.ts) permanently deletes **4 online simulated hosts per full-file run** (2 macOS + 1 macOS + 1 Windows). Nothing in the suite restores them. See [HOSTP-06](#hostp-06--premium--hosts--bulk-delete--deletes-the-selected-hosts) for the exact restore procedure and cost.

> **Real-VM warning.** [`recovery-lock.spec.ts`](../../tests/e2e/premium/hosts/recovery-lock.spec.ts) turns on Recovery Lock enforcement for the **VMs** fleet, so Fleet **sets, rotates and clears a Recovery Lock password on the real macOS VM**. It is the one sanctioned exception to `playwright/CLAUDE.md`'s rule against Recovery Lock on the VMs fleet (approved 2026-09-29), first run live 2026-09-29 (green with dependencies, headed and 5× repeated on one worker). See [HOSTP-16](#hostp-16--premium--hosts--recovery-lock-password--enforce-on-the-vms-fleet-verify-view-rotate-and-clear-on-the-mac) before running it by hand.

## Contents

| ID | Spec | Test | Mode | Manual? |
|---|---|---|---|---|
| HOSTP-01 | `premium/hosts/bulk-transfer.spec.ts` | bulk transfer › transfers the selected hosts to another fleet | UI+API | ☐ |
| HOSTP-02 | `premium/hosts/bulk-transfer.spec.ts` | bulk transfer › fleet dropdown filters to a single match as you type | UI | ☐ |
| HOSTP-03 | `premium/hosts/bulk-transfer.spec.ts` | bulk transfer › a full page of selections offers to widen past the page | UI | ☐ |
| HOSTP-04 | `premium/hosts/host-transfer-permissions.spec.ts` | single-host transfer by role › global admin / global maintainer / global technician | UI+API | ☐ |
| HOSTP-05 | `premium/hosts/host-transfer-permissions.spec.ts` | single-host transfer by role › team admin is not offered Transfer | UI | ☐ |
| HOSTP-06 | `premium/hosts/host-delete.spec.ts` | bulk delete › deletes the selected hosts **(destructive)** | UI+API | ☐ |
| HOSTP-07 | `premium/hosts/host-delete.spec.ts` | delete by role › team admin can delete on a fleet they administer **(destructive)** | UI+API | ☐ |
| HOSTP-08 | `premium/hosts/host-delete.spec.ts` | delete from host details › deletes the host and returns to the list **(destructive)** | UI+API | ☐ |
| HOSTP-09 | `premium/hosts/host-report-details.spec.ts` | host report results › drills into this host and out to all hosts | UI+API | ☐ |
| HOSTP-10 | `premium/hosts/cta-visibility.spec.ts` | CTA visibility › global-admin / global-maintainer see Add hosts, the gear's items and Add label | UI | ☐ |
| HOSTP-11 | `premium/hosts/cta-visibility.spec.ts` | CTA visibility › global observer sees only Export hosts | UI | ☐ |
| HOSTP-12 | `premium/hosts/mdm-actions-availability.spec.ts` | MDM action availability › macOS / Windows / Ubuntu matrix | UI | ☐ |
| HOSTP-13 | `premium/hosts/host-idp-username.spec.ts` | IdP username › an admin adds an IdP username on the User card, then removes it | UI+API | ☐ |
| HOSTP-14 | `premium/hosts/host-idp-username.spec.ts` | IdP username › the device_mapping API sets and removes the IdP username | UI+API | ☐ |
| HOSTP-15 | `premium/hosts/host-idp-username.spec.ts` | IdP username › a global observer is not offered Add user | UI | ☐ |
| HOSTP-16 | `premium/hosts/recovery-lock.spec.ts` | Recovery Lock password › enforce on the VMs fleet, verify, view, rotate and clear on the Mac **(real macOS VM)** | UI+API | ☐ |
| HOSTP-17 | `premium/hosts/bulk-transfer.spec.ts` | bulk transfer › a filter the server cannot transfer by withholds "Select all matching hosts" | UI | ☐ |
| HOSTP-18 | `premium/hosts/bulk-transfer.spec.ts` | transfer every matching host › "Select all matching hosts" transfers every host the filter matches, not just the page | UI+API | ☐ |
| HOSTP-19 | `premium/hosts/cta-visibility.spec.ts` | CTA visibility › technician and fleet roles (4 roles) | UI | ☐ |
| HOSTP-20 | `premium/hosts/host-actions-role-access.spec.ts` | Actions by role › <role> is offered the host actions its role grants (5 roles) | UI | ☐ |
| HOSTP-21 | `premium/hosts/host-actions-role-access.spec.ts` | Actions by role › global-technician is not offered "create a report" from a host *(skipped, #54622)* | UI | ☐ |

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
5. ☐ Read the list, then tick the table header's select-all checkbox.
   - ✅ *(UI)* exactly 3 rows, each with a **Fleet** cell reading `QA` (the list under a fleet is that fleet's hosts).
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
- *Coverage gaps:* the transfer *into* a named fleet is done by API, so the UI only ever transfers **to Unassigned**; no assertion the hosts show up under Unassigned in the list; no `transferred_hosts` activity-feed assertion; **Select all matching hosts** isn't exercised here (it would target the whole load fleet); HOSTP-18 clicks it on a throwaway fleet.
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
- *Coverage gaps:* doesn't assert the tally equals the page size (50), doesn't assert rows are visually deselected after Clear selection, and the widening button's *behaviour* is HOSTP-18's (on a throwaway fleet, never here).
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

### HOSTP-04 · Premium • Hosts • single-host transfer by role › a global admin / global maintainer / global technician can transfer a host to another fleet

- **File:** [`playwright/tests/e2e/premium/hosts/host-transfer-permissions.spec.ts`](../../tests/e2e/premium/hosts/host-transfer-permissions.spec.ts)
- **Grep:** `npx playwright test -g "can transfer a host to another fleet"` (three runtime tests: `a global admin can transfer a host to another fleet`, `a global maintainer can transfer a host to another fleet`, `a global technician can transfer a host to another fleet`)
- **Project:** premium · **Roles:** `global-admin` (host index 0), `global-maintainer` (host index 1), `global-technician` (host index 2) · **Destination:** the **QA** fleet
- **Mode:** UI+API · **Isolation:** parallel; each role claims its own host by index; `finally` restores
- **Preconditions:** static users `global-admin@fleetdm.com` / `global-maintainer@fleetdm.com` / `global-technician@fleetdm.com` provisioned with `FLEET_STATIC_USER_PASSWORD`; ≥3 online simulated **Windows** hosts; QA fleet exists
- **Data created:** none permanent — one simulated Windows host moves to QA and back to Unassigned per role

**Flow**

1. ☐ *(API setup)* `findSimulatedHostIds(request, 'windows', 3)` — same paged, `desc`-ordered, unenrolled-only walk as HOSTP-01; each role then indexes into the slice.
   - ✅ *(API)* 3 simulated Windows hosts resolved.
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
- *Value:* Fleet's `canTransferTeam` gate for the three global roles it admits (admin, maintainer, technician), plus the single-host transfer path end to end (menu → modal → toast → vitals → server).
- *Coverage gaps:* no `transferred_hosts` activity-feed assertion; no negative case for `global-observer` / `global-observer-plus`; transferring *between two named fleets* (rather than Unassigned → QA) is untested; nothing checks the host disappears from the Unassigned list.
- *Redundancy:* the modal-gating assertion (`Transfer` disabled) duplicates HOSTP-01 step 6; the destination-pick + toast overlaps HOSTP-01's transfer, and the QA fleet is shared with it — see the race noted in HOSTP-01.
- *Efficiency / smells:* every role case runs the full pool walk (`findSimulatedHostIds(..., 3)`) to use one host — three identical multi-page API walks. Tests running under `withStaticUser` operate on a **second** browser context, which the auto `pageHealth` fixture does not monitor (it watches the `page` fixture), so console/5xx errors in these flows go unobserved — true of HOSTP-05/07/10/11 as well.

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
- **Preconditions:** the real, online macOS VM (`liveMacosHost` worker fixture — `GET /hosts?status=online&platform=darwin`, the first by display name whose `hardware_model` matches `/virtual|qemu/i`; with none, it throws a setup error saying whether the VM is offline since its last check-in or not enrolled at all)
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
- **Preconditions:** **instance furniture** — a report named `pw-host-report-results` on the VMs fleet with `interval: 300`, `platform: darwin`, `logging: snapshot`, query `SELECT 'bar' AS foo;`, plus at least one elapsed interval so the real macOS VM has a stored result. The stored result is what makes the card print its **first row inline** as a term/value grid (with any remainder behind **View full report**) — the drill-through comparison below has nothing to compare against otherwise. The report is **provisioned by gitops** — declared under `reports:` in [`gitops/premium-fleetqa/fleets/vms.yml`](../../../gitops/premium-fleetqa/fleets/vms.yml), not recreated by hand. If it is missing, **re-apply that file** (see `gitops/premium-fleetqa/README.md`) and let one 300 s interval elapse. Deliberately not created by the test: global reports are wiped by `cleanup-setup` (the VMs fleet's sweep leaves gitops-declared content alone), and self-provisioning would cost ~3.5 min of waiting per run. The real macOS VM must be online (`liveMacosHost`).
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
6. ☐ *(no user action)* Read the card's **inline first result** — `reportCardFirstResult` ([`HostDetailsPage.ts:427`](../../pages/hosts/HostDetailsPage.ts)) reads the card's `data-grid` in **one DOM pass**, returning column → value, so a term can't be paired with the wrong value. The grid has no roles of its own (Fleet's `DataSet` emits `<dt>`/`<dd>` inside a role-less wrapper), so it is reached through the card's own class.
   - ✅ *(UI)* the grid is non-empty — the card rendered the report's first result inline rather than a placeholder.
7. ☐ Open that card's Actions menu → **Show details**.
   - ✅ *(UI)* the **Back to host details** button is visible (`HostQueryReportPage.waitForReady`).
   - ✅ *(UI)* URL matches `/hosts/<hostId>/reports/<reportId>`.
   - ✅ *(UI)* the page's `h1` equals the **host's** display name (the per-host results page titles itself with the host, not the report).
   - ✅ *(UI)* the first results row contains `bar` — the value the seeded query selects, proving real stored results rather than an empty shell.
   - ✅ *(UI)* **cell-for-cell:** for **every** column the card previewed inline, the full report's first row holds the **same value** in that column. Each cell is resolved by **visible column header text** via `DataTable.cellByColumn` ([`DataTable.ts:105`](../../pages/components/DataTable.ts)), which walks the header row and **throws** if the header is missing — so the card's column names are implicitly asserted against the table's headers too. This is the assertion that proves the card's inline preview is a preview of *this* report's stored first row, and not of some other row or a placeholder.
8. ☐ Click **View report for all hosts**.
   - ✅ *(UI)* URL matches `/reports/<reportId>`.
   - ✅ *(UI)* the report-details `h1` contains the report name.
9. ☐ In the report's results, click the Mac's **Host** cell (the walk the other way).
   - ✅ *(UI)* back on `/hosts/<hostId>/reports/<reportId>`, titled with the host, first row containing `bar`.
10. ☐ Click **Back to host details**.
   - ✅ *(UI)* URL `/hosts/<hostId>/details`.

**Assessment**
- *Value:* the only coverage of per-host stored query results and the host↔report navigation pair; catches a broken `Show details` gate, a mis-routed drill-down, or results that render empty. The cell-for-cell comparison is the strongest part: it ties two independent renderings of the same stored row together, so a card previewing a *different* row (or the wrong host's) fails here rather than passing a shape check.
- *Coverage gaps:* the column headers are now asserted only *transitively* — `cellByColumn` throws on a header the card also previewed, so a column the card omits (anything past the first result's keys) is still unchecked, as are the row count and the page's "last fetched" line; the comparison covers the **first row only**, so a full report truncated to one row would pass; no negative case (a report *without* stored results must not offer **Show details**) — that's the other half of the `last_fetched` gate and would be cheap on a simulated host; the report → host direction and **Back to host details** are steps 9–10; nothing asserts the card's **View full report** affordance for the rows the inline grid doesn't show.
- *Redundancy:* the Reports-tab search/sort surface is covered by [`shared/hosts/host-reports-tab.spec.ts`](../../tests/e2e/shared/hosts/host-reports-tab.spec.ts); this spec only re-uses the search to find its card.
- *Efficiency / smells:*
  - The two API preconditions are guardrails rather than validations — good, they turn missing furniture into a clear message instead of a puzzling UI failure. Its dependency on hand-seeded furniture is the fragility to watch: a `cleanup.steps.ts` change that starts wiping fleet-scoped reports silently breaks this test.
  - The cell-for-cell loop is only as strong as the card's grid is wide. The seeded query is `SELECT 'bar' AS foo;` — **one** column — so in practice the loop runs exactly once and the "every column" phrasing overstates what the instance exercises. Widening the furniture's query (e.g. two or three literal columns) would make the loop mean what it says, at zero runtime cost.
  - `cellByColumn` is `async` and resolves the header index with a per-header `innerText()` read, so the loop re-walks the header row once per column — fine at one column, quadratic-ish if the furniture is ever widened.
  - `toHaveText(value)` compares against text the spec itself scraped out of the DOM, so whitespace normalisation differences between the card's `<dd>` (read via `innerText().trim()`) and the table cell (matched by `toHaveText`, which normalises) are a plausible future flake source rather than a caught bug.

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
- **Grep:** `npx playwright test --project=premium -g "sees Add hosts, Enroll secrets, and Export hosts"` (two runtime tests)
- **Project:** premium · **Roles:** `global-admin`, `global-maintainer` · **Scope:** All fleets
- **Mode:** UI · **Isolation:** one test per role through `withStaticUser`; read-only (Enroll secrets is opened and closed, never saved)
- **Preconditions:** the two static users; at least one host visible to them
- **Data created:** none

**Flow**

1. ☐ Log in as the role (cached session) → `/hosts/manage` via URL → ✅ *(UI)* a host row with a link.
2. ☐ ✅ *(UI)* **Export hosts** and **Add hosts** visible.
3. ☐ Open the **Hosts page settings** gear → ✅ *(UI)* **Enroll secrets**; **Activity automations** for the admin only. Click **Enroll secrets** → ✅ *(UI)* the modal opens; **Done** closes it.
4. ☐ Once the table settles, open the label filter's menu → ✅ *(UI)* its "Filter labels by name..." box, and the **Add label** "+" beside it.

**Assessment**
- *Value:* the write roles' Hosts-list controls, now with the gear's per-role items and Add label.
- *Coverage gaps:* the CTAs' own flows are elsewhere (`add-hosts-download`, `enroll-secrets`, `export-csv`). The gear's Custom host vitals isn't read.
- *Redundancy:* the admin case mirrors HOST-10 on free; the expectation doesn't differ by tier.
- *Efficiency / smells:* seconds.

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
- **Grep:** `npx playwright test --project=premium -g "global observer sees only Export hosts"`
- **Project:** premium · **Role:** `global-observer` · **Scope:** All fleets
- **Mode:** UI · **Isolation:** read-only
- **Data created:** none

**Flow**

1. ☐ Log in as `global-observer` → `/hosts/manage` → ✅ *(UI)* a host row.
2. ☐ ✅ *(UI)* **Export hosts** visible; **Add hosts** and the gear absent (an observer gets none of the gear's items, so no gear).
3. ☐ Once the table settles, open the label filter's menu → ✅ *(UI)* the search box; no **Add label**; the search box still showing (so the absence was read off an open menu).

**Assessment**
- *Value:* the negative half of the gating, Add label included.
- *Coverage gaps:* the observer's host Actions menu is HOSTP-20.
- *Redundancy:* the same cell as HOST-11 on free.
- *Efficiency / smells:* seconds.

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

1. ☐ *(API setup)* The macOS and Windows cases take the real VM through `requireRealHost(platform)`: `GET /hosts?status=online&platform=…&per_page=100&order_key=display_name&order_direction=asc`, re-filtered client-side on the host's real platform and on `hardware_model` (`/virtual|qemu/i`), then one `GET /hosts/:id` for vitals. The Ubuntu case takes any online Linux host through `findOnlineHost`.
   - ✅ *(API)* a host was resolved, so a downed VM fails loudly instead of skipping; a missing real VM fails with why (offline since its last check-in, or not enrolled).
2. ☐ Open `/hosts/:id` **via URL** → ✅ *(UI)* **Disk space available** visible.
3. ☐ Click **Actions**.
   - ✅ *(UI)* at least one option rendered (`openActions` anchor) — this is what stops the absence assertions from passing on an unrendered menu.
4. ☐ For each of **Lock**, **Wipe**, **Turn off MDM**: ✅ *(UI)* the option's count is 1 (offered) or 0 (withheld) per the matrix, with a per-action failure message.

**Assessment**
- *Value:* the safe half of Lock/Wipe coverage — the permission/gating surface, asserted without firing a one-way action on a QA VM (no re-provisioning automation exists, so Lock and Wipe are never fired on a real VM). Encodes two counter-intuitive gates: Turn off MDM is Apple-only, and Lock/Wipe need no MDM on Linux. Answering the audit question directly: it asserts **presence/absence, not disabled states** — Fleet omits unavailable actions from the menu rather than disabling them — and simulated hosts can't be used for the macOS/Windows cases at all, because both gates require real MDM enrollment.
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

### HOSTP-13 · Premium • Hosts • IdP username › an admin adds an IdP username on the User card, then removes it

- **File:** [`playwright/tests/e2e/premium/hosts/host-idp-username.spec.ts`](../../tests/e2e/premium/hosts/host-idp-username.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "an admin adds an IdP username on the User card"`
- **Project:** premium · **Role:** the suite admin · **Host:** one online **non-MDM simulated Windows** host — `findSimulations(request, 'windows', 1, 0)`, which walks the descending display-name ordering, skips the first 40 simulations (the transfer/delete specs' part of the pool) and takes slice 0 of what's left
- **Mode:** UI+API · **Isolation:** parallel, self-contained; `finally` removes the IdP username (a 422 "nothing to remove" is accepted)
- **Preconditions:** ≥1 online non-MDM simulated Windows host past the transfer/delete specs' slices. The host must start with no IdP username — the test forces that with an API delete before it opens the page.
- **Data created:** a `pw-idp-ui-<timestamp>@example.com` IdP username on the host, removed in the same test; two permanent `edited_host_idp_data` activities

**Flow**

1. ☐ *(API setup)* Resolve the host.
   - ✅ *(API)* a host was resolved (`toBeDefined`).
2. ☐ *(API setup)* `DELETE /hosts/:id/device_mapping/idp` — clears any username a dead run left; a 422 (none to remove) is fine. Then note the id of the newest activity in the log (`latestActivityId`) — both activity checks below count only activities newer than it.
3. ☐ Open the host at `/hosts/:id` **via URL**.
   - ✅ *(UI)* **Disk space available** visible (`HostDetailsPage.goto` anchor).
   - ✅ *(UI)* on the Details tab's **User** card, **Username (IdP)** reads `---`.
   - ✅ *(UI)* the card's button reads **Add user**.
4. ☐ Click **Add user**.
   - ✅ *(UI)* the modal titled **Add user** is open.
   - ✅ *(UI)* **Save** is **disabled** while the field is empty.
5. ☐ Type `pw-idp-ui-<timestamp>@example.com` into **Username (IdP)** and click **Save**.
   - ✅ *(UI)* the modal closes.
   - ✅ *(UI)* success toast `Updated end user.`
   - ✅ *(UI)* **Username (IdP)** now reads the username.
   - ✅ *(UI)* the button now reads **Edit user**.
   - ✅ *(API)* `GET /hosts/:id` → `end_users[].idp_username` equals the username.
   - ✅ *(API)* an `edited_host_idp_data` activity newer than the noted id, with this `host_id` and `host_idp_username` = the username, attributed to the suite admin (`assertActivityAfter`).
6. ☐ Click **Edit user**.
   - ✅ *(UI)* the modal titled **Edit user** is open.
   - ✅ *(UI)* **Username (IdP)** is prefilled with the current username.
7. ☐ Clear the field and click **Save** — an empty save removes the username.
   - ✅ *(UI)* the modal closes; success toast `Removed end user.`
   - ✅ *(UI)* **Username (IdP)** reads `---` again; the button reads **Add user** again.
   - ✅ *(API)* `GET /hosts/:id` reports no IdP username.
   - ✅ *(API)* an `edited_host_idp_data` activity newer than the noted id, with this `host_id` and `host_idp_username` = `''`, attributed to the suite admin — the same host gets this removal every run, so only a newer one counts.
8. ☐ *(API teardown, `finally`)* `DELETE /hosts/:id/device_mapping/idp`, tolerating 422.

**Assessment**
- *Value:* the host's end user through the card and modal, add → edit → remove, with the stored value, the activity record and the button's Add/Edit state all checked. Would catch a modal that saves nothing, a card that doesn't refresh, and a remove that quietly does nothing. The empty-save-means-remove rule (a `DELETE`, not a `PUT` with an empty value) is the non-obvious part, and it's covered.
- *Coverage gaps:* the SCIM-backed fields (**Full name**, **Groups**, **Department**) stay empty — the premium instance has never received a SCIM request, as the spec's header says; only the admin writes — `canWriteEndUser` also admits maintainers (global or of the host's fleet), and no maintainer or team-admin case exists; **Edit user** is only used to clear, never to replace one username with another; whatever the field refuses, if anything, is untested; the activity's **rendered copy** (feed or host Activity card) is never read — the API record only.
- *Redundancy:* HOSTP-14 drives the same two endpoints directly and re-checks the card; the free mirror is [HOST-24](02-hosts-shared-and-free.md), where the same button opens the Premium message.
- *Efficiency / smells:*
  - Both activity checks are tied to this run: each must be newer than an id noted before the page opened (`latestActivityId` → `assertActivityAfter`), so an earlier run's identical empty-username removal on this same host can't satisfy step 7. Both share one marker, so the removal only has to be newer than the pre-add id, not than the add — enough, since no other spec touches this slice.
  - The Windows slices are registered in `findSimulations`' slice list (`helpers/api/hosts.ts`), with the free specs' shared read of slice 0.
  - The card is reached by its `.user-card` class (Fleet's Card is a role-less div) — documented in the POM. Direct-URL entry to the host.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOSTP-14 · Premium • Hosts • IdP username › the device_mapping API sets and removes the IdP username

- **File:** [`playwright/tests/e2e/premium/hosts/host-idp-username.spec.ts`](../../tests/e2e/premium/hosts/host-idp-username.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "the device_mapping API sets and removes the IdP username"`
- **Project:** premium · **Role:** the suite admin (API token) · **Host:** one online non-MDM simulated Windows host, `findSimulations(request, 'windows', 1, 1)` — slice 1, next to HOSTP-13's
- **Mode:** UI+API (the writes and most checks are API; two page loads check the card follows) · **Isolation:** parallel, self-contained; `finally` removes the username
- **Preconditions:** ≥2 online non-MDM simulated Windows hosts past the transfer/delete specs' slices
- **Data created:** a `pw-idp-api-<timestamp>@example.com` IdP username, removed in the same test; activities from the two writes (not asserted)

**Flow**

1. ☐ *(API setup)* Resolve the host → ✅ *(API)* found.
2. ☐ *(API setup)* `DELETE /hosts/:id/device_mapping/idp`, tolerating 422.
3. ☐ *(API)* `PUT /hosts/:id/device_mapping` with `{ "email": "pw-idp-api-<timestamp>@example.com", "source": "idp" }`.
   - ✅ *(API)* 2xx.
   - ✅ *(API)* response `host_id` is this host.
   - ✅ *(API)* response `device_mapping` contains `{ email: <username>, source: "mdm_idp_accounts" }` — Fleet reports the IdP username under that source, not the `idp` it was sent with.
4. ☐ Open the host at `/hosts/:id` **via URL**.
   - ✅ *(UI)* **Username (IdP)** on the **User** card reads the username.
5. ☐ *(API)* `DELETE /hosts/:id/device_mapping/idp`.
   - ✅ *(API)* 2xx.
   - ✅ *(API)* `GET /hosts/:id` reports no IdP username.
6. ☐ *(API)* The same `DELETE` again.
   - ✅ *(API)* **422** — nothing left to remove.
7. ☐ Open the host again **via URL**.
   - ✅ *(UI)* **Username (IdP)** reads `---`.
8. ☐ *(API teardown, `finally`)* the same `DELETE`, tolerating 422.

**Assessment**
- *Value:* the endpoint contract under HOSTP-13. The `source` translation (`idp` in, `mdm_idp_accounts` out) is exactly the kind of detail an API client depends on and nobody notices changing, and the 422 on a second delete pins the "nothing to remove" answer that the helper's `ignoreMissing` — and every `finally` in this spec — relies on.
- *Coverage gaps:* no activity assertion (HOSTP-13 has one); a `PUT` that **replaces** an existing username is never sent; no other `source`, no malformed body; `GET /hosts/:id/device_mapping` is never read; no API role probe — an observer's `PUT` should be 403, and the observer case (HOSTP-15) is UI-only.
- *Redundancy:* at the storage layer the round trip is HOSTP-13's again; what's unique is the response shape and the 422. Folding these assertions into HOSTP-13 would save a host and two page loads, at some cost to failure attribution.
- *Efficiency / smells:* a mostly-API test living under `tests/e2e/`, paying two page loads for two card reads — defensible, since "the card follows an API write" is its own claim. Step 6 asserts 422 through `deleteHostIdpUsername(..., { ignoreMissing: true })`, the same call the `finally` uses to *tolerate* 422, so the step reads as "tolerate" where it means "expect".

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOSTP-15 · Premium • Hosts • IdP username › a global observer is not offered Add user

- **File:** [`playwright/tests/e2e/premium/hosts/host-idp-username.spec.ts`](../../tests/e2e/premium/hosts/host-idp-username.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "a global observer is not offered Add user"`
- **Project:** premium · **Role:** `global-observer` · **Host:** Windows simulation slice 0 — the **same host HOSTP-13 changes**, in parallel
- **Mode:** UI · **Isolation:** parallel, read-only; own browser context via `withStaticUser`
- **Preconditions:** `global-observer@fleetdm.com` provisioned with `FLEET_STATIC_USER_PASSWORD`; the host resolvable as in HOSTP-13
- **Data created:** none

**Flow**

1. ☐ *(API setup)* Resolve the host → ✅ *(API)* found.
2. ☐ Log in as `global-observer` in a fresh context (cached session; see HOSTP-04 step 2).
3. ☐ Open the host at `/hosts/:id` **via URL** → ✅ *(UI)* **Disk space available** visible.
   - ✅ *(UI)* the **User** card's **Username (IdP)** value is visible — the card rendered for this role.
   - ✅ *(UI)* the card has no **Add user** or **Edit user** button (count 0).

**Assessment**
- *Value:* the negative half of `canWriteEndUser`, built the right way: the card's value is asserted visible before the button is asserted absent, so it can't pass on a card that never rendered.
- *Coverage gaps:* one role — observer+, technician (not admitted by `canWriteEndUser`, so another negative) and fleet-scoped observers are untested, as is the positive maintainer case; no API probe, so a hidden button over an open endpoint would pass here.
- *Redundancy:* shares its host with HOSTP-13. That's harmless — the button locator matches both **Add user** and **Edit user** and the value check is visibility only — but it means this test sees whichever state HOSTP-13 has the host in. The title says "Add user"; the assertion rightly covers both labels.
- *Efficiency / smells:* runs in a `withStaticUser` context, which the auto `pageHealth` fixture doesn't watch (see HOSTP-04).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOSTP-16 · Premium • Hosts • Recovery Lock password › enforce on the VMs fleet, verify, view, rotate and clear on the Mac

> **REAL macOS VM — Fleet sets, rotates and clears a Recovery Lock password on the VMs fleet's Mac.** First run live 2026-09-29, with Andrey's go-ahead. Run it on one worker: two copies would toggle the same fleet. Recovery Lock guards only entry to macOS Recovery (not login, SSH or the MDM channel), and the password stays escrowed in Fleet, readable from the host's **Actions**, until the clear lands. If the Mac is offline when enforcement goes off, the password stays on it until it checks in — don't delete the Mac's host record in that window.

- **File:** [`playwright/tests/e2e/premium/hosts/recovery-lock.spec.ts`](../../tests/e2e/premium/hosts/recovery-lock.spec.ts)
- **Grep:** `npx playwright test --project=premium --workers=2 -g "enforce on the VMs fleet, verify, view, rotate and clear on the Mac"`
- **Project:** premium · **Role:** the suite admin · **Scope:** the **VMs** fleet (`vmsFleetId`) · **Host:** the real macOS VM (`liveMacosHost`, resolved by hardware model; the test asserts it's on the VMs fleet)
- **Mode:** UI+API · **Isolation:** standalone, one test, 25-minute budget (`test.setTimeout`); five waits on the Mac of up to 4 minutes each (the first normally returns at once); an `afterEach` turns enforcement off through the API, even after a timeout. The only spec allowed to turn Recovery Lock on for the VMs fleet (`playwright/CLAUDE.md` → Test hosts)
- **Preconditions:**
  - ✅ *(API)* the Mac is on the VMs fleet (`GET /hosts/:id` → `team_id` = `vmsFleetId`).
  - ✅ *(API)* Recovery Lock enforcement is **off** on the VMs fleet (`GET /teams/:id` → `mdm.enable_recovery_lock_password` false). Asserted, not repaired — the resting-state step in `setup/cleanup.steps.ts` turns it off at the start and end of every premium run.
  - ☐ *(API wait, ≤4 min)* the Mac has no Recovery Lock password (`mdm.os_settings.recovery_lock_password.status` null) — a dead run's password may still be clearing.
  - The Mac is online, MDM-enrolled and on the VMs fleet; `FLEET_ADMIN_EMAIL` is set (the activity actor checks).
- **Data created:** a Recovery Lock password set, rotated and cleared on the Mac; permanent activities `enabled_recovery_lock_passwords`, `set_host_recovery_lock_password`, `viewed_host_recovery_lock_password` (×2 — the second view isn't asserted), `rotated_host_recovery_lock_password`, `disabled_recovery_lock_passwords`. Ends with enforcement off and no password on the Mac, if the clear lands.

**Flow**

1. ☐ *(API precondition)* enforcement off on VMs, then wait for the Mac's status to be null (see Preconditions).
2. ☐ *(API)* Note the id of the newest activity in the log (`latestActivityId`). Before each later step that records an activity (view, rotate, clear) the test notes it again, and each activity check counts only entries newer than the last note.
3. ☐ Open the **Dashboard** via URL, click **Controls** → **OS settings** tab → **Passwords** in the sidebar.
   - ✅ *(UI)* the URL moves to `/controls`, `/controls/os-settings`, then `/controls/os-settings/passwords`.
4. ☐ Pick **VMs** in the fleet dropdown.
   - ✅ *(UI)* the dropdown reads `VMs`.
   - ✅ *(UI)* **Turn on Recovery Lock password** is unchecked.
5. ☐ Tick **Turn on Recovery Lock password** and click **Save**.
   - ✅ *(UI)* success toast `Successfully updated Recovery Lock password enforcement.`
6. ☐ Reload the Passwords page for VMs (`/controls/os-settings/passwords?fleet_id=<VMs>` via URL, pick **VMs** again).
   - ✅ *(UI)* the **Passwords** heading is visible and the checkbox enabled (`PasswordsPage.goto` anchor), and it is **checked** — the save stuck.
   - ✅ *(API)* `mdm.enable_recovery_lock_password` is true on VMs.
   - ✅ *(API)* an `enabled_recovery_lock_passwords` activity for the VMs fleet (`fleet_id` or `team_id`), newer than step 2's id, by the suite admin.
7. ☐ *(API wait, ≤4 min)* Fleet's 30-second cron sends the Mac `SetRecoveryLock`; wait for its status to read `verified`.
   - ✅ *(API)* `password_available` is true.
   - ✅ *(API)* a `set_host_recovery_lock_password` activity for this host, newer than step 2's id, with **no actor** — Fleet's cron set it, not a user.
8. ☐ Open the host at `/hosts/:id` → Activity card → **Past** tab.
   - ✅ *(UI)* an item "… set a Recovery Lock password for this host" (the first match — the card shows 8 per page and the VM specs running alongside push older entries off it, so it's read straight after the event).
9. ☐ Open the **Controls** tab.
   - ✅ *(UI)* the **Recovery Lock password** row reads `Verified`.
10. ☐ *(API)* note the newest activity id. **Actions** → **Show Recovery Lock password**.
    - ✅ *(UI)* the option is offered in the menu (`runAction` asserts it before clicking).
    - ✅ *(UI)* the Recovery Lock password modal is open.
    - ✅ *(UI)* the password field is masked; click **Show secret** → it's shown as text, and it isn't empty. Note the value.
    - ✅ *(UI)* the banner **Password rotates automatically after …** is visible — viewing scheduled Fleet's own rotation.
    - ✅ *(API)* a `viewed_host_recovery_lock_password` activity for this host, newer than the id just noted, by the suite admin.
11. ☐ *(API)* note the newest activity id. Click **Rotate password** (✅ *(UI)* visible first).
    - ✅ *(UI)* success toast `Successfully sent request to rotate Recovery Lock password.`
    - ✅ *(UI)* the modal closes.
    - ✅ *(API)* a `rotated_host_recovery_lock_password` activity for this host, newer than the id just noted, by the suite admin.
12. ☐ Reload the host → Activity card → **Past** tab.
    - ✅ *(UI)* an item "… triggered rotation of the Recovery Lock password for this host".
    - ✅ *(UI)* an item "… viewed the Recovery Lock password for this host" (first match each).
13. ☐ *(API wait, ≤4 min)* the Mac's status reads `verified` again.
14. ☐ Reload the host, **Actions** → **Show Recovery Lock password**, **Show secret**.
    - ✅ *(UI)* masked, then shown, not empty — and **different from the password noted in step 10**.
    - ☐ Click **Close** → ✅ *(UI)* the modal is hidden.
15. ☐ *(API)* note the newest activity id. Passwords page for VMs (URL, pick **VMs**) → untick the checkbox → **Save** → toast. Reload it for VMs.
    - ✅ *(UI)* the checkbox is unchecked.
    - ✅ *(API)* `mdm.enable_recovery_lock_password` is false on VMs.
    - ✅ *(API)* a `disabled_recovery_lock_passwords` activity for the VMs fleet, newer than the id just noted, by the suite admin.
16. ☐ *(API wait, ≤4 min)* Fleet sends `ClearRecoveryLock`; wait for the Mac's status to be null.
    - ✅ *(API)* `password_available` is false.
17. ☐ Reload the host → **Controls** tab.
    - ✅ *(UI)* no **Recovery Lock password** row (count 0) — after the tab rendered its table or "No controls".
18. ☐ Open **Actions**.
    - ✅ *(UI)* **Transfer** is visible — the menu rendered.
    - ✅ *(UI)* **Show Recovery Lock password** is absent (count 0).
19. ☐ *(API teardown, `afterEach`)* `PATCH /teams/<VMs>` with `{ "mdm": { "enable_recovery_lock_password": false } }` — a no-op when step 15 succeeded.

**Assessment**
- *Value:* high, and the only Recovery Lock coverage in the suite: the fleet setting, Fleet's cron putting a password on a real Mac, the escrow being readable, a manual rotation producing a new password, and the clear — each read through both the UI and the host record. Step 14's "different password" check is what proves the rotation reached the Mac rather than just logging an activity, and the actor-less `set_host_recovery_lock_password` pins who Fleet says set it. Activity freshness is done properly — each activity must be newer than the log's last id before its step (`latestActivityId` → `assertActivityAfter`) — better than most activity checks in the suite.
- *Live (2026-09-29):* the **virtual** Mac (`VirtualMac2,1`) accepts `SetRecoveryLock` and verifies it; the whole test takes 45–60 s, each Mac round trip well inside the 4-minute waits. Green with dependencies, headed and `--repeat-each=5` (one worker). Fleet's own `set_host_recovery_lock_password` carries `actor_email: ""`, which `assertActivityAfter` treats as no actor.
- *Coverage gaps:* only the admin — who else may open the modal or **Rotate password** (maintainer, technician, observer, a VMs team admin) is untested; Unassigned and Workstations are never used (by design: only VMs has a Mac); the automatic rotation a view schedules (an hour out) is never seen, nor that clearing drops it, as the header says it does; the modal's copy button is unused; the `failed` status only shows up as a timeout message; on free the Passwords card is paywall-only ([MISC-20](13-labels-packs-dashboard-paywalls.md)).
- *Redundancy:* none — nothing else touches Recovery Lock. The Actions-menu "positive control, then absence" in step 18 is HOSTP-05's pattern.
- *Efficiency / smells:*
  - **Budget.** Four real waits of up to 4 minutes (the dead-run wait normally returns at once) leave about 9 minutes of the 25 for the UI, so a slow Mac fails a wait with Fleet's `detail` before the test times out. If it does time out, the `afterEach` still turns enforcement off.
  - **The rotation wait** (step 13) doesn't look for `pending` first. It doesn't need to: Fleet marks the password pending inside the rotate request (`InitiateRecoveryLockRotation`), before the success toast, so the wait can't return on the pre-rotation status. The spec says so in a comment.
  - Label-targeting specs borrow MDM-enrolled macOS simulations onto VMs while they run. If one is there when enforcement turns on, Fleet may queue `SetRecoveryLock` for it as well (⚠️ unverified whether Fleet treats a simulation as Apple silicon) — harmless to this test, which watches only the real Mac, but it widens what the setting touches.
  - The host Activity card items are read straight after each event because the card shows 8 per page and the VM specs alongside push entries off it — still a race, just a short one; the "viewed" item is only looked for after the rotation, one reload later. They use `.first()`, leaving freshness to the API checks. `controlRow` is documented as a profile row and is reused here for the Recovery Lock row.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOSTP-17 · Premium • Hosts • bulk transfer › a filter the server cannot transfer by withholds "Select all matching hosts"

- **File:** [`playwright/tests/e2e/premium/hosts/bulk-transfer.spec.ts`](../../tests/e2e/premium/hosts/bulk-transfer.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "withholds"`
- **Project:** premium · **Scope:** All fleets (the dashboard's default)
- **Mode:** UI · **Isolation:** parallel; mutates nothing
- **Preconditions:** more than a page (50) of hosts with under 32 GB free; ~680 on premium (2026-10-03), most of the load fleet.
- **Data created:** none

**Flow**

1. ☐ Open `/dashboard`; click the **Low disk space hosts** card.
   - ✅ *(UI)* the Hosts list's pill is "hosts filtered by Low disk space"; a row is listed.
2. ☐ Tick the header select-all checkbox.
   - ✅ *(UI)* the selection bar reads "All hosts on this page are selected" and "50 selected".
   - ✅ *(UI)* **Select all matching hosts** isn't there.

**Assessment**
- *Value:* A safety property, not a cosmetic one. Fleet's server transfers by filter on query, status, label and fleet only, while the page sends every filter it has. Under Low disk space (or a policy, software, OS, vulnerability or MDM filter) "all matching" would move every host the remaining filters match, so the page withholds the button (`showMarkAllPages={!unsupportedFilter}`). A regression there would make a bulk transfer silently over-reach.
- *Coverage gaps:* One unsupported filter of the seven; the delete action's matching guard (same flag) isn't asserted separately.
- *Redundancy:* HOSTP-03 is the positive (Unassigned, no filter); together they pin the flag both ways.
- *Efficiency / smells:* Seconds. The presence half (the page-selected copy and "50 selected") is asserted before the absence, so the check can't pass on a selection bar that never rendered.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOSTP-18 · Premium • Hosts • transfer every matching host › "Select all matching hosts" transfers every host the filter matches, not just the page

- **File:** [`playwright/tests/e2e/premium/hosts/bulk-transfer.spec.ts`](../../tests/e2e/premium/hosts/bulk-transfer.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "transfers every host the filter matches"`
- **Project:** premium · **Scope:** a throwaway `pw-transfer-<nonce>` fleet → Unassigned
- **Mode:** UI+API · **Isolation:** parallel; its own fleet and an offline pool nothing else uses. The `afterEach` deletes the fleet by name, which returns any host still on it to Unassigned; the cleanup projects sweep a fleet a killed run left.
- **Preconditions (API):** 51 **offline** Linux simulations on Unassigned (`findOfflineSimulations`, the most recently seen first). The perf daemons abandon their set of ~300 at the daily refresh (16:00 UTC), and host expiry deletes it a day later, so ~100 Ubuntu ones are always offline and no other picker reads them. Fewer fails with that explanation.
- **Data created:** the fleet (deleted in the test and in the `afterEach`). The 51 hosts end on Unassigned, where they started.

**Flow**

1. ☐ *(API)* Create `pw-transfer-<nonce>`; `POST /hosts/transfer` the 51 hosts onto it.
2. ☐ *(guard)* Route `POST /hosts/transfer/filter`: let it through only when `filters.fleet_id` is the throwaway fleet; abort anything else.
3. ☐ Open the Hosts list on the fleet; select it in the fleet dropdown.
   - ✅ *(UI)* a row is listed.
4. ☐ Tick the header checkbox; click **Select all matching hosts**.
   - ✅ *(UI)* "50 selected", then "All matching hosts are selected" and "51 selected".
5. ☐ **Transfer** → **Unassigned** → **Transfer**.
   - ✅ *(UI)* toast "Hosts successfully removed from fleets."
   - ✅ *(guard)* no request was refused; exactly one by-filter transfer went, with `fleet_id: null` (Unassigned).
   - ✅ *(API)* the fleet holds no host, and all 51 are on Unassigned, the 51st included: a transfer of the selected page alone would leave one behind.
6. ☐ *(API, `finally`)* Delete the fleet.

**Assessment**
- *Value:* The only coverage of `POST /hosts/transfer/filter` from the UI, and of what "Select all matching" actually does: the count it shows and the request it sends; 51 hosts, one more than a page, make "all matching" differ from "this page". Without the offline pool this needed `exclusive/` or a cut; with it, it costs seconds and touches nothing another spec reads.
- *Coverage gaps:* Only the fleet filter; a search or status filter combined with it, and a named destination, aren't covered. The guard stops a wrong request rather than reporting what the server would have done with it.
- *Redundancy:* HOSTP-01 covers the by-id transfer of a selected page.
- *Efficiency / smells:* ~10 s. The route guard is the safety property: a regression that dropped the fleet from the filter would otherwise move every offline simulation on the instance (still harmless, but not this test's to move).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOSTP-19 · Premium • Hosts • CTA visibility by role › technician and fleet roles (4 variants)

- **File:** [`playwright/tests/e2e/premium/hosts/cta-visibility.spec.ts`](../../tests/e2e/premium/hosts/cta-visibility.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "CTA visibility by role › (global technician|team admin|team maintainer|team observer)"`
- **Project:** premium · **Variants:** `global-technician` (All fleets), `team-admin` (VMs), `ws-maintainer`, `ws-observer` (Workstations, which may hold no hosts)
- **Mode:** UI · **Isolation:** one test per role; read-only
- **Data created:** none

**Flow**

1. ☐ Log in as the role → `/hosts/manage` on its scope (VMs picked in the team admin's dropdown; the `ws-*` roles have none). On Workstations the page is anchored on **Export hosts**, which shows on an empty fleet too.
2. ☐ ✅ *(UI)* **Export hosts** visible. **Add hosts** (the header's; an empty fleet's card repeats it) for TA and TM; none for GT and TO.
3. ☐ TA, TM: open the gear → ✅ *(UI)* **Enroll secrets**; **Activity automations** for TA only. Click **Enroll secrets** → the modal opens and closes. GT, TO: ✅ *(UI)* no gear.
4. ☐ GT, TA: open the label menu once the table settles → ✅ *(UI)* the search box and **Add label**. Not read for the `ws-*` roles: Fleet disables the label filter on a fleet with no hosts (their Add label is MISC-12 / MISC-32 on the Labels page).

**Assessment**
- *Value:* the premium dimension HOSTP-10/11 lacked: a technician (Add label without Add hosts or a gear) and the fleet roles on their own fleet.
- *Coverage gaps:* the team admin's Workstations view isn't read (VMs is where it has hosts). No fleet enroll secret is added or deleted and no host is moved: the admin's secrets are `premium/settings/enroll-secrets.spec.ts`, and a second writer would race its snapshot restore.
- *Efficiency / smells:* seconds.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOSTP-20 · Premium • Hosts • Actions by role › <role> is offered the host actions its role grants

- **File:** [`playwright/tests/e2e/premium/hosts/host-actions-role-access.spec.ts`](../../tests/e2e/premium/hosts/host-actions-role-access.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "Premium • Hosts • Actions by role › .* is offered"`
- **Project:** premium · **Variants (5):** `global-maintainer`, `global-observer`, `global-observer-plus`, `global-technician` on an online Linux simulation (Unassigned); `team-admin` on an online VMs-fleet host (a real VM when one is online — simulations other specs borrow onto that fleet can leave mid-test)
- **Mode:** UI · **Isolation:** one test per role; nothing runs or moves
- **Preconditions (API):** two global reports under one `pw-role-hostrep-<role>-<nonce>` marker: `…-observers` (*Observers can run*) and `…-others`. Deleted in an `afterEach`.

**Flow**

1. ☐ Log in as the role → the host's details by id → **Actions**.
   - ✅ *(UI)* **Live report** (the anchor). **Run script** for GM, GT, TA; **Transfer** for GM, GT; **Delete** for GM, TA. None of the three for GO, GO+.
2. ☐ **Live report** → the "Select a report" modal → filter by the marker.
   - ✅ *(UI)* `…-observers` listed for everyone; `…-others` for every role but GO. The **create a report** link for GM, GO+, TA, not GO (the technician's is HOSTP-21). **Close**.

**Assessment**
- *Value:* the host's actions by role, read off an open menu, and the observer's report list.
- *Coverage gaps:* Lock / Wipe / Turn off MDM need an MDM-enrolled host. The `ws-*` roles are left out: Workstations has no hosts.
- *Redundancy:* the team admin's no-Transfer is also in `host-transfer-permissions.spec.ts`.
- *Efficiency / smells:* seconds.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### HOSTP-21 · Premium • Hosts • Actions by role › global-technician is not offered "create a report" from a host *(skipped)*

- **File:** [`playwright/tests/e2e/premium/hosts/host-actions-role-access.spec.ts`](../../tests/e2e/premium/hosts/host-actions-role-access.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "global-technician is not offered"`
- **Project:** premium · **Mode:** UI · **Isolation:** skipped behind [fleetdm/fleet#54622](https://github.com/fleetdm/fleet/issues/54622)

**Flow**

1. ☐ Log in as `global-technician` → an online Linux simulation → **Actions** → **Live report**.
   - ✅ *(UI)* the modal's **Close**; no **create a report** link.

**Assessment**
- *Value:* the link leads a technician to a 403 (`/reports/new`). Run un-skipped on 2026-10-05, the link was there.
- *Efficiency / smells:* skipped.

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
| Single-host transfer, per role | HOSTP-04 (admin, maintainer, technician), HOSTP-05 (team admin denied) | observer / observer-plus; fleet→fleet moves; activity feed |
| Bulk delete | HOSTP-06 | cancel path; observer denial; activity feed; no `finally` restore |
| Single-host delete | HOSTP-07 (team admin), HOSTP-08 (admin) | cancel path; team observer denial; cross-fleet denial; redirect asserted without a URL check |
| Host Actions menu gating by platform/MDM/tier | HOSTP-12 + free mirror | role dimension entirely absent; Unlock; enrolled-but-disconnected Apple host |
| Hosts-list header CTAs by role | HOSTP-10, HOSTP-11 (+ free mirror) | fleet-scoped roles (`team-admin`, `ws-*`); observer-plus; technician |
| Per-host stored report results | HOSTP-09 | negative case (no stored result → no **Show details**); row count and "last fetched" line; the card-vs-report cell comparison covers the **first row** and, in practice, the furniture's **single** column |
| Host end user (IdP username) — add, edit, remove, role gate | HOSTP-13 (UI), HOSTP-14 (API contract), HOSTP-15 (observer not offered it); free: [HOST-24](02-hosts-shared-and-free.md) (Premium message), [API-31](14-api-contracts.md) (402) | SCIM-backed fields (the instance has no SCIM data); maintainer / fleet-scoped roles; replacing one username with another; no API role probe |
| Recovery Lock password — enforce, set, view, rotate, clear on a real Mac | HOSTP-16 | non-admin roles; the automatic rotation a view schedules; the `failed` path |
| Lock / Wipe / Unlock / Turn off MDM **execution** | — | intentionally uncovered (unrecoverable on QA VMs) |
| Hosts-list filters (status, label, OS, policy), pagination, sorting, columns, CSV export, host details vitals/software/policies | not this area — `shared/hosts/*` and other audit files | `LabelFilter`, `StatusFilter`, `Pagination`, `clickHoverAction` are unused by these eight specs |

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
- **Activity records as the check on who did what** — HOSTP-13 (`edited_host_idp_data`) and HOSTP-16 (five Recovery Lock types) assert the record through the API, each required to be newer than the log's last id before its step (`assertActivityAfter`), so an earlier run's identical entry can't satisfy them; HOSTP-16 also reads Fleet's rendered copy on the host's Activity card. That's the pattern the transfer/delete entries below would want if they gained activity checks.
- **The gap is the activity feed:** no test in this area asserts `transferred_hosts` / `deleted_host` activity copy, even though the suite has `dashboard.expectActivities` and `helpers/api/activity-copy.ts` for exactly this, and transfers/deletes are the canonical audit-trail events.

**Quick wins**

1. Wrap HOSTP-06 and HOSTP-07 in `try/finally` that transfers any surviving staged host back to Unassigned — today a mid-test failure parks sims in **Workstations**/**VMs** permanently and wedges the next run's `2 selected` rail ([`host-delete.spec.ts:34`](../../tests/e2e/premium/hosts/host-delete.spec.ts), `:70`).
2. Give HOSTP-01 and HOSTP-04 different destination fleets (or fold HOSTP-04's transfer into a fleet nobody select-alls) — both stage into **QA** in parallel, so HOSTP-01's `3 selected` can see 4 ([`bulk-transfer.spec.ts:48`](../../tests/e2e/premium/hosts/bulk-transfer.spec.ts), [`host-transfer-permissions.spec.ts:55`](../../tests/e2e/premium/hosts/host-transfer-permissions.spec.ts)).
3. Add `await expect(page).toHaveURL(/\/hosts\/manage/)` to HOSTP-08's post-delete assertion — the current `firstRowWithLink` check would pass on any table ([`host-delete.spec.ts:109`](../../tests/e2e/premium/hosts/host-delete.spec.ts)).
4. Point HOSTP-12's macOS case at the `liveMacosHost` worker fixture instead of re-running `findOnlineHost('darwin', { kind: 'real' })`, and raise/target the Linux scan so it can't return `null` from a name-skewed first 100 hosts ([`mdm-actions-availability.spec.ts:63`](../../tests/e2e/premium/hosts/mdm-actions-availability.spec.ts), [`helpers/api/hosts.ts:303`](../../helpers/api/hosts.ts)).
5. Reconcile the delete-pool restore story: either install `com.fleetqa.perf.refresh.plist` on the VM or correct HOSTP-06's header, which asserts a "scheduled daily refresh" that `install.sh` only sets up behind `--daily-refresh` ([`host-delete.spec.ts:18`](../../tests/e2e/premium/hosts/host-delete.spec.ts), [`tools/perf-hosts/README.md`](../../../tools/perf-hosts/README.md)).
6. Give HOSTP-16 an `afterEach` that turns enforcement off, and either widen its 20-minute budget or shorten the Mac waits so a slow Mac fails a wait (with Fleet's `detail`) before the test times out and skips its `finally` ([`recovery-lock.spec.ts:60`](../../tests/e2e/premium/hosts/recovery-lock.spec.ts)).

**Bigger bets**

1. **A dedicated scratch fleet per mutating host spec** (gitops-provisioned, e.g. `pw-hosts-scratch-1..3`). It removes the QA collision, gets bulk-delete out of Workstations, and makes "select all on this page can only act on my hosts" a real invariant rather than a convention — which is what the safety rails are currently compensating for.
2. **Merge the three delete tests into two** and drop one destroyed host per run: keep bulk-delete (HOSTP-06, with a cancel-path assertion added), and merge HOSTP-07 + HOSTP-08 into one team-admin details-page delete that keeps both the per-host modal copy and a URL-asserted redirect. Move the pure "can this role delete" question to `tests/api/role-access/premium/`.
3. **Turn HOSTP-05 + HOSTP-12 into one role × platform Actions-menu matrix.** Both already open the menu and count options; one data-driven spec over (role, platform, MDM state) → offered actions would close the RBAC dimension HOSTP-12's docstring claims and give Lock/Wipe genuine permission coverage without ever firing them.
