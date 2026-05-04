import { APIRequestContext, expect } from '@playwright/test';
import { apiUrl, authHeaders } from './core';

/** Find the most recent activity of `type` whose details match `matches`. */
export async function findActivity(
  request: APIRequestContext,
  type: string,
  matches?: (details: Record<string, unknown>) => boolean,
  perPage = 20,
): Promise<Record<string, unknown> | undefined> {
  const response = await request.get(apiUrl('activities'), {
    headers: authHeaders(),
    params: {
      order_key: 'created_at',
      order_direction: 'desc',
      per_page: String(perPage),
    },
  });
  await expect(response).toBeOK();
  const data = await response.json();
  return data.activities?.find((a: Record<string, unknown>) => {
    if (a.type !== type) return false;
    if (!matches) return true;
    return matches((a.details as Record<string, unknown>) ?? {});
  });
}
