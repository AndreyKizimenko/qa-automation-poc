/**
 * Custom host vitals: the instance's vitals are exactly the declared ones.
 * They are global and declared only in `default.yml`; a config without the key
 * makes fleetctl delete every vital, so a no-team config that omits it is
 * verified as holding none.
 */
import { test, expect } from '@playwright/test';
import { gitopsConfig, gitopsLabel, getAll, expectExactNames } from './_config';

test.describe(`GitOps verify · custom host vitals · ${gitopsLabel}`, () => {
  test.skip(gitopsConfig.scope !== 'no-team', 'custom host vitals are global');

  test('the custom host vital set matches gitops exactly', async ({ request }) => {
    const live = await getAll<{ name: string }>(request, 'custom_host_vitals', 'custom_host_vitals');
    const declared = gitopsConfig.customHostVitals ?? [];
    expect(declared.length, 'custom_host_vitals declared').toBeGreaterThanOrEqual(0);
    expectExactNames(
      'custom host vitals',
      live.map((v) => v.name),
      declared,
    );
  });
});
