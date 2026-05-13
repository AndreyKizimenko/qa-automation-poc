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
  // Every helper here is safe on both tiers. The MDM-related ones
  // (resetSetupExperience and its sub-helpers in helpers/api/mdm.ts)
  // absorb the 402 "Requires Premium" response on free, so they noop
  // instead of failing the Promise.all batch. deleteAllQaTestUsers only
  // touches addresses matching the QA_TEST_EMAIL_RE prefix in
  // helpers/api/users.ts, so admin/SSO accounts are untouchable.
  await Promise.all([
    deleteAllQueries(request),
    deleteAllGlobalPolicies(request),
    deleteAllPacks(request),
    deleteAllInstallSoftwareTitles(request, 0),
    deleteAllConfigurationProfiles(request, 0),
    deleteAllScripts(request, 0),
    deleteAllQaTestUsers(request),
    resetSetupExperience(request, 0),
  ]);
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
