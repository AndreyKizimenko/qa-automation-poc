/**
 * Shared wipe steps for both the pre-test (cleanup-setup) and post-test
 * (cleanup-teardown) projects. Idempotent — every helper either returns
 * early on a missing resource (404) or no-ops when the endpoint isn't
 * available (free).
 *
 * Picking up where gitops can't: `fleetctl gitops` with empty-list
 * directives doesn't delete profiles/scripts/etc. that weren't applied
 * via gitops in the first place. Running these wipes before tests start
 * means a Playwright run is self-healing regardless of how the live
 * instance got into its current state.
 */
import { test } from '@playwright/test';
import {
  deleteAllConfigurationProfiles,
  deleteAllGlobalPolicies,
  deleteAllInstallSoftwareTitles,
  deleteAllPacks,
  deleteAllQaTestUsers,
  deleteAllQueries,
  deleteAllScripts,
  deleteAllTeamPolicies,
  findFleetByName,
  resetSetupExperience,
} from '@helpers/api';

const WORKSTATIONS_FLEET = 'Workstations';

// Queries and packs are global on the Fleet API (no per-team endpoint),
// so deleting them with the unassigned wipe also drains anything created
// from the "All fleets" UI scope. Policies are either global
// (deleteAllGlobalPolicies) or team-scoped (deleteAllTeamPolicies on
// Workstations); the "All fleets" UI view is the union of both, so the
// two calls together cover it.
test('wipe unassigned state', async ({ request }) => {
  // Tier-agnostic wipes — these endpoints exist on both free and premium.
  // deleteAllQaTestUsers only touches addresses matching the QA_TEST_EMAIL_RE
  // prefix in helpers/api/users.ts, so admin/SSO accounts are untouchable.
  const ops: Promise<unknown>[] = [
    deleteAllQueries(request),
    deleteAllGlobalPolicies(request),
    deleteAllPacks(request),
    deleteAllInstallSoftwareTitles(request, 0),
    deleteAllConfigurationProfiles(request, 0),
    deleteAllScripts(request, 0),
    deleteAllQaTestUsers(request),
  ];

  // Premium-only resets. MDM setup-experience entities (bootstrap
  // packages, DEP setup assistants, setup-experience scripts, plus the
  // macos_setup toggles) return 402/403 on free, so the call is gated
  // behind the suite check rather than letting Promise.all reject the
  // whole batch on a free run.
  if (process.env.SUITE !== 'free') {
    ops.push(resetSetupExperience(request, 0));
  }

  await Promise.all(ops);
});

test('wipe Workstations team state', async ({ request }) => {
  test.skip(
    process.env.SUITE === 'free',
    'Workstations team only exists on premium',
  );

  const workstations = await findFleetByName(request, WORKSTATIONS_FLEET);
  if (!workstations) {
    // Workstations is provisioned by gitops; if it's missing the instance
    // is misconfigured. Fail loud rather than silently noop.
    throw new Error(
      `Workstations team not found on premium instance — gitops apply likely missing`,
    );
  }

  await Promise.all([
    deleteAllTeamPolicies(request, workstations.id),
    deleteAllInstallSoftwareTitles(request, workstations.id),
    deleteAllConfigurationProfiles(request, workstations.id),
    deleteAllScripts(request, workstations.id),
    resetSetupExperience(request, workstations.id),
  ]);
});
