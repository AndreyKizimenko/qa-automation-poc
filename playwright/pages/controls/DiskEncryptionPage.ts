import { Page, Locator, expect } from '@playwright/test';
import { Toast } from '../components/Toast';
import { TeamDropdown } from '../components/TeamDropdown';
import { HostsListPage } from '../hosts/HostsListPage';

/** The platform tabs the disk-encryption page renders, in render order. */
export type DiskEncryptionPlatform = 'macos' | 'windows' | 'linux';

const TAB_NAMES: Record<DiskEncryptionPlatform, string> = {
  macos: 'macOS',
  windows: 'Windows',
  linux: 'Linux',
};

/** A host's disk-encryption status as Fleet's API names it (`os_settings_disk_encryption`). */
export type DiskEncryptionStatus =
  | 'verified'
  | 'verifying'
  | 'failed'
  | 'action_required'
  | 'enforcing'
  | 'removing_enforcement';

/** Each status's row in the status table, in the table's own fixed order (`DiskEncryptionTableConfig.tsx`). */
const STATUS_NAMES: Record<DiskEncryptionStatus, string> = {
  verified: 'Verified',
  verifying: 'Verifying',
  failed: 'Failed',
  action_required: 'Action required',
  enforcing: 'Enforcing',
  removing_enforcement: 'Removing enforcement',
};

/**
 * /controls/os-settings/disk-encryption — a tab per platform, each with its own
 * form and its own Save button. The bare path carries no platform, so Fleet
 * redirects it to the macOS tab; `goto()` therefore anchors on the resolved
 * per-platform URL rather than the one it asked for.
 *
 * Which controls a tab renders varies by platform: macOS has enforcement and
 * key escrow, Windows has enforcement and a BitLocker PIN toggle (itself
 * disabled until enforcement is on), and Linux has key escrow only. Each
 * checkbox is a Fleet `<Checkbox>` — a real `role="checkbox"` whose accessible
 * name is its visible label — so state reads off `toBeChecked()`.
 *
 * Below the form, once the tab's setting is on, a table counts the fleet's
 * hosts of that platform by status, and a click on a row lists them.
 */
export class DiskEncryptionPage {
  readonly page: Page;
  readonly toast: Toast;
  readonly teamDropdown: TeamDropdown;

  readonly heading: Locator;
  readonly enforceCheckbox: Locator;
  readonly escrowCheckbox: Locator;
  readonly bitlockerPinCheckbox: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.toast = new Toast(page);
    this.teamDropdown = new TeamDropdown(page);

