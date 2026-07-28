# Playbook: migrating a foreign test suite into this one

Written after finishing the QA Wolf intake (269 flows → 250 covered). If you are pointed at another vendor's
suite, another repo's tests, or a pile of manual test cases, start here. The specifics below are QA Wolf's, but
the **method** and the **failure modes** transfer.

Read alongside `../../CLAUDE.md` (suite standards) and the two skills in `../../.claude/skills/`. This document
does not restate them — it covers what those don't: how to run an *intake* end to end.

---

## 1. The shape of the work

Four phases, in order. Skipping phase 1 or 2 is how you end up rewriting things twice.

```
AUDIT → PLAN → BUILD (in slices) → RECONCILE
```

| phase | output | rough share of effort |
|---|---|---|
| **Audit** | one disposition row per foreign test | 15% |
| **Plan** | batches ordered by dependency, not by area | 5% |
| **Build** | specs, POMs, helpers — in small committed slices | 70% |
| **Reconcile** | parity accounting, docs, blocked-flow tickets | 10% |

## 2. Audit: classify before you build

Fan the foreign suite out by **product area**, not by file count, and give each slice the same disposition
taxonomy. Exactly one per test:

| disposition | meaning | action |
|---|---|---|
| **DUP** | we already cover it at equal-or-greater depth | drop it; cite the existing spec |
| **AUGMENT** | we cover the flow but miss one assertion | name the spec **and the specific addition** |
| **NEW** | genuine gap | propose a path in our folder convention; note POM gaps |
| **MERGE** | collapses with siblings into one spec | name the group |
| **CUT** | not portable / not worth it | **give the reason** — future readers will challenge it |

Rules that saved us rework:

- **When torn between DUP and AUGMENT, open the existing spec and read the assertions.** Titles lie.
- **Expect MERGE to dominate.** Vendors write one test per role per tier; we collapse those. Ours was 47%
  MERGE. If your MERGE rate is near zero you are about to build a lot of near-duplicate specs.
- **Record the useful intel even from CUT flows** — real `data-testid`s, real toast copy, real nav paths. A CUT
  flow's selectors may still be the fastest grounding for a NEW one.
- **Never trust a foreign test's expected strings.** Ours were stale in ~6 places. The product renames things
  (queries→reports, teams→fleets); the vendor's suite straddles the rename.

Keep the per-flow tables. They are the evidence when someone asks "did we cover X?" — see [`audit/`](audit/).

## 3. Plan: batch by dependency, not by area

Order batches so that **nothing is blocked mid-slice**. Ours, which worked:

1. **Dedupe + augment** — cheapest, no new POMs, captures coverage immediately, and teaches you the suite.
2. **Net-new reusing existing POMs** — no new infrastructure.
3. **The big POM investment area** (hosts, for us) — read-only parts first.
4. **Everything gated on infrastructure** — online hosts, real devices, destructive ops, missing roles.

Then, before building each batch, **verify its prerequisites against the live instance rather than the plan
document.** Our Batch-4 plan asserted a named durable VM that no longer existed; a fixture prototyped against
that premise was dead on arrival. One API call would have caught it.

## 4. Build: the habits that mattered

### Ground every selector in the product source
The vendor's selectors are hints, not truth. Read the React component and confirm the role/label/text before
writing the locator. But — **source reading alone is not enough for stateful UI.** Repeatedly, the component
said one thing and the live DOM said another:

- a field's label is swapped for an error message when invalid, so a `getByLabel` locator stops resolving
  exactly when the test needs it;
- a modal's class is on both the container *and* its inner form div, so the "obvious" locator matches twice;
- a page renders two tables, so an unscoped table locator is a strict-mode violation.

**Probe the live page** (Playwright MCP, or a first throwaway run) for anything conditional.

### Assert what the user sees, then confirm via API
UI assertion for the behaviour; API assertion for the persistence. This catches the class of bug where the
form looks right and the write silently didn't happen — and it caught a real race for us (see §6).

### Ship in slices, verified live
One concern per commit: POM + spec + doc update, `npm run check` clean, live-run green on every tier the spec
targets. Do not batch up five specs and run them at the end; you lose the ability to attribute a failure.

### Write the header comment for the next reader
Every non-obvious decision goes in the spec header: why this host, why this fleet, why this locator, what
would break if you "simplified" it. Most of the hard-won knowledge in this migration lives in spec headers,
not in this folder.

## 5. Isolation under `fullyParallel: true`

This bit us more than anything else. The suite runs every test in parallel, **including copies of the same
file**. Before writing a mutating spec, ask: *what shared resource does this touch, and who else touches it?*

