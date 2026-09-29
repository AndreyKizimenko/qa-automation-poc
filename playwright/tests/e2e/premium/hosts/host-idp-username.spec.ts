/**
 * Premium • Hosts • A host's IdP username, set and removed by an admin.
 *
 * The host details **User** card's *Add user* / *Edit user* button opens a
 * one-field modal, *Username (IdP)*. Saving a value stores it as the host's IdP
 * username (`PUT /hosts/:id/device_mapping`, `source: "idp"`); saving an empty
 * field removes it (`DELETE /hosts/:id/device_mapping/idp`). Both record an
 * `edited_host_idp_data` activity. The API half does the same through the
 * endpoints directly, and checks the card follows.
 *
 * **What this can't assert.** When the username matches a user Fleet has from
 * the IdP over SCIM, the card also fills *Full name*, *Groups* and *Department*.
 * The premium QA instance has never received a SCIM request
 * (`GET /scim/details` → `last_request: null`), so those stay empty here; QA
 * Wolf's flows asserted them against their own Okta tenant.
 *
 * **Hosts: simulations.** The IdP username is data Fleet stores about the host;
 * the host itself isn't involved, so a simulation answers as well as a real VM
 * and no VM's end-user mapping is ever touched. Each test takes its own host
 * from `findSimulations` (Windows 0–1, registered in `helpers/api/hosts.ts`),
 * and removes what it set in a `finally`.
 *
 * Only admins and maintainers may write the end user
 * (`HostDetailsPage.tsx` → `canWriteEndUser`); the observer case is the
 * negative, on a host it only reads.
 */
import { test, expect } from '@fixtures';
import { withStaticUser } from '@helpers/auth';
import {
  assertActivityAfter,
  deleteHostIdpUsername,
  findSimulations,
  getHostIdpUsername,
  latestActivityId,
  putHostIdpUsername,
} from '@helpers/api';
import { HostDetailsPage } from '@pages';

/** What an empty DataSet value renders. */
const EMPTY = '---';

const username = (tag: string) => `pw-idp-${tag}-${Date.now()}@example.com`;

test.describe('Premium • Hosts • IdP username', () => {
  test('an admin adds an IdP username on the User card, then removes it', async ({
    hostDetails,
    request,
  }) => {
    const [hostId] = await findSimulations(request, 'windows', 1, 0);
    expect(hostId, 'expected an online simulated Windows host').toBeDefined();
    const idpUsername = username('ui');

    try {
      await deleteHostIdpUsername(request, hostId, { ignoreMissing: true });
      const before = await latestActivityId(request);
      await hostDetails.goto(hostId);

      await expect(hostDetails.userCardData.value('Username (IdP)')).toHaveText(EMPTY);
      await expect(hostDetails.updateEndUserButton).toHaveText('Add user');
      await hostDetails.updateEndUserButton.click();
      await expect(hostDetails.endUserModal.title('Add user')).toBeVisible();
      // Save stays disabled until there's something to save.
      await expect(hostDetails.endUserModal.saveButton).toBeDisabled();
      await hostDetails.endUserModal.saveUsername(idpUsername);

      await hostDetails.toast.expectSuccess('Updated end user.');
      await expect(hostDetails.userCardData.value('Username (IdP)')).toHaveText(idpUsername);
      await expect(hostDetails.updateEndUserButton).toHaveText('Edit user');
      expect(await getHostIdpUsername(request, hostId)).toBe(idpUsername);
      await assertActivityAfter(
        request,
        'edited_host_idp_data',
        before,
        (d) => d.host_id === hostId && d.host_idp_username === idpUsername,
        { actor: process.env.FLEET_ADMIN_EMAIL },
      );

      // Edit user opens on the current value; clearing it removes the user.
      await hostDetails.updateEndUserButton.click();
      await expect(hostDetails.endUserModal.title('Edit user')).toBeVisible();
      await expect(hostDetails.endUserModal.usernameInput).toHaveValue(idpUsername);
      await hostDetails.endUserModal.saveUsername('');

      await hostDetails.toast.expectSuccess('Removed end user.');
      await expect(hostDetails.userCardData.value('Username (IdP)')).toHaveText(EMPTY);
      await expect(hostDetails.updateEndUserButton).toHaveText('Add user');
      expect(await getHostIdpUsername(request, hostId)).toBeNull();
      // The same host gets this removal every run, so only a newer one counts.
      await assertActivityAfter(
        request,
        'edited_host_idp_data',
        before,
        (d) => d.host_id === hostId && d.host_idp_username === '',
        { actor: process.env.FLEET_ADMIN_EMAIL },
      );
    } finally {
      await deleteHostIdpUsername(request, hostId, { ignoreMissing: true });
    }
  });

  test('the device_mapping API sets and removes the IdP username', async ({ hostDetails, request }) => {
    const [hostId] = await findSimulations(request, 'windows', 1, 1);
    expect(hostId, 'expected an online simulated Windows host').toBeDefined();
    const idpUsername = username('api');

    try {
      await deleteHostIdpUsername(request, hostId, { ignoreMissing: true });

      const put = await putHostIdpUsername(request, hostId, idpUsername);
      await expect(put).toBeOK();
      const body = await put.json();
      expect(body.host_id).toBe(hostId);
      // Fleet reports the IdP username under the `mdm_idp_accounts` source.
      expect(body.device_mapping).toContainEqual({ email: idpUsername, source: 'mdm_idp_accounts' });

      await hostDetails.goto(hostId);
      await expect(hostDetails.userCardData.value('Username (IdP)')).toHaveText(idpUsername);

      await deleteHostIdpUsername(request, hostId);
      expect(await getHostIdpUsername(request, hostId)).toBeNull();
      // Nothing left to remove: Fleet refuses a second delete.
      const again = await deleteHostIdpUsername(request, hostId, { ignoreMissing: true });
      expect(again.status()).toBe(422);

      await hostDetails.goto(hostId);
      await expect(hostDetails.userCardData.value('Username (IdP)')).toHaveText(EMPTY);
    } finally {
      await deleteHostIdpUsername(request, hostId, { ignoreMissing: true });
    }
  });

  test('a global observer is not offered Add user', async ({ browser, request }) => {
    const [hostId] = await findSimulations(request, 'windows', 1, 0);
    expect(hostId, 'expected an online simulated Windows host').toBeDefined();

    await withStaticUser(browser, 'global-observer', async (page) => {
      const hostDetails = new HostDetailsPage(page);
      await hostDetails.goto(hostId);
      // The card itself renders for the observer, so the button's absence is the gate.
      await expect(hostDetails.userCardData.value('Username (IdP)')).toBeVisible();
      await expect(hostDetails.updateEndUserButton).toHaveCount(0);
    });
  });
});
