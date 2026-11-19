/**
 * The throwaway instance (`QA — Throwaway instance`, `.github/throwaway-instance/README.md`): a free Fleet
 * the workflow brings up on its own runner and drops with it. Its `fleet-data.mjs` seeds what
 * `test-data/shared/throwaway/seed.json` describes and enrolls `THROWAWAY_HOSTS` osquery-perf hosts, then
 * waits until each host has answered for the seed, all before the `throwaway` project starts. So, unlike
 * every other project, these specs read data they did not make: on the Update flow's run it was made on
 * the release before the upgrade, which is the point of reading it.
 */
import type { APIRequestContext } from '@playwright/test';
import { readFileSync } from 'fs';
import * as path from 'path';
import { apiUrl, authHeaders, expectOk } from './api/core';

export interface ThrowawaySeed {
  orgName: string;
  /** The osquery-perf templates the run enrolls, each at least once, and the platform Fleet records. */
  simulations: Array<{ template: string; platform: string }>;
  report: {
    name: string;
    description: string;
    query: string;
    interval: number;
    automations_enabled: boolean;
    logging: string;
  };
  policies: Array<{ name: string; description: string; query: string; response: 'passing' | 'failing' }>;
  label: { name: string; description: string; query: string };
  observer: { name: string; email: string };
  pack: { name: string; report: string; query: string; interval: number };
}

export const THROWAWAY_SEED: ThrowawaySeed = JSON.parse(
  readFileSync(path.resolve(__dirname, '../test-data/shared/throwaway/seed.json'), 'utf8'),
);

/** How many hosts the run enrolled (`THROWAWAY_HOSTS`): the specs expect exactly these. */
export function throwawayHostCount(): number {
  const hosts = Number(process.env.THROWAWAY_HOSTS);
  if (!Number.isInteger(hosts) || hosts < THROWAWAY_SEED.simulations.length) {
    throw new Error(
      `THROWAWAY_HOSTS must be the number of hosts the run enrolled (at least ${THROWAWAY_SEED.simulations.length}), ` +
        `not "${process.env.THROWAWAY_HOSTS ?? ''}"`,
    );
  }
  return hosts;
}

export interface ThrowawayHost {
  id: number;
  displayName: string;
  platform: string;
  status: string;
}

/** Every host on the instance: all of them are the run's simulations. */
export async function listThrowawayHosts(request: APIRequestContext): Promise<ThrowawayHost[]> {
  const res = await request.get(apiUrl('hosts'), { headers: authHeaders(), params: { per_page: '1000' } });
  await expectOk(res, 'Failed to list the hosts');
  const hosts = (await res.json()).hosts as Array<{ id: number; display_name: string; platform: string; status: string }>;
  return hosts.map((h) => ({ id: h.id, displayName: h.display_name, platform: h.platform, status: h.status }));
}

/**
 * The id of the global report of that exact name; throws when there is none. The list is read under
 * either name Fleet has given it (`reports` since Fleet 5 dropped the deprecated keys in
 * fleetdm/fleet#59035, `queries` before), since the throwaway instance runs whatever build the
 * workflow was given.
 */
export async function throwawayReportId(request: APIRequestContext, name: string): Promise<number> {
  const res = await request.get(apiUrl('reports'), { headers: authHeaders(), params: { per_page: '1000' } });
  await expectOk(res, 'Failed to list the reports');
  const body = await res.json();
  const reports = (body.reports ?? body.queries ?? []) as Array<{ id: number; name: string }>;
  const report = reports.find((r) => r.name === name);
  if (!report) throw new Error(`No global report named "${name}": the workflow seeds it`);
  return report.id;
}

/** The run's host of one platform; the run enrolls every seeded platform, so a missing one is a failure. */
export async function throwawayHostOf(request: APIRequestContext, platform: string): Promise<ThrowawayHost> {
  const host = (await listThrowawayHosts(request)).find((h) => h.platform === platform);
  if (!host) throw new Error(`no ${platform} host on the throwaway instance: the run enrolls one of each seeded platform`);
  return host;
}
