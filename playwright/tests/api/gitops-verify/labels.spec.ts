import { test, expect } from '@playwright/test';
import { gitopsConfig, gitopsLabel } from './_config';

interface ApiLabel {
  id: number;
  name: string;
  label_type: 'regular' | 'builtin';
}

test.describe(`GitOps verify · labels · ${gitopsLabel}`, () => {
  // Labels are global (not team-scoped) — only verify against the no-team config.
  test.skip(gitopsConfig.scope !== 'no-team', 'labels are not team-scoped');

  test('user label count matches gitops', async ({ request }) => {
    const res = await request.get('/api/latest/fleet/labels');
    await expect(res).toBeOK();
    const body = await res.json();
    const userLabels = (body.labels as ApiLabel[]).filter((l) => l.label_type !== 'builtin');
    expect(userLabels).toHaveLength(gitopsConfig.labels.length);
  });

  test('every gitops label exists by name', async ({ request }) => {
    const res = await request.get('/api/latest/fleet/labels');
    await expect(res).toBeOK();
    const body = await res.json();
    const apiNames = new Set((body.labels as ApiLabel[]).map((l) => l.name));
    for (const label of gitopsConfig.labels) {
      expect(apiNames, `label "${label.name}" missing from API`).toContain(label.name);
    }
  });

  test('no extra user labels on live (no superset drift)', async ({ request }) => {
    const res = await request.get('/api/latest/fleet/labels');
    await expect(res).toBeOK();
    const body = await res.json();
    const expected = new Set(gitopsConfig.labels.map((l) => l.name));
    const userLabels = (body.labels as ApiLabel[]).filter((l) => l.label_type !== 'builtin');
    for (const live of userLabels) {
      expect(expected, `live has unexpected label "${live.name}" not in gitops`).toContain(live.name);
    }
  });
});
