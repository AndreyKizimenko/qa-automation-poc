import { test, expect } from '@playwright/test';
import { gitopsConfig, gitopsLabel } from './_config';

interface ApiLabel {
  id: number;
  name: string;
  label_type: 'regular' | 'builtin';
}

test.describe(`API verify · labels · ${gitopsLabel}`, () => {
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
});
