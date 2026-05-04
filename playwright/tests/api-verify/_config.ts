/**
 * Loads the GitOps target once per test run and exposes a few helpers each
 * spec uses for scope-aware assertions.
 *
 * Override the target with the GITOPS_TARGET env var:
 *   GITOPS_TARGET=../gitops/free-fleetqa-min                              (no-team config — directory)
 *   GITOPS_TARGET=../gitops/premium-fleetqa/fleets/workstations.yml       (team config — file)
 */
import * as path from 'path';
import { APIRequestContext } from '@playwright/test';
import { loadAnyConfig } from '@helpers/gitops-yaml';

const target = process.env.GITOPS_TARGET
  ? path.resolve(process.cwd(), process.env.GITOPS_TARGET)
  : path.resolve(__dirname, '../../../gitops/free-fleetqa');

export const gitopsTarget = target;
export const gitopsLabel = path.basename(target, path.extname(target));
export const gitopsConfig = loadAnyConfig(target);

/**
 * Resolves the team_id for the loaded config:
 * - 'no-team' scope → 0
 * - 'team' scope → looks up by name via GET /teams
 *
 * Cached per-process so each spec's beforeAll only hits the API once.
 */
let cachedTeamId: number | undefined;
export async function resolveTeamId(request: APIRequestContext): Promise<number> {
  if (cachedTeamId !== undefined) return cachedTeamId;
  if (gitopsConfig.scope === 'no-team') {
    cachedTeamId = 0;
    return 0;
  }
  const res = await request.get('/api/latest/fleet/teams?per_page=200');
  if (!res.ok()) {
    throw new Error(`failed to list teams: HTTP ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  const team = (body.teams as Array<{ id: number; name: string }>).find(
    (t) => t.name === gitopsConfig.teamName,
  );
  if (!team) {
    const known = (body.teams as Array<{ name: string }>).map((t) => t.name).join(', ');
    throw new Error(`team "${gitopsConfig.teamName}" not found on server. Existing: [${known}]`);
  }
  cachedTeamId = team.id;
  return team.id;
}

/** Helper for specs: returns the `team_id=N` query string fragment. */
export function teamIdQuery(teamId: number): string {
  return `team_id=${teamId}`;
}
