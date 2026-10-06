/**
 * Premium • Hosts • CTA visibility by role.
 *
 * What each role is offered on the Hosts list (`ManageHostsPage`):
 *   - "Add hosts", and the "Hosts page settings" gear's Enroll secrets: global
 *     admin and maintainer, and a fleet's admin and maintainer on their fleet.
 *   - the gear's Activity automations: global and fleet admins.
 *   - "Add label", the "+" in the label filter's menu beside its "Filter labels
 *     by name..." box (`CustomLabelGroupHeading`): every global and fleet role
 *     but the observers — the technician included.
 *   - "Export hosts": everyone. It's disabled on a fleet with no hosts, so only
 *     its presence is asserted.
 * A role granted none of the gear's items gets no gear at all, so the gear
 * itself is what an observer or a technician is checked against.
 *
 * Global roles read the list on All fleets. Team flags follow the fleet in the
 * URL: the team admin reads VMs, the fleet it holds hosts in; the
 * Workstations-only roles read Workstations, which may be empty — Fleet then
 * disables the label filter, so their Add label is left to the Labels page
 * (`premium/labels/role-access.spec.ts`).
 *
 * The label menu is opened only once the table has settled (the Hosts page
 * rewrites its URL just after it loads, and the re-render can close a menu), and
 * an absent Add label is read between two checks that the menu's search box is
 * still showing. Enroll secrets is opened and closed, never saved: the admin's
 * add / copy / delete is `premium/settings/enroll-secrets.spec.ts`, and a second
 * writer of a fleet's secrets would race its snapshot restore.
 *
 * Each role logs into a fresh context via `withStaticUser`.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '@fixtures';
import { withStaticUser } from '@helpers/auth';
import type { StaticUserKey } from '@helpers/api';
import { HostsListPage } from '@pages';

interface RoleCase {
  key: StaticUserKey;
  title: string;
  /** The fleet a team role reads; a global role reads All fleets. */
  fleet?: 'VMs' | 'Workstations';
  /** A role on a single fleet gets no fleet picker. */
  singleFleet?: boolean;
  addHosts: boolean;
  /** The gear's items this role gets; empty means no gear. */
  gear: ('Enroll secrets' | 'Activity automations')[];
  /** Whether Add label is offered; null when the fleet may be empty and the filter disabled. */
  addLabel: boolean | null;
}

const ROLES: RoleCase[] = [
  {
    key: 'global-admin',
    title: 'global-admin sees Add hosts, Enroll secrets, and Export hosts',
    addHosts: true,
    gear: ['Enroll secrets', 'Activity automations'],
    addLabel: true,
  },
  {
    key: 'global-maintainer',
    title: 'global-maintainer sees Add hosts, Enroll secrets, and Export hosts',
    addHosts: true,
    gear: ['Enroll secrets'],
    addLabel: true,
  },
  {
    key: 'global-observer',
    title: 'global observer sees only Export hosts',
    addHosts: false,
    gear: [],
    addLabel: false,
  },
  {
    key: 'global-technician',
    title: 'global technician sees Export hosts and Add label, but not Add hosts or the gear',
    addHosts: false,
    gear: [],
    addLabel: true,
  },
  {
    key: 'team-admin',
    title: "team admin sees Add hosts, both gear items and Add label on its fleet",
    fleet: 'VMs',
    addHosts: true,
    gear: ['Enroll secrets', 'Activity automations'],
    addLabel: true,
  },
  {
    key: 'ws-maintainer',
    title: 'team maintainer sees Add hosts and Enroll secrets on its fleet',
    fleet: 'Workstations',
    singleFleet: true,
    addHosts: true,
    gear: ['Enroll secrets'],
    addLabel: null,
  },
  {
    key: 'ws-observer',
    title: 'team observer sees only Export hosts on its fleet',
    fleet: 'Workstations',
    singleFleet: true,
    addHosts: false,
    gear: [],
    addLabel: null,
  },
];

async function openList(
  page: Page,
  role: RoleCase,
  fleetIds: { workstationsFleetId: number; vmsFleetId: number },
): Promise<HostsListPage> {
  const hosts = new HostsListPage(page);
  if (!role.fleet) {
    await hosts.goto();
  } else {
    const fleetId = role.fleet === 'VMs' ? fleetIds.vmsFleetId : fleetIds.workstationsFleetId;
    await hosts.goto({ fleetId, mayBeEmpty: role.fleet === 'Workstations' });
    if (!role.singleFleet) await hosts.teamDropdown.selectByLabel(role.fleet);
  }
  return hosts;
}

test.describe('Premium • Hosts • CTA visibility by role', () => {
  for (const role of ROLES) {
    test(role.title, async ({ browser, workstationsFleetId, vmsFleetId }) => {
      await withStaticUser(browser, role.key, async (page) => {
        const hosts = await openList(page, role, { workstationsFleetId, vmsFleetId });

        await expect(hosts.exportHostsButton).toBeVisible();
        // An empty fleet's empty-state card repeats "Add hosts", so presence is
        // the header's (first) one showing, and absence is none at all.
        if (role.addHosts) await expect(hosts.addHostsButton.first()).toBeVisible();
        else await expect(hosts.addHostsButton).toHaveCount(0);

        if (role.gear.length === 0) {
          // No gear item for this role, so no gear: nothing to open and look inside.
          await expect(hosts.hostsPageSettingsButton).toHaveCount(0);
        } else {
          await hosts.hostsPageSettingsButton.click();
          await expect(hosts.enrollSecretsOption).toBeVisible();
          await expect(hosts.activityAutomationsOption).toHaveCount(
            role.gear.includes('Activity automations') ? 1 : 0,
          );
          await hosts.enrollSecretsOption.click();
          await expect(hosts.enrollSecrets.modal).toBeVisible();
          await hosts.enrollSecrets.close();
        }

        if (role.addLabel !== null) {
          await hosts.table.waitForSettled();
          await hosts.labelFilter.openMenu();
          await expect(hosts.labelFilter.addLabelButton).toHaveCount(role.addLabel ? 1 : 0);
          await expect(hosts.labelFilter.searchBox).toBeVisible();
        }
      });
    });
  }
});
