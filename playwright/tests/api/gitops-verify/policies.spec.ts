/**
 * Policies: the scope's policies are exactly the declared ones, and each
 * carries the declared query, platform, flags, label targets and automation.
 *
 * Policies have separate endpoints by scope — GET /policies for the global
 * ones, GET /fleets/{id}/policies for a fleet's — and `?team_id=` on the first
 * is ignored. An automation is reported by what it resolved to (a title id and
 * name, a script name), so the declared slug or package is mapped through the
 * fleet's software before comparing.
 */
import { test, expect } from '@playwright/test';
import {
  gitopsConfig,
  gitopsLabel,
  isPremium,
  resolveTeamId,
  getAll,
  expectExactNames,
  expectSubset,
  declaredTargets,
  targetNames,
  normalizeSql,
  resolveFleetSoftware,
  type FleetSoftware,
} from './_config';

interface ApiPolicy {
  id: number;
  name: string;
  query: string;
  platform: string;
  critical: boolean;
  type?: string;
  calendar_events_enabled: boolean;
  conditional_access_enabled: boolean;
  continuous_automations_enabled: boolean;
  patch_when_closed?: boolean;
  notify_before_patching?: boolean;
  install_software: { software_title_id: number; name: string } | null;
  run_script: { id: number; name: string } | null;
  labels_include_any: unknown;
  labels_exclude_any: unknown;
}

let teamId = 0;
let live: ApiPolicy[] = [];
let software: FleetSoftware | undefined;

test.beforeAll(async ({ request }) => {
  teamId = await resolveTeamId(request);
  live = await getAll<ApiPolicy>(request, teamId === 0 ? 'policies' : `fleets/${teamId}/policies`, 'policies');
  if (gitopsConfig.policies.some((p) => p.installSoftware)) {
    software = await resolveFleetSoftware(request, teamId);
  }
});

test.describe(`GitOps verify · policies · ${gitopsLabel}`, () => {
  test('the policy set matches gitops exactly', async () => {
    expectExactNames(
      'policies',
      live.map((p) => p.name),
      gitopsConfig.policies.map((p) => p.name),
    );
  });

  test("each policy's definition matches gitops", async () => {
    const byName = new Map(live.map((p) => [p.name, p]));
    for (const declared of gitopsConfig.policies) {
      const policy = byName.get(declared.name);
      if (!policy) continue; // reported by the set test
      const at = `policy "${declared.name}"`;
      expect.soft(policy.platform, `${at} platform`).toBe(declared.platform ?? '');
      if (declared.type !== 'patch') {
        expect.soft(normalizeSql(policy.query), `${at} query`).toBe(normalizeSql(declared.query));
      }
      // `critical` is a premium field (`server/fleet/policies.go`, `premium:"true"`): a free
      // license stores false whatever the YAML says, and the lib policies the tiers share
      // declare it. On free the instance is held to that, not to the declaration.
      expect.soft(policy.critical, `${at} critical`).toBe(isPremium ? (declared.critical ?? false) : false);
      expectSubset(at, policy, {
        calendar_events_enabled: declared.calendarEventsEnabled,
        conditional_access_enabled: declared.conditionalAccessEnabled,
        continuous_automations_enabled: declared.continuousAutomationsEnabled,
        patch_when_closed: declared.patchWhenClosed,
        notify_before_patching: declared.notifyBeforePatching,
        type: declared.type,
      });
      const targets = declaredTargets(declared);
      expect.soft(targetNames(policy.labels_include_any), `${at} labels_include_any`).toEqual(targets.labels_include_any);
      expect.soft(targetNames(policy.labels_exclude_any), `${at} labels_exclude_any`).toEqual(targets.labels_exclude_any);
      expect.soft(policy.run_script?.name, `${at} run_script`).toBe(declared.runScript);
      if (declared.installSoftware) {
        expect.soft(policy.install_software?.software_title_id, `${at} install_software`).toBe(
          expectedTitleId(declared.installSoftware, declared.fleetMaintainedAppSlug),
        );
      } else {
        expect.soft(policy.install_software ?? null, `${at} install_software`).toBeNull();
      }
    }
  });
});

/** The software title id the declared automation should have resolved to on this fleet. */
function expectedTitleId(
  install: NonNullable<(typeof gitopsConfig.policies)[number]['installSoftware']>,
  patchSlug: string | undefined,
): number | undefined {
  const slug = install.slug ?? (install.patch ? patchSlug : undefined);
  if (slug) return software?.addedSlugs.get(slug);
  const hash = install.hash ?? (install.packagePath ? gitopsConfig.software.packages.find((p) => p.path === install.packagePath)?.hash : undefined);
  if (hash) return software?.titles.find((t) => t.package?.hash_sha256 === hash)?.id;
  if (install.appStoreId) {
    return software?.titles.find((t) => String(t.appStoreApp?.app_store_id) === install.appStoreId)?.id;
  }
  return undefined;
}
