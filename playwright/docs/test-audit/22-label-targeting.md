# Label targeting — test audit

**Specs covered:** 7 files · **Entries:** 9 · **Runtime tests:** 12, one skipped (LT-03's four cases collapsed into one entry) · **Project:** premium

This area covers Fleet deciding **which hosts** something reaches when it is scoped to labels — configuration
profiles first (then declarations, software, policies and reports)
— and the host then doing it. Custom targets are premium-only: free renders no target, and delivers every
profile to every host.

**Read this before running anything.**

**1. The assertion is set membership.** A targeting test resolves the hosts it controls, gives them manual
labels, and asserts the profile is listed on *exactly* the hosts its labels pick and on none of the others —
never a count, and never over the whole fleet (an Exclude-only profile targets every other host there too,
including simulations another spec has borrowed). A count like `verifiedHostsCount >= 2` on a fleet-wide
aggregate passes whether targeting worked or not.

**2. Two kinds of host, for two questions.** Each test runs on the **VMs** fleet with the platform's real VM
and two MDM-enrolled **simulations** moved onto the fleet for the test (`findMdmSimulations`, from Unassigned;
moved back in the `finally`, and by the cleanup sweep if the test dies):

- *Which hosts Fleet lists a profile for* is its server-side decision. A simulation answers it as well as a VM:
  it lists every profile that targets it (a macOS simulation even acknowledges the install and sits at
  "verifying") and none that doesn't. That's how a host of the same platform can be outside the label — there
  is one real VM per platform.
- *What the host does with it* — installed, verified, the setting really there — only the VM answers, read back
  with a live query **filtered to the profile's own domain or value** (an unfiltered `managed_policies` read
  returns fleetd's config, enroll secret included).

**3. Labels are manual.** The osquery-perf pool answers every dynamic label's query, so a dynamic label holds
whatever the simulations reported. Manual labels hold exactly what the test put there (`createManualLabel`).

**4. Every profile is inert.** Generated at run time (`helpers/profiles.ts`): one key in a preference domain
of its own on macOS, Game DVR off on Windows — the pattern of the committed `fleet-pw-inert.*` pair, whose
READMEs say why each is safe on a real VM. The VMs fleet can hold only one generated Windows profile at a
time (they share the one approved LocURI).

**5. Timing.** Fleet's profile reconciler runs every 30 s and decides every host for a profile in one tick.
A macOS profile reads *verified* only after the host's next detail collection, so the test requests a refetch
(after waiting out any outstanding one). A Windows profile is verified by Fleet reading the LocURI back, within
about a minute. Removal: the macOS domain is gone ~20 s after the delete; Windows puts the value back to its
default (`AllowGameDVR` reads `1`) rather than deleting it.

**6. Simulations come from two pools that can't overlap.** Only a profile needs an MDM-enrolled host, and
the enrolled simulations are scarce (8 macOS ones past the transfer specs' part of the pool), so only the
profile specs draw on `findMdmSimulations`; software, policies, reports and label membership draw on
`findSimulations`, the hosts that *aren't* enrolled. Each spec claims its own slice (the registry is in
`helpers/api/hosts.ts`), and the ordering spans every fleet, so a host another spec has borrowed keeps its place.

**7. Cleanup.** Profiles, labels and borrowed simulations are undone in the test's `finally` — which a
**timed-out** test never reaches usefully (it runs on a closed request context). The VMs sweep in
`setup/cleanup.steps.ts` deletes `pw-*` profiles, returns any simulation on the VMs fleet to Unassigned, then
deletes `pw-*` labels (last: Fleet refuses to delete a label a profile targets). Verified 2026-09-29 against a
run that timed out with 4 profiles, 4 simulations and 6 labels left behind.

## Contents

| ID | Spec | Test | Mode | Manual? |
|---|---|---|---|---|
| LT-01 | `premium/controls/os-settings/profile-label-targets.spec.ts` | macOS: include all, include any + exclude, and exclude reach exactly the hosts their labels pick | UI+API | ☐ |
| LT-02 | `premium/controls/os-settings/profile-label-targets.spec.ts` | Windows: include all + exclude reaches only the VM, and an edit that excludes it takes the profile back off | UI+API | ☐ |
| LT-03 | `premium/controls/os-settings/profile-broken-labels.spec.ts` | a {manual, dynamic} label that {a macOS profile, a declaration, a Windows profile} targets can't be deleted until the profile is gone | UI+API | ☐ |
| LT-04 | `premium/controls/os-settings/profile-declarations.spec.ts` | a declaration with no target, include all, or exclude reaches exactly the hosts its labels pick | UI+API | ☐ |
| LT-05 | `premium/controls/os-settings/profile-delivery-retry.spec.ts` | a profile is installed, resent and removed by commands the host names it in | UI+API | ☐ |
| LT-06 | `premium/controls/os-settings/profile-delivery-retry.spec.ts` | a profile the host refuses is retried three times, then reads Failed | UI+API | ☐ |
| LT-07 | `premium/software/software-label-targets.spec.ts` | a package scoped include all, include any or exclude any is offered to exactly the hosts its labels pick | UI+API | ☐ |
| LT-08 | `premium/policies/policy-label-targets.spec.ts` | include all, include any + exclude any, and exclude all run on exactly the hosts their labels pick | UI+API | ☐ |
| LT-09 | `premium/reports/report-label-targets.spec.ts` | include all and include any schedule a report on exactly the hosts their labels pick | UI+API | ☐ |

---

### LT-01 · Premium • Controls • Configuration profiles — label targeting › macOS: include all, include any + exclude, and exclude reach exactly the hosts their labels pick

- **File:** [`playwright/tests/e2e/premium/controls/os-settings/profile-label-targets.spec.ts`](../../tests/e2e/premium/controls/os-settings/profile-label-targets.spec.ts)
- **Grep:** `npx playwright test --project=premium profile-label-targets -g "macOS"`
- **Project:** premium · **Scope:** the **VMs** fleet, chosen in the fleet dropdown · **Hosts:** the macOS VM + two MDM-enrolled macOS simulations (`s1`, `s2`) borrowed onto the fleet
- **Mode:** UI+API · **Isolation:** standalone; test timeout 900 s; `finally` deletes the profiles, returns the simulations, deletes the labels
- **Preconditions:** an online real macOS VM on the VMs fleet (`requireRealHost`); two online MDM-enrolled macOS simulations on Unassigned past the transfer specs' slice (`findMdmSimulations(…, 'darwin', 2, 0)`)
- **Data created:** three manual labels `pw-lt-<nonce>-{a,b,c}` — a = VM + s1, b = VM + s2, c = s2 — and three generated profiles `pw-lt-<nonce>-{all,any,exclude}` on the VMs fleet, all removed in-test. The VM's MDM command history gains InstallProfile / RemoveProfile entries for them

| profile | target | listed on (of VM, s1, s2) | why |
|---|---|---|---|
| `…-all` | Include **all** of a, b | VM | only the VM is in both |
| `…-any` | Include **any** of a, b · Exclude c | VM, s1 | everyone is in a or b; c takes s2 out |
| `…-exclude` | Exclude a | s2 | only s2 is outside a — the VM never gets it |

**Flow**

1. ☐ (No user action) Resolve the VM and the two simulations; move the simulations to the VMs fleet; create the three manual labels.
   - ✅ *(API)* The VM is on the VMs fleet; two simulations were found.
2. ☐ Dashboard → **Controls** → **OS settings** → **Configuration profiles** → fleet dropdown **VMs**.
3. ☐ For each profile in the table: **Add profile** → choose the file → **Custom** → set the target (Include tab: **Any** or **All** + tick labels; **Exclude** tab: tick labels) → **Add profile**.
   - ✅ *(UI)* *"Successfully uploaded."*; the row appears.
   - ✅ *(UI)* The row reads **2 labels** / **3 labels** / **1 label**.
   - ✅ *(API)* The stored `labels_include_all` / `labels_include_any` / `labels_exclude_any` are exactly the ones ticked.
4. ☐ Hover `…-any`'s row → **Edit**.
   - ✅ *(UI)* **Custom** is selected; both tab headings carry the check that marks a tab holding labels; the Include tab's **Any** is selected; a and b are ticked; c is **disabled** on Include.
   - ✅ *(UI)* On the **Exclude** tab c is ticked and a is **disabled**. **Cancel**.
5. ☐ (No user action) Wait for the reconciler.
   - ✅ *(API)* Each profile is listed on exactly the hosts in the table — polled together, ≤ 3 min.
6. ☐ (No user action) Wait for the VM: both profiles that include it go *verifying*; request a refetch (after any outstanding one lands); both go **verified** (≤ 3 min).
7. ☐ Live-query the VM: `SELECT name, value FROM managed_policies WHERE domain = 'com.fleetdm.qa.playwright.<profile>';`
   - ✅ *(API)* `…-all` and `…-any` each read `Marker = fleet-playwright-<profile>`; `…-exclude` reads nothing.
8. ☐ Open the VM's host page → **Controls** tab.
   - ✅ *(UI)* `…-all` and `…-any` rows read **Verified**; there is no `…-exclude` row.
   - ✅ *(API)* The three listings are unchanged.
9. ☐ Back to the VMs fleet's profiles → hover `…-all` → **Delete** → confirm.
   - ✅ *(UI)* *"Successfully deleted."*
   - ✅ *(API)* The VM stops listing it (≤ 3 min) and its domain reads empty on the device (≤ 2 min).

**Assessment**
- *Value:* High. Include all + exclude, include any + exclude, and exclude on macOS, plus upload-and-remove, in one test that can actually fail: an Include-all read as Include-any lists `…-all` on s1 and s2; a broken Exclude lists `…-any` on s2 and `…-exclude` on the VM; a target the modal didn't send fails step 3's stored scopes.
- *Coverage gaps:* Include **all** + Exclude together is on Windows (LT-02), not here. "All hosts" (no target) delivery is the configuration-profiles augment's. Nothing checks the Details (status) modal's counts — they're fleet-wide aggregates other specs' simulations feed.
- *Redundancy:* none within the suite.
- *Efficiency / smells:* ~3 min, most of it the VM's verification. The simulations' own statuses are never asserted — only whether they list the profile.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### LT-02 · Premium • Controls • Configuration profiles — label targeting › Windows: include all + exclude reaches only the VM, and an edit that excludes it takes the profile back off

- **File:** [`playwright/tests/e2e/premium/controls/os-settings/profile-label-targets.spec.ts`](../../tests/e2e/premium/controls/os-settings/profile-label-targets.spec.ts)
- **Grep:** `npx playwright test --project=premium profile-label-targets -g "Windows"`
- **Project:** premium · **Scope:** the **VMs** fleet · **Hosts:** the Windows VM + two MDM-enrolled Windows simulations (`s1`, `s2`) borrowed onto the fleet
- **Mode:** UI+API · **Isolation:** standalone; test timeout 900 s; `finally` deletes the profile, returns the simulations, deletes the labels
- **Preconditions:** an online real Windows VM on the VMs fleet; two online MDM-enrolled Windows simulations on Unassigned (`findMdmSimulations(…, 'windows', 2, 0)`); **no other generated Windows profile on the VMs fleet** (they share the LocURI) — asserted before anything is created
- **Data created:** manual labels `pw-lt-<nonce>-{wa,wb,wc}` — wa = all three hosts, wb = VM + s2, wc = s2 — and the generated profile `pw-lt-<nonce>-win`, all removed in-test

**Flow**

1. ☐ (No user action) Resolve the hosts, move the simulations to the VMs fleet, create the labels.
2. ☐ Dashboard → **Controls** → **OS settings** → **Configuration profiles** → **VMs** → **Add profile** → choose the file → **Custom** → Include **All** of wa, wb → **Exclude** wc → **Add profile**.
   - ✅ *(UI)* *"Successfully uploaded."*; the row reads **3 labels**.
   - ✅ *(API)* Stored: include-all wa, wb; exclude-any wc.
   - ✅ *(API)* Listed on exactly the VM — s1 is only in wa; s2 is in both but wc excludes it (≤ 3 min).
   - ✅ *(API)* The VM lists it **verified**.
3. ☐ Live-query the VM's `HKLM\SOFTWARE\Microsoft\PolicyManager\current\device\ApplicationManagement` value `AllowGameDVR`.
   - ✅ *(API)* It reads `0` — the profile's setting.
4. ☐ The VM's host page → **Controls** tab.
   - ✅ *(UI)* The profile's row reads **Verified**.
5. ☐ Back to the profiles list → hover the row → **Edit** → untick everything → **Exclude** wb → **Update profile**.
   - ✅ *(UI)* *"Successfully updated profile."*
   - ✅ *(API)* Stored: exclude-any wb only.
   - ✅ *(API)* Now listed on exactly s1 — the VM and s2 are in wb.
6. ☐ (No user action) Wait for Fleet to take it off the VM.
   - ✅ *(API)* The VM stops listing it (≤ 3 min); `AllowGameDVR` no longer reads `0` (Windows restores its default, `1`).
   - ✅ *(UI)* The VM's **Controls** tab has no row for it.

**Assessment**
- *Value:* High. Covers Windows include/exclude, negative half included, plus the **Edit** modal's re-targeting (new in 4.91), and proves an edit that excludes a host *removes* the profile from it, on the device.
- *Coverage gaps:* Include **any** on Windows isn't exercised; one Windows profile at a time means the modes can't run side by side.
- *Redundancy:* none.
- *Efficiency / smells:* the `finally` can't help a timed-out run; the cleanup sweep does.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### LT-03 · Premium • Controls • Configuration profiles — a targeted label › a {manual, dynamic} label that {a macOS profile, a declaration, a Windows profile} targets can't be deleted until the profile is gone

- **File:** [`playwright/tests/e2e/premium/controls/os-settings/profile-broken-labels.spec.ts`](../../tests/e2e/premium/controls/os-settings/profile-broken-labels.spec.ts)
- **Grep:** `npx playwright test --project=premium profile-broken-labels` (four runtime tests: manual label × macOS profile, declaration, Windows profile; dynamic label × macOS profile)
- **Project:** premium · **Scope:** **Workstations** (holds no hosts, so nothing is delivered) · **Hosts:** none targeted; a manual label holds two macOS simulations, never moved
- **Mode:** UI+API · **Isolation:** parallel, one test per case; `pageHealth` disabled (the refused delete is a deliberate 422); `finally` deletes whatever is left
- **Preconditions:** two online macOS simulations (`findSimulations(…, 'darwin', 2, 0)` — not MDM-enrolled; label membership doesn't need it) for the manual cases
- **Data created:** a label `pw-bl-<nonce>` (manual with the two simulations, or dynamic with `SELECT 1 FROM osquery_info WHERE 1 = 0;`) and a generated profile `pw-bl-<nonce>-p` on Workstations targeting it (include any) — both deleted by the test itself, through the UI

**Why a refused delete, not a broken profile.** Deleting a targeted label used to leave the profile reading
as *broken* ("The configuration profile is broken.", "Label deleted") and not applied to new hosts. Since Fleet
4.87 `DeleteLabel` refuses the delete (422) for any label a profile *or declaration* targets, and 4.91 removed the
Custom target modal that showed it. The broken state can't be reached through the product any more, so the
refusal is what's left to guard.

**Flow**

1. ☐ (No user action) Create the label; upload the profile to Workstations targeting it (API).
2. ☐ Go to `/labels/manage` → page to the label's row → **Actions** → **Delete** → **Delete** in *Delete label*.
   - ✅ *(UI)* Error toast: *"Couldn't delete. A configuration profile targets this label. Please delete the profile and try again."* — the same copy for a declaration.
3. ☐ Reload the Labels page.
   - ✅ *(UI)* The label's row is still there.
   - ✅ *(API)* A manual label still holds exactly its two hosts.
   - ✅ *(API)* The profile still targets it (`labels_include_any`), and nothing is marked `broken`.
4. ☐ **Controls** → **OS settings** → **Configuration profiles** → **Workstations**.
   - ✅ *(UI)* The profile's row reads **1 label**, with no warning icon.
5. ☐ Hover the row → **Delete** → confirm; back on the Labels page, delete the label again.
   - ✅ *(UI)* *"Successfully deleted."*, then *"Successfully deleted pw-bl-<nonce>."* — the guard lets go once nothing targets the label.

**Assessment**
- *Value:* Medium-high. Guards a data-integrity rule across all three things that can target a label (the declaration case is the easy one to lose — its link lives in a different table), plus the release once the profile goes.
- *Coverage gaps:* the **software** version of the refusal ("Software uses this label as a custom target…") belongs with the software targeting spec. The warning icon for a broken label can't be provoked, so it's asserted absent only.
- *Redundancy:* the upload is API-only on purpose — LT-01/02 cover targeting through the modal.
- *Efficiency / smells:* ~12 s for all four. The Labels page lists by name, 20 a page; `locateRow` pages to the label.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### LT-04 · Premium • Controls • Configuration profiles — declarations › a declaration with no target, include all, or exclude reaches exactly the hosts its labels pick

- **File:** [`playwright/tests/e2e/premium/controls/os-settings/profile-declarations.spec.ts`](../../tests/e2e/premium/controls/os-settings/profile-declarations.spec.ts)
- **Grep:** `npx playwright test --project=premium profile-declarations`
- **Project:** premium · **Scope:** the **VMs** fleet · **Hosts:** the macOS VM + two MDM-enrolled macOS simulations borrowed onto the fleet (`findMdmSimulations(…, 'darwin', 2, 2)`)
- **Mode:** UI+API · **Isolation:** standalone; test timeout 900 s; `finally` deletes the declarations, returns the simulations, deletes the labels
- **Preconditions:** as LT-01
- **Data created:** manual labels `pw-dc-<nonce>-{a,b}` — a = VM + s1, b = VM + s2 — and three generated declarations `pw-dc-<nonce>-{every,all,exclude}` of Apple's no-op test type (`com.apple.configuration.management.test`, one `Echo` string), all removed in-test

| declaration | target | listed on (of VM, s1, s2) |
|---|---|---|
| `…-every` | none — All hosts | VM, s1, s2 |
| `…-all` | Include **all** of a, b | VM |
| `…-exclude` | Exclude a | s2 |

**Flow**

1. ☐ (No user action) Resolve the hosts, move the simulations to the VMs fleet, create the labels.
2. ☐ Dashboard → **Controls** → **OS settings** → **Configuration profiles** → **VMs**; for each row of the table: **Add profile** → choose the `.json` → (for a target) **Custom** + the Include / Exclude labels → **Add profile**.
   - ✅ *(UI)* *"Successfully uploaded."*; the row reads **macOS, iOS, iPadOS (declaration)**; **2 labels** / **1 label**, and no label count for `…-every`.
   - ✅ *(API)* The stored targets are exactly the ones set.
3. ☐ (No user action) Wait for the reconciler.
   - ✅ *(API)* Each declaration is listed on exactly the hosts in the table — polled together, ≤ 3 min.
4. ☐ (No user action) Wait for the VM to report the two that include it.
   - ✅ *(API)* `…-every` and `…-all` read **verified** on the VM — the device's own DDM status report (≤ 5 min; about a minute in practice).
5. ☐ The VM's host page → **Controls** tab.
   - ✅ *(UI)* `…-every` and `…-all` read **Verified**; no `…-exclude` row.
   - ✅ *(API)* The listings are unchanged.
6. ☐ Back to the profiles → hover `…-all` → **Delete** → confirm.
   - ✅ *(API)* The VM stops listing it (≤ 3 min).

**Assessment**
- *Value:* High. Declarations keep their targeting in their own table and reach the Mac over DDM, not InstallProfile — a separate path from LT-01's. Covers a declaration's include/exclude, including the "All hosts" step, with a negative half that can fail.
- *Coverage gaps:* no on-device read — osquery has no table for a test declaration, so *verified* (the device's report) is the host-side proof. Include **any** isn't exercised for declarations.
- *Redundancy:* the modal's target controls are LT-01's; here they're the route, not the subject.
- *Efficiency / smells:* ~1 min.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### LT-05 · Premium • Controls • Configuration profiles — delivery on one host › a profile is installed, resent and removed by commands the host names it in

- **File:** [`playwright/tests/e2e/premium/controls/os-settings/profile-delivery-retry.spec.ts`](../../tests/e2e/premium/controls/os-settings/profile-delivery-retry.spec.ts)
- **Grep:** `npx playwright test --project=premium profile-delivery-retry -g "resent"`
- **Project:** premium · **Scope:** the **VMs** fleet · **Host:** the macOS VM only (the profile targets a manual label holding just the VM, so no borrowed simulation gets it)
- **Mode:** UI+API · **Isolation:** standalone; test timeout 900 s; `finally` deletes the profile and the label
- **Preconditions:** an online real macOS VM on the VMs fleet
- **Data created:** manual label `pw-rt-<nonce>` and generated profile `pw-rt-<nonce>-p` (API upload), both removed in-test; the VM's command history gains two InstallProfile and one RemoveProfile for it

**Flow**

1. ☐ (No user action) Create the label and upload the profile targeting it; wait for the VM to install it, request a refetch, wait for **verified**.
2. ☐ Open the VM's host page → Activity → **Past** → turn on **Show MDM commands**.
   - ✅ *(UI)* *"The InstallProfile command for pw-rt-<nonce>-p was acknowledged."*
   - ✅ *(API)* Exactly one InstallProfile for the profile, **Acknowledged**.
3. ☐ **Controls** tab → the profile's row reads **Verified** → hover it → **Resend**.
   - ✅ *(API)* A second InstallProfile for it, and both **Acknowledged** (≤ 3 min).
   - ✅ *(API)* After a refetch, **verified** again; *(UI)* the row reads **Verified**.
4. ☐ (No user action) Delete the profile (API); wait for the VM to stop listing it.
   - ✅ *(UI)* Activity (MDM commands): *"The RemoveProfile command for pw-rt-<nonce>-p was acknowledged."*

**Assessment**
- *Value:* High. The host activity showing the profile's name and status, and resending the profile, in one test on a real device: each command is tied to this profile by name and counted from the API, so a resend that silently didn't send fails.
- *Coverage gaps:* the fleet-wide Resend (the profile's Details modal → "Resend configuration profile" for every failed host) isn't exercised — it needs failed hosts, which LT-06 would give.
- *Redundancy:* none.
- *Efficiency / smells:* two refetches, ~5 min. The Activity card is checked for the newest item only (it pages, and other specs command the same Mac).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### LT-06 · Premium • Controls • Configuration profiles — delivery on one host › a profile the host refuses is retried three times, then reads Failed

- **File:** [`playwright/tests/e2e/premium/controls/os-settings/profile-delivery-retry.spec.ts`](../../tests/e2e/premium/controls/os-settings/profile-delivery-retry.spec.ts)
- **Refused profile:** `rejectedMobileconfig` — a Wi-Fi payload with no `SSID_STR`, approved for the VMs. macOS answers each InstallProfile with *"ConfigProfilePluginDomain (-307): Some required information in the profile is missing."* and applies nothing; the Mac VM has no Wi-Fi interface anyway. (An unknown `com.apple.` payload type isn't refused: macOS 26.6 installs it.)

**Flow, as written**

1. ☐ Upload the refused profile targeting a label holding only the VM.
   - ✅ *(API)* The VM lists it **failed** (≤ 8 min).
   - ✅ *(API)* Exactly **4** InstallProfile commands for it — the first and Fleet's 3 retries (`MaxAppleProfileRetries`) — all **Error**.
2. ☐ The VM's **Controls** tab.
   - ✅ *(UI)* The row reads **Failed**.
3. ☐ Activity → **Past** → **Show MDM commands**.
   - ✅ *(UI)* *"The InstallProfile command for <name> failed."*

**Assessment**
- *Value:* high — it counts the retries rather than only waiting for "Failed", and a failed control's count on the Controls tab ("Controls 1") is on the path.
- *Cost:* ~2.5 min on the Mac — four InstallProfile commands a reconciler tick apart, then Failed.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### LT-07 · Premium • Software — label-scoped software › a package scoped include all, include any or exclude any is offered to exactly the hosts its labels pick

- **File:** [`playwright/tests/e2e/premium/software/software-label-targets.spec.ts`](../../tests/e2e/premium/software/software-label-targets.spec.ts)
- **Grep:** `npx playwright test --project=premium software-label-targets`
- **Project:** premium · **Scope:** the **VMs** fleet · **Hosts:** the Ubuntu VM + two Linux simulations borrowed onto the fleet (`findSimulations(…, 'linux', 2, 0)`)
- **Mode:** UI+API · **Isolation:** standalone; timeout 900 s; `pageHealth` disabled (the refused label delete is a deliberate 422); `finally` deletes the title, returns the simulations, deletes the labels
- **Data created:** manual labels `pw-sl-<nonce>-{a,b}` — a = VM + s1, b = VM + s2 — and a per-run inert `.deb`, `fleet-pw-label-<nonce>`, uploaded to the VMs fleet (never a durable fixture: scoping changes the title for everyone). Installed on the VM and uninstalled again; the VMs sweep deletes a leftover title and purges the package from the Ubuntu VM

| scope | offered to (of VM, s1, s2) |
|---|---|
| none — All hosts | VM, s1, s2 |
| Include **all** of a, b | VM |
| Include **any** of a, b | VM, s1, s2 |
| Exclude **any** of a | s2 |

**Flow**

1. ☐ (No user action) Move the simulations, create the labels, upload the package (API).
   - ✅ *(API)* Unscoped, all three hosts are offered it.
2. ☐ The title's page (VMs fleet) → the row's **All hosts** badge → Edit → Target **Custom** → scope dropdown **Include all** → tick a, b → **Save** → **Save changes?** → **Save**.
   - ✅ *(UI)* *"Successfully edited fleet-pw-label-<nonce>_1.0.0_all.deb."*
   - ✅ *(API)* The package's `labels_include_all` is a, b; only the VM is offered it.
3. ☐ The Ubuntu VM's host page → **Software** → **Library** → search the package → **Install**.
   - ✅ *(API)* It installs, and the host's inventory agrees; then it's uninstalled and the inventory agrees again.
4. ☐ `/labels/manage` → label a → **Delete** → **Delete**.
   - ✅ *(UI)* *"Couldn't delete. Software uses this label as a custom target. Remove the label from the software target and try again."*
5. ☐ The row's label-count badge → Edit → **Include any** of a, b → Save.
   - ✅ *(API)* All three offered.
6. ☐ Edit → **Exclude any** of a → Save.
   - ✅ *(API)* `labels_exclude_any` is a; only s2 offered.

**Assessment**
- *Value:* High. Both scopes plus Exclude, with a negative half that can fail. The VM inside the scope really installs it.
- *Coverage gaps:* Linux only: a per-run `.deb` is the only package that can be minted per run, and which hosts are offered a title doesn't depend on the platform. Self-service and automatic install under a scope aren't exercised.
- *Efficiency / smells:* ~2.5 min, most of it the install and uninstall on the VM.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### LT-08 · Premium • Policies — label targeting › include all, include any + exclude any, and exclude all run on exactly the hosts their labels pick

- **File:** [`playwright/tests/e2e/premium/policies/policy-label-targets.spec.ts`](../../tests/e2e/premium/policies/policy-label-targets.spec.ts)
- **Grep:** `npx playwright test --project=premium policy-label-targets`
- **Project:** premium · **Scope:** the **VMs** fleet · **Hosts:** the macOS VM + two macOS simulations borrowed onto the fleet (`findSimulations(…, 'darwin', 2, 2)`)
- **Mode:** UI+API · **Isolation:** standalone; timeout 600 s; `finally` deletes the policies, returns the simulations, deletes the labels (the VMs sweep deletes `pw-*` policies a dead run left)
- **Data created:** labels `pw-pl-<nonce>-{a,b,c}` — a = VM + s1, b = VM + s2, c = s2 — and three fleet policies (`SELECT 1;`)

| policy | target | runs on |
|---|---|---|
| `…-all` | Include **all** of a, b | VM |
| `…-any` | Include **any** of a, b · Exclude **any** of c | VM, s1 |
| `…-xall` | Exclude **all** of a, b | s1, s2 |

**Flow**

1. ☐ (No user action) Move the simulations, create the labels.
2. ☐ For each policy: **Policies** → **VMs** → **Add policy** → SQL `SELECT 1;` → **Save** → name → Target **Custom** → Include tab (**Any** / **All** + labels) and/or Exclude tab (**Any** / **All** + labels) → **Save**.
   - ✅ *(UI)* *"Policy created."*
3. ☐ (No user action)
   - ✅ *(API)* Each policy is in the host policy list of exactly the hosts in the table (≤ 60 s).
4. ☐ The VM's host page → **Policies** tab.
   - ✅ *(UI)* `…-all` and `…-any` are listed; `…-xall` isn't.

**Assessment**
- *Value:* High. Include all, include any + exclude, and **Exclude all** — a mode only policies have. Every one can fail on the matching bug.
- *Coverage gaps:* the policy's *result* on each host (pass / fail) isn't asserted — targeting is.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### LT-09 · Premium • Reports — label targeting › include all and include any schedule a report on exactly the hosts their labels pick

- **File:** [`playwright/tests/e2e/premium/reports/report-label-targets.spec.ts`](../../tests/e2e/premium/reports/report-label-targets.spec.ts)
- **Grep:** `npx playwright test --project=premium report-label-targets`
- **Project:** premium · **Scope:** the **VMs** fleet · **Hosts:** the macOS VM + two macOS simulations borrowed onto the fleet (`findSimulations(…, 'darwin', 2, 4)`)
- **Mode:** UI+API · **Isolation:** standalone; timeout 600 s; `finally` deletes the reports, returns the simulations, deletes the labels (the VMs sweep deletes `pw-rl-*` reports a dead run left — by that exact prefix, since gitops declares `pw-host-report-results` there)
- **Data created:** labels `pw-rl-<nonce>-{a,b}` — a = VM + s1, b = VM + s2 — and two fleet reports `pw-rl-<nonce>-{all,any}` (`SELECT '<name>' AS report;`)

**Flow**

1. ☐ For each report: **Reports** → **VMs** → **Add report** → SQL → **Save** → name, **Every 5 minutes** → Target **Custom** → scope dropdown **Include all** / **Include any** → tick a, b → **Save**.
   - ✅ *(UI)* *"Report created."*
2. ☐ (No user action)
   - ✅ *(API)* `…-all` is listed for the VM only; `…-any` for all three (`GET /hosts/:id/reports`, ≤ 60 s).
3. ☐ The VM's host page → **Reports** tab → search this run's prefix.
   - ✅ *(UI)* Both reports' cards. On s1's page, only `…-any`.
4. ☐ (No user action) Set `…-all` to run every 60 s (API — the UI's shortest is 5 minutes).
   - ✅ *(API)* The VM stores its row `{report: <name>}` (≤ 5 min); neither simulation stores one.

**Assessment**
- *Value:* High. The scheduling decision per host, in both modes, and the stored result on the one host in both labels.
- *Coverage gaps:* reports have no Exclude scope, so none is tested.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```
