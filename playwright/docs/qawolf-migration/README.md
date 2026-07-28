# QA Wolf → Playwright migration

**Status: complete.** 269 flows handed over, 267 audited, 250 portable, **250 covered**. Lock and Wipe are the
only commands never fired — their **availability is asserted across macOS, Windows and Ubuntu on both tiers**,
so the gating is covered even though the destructive act isn't. Shipped in PR #35 (Batches 1–3) and PR #36
(Batch 4).

QA Wolf handed us a suite of `*.flow.js` files that were never runnable here — they import helpers that don't
exist in this repo, hardcode `@qawolf.email` accounts, and create teams inline. We treated them as **coverage
transcripts**: harvest *what* each tested, re-author *how* against this suite's standards.

## Where to look

| if you want to… | read |
|---|---|
| run a migration like this yourself | **[PLAYBOOK.md](PLAYBOOK.md)** |
| know whether we replaced QA Wolf, with numbers | **[PARITY.md](PARITY.md)** |
| know what shipped and why, batch by batch | **[DELIVERY-LOG.md](DELIVERY-LOG.md)** |
| check one specific flow's fate | **[audit/](audit/)** — per-flow disposition tables, C1–C10 |
| understand a specific spec's decisions | **the spec's own header comment** — that's where grounding lives |

`audit/` is the primary evidence: every flow, its disposition, its target path, and the notes behind the call.
Start there for "did we cover X?".

## Standing instance preconditions

The suite assumes these exist and does **not** create them. Each fails loud with recreation instructions, but
they're invisible to anyone re-provisioning an instance, so they're recorded here.

| what | where | needed by | if missing |
|---|---|---|---|
| `team-admin@fleetdm.com` — admin on **Workstations + VMs**, shared `FLEET_STATIC_USER_PASSWORD`, `force_password_reset: false` | premium | every team-admin case (C1 #16/#26/#27, labels role-access) | recreate via `POST /users/admin`, then clear the reset flag — `PATCH` won't do it, see [PLAYBOOK §6](PLAYBOOK.md#6-instance-level-gotchas-worth-knowing-up-front) |
| Report **`pw-host-report-results`** on the **VMs** fleet — interval 300, `SELECT 'bar' AS foo` | premium | `premium/hosts/host-report-details.spec.ts` | recreate per that spec's header, then allow ~3.5 min for one scheduled run |
| Real VMs online (macOS/Windows MDM-enrolled) + the osquery-perf load fleet | both | every host-dependent spec | see `tools/perf-hosts/` |

The report has to live on a **fleet**: `cleanup.steps.ts` wipes global reports at the start of every run, and
never touches other fleets. Verified to survive overnight plus repeated cleanup cycles.

## Two host populations

Both share each instance and are good at opposite jobs — pick per spec via
`findOnlineHost(request, platform, { kind })`:

- **`'real'`** — genuine device behaviour. Runs the query's actual SQL, reports real users and agent versions,
  supports MDM. Only ~3 per tier, so **never destroy one**.
- **`'simulated'`** — volume for bulk work. Ignores live-query SQL, returns no rows ~20% of runs, and matches
  contradictory labels. Disposable, but a deleted simulation **never comes back on its own**.

Split via Fleet's `mdm_enrollment_status` filter — the only signal that works on free too, since free has no
fleets to scope by. Caveat: the real **Linux** VMs aren't MDM-enrolled, so they fall inside `'simulated'` —
destructive specs must target `darwin` or `windows`.

Full comparison: [PLAYBOOK §7](PLAYBOOK.md#7-test-hosts-fidelity-vs-volume).

## Source flows

`flows-Free/` (52) and `flows-Premium/` (217) at the repo root, untracked and gitignored. Kept for reference
only — they are not runnable and are not part of the suite.
