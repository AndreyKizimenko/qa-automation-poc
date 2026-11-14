# Writing the plan: sections, rows, size

For fleet-test-plan step 3. Read it before writing `plan.md`, on every pass.

Write `<ws>/plan.md`: the Test plan section's content, without the `### Test plan` heading. Start it
with the template's reminder line as-is:

```markdown
> Make sure to go through [the list](https://github.com/fleetdm/fleet/blob/main/docs/Contributing/guides/ui/design-qa-considerations.md) and consider all events that might be related to this story, so we catch edge cases earlier.
```

## Sections: the story template's, in its order

The plan uses the sections of the live story template (`.github/ISSUE_TEMPLATE/story.md`, read in
step 1), in the template's order, plus a Setup block on top. Engineers, PMs and QA all know these
sections and look for a check where the template says it lives: someone changing an endpoint reads
API, someone running GitOps reads GitOps. A plan with its own sections ("Validation", "Clearing",
"Docs"), or with API checks filed somewhere else, makes them hunt, and the same check ends up written
twice.

| Section | What goes here |
|---|---|
| Setup | Not rows: what's needed, named once (see below). It's the one block the template doesn't have. |
| Core flow | The story's happy path end to end: the steps a demo of the feature would show, on the surfaces the story names, including what the device shows. Product usually drafts it. Their rows stay here whatever they cover, and you add a row only when a step of their flow has no observable result yet. |
| Edge cases | Story-specific cases whose surface has no section of its own: what a device shows beyond the happy path, and `fleetctl` commands other than GitOps. Not `API:`, `GitOps:` or `UI:` rows. |
| UI | Every `UI:` row outside Core flow. Only what the UI adds beyond the API: states (loading, empty, error), where an error shows, long names and worst-case values (the catalog in fleet-explore's `tours.md` § 1; the SKILL.md gives its path), widths, GitOps mode controls, guide-vs-page checks. |
| API | Every `API:` row that isn't about one of the topics below. The endpoints' contract (each new or changed endpoint and parameter, prefixes, malformed parameters, response vs the REST docs, the API-only endpoint catalog), the full matrix of rejected and boundary inputs, and behavior that's checked through the API: what was stored, what a cron or worker did, what the database or the server logs show, deleted or changed related objects, concurrency, third-party failures. |
| GitOps (generate + run) | Every `GitOps:` row: `fleetctl gitops` apply, dry-run and clearing, a new fleet in the same run, and the `generate-gitops` round trip. |
| Permissions | The role matrix, or the one row confirming an unchanged gate. |
| Premium gating | The tier: blocked on Free in the backend and the frontend, or working on Free when the story covers both tiers. |
| Upgrade / data migration | Behavior on a server upgraded with existing data. |
| Feature in isolation | One platform's MDM only, other MDM off, including destructive switches like turning Android MDM off. |
| Identity provider (IdP) | The end user removed from the IdP, group changes, casing, renewals. |
| Host re-enrollment | A host that's wiped or removed and enrolls again: what's kept, what's reset. |

The live template is the authority for the list. If it has a section this table doesn't, use it the
same way. Write each heading word for word as the template has it (`#### Premium gating (if this is
a premium-only feature)`); the table uses short names.

The plan stops before `#### Supplemental testing`. That heading is QA's mid-cycle section, the splice
script leaves it and everything after it alone, and it isn't one of the plan's sections. The
template's one-line hint comments (`<!-- Add detailed manual testing steps… -->`, `<!-- QA TO DO… -->`)
can stay where they are; they don't render.

### Which section a row goes in

Decide in this order:

1. **Core flow** if it's a step of the happy path.
2. **A topic section** (Permissions, Premium gating, Upgrade / data migration, Feature in isolation,
   IdP, Host re-enrollment) if that topic is what the row is about, whatever its surface. A role
   matrix is run through the API and still lives in Permissions. A phone enrolled on Fleet Free lives
   in Premium gating. When two topics fit, go by the row's main action (turning Android MDM off and
   enrolling again is Feature in isolation, because the switch is the point), and if that doesn't
   settle it, take the one that comes first in the template.
3. **The section its surface names:** `API:` under API, `GitOps:` under GitOps, `UI:` under UI.
4. **Edge cases** for what's left: `Device:` and `fleetctl:` rows that are neither happy path nor a
   topic.

This is mechanical on purpose. "Is this an edge case or an API check?" has no stable answer (the
template itself lists invalid input and deleted objects under Edge cases, and error handling under
API), so the surface decides. Readers still look under Edge cases first, so whenever edge cases live
in other sections, which is nearly always, start Edge cases with one plain line that says where:
"Edge cases that run through the API, GitOps or the UI are in those sections below." Keep the
heading and that line even when no rows are left under it.

### Un-comment what you use

