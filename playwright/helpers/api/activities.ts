import { APIRequestContext, expect } from '@playwright/test';
import { apiUrl, authHeaders } from './core';

/**
 * Look for `type` in the recent activity log and fail the test if it's
 * missing. Also asserts the actor is the admin running the suite so
 * cross-tenant noise from other sessions doesn't mask a missing entry.
 * Returns the matched activity for further per-test assertions.
 */
export async function assertActivity(
  request: APIRequestContext,
  type: string,
  matches?: (details: Record<string, unknown>) => boolean,
): Promise<Record<string, unknown>> {
  const activity = await findActivity(request, type, matches);
  expect(activity, `No "${type}" activity matching the criteria found in the recent log`).toBeDefined();
  expect(activity!.actor_email, `"${type}" activity should be attributed to the admin user`).toBe(
    process.env.FLEET_ADMIN_EMAIL,
  );
  return activity!;
}

/**
 * Find the most recent activity of `type` whose details match `matches`.
 * Pages back through the log so a recent entry isn't hidden by a busy
 * concurrent run that flushes many activities between the action under
 * test and this lookup.
 */
export async function findActivity(
  request: APIRequestContext,
  type: string,
  matches?: (details: Record<string, unknown>) => boolean,
  { perPage = 100, maxPages = 5 }: { perPage?: number; maxPages?: number } = {},
): Promise<Record<string, unknown> | undefined> {
  for (let page = 0; page < maxPages; page++) {
    const response = await request.get(apiUrl('activities'), {
      headers: authHeaders(),
      params: {
        order_key: 'created_at',
        order_direction: 'desc',
        per_page: String(perPage),
        page: String(page),
      },
    });
    await expect(response).toBeOK();
    const data = await response.json();
    const activities = (data.activities ?? []) as Array<Record<string, unknown>>;
    const found = activities.find((a) => {
      if (a.type !== type) return false;
      if (!matches) return true;
      return matches((a.details as Record<string, unknown>) ?? {});
    });
    if (found) return found;
    if (activities.length < perPage) return undefined;
  }
  return undefined;
}

/**
 * The id of the newest activity in the log (0 when it's empty). Activity ids
 * only grow, so an id taken before an action marks everything the action
 * records: see {@link assertActivityAfter}.
 */
export async function latestActivityId(request: APIRequestContext): Promise<number> {
  const res = await request.get(apiUrl('activities'), {
    headers: authHeaders(),
    params: { order_key: 'id', order_direction: 'desc', per_page: '1', page: '0' },
  });
  await expect(res, 'Failed to read the activity log').toBeOK();
  return Number(((await res.json()).activities ?? [])[0]?.id ?? 0);
}

/**
 * Waits for an activity of `type` newer than `afterId` (from
 * {@link latestActivityId}, taken before the action) whose details match, and
 * returns it. For activities an earlier run — or this test's own setup — could
 * have left identical (the same host, the same empty value), where finding *a*
 * match proves nothing. `actor` checks `actor_email`; pass `null` for an
 * activity Fleet records on its own.
 */
export async function assertActivityAfter(
  request: APIRequestContext,
  type: string,
  afterId: number,
  matches: (details: Record<string, unknown>) => boolean,
  { actor }: { actor?: string | null } = {},
): Promise<Record<string, unknown>> {
  let found: Record<string, unknown> | undefined;
  await expect
    .poll(
      async () => {
        found = await findActivity(request, type, matches);
        return Number(found?.id ?? 0);
      },
      { timeout: 30_000, message: `a "${type}" activity newer than #${afterId}` },
    )
    .toBeGreaterThan(afterId);
  if (actor !== undefined) {
    expect(found!.actor_email ?? null, `"${type}" activity's actor`).toBe(actor);
  }
  return found!;
}

export interface HostActivity {
  type: string;
  createdAt: string;
  details: Record<string, unknown>;
}

/** A host's past activities, newest first — what its Activity card's Past tab lists. */
export async function listHostActivities(
  request: APIRequestContext,
  hostId: number,
  perPage = 50,
): Promise<HostActivity[]> {
  const res = await request.get(apiUrl(`hosts/${hostId}/activities`), {
    headers: authHeaders(),
    params: { per_page: String(perPage) },
  });
  await expect(res, `Failed to list activities for host ${hostId}`).toBeOK();
  return ((await res.json()).activities ?? []).map(
    (a: { type: string; created_at: string; details: Record<string, unknown> }) => ({
      type: a.type,
      createdAt: a.created_at,
      details: a.details ?? {},
    }),
  );
}
