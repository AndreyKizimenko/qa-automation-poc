import { test, expect } from '@playwright/test';
import { gitopsConfig, gitopsLabel, resolveTeamId } from './_config';

interface ApiPolicy {
  id: number;
  name: string;
  platform: string;
}

let teamId = 0;

test.beforeAll(async ({ request }) => {
  teamId = await resolveTeamId(request);
});

/**
 * Policies have separate endpoints by scope:
 *   - GET /policies          → global / no-team policies
 *   - GET /fleets/{id}/policies → policies owned by team `id`
 * The `?team_id=` query param on /policies is ignored.
 */
function policiesEndpoint(id: number): string {
  return id === 0
    ? '/api/latest/fleet/policies?per_page=200'
    : `/api/latest/fleet/fleets/${id}/policies?per_page=200`;
}

test.describe(`API verify · policies · ${gitopsLabel}`, () => {
  test('policy count matches gitops', async ({ request }) => {
    const res = await request.get(policiesEndpoint(teamId));
    await expect(res).toBeOK();
    const body = await res.json();
    expect(body.policies as ApiPolicy[]).toHaveLength(gitopsConfig.policies.length);
  });

  test('every gitops policy exists by name', async ({ request }) => {
    const res = await request.get(policiesEndpoint(teamId));
    await expect(res).toBeOK();
    const body = await res.json();
    const apiNames = new Set((body.policies as ApiPolicy[]).map((p) => p.name));
    for (const policy of gitopsConfig.policies) {
      expect(apiNames, `policy "${policy.name}" missing from API (team_id=${teamId})`).toContain(policy.name);
    }
  });

  test('no extra policies on live (no superset drift)', async ({ request }) => {
    const res = await request.get(policiesEndpoint(teamId));
    await expect(res).toBeOK();
    const body = await res.json();
    const expected = new Set(gitopsConfig.policies.map((p) => p.name));
    for (const live of body.policies as ApiPolicy[]) {
      expect(expected, `live has unexpected policy "${live.name}" not in gitops (team_id=${teamId})`).toContain(live.name);
    }
  });

  test('platform field matches gitops for each policy', async ({ request }) => {
    const res = await request.get(policiesEndpoint(teamId));
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
