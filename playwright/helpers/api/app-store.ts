import { APIRequestContext, expect } from '@playwright/test';
import { apiUrl, sessionAuthHeaders } from './core';

export type AppStorePlatform = 'darwin' | 'ios' | 'ipados' | 'android';

interface AddAppStoreAppOpts {
  appStoreId: string;
  platform: AppStorePlatform;
  /** Required when `platform === "android"`. */
  selfService?: boolean;
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
    headers: sessionAuthHeaders(),
    data,
    timeout: 120_000,
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
