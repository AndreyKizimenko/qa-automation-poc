import { test, expect } from '@playwright/test';
import { gitopsConfig, gitopsLabel } from './_config';

interface ApiPolicy {
  id: number;
  name: string;
  platform: string;
}

test.describe(`API verify · policies · ${gitopsLabel}`, () => {
  test('global policy count matches gitops', async ({ request }) => {
    const res = await request.get('/api/latest/fleet/policies?per_page=200');
    await expect(res).toBeOK();
    const body = await res.json();
    expect(body.policies as ApiPolicy[]).toHaveLength(gitopsConfig.policies.length);
  });

  test('every gitops policy exists by name', async ({ request }) => {
    const res = await request.get('/api/latest/fleet/policies?per_page=200');
    await expect(res).toBeOK();
    const body = await res.json();
    const apiNames = new Set((body.policies as ApiPolicy[]).map((p) => p.name));
    for (const policy of gitopsConfig.policies) {
      expect(apiNames, `policy "${policy.name}" missing from API`).toContain(policy.name);
    }
  });

  test('platform field matches gitops for each policy', async ({ request }) => {
    const res = await request.get('/api/latest/fleet/policies?per_page=200');
    await expect(res).toBeOK();
    const body = await res.json();
    const apiByName = new Map(
      (body.policies as ApiPolicy[]).map((p) => [p.name, p.platform]),
    );
    for (const p of gitopsConfig.policies) {
      if (!p.platform) continue;
      expect(apiByName.get(p.name), `policy "${p.name}" platform mismatch`).toBe(p.platform);
    }
  });
});
