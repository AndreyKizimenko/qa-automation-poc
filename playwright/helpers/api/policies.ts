// Policy API helpers for seeding/tearing down preconditions.
import { APIRequestContext } from '@playwright/test';
import { apiUrl, authHeaders } from './core';

export interface PolicyRef {
  id: number;
  name: string;
}

/**
 * Create a global (no-team) policy. SQL defaults to a trivially-valid
 * statement since most preconditions only care that a policy exists.
 */
export async function createPolicy(
  request: APIRequestContext,
  opts: { name: string; query?: string; description?: string; resolution?: string },
): Promise<PolicyRef> {
  const res = await request.post(apiUrl('global/policies'), {
    headers: authHeaders(),
    data: {
      name: opts.name,
      query: opts.query ?? 'SELECT 1;',
      description: opts.description ?? '',
      resolution: opts.resolution ?? '',
    },
  });
  if (!res.ok()) {
    throw new Error(`[createPolicy] ${res.status()} creating "${opts.name}": ${await res.text()}`);
  }
  const { policy } = await res.json();
  return { id: policy.id, name: policy.name };
}

/** Delete global policies by id (bulk endpoint); safe on already-deleted ids. */
export async function deletePolicies(request: APIRequestContext, ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await request
    .post(apiUrl('global/policies/delete'), { headers: authHeaders(), data: { ids } })
    .catch((err) => console.warn('[deletePolicies]', err));
}
