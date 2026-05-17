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
 * Each builder cites the line that emits the copy. `tests/api/activity-copy.spec.ts`
 * is the gate that catches regexes going out of sync with the citations.
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

/**
 * Scope-suffix for app-store apps. The Fleet *renderer* is symmetric for
 * add/delete (team_name → "the X fleet", otherwise → "unassigned"), but
 * the activity *details* are asymmetric on the Unassigned scope: Fleet's
 * API populates team_name="No team" on the add activity, leaving
 * team_name=null on the delete activity. That maps to:
 *   add    on Unassigned → "the No team fleet"
 *   delete on Unassigned → "unassigned"
 * Named teams (Workstations, etc.) stay symmetric: "the X fleet".
 *
 * @see frontend/.../GlobalActivityItem.tsx addedAppStoreApp ~1480
 */
function appStoreAppScope(scope: TeamScope, action: 'add' | 'delete'): string {
  if (scope !== 'Unassigned' && scope !== 'All fleets') return `the ${scope} fleet`;
  return action === 'add' ? 'the No team fleet' : 'unassigned';
}

/**
 * Scope-suffix for configuration profiles. Tier-aware: Fleet renders
 * different copy on free vs premium, gated by `isPremiumTier` in the
 * frontend (getProfileMessageSuffix). The helper reads `process.env.SUITE`
 * to pick the branch — set reliably by playwright.config.ts's resolveSuite
 * at config load.
 *
 *   Free:                 "all <hostsPhrase>"                     (scope ignored)
 *   Premium Unassigned:   "unassigned <hostsPhrase>"
 *   Premium named team:   "<hostsPhrase> assigned to the X fleet"
 *
 * @see frontend/.../GlobalActivityItem.tsx getProfileMessageSuffix:66
 */
function profileSuffix(hostsPhrase: string, scope?: TeamScope): string {
  if (process.env.SUITE !== 'premium') return `all ${hostsPhrase}`;
  if (!scope || scope === 'Unassigned' || scope === 'All fleets') {
    return `unassigned ${hostsPhrase}`;
  }
  return `${hostsPhrase} assigned to the ${scope} fleet`;
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

  // Packs are global on the Fleet API (no team scope). Fleet has no
  // dedicated pack renderer; activities fall through to defaultActivityTemplate
  // (GlobalActivityItem.tsx:848), which prints `<activityType> <b>NAME</b>.`
  // — "created pack NAME.", "edited pack NAME.", "deleted pack NAME.".
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

  // Custom packages + Fleet-Maintained Apps. The feed shows the installer
  // file (Fleet's activity `software_package` detail — e.g. `gh_2.92.0.pkg`),
  // not the human-readable title. Symmetric add/delete scope suffix.
  software: {
    /** @see frontend/.../GlobalActivityItem.tsx:1349 — `added <b>PACKAGE</b> to <scope>.` */
    added: ({ packageName, scope }: { packageName: string; scope: TeamScope }) =>
      new RegExp(`added ${esc(packageName)} to ${scriptScope(scope)}\\.`),
    /** @see frontend/.../GlobalActivityItem.tsx:1379 — `deleted <b>PACKAGE</b> from <scope>.` */
    deleted: ({ packageName, scope }: { packageName: string; scope: TeamScope }) =>
      new RegExp(`deleted ${esc(packageName)} from ${scriptScope(scope)}\\.`),
  },

  // VPP and Android app-store entries. The feed renders the title with a
  // `(Platform)` parens suffix before the preposition. Scope suffix is
  // asymmetric on Unassigned — see {@link appStoreAppScope}.
  appStoreApp: {
    /** @see frontend/.../GlobalActivityItem.tsx:1480 — `added <b>TITLE</b> (Platform) to <scope>.` */
    added: ({ name, platform, scope }: { name: string; platform: string; scope: TeamScope }) =>
      new RegExp(`added ${esc(name)} \\(${esc(platform)}\\) to ${appStoreAppScope(scope, 'add')}\\.`),
    /** @see frontend/.../GlobalActivityItem.tsx:1518 — `deleted <b>TITLE</b> (Platform) from <scope>.` */
    deleted: ({ name, platform, scope }: { name: string; platform: string; scope: TeamScope }) =>
      new RegExp(`deleted ${esc(name)} \\(${esc(platform)}\\) from ${appStoreAppScope(scope, 'delete')}\\.`),
  },

  // MDM configuration profiles. Suffix is tier-aware via process.env.SUITE
  // (see {@link profileSuffix}). `hostsPhrase` is the platform-specific
  // string Fleet embeds in the suffix — Apple profiles use "macOS, iOS,
  // and iPadOS hosts", Windows "Windows hosts", Android "Android hosts".
  // On free, scope is ignored — the feed always reads "all <hostsPhrase>"
  // — so free specs can omit it.
  configurationProfile: {
    /** @see frontend/.../GlobalActivityItem.tsx:585 — `added configuration profile <b>NAME</b> to <scope>.` */
    added: ({ name, hostsPhrase, scope }: { name: string; hostsPhrase: string; scope?: TeamScope }) =>
      new RegExp(`added configuration profile ${esc(name)} to ${profileSuffix(hostsPhrase, scope)}\\.`),
    /** @see frontend/.../GlobalActivityItem.tsx:608 — `deleted configuration profile <b>NAME</b> from <scope>.` */
    deleted: ({ name, hostsPhrase, scope }: { name: string; hostsPhrase: string; scope?: TeamScope }) =>
      new RegExp(`deleted configuration profile ${esc(name)} from ${profileSuffix(hostsPhrase, scope)}\\.`),
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
    /**
     * Premium adds " for all fleets" to the global-role change; free omits it.
     * Tier read from process.env.SUITE (see {@link profileSuffix} for the
     * pattern).
     * @see frontend/.../GlobalActivityItem.tsx:282 — `changed <b>EMAIL</b> to <b>ROLE</b>[ for all fleets].`
     */
    changedGlobalRole: ({ email, role }: { email: string; role: string }) => {
      const suffix = process.env.SUITE === 'premium' ? ' for all fleets' : '';
      return new RegExp(`changed ${esc(email)} to ${esc(role)}${suffix}\\.`);
    },
  },
} as const;
