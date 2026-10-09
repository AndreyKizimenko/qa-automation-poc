/**
 * Reports: the scope's reports are exactly the declared ones, and each carries
 * the declared query, schedule and options.
 *
 * Fleet's REST route is still `/queries`; `merge_inherited=false` keeps a
 * fleet's listing to its own reports rather than the global ones it inherits.
 */
import { test, expect } from '@playwright/test';
import {
  gitopsConfig,
  gitopsLabel,
  resolveTeamId,
  getAll,
  expectExactNames,
  expectSubset,
  targetNames,
  normalizeSql,
} from './_config';

interface ApiQuery {
  id: number;
  name: string;
  query: string;
  platform: string;
  description: string;
  interval: number;
  logging: string;
  discard_data: boolean;
  observer_can_run: boolean;
  automations_enabled: boolean;
  min_osquery_version: string;
  labels_include_any: unknown;
  labels_include_all: unknown;
}

let teamId = 0;
let live: ApiQuery[] = [];

test.beforeAll(async ({ request }) => {
  teamId = await resolveTeamId(request);
  live = await getAll<ApiQuery>(request, `queries?team_id=${teamId}&merge_inherited=false`, 'queries');
});

test.describe(`GitOps verify · reports · ${gitopsLabel}`, () => {
  test('the report set matches gitops exactly', async () => {
    expectExactNames(
      'reports',
      live.map((q) => q.name),
      gitopsConfig.reports.map((r) => r.name),
    );
  });

  test("each report's definition matches gitops", async () => {
    const byName = new Map(live.map((q) => [q.name, q]));
    for (const declared of gitopsConfig.reports) {
      const report = byName.get(declared.name);
      if (!report) continue; // reported by the set test
      const at = `report "${declared.name}"`;
      expect.soft(normalizeSql(report.query), `${at} query`).toBe(normalizeSql(declared.query));
      expectSubset(at, report, {
        platform: declared.platform,
        description: declared.description,
        interval: declared.interval,
        logging: declared.logging,
        discard_data: declared.discardData,
        observer_can_run: declared.observerCanRun,
        automations_enabled: declared.automationsEnabled,
        min_osquery_version: declared.minOsqueryVersion,
      });
      expect.soft(targetNames(report.labels_include_any), `${at} labels_include_any`).toEqual(
        declared.labelsIncludeAny ? [...declared.labelsIncludeAny].sort() : undefined,
      );
      expect.soft(targetNames(report.labels_include_all), `${at} labels_include_all`).toEqual(
        declared.labelsIncludeAll ? [...declared.labelsIncludeAll].sort() : undefined,
      );
    }
  });
});
