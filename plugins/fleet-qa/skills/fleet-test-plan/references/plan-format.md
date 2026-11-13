# Writing the plan: sections, rows, size

For fleet-test-plan step 3. Read it before writing `plan.md`, on every pass.

Write `<ws>/plan.md`: the Test plan section's content, without the `### Test plan` heading. Start it
with the template's reminder line as-is:

```markdown
> Make sure to go through [the list](https://github.com/fleetdm/fleet/blob/main/docs/Contributing/guides/ui/design-qa-considerations.md) and consider all events that might be related to this story, so we catch edge cases earlier.
```

## Sections: the story template's, nothing else

Engineers, PMs and QA all know these sections, and a plan with its own sections ("Validation",
"Clearing", "Docs") ends up checking the same thing in two places. Use only the sections that apply,
in this order:

| Section | What belongs here |
|---|---|
| Setup | Not rows: what's needed, named once (see below). It's the one block the template doesn't have. |
| Core flow | The story's happy path end to end, on the surfaces the story names, including what the device shows. Each step once. |
| Edge cases | Everything unusual: input the feature rejects or accepts at the boundary (the full value matrix), missing config, deleted or changed related objects, lifecycle (transfer, re-enroll, delete), concurrency, external failures, open bugs the path will hit. |
| UI | Only what the UI adds beyond the API: states (loading, empty, error), where an error shows, long names and worst-case values (the catalog in fleet-explore's `tours.md` § 1; the SKILL.md gives its path), widths, guide-vs-page checks. |
| API | The endpoints' contract: each new or changed endpoint and parameter, prefixes, malformed parameters (unknown ids, wrong types), response vs the REST docs, the API-only endpoint catalog. |
| GitOps (generate + run) | `fleetctl gitops` apply, dry-run and clearing, and the `generate-gitops` round trip. |
| Permissions | The role matrix, or the one row confirming an unchanged gate. |
| Premium gating | Free, backend and frontend. |
| Upgrade / data migration | Behavior on a server upgraded with existing data. |
| Feature in isolation | One platform's MDM only, other MDM off, GitOps mode, including destructive switches like turning Android MDM off. |

Global-switch sections (Premium gating, Upgrade, Feature in isolation) come last because they disrupt
the instance.

## Every check lives in exactly one row

Before writing, list each check as behavior × entry point × input and give it one home using the
table. The overlaps that crept into earlier plans:

- **The full input matrix on every entry point.** Run the full matrix of values on one entry point
  (Edge cases). Add one more row that sends one representative bad input through every other entry
  point (API, add, batch, GitOps, the UI). Never repeat the cross product, and never repeat an
  input/entry-point pair.
- **The same outcome checked in Core flow, API and Edge cases.** "Hosts get the value", "the value
  doesn't leak" and "activities logged" each belong in one row that lists the surfaces it checks.
- **Product's rows plus a parallel copy.** When Product's row covers a check, make their row concrete
  (inputs, surface, observable result) instead of adding your own beside it.
- **A UI row repeating the API row.** The UI row checks only what the UI adds.

## Setup

**Setup** names everything once, so rows can refer to it: tier, which MDM is on, the fleets ("Fleet
A", "Fleet B"), the test objects (apps, profiles, labels), which hosts can be simulated and which must
be real devices (OS version, BYOD vs company-owned), and the users and roles. Describe what's needed,
not a particular tool or instance. When some rows need something the RC can't produce (simulated
Android hosts need a server whose Google side you control, for example), say so in general terms and
name the rows that need it. If device rows involve resets, give the order that shares them.

## Rows

`- [ ] <Surface>: <action with exact inputs> → <observable result>`.

- **Surface** is one of `UI`, `API`, `fleetctl`, `GitOps`, `Device`. Every row has one, so the split
  between Claude and the person is obvious at a glance.
- **One behavior per row**, short enough to read at a glance (a line or two). Several inputs to the
  same behavior can share a row as a list; separate behaviors get separate rows. Reasons, code
  references and how-to-check details go in `notes.md`, not in the row.
- **Inputs are concrete:** the endpoint, params and body; the YAML keys; the role names; the fleet.
- **Results are observable:** status code and message when the spec gives them, the UI text, the
  device setting path, the activity type, what `GET` returns afterward. Never "works" or "succeeds"
  on its own.
- **Matrices are one row:** "API: global maintainer, observer, observer+, technician; Fleet B admin →
  403" rather than five rows that each say 403, and rather than one "permissions work" row that
  hides which roles were checked.
- **One matrix plus one UI glance.** Every rejected-input case runs once, on one entry point. The
  UI gets one row showing where and how the error appears.
- **A row that depends on an open question** says so inline: "→ allowed through the API. Confirm
  with PM that this is intended."
- **A row that sets a deliberately bad or conflicting value** restores it in the same row ("…, then
  remove it"), or uses an object no later row touches. Otherwise every later step that pushes the
  same host's or fleet's settings fails for the wrong reason.
- **A row that will hit an open bug** names it ("→ cleared. Known: #55562.") so nobody files it
  again and the sign-off can link it.
- **Fleet terms:** "fleets", not teams, and "reports", not queries. API params keep their real names
  (`fleet_id`, `team_id`), whichever the endpoint uses.

## Size check before you finish

Coverage follows the change. Count what the story changed: each new or changed behavior, times each
entry point that reaches it, plus the lenses that apply. A one-field change usually lands around
12–25 rows. A feature spanning UI, API, GitOps and devices usually lands around 30–45. Far fewer
usually means dropped entry points or roles. Far more usually means padding:

- rows for behavior the story didn't change. When permissions didn't change, one row confirming the
  existing gate still holds replaces a full role matrix.
- re-tests of code a sibling story owns. Point to that story's plan in a row or a Setup line
  ("Shared validation and entry points: covered in #51454's plan"), and test only what's specific to
  this story: its own input or value through one entry point, plus whatever only it changes. Being
  cheap to run doesn't make a shared path this story's to cover.
- rows for features that might ship later, or for configurations Fleet doesn't support. Mention
  them in `notes.md` instead.

On the person's side, aim for one sitting of about an hour or two, with each global switch happening
once. If it runs longer, say in the summary which person-run rows you'd drop first and why, and leave
the choice to the QA engineer.

## An illustrative excerpt

A made-up story: require a reason when locking a host.

```markdown
#### Setup
- Fleet Premium RC, Apple and Windows MDM on. Fleets A and B.
- Simulated macOS, Windows and iPhone hosts in Fleet A. One real Mac in Fleet A for the device rows.
- API-only users for each global role and for each role on Fleet A.

#### Core flow
- [ ] UI: Host details > Actions > Lock on the macOS host → the modal shows a required "Reason" field; Lock stays disabled until it has text.
- [ ] UI: enter "Lost at airport" → Lock → the host shows "Lock pending"; the `locked_host` activity includes the reason.
- [ ] Device: the real Mac locks and its lock screen shows "Lost at airport".

#### Edge cases
- [ ] API: reason missing, `""`, spaces only, 1,001 characters → rejected with a message naming `reason`; the host isn't locked.
- [ ] fleetctl: `fleetctl mdm lock` without `--reason`, and the UI with an empty field → the same rejection; nothing sent.

#### API
- [ ] API: `POST /api/v1/fleet/hosts/:id/lock` with `{"reason":"Lost"}` on the macOS, Windows and iPhone hosts, on `/api/v1` and `/api/latest` → 204, `GET /hosts/:id` shows the pending lock and the reason.
- [ ] fleetctl: `fleetctl mdm lock --host <host> --reason "Lost"` → locked with the reason.

#### Permissions
- [ ] API: global and Fleet A admin, maintainer, technician → allowed. Global and Fleet A observer, observer+; Fleet B admin → 403.
- [ ] API: API-only user with only "Lock host" granted → allowed; without it → 403.
```
