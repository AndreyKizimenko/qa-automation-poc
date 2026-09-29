/**
 * Premium • Settings • What a team admin may do to their own fleet.
 *
 * `team-admin@fleetdm.com` is admin on Workstations and VMs. From the fleet's
 * **Users** tab (user menu → *Users*) a team admin creates a member, edits
 * their name and fleet role, and removes them from the fleet; every step is
 * read back through the API. From the fleet header they may rename the fleet
 * but not delete it.
 *
 * **The rename is never saved.** Workstations and VMs are declared by name in
 * gitops: a renamed fleet isn't healed by the next apply, which creates a new,
 * empty fleet under the declared name and orphans the renamed one with its
 * hosts. And while renamed, every worker resolving `workstationsFleetId` by
 * name, and every spec choosing "Workstations" in a fleet dropdown, would fail.
 * So the UI half opens the modal and cancels, and the permission is proved
 * through the API with a rename Fleet rejects after authorizing it: an empty
 * name is a 422 to a caller allowed to rename the fleet and a 403 to one who
 * isn't (`ModifyTeam` authorizes before it validates), and changes nothing
 * either way. The call carries the team admin's own session token
 * (`sessionBearerHeaders`), so no extra API user is needed.
 *
 * The member is created by the team admin with a `qa-test-*` address, so the
 * cleanup project's user sweep removes it if this test dies before its
 * `finally`. QA Wolf's flow also signed in as the member to see the promoted
 * role at work; that's a forced password reset and two more logins against
 * Fleet's shared 10-per-minute login limit, to prove what the API read of the
 * member's fleet role already says.
 */
import { test, expect } from '@fixtures';
import { sessionBearerHeaders, withStaticUser } from '@helpers/auth';
import {
  apiUrl,
  deleteUser,
  findUserByEmail,
  qaTestEmail,
  qaTestPassword,
  type UserRef,
} from '@helpers/api';
import { DashboardPage, FleetUsersPage } from '@pages';

/** The user's fleet roles as `{ id, role }`, whichever key this Fleet version uses. */
function fleetRoles(user: UserRef | null): { id: number; role: string }[] {
  return (user?.fleets ?? user?.teams ?? []).map(({ id, role }) => ({ id, role }));
}

test.describe('Premium • Settings • team admin scope', () => {
  test('a team admin creates a member, edits their name and role, then removes them', async ({
    browser,
    request,
    workstationsFleetId,
  }) => {
    const email = qaTestEmail('member');
    const name = `QA Fleet Member ${Date.now()}`;
    const editedName = `${name} - Edited`;

    try {
      await withStaticUser(browser, 'team-admin', async (page) => {
        const dashboard = new DashboardPage(page);
        const fleetUsers = new FleetUsersPage(page);

        await dashboard.goto();
        await dashboard.teamDropdown.select('Workstations');
        await dashboard.navbar.openUserMenu();
        await dashboard.navbar.usersItem.click();
        await expect(page).toHaveURL(new RegExp(`/settings/fleets/users\\?fleet_id=${workstationsFleetId}\\b`));

        // Create: a team admin's Add user is the create form, defaulting to Observer.
        await fleetUsers.addUserButton.click();
        await expect(fleetUsers.createModal).toBeVisible();
        await fleetUsers.form.fullName.fill(name);
        await fleetUsers.form.email.fill(email);
        await fleetUsers.form.password.fill(qaTestPassword());
        await fleetUsers.createSubmitButton.click();
        await fleetUsers.toast.expectSuccess(`Successfully created ${name}.`);
        await expect(fleetUsers.createModal).toBeHidden();

        let row = await fleetUsers.findRowByEmail(email);
        await expect(row).toContainText(name);
        await expect(row).toContainText('Observer');
        let member = await findUserByEmail(request, email);
        expect(member?.global_role ?? null).toBeNull();
        expect(fleetRoles(member)).toEqual([{ id: workstationsFleetId, role: 'observer' }]);

        // Edit: rename the member and promote them to the fleet's admin.
        await fleetUsers.runRowAction(row, 'Edit');
        await expect(fleetUsers.editModal).toBeVisible();
        await expect(fleetUsers.form.fullName).toHaveValue(name);
        await fleetUsers.form.fullName.fill(editedName);
        await fleetUsers.selectTeamRole(fleetUsers.editModal, 'Admin');
        await fleetUsers.editSaveButton.click();
        // Fleet names the user as they were before the edit.
        await fleetUsers.toast.expectSuccess(`Successfully edited ${name}.`);
        await expect(fleetUsers.editModal).toBeHidden();

        row = await fleetUsers.findRowByEmail(email);
        await expect(row).toContainText(editedName);
        await expect(row).toContainText('Admin');
        member = await findUserByEmail(request, email);
        expect(member?.name).toBe(editedName);
        expect(fleetRoles(member)).toEqual([{ id: workstationsFleetId, role: 'admin' }]);

        // Remove: off the fleet, but the user itself survives.
        await fleetUsers.runRowAction(row, 'Remove');
        await expect(fleetUsers.removeModal).toBeVisible();
        await fleetUsers.removeConfirmButton.click();
        await fleetUsers.toast.expectSuccess(`Successfully removed ${editedName}`);
        await expect(fleetUsers.removeModal).toBeHidden();

        await fleetUsers.search.fill(email);
        await expect(fleetUsers.rowByEmail(email)).toHaveCount(0);
        member = await findUserByEmail(request, email);
        expect(member, 'removing a member from a fleet should not delete the user').not.toBeNull();
        expect(fleetRoles(member)).toEqual([]);
      });
    } finally {
      const member = await findUserByEmail(request, email);
      if (member) await deleteUser(request, member.id, { ignoreMissing: true });
    }
  });

  test('a team admin may rename their fleet but not delete it', async ({
    browser,
    workstationsFleetId,
    qaFleetId,
  }) => {
    await withStaticUser(browser, 'team-admin', async (page) => {
      const fleetUsers = new FleetUsersPage(page);
      await fleetUsers.goto(workstationsFleetId);

      // Delete is withheld from everyone but global admins; its absence beside
      // a rendered Rename is the role gate, not an unrendered header.
      await expect(fleetUsers.renameFleetButton).toBeVisible();
      await expect(fleetUsers.deleteFleetButton).toHaveCount(0);

      await fleetUsers.renameFleetButton.click();
      await expect(fleetUsers.renameInput).toHaveValue('Workstations');
      await fleetUsers.renameCancelButton.click();
      await expect(fleetUsers.renameModal).toBeHidden();

      // Allowed on their own fleet (422: the empty name, refused after the
      // permission check), denied on one they don't administer (403). There's
      // no matching DELETE probe for "may not delete": Fleet has no delete it
      // refuses after authorizing, so if the gate ever regressed, the probe
      // would delete Workstations.
      const headers = await sessionBearerHeaders(page);
      const own = await page.request.patch(apiUrl(`fleets/${workstationsFleetId}`), { headers, data: { name: '' } });
      expect(own.status()).toBe(422);
      const other = await page.request.patch(apiUrl(`fleets/${qaFleetId}`), { headers, data: { name: '' } });
      expect(other.status()).toBe(403);
    });
  });
});
