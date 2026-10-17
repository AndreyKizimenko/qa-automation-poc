import { APIRequestContext, expect } from '@playwright/test';
import { apiUrl, authHeaders } from './core';

export type AppStorePlatform = 'darwin' | 'ios' | 'ipados' | 'android';

interface AddAppStoreAppOpts {
  appStoreId: string;
  platform: AppStorePlatform;
  /** Required when `platform === "android"`. */
  selfService?: boolean;
}

/**
 * Fails, with Fleet's reason, when Fleet can't list a fleet's VPP apps. Fleet
 * asks Apple for the list on every request, so a VPP token Apple has revoked
 * or let expire answers 500 here with Apple's own error (9625 is "The server
 * has revoked the sToken"). In the UI the same failure is just a list that
 * never renders, so a spec that goes through the App store tab checks this first.
 */
export async function expectVppAppsListable(
  request: APIRequestContext,
  fleetId: number,
): Promise<void> {
  const res = await request.get(apiUrl('software/app_store_apps'), {
    headers: authHeaders(),
    params: { fleet_id: String(fleetId) },
    timeout: 60_000,
  });
  await expect(
    res,
    `Fleet can't list the VPP apps for fleet ${fleetId}; the reason is in the response below. ` +
      'A VPP token Apple has revoked or let expire is renewed in Settings → Integrations → MDM → VPP',
  ).toBeOK();
}

/**
 * Adds an Apple VPP or Managed Google Play app to a fleet. For Android,
 * `selfService` is required by the API. Returns the resulting
 * `software_title_id`.
 */
export async function addAppStoreApp(
  request: APIRequestContext,
  fleetId: number,
  opts: AddAppStoreAppOpts,
): Promise<{ titleId: number }> {
  const data: Record<string, unknown> = {
    app_store_id: opts.appStoreId,
    fleet_id: fleetId,
    platform: opts.platform,
  };
  if (opts.platform === 'android') {
    data.self_service = opts.selfService ?? true;
  }
  const res = await request.post(apiUrl('software/app_store_apps'), {
    headers: authHeaders(),
    data,
    timeout: 60_000,
  });
  await expect(
    res,
    `Failed to add app_store_app ${opts.appStoreId} (${opts.platform}) to fleet ${fleetId}`,
  ).toBeOK();
  const body = await res.json();
  if (!body.software_title_id) {
    throw new Error(`Add app store app returned no software_title_id: ${JSON.stringify(body)}`);
  }
  return { titleId: body.software_title_id };
}