The template ships UI through Host re-enrollment inside one HTML comment ("Suggested checks below —
un-comment any section that applies…"). GitHub doesn't render what's inside a comment, so a section
filled in there is invisible on the issue. In `plan.md`, every section that has rows sits outside
the comment, in the template's order, with the story's rows in place of the template's generic
prompts ("Verify that all UI changes…"). The sections the story doesn't use stay inside the comment
with the template's own rows, as the last thing in `plan.md`, so the next person can still pull one
out.

### Long sections

When a section passes about eight rows (API often does), group the rows under one-line plain-text
labels such as "Validation", "What gets stored" or "When Google fails". They're labels, not headings:
no `####`, so the section list stays the template's. A label that would cover a single row isn't
worth having, and a section that's short again doesn't need its old labels. Rows that move into a
section go after the rows already there, in the order they had.

## Every check lives in exactly one row

Before writing, list each check as behavior × entry point × input and give it one home using the
rules above. The overlaps that crept into earlier plans:

- **The full input matrix on every entry point.** Run the full matrix of values once, through the
  API (API section). Every other entry point gets one row that sends one representative bad input,
  filed in that entry point's own section: a `GitOps:` row under GitOps, a `UI:` row under UI showing
  where the error appears, a `fleetctl:` row under Edge cases. Never repeat the cross product, and
  never repeat an input/entry-point pair.
- **The same outcome checked in several sections.** "Hosts get the value", "the value doesn't leak"
  and "activities logged" each get one row, on the surface where the outcome is cheapest to observe
  (usually the API). Don't restate it under UI or Edge cases.
- **A topic row plus a surface row.** The role matrix lives in Permissions and the Free check in
  Premium gating. Don't add a second copy under API because that's how they're run.
- **Product's rows plus a parallel copy.** When Product's row covers a check, make their row concrete
  (inputs, surface, observable result) instead of adding your own beside it.
- **A UI row repeating the API row.** The UI row checks only what the UI adds.

## Setup

**Setup** names everything once, so rows can refer to it: tier, which MDM is on, the fleets ("Fleet
A", "Fleet B"), the test objects (apps, profiles, labels), which hosts can be simulated and which must
be real devices (OS version, BYOD vs company-owned), and the users and roles. Describe what's needed,
not a particular tool or instance. When some rows need something the RC can't produce (simulated
Android hosts need a server whose Google side you control, for example), say so in general terms and
name the rows that need it.

Sections follow the template's order, not the order to run things in, so Setup also carries the run
order when it matters: which device rows share one enrollment or reset, and which global switches
(Free, an MDM turned off) happen once and last.

## Rows

`- [ ] <Surface>: <action with exact inputs> → <observable result>`.

- **Surface** is one of `UI`, `API`, `fleetctl`, `GitOps`, `Device`. Every row you write has exactly
  one (Product's Core flow rows often have none, and adding one is optional). It shows at a glance
  who can run the row, and it picks the row's section.
  - Use the most expensive surface the row needs, in the order `Device`, `UI`, `GitOps` or
    `fleetctl`, `API`. A row that changes a setting through the API and then looks at a phone is a
    `Device:` row. So is a row that starts in a third-party console (the zero-touch portal, ABM) and
    ends on a device.
  - `GitOps:` means a `fleetctl gitops` or `generate-gitops` run. Calling the batch endpoint that
    GitOps uses directly is an `API:` row.
  - A check that runs through two entry points with different sections is two rows, one per section,
    whether the second entry point would have gone in the prefix (`API, GitOps:`) or in the text
    ("…and the same through GitOps"). The exception is one scenario inside a topic section that walks
    through two entry points (an upgrade row that checks the API, then re-applies through GitOps):
    it stays one row under its topic.
- **Each row reads on its own.** Its expected result doesn't lean on another row ("the same
  rejection", "rejected like the others"), because that row may sit in a different section. Restate
  the result, briefly.
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
- **A row that depends on an open question** says so inline: "→ allowed through the API. Confirm
  with PM that this is intended."
- **A row that sets a deliberately bad or conflicting value** restores it in the same row ("…, then
  remove it"), or uses an object no later row touches. Otherwise every later step that pushes the
  same host's or fleet's settings fails for the wrong reason.
- **A row that will hit an open bug** names it ("→ cleared. Known: #55562.") so nobody files it
  again and the sign-off can link it.
- **Destructive rows go last in their section** and say what they cost.
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

A made-up story: require a reason when locking a host. It has no YAML, so GitOps stays in the
comment with the other sections it doesn't use.

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
Edge cases that run through the API or the UI are in those sections below.
- [ ] Device: lock the real Mac while it's offline, then reconnect it → it locks and shows the reason.
- [ ] fleetctl: `fleetctl mdm lock --host <host> --reason "Lost"` → locked with the reason; without `--reason` → rejected with a message naming the flag; nothing sent.

#### UI
- [ ] UI: a 1,000-character reason, and one that starts with an emoji → the modal, Host details and the activity feed show it without overflow at 768px.
- [ ] UI: clear the field after typing → Lock is disabled again; the hint under the field says a reason is required.

#### API
- [ ] API: `POST /api/v1/fleet/hosts/:id/lock` with `{"reason":"Lost"}` on the macOS, Windows and iPhone hosts, on `/api/v1` and `/api/latest` → 204, `GET /hosts/:id` shows the pending lock and the reason.
- [ ] API: reason missing, `""`, spaces only, 1,001 characters → rejected with a message naming `reason`; the host isn't locked.
- [ ] API: lock a host whose fleet was deleted a moment ago → the reason is saved and the activity shows it under Unassigned.

#### Permissions
- [ ] API: global and Fleet A admin, maintainer, technician → allowed. Global and Fleet A observer, observer+; Fleet B admin → 403.
- [ ] API: API-only user with only "Lock host" granted → allowed; without it → 403.

<!-- 💡 Suggested checks below — un-comment any section that applies to this story, then fill it in.

#### GitOps (generate + run)
- [ ] Configure the feature through the UI and run `fleetctl generate-gitops`
(…the rest of the sections this story doesn't use, with the template's own rows…)

-->
```
