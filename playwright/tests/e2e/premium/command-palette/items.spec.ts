/**
 * Premium • Command palette • items.
 *
 * cmdk keys every row on its `value`, and two rows sharing a value collide —
 * one of them silently disappears, with no error anywhere. Fleet defends
 * against that by folding each item's id into the value it hands cmdk, so the
 * guard is only observable through a label that genuinely exists twice.
 *
 * "Users" is that label: it is both the Settings page and a Setup experience
 * sub-item. Both are premium, and Setup experience only renders inside a fleet,
 * so the collision is reachable from nowhere but a fleet-scoped premium
 * session.
 */
import { test, expect } from '@fixtures';

test.describe('Premium • Command palette • items', () => {
  test('rows sharing a label both render', async ({
    palette,
    reportsList,
    workstationsFleetId,
  }) => {
    // The Controls group — Setup experience included — needs a specific fleet;
    // on All fleets it isn't rendered at all. The reports list renders whether
    // or not the fleet holds any reports, which the cleanup projects decide.
    await reportsList.goto({ fleetId: workstationsFleetId });
    await reportsList.teamDropdown.select('Workstations');

    await palette.open();
    await palette.search('users');

    // Both rows are an exact label match, so both get promoted into Best match:
    // the Settings page under its bare label, the sub-item with its parent's
    // label as a trailing context chip.
    const settingsUsers = palette.item('Users', { exact: true });
    const setupExperienceUsers = palette.item('Users Setup experience');

    await expect(settingsUsers).toBeVisible();
    await expect(setupExperienceUsers).toBeVisible();
    // Matched on the label alone, the two rows are exactly what a value
    // collision would have collapsed into one.
    await expect(palette.item('Users')).toHaveCount(2);

    // The parent keeps its own row in the Controls group, so the row above is
    // the promoted sub-item rather than a child of an expanded parent.
    await expect(
      palette.group('Controls').getByRole('option', { name: 'Setup experience', exact: true }),
    ).toBeVisible();
  });
});
