import { test, expect } from '@playwright/test';
import { gitopsConfig, gitopsLabel } from './_config';

test.describe(`API verify · org-settings · ${gitopsLabel}`, () => {
  test.skip(gitopsConfig.scope !== 'no-team', 'org settings only apply to no-team scope');

  test('org name matches gitops', async ({ request }) => {
    const res = await request.get('/api/latest/fleet/config');
    await expect(res).toBeOK();
    const body = await res.json();
    expect(body.org_info.org_name).toBe(gitopsConfig.orgName);
  });

  test('SSO settings match gitops', async ({ request }) => {
    const res = await request.get('/api/latest/fleet/config');
    await expect(res).toBeOK();
    const body = await res.json();
    expect(body.sso_settings.enable_sso).toBe(gitopsConfig.enableSso);
    expect(body.sso_settings.entity_id).toBe(gitopsConfig.ssoEntityId);
    expect(body.sso_settings.idp_name).toBe(gitopsConfig.ssoIdpName);
  });

  test('Windows MDM is enabled per gitops', async ({ request }) => {
    const res = await request.get('/api/latest/fleet/config');
    await expect(res).toBeOK();
    const body = await res.json();
    expect(body.mdm.windows_enabled_and_configured).toBe(gitopsConfig.windowsMdmEnabled);
  });

  test('feature flags match gitops', async ({ request }) => {
    const res = await request.get('/api/latest/fleet/config');
    await expect(res).toBeOK();
    const body = await res.json();
    expect(body.features.enable_software_inventory).toBe(gitopsConfig.enableSoftwareInventory);
    expect(body.features.enable_host_users).toBe(gitopsConfig.enableHostUsers);
  });
});
