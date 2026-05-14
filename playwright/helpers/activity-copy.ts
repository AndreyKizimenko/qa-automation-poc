/**
 * Builders that produce a RegExp matching the activity-feed copy Fleet
 * renders on the dashboard. CRUD specs use them with
 * `dashboard.expectActivities([...])` instead of hand-coding the verb +
 * scope-suffix combination each time.
 *
 * Templates are grounded in Fleet's frontend source:
 *   frontend/pages/DashboardPage/cards/ActivityFeed/GlobalActivityItem/
 *   GlobalActivityItem.tsx
 *
 * Each builder cites the line that emits the copy. Pin the line range when
 * upstream changes, or update both ends together when Fleet edits the
 * template — `tests/api/activity-copy.spec.ts` is the gate that catches
 * the regex going out of sync.
 *
 * Scope of this module today: policy, report, pack, script, and the
 * tier-agnostic user create/delete activities. The harder cases (software
 * app-store asymmetry, configuration profile platform-aware suffix, user
 * role changes) keep their hand-coded matchers until they're folded in.
 */

import type { TeamScope } from '@pages';

/** Regex-escape a string so it can be embedded literally in a RegExp. */
function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Scope-suffix for policies/reports — Fleet renders:
 *   team_id === -1 → " globally"
 *   team_id === 0 (policy only) → " for Unassigned"
 *   team_name set → " on the <team> fleet"
 *
 * Reports don't have an Unassigned variant; pass `{ unassignedFallsThrough: true }`
 * to suppress " for Unassigned" for resource families that omit it.
 *
 * @see frontend/.../GlobalActivityItem.tsx createdPolicy ~1723, createdSavedQuery ~1657
 */
function fleetSuffix(
  scope: TeamScope,
  opts: { unassignedFallsThrough?: boolean } = {},
): string {
  switch (scope) {
    case 'All fleets':
      return ' globally';
    case 'Unassigned':
      return opts.unassignedFallsThrough ? '' : ' for Unassigned';
    default:
      return ` on the ${scope} fleet`;
  }
}

/**
 * Scope-suffix for scripts — Fleet renders:
 *   team_name set → "the <team> fleet"
 *   otherwise → "unassigned"
 *
 * Scripts have no `team_id === -1` "global" variant (the activity is
 * always tied to a specific scope or unassigned).
 *
 * @see frontend/.../GlobalActivityItem.tsx addedScript ~1095
 */
function scriptScope(scope: TeamScope): string {
  if (scope === 'Unassigned' || scope === 'All fleets') return 'unassigned';
  return `the ${scope} fleet`;
}

export const activityCopy = {
  policy: {
    /** @see frontend/.../GlobalActivityItem.tsx:1748 — `created a policy <b>NAME</b><scope>.` */
    created: ({ name, scope }: { name: string; scope: TeamScope }) =>
      new RegExp(`created a policy ${esc(name)}${fleetSuffix(scope)}\\.`),
    /** @see frontend/.../GlobalActivityItem.tsx:1778 */
    edited: ({ name, scope }: { name: string; scope: TeamScope }) =>
      new RegExp(`edited the policy ${esc(name)}${fleetSuffix(scope)}\\.`),
    /** @see frontend/.../GlobalActivityItem.tsx:1808 */
    deleted: ({ name, scope }: { name: string; scope: TeamScope }) =>
      new RegExp(`deleted the policy ${esc(name)}${fleetSuffix(scope)}\\.`),
  },

  report: {
    /** @see frontend/.../GlobalActivityItem.tsx:1674 — `created a report <b>NAME</b><scope>.` */
    created: ({ name, scope }: { name: string; scope: TeamScope }) =>
      new RegExp(`created a report ${esc(name)}${fleetSuffix(scope, { unassignedFallsThrough: true })}\\.`),
    /** @see frontend/.../GlobalActivityItem.tsx:1696 */
    edited: ({ name, scope }: { name: string; scope: TeamScope }) =>
      new RegExp(`edited the report ${esc(name)}${fleetSuffix(scope, { unassignedFallsThrough: true })}\\.`),
    /** @see frontend/.../GlobalActivityItem.tsx:1718 */
    deleted: ({ name, scope }: { name: string; scope: TeamScope }) =>
      new RegExp(`deleted the report ${esc(name)}${fleetSuffix(scope, { unassignedFallsThrough: true })}\\.`),
  },

  // Packs are global on the Fleet API (no team scope). The activity item
  // falls through to a default template that renders "created pack NAME."
  // etc. — verified empirically against tests/e2e/shared/packs/packs.spec.ts.
  pack: {
    created: ({ name }: { name: string }) =>
      new RegExp(`created pack ${esc(name)}\\.`),
    edited: ({ name }: { name: string }) =>
      new RegExp(`edited pack ${esc(name)}\\.`),
    deleted: ({ name }: { name: string }) =>
      new RegExp(`deleted pack ${esc(name)}\\.`),
  },

  script: {
    /** @see frontend/.../GlobalActivityItem.tsx:1095 — `added script <b>NAME</b> to <scope>.` */
    added: ({ name, scope }: { name: string; scope: TeamScope }) =>
      new RegExp(`added script ${esc(name)} to ${scriptScope(scope)}\\.`),
    /** @see frontend/.../GlobalActivityItem.tsx:1120 — `edited script <b>NAME</b> for <scope>.` */
    edited: ({ name, scope }: { name: string; scope: TeamScope }) =>
      new RegExp(`edited script ${esc(name)} for ${scriptScope(scope)}\\.`),
    /** @see frontend/.../GlobalActivityItem.tsx:1145 — `deleted script <b>NAME</b> from <scope>.` */
    deleted: ({ name, scope }: { name: string; scope: TeamScope }) =>
      new RegExp(`deleted script ${esc(name)} from ${scriptScope(scope)}\\.`),
  },

  user: {
    // Fleet renders `created a user <b> EMAIL</b>.` — note the leading space
    // inside <b>, which renders as a doubled gap. `\s+` tolerates both the
    // single-space (deleted) and double-space (created) variants.
    /** @see frontend/.../GlobalActivityItem.tsx:237 */
    created: ({ email }: { email: string }) =>
      new RegExp(`created a user\\s+${esc(email)}\\.`),
    /** @see frontend/.../GlobalActivityItem.tsx:246 */
    deleted: ({ email }: { email: string }) =>
      new RegExp(`deleted a user\\s+${esc(email)}\\.`),
  },
} as const;
