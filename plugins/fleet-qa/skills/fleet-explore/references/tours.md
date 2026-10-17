# Tours and the worst-case catalog

A tour is one question asked of the feature from one angle, with the probes that usually answer
it. Pick the tours the charter calls for; run each far enough to say "covered" or "partial" in the
debrief. The probes name Fleet objects and the traps earlier runs met, so most of them can be set
up with `fleetapi.sh`, osquery-perf hosts and the role users from the local file. Where a probe
needs a global switch or a real device, it goes in the ask, not in the session.

Contents: 1 Worst-case data (with the catalog) · 2 Scope and gating · 3 Second door · 4 Lifecycle ·
5 Interruption · 6 Tables and forms · 7 Oracles · 8 Width and keyboard · 9 Concurrency and timing ·
Not findings.

## 1. Worst-case data

Demo data is chosen, usually without anyone noticing, to make the design look good: names that fit
on one line, counts that never need a separator, every optional field filled. The job is to undo
that choice, one field at a time, with data a real customer would produce.

Three rules, from break-ui:

- **Plausible or schema-backed, never random.** Each value is a real naming pattern, a real email
  shape, or the actual limit from the validator, the column or the API docs. Five thousand `a`s
  prove nothing; the designer says "that never happens" and stops listening. If you find no limit,
  that's the finding: log RISK "unbounded", and test something long but believable.
- **Change the data, not the page.** The value enters through Fleet's own boundaries: the API, the
  UI form, a GitOps file, a package's metadata, what osquery-perf reports. Never edit the DOM to
  produce a break; that tests your edit.
- **One dataset, many failures.** Spread the catalog across the rows the page shows (row 1 the long
  name, row 2 the one-letter name, row 3 the CJK one), as real data does. The first rows matter
  most; they're what's on screen.

