/**
 * Premium • Command palette • deep links.
 *
 * `Add hosts` is a two-part link: it carries the fleet the user is working in
 * *and* the flag that opens the modal. The destination consumes the flag, then
 * rewrites its own query string to drop it — so what matters is what survives
 * that rewrite. Enroll secrets are per fleet, so a `fleet_id` lost on the way
 * through would enrol the user's hosts somewhere they didn't choose, with a
 * modal that looks exactly the same either way.
 *
 * Premium-only because the fleet is what's being carried: on All fleets the
 * link has no fleet param to preserve, which is the shared spec's case.
 */
import { test, expect } from '@fixtures';

test.describe('Premium • Command palette • deep links', () => {
  test('Add hosts from a fleet keeps the fleet after the modal param is stripped', async ({
    palette,
    reportsList,
    hostsList,
    page,
    workstationsFleetId,
  }) => {
    // Entering from a fleet-scoped page that isn't the destination makes the
    // jump a real navigation, so the fleet in the final URL can only have come
    // from the palette's own link. The reports list renders whether or not the
    // fleet holds any reports, which the cleanup projects decide.
    await reportsList.goto({ fleetId: workstationsFleetId });
    await reportsList.teamDropdown.select('Workstations');

    await palette.open();
    await palette.selectItem('Add hosts');

    await expect(hostsList.addHostsModal.modal).toBeVisible();
    await expect(page).toHaveURL(/\/hosts\/manage/);
    // The modal flag is consumed and written out of the URL, so a reload lands
    // on the plain list rather than reopening the modal.
    await expect(page).not.toHaveURL(/add_hosts/);
    // The fleet rides through that rewrite. Both halves are asserted because
    // the URL alone doesn't prove the page agreed with it.
    await expect(page).toHaveURL(new RegExp(`fleet_id=${workstationsFleetId}\\b`));
    await expect(hostsList.teamDropdown.currentValue).toHaveText('Workstations');
  });
});
