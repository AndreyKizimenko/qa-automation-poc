// Team enroll-secret API helpers for snapshot/restore around specs that mutate
// a team's secrets via the UI. The REST path uses the `fleets` alias.
import { APIRequestContext } from '@playwright/test';
import { apiUrl, authHeaders } from './core';

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
