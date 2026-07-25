/**
 * Premium • Settings • Organization info. Editing the org name + support URL
 * persists across a reload. This mutates GLOBAL app config, so the original
 * org_info is snapshotted via the API up front and restored in afterEach
 * (which runs even if the test body fails).
 *
 * Grounded in frontend/pages/admin/OrgSettingsPage/cards/Info.
 */
import { test, expect } from '@fixtures';
import { getAppConfig, patchAppConfig, type OrgInfo } from '@helpers/api';

test.describe('Premium • Settings • Organization info', () => {
  let original: OrgInfo;

  test.beforeEach(async ({ request }) => {
    original = (await getAppConfig(request)).org_info ?? {};
  });

  test.afterEach(async ({ request }) => {
    await patchAppConfig(request, {
      org_info: {
        org_name: original.org_name,
        contact_url: original.contact_url ?? '',
      },
    });
  });

  test('org name and support URL persist across reload', async ({ organizationInfo }) => {
    const newName = `PW Org ${Date.now()}`;
    const newUrl = 'https://example.com/pw-support';

    await organizationInfo.goto();
    await organizationInfo.setOrgName(newName);
    await organizationInfo.setSupportUrl(newUrl);
    await organizationInfo.save();

    await organizationInfo.goto();
    await expect(organizationInfo.orgNameInput).toHaveValue(newName);
    await expect(organizationInfo.supportUrlInput).toHaveValue(newUrl);
  });
});
