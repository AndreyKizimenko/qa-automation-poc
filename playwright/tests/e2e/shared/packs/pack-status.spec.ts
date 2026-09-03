/**
 * Enabling and disabling a pack from the packs list. Tier-agnostic: same flow
 * runs on free and premium, no team scope. Each step is its own serial
 * sub-test so a per-step failure pinpoints which action regressed.
 *
 * A disabled pack stops being served to hosts in their osquery config, so
 * this is the switch that decides whether a pack runs at all — the execution
 * side of that contract lives in tests/api/packs-execution.spec.ts.
 *
 * Enable / disable emit no activity of their own (Fleet records
 * created_pack / edited_pack / deleted_pack only), so there is no closing
 * activity-feed sub-test.
 */
import { test, expect } from '@fixtures';
import { createPack, deletePack, setPackDisabled, withApiRequest } from '@helpers/api';

test.describe('Packs status', () => {
  test.describe.configure({ mode: 'serial' });

  const packName = `Status Pack ${Date.now()}`;
  let packId: number;

  // The pack is a precondition, not the behaviour under test — creating one
  // through the UI is packs.spec.ts's job. Seeding it over the API keeps each
  // sub-test below on the enable/disable flow alone.
  test.beforeAll(async () => {
    const pack = await withApiRequest((request) =>
      createPack(request, { name: packName, description: 'Enable/disable coverage' }),
    );
    packId = pack.id;
  });

  // The pack outlives every sub-test in the block, so it is torn down here
  // rather than inside one of them.
  test.afterAll(async () => {
    await withApiRequest((request) => deletePack(request, packId));
  });

  test('new pack is enabled', async ({ packsList }) => {
    // Packs has no top-nav entry; the list at /packs/manage is the way in.
    await packsList.goto();
    const status = await packsList.statusCell(packName);
    await expect(status).toHaveText('Enabled');
  });

  test('disable pack', async ({ packsList }) => {
    await packsList.goto();
    await packsList.setEnabled(packName, false);

    // The post-action table already holds server data — the page refetches
    // after the update — so this reload is checking that the status renders
    // correctly on a cold mount, not that the write persisted.
    await packsList.goto();
    const status = await packsList.statusCell(packName);
    await expect(status).toHaveText('Disabled');
  });

  test('enable pack', async ({ packsList, request }) => {
    // Put the pack in the state this test acts on. Without it the sub-test
    // reads as passing when run alone — the seeded pack is already enabled, so
    // enabling it again would assert the state it started in.
    await setPackDisabled(request, packId, true);

    await packsList.goto();
    await packsList.setEnabled(packName, true);

    await packsList.goto();
    const status = await packsList.statusCell(packName);
    await expect(status).toHaveText('Enabled');
  });
});
