# Packs ("2017 packs") — E2E test plan

Feature: osquery query packs, kept for compatibility with the 2017 osquery pack format —
see [why Fleet supports query packs](https://fleetdm.com/handbook/company/why-this-way#why-does-fleet-support-query-packs).

Applies to **free and premium** — packs carry no team scope and no premium gating, so
every spec lives in the tier-agnostic trees (`tests/e2e/shared/packs/`, root of `tests/api/`).

Source read for this plan: `frontend/pages/packs/`, `frontend/components/forms/packs/`,
`frontend/components/queries/PackQueriesTable/`, and `server/service/handler.go` route
registration. Verified live against `4.92.0-rc.2609031336`.

## Scope decision

Packs are legacy surface area, so the goal is a thin lifecycle net over the things that
would silently rot — not exhaustive coverage of every form field.

Playwright earns its keep on four things:

1. **The lifecycle actually works through the UI** — create, edit, delete, and the
   enable/disable switch that decides whether a pack is served to hosts at all.
2. **Scheduling a query into a pack** — the react-select modal is the only way to do this
   in the UI and it has no accessible labels, so it is exactly the kind of surface that
   breaks without anyone noticing.
3. **The API version contract** — the schedule endpoint is split across API versions and
   the wrong spelling returns 405 rather than a helpful error (see below).
4. **A pack genuinely running on a host** — the one thing no unit test can assert.

## Environment facts an author needs

- **The schedule endpoint is version-split.** `server/service/handler.go` registers
  `POST /packs/schedule` as `StartingAtVersion("2022-04")` and `POST /schedule` as
  `EndingAtVersion("v1")`. `apiUrl()` is pinned to `/api/v1`, so `apiUrl('packs/schedule')`
  returns **405** — the endpoint is alive, just on the other channel. `helpers/api/packs.ts`
  uses the v1 spelling; `apiLatestUrl('packs/schedule')` is the 2022-04 one.
- **Pack stats appear before the pack has run.** Fleet lists a targeted host's schedule
  immediately with `executions: 0` and a `2000-01-01` placeholder `last_executed`.
  Presence proves nothing — assert `executions > 0`.
- **Host detail refresh is hourly.** `osquery_detail` update interval is 3600s on the QA
  instances, so scheduled-query stats would take up to an hour to surface on their own.
  `POST /hosts/:id/refetch` flags the host to re-run detail queries on its next check-in,
  which collapses that to a couple of minutes.
- **Agent config refresh gates the first execution.** The QA sim fleet runs
  `--config_interval 1m` / `--query_interval 10s` (`tools/perf-hosts/`), so an agent learns
  about a new pack within ~1 minute. End to end, first `executions > 0` lands in ~2.5
  minutes; the spec allows 7.
- **Result logs are not readable from the suite.** Both QA instances log results with the
  `filesystem` plugin to `/tmp/osquery_result` on the server. The observable proof that
  results were produced is the per-query stats the host reports back — `executions`,
  `last_executed`, and `output_size` (bytes emitted, so non-zero means rows, not just a
  dispatch).
- **The pack queries table renders Query / Frequency / Performance impact only.** Platform
  and Logging exist in the table config but are not rendered, so logging mode is asserted
  through the API.
- **`cleanup-setup` deletes every pack on the instance** before the first test, so nothing
  gitops-provisioned can be used as a precondition. Specs seed their own.

## Case list

| # | Case | Where | Notes |
|---|---|---|---|
| 1 | Create a pack with a host target | `packs.spec.ts` → `create` | Pre-existing |
| 2 | Edit a pack's description | `packs.spec.ts` → `edit` | Pre-existing |
| 3 | Delete a pack | `packs.spec.ts` → `delete` | Pre-existing |
| 4 | Create → edit → delete in the activity feed | `packs.spec.ts` | Pre-existing |
| 5 | A new pack is enabled | `pack-status.spec.ts` | |
| 6 | Disable a pack | `pack-status.spec.ts` | Bulk toolbar action |
| 7 | Enable a pack | `pack-status.spec.ts` | |
| 8 | A new pack has no reports | `pack-reports.spec.ts` | |
| 9 | Schedule a query into a pack | `pack-reports.spec.ts` | Frequency renders humanised (60 → "1 minute") |
| 10 | Schedule endpoint version contract | `tests/api/packs.spec.ts` | v1 `/packs/schedule` 405, v1 `/schedule` OK, latest `/packs/schedule` OK |
| 11 | Logging mode round trips | `tests/api/packs.spec.ts` | snapshot vs differential |
| 12 | Removing a scheduled query detaches it | `tests/api/packs.spec.ts` | |
| 13 | `disabled` flag round trips | `tests/api/packs.spec.ts` | |
| 14 | Duplicate pack name rejected | `tests/api/packs.spec.ts` | 409 |
| 15 | A pack runs on a targeted host and reports results | `tests/api/packs-execution.spec.ts` | Needs `liveMacosHost`; ~3 min |

## Locator notes

Two class fallbacks are load-bearing and documented inline:

- `.pack-query-editor-modal__form` identifies the schedule modal. Its visible heading text
  ("Select query") is the react-select **placeholder** and is replaced by the chosen query
  name, so filtering the modal on that text stops matching mid-flow.
- `.pack-query-editor-modal__select-query-dropdown-wrapper` scopes the query dropdown,
  which has no accessible name. Frequency and Shard are the modal's only two spinbuttons
  and neither associates its label, so Frequency is `.first()`.

The Enable bulk-action button's accessible name is **"Enable check"** — the check icon's alt
text is folded in — so it is matched with `/^Enable\b/`. Disable and Delete have plain names.

## Non-goals

- The target picker beyond a single host target (labels, teams) — covered by the pack
  create flow's existing host-target assertion; the picker itself is shared react-select.
- Platform / minimum-osquery-version / shard fields on the schedule modal.
- Removing a scheduled query through the UI. The row's Actions control is a react-select
  whose only clickable node sits outside the viewport; the API case (#12) covers the
  behaviour and the UI path is not worth the brittleness.
- Result-log content. Not reachable from the suite — see the environment facts above.
