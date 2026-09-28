# Batch A — No setup

**28 source flows → 14 specs.** `Read-only surfaces` · `Validation and gating` · `API size contracts`

**✅ Shipped 2026-09-28** — [PR #61](https://github.com/AndreyKizimenko/qa-automation-poc/pull/61). Two source rows were dropped as DUPs and one moved to batch B; `titles-table` split into a `shared/` and a `premium/` spec because columns and sorting are identical on free. See [DELIVERY-LOG § Round 2 · Batch A](../DELIVERY-LOG.md).

Read [README.md](README.md) first for the standing rules and how a batch runs. Source flows live in
`qa-wolf/Fleet_20260828 (1)/{Free,Premium}/src/tests/<path>` — the paths below are relative to that.

---

Nothing in this batch creates, uploads or configures anything. Role visibility, column headers, sorting,
filters, dashboard cards, rejected uploads, and API size limits. Every case runs against whatever the instance
already has, so they are fast, parallel-safe and can run anywhere.

**Start here.** It is the cheapest way to learn the suite's conventions, and it front-loads the
`withStaticUser` role harness that four later batches depend on. Round 1's equivalent batch is where we found
four pre-existing suite bugs.

## Read-only surfaces

*19 source flows → 9 specs.*

Role visibility, column headers, sorting, filters and dashboard cards.

**What to do better.** Their four `view-software-page-as-*` flows assert column headers positionally —
`nth(0)`, `nth(1)`, `nth(2)`, `nth(4)` — skipping index 3 with no explanation, across four near-identical
files. One role-dimensioned spec with a named column list says the same thing and survives a column being
added. The platform-card flows use `:text("macOS"):below(.dashboard-page__platform)`, a positional CSS
pseudo-selector that breaks on any reflow; the card is reachable by role and accessible name.

**POM work:** `DashboardPage` — platform cards, host-count links, chart cards by name. `SoftwareTitlesPage` —
column-sort toggles and the installable/vulnerable filters. `FleetMaintainedAppsPage` — platform filter,
hide-added toggle, text search.

| Target spec | Kind | Source flows folded in |
|---|---|---|
| `tests/e2e/premium/dashboard/fleet-scoped-cards.spec.ts` | **new** | `dashboard/dashboard-widgets-hosts-active-ui-and-filters`<br>`dashboard/dashboard-widgets-vulnerability-exposure` |
| `tests/e2e/shared/dashboard/platform-cards.spec.ts` | **new** | `dashboard/display-and-filter-platform-cards-global-admin`<br>`dashboard/display-and-filter-platform-cards-global-admin [FREE]`<br>`dashboard/display-and-filter-platform-cards-global-maintainer`<br>`dashboard/display-and-filter-platform-cards-global-observer` |
| `tests/e2e/premium/software/fleet-maintained-filters.spec.ts` | **new** | `fleet-maintained-filters/Fleet maintained apps filter` |
| `tests/e2e/premium/reports/reports.spec.ts` | augment · check DUP | `queries-global-users/global-admin-able-to-select-teams-target-for-query-premium` |
| `tests/e2e/premium/software/titles-table.spec.ts` | **new** | `software/filter-by-installable-software`<br>`software/sort-software-on-columns` |
| `tests/e2e/premium/software/role-access.spec.ts` | **new** | `software/view-software-page-as-global-maintainer`<br>`software/view-software-page-as-global-observer-premium`<br>`software/view-software-page-as-team-admin-premium`<br>`software/view-software-page-as-team-maintainer-premium` |
| `tests/e2e/premium/software/no-teams-views.spec.ts` | augment | `uncategorized/all-teams-view-switching-tabs` |
| `tests/e2e/premium/software/vulnerabilities.spec.ts` | augment | `uncategorized/vulnerability-severity-filter-lists-options-from-critical-down` |
| `tests/e2e/premium/software/manage-automations-access.spec.ts` | augment | `user-profiles/team-admin-unable-to-click-manage-automations-button-premium`<br>`user-profiles/team-maintainer-unable-to-click-manage-automations-button-premium` |

**Two rows landed differently than planned, both for free coverage.** `titles-table` split: the columns and
the two sortable headers are identical on free, so they went to `tests/e2e/shared/software/titles-table.spec.ts`
and only the Library-vs-Inventory half (Library is premium-only) stayed in
`tests/e2e/premium/software/titles-table.spec.ts`. And the dashboard's platform *cards* no longer exist — Fleet
replaced them with the "Hosts enrolled" bar chart, whose platform rows are `role="button"` named
`"<platform> hosts"` linking to that platform's built-in label with `status=enrolled`; that is what
`platform-cards` asserts. Built-in label *membership* is not asserted anywhere: the osquery-perf pool answers
every built-in label query, so the "macOS" label holds mostly Ubuntu hosts on both instances.

**Handed to B: `general/disable-hosts-online-and-vulnerabilities-chart-fleets-only`.** Its subject is turning
historical reporting off in fleet settings and back on again — a config write, which is
[B](B-self-contained.md)'s shape, not a read-only surface. It shipped there as
`premium/dashboard/historical-data-collection.spec.ts`. `fleet-scoped-cards` keeps the half that *is* a read:
the chart card renders under a fleet scope with its controls, the dataset switch re-requests for that fleet,
and an applied filter narrows the request and flags the card "Filtered" without persisting anything.

The two are deliberately pointed at different fleets. B's spec disables collection, which **deletes the data
already collected**, so it runs against Workstations (no hosts, no history to lose); `fleet-scoped-cards` needs
the VMs fleet precisely because it has 30 days of history to plot.

## Validation and gating

*4 source flows → 3 specs.*

Negative paths: rejected file types, blocked submissions, disabled inputs. Each opens a form, gets refused,
and closes.

**Keep these out of the lifecycle specs.** A validation case inside a CRUD spec turns a failed assertion into
a cleanup problem. Round 1 already separated `Scripts library — upload validation` and `MDM • OS settings —
configuration profile upload validation` this way; follow that shape.

**POM work:** `FileUploader` — rejection-toast accessor. `EditSoftwareModal` — validation error text.

`custom-icons/only-valid-icons-can-be-uploaded-size-dimensions-are-respected` moved to
[B](B-self-contained.md): it shares a spec file and an `EditAppearanceModal` with the icon CRUD lifecycle, so
splitting it across two batches meant two owners for one file. Shipped there.

| Target spec | Kind | Source flows folded in |
|---|---|---|
| `tests/e2e/premium/software/add-software-validation.spec.ts` | **new** | `software/software-installer-selecting-no-team-prompts-user-to-choose-team`<br>`software/software-installers-non-allowed-file-types` |
| `tests/e2e/premium/policies/policy-automations.spec.ts` | augment | `uncategorized/other-workflows-modal-saving-disables-form-inputs` |

## API size contracts

*5 source flows → 2 specs.*

Request-body size boundaries, asserted through the API with no browser.

**The payloads are generated, never committed — and this is already solved.**
`tests/api/premium/max-request-file-sizes.spec.ts` from round 1 builds every payload at run time:

```ts
const oversized = Buffer.concat([
  Buffer.from('%PDF-1.7\n'),
  Buffer.alloc(27 * 1024 * 1024, 'a'),
]);
```

So these four are new rows in an existing table, using the same pattern. **One difference to design for:** the
round-1 spec deliberately covers *rejection* paths only, because a rejected upload creates nothing and so
needs no cleanup.

Only one of the four is under the limit — `run-mdm-commands-with-files-less-than-2mb`; the other three are all
rejections. Shipped, it persists nothing either: queuing a real command needs an MDM-enrolled host and leaves a
command in that host's history with no way to withdraw it, so the case targets a UUID that cannot exist and
asserts Fleet answered `404 No hosts targeted` — the handler replying at all is the proof the body cleared the
size gate. A command that actually runs belongs with [D](D-host-execution.md).

`host-software-payload` shipped at **`tests/api/host-software-payload.spec.ts`**, not under `premium/`:
`exclude_software` is not premium-gated, and at the root of `tests/api/` both tiers run it.

**POM work:** none.

| Target spec | Kind | Source flows folded in |
|---|---|---|
| `tests/api/premium/max-request-file-sizes.spec.ts` | augment | `api-max-request-file-sizes/run-mdm-commands-with-file-size-3mb`<br>`api-max-request-file-sizes/run-mdm-commands-with-files-less-than-2mb`<br>`api-max-request-file-sizes/upload-multiple-batch-profiles-totaling-greater-2621mb`<br>`api-max-request-file-sizes/upload-multiple-batch-scripts-greater-than-2621-mb` |
| `tests/api/premium/host-software-payload.spec.ts` | **new** | `software/exclude-software-when-using-get-hosts-identifier-identifier-api-endpoint` |

---

## Done when

- every target spec above exists and is green on each tier it targets;
- `npm run check` is clean;
- each spec ran at least once headed and at least once **with** dependencies (no `--no-deps`);
- anything timing-sensitive survived `--repeat-each=5`;
- a line per shipped slice is appended to [DELIVERY-LOG.md](../DELIVERY-LOG.md);
- anything parked has a row in [`../blocked-by-product-bugs.md`](../../blocked-by-product-bugs.md)
  or a reasoned note in this file — never a silent skip.
