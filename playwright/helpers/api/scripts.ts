import { APIRequestContext, APIResponse, expect } from '@playwright/test';
import { apiUrl, authHeaders } from './core';

/**
 * Uploads a script to a fleet's library and returns its id. `fleetId` 0 is
 * Unassigned — which is also where every host lives on free.
 *
 * Specs build the content at run time rather than reading a fixture off disk:
 * the host-execution specs embed a per-run nonce so that what a report later
 * reads back is provably this run's effect, not a leftover from an earlier one.
 */
export async function uploadScript(
  request: APIRequestContext,
  fleetId: number,
  name: string,
  content: string,
): Promise<number> {
  const res = await request.post(apiUrl('scripts'), {
    headers: authHeaders(),
    multipart: {
      script: { name, mimeType: 'application/octet-stream', buffer: Buffer.from(content) },
      // Unassigned is the absence of a fleet: free rejects `fleet_id=0` outright
      // ("The fleet does not exist"), and premium reads an omitted id the same way.
      ...(fleetId ? { fleet_id: String(fleetId) } : {}),
    },
  });
  await expect(res, `Failed to upload script ${name} to fleet ${fleetId}`).toBeOK();
  return (await res.json()).script_id as number;
}

/** Deletes a script from the library. A 404 (already gone) is not an error. */
export async function deleteScript(request: APIRequestContext, scriptId: number): Promise<void> {
  const res = await request.delete(apiUrl(`scripts/${scriptId}`), { headers: authHeaders() });
  if (res.ok() || res.status() === 404) return;
  throw new Error(`Failed to delete script ${scriptId}: HTTP ${res.status()} — ${await res.text()}`);
}

/** How a host's most recent run of a library script ended, as Fleet reports it. */
export type ScriptExecutionStatus = 'ran' | 'pending' | 'error';

export interface ScriptExecutionRef {
  executionId: string;
  status: ScriptExecutionStatus;
}

/**
 * The host's latest execution of one library script, or null if the host has
 * never run it. This is what the Run script modal's Status column renders, so a
 * spec waits on this before asserting the settled status in the UI.
 */
export async function getHostScriptLastExecution(
  request: APIRequestContext,
  hostId: number,
  scriptName: string,
): Promise<ScriptExecutionRef | null> {
  const res = await request.get(apiUrl(`hosts/${hostId}/scripts`), {
    headers: authHeaders(),
    params: { per_page: '100' },
  });
  await expect(res, `Failed to list scripts for host ${hostId}`).toBeOK();
  const scripts = ((await res.json()).scripts ?? []) as Array<{
    name: string;
    last_execution: { execution_id: string; status: ScriptExecutionStatus } | null;
  }>;
  const last = scripts.find((s) => s.name === scriptName)?.last_execution;
  return last ? { executionId: last.execution_id, status: last.status } : null;
}

export interface ScriptResult {
  /** null while the script is still pending or when the host went silent. */
  exitCode: number | null;
  output: string;
  hostTimeout: boolean;
}

/** One execution's result — what the Script details modal is built from. */
export async function getScriptResult(
  request: APIRequestContext,
  executionId: string,
): Promise<ScriptResult> {
  const res = await request.get(apiUrl(`scripts/results/${executionId}`), {
    headers: authHeaders(),
  });
  await expect(res, `Failed to read script result ${executionId}`).toBeOK();
  const body = await res.json();
  return { exitCode: body.exit_code ?? null, output: body.output ?? '', hostTimeout: !!body.host_timeout };
}

/**
 * Queues an ad-hoc script (no library entry) on a host and returns without
 * waiting for it. Used for cleanup that must happen on the device itself — the
 * run-script specs remove their marker file this way — so it is fire-and-forget
 * by design: the result is not something the spec asserts on.
 */
export async function queueAdHocScript(
  request: APIRequestContext,
  hostId: number,
  scriptContents: string,
): Promise<void> {
  const res = await postAdHocScript(request, hostId, scriptContents);
  if (!res.ok()) {
    console.warn(`[queueAdHocScript] host ${hostId}: HTTP ${res.status()} — ${await res.text()}`);
  }
}

/**
 * The raw ad-hoc run request, for specs that assert how Fleet answers it — a
 * refused run is the response under test, not a failure of the helper.
 */
