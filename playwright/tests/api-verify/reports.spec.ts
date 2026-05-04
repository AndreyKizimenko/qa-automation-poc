import { test, expect } from '@playwright/test';
import { gitopsConfig, gitopsLabel, resolveTeamId } from './_config';

interface ApiQuery {
  id: number;
  name: string;
  platform: string;
}

let teamId = 0;

test.beforeAll(async ({ request }) => {
  teamId = await resolveTeamId(request);
});

/**
 * Reports endpoint: scope by team_id and pass merge_inherited=false so we get
 * only that scope's own reports (no implicit global inheritance for teams).
 *
 * Fleet's REST API uses `/queries` for the route name; UI calls them "reports".
 */
function reportsEndpoint(id: number): string {
  return `/api/latest/fleet/queries?per_page=200&team_id=${id}&merge_inherited=false`;
}

test.describe(`API verify · reports · ${gitopsLabel}`, () => {
  test('report count matches gitops', async ({ request }) => {
    const res = await request.get(reportsEndpoint(teamId));
    await expect(res).toBeOK();
    const body = await res.json();
    expect(body.queries as ApiQuery[]).toHaveLength(gitopsConfig.reports.length);
  });

  test('every gitops report exists by name', async ({ request }) => {
    const res = await request.get(reportsEndpoint(teamId));
    await expect(res).toBeOK();
    const body = await res.json();
    const apiNames = new Set((body.queries as ApiQuery[]).map((q) => q.name));
    for (const report of gitopsConfig.reports) {
      expect(apiNames, `report "${report.name}" missing from API (team_id=${teamId})`).toContain(report.name);
    }
  });

  test('platform field matches gitops for each report', async ({ request }) => {
    const res = await request.get(reportsEndpoint(teamId));
    await expect(res).toBeOK();
    const body = await res.json();
    const apiByName = new Map(
      (body.queries as ApiQuery[]).map((q) => [q.name, q.platform]),
    );
    for (const r of gitopsConfig.reports) {
      if (!r.platform) continue;
      expect(apiByName.get(r.name), `report "${r.name}" platform mismatch`).toBe(r.platform);
    }
  });

  test('no extra reports on live (no superset drift)', async ({ request }) => {
    const res = await request.get(reportsEndpoint(teamId));
    await expect(res).toBeOK();
    const body = await res.json();
    const expected = new Set(gitopsConfig.reports.map((r) => r.name));
    for (const live of body.queries as ApiQuery[]) {
      expect(expected, `live has unexpected report "${live.name}" not in gitops (team_id=${teamId})`).toContain(live.name);
    }
  });
});
