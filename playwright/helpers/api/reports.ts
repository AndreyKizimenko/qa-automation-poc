// Report (a.k.a. saved query) API helpers for seeding and tearing down
// preconditions. Fleet's UI calls these "reports"; the REST API keeps the
// legacy `queries` path.
import { APIRequestContext } from '@playwright/test';
import { apiUrl, authHeaders } from './core';

export interface ReportRef {
  id: number;
  name: string;
  automations_enabled?: boolean;
}

/**
 * Create a saved report. Omitting `teamId` creates a global (All fleets)
 * report; the SQL defaults to a trivially-valid statement since most
 * preconditions only care that a report exists.
 */
export async function createReport(
  request: APIRequestContext,
  opts: {
    name: string;
    query?: string;
    description?: string;
    teamId?: number;
    /** Comma-separated targeted platforms (e.g. "darwin", "windows"); all if omitted. */
    platform?: string;
  },
): Promise<ReportRef> {
  const res = await request.post(apiUrl('queries'), {
    headers: authHeaders(),
    data: {
      name: opts.name,
      query: opts.query ?? 'SELECT 1;',
      description: opts.description ?? '',
      ...(opts.teamId !== undefined ? { team_id: opts.teamId } : {}),
      ...(opts.platform !== undefined ? { platform: opts.platform } : {}),
    },
  });
  if (!res.ok()) {
    throw new Error(`[createReport] ${res.status()} creating "${opts.name}": ${await res.text()}`);
  }
  const { query } = await res.json();
  return { id: query.id, name: query.name };
}

/** List every saved report on the instance. */
export async function listReports(request: APIRequestContext): Promise<ReportRef[]> {
  const res = await request.get(apiUrl('queries'), {
    headers: authHeaders(),
    params: { per_page: '500' },
  });
  if (!res.ok()) return [];
  const body = await res.json();
  return ((body.queries ?? []) as ReportRef[]).map((q) => ({
    id: q.id,
    name: q.name,
    automations_enabled: q.automations_enabled,
  }));
}

/** Fetch a single report by id (null if not found). */
export async function findReportById(
  request: APIRequestContext,
  id: number,
): Promise<ReportRef | null> {
  return (await listReports(request)).find((r) => r.id === id) ?? null;
}

/** Delete a report by id; safe to call on an already-deleted id. */
export async function deleteReport(request: APIRequestContext, id: number): Promise<void> {
  await request
    .delete(apiUrl(`queries/id/${id}`), { headers: authHeaders() })
    .catch((err) => console.warn(`[deleteReport] ${id}:`, err));
}

/**
 * Delete every report whose name contains `marker` (test cleanup). Substring
 * match so a `Copy of <marker>…` duplicate is swept up alongside its original.
 */
export async function deleteReportsMatching(
  request: APIRequestContext,
  marker: string,
): Promise<void> {
  const reports = await listReports(request);
  await Promise.all(
    reports.filter((r) => r.name.includes(marker)).map((r) => deleteReport(request, r.id)),
  );
}
