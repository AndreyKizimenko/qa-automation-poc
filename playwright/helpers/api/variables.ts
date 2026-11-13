// Custom-variable (global secret) API helpers: seeding and cleanup.
import type { APIRequestContext } from '@playwright/test';
import { apiUrl, authHeaders, deleteEach, expectOk } from './core';

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
  await expectOk(res, 'Failed to list the custom variables');
  const body = await res.json();
  return ((body.custom_variables ?? []) as VariableRef[]).map((v) => ({ id: v.id, name: v.name }));
}

/**
 * Deletes every custom variable whose name contains `marker` (test cleanup).
 * Fleet refuses (409) to delete a variable a script still uses, and that
 * fails this: delete the scripts first.
 */
export async function deleteVariablesMatching(
  request: APIRequestContext,
  marker: string,
): Promise<void> {
  const vars = (await listVariables(request)).filter((v) => v.name.includes(marker));
  await deleteEach('deleteVariablesMatching', vars, (v) => `variable ${v.id} ${v.name}`, (v) =>
    request.delete(apiUrl(`custom_variables/${v.id}`), { headers: authHeaders() }),
  );
}

/**
 * Creates a global custom variable and returns its id. Scripts, profiles and
 * installer scripts reference it as `$FLEET_SECRET_<name>`.
 */
export async function createVariable(request: APIRequestContext, name: string, value: string): Promise<number> {
  const res = await request.post(apiUrl('custom_variables'), { headers: authHeaders(), data: { name, value } });
  await expectOk(res, `Failed to create custom variable ${name}`);
  return (await res.json()).id as number;
}
