/**
 * Shared helpers for scope-aware navigation in premium specs.
 *
 * Background: Fleet's pages don't behave identically when navigated to
 * with or without a `fleet_id` query param. Some pages (e.g. configuration
 * profiles) preserve the last-used team via localStorage and render that
 * team's view even when the URL omits `fleet_id`. Others (e.g. policies
 * list) default to "All fleets" when `fleet_id` is missing.
 *
 * To stay consistent, every scope-aware goto in a spec should:
 *  1. Resolve the right `fleet_id` via {@link fleetIdFor}.
 *  2. Verify the team dropdown shows the intended scope via
 *     `<page>.teamDropdown.select(scope)` — that call is idempotent
 *     (no-op when already selected, click+pick otherwise).
 *
 * Specs that loop over `TeamScope[]` should import {@link fleetIdFor}
 * from here rather than redeclaring it locally.
 */
import type { TeamScope } from '@pages';

/**
 * Map a UI scope label to the `fleet_id` URL query value Fleet expects.
 *
 *  - `'All fleets'` → `undefined` (URL omits `fleet_id`; aggregated view)
 *  - `'Unassigned'` → `0` (no-team)
 *  - `'Workstations'` → the resolved Workstations fleet id (from the
 *    `workstationsFleetId` worker fixture)
 *
 * Overloads let specs that narrow `SCOPES` to non-`'All fleets'` values
 * (e.g. `['Unassigned', 'Workstations'] as const`) get a `number` return
 * type instead of `number | undefined`, so they can feed it directly to
 * page-object `goto({ fleetId })` signatures that require `number`.
 */
export function fleetIdFor(
  scope: 'Workstations' | 'Unassigned',
  workstationsFleetId: number,
): number;
export function fleetIdFor(
  scope: TeamScope,
  workstationsFleetId: number,
): number | undefined;
export function fleetIdFor(scope: TeamScope, workstationsFleetId: number): number | undefined {
  if (scope === 'Workstations') return workstationsFleetId;
  if (scope === 'Unassigned') return 0;
  return undefined;
}
