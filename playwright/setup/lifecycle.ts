/**
 * Parameterized lifecycle helpers for the smoke fleets. Each setup spec
 * just picks a (name, state-file) pair and (optionally) opts into host
 * transfer; the actual create/delete plumbing lives here.
 */
import { APIRequestContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { recreateFleet, deleteFleet } from '@helpers/api/fleets';
import { transferHostsByFilter } from '@helpers/api/hosts';

interface CreateOpts {
  /** Move every online host onto this fleet at setup time. Default false. */
  transferOnlineHosts?: boolean;
}

interface TeardownOpts {
  /** Move all hosts back to "No team" before deleting. Default false. */
  restoreHosts?: boolean;
}

export async function createSmokeFleet(
  request: APIRequestContext,
  name: string,
  statePath: string,
  opts: CreateOpts = {},
): Promise<void> {
  const fleet = await recreateFleet(request, name);
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(fleet, null, 2));

  if (opts.transferOnlineHosts) {
    await transferHostsByFilter(request, fleet.id, { status: 'online' });
  }
}

export async function teardownSmokeFleet(
  request: APIRequestContext,
  statePath: string,
  opts: TeardownOpts = {},
): Promise<void> {
  if (!fs.existsSync(statePath)) {
    console.warn(`[fleet teardown] ${statePath} not found — skipping`);
    return;
  }

  const { id } = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
  if (opts.restoreHosts) {
    await transferHostsByFilter(request, 0, { team_id: id });
  }
  await deleteFleet(request, id, { ignoreMissing: true });
  fs.unlinkSync(statePath);
}
