/**
 * Free • Hosts • The IdP username is a Premium feature.
 *
 * The host details **User** card and its *Add user* button render on free as on
 * premium: the button is gated by role, not tier (`HostDetailsPage.tsx` →
 * `canWriteEndUser`). What's gated by tier is the modal behind it, which shows
 * the Fleet Premium message in place of the *Username (IdP)* field
 * (`UpdateEndUserModal.tsx`). The API refuses the write too — that's
 * `tests/api/free/license.spec.ts`.
 *
 * Read-only: nothing is saved, so any host would do; a simulation keeps it off
 * the real VMs, which on free sit in Unassigned.
 */
import { test, expect } from '@fixtures';
import { findSimulations } from '@helpers/api';

test.describe('Free • Hosts • IdP username', () => {
  test('Add user opens the Fleet Premium message instead of the IdP field', async ({
    hostDetails,
    request,
  }) => {
    const [hostId] = await findSimulations(request, 'windows', 1, 0);
    expect(hostId, 'expected an online simulated Windows host').toBeDefined();

    await hostDetails.goto(hostId);
    await expect(hostDetails.userCardData.value('Username (IdP)')).toHaveText('---');
    await expect(hostDetails.updateEndUserButton).toHaveText('Add user');

    await hostDetails.updateEndUserButton.click();
    await expect(hostDetails.endUserModal.title('Add user')).toBeVisible();
    await expect(hostDetails.endUserModal.premiumMessage).toBeVisible();
    await expect(hostDetails.endUserModal.usernameInput).toHaveCount(0);
    await expect(hostDetails.endUserModal.saveButton).toHaveCount(0);
  });
});
