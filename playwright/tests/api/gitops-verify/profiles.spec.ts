import { test, expect } from '@playwright/test';
import { gitopsConfig, gitopsLabel, resolveTeamId } from './_config';

interface ApiProfile {
  profile_uuid: string;
  name: string;
  platform: 'darwin' | 'windows' | 'android' | 'ios' | 'ipados';
}

let teamId = 0;

test.beforeAll(async ({ request }) => {
  teamId = await resolveTeamId(request);
});

test.describe(`GitOps verify · configuration profiles · ${gitopsLabel}`, () => {
  test('total profile count matches gitops', async ({ request }) => {
    const res = await request.get(`/api/latest/fleet/configuration_profiles?per_page=200&team_id=${teamId}`);
    await expect(res).toBeOK();
    const body = await res.json();
    const apiProfiles = body.profiles as ApiProfile[];
    expect(apiProfiles).toHaveLength(gitopsConfig.profiles.length);
  });

  test('per-platform profile counts match gitops', async ({ request }) => {
    const res = await request.get(`/api/latest/fleet/configuration_profiles?per_page=200&team_id=${teamId}`);
    await expect(res).toBeOK();
    const body = await res.json();
    const apiProfiles = body.profiles as ApiProfile[];

    for (const platform of ['darwin', 'windows', 'android'] as const) {
      const expected = gitopsConfig.profiles.filter((p) => p.platform === platform).length;
      const actual = apiProfiles.filter((p) => p.platform === platform).length;
      expect(actual, `${platform} profile count`).toBe(expected);
    }
  });

  test('every gitops profile exists by name', async ({ request }) => {
    const res = await request.get(`/api/latest/fleet/configuration_profiles?per_page=200&team_id=${teamId}`);
    await expect(res).toBeOK();
    const body = await res.json();
    const apiProfiles = body.profiles as ApiProfile[];
    const apiNames = new Set(apiProfiles.map((p) => p.name));
    for (const profile of gitopsConfig.profiles) {
      expect(apiNames, `profile "${profile.name}" (${profile.platform}) missing from API (team_id=${teamId})`).toContain(profile.name);
    }
  });

  test('no extra profiles on live (no superset drift)', async ({ request }) => {
    const res = await request.get(`/api/latest/fleet/configuration_profiles?per_page=200&team_id=${teamId}`);
    await expect(res).toBeOK();
    const body = await res.json();
    const expected = new Set(gitopsConfig.profiles.map((p) => p.name));
    for (const live of body.profiles as ApiProfile[]) {
      expect(expected, `live has unexpected profile "${live.name}" (${live.platform}) not in gitops (team_id=${teamId})`).toContain(live.name);
    }
  });
});