export async function postAdHocScript(
  request: APIRequestContext,
  hostId: number,
  scriptContents: string,
): Promise<APIResponse> {
  return request.post(apiUrl('scripts/run'), {
    headers: authHeaders(),
    data: { host_id: hostId, script_contents: scriptContents },
  });
}

/**
 * Agent options for a fleet, or the global ones when `fleetId` is 0 or omitted.
 *
 * Global agent options are the only kind free has, and they also govern
 * Unassigned hosts on premium. A named fleet's options replace the global ones
 * wholesale for its hosts — they are not merged.
 */
export async function getAgentOptions(
  request: APIRequestContext,
  fleetId = 0,
): Promise<Record<string, unknown>> {
  if (fleetId === 0) {
    const res = await request.get(apiUrl('config'), { headers: authHeaders() });
    await expect(res, 'Failed to read global agent options').toBeOK();
    return ((await res.json()).agent_options ?? {}) as Record<string, unknown>;
  }
  const res = await request.get(apiUrl(`fleets/${fleetId}`), { headers: authHeaders() });
  await expect(res, `Failed to read fleet ${fleetId}`).toBeOK();
  const body = await res.json();
  return ((body.fleet ?? body.team)?.agent_options ?? {}) as Record<string, unknown>;
}

/**
 * Replaces a fleet's (or the global) agent options with `options`. Both
 * endpoints store what they are given as a whole document, so callers pass a
 * complete object — typically a snapshot from {@link getAgentOptions} with one
 * key changed — and restore the snapshot the same way.
 */
export async function setAgentOptions(
  request: APIRequestContext,
  options: Record<string, unknown>,
  fleetId = 0,
): Promise<void> {
  const res =
    fleetId === 0
      ? await request.patch(apiUrl('config'), {
          headers: authHeaders(),
          data: { agent_options: options },
        })
      : await request.post(apiUrl(`fleets/${fleetId}/agent_options`), {
          headers: authHeaders(),
          data: options,
        });
  await expect(res, `Failed to set agent options on ${fleetId === 0 ? 'global' : `fleet ${fleetId}`}`).toBeOK();
}

/** A batch script run's counts, as `GET /scripts/batch/:id` reports them. */
export interface BatchSummary {
  status: string;
  targeted: number;
  ran: number;
  errored: number;
  pending: number;
  incompatible: number;
  canceled: number;
}

export async function getBatchSummary(request: APIRequestContext, batchId: string): Promise<BatchSummary> {
  const res = await request.get(apiUrl(`scripts/batch/${batchId}`), { headers: authHeaders() });
  await expect(res, `Failed to read batch ${batchId}`).toBeOK();
  const b = await res.json();
  return {
    status: b.status,
    targeted: b.targeted_host_count,
    ran: b.ran_host_count,
    errored: b.errored_host_count,
    pending: b.pending_host_count,
    incompatible: b.incompatible_host_count,
    canceled: b.canceled_host_count,
  };
}

/**
 * The newest batch on a fleet for `scriptName`. Script names in the specs are
 * unique per run, so this is the batch the caller just started.
 */
export async function findBatchId(request: APIRequestContext, fleetId: number, scriptName: string): Promise<string> {
  let id: string | undefined;
  await expect
    .poll(
      async () => {
        const res = await request.get(apiUrl('scripts/batch'), {
          headers: authHeaders(),
          params: { fleet_id: String(fleetId), per_page: '20' },
        });
        await expect(res).toBeOK();
        const batches = ((await res.json()).batch_executions ?? []) as Array<{
          batch_execution_id: string;
          script_name: string;
        }>;
        id = batches.find((b) => b.script_name === scriptName)?.batch_execution_id;
        return id;
      },
      { message: `no batch for ${scriptName} on fleet ${fleetId}` },
    )
    .toBeTruthy();
  return id!;
}

/**
 * Waits for Fleet's batch cron to mark a batch finished — a couple of minutes
 * after the last host reports — and returns its final counts.
 */
export async function waitForBatchFinished(request: APIRequestContext, batchId: string): Promise<BatchSummary> {
  let summary: BatchSummary | undefined;
  await expect
    .poll(async () => (summary = await getBatchSummary(request, batchId)).status, {
      message: `batch ${batchId} never finished`,
      timeout: 480_000,
      intervals: [10_000],
    })
    .toBe('finished');
  return summary!;
}
