// Enroll-secret API helpers for restoring the global and fleet lists around
// specs that change them through the UI. The fleet REST path uses the `fleets` alias.
import { APIRequestContext } from '@playwright/test';
import { apiUrl, authHeaders } from './core';

/**
 * What every test-added global enroll secret contains, so a sweep can find one
 * a killed run left (`removeGlobalEnrollMarkers`).
 */
export const GLOBAL_ENROLL_MARKER = 'pw-enroll-';

export interface EnrollSecret {
  secret: string;
}

/** Current global (no-team) enroll secrets — GET /spec/enroll_secret. */
export async function getGlobalEnrollSecrets(
  request: APIRequestContext,
): Promise<EnrollSecret[]> {
  const res = await request.get(apiUrl('spec/enroll_secret'), { headers: authHeaders() });
  if (!res.ok()) {
    throw new Error(`[getGlobalEnrollSecrets] ${res.status()}: ${await res.text()}`);
  }
  const body = await res.json();
  return ((body.spec?.secrets ?? []) as EnrollSecret[]).map((s) => ({ secret: s.secret }));
}

/**
 * Puts the **global** enroll-secret list back after a test that added and
 * deleted a marker secret: the live list, minus `remove`, plus any secret in
 * `keep` that has gone missing.
 *
 * Fleet's only write for the global list is a full replace (`POST
 * /spec/enroll_secret` deletes every secret in the scope and inserts what it
 * is sent), and the osquery-perf simulations re-enroll with the global secret
 * on every daemon restart. So this never posts a stale snapshot, which would
 * drop anything added since: it starts from the live list, removes only what
 * the test named, and re-adds an original only if a wrong-row delete took it.
 * It writes nothing when the list is already right, and refuses to post an
 * empty list.
 */
export async function restoreGlobalEnrollSecrets(
  request: APIRequestContext,
  { keep, remove }: { keep: EnrollSecret[]; remove: string[] },
): Promise<void> {
  const live = await getGlobalEnrollSecrets(request);
  const next = live.filter((s) => !remove.includes(s.secret));
  for (const s of keep) {
    if (!remove.includes(s.secret) && !next.some((n) => n.secret === s.secret)) next.push(s);
  }
  if (next.length === live.length && next.every((s, i) => s.secret === live[i].secret)) return;
  if (next.length === 0) {
    throw new Error('[restoreGlobalEnrollSecrets] refusing to replace the global enroll secrets with an empty list');
  }
  const res = await request.post(apiUrl('spec/enroll_secret'), {
    headers: authHeaders(),
    data: { spec: { secrets: next.map((s) => ({ secret: s.secret })) } },
  });
  if (!res.ok()) {
    throw new Error(`[restoreGlobalEnrollSecrets] ${res.status()}: ${await res.text()}`);
  }
}

/**
 * Removes every global enroll secret containing {@link GLOBAL_ENROLL_MARKER} —
 * the cleanup sweep for a test-added secret a killed run left. Leaves every
 * other secret as it is.
 */
export async function removeGlobalEnrollMarkers(request: APIRequestContext): Promise<void> {
  const markers = (await getGlobalEnrollSecrets(request))
    .map((s) => s.secret)
    .filter((s) => s.includes(GLOBAL_ENROLL_MARKER));
  if (markers.length) await restoreGlobalEnrollSecrets(request, { keep: [], remove: markers });
}

/** Current enroll secrets for a team/fleet. */
export async function getTeamEnrollSecrets(
  request: APIRequestContext,
  teamId: number,
): Promise<EnrollSecret[]> {
  const res = await request.get(apiUrl(`fleets/${teamId}/secrets`), { headers: authHeaders() });
  if (!res.ok()) {
    throw new Error(`[getTeamEnrollSecrets] ${res.status()}: ${await res.text()}`);
  }
  const body = await res.json();
  return ((body.secrets ?? []) as EnrollSecret[]).map((s) => ({ secret: s.secret }));
}

/** Replace a team/fleet's enroll secrets (PATCH sets the full list). */
export async function setTeamEnrollSecrets(
  request: APIRequestContext,
  teamId: number,
  secrets: EnrollSecret[],
): Promise<void> {
  const res = await request.patch(apiUrl(`fleets/${teamId}/secrets`), {
    headers: authHeaders(),
    data: { secrets: secrets.map((s) => ({ secret: s.secret })) },
  });
  if (!res.ok()) {
    throw new Error(`[setTeamEnrollSecrets] ${res.status()}: ${await res.text()}`);
  }
}