| shared resource | how to stay safe |
|---|---|
| A global config subtree | snapshot + restore **in the test**, not in `beforeEach`/`afterEach`. A read-only sibling test's hook restore will roll the mutating test back mid-flight — that exact bug cost us a debugging cycle. |
| A list other specs read | scope every assertion to *your own* records, e.g. search by a unique marker first. Never assert an absolute count on a shared list. |
| A pool of hosts | claim a distinct slice — different platform, or a documented offset. Two specs taking "the first N" get the same N. |
| A staging fleet | pick a different fleet per spec, and prefer the least-trafficked one. |
| Logins | see §6 — they are a rate-limited global resource. |

Corollary: **a test that cannot run beside a copy of itself should say so in its header.** One global setting
means `--repeat-each` with parallel workers will fail it, and that is not a bug.

## 6. Instance-level gotchas worth knowing up front

Discovered the hard way; all verified against the live instances.

- **`POST /login` is throttled to 10/min, burst 9, in one bucket shared by every user and every worker.** A
  throttled login silently leaves the browser on `/login` with no error, which reads exactly like a wrong
  password. Never log in per test — `withStaticUser` caches each user's `storageState` under `.auth/`.
- **`PATCH /config` merges *within* `webhook_settings`; `PATCH /teams/:id` replaces that subtree wholesale.**
  Opposite behaviours. Sending a partial fleet webhook wipes the fleet's other webhooks.
- **`/config` rejects whole snapshotted subtrees (400)** — they carry read-only members like
  `smtp_settings.configured`. Restore only what you changed.
- **A newly-created user comes back with `force_password_reset: true`**, and `PATCH` will not clear it. It
  takes `perform_required_password_reset` to a throwaway password, then `change_password` back to the shared
  one.
- **A fleet-owned report is invisible to the global report list.** Pass the fleet id.
- **`?platform=linux` returns 0 hosts** even when Linux hosts exist — the `platform` param matches *label
  groups* and `linux` isn't one. Also, `platform=darwin` returns non-darwin hosts, so always re-filter on the
  host's own `platform` field.
- **Closing a modal does not mean its PATCH landed.** Reopening immediately can load pre-save state, and the
  next save writes it back, silently undoing the edit. Confirm the write before reopening.
- **`cleanup.steps.ts` wipes global/Unassigned/Workstations content but never hosts, and never other fleets.**
  That asymmetry is load-bearing: it's the only place a durable precondition can live.

## 7. Test hosts: fidelity vs volume

If the instance has both real devices and simulated ones, they are good at opposite things. Pick per spec —
`findOnlineHost(request, platform, { kind })`.

| | real VM | osquery-perf simulation |
|---|---|---|
| count | ~3 per tier | ~300 per tier |
| live query | **runs the actual SQL** | ignores it; returns one canned row, and **no rows ~20% of runs** |
| labels | correct | matches contradictory labels (one darwin sim is in "Fedora Linux", "MS Windows" *and* "All Linux") |
| MDM | enrolled (macOS/Windows) | never |
| local users / agent versions | real | ~50–75% report users; a mix of fleetd and vanilla-osquery |
| disposable? | **no — never destroy one** | yes, and the pool is repopulated |

So: **real for behaviour, simulated for volume.** Anything asserting query results, label membership or MDM
state needs a real device; bulk select/transfer/delete wants the sim pool.

Deleting a simulation is **permanent** — osquery-perf enrolls once at startup with no node-invalid recovery,
so Fleet's delete-modal promise that hosts "will re-appear" is true of real fleetd and false here. Budget
deletions per run and say so in the spec.

## 8. When a flow won't go green

Three distinct answers; do not conflate them.

| finding | action |
|---|---|
| **Test bug** | fix the test. Most "product bugs" are this. |
| **Infrastructure gap** | mark the flow blocked in the tracker with what would unblock it, and move on. Do not fake it. |
| **Real product bug** | file a Fleet issue, add a narrow skip citing it, and log it in [`../blocked-by-product-bugs.md`](../blocked-by-product-bugs.md). See `feedback_blocked_flows_workflow` — "make it green" is the wrong instinct. |

And a fourth, which is not a failure: **the flow is asking for something we deliberately won't do.** Lock and
Wipe are covered-by-decision-not-to-cover. Write down the decision and the cheaper alternative so it doesn't
get silently re-litigated.

## 9. Reconcile: don't skip the accounting

At the end, produce the parity document ([`PARITY.md`](PARITY.md)). Someone will ask "are we off the vendor's
suite yet?" and the answer needs to be a table, not a vibe.

Two traps we hit:

- **Trackers drift from reality.** Our Batch-1 checkboxes still read `[ ]` for a dozen shipped items. Verify
  claims against the suite (`grep` the spec source) rather than trusting a checkbox.
- **Standing preconditions become invisible.** Anything the suite assumes but doesn't create — a provisioned
  user, a seeded report — must be written down where whoever re-provisions the instance will find it, and the
  spec must fail loud with recreation instructions. See the table in [`README.md`](README.md).
