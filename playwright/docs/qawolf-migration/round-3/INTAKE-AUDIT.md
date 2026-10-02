# Round 3 — intake audit

**2026-10-01.** The question was whether the QA Wolf migration is done: does every behaviour a QA Wolf flow
verified have a test here that asserts it? It isn't done. **154 gaps**: 141 in round 1, which its docs
called complete, and 13 in round 2. This file records how the audit was done and what it found, so the
numbers can be checked and the audit re-run.

## Method

Three read-only audits, each over one slice, against `main` as of 2026-10-01:

| slice | rows | evidence used |
|---|---:|---|
| round 1, C1–C5 | 145 | each row of [`../audit/C1`–`C5`](../audit/): open the spec the disposition names, find the assertion the flow's behaviour needs |
| round 1, C6–C10 | 122 | the same, [`../audit/C6`–`C10`](../audit/) |
| round 2 | 127 | each row of [`../round-2/INDEX.md`](../round-2/INDEX.md) against its target spec and the batch file's *What landed* |

Each row came back **covered**, **partial** (some of what the flow asserted is asserted; the row says what's
missing) or **missing** (the named spec doesn't exist, or nothing asserts the behaviour). The bar was strict:
a flow's "Learn more" link or a second sort direction left unasserted counts as partial. So the gap list is
an upper bound, and each batch's review is expected to cut some of it ([README §4](README.md#4-how-a-batch-runs)).

Every *missing* claim was then spot-checked by hand, searching the whole suite rather than the one spec the
audit named (a behaviour asserted somewhere unexpected is covered). These held:

- AI Autofill on a policy; a report's *Discard data*; the org-wide *Store report results* setting
  (`query_reports_disabled`); the activity feed's filters and sort; batch scripts' *Schedule for later* and
  batch cancel; *Fleet web address*; setup experience's *Install fleetd manually*; Android *Edit configuration*:
  no page-object method and no assertion anywhere in `tests/`.
- `team-admin` isn't in either `my-account.spec.ts`'s `MY_ACCOUNT_USERS`, although the static user exists.
- `$FLEET_SECRET_` appears only in the custom-variables spec's variable row. No script references one.

## Round 1: 141 gaps in 228 ported rows

Round 1 audited 267 flows: 22 DUP, 17 CUT, and 228 ported as AUGMENT, NEW or MERGE ([PARITY.md §2](../PARITY.md#2-disposition-rollup)).
**141 of those 228 rows are partial or missing.**

| area | ported (AUG + NEW + MERGE) | with a gap | where most of them come from |
|---|---:|---:|---|
| C1 hosts list | 26 | 11 | depth: webhook fields, enroll-secret copy/delete, *Select all matching* |
| C2 hosts details | 19 | 2 | a maintainer's live report on a host |
| C3 policies | 34 | 27 | **role variants** merged into role specs that were never written; automations depth; policy ↔ hosts links |
| C4 queries / schedule | 30 | 28 | **role variants**, as C3; report settings (discard data, automations, the reset-results warning) |
| C5 reports / dashboard | 19 | 11 | theme, the activity-feed filters, *Store report results* |
| C6 software | 24 | 14 | Advanced options edited and saved; vulnerability filters; Unassigned views |
| C7 settings | 24 | 15 | Fleet web address, fleet lifecycle, Advanced options fields, host-details CTAs by role |
| C8 controls / scripts / secrets | 23 | 14 | batch scripts (schedule, cancel, cancel-on-edit), secrets in scripts |
| C9 MDM / labels / misc | 16 | 11 | MDM and setup settings never saved; Android; labels depth |
| C10 auth / roles / API | 13 | 8 | the under-limit size cases (cut), `team-admin` on My account |
| **total** | **228** | **141** | |

Two patterns account for most of it:

- **MERGE targets that were never written.** Round 1 merged QA Wolf's one-flow-per-role-per-tier into a
  handful of planned specs: `free/policies/role-permissions.spec.ts`, `…/os-specific-policy.spec.ts`,
  `…/links-to-hosts.spec.ts`, `policy-automation-run-script.spec.ts`, the reports role specs. Several of those
  never happened, and the MERGE rows pointing at them were counted as covered. C3 and C4 are almost entirely
  this. Batch E rebuilds it as role matrices.
- **AUGMENTs that kept the flow's first step and dropped the rest.** A form opened and never saved, a toggle
  turned on and never back off, a filter whose results aren't read.

130 of the 141 go to batches A–G; 11 are in [TRIAGE.md](TRIAGE.md) (7 cut, 1 accepted, 3 long-term).

## Round 2: 13 gaps

Round 2 came through well: of 127 flows, **none missing**, ten partial, plus four items round 2 G parked for
V2 on purpose.

- **Seven partial flows, batched here.** Most are hand-offs between round-2 batches that the receiving batch
  never picked up. The vitals-refetch flow (line 15) moved C → D → nowhere. The script-only package's run
  (lines 72, 88) was handed from B to D. The global feed's MDM-command filter (line 69) wasn't built either.
  The others are the maintainer and observer platform cards (lines 49, 50) and Controls' gated surfaces in
  gitops mode (line 57).
- **Three accepted partials** (lines 14, 64, 87): round 2 already decided them and wrote down why. They're in
  [TRIAGE.md](TRIAGE.md) so the record is in one place.
- **Four parked V2 items** (round 2 G): batch H.

## Wrong or stale claims found on the way

Fixed in this PR:

- **[PARITY.md](../PARITY.md) and the [migration README](../README.md)** said round 1 was complete:
  "250 portable, 250 covered", "Nothing is uncovered through oversight". Both now point here.
- **The round-1 source flows** were documented at the repo root. They're in `qa-wolf/flows-Free/` (52) and
  `qa-wolf/flows-Premium/` (217).
- **round 1 C2 #12** (delete a host from its details page) is marked CUT, but `premium/hosts/host-delete.spec.ts`
  now covers it ("delete from host details"). It's covered, so it isn't a gap. The audit table keeps the
  original disposition as the record.

Fixed in [PR #78](https://github.com/AndreyKizimenko/qa-automation-poc/pull/78), which rewrites the same round-2 files:

- `round-2/G-out-of-band.md`: the review table, decision 5 and *Facts* described the failing Deploy as an
  `install-on-host` augment using `installScript: 'exit 1'`; it's its own exclusive spec, failing by
  architecture. The counts now read 3 new + 2 augments, the gitops snippet depends on `premium-setup`, and the
  script-execution note names the exclusive project.
- `round-2/README.md`: batch G's status lines.
- `round-2/INDEX.md`: the OS-update rows (lines 32, 43, 44) now point at `premium/exclusive/os-updates/`, and the
  gitops-mode rows (lines 56–60) at `01-indicator-and-links.spec.ts` / `02-gated-surfaces.spec.ts`.
- The simulation facts in `playwright/CLAUDE.md`, the reviewer skill, the PLAYBOOK and round 2's README and batch
  boxes ("no rows ~20% of runs", "never install anything", "answer policies at random").
