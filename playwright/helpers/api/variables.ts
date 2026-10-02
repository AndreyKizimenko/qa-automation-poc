// Custom-variable (global secret) API helpers: seeding and cleanup.
import { APIRequestContext, expect } from '@playwright/test';
import { apiUrl, authHeaders } from './core';

export interface VariableRef {
  id: number;
  name: string;
}

/** List every custom variable. */
export async function listVariables(request: APIRequestContext): Promise<VariableRef[]> {
  const res = await request.get(apiUrl('custom_variables'), {
    headers: authHeaders(),
    params: { per_page: '500' },
  });
  if (!res.ok()) return [];
  const body = await res.json();
  return ((body.custom_variables ?? []) as VariableRef[]).map((v) => ({ id: v.id, name: v.name }));
}

/** Delete every custom variable whose name contains `marker` (test cleanup). */
export async function deleteVariablesMatching(
  request: APIRequestContext,
  marker: string,
): Promise<void> {
  const vars = await listVariables(request);
  await Promise.all(
    vars
      .filter((v) => v.name.includes(marker))
      .map((v) =>
        request
          .delete(apiUrl(`custom_variables/${v.id}`), { headers: authHeaders() })
          .catch((err) => console.warn(`[deleteVariablesMatching] ${v.id}:`, err)),
      ),
  );
}

/**
 * Creates a global custom variable and returns its id. Scripts, profiles and
 * installer scripts reference it as `$FLEET_SECRET_<name>`.
 */
export async function createVariable(request: APIRequestContext, name: string, value: string): Promise<number> {
  const res = await request.post(apiUrl('custom_variables'), { headers: authHeaders(), data: { name, value } });
  await expect(res, `Failed to create custom variable ${name}`).toBeOK();
  return (await res.json()).id as number;
}
