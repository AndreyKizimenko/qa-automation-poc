// Report (a.k.a. saved query) API helpers for seeding and tearing down
// preconditions. Fleet's UI calls these "reports"; the REST API keeps the
// legacy `queries` path.
import { APIRequestContext, expect } from '@playwright/test';
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
    /**
     * Seconds between scheduled runs; 0 (the default) never schedules it. A
     * report only stores results for a host once the host has run it on
     * schedule, so a spec that reads host results needs one — 60s lands the
     * first stored row on a real VM in about a minute.
     */
    interval?: number;
    /**
     * The edit form's "Discard data": the report keeps no results. A host's
     * Reports tab lists such a report only with "Show reports that don't store
     * results" on. Omitted, the report stores results (Fleet's default).
     */
    discardData?: boolean;
    /** "Observers can run": a global or fleet observer may run it live. Fleet's default is off. */
    observerCanRun?: boolean;
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
      ...(opts.observerCanRun !== undefined ? { observer_can_run: opts.observerCanRun } : {}),
      ...(opts.interval !== undefined ? { interval: opts.interval, logging: 'snapshot' } : {}),
      ...(opts.interval !== undefined || opts.discardData !== undefined
        ? { discard_data: opts.discardData ?? false }
        : {}),
    },
  });
  if (!res.ok()) {
    throw new Error(`[createReport] ${res.status()} creating "${opts.name}": ${await res.text()}`);
  }
  const { query } = await res.json();
  return { id: query.id, name: query.name };
}

/**
 * List saved reports. Without `fleetId` this is the global scope; reports owned
 * by a fleet are only returned when that fleet is named, so a fleet-scoped
 * report is invisible to the default call.
 */
export async function listReports(
  request: APIRequestContext,
  fleetId?: number,
): Promise<ReportRef[]> {
  const res = await request.get(apiUrl('queries'), {
    headers: authHeaders(),
    params: { per_page: '500', ...(fleetId !== undefined ? { team_id: String(fleetId) } : {}) },
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

/** A report's stored settings, as `GET /queries/:id` returns them. */
export interface ReportDetails {
  id: number;
  name: string;
  description: string;
  query: string;
  /** The owning fleet, or null for a global report. */
  fleetId: number | null;
  interval: number;
  platform: string;
  logging: string;
  /** Store data, inverted: true means Fleet doesn't keep the results. */
  discardData: boolean;
  automationsEnabled: boolean;
  observerCanRun: boolean;
}

/** Reads one report by id, global or fleet-owned. Throws when Fleet can't return it. */
export async function getReport(request: APIRequestContext, id: number): Promise<ReportDetails> {
  const res = await request.get(apiUrl(`queries/${id}`), { headers: authHeaders() });
  await expect(res, `Failed to read report ${id}`).toBeOK();
  const q = (await res.json()).query;
  return {
    id: q.id,
    name: q.name,
    description: q.description ?? '',
    query: q.query,
    fleetId: q.fleet_id ?? q.team_id ?? null,
    interval: q.interval ?? 0,
    platform: q.platform ?? '',
    logging: q.logging ?? '',
    discardData: q.discard_data ?? false,
    automationsEnabled: q.automations_enabled ?? false,
    observerCanRun: q.observer_can_run ?? false,
  };
}

/** Find a report by its exact name (null when absent). */
export async function findReportByName(
  request: APIRequestContext,
  name: string,
  fleetId?: number,
): Promise<ReportRef | null> {
  return (await listReports(request, fleetId)).find((r) => r.name === name) ?? null;
}

/**
 * When a report last stored a result **for one host**, or null if it never has.
 * A report card's "Show details" action is gated on this, so a spec that drills
 * into per-host results should check it before asserting on the UI.
 */
export async function getHostReportLastFetched(
  request: APIRequestContext,
  hostId: number,
  reportName: string,
): Promise<string | null> {
  const res = await request.get(apiUrl(`hosts/${hostId}/queries`), {
    headers: authHeaders(),
    params: { per_page: '100' },
  });
  if (!res.ok()) return null;
  const reports = ((await res.json()).reports ?? []) as Array<{
    name: string;
    last_fetched: string | null;
  }>;
  return reports.find((r) => r.name === reportName)?.last_fetched ?? null;
}

/**
 * The rows a report last stored **for one host**, as column → value — empty
 * until the host has run it on schedule. Each scheduled run replaces the set, so
 * this is always the host's latest answer, which is what the host's Reports-tab
 * card previews.
 */
export async function getHostReportRows(
  request: APIRequestContext,
  hostId: number,
  reportId: number,
): Promise<Array<Record<string, string>>> {
  const res = await request.get(apiUrl(`hosts/${hostId}/reports/${reportId}`), {
    headers: authHeaders(),
  });
  if (!res.ok()) return [];
  const results = ((await res.json()).results ?? []) as Array<{ columns: Record<string, string> }>;
  return results.map((r) => r.columns);
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

/**
 * The ids of the reports Fleet lists for a host — its Reports tab, as data,
 * sorted. A report's label target decides it server-side
 * (`ListHostReports` applies the scope), so a simulation answers as well as a VM.
 */
export async function listHostReportIds(request: APIRequestContext, hostId: number): Promise<number[]> {
  const res = await request.get(apiUrl(`hosts/${hostId}/reports`), {
    headers: authHeaders(),
    params: { per_page: '200' },
  });
  await expect(res, `Failed to list host ${hostId}'s reports`).toBeOK();
  // Each item names its report by `report_id`; there is no `id`.
  return (((await res.json()).reports ?? []) as Array<{ report_id: number }>)
    .map((r) => r.report_id)
    .sort((a, b) => a - b);
}

/**
 * Sets how often a report runs, in seconds. The UI's shortest is 5 minutes; 60
 * lands a real VM's first stored row in about a minute.
 */
export async function setReportInterval(request: APIRequestContext, reportId: number, seconds: number): Promise<void> {
  const res = await request.patch(apiUrl(`queries/${reportId}`), {
    headers: authHeaders(),
    data: { interval: seconds },
  });
  await expect(res, `Failed to set report ${reportId}'s interval`).toBeOK();
}
