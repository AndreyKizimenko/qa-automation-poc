/**
 * Premium • Software • role access. What each non-admin role sees on the
 * Software area: which fleets the scope picker offers them, that the inventory
 * table renders its full column set regardless of role, and which write
 * affordance ("Add software") their role earns.
 *
 * One spec with role as a dimension replaces four near-identical source flows,
 * and the columns are a **named list** rather than positional indexes — the
 * originals asserted `nth(0)`, `nth(1)`, `nth(2)`, `nth(4)` and skipped index 3
 * without explanation, so inserting a column would have silently re-pointed
 * every assertion.
 *
 * Each role's scope is chosen for what it can prove:
 *   - the two global roles sweep every fleet from the "All fleets" aggregate,
 *     which is also where the table has data;
 *   - `team-admin` administers two fleets, so its picker is the one that shows
 *     a *subset* — no "All fleets" entry — and it defaults into VMs, the fleet
 *     with hosts;
 *   - `ws-maintainer` / `ws-observer` belong to one fleet each, where Fleet
 *     drops the picker entirely and renders the fleet name as the page title.
 *     Workstations holds no hosts, so what their inventory lists is whatever
 *     the library specs have added to that fleet at that moment — the table
 *     shell is asserted there, not its contents.
 *
 * The "Automations" button is deliberately not asserted here; its full
 * role × scope matrix lives in `manage-automations-access.spec.ts`.
 *
 * Each static human logs into a fresh context via `withStaticUser` so the
 * shared admin storage state is left untouched.
 */
import { test, expect } from '@fixtures';
import { withStaticUser } from '@helpers/auth';
import type { StaticUserKey } from '@helpers/api';
import { SoftwareTitlesPage } from '@pages';

const COLUMNS = ['Name', 'Version', 'Type', 'Vulnerabilities', 'Hosts'];

/**
 * What the scope picker must offer. A global role's picker lists every fleet on
 * the instance, which gitops can grow — so it is asserted by the entries the
 * suite guarantees, never as an exact list. A fleet-scoped role's picker is a
 * property of that static user's own assignment, so there `exact` is right.
 */
interface FleetOptions {
  exact?: string[];
  includes?: string[];
}

interface RoleCase {
  key: StaticUserKey;
  /** Fleet to assert against; omitted when the role has no picker. */
  scope?: string;
  /** What the picker offers, or null when no picker renders. */
  fleetOptions: FleetOptions | null;
  /**
   * Whether `scope` is guaranteed to hold software. Only the scopes backed by
   * the simulated host pool are — Workstations has no hosts, and whether it
   * lists anything at all depends on what the library specs have added at that
   * moment, so the single-fleet roles assert the table shell instead of a
   * column list.
   */
  assertColumns: boolean;
  canAddSoftware: boolean;
}

const GLOBAL_OPTIONS: FleetOptions = {
  includes: ['All fleets', 'Workstations', 'VMs', 'Unassigned'],
};

const ROLES: RoleCase[] = [
  {
    key: 'global-maintainer',
    scope: 'All fleets',
    fleetOptions: GLOBAL_OPTIONS,
    assertColumns: true,
    canAddSoftware: true,
  },
  {
    key: 'global-observer',
    scope: 'All fleets',
    fleetOptions: GLOBAL_OPTIONS,
    assertColumns: true,
    canAddSoftware: false,
  },
  {
    key: 'team-admin',
    scope: 'VMs',
    // Admin of exactly these two fleets, and no aggregate entry — the whole
    // point of the case.
    fleetOptions: { exact: ['VMs', 'Workstations'] },
    assertColumns: true,
    canAddSoftware: true,
  },
  {
    key: 'ws-maintainer',
    fleetOptions: null,
    assertColumns: false,
    canAddSoftware: true,
  },
  {
    key: 'ws-observer',
    fleetOptions: null,
    assertColumns: false,
    canAddSoftware: false,
  },
];

test.describe('Premium • Software • role access', () => {
  for (const role of ROLES) {
    test(`${role.key} sees the software inventory scoped to their fleets`, async ({ browser }) => {
      await withStaticUser(browser, role.key, async (page) => {
        const software = new SoftwareTitlesPage(page);
        await software.goto();

        if (role.fleetOptions === null) {
          // A user with exactly one fleet gets no picker — the fleet's name
          // becomes the page title instead.
          await expect(software.teamDropdown.trigger).toHaveCount(0);
          await expect(
            page.getByRole('heading', { name: 'Workstations', level: 1 }),
          ).toBeVisible();
        } else {
          await software.teamDropdown.trigger.click();
          const options = await software.teamDropdown.options.allInnerTexts();
          if (role.fleetOptions.exact) {
            expect(options).toEqual(role.fleetOptions.exact);
          }
          for (const entry of role.fleetOptions.includes ?? []) {
            expect(options).toContain(entry);
          }
          await page.keyboard.press('Escape');
          await software.teamDropdown.selectByLabel(role.scope!);
        }

        await expect(software.search).toBeVisible();
        await expect(software.filter.openButton).toBeVisible();

        if (role.assertColumns) {
          expect(await software.columnHeaders()).toEqual(COLUMNS);
        } else {
          await expect(software.table.rowOrEmpty()).toBeVisible();
        }

        if (role.canAddSoftware) {
          await expect(software.addSoftwareButton).toBeVisible();
        } else {
          await expect(software.addSoftwareButton).toHaveCount(0);
        }
      });
    });
  }
});
