/**
 * Premium • Software • Edit custom package (Unassigned).
 *
 * Round-trips the Self-service setting on a custom package: upload → open the
 * Edit-software modal from the Library accordion row → flip the Self-service
 * slider → Save → confirm the "Save changes?" dialog → verify it persisted via
 * the API → delete. On premium a custom package is a multi-package title, so
 * the edit modal is titled "Edit package" and opens from the accordion row (not
 * the summary Actions dropdown). Enabling self-service reveals the categories
 * field, so Fleet treats it as a material change and shows the confirmation.
 *
 * Scope: Unassigned only. The add/delete lifecycle across scopes and package
 * kinds is covered by library.spec; the concern unique to this spec is the
 * in-UI edit round-trip, which is scope-agnostic. Premium-only — the Add
 * software paths are paywalled on free.
 *
 * Fixture: sublime-text (.deb) — the one custom-package fixture library.spec
 * does not upload, so its title ("Sublime Text") cannot collide with a
 * parallel library.spec worker on the same Unassigned scope.
 */
import * as path from 'path';
import { test, expect } from '@fixtures';
import { assertActivity, getSoftwarePackage } from '@helpers/api';
import { activityCopy } from '@helpers/activity-copy';

const SCOPE = 'Unassigned' as const;
const FLEET_ID = 0;
const FIXTURE = 'linux/software/sublime-text_build-4200_amd64.deb';

test.describe('Software edit — custom package self-service (Unassigned)', () => {
  test.describe.configure({ mode: 'serial' });

  let titleId: number;
  let titleName: string;
  // Installer filename — Fleet's activity `software_package` detail, which the
  // dashboard feed renders (not the human-readable title).
  let packageName: string;

  test('add', async ({
    dashboard,
    softwareTitles,
    softwareCustomPackage,
    softwareTitleDetail,
    request,
  }) => {
    // Server-side installer processing plus the activity read can edge past the
    // 60s default under worker load; matches library.spec's headroom.
    test.setTimeout(90_000);

    await dashboard.goto();
    await dashboard.navbar.goToSoftware();
    await softwareTitles.teamDropdown.select(SCOPE);
    await softwareTitles.clickAddSoftware();

    await softwareCustomPackage.openTab();
    const fixturePath = path.resolve(__dirname, '../../../../test-data', FIXTURE);
    titleId = await softwareCustomPackage.uploadPackage(fixturePath);

    await expect(softwareTitleDetail.installerCard.card).toBeVisible();
    titleName = await softwareTitleDetail.displayName();
    expect(titleName.length).toBeGreaterThan(0);

    const activity = await assertActivity(
      request,
      'added_software',
      (d) => d.software_title === titleName,
    );
    packageName = (activity.details as { software_package?: string }).software_package ?? '';
    expect(packageName.length).toBeGreaterThan(0);
  });

  test('edit — enabling Self-service persists', async ({ softwareTitleDetail, request }) => {
    await softwareTitleDetail.goto({ titleId, fleetId: FLEET_ID });
    await expect(softwareTitleDetail.installerCard.card).toBeVisible();

    await softwareTitleDetail.installerCard.openEdit();
    await softwareTitleDetail.editSoftwareModal.expectOpen();
    expect(await softwareTitleDetail.editSoftwareModal.isSelfServiceOn()).toBe(false);

    await softwareTitleDetail.editSoftwareModal.toggleSelfService();
    await softwareTitleDetail.editSoftwareModal.save();

    // Verify persistence via the API — a reopened modal renders stale config.
    const pkg = await getSoftwarePackage(request, FLEET_ID, titleId);
    expect(pkg?.selfService).toBe(true);
  });

  test('delete', async ({ softwareTitleDetail, request }) => {
    await softwareTitleDetail.goto({ titleId, fleetId: FLEET_ID });
    await softwareTitleDetail.installerCard.delete();
    await assertActivity(request, 'deleted_software', (d) => d.software_title === titleName);
  });

  test('activity feed shows add → edit → delete', async ({ dashboard }) => {
    await dashboard.goto();
    await dashboard.expectActivities([
      activityCopy.software.added({ packageName, scope: SCOPE }),
      activityCopy.software.edited({ packageName, scope: SCOPE }),
      activityCopy.software.deleted({ packageName, scope: SCOPE }),
    ]);
  });
});
