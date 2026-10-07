/**
 * Free • Policies • what each role is shown — the free half of
 * `premium/policies/role-access.spec.ts` (round 1 C3 #5, #20), for the two
 * non-admin roles free has. Free has no fleets, so there's no picker, no
 * inherited row and nothing team-scoped: the list holds the global policies.
 *
 *   - global maintainer: Add policy, a row checkbox and an Automations cell that
 *     opens its modal, but not Manage automations (a global admin's); the
 *     details page offers Run policy and Edit policy.
 *   - global observer: none of those, Run policy included; `/policies/new` is
 *     the 403 page.
 *
 * Grounded in `ManagePoliciesPage` / `PoliciesTableConfig`, `PolicyDetailsPage`
 * and the router's `AuthAnyMaintainerAnyAdminRoutes`. Every absence is anchored
 * on the seeded row, its Automations cell or the details page's Show query.
 * The policy is this spec's, made through the API and deleted in an
 * `afterEach`.
 */
import { test, expect } from '@fixtures';
import { withStaticUser } from '@helpers/auth';
import { createPolicy, deletePolicies, type StaticUserKey } from '@helpers/api';
import { runNonce } from '@helpers/profiles';
import { AccessDenied, PoliciesListPage, PolicyDetailsPage } from '@pages';

interface RoleCase {
  key: StaticUserKey;
  /** Add policy, row checkboxes, an Automations cell that opens its modal, Edit and Run. */
  author: boolean;
}

const ROLES: RoleCase[] = [
  { key: 'global-maintainer', author: true },
  { key: 'global-observer', author: false },
];

let policyId: number | undefined;

test.afterEach(async ({ request }) => {
  if (policyId !== undefined) await deletePolicies(request, [policyId]);
  policyId = undefined;
});

test.describe('Free • Policies • role access', () => {
  for (const role of ROLES) {
    test(`${role.key} is shown the policy controls its role grants`, async ({ browser, request }) => {
      const name = `pw-role-pol-${role.key}-${runNonce()}`;
      ({ id: policyId } = await createPolicy(request, { name }));

      await withStaticUser(browser, role.key, async (page) => {
        const list = new PoliciesListPage(page);
        await list.goto();

        const row = await list.narrowTo(name);
        const automations = await list.table.cellByColumn(row, 'Automations');
        await expect(automations).toBeVisible();
        await expect(row.getByRole('checkbox')).toHaveCount(role.author ? 1 : 0);
        await expect(automations.getByRole('button')).toHaveCount(role.author ? 1 : 0);
        await expect(list.addPolicyButton).toHaveCount(role.author ? 1 : 0);
        await expect(list.manageAutomationsButton).toHaveCount(0);

        const details = new PolicyDetailsPage(page);
        await list.openPolicy(name);
        await expect(details.nameHeading).toContainText(name);
        await expect(details.showQueryButton).toBeVisible();
        await expect(details.runButton).toHaveCount(role.author ? 1 : 0);
        await expect(details.editButton).toHaveCount(role.author ? 1 : 0);

        if (!role.author) await new AccessDenied(page).expectAt('/policies/new');
      });
    });
  }
});
