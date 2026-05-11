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
  deleteAllQueries,
  deleteAllScripts,
  deleteAllTeamPolicies,
  deleteBootstrapPackage,
  deleteSetupAssistant,
  deleteSetupExperienceScript,
  findFleetByName,
} from '@helpers/api';

const WORKSTATIONS_FLEET = 'Workstations';

// Queries and packs are global on the Fleet API (no per-team endpoint),
// so deleting them with the unassigned wipe also drains anything created
// from the "All fleets" UI scope. Policies are either global
// (deleteAllGlobalPolicies) or team-scoped (deleteAllTeamPolicies on
// Workstations); the "All fleets" UI view is the union of both, so the
// two calls together cover it.
test('wipe unassigned state', async ({ request }) => {
  await Promise.all([
    deleteAllQueries(request),
    deleteAllGlobalPolicies(request),
    deleteAllPacks(request),
    deleteAllInstallSoftwareTitles(request, 0),
    deleteAllConfigurationProfiles(request, 0),
    deleteAllScripts(request, 0),
  ]);
});

// MDM setup-experience entities are premium-only (bootstrap packages, DEP
// setup assistants, setup-experience scripts). On free these endpoints
// return 402/403, so skip the cleanup entirely rather than swallow errors
// that mask real failures.
test('wipe unassigned MDM setup-experience state', async ({ request }) => {
  test.skip(
    process.env.SUITE === 'free',
    'Setup-experience MDM features are premium-only',
  );

  await Promise.all([
    deleteBootstrapPackage(request, 0),
    deleteSetupAssistant(request, 0),
    deleteSetupExperienceScript(request, 0),
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
    deleteBootstrapPackage(request, workstations.id),
    deleteSetupAssistant(request, workstations.id),
    deleteSetupExperienceScript(request, workstations.id),
  ]);
});
