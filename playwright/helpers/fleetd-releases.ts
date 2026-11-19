/**
 * fleetd's builds as Fleet's update server publishes them, and the build a host runs.
 *
 * The update server (TUF, `updates.fleetdm.com`) lists every fleetd component per platform under a channel:
 * `stable`, `edge`, and every released version as a channel of its own (`orbit/linux/1.63.0/orbit`). A fleet's
 * `update_channels` agent option can name any of them, including an older version, and fleetd then goes to
 * it (Fleet's agent configuration docs). Its public `targets.json` is read with no Fleet credential.
 *
 * What a host runs is read from fleetd's own `orbit_info` table by a live query, which answers as soon as
 * fleetd is back up. The host's `orbit_version` in Fleet moves only at its next detail refresh.
 */
import type { APIRequestContext } from '@playwright/test';
import { compareVersions, expectOk, queryHost } from './api';
import type { VmPlatform } from './lab-hosts';

const TUF_TARGETS = 'https://updates.fleetdm.com/targets.json';

/** The update server's names for a platform and its fleetd files. The lab's Linux and Windows hosts are x86-64. */
const TARGET: Record<VmPlatform, { platform: string; orbit: string; desktop: string }> = {
  linux: { platform: 'linux', orbit: 'orbit', desktop: 'desktop.tar.gz' },
  windows: { platform: 'windows', orbit: 'orbit.exe', desktop: 'fleet-desktop.exe' },
  darwin: { platform: 'macos', orbit: 'orbit', desktop: 'desktop.app.tar.gz' },
};

export interface FleetdReleases {
  /** The build the `edge` channel holds. */
  edge: string;
  /** The newest release older than edge that the server has both orbit and Fleet Desktop of, as a channel of its own. */
  previous: string;
}

/** What the update server holds for a platform: edge's build and the release before it. Throws when either is missing. */
export async function fleetdReleases(request: APIRequestContext, platform: VmPlatform): Promise<FleetdReleases> {
  const res = await request.get(TUF_TARGETS);
  await expectOk(res, `Failed to read ${TUF_TARGETS}`);
  const targets = (await res.json()).signed.targets as Record<string, { custom?: { version?: string } }>;
  const { platform: tuf, orbit, desktop } = TARGET[platform];

  const edge = targets[`orbit/${tuf}/edge/${orbit}`]?.custom?.version;
  if (!edge) throw new Error(`[fleetdReleases] ${TUF_TARGETS} has no edge orbit for ${tuf}`);
  const released = Object.keys(targets)
    .map((path) => path.split('/'))
    .filter(([component, plat, version, file]) => component === 'orbit' && plat === tuf && file === orbit && /^\d+\.\d+\.\d+$/.test(version))
    .map(([, , version]) => version)
    .filter((version) => targets[`desktop/${tuf}/${version}/${desktop}`] && compareVersions(version, edge) < 0)
    .sort(compareVersions);
  const previous = released[released.length - 1];
  if (!previous) throw new Error(`[fleetdReleases] ${TUF_TARGETS} has no release of orbit and Fleet Desktop for ${tuf} older than ${edge}`);
  return { edge, previous };
}

/** The fleetd a host runs, from fleetd itself: orbit's version and channel, and Fleet Desktop's version. */
export async function fleetdOnHost(
  request: APIRequestContext,
  hostId: number,
): Promise<{ orbit: string; channel: string; desktop: string }> {
  // Named columns only: the table also holds the host's device token.
  const rows = await queryHost(request, hostId, 'SELECT version, orbit_channel, desktop_version FROM orbit_info;');
  if (rows.length !== 1) throw new Error(`[fleetdOnHost] host ${hostId}: orbit_info returned ${rows.length} rows`);
  return { orbit: rows[0].version, channel: rows[0].orbit_channel, desktop: rows[0].desktop_version };
}
