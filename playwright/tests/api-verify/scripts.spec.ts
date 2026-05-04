import { test, expect } from '@playwright/test';
import { gitopsConfig, gitopsLabel, resolveTeamId } from './_config';

interface ApiScript {
  id: number;
  name: string;
}

let teamId = 0;

test.beforeAll(async ({ request }) => {
  teamId = await resolveTeamId(request);
});

test.describe(`API verify · scripts · ${gitopsLabel}`, () => {
  test('script count matches gitops', async ({ request }) => {
    const res = await request.get(`/api/latest/fleet/scripts?per_page=200&team_id=${teamId}`);
    await expect(res).toBeOK();
    const body = await res.json();
    expect(body.scripts as ApiScript[]).toHaveLength(gitopsConfig.scripts.length);
  });

  test('every gitops script exists by basename', async ({ request }) => {
    const res = await request.get(`/api/latest/fleet/scripts?per_page=200&team_id=${teamId}`);
    await expect(res).toBeOK();
    const body = await res.json();
    const apiNames = new Set((body.scripts as ApiScript[]).map((s) => s.name));
    for (const script of gitopsConfig.scripts) {
      expect(apiNames, `script "${script.name}" missing from API (team_id=${teamId})`).toContain(script.name);
    }
  });

  test('no extra scripts on live (no superset drift)', async ({ request }) => {
    const res = await request.get(`/api/latest/fleet/scripts?per_page=200&team_id=${teamId}`);
    await expect(res).toBeOK();
    const body = await res.json();
    const expected = new Set(gitopsConfig.scripts.map((s) => s.name));
    for (const live of body.scripts as ApiScript[]) {
      expect(expected, `live has unexpected script "${live.name}" not in gitops (team_id=${teamId})`).toContain(live.name);
    }
  });
});
