import { test, expect } from '@playwright/test';
import { gitopsConfig, gitopsLabel } from './_config';

interface ApiQuery {
  id: number;
  name: string;
  platform: string;
}

// Fleet's REST API still calls these "queries" — the UI uses "reports".
const QUERIES_ENDPOINT = '/api/latest/fleet/queries?per_page=200';

test.describe(`API verify · reports · ${gitopsLabel}`, () => {
  test('report count matches gitops', async ({ request }) => {
    const res = await request.get(QUERIES_ENDPOINT);
    await expect(res).toBeOK();
    const body = await res.json();
    expect(body.queries as ApiQuery[]).toHaveLength(gitopsConfig.reports.length);
  });

  test('every gitops report exists by name', async ({ request }) => {
    const res = await request.get(QUERIES_ENDPOINT);
    await expect(res).toBeOK();
    const body = await res.json();
    const apiNames = new Set((body.queries as ApiQuery[]).map((q) => q.name));
    for (const report of gitopsConfig.reports) {
      expect(apiNames, `report "${report.name}" missing from API`).toContain(report.name);
    }
  });

  test('platform field matches gitops for each report', async ({ request }) => {
    const res = await request.get(QUERIES_ENDPOINT);
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
});
