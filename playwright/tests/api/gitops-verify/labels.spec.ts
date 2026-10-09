/**
 * Labels: the scope's regular labels are exactly the declared ones, and each is
 * defined as declared. Built-in labels are Fleet's and never compared. A
 * no-team config owns the global labels (`fleet_id` null); a fleet file owns
 * the labels scoped to that fleet, which is usually none.
 */
import { test, expect } from '@playwright/test';
import { gitopsConfig, gitopsLabel, resolveTeamId, getJson, expectExactNames, normalizeSql } from './_config';

interface ApiLabel {
  id: number;
  name: string;
  description: string;
  label_type: 'regular' | 'builtin';
  label_membership_type: 'dynamic' | 'manual' | 'host_vitals';
  query: string;
  platform: string;
  fleet_id: number | null;
  team_id: number | null;
  criteria: Record<string, unknown> | null;
}

let teamId = 0;
let live: ApiLabel[] = [];

test.beforeAll(async ({ request }) => {
  teamId = await resolveTeamId(request);
  const all = (await getJson(request, 'labels')).labels as ApiLabel[];
  live = all.filter((l) => l.label_type === 'regular' && (l.fleet_id ?? l.team_id ?? 0) === teamId);
});

test.describe(`GitOps verify · labels · ${gitopsLabel}`, () => {
  test('the label set matches gitops exactly', async () => {
    expectExactNames(
      'labels',
      live.map((l) => l.name),
      gitopsConfig.labels.map((l) => l.name),
    );
  });

  test("each label's definition matches gitops", async () => {
    const byName = new Map(live.map((l) => [l.name, l]));
    for (const declared of gitopsConfig.labels) {
      const label = byName.get(declared.name);
      if (!label) continue; // reported by the set test
      const at = `label "${declared.name}"`;
      expect.soft(label.label_membership_type, `${at} membership type`).toBe(declared.membership);
      if (declared.description !== undefined) {
        expect.soft(label.description, `${at} description`).toBe(declared.description);
      }
      if (declared.membership === 'dynamic') {
        expect.soft(normalizeSql(label.query), `${at} query`).toBe(normalizeSql(declared.query));
        expect.soft(label.platform ?? '', `${at} platform`).toBe(declared.platform ?? '');
      }
      if (declared.criteria) {
        expect.soft(label.criteria, `${at} criteria`).toMatchObject(declared.criteria);
      }
    }
  });
});
