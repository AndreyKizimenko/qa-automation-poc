/**
 * Enabling and disabling a pack from the packs list. Tier-agnostic: packs
 * carry no team scope, so the same flow runs on free and premium.
 *
 * A disabled pack stops being served to hosts in their osquery config, so
 * this is the switch that decides whether a pack runs at all — the execution
 * side of that contract lives in tests/api/packs-execution.spec.ts.
 */
import { test, expect } from '@fixtures';
import { createPack, deletePack, withApiRequest } from '@helpers/api';

test.describe('Packs status', () => {
  test.describe.configure({ mode: 'serial' });

  const packName = `Status Pack ${Date.now()}`;
  let packId: number;

  test.beforeAll(async () => {
    const pack = await withApiRequest((request) =>
      createPack(request, { name: packName, description: 'Enable/disable coverage' }),
    );
    packId = pack.id;
  });

  test.afterAll(async () => {
    await withApiRequest((request) => deletePack(request, packId));
  });

  test('new pack is enabled', async ({ packsList }) => {
    await packsList.goto();
    await expect(await packsList.statusCell(packName)).toHaveText('Enabled');
  });

  test('disable pack', async ({ packsList }) => {
    await packsList.goto();
    await packsList.setEnabled(packName, false);

    await packsList.goto();
    await expect(await packsList.statusCell(packName)).toHaveText('Disabled');
  });

  test('enable pack', async ({ packsList }) => {
    await packsList.goto();
    await packsList.setEnabled(packName, true);

    await packsList.goto();
    await expect(await packsList.statusCell(packName)).toHaveText('Enabled');
  });
});
