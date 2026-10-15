/**
 * Free • Command palette • deep links. `Add script` and `Add custom variable`
 * open a modal on their destination page through a one-shot flag
 * (`?add_script=1`, `?add_variable=1`) that the page consumes and then writes
 * out of its own URL — the same contract as the shared deep-link spec.
 *
 * They aren't in that shared spec because their availability differs by tier:
 * both rows need a fleet context, which free always has (one implicit fleet)
 * and premium only inside a specific fleet. The premium counterparts, entered
 * from Workstations, are in tests/e2e/premium/command-palette/deep-links.spec.ts.
 *
 * Neither test saves anything: the modal opening is the assertion, and the
 * test ends with it open.
 */
import { test, expect } from '@fixtures';

test.describe('Free • Command palette • deep links', () => {
  test('Add script opens the script library add modal and drops its flag', async ({
    palette,
    dashboard,
    scriptsLibrary,
    page,
  }) => {
    await dashboard.goto();
    await palette.open();
    await palette.selectItem('Add script');

    await expect(page).toHaveURL(/\/controls\/scripts\/library/);
    await expect(scriptsLibrary.uploadModal).toBeVisible();
    await expect(page).not.toHaveURL(/add_script=/);
  });

  test('Add custom variable opens the add variable modal and drops its flag', async ({
    palette,
    dashboard,
    variables,
    page,
  }) => {
    await dashboard.goto();
    await palette.open();
    await palette.selectItem('Add custom variable');

    // The bare Variables route redirects to its first section, carrying the
    // query along, so the flag is read on Global variables.
    await expect(page).toHaveURL(/\/controls\/variables\/global-variables/);
    await expect(variables.addModal).toBeVisible();
    await expect(page).not.toHaveURL(/add_variable=/);
  });
});
