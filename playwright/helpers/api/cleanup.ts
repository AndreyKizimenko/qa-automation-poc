// Bulk-delete helpers used by the suite-level teardown to leave no-team
// in a known-empty state. Each helper is safe to call on an already
// empty scope, and throws when the list it works from can't be read: a
// failed request is not an empty instance. The report wipe sends
// every delete before they throw (`deleteEach`), so one stuck item doesn't
// stop the rest of the cleanup and still fails it; the policy wipes throw
// on a non-OK answer, because a policy left behind also keeps the titles and
// scripts its automations use.
import { APIRequestContext } from '@playwright/test';
import { apiLatestUrl, apiUrl, authHeaders, deleteEach, expectOk } from './core';

/** Deletes every global saved query (report); a fleet's own reports aren't listed, so they stay. */
export async function deleteAllQueries(request: APIRequestContext): Promise<void> {
  const res = await request.get(apiUrl('reports'), {
    headers: authHeaders(),
    params: { per_page: '500' },
  });
  await expectOk(res, '[cleanup queries] failed to list the global reports');
  const body = await res.json();
  // A missing list throws rather than reading as nothing to delete (see listReports).
  if (!('reports' in body)) throw new Error('[cleanup queries] the response has no "reports" list');
  const queries = (body.reports ?? []) as Array<{ id: number; name: string }>;
  await deleteEach('cleanup queries', queries, (q) => `report ${q.id} "${q.name}"`, (q) =>
    request.delete(apiUrl(`reports/${q.id}`), { headers: authHeaders() }),
  );
}

/**
 * Deletes every global (no-team) policy in a single bulk call: `/policies`
 * without a `fleet_id` lists the "All fleets" policies. A non-OK answer from
 * either call throws, so a wipe that stops working fails the run instead of
 * leaving the gitops-provisioned global policies in place while every doc says
 * they are gone (a swallowed 404 once made this wipe delete nothing for weeks).
 */
export async function deleteAllGlobalPolicies(request: APIRequestContext): Promise<void> {
  const res = await request.get(apiLatestUrl('policies'), {
    headers: authHeaders(),
    params: { per_page: '500' },
  });
  if (!res.ok()) {
    throw new Error(`[cleanup policies] GET ${apiLatestUrl('policies')} → HTTP ${res.status()}: ${await res.text()}`);
  }
  const body = await res.json();
  const ids = ((body.policies ?? []) as Array<{ id: number }>).map((p) => p.id);
  if (ids.length === 0) return;
  const del = await request.post(apiLatestUrl('policies/delete'), {
    headers: authHeaders(),
    data: { ids },
  });
  if (!del.ok()) {
    throw new Error(
      `[cleanup policies] POST ${apiLatestUrl('policies/delete')} → HTTP ${del.status()}: ${await del.text()}`,
    );
  }
}

/**
 * Deletes every policy a fleet owns in a single bulk call, the global policies
 * it inherits aside. Fleet id 0 is Unassigned, whose own policies are neither
 * global nor any named fleet's, so nothing else removes them. Call it before
 * the fleet's software and scripts go: Fleet refuses (409) to delete a title or
 * a script a policy automation uses, and "Automatic install" on an added title
 * creates exactly such a policy. A non-OK answer throws, as the global wipe
 * does, so a policy wipe that stops working fails the run rather than leaving
 * those titles in place.
 */
export async function deleteAllFleetPolicies(
  request: APIRequestContext,
  fleetId: number,
): Promise<void> {
  // `fleet_id` without `merge_inherited` lists the fleet's own policies only.
  const url = apiUrl('policies');
  const res = await request.get(url, {
    headers: authHeaders(),
    params: { fleet_id: String(fleetId), per_page: '500' },
  });
  if (!res.ok()) {
    throw new Error(`[cleanup fleet ${fleetId} policies] GET ${url} → HTTP ${res.status()}: ${await res.text()}`);
  }
  const body = await res.json();
  const ids = ((body.policies ?? []) as Array<{ id: number }>).map((p) => p.id);
  if (ids.length === 0) return;
  const del = await request.post(`${url}/delete`, {
    headers: authHeaders(),
    data: { ids },
  });
  if (!del.ok()) {
    throw new Error(
      `[cleanup fleet ${fleetId} policies] POST ${url}/delete → HTTP ${del.status()}: ${await del.text()}`,
    );
  }
}
