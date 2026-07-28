# QA Wolf → Playwright: parity accounting

What we were handed, what happened to each flow, and what the suite has to show for it. This is the
"did we actually replace QA Wolf" document.

**Bottom line: 267 flows audited, 250 portable, 250 covered. The only uncovered behaviours are Lock and
Wipe, parked by decision — not by oversight.**

---

## 1. What we were given

| | count |
|---|---:|
| `flows-Free/` | 52 |
| `flows-Premium/` | 217 |
| **handed over** | **269** |
| audited across C1–C10 | 267 |

The two-flow gap is bookkeeping, not lost coverage: a handful of files were mislabeled free-vs-premium at
source and a couple were counted under a neighbouring area during the split. No flow was skipped without a
disposition row.

These were never runnable code. They import `@qawolf/flows/web` and a `node-20-helpers-premium.js` that
doesn't exist in this repo, hardcode `fleet+GlobalAdminN@qawolf.email` accounts, and create/delete teams
inline. They were **coverage transcripts** — a specification of intent. We harvested *what* they tested and
re-authored *how*.

## 2. Disposition rollup

| disposition | meaning | count | share |
|---|---|---:|---:|
| **DUP** | suite already covered it at equal-or-greater depth | 22 | 8% |
| **AUGMENT** | grafted an extra assertion onto an existing spec | 33 | 12% |
| **NEW** | became its own spec | 69 | 26% |
| **MERGE** | folded into one of those NEW specs | 126 | 47% |
| **CUT** | not portable / not worth porting | 17 | 6% |
| | **total** | **267** | |

**Portable = 250 (94%).** All 250 are now covered.

The 126 MERGEs are why 250 flows became ~112 spec files rather than 250. QA Wolf wrote one flow per role per
tier; we collapse those. C3 (policies) is the extreme case — 31 of its 38 flows merged into 2 specs, because
QA Wolf had a separate flow for each of admin/maintainer/observer/observer-plus × free/premium × page.

## 3. Per-area accounting

| area | flows | DUP | AUG | NEW | MERGE | CUT | outcome |
|---|---:|---:|---:|---:|---:|---:|---|
| C1 hosts list | 27 | 0 | 0 | 13 | 13 | 1 | complete |
| C2 hosts details | 25 | 0 | 0 | 8 | 11 | 6 | **complete except Lock/Wipe** |
| C3 policies | 38 | 2 | 1 | 2 | 31 | 2 | complete |
| C4 queries / schedule | 35 | 3 | 2 | 8 | 20 | 2 | complete |
| C5 reports / dashboard | 20 | 0 | 3 | 7 | 9 | 1 | complete |
| C6 software | 28 | 2 | 9 | 3 | 12 | 2 | complete |
| C7 settings | 28 | 3 | 7 | 13 | 4 | 1 | complete |
| C8 controls / scripts / secrets | 24 | 1 | 3 | 6 | 14 | 0 | complete |
| C9 MDM / labels / misc | 17 | 0 | 4 | 9 | 3 | 1 | complete |
| C10 auth / roles / API | 25 | 11 | 4 | 0 | 9 | 1 | complete |
| **total** | **267** | **22** | **33** | **69** | **126** | **17** | |

Per-flow detail — every flow, its disposition, and its target — is in [`audit/`](audit/). Those tables are the
primary evidence; this page is the rollup.

## 4. What the suite looks like now

| | count |
|---|---:|
| spec files | 112 |
| premium tests | 339 |
| free tests | 172 |
| pure-API specs | 16 |

Densest areas after the migration: `shared/hosts` (7 specs), `premium/software` (7), `settings/users`
(6 premium + 6 free + 3 shared), `shared/auth` (5), `premium/hosts` (5).

The hosts area is the clearest before/after: it had **zero** e2e specs when the audit started (only a
loadtest spec) and now has 13 across `shared/`, `premium/` and `free/`, plus `HostsListPage`/`HostDetailsPage`
grown from thin locator bags into full page objects.

## 5. The 17 CUTs, and why each is legitimate

CUT never meant "too hard". Each falls into one of five buckets:

| bucket | examples | why |
|---|---|---|
| **Forbidden by our model** | `create-a-team-from-transfer-hosts-modal` (C1 #13) | the entire flow is create-then-delete a team in the test body; teams are gitops-provisioned here. Salvaged the one useful assertion (the "Add a fleet" link) into `bulk-transfer`. |
| **Pure role duplicates** | the 4 delete-host-from-details flows (C2 #2/#4/#12/#14) | 2 roles × 2 tiers of the same action; collapsed into one `host-delete` spec with a role dimension. |
| **Tests QA Wolf's own infra** | flows asserting their helper's login worked | nothing about Fleet. |
| **Obsolete / removed feature** | a few C4 and C7 flows | the UI they drive no longer exists. |
| **Genuinely destructive with no safe target** | **Lock (C2 #18), Wipe (C2 #25)** | see below — these are the only *behaviour* gaps. |

## 6. The one real gap: Lock and Wipe

Everything else portable is covered. These two are outstanding **by decision**:

- They are one-shot destructive MDM actions against the real VMs. There are three VMs per tier and **no
  re-provisioning automation** — a wipe ends every other real-device spec until someone rebuilds by hand.
- Unlocking needs the recovery PIN Fleet surfaces after a lock, so even the "reversible" one is a manual
  recovery chore rather than an API teardown.
- They cannot be pointed at the simulated fleet as a workaround: sims aren't MDM-enrolled, so Fleet doesn't
  even offer the actions (verified in the live DOM — a sim's Actions menu shows only Transfer / Live report /
  Run script / Delete).

**If the gap ever needs closing**, the cheap 80% is to assert the *permission surface* rather than the effect
— that Lock/Wipe appear in the Actions menu for an admin on an MDM-enrolled host and are absent for an
observer — plus API-level role checks in `tests/api/role-access/`. That covers the RBAC regression risk
without ever firing the command. The expensive 100% needs a dedicated sacrificial MDM-enrolled VM with a
scripted re-enroll, kept out of `liveMacosHost`'s resolution.

## 7. Coverage we added that QA Wolf never had

Parity undersells the result. Re-authoring surfaced product and suite issues the original flows couldn't
express, and several specs now assert *more* than their source did:

- **`host-live-query` asserts the real result row.** QA Wolf asserted the value `bar`; against simulations
  that's impossible (they ignore the SQL), so this only works because we ran it on a real VM.
- **`advanced-options` inverts its flow.** QA Wolf edited a field; we assert that the *bundled save doesn't
  disturb its neighbours*, which is the actual regression risk.
- **Copy drift fixed in ~6 places** where QA Wolf's expected strings no longer match Fleet: "Add a fleet" not
  "Create a fleet", "create a report" not "create your own report", "Automations" not "Manage automations",
  "Enroll secrets" not "Manage enroll secrets".
- **Product bugs filed** where a flow proved a real defect rather than a test gap — see
  [`../blocked-by-product-bugs.md`](../blocked-by-product-bugs.md).
- **Pre-existing suite bugs found and fixed** while porting: the `/login` rate-limit starvation in
  `withStaticUser`, `DataSet.value()` substring matching, and a stale readiness anchor in
  `OrganizationAdvancedPage`. See [`DELIVERY-LOG.md`](DELIVERY-LOG.md).
