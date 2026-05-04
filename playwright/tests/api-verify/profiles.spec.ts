import { test, expect } from '@playwright/test';
import { gitopsConfig, gitopsLabel } from './_config';

interface ApiProfile {
  profile_uuid: string;
  name: string;
  platform: 'darwin' | 'windows' | 'android' | 'ios' | 'ipados';
}

const PROFILES_ENDPOINT = '/api/latest/fleet/configuration_profiles?per_page=200';

test.describe(`API verify · configuration profiles · ${gitopsLabel}`, () => {
  test('total profile count matches gitops', async ({ request }) => {
    const res = await request.get(PROFILES_ENDPOINT);
    await expect(res).toBeOK();
    const body = await res.json();
    const apiProfiles = body.profiles as ApiProfile[];
    expect(apiProfiles).toHaveLength(gitopsConfig.profiles.length);
  });

  test('per-platform profile counts match gitops', async ({ request }) => {
    const res = await request.get(PROFILES_ENDPOINT);
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
    const res = await request.get(PROFILES_ENDPOINT);
    await expect(res).toBeOK();
    const body = await res.json();
    const apiProfiles = body.profiles as ApiProfile[];
    const apiNames = new Set(apiProfiles.map((p) => p.name));
    for (const profile of gitopsConfig.profiles) {
      expect(apiNames, `profile "${profile.name}" (${profile.platform}) missing from API`).toContain(profile.name);
    }
  });
});
