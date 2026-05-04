import { APIRequestContext, expect } from '@playwright/test';
import { apiUrl, authHeaders, type HostRef } from './core';

/**
 * The `platform` query param returns a label group that can include hosts
 * outside the requested platform; this filters client-side by the host's
 * actual platform field.
 */
function matchesPlatform(
  hostPlatform: string,
  desired: 'darwin' | 'windows' | 'linux',
): boolean {
  if (desired === 'darwin') return hostPlatform === 'darwin';
  if (desired === 'windows') return hostPlatform === 'windows';
  const linuxPlatforms = [
    'linux', 'ubuntu', 'debian', 'rhel', 'centos', 'arch',
    'fedora', 'amzn', 'sles', 'gentoo', 'pop', 'manjaro',
  ];
  return linuxPlatforms.includes(hostPlatform);
}

/** Find a host of a given platform that has vulnerable software. */
export async function findHostByPlatform(
  baseURL: string,
  token: string,
  platform: 'darwin' | 'windows' | 'linux',
): Promise<HostRef | null> {
  const res = await fetch(
    `${baseURL}${apiUrl('hosts')}?platform=${platform}&per_page=50`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return null;
  const { hosts } = await res.json();
  if (!hosts?.length) return null;

  const filtered = hosts.filter((h: { platform: string }) =>
    matchesPlatform(h.platform, platform),
  );

  for (const host of filtered) {
    const swRes = await fetch(
      `${baseURL}${apiUrl(`hosts/${host.id}/software`)}?vulnerable=true&per_page=1`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!swRes.ok) continue;
    const swBody = await swRes.json();
    if (swBody.software?.length > 0 || swBody.count > 0) {
      return { id: host.id, displayName: host.display_name };
    }
  }
  return null;
}

// ── Host transfer ────────────────────────────────────────────────────────────

/**
 * Transfer specific hosts to a fleet. Pass `null` (or `0`) to send hosts
 * to "No team" — the server expects `team_id: null` for unassigned, since
 * `team_id: 0` references a non-existent row and trips the FK constraint.
 *
 * The server rejects payloads that include both `team_id` and `fleet_id`
 * during the rename transition; we send `team_id` (the legacy field name)
 * since the server still accepts it on every supported version.
 */
export async function transferHosts(
  request: APIRequestContext,
  fleetId: number | null,
  hostIds: number[],
): Promise<void> {
  if (!hostIds.length) return;
  const teamId = fleetId === 0 ? null : fleetId;
  const res = await request.post(apiUrl('hosts/transfer'), {
    headers: authHeaders(),
    data: { team_id: teamId, hosts: hostIds },
  });
  await expect(res, `Failed to transfer hosts to fleet ${fleetId}`).toBeOK();
}

/**
 * Transfer hosts to a fleet by filter (e.g. all online, or all on a given
 * source fleet). Returns silently when no hosts match. Pass `null` (or `0`)
 * for the destination to mean "No team". Filter keys must also use only
 * one of `team_id` / `fleet_id`.
 */
export async function transferHostsByFilter(
  request: APIRequestContext,
  fleetId: number | null,
  filters: Record<string, string | number>,
): Promise<void> {
  const teamId = fleetId === 0 ? null : fleetId;
  const res = await request.post(apiUrl('hosts/transfer/filter'), {
    headers: authHeaders(),
    data: { team_id: teamId, filters },
  });
  await expect(res, `Failed to transfer hosts to fleet ${fleetId}`).toBeOK();
}
