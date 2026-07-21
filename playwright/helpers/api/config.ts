// App-config (global settings) helpers. Specs that mutate global settings via
// the UI use these to snapshot the affected subtree up front and restore it in
// teardown — Fleet's cleanup projects don't reset app config, and PATCH /config
// merges, so restoring just the touched fields is enough.
import { APIRequestContext } from '@playwright/test';
import { apiUrl, authHeaders } from './core';

export interface OrgInfo {
  org_name?: string;
  // The "Organization support URL" field maps to `contact_url` in the API.
  contact_url?: string;
  [key: string]: unknown;
}

export interface AppConfig {
  org_info?: OrgInfo;
  [key: string]: unknown;
}

/** Fetch the full app config (GET /config). */
export async function getAppConfig(request: APIRequestContext): Promise<AppConfig> {
  const res = await request.get(apiUrl('config'), { headers: authHeaders() });
  if (!res.ok()) {
    throw new Error(`[getAppConfig] ${res.status()}: ${await res.text()}`);
  }
  return res.json();
}

/**
 * Merge-patch the app config (PATCH /config). Pass only the subtree(s) to
 * change, e.g. `{ org_info: { org_name: 'Fleet' } }`.
 */
export async function patchAppConfig(
  request: APIRequestContext,
  patch: Record<string, unknown>,
): Promise<void> {
  const res = await request.patch(apiUrl('config'), { headers: authHeaders(), data: patch });
  if (!res.ok()) {
    throw new Error(`[patchAppConfig] ${res.status()}: ${await res.text()}`);
  }
}
