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
