import { test as teardown } from '@playwright/test';
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

// Mirrors gitops/premium-fleetqa-reset: the Workstations team is preserved
// (ABM/VPP binds device assignment to its name) but its content is wiped so
// every premium run starts from a known blank slate.
const WORKSTATIONS_FLEET = 'Workstations';

// "All fleets" coverage: queries and packs are global on the Fleet API
// (no per-team endpoint), so deleting them with the unassigned wipe also
// drains anything created from the "All fleets" UI scope. Policies are
// either global (no team_id → deleteAllGlobalPolicies) or team-scoped
// (deleteAllTeamPolicies on Workstations); the "All fleets" UI view is
// the union of both, so the two calls together cover it.
teardown('wipe unassigned state', async ({ request }) => {
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
// return 402/403, so we skip the cleanup entirely rather than swallow
// errors that mask real failures.
teardown('wipe unassigned MDM setup-experience state', async ({ request }) => {
  teardown.skip(
    process.env.SUITE === 'free',
    'Setup-experience MDM features are premium-only',
  );

  await Promise.all([
    deleteBootstrapPackage(request, 0),
    deleteSetupAssistant(request, 0),
    deleteSetupExperienceScript(request, 0),
  ]);
});

teardown('wipe Workstations team state', async ({ request }) => {
  teardown.skip(
    process.env.SUITE === 'free',
    'Workstations team only exists on premium',
  );

  const workstations = await findFleetByName(request, WORKSTATIONS_FLEET);
  if (!workstations) {
    // Workstations is provisioned by gitops; if it's missing the instance is
    // misconfigured. Fail loud rather than silently noop.
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