Then look at each width (section 8) for the failure signatures: text overflowing past its box or
the page edge; a row action, badge or icon pushed off or squashed; a badge wrapping onto two
lines; a truncated value with no tooltip and nowhere to read it in full; "1 hosts"; a raw number
(`1284`, `NaN`, `undefined`, `0.30000000000000004`); a relative time that reads wrong ("0 seconds
ago", "in 3 days" for the past); a placeholder dash or empty line where an optional field was;
markup rendered as markup (`<b>`, `&amp;`, `**bold**`); a heading breaking mid-word; a column
misaligned by a longer sibling; a list that stutters at a few hundred rows.

Every long string forces a decision (wrap, truncate at the end, truncate in the middle for things
that differ at the end such as file names and emails, clamp to two lines, never truncate numbers or
dates). When Fleet made the wrong one for the field, that's a BUG; when there's no obviously right
one, it's a QUESTION with your recommendation.

### The catalog

Fleet fields these apply to: fleet, label, policy, report, script, configuration-profile and
software-title names; policy descriptions and resolutions; user names and emails; IdP usernames;
host display names (set by what the host reports; osquery-perf gives each agent a random hostname
from its template, so a worst-case one means a copied template with a chosen `computer_name`, a real
host, or the ask); enroll-secret names; CA names; URLs in settings; uploaded file names.

**Names people type**

| Value | What it tends to break |
|---|---|
| `Workstations – Engineering (EMEA), laptops & desktops, managed` | Long with punctuation: pickers, the fleet dropdown, breadcrumbs, activity text, the title at 768 |
| `Benachrichtigungseinstellungen-Compliance-Richtlinie` | One unbreakable word: overflows instead of wrapping |
| `Jo` / `A` | One or two characters: columns that look empty, initials, a tiny click target when the name is the link |
| `Aleksandra Wiśniewska-Kowalczyk` | Diacritics and a hyphen that is a line-break point: sort order, search, wrapping at the hyphen |
| `Đặng Thị Ngọc Hân` | Stacked diacritics: clipped by a tight line height with overflow hidden |
| `王秀英 的合规策略` | CJK: breaks anywhere, "first and last word" logic finds one word |
| `سياسة الامتثال للأجهزة` | RTL: punctuation and icons on the wrong side without `dir="auto"` |
| `🦊 Fox fleet` / `👩🏽‍💻 Priya` | Emoji first, a ZWJ sequence: `.charAt(0)` returns half a surrogate pair, `.length` is 7+, slicing splits it |
| `O'Brien & Sons "West" <Lab>` | Apostrophe, ampersand, quotes, angle brackets: escaping in the table, the tooltip, the activity feed, `generate-gitops` output, webhook and email payloads |
| `  Padded   name ` | Leading, trailing and double spaces: does Fleet trim, does search match, do two names differing only by a space coexist? |
| `Line one` + newline + `Line two` (via the API) | A newline in a single-line field: doubles the row height or is silently dropped |
| `Prod` next to `Production` | A name that is a prefix of another: search, exact matching, "select all matching" |
| The same name in two fleets | Pickers and lists that key by name instead of id |
| `**bold**`, `<script>alert(1)</script>`, `&amp;` in a description or resolution | Must render as literal text, in the UI and in anything that forwards it (webhooks, tickets) |
| A 2,000-character resolution, pasted | Clamps, "show more", textarea growth, the policy card |
| The stated limit, the limit + 1, and 1,000 characters via the API when the UI caps shorter | Frontend and backend limits that disagree; what a GitOps file or an import can push past the form |
| Empty string, spaces only, `Untitled` | A missing title: collapsed heading, zero-height row, an unnamed object nobody can find again |

**Emails, identifiers and files**

| Value | What it tends to break |
|---|---|
| `bartholomew.fitzgerald+fleet-alerts@northwind-industries-holdings.example.com` | Unbreakable: pushes the row's siblings off without `overflow-wrap: anywhere`; the users list, host details' IdP user, the activity actor |
| `a@b.co` | The shortest realistic email: a layout that assumed a long one looks empty |
| `first.last+billing@example.com`, `ops@sub.department.region.example.co.uk` | Plus-addressing and deep subdomains: validation that rejects `+`, domain extraction |
| A UUID, a serial number, a hardware model string | Monospace width, middle-truncation candidates, copy buttons |
| `https://example.com/workspaces/acme/projects/q3-launch/docs/9f8e7d6c5b4a?tab=comments&filter=unresolved` | A long URL in a setting or a resolution: overflow, and end-truncation hides the part that differs |
| `Q3 Build — FINAL (signed) v12 [approved by legal].pkg`, `IMG_20250914_183022_HDR_edited.HEIC` | Uploaded file names: end-truncation hides the version and extension; brackets and dashes in paths; the software title derived from them |

**Numbers**

| Value | What it tends to break |
|---|---|
| `0` | Zero states: "0 hosts", an empty progress bar, division by zero in a percentage, "0 of 0" |
| `1` | Plurals: "1 hosts", "1 days ago", "1 of 1" |
| `19`, `20`, `21` | The page size: off-by-one in "Showing 20 of 21", an empty second page, "select all" vs "select all matching" |
| `1284`, `100000` | Thousands separators; the width of a count badge; a compact form (`100K`) where precision doesn't matter |
| `33.333%`, `0%`, `100%`, a value past the bound | Policy compliance, install and profile percentages: rounding, bars past their ends |
| A count that changes while you watch (`99` → `100`) | Width jump and jitter without tabular figures |
| `-1`, `NaN`, a string where a number is expected, via the API | Validation and what the UI renders when the server lets it through |
| A host with 1,600+ software packages (an osquery-perf Ubuntu simulation reports that many) | The host's software tab, inventory diffs, the library's counts, scroll performance |

**Time**

| Value | What it tends to break |
|---|---|
| Just now | "0 seconds ago" instead of "just now" |
| About an hour | `last_fetched` on unchanged report results refreshes only after ~50 min (fleetdm/fleet#54897): what the UI says meanwhile |
| 12 days, 11 months, 3 years ago | Relative-time thresholds; when to switch to an absolute date; a host offline for a year |
| `Never` | Never seen, never run, never fetched: is it a word or a 1970 date? |
| A future timestamp (a sim with clock skew, an API value) | "in 3 days" vs "-3 days ago" |
| 23:30 in one timezone, the next day in UTC | Dates that change across the viewer's timezone: activities, expiry dates, maintenance windows |

**Collections**

| Value | What it tends to break |
|---|---|
| 0 items | Does an empty state exist, and does it say what to do next? |
| 1 item | Grids and cards that look broken with one; "1 of 1" |
| Exactly 20, and 21 | Page boundaries, as above |
| 300+ (osquery-perf with `-host_count 300`, per fleet-gotchas) | Scroll and render time, "Showing 20 of 300" copy, bulk-select behaviour |
| Every status at once | Hosts online and offline; installs pending, installing, installed, failed; profiles pending, verifying, verified, failed; policies pass, fail and no data; MDM on and off. Badge widths vary and rows misalign |
| Items with identical names | Lists where the name is the only distinguishing field |
| One item ten times the size of the others | A card grid or accordion stretched to the tallest |

**States**

| State | How to reach it | What it tends to break |
|---|---|---|
| Loading | A list with 300 sims, a slow filter | Old rows under the overlay, a spinner that shifts content, a software count that reads 0 mid-aggregation |
| Error from the API | A deleted object's URL, `/hosts/999999`, a 403 as a role user | No error state, or a raw error (`TypeError: Cannot read properties of undefined`) |
| Partial data | A host with no software, no MDM, no policies, no user | Misaligned rows, dashes where the line should be omitted |
| No permission | The observer role user | Disabled actions: does the row still lay out the same, is the reason explained? |
| GitOps mode on (ask) | | Every write control disabled with the tooltip, and the API still refusing |
| The current user in the list | The users page as yourself | "You" labels, actions that shouldn't apply to yourself (delete, demote) |

## 2. Scope and gating

Question: does the feature behave the same from every scope it can be reached from, and is the
gate real on every door?

- The same page from **All fleets**, **one fleet** and **No fleet** (Unassigned). Counts, the
  fleet dropdown, what a global object looks like inside a fleet's view, a fleet-scoped object
  from All fleets.
- As **each role**: the role users from the local file in the UI; API-only users per global and
  fleet role on `/api/v1`, `/api/latest` and `/api/2022-04`. A fleet maintainer against another
  fleet's object by id. Unauthenticated.
- A global-admin-only page **by direct URL** as a fleet user. A fleet-scoped page with another
  fleet's id in the URL.
- A premium feature's API on **Free** (ask for the restart): hidden in the UI is not the same as
  blocked in the backend.
- **GitOps mode on** (ask): controls disabled with the tooltip, the API refusing the write, the
  keyboard shortcut and the command palette not bypassing it.

Finds: tier gating only in the frontend, pages reachable by URL, a role check on the list but not
on the detail, a global object editable from a fleet's view.

## 3. Second door

Question: the same operation through every entry point. Does each one validate, record and log the
same way?

- Write the same thing through the **UI**, the **API** on each prefix, **fleetctl**, and a
  **GitOps** file (`fleetctl gitops --dry-run` first); where the object has an add and an edit
  path, both. Compare the validation (the same rejections?), the stored result (`GET` it back), the
  **activity** (logged once, by the right actor, with the right details, and not on failure), and
  `generate-gitops` (the field present, secrets redacted, the output applies cleanly).
- **Alternate payload shapes:** the optional field omitted, an empty object, `fleet_id=0` vs no
  param, `null` vs missing. Each can take a different branch.
- **Clearing:** remove the key, the file or the section from the GitOps file. Does the setting
  clear, or stay?

Finds: a validator reached by three routes and applied on two; an activity missing for one door or
logged twice; the batch endpoint skipping the single endpoint's check; GitOps that can set but not
clear.

## 4. Lifecycle

Question: what happens to this feature when the things it depends on change underneath it?

- **Delete the parent while a child points at it:** a fleet that owns policies with automations or
  a calendar integration; a label used by a profile, a software title's scope or a policy; a
  script referenced by a policy automation (a 409 on delete is the expected shape) or with batch
  runs (deleting the script deletes them); a software title with a pending install or an install
  automation; a CA referenced by a profile; a user who authored activities. Then look at what's
  left: the child's page, the list that counted it, the activity feed.
- **Rename the parent** and check every place that showed the old name: pickers, breadcrumbs,
  activities already logged, GitOps output.
- **Hosts:** transfer a host between fleets mid-install or mid-profile; delete a host and re-enroll
  it (same record or new id, and what survived); take a host offline (stop its osquery-perf) and
  look at the pending state; wipe or lock a simulated MDM host enrolled with a dead APNs URL (the
  command stays pending for real; see fleet-gotchas).
- **Disable the feature** and see what it leaves behind: stored values, scheduled work, activities.
- **Deleting a fleet** returns its hosts to No fleet (whose profiles and settings now apply to them)
  and deletes its own policies. Check the feature's view of those hosts afterwards.

Finds: orphans, a page that 500s on a deleted parent, counts that never update, a state that can't
be left.

## 5. Interruption

Question: what does the feature do when the user doesn't follow the happy path to the end?

- **Back** right after a save; **refresh** during a save; **Escape** or close the modal while the
  request is in flight; navigate away with unsaved changes (is there a prompt?).
- **Two tabs** (`browser_tabs`): open the same object in both, edit in one, save in the other.
  Which wins, and does either say so?
- **Double submit:** click Save twice fast; press Enter in a text field inside a multi-field form
  (one bug class: Enter silently saved the first script of a batch).
- **Reopen immediately** after closing a modal: does it show the saved state or the pre-save one?
  The report edit form fills itself twice, from state that survives client-side navigation and
  then from its own fetch, so an edit made right away can be overwritten and save nothing.
- **The list rewrites its URL** just after loading (the hosts list does): a filter or search chosen
  before that can be undone, and "select all matching" can then take a whole fleet. Choose the
  filter, wait, and check the URL kept it.
- **A second toast** after saving the same form twice: the first card is still up for seconds and
  the second stacks on it, so read the newest card, or better the stored state, never the first
  toast you see.

Several of these classes are known and worked around in the Playwright suite; check
`playwright/docs/blocked-by-product-bugs.md` in the qa-automation checkout and the open issues
before calling one new.

## 6. Tables and forms

Question: does the list hold up to real volume and real use, and does the form say no at the right
time?

Tables: the 19/20/21 boundary; sort each column both ways, including a column with nulls and one
with identical values; search with `'`, `"`, `%`, `_`, a leading space, CJK and an emoji; copy the
URL with filters, sort and page applied, open it in a new tab (`browser_tabs`), and check it
restored everything; the empty state, with and without a filter; the loading state over old rows;
bulk select on page 1 vs "select all matching" (scope it to your own fleet); a truncated cell's
tooltip; column widths with a worst-case row.

Forms: validation timing (forms differ today, some validating on blur and some on submit, and the
design direction is submit-only with buttons always enabled, so an enabled Save beside an invalid
field is a QUESTION, not a BUG, unless the sibling form does otherwise); the limit + 1;
spaces only; smart quotes pasted from a document; a required field cleared after a successful save;
Cancel after an edit (does it discard?); where the error appears and whether it clears when the
field is fixed; the disabled state's tooltip; Save twice.

## 7. Oracles

Question: against what are you judging "wrong"? Name it in the row, because "looks odd" can't be
filed.

- **History:** the `previous` instance, when the local file names one; the previous release's
  code (`git -C <fleet> show fleet-v<prev>:<path>`); the release notes.
- **Claims:** the story and its comments, the REST API reference on the release's `docs-v<version>`
  branch, the YAML docs, Figma dev notes, the tooltip and help text on the page, the public docs
  on fleetdm.com. A tooltip that promises something the page doesn't do is a BUG in one of them.
- **Comparable:** the sibling that does the same thing: fleet policies vs global policies, macOS vs
  Windows profiles, add vs edit, the host details card vs the list column, the UI vs `fleetctl get`.
- **Product consistency:** error messages in the house style, empty states worded like the others,
  toast text, capitalisation, "fleets" and "reports" everywhere the UI was renamed (the API keeps
  whatever name each endpoint has, `team_id` here and `fleet_id` there, `queries` for reports; a
  UI-word vs API-name mismatch is not a bug).
- **Activities:** was it logged, once, by the actor who did it, with details that match, and not
  when the action failed?
- **Explainability:** if you can't explain the behaviour to someone else in one sentence, it's a
  QUESTION, whatever the spec says.

## 8. Width and keyboard

Question: does the page still work for someone who isn't on a wide screen with a mouse?

- `browser_resize` (or a `pw.mjs` viewport) to 1440, 1280, 1024 and 768, with the worst-case data
  on screen; 480 only where the product claims it. Those are the wireframes' breakpoints.
  Browser zoom at 200% needs a real browser session; look for fixed heights that clip the grown
  text.
- Tab through the page: every control reachable, focus visible, focus returning to the trigger when
  a modal closes, Escape closing it, Enter submitting what it should and nothing else. Hover-only
  row actions reachable without a pointer.
- The snapshot's names: a button or icon with no accessible name, a form field without a label, a
  tooltip only a mouse can open.

## 9. Concurrency and timing

Question: what happens when two things reach the feature at once, or when the data is mid-flight?

- Two `fleetapi.sh` creates of the same object in parallel (`&` twice, then `wait`): a duplicate,
  a 409, a 500, or an orphan left by an external call that succeeded before the write failed.
- The UI open on an object while the API changes it: stale reads, a save that reverts the other
  change.
- Crons: software counts read 0 while `cleanups_then_aggregation` runs, and policy counts stay stale
  until it has (`fleetctl trigger --context <ctx> --name cleanups_then_aggregation`, then poll); a
  refetch re-runs a host's policies at once; `software_updated_at` moves only when inventory
  changes.
- An action started twice from two sessions (the user's browser and yours): which one the activity
  names.

## Not findings

Known behaviours that look like bugs and aren't, or are already filed. Recognise them, log a NOTE
with the number, and move on:

- **Simulated hosts** (`fleet-gotchas.md` § osquery-perf; `playwright/CLAUDE.md` § Test hosts)
  answer every live query with the same canned row (or, one time in five, nothing, unless started
  with `-live_query_no_results_prob 0`), pass every policy except `SELECT 0`, and report script runs
  and installs they never performed, with random outcomes. A difference between what a sim reports
  and what the feature expected is the simulation, not Fleet. A race that only osquery-perf's burst
  concurrency reaches is a data quirk to route around, not a bug to draft.
- Software **counts read 0 mid-aggregation** and policy counts stay stale until the cron runs
  (`fleet-gotchas.md` § Counts and crons); a CVE page can answer 204 while host counts lag
  (`playwright/docs/blocked-by-product-bugs.md`); unchanged report results refresh `last_fetched`
  only after ~50 min (fleetdm/fleet#54897).
- The **Ace editor worker 404** in the console (fleetdm/fleet#54845; `playwright/helpers/console.ts`).
- **The browser pane blocks pop-ups** (a `window.open` button shows the page's own
  "allow pop-ups" message), and **a burst of 502s** from a tunnel usually means the server is
  restarting (`instance-traps.md` § UI evidence).
- Preinstalled Android apps shown as **Failed** while installed (fleetdm/fleet#52617;
  `instance-traps.md` § Android).
- Whatever `playwright/docs/blocked-by-product-bugs.md` already lists.

---

The catalog adapts Emil Kowalski's break-ui worst-case catalog (Copyright (c) 2026 Emil Kowalski,
MIT License; the notice is in `third-party-licenses.md` beside this file) to Fleet's objects. The
charter, tags and debrief follow session-based exploratory testing (Bach and Bolton), with the
session shape borrowed from petrkindlmann/qa-skills (MIT).