    this.heading = page.getByRole('heading', { name: 'Disk encryption', level: 2 });
    this.enforceCheckbox = page.getByRole('checkbox', { name: 'Enable disk encryption' });
    // Anchored: Windows' enforcement checkbox ("Enable disk encryption (BitLocker)
    // and escrow recovery key") also contains the phrase.
    this.escrowCheckbox = page.getByRole('checkbox', { name: /^Escrow recovery key/ });
    this.bitlockerPinCheckbox = page.getByRole('checkbox', { name: 'Require BitLocker PIN' });
    // Only the selected tab's panel is mounted, so a single Save is unambiguous.
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });
  }

  tab(platform: DiskEncryptionPlatform): Locator {
    return this.page.getByRole('tab', { name: TAB_NAMES[platform] });
  }

  /**
   * `fleetId=0` targets "No fleet". Omit to use the current fleet. Landing on
   * the bare path lets Fleet pick the default tab, which is what a user sees
   * when they arrive from the OS settings sidebar.
   */
  async goto(opts: { fleetId?: number; platform?: DiskEncryptionPlatform } = {}): Promise<void> {
    const suffix = opts.platform ? `/${opts.platform}` : '';
    const qs = opts.fleetId !== undefined ? `?fleet_id=${opts.fleetId}` : '';
    await this.page.goto(`/controls/os-settings/disk-encryption${suffix}${qs}`);
    await expect(this.heading).toBeVisible();
    await this.expectPlatform(opts.platform ?? 'macos');
  }

  async selectPlatform(platform: DiskEncryptionPlatform): Promise<void> {
    await this.tab(platform).click();
    await this.expectPlatform(platform);
  }

  /** Waits for the platform's tab to own the selection and its URL to settle. */
  async expectPlatform(platform: DiskEncryptionPlatform): Promise<void> {
    await expect(this.page).toHaveURL(
      new RegExp(`/controls/os-settings/disk-encryption/${platform}\\b`),
    );
    await expect(this.tab(platform)).toHaveAttribute('aria-selected', 'true');
  }

  /**
   * The status table's row for one status. The table is rendered only while the
   * tab's setting is on, and then it lists all six statuses, a count of 0
   * included, each row named by its status cell ("Verified", not "Verifying").
   */
  statusRow(status: DiskEncryptionStatus): Locator {
    return this.page
      .getByRole('row')
      .filter({ has: this.page.getByRole('cell', { name: STATUS_NAMES[status], exact: true }) });
  }

  /**
   * The number of the fleet's hosts on this platform with `status`: the second of
   * the row's three cells (Status, Hosts, and a *View all hosts* button), which
   * carry no column name of their own.
   */
  hostCount(status: DiskEncryptionStatus): Locator {
    return this.statusRow(status).getByRole('cell').nth(1);
  }

  /**
   * Checks every status's count on the open tab: `expected`'s where it names
   * one, 0 for the rest. Only exact on a fleet whose hosts the caller controls.
   */
  async expectHostCounts(expected: Partial<Record<DiskEncryptionStatus, number>>): Promise<void> {
    for (const status of Object.keys(STATUS_NAMES) as DiskEncryptionStatus[]) {
      await expect(this.hostCount(status), `${STATUS_NAMES[status]} hosts`).toHaveText(String(expected[status] ?? 0));
    }
  }

  /**
   * Clicks a status's row, which opens the Hosts list on the platform's built-in
   * label, filtered to the fleet and the status, and waits for that list.
   */
  async openHostsWith(status: DiskEncryptionStatus, fleetId: number): Promise<HostsListPage> {
    await this.statusRow(status).click();
    await expect(this.page).toHaveURL(
      new RegExp(
        `/hosts/manage/labels/\\d+\\?(?=.*\\bfleet_id=${fleetId}\\b)(?=.*\\bos_settings_disk_encryption=${status}\\b)`,
      ),
    );
    const hosts = new HostsListPage(this.page);
    await expect(hosts.resultsCount).toBeVisible();
    await hosts.table.waitForSettled();
    return hosts;
  }

  /**
   * Checks the table of a fleet that holds one host of the platform: `status`
   * counted 1 and every other status 0, and the row's click listing that host
   * alone. With `status` null the host has none, and every count is 0.
   */
  async expectOneHost(opts: {
    fleetId: number;
    platform: DiskEncryptionPlatform;
    status: DiskEncryptionStatus | null;
    hostName: string;
  }): Promise<void> {
    await this.goto({ fleetId: opts.fleetId, platform: opts.platform });
    await this.expectHostCounts(opts.status ? { [opts.status]: 1 } : {});
    if (!opts.status) return;
    const hosts = await this.openHostsWith(opts.status, opts.fleetId);
    await expect(hosts.resultsCount).toHaveText('1 host');
    await expect(hosts.hostLink(opts.hostName)).toBeVisible();
  }

  /**
   * Saves the current tab and waits for the success toast, so callers know the
   * write landed before they reload. Older toasts are cleared first, so a second
   * save in one test waits for its own.
   */
  async save(): Promise<void> {
    await this.toast.dismissAll();
    await this.saveButton.click();
    await this.toast.expectSuccess('Successfully updated disk encryption settings.');
  }
}
