import { Page, Locator, expect } from '@playwright/test';
import { DataTable } from '../components/DataTable';
import { Navbar } from '../components/Navbar';
import { Toast } from '../components/Toast';

/**
 * `/controls/setup-experience/install-software/:platform` — the setup
 * experience install-software list per platform. The page exposes a
 * 6-tab platform selector (macOS, Windows, Linux, iOS, iPadOS, Android)
 * plus a per-platform table where each row has a selection checkbox.
 * Saving persists the selection set with a "Successfully updated." toast.
 */
export type InstallSoftwarePlatform = 'macos' | 'windows' | 'linux' | 'ios' | 'ipados' | 'android';

const PLATFORM_TAB_LABELS: Record<InstallSoftwarePlatform, string> = {
  macos: 'macOS',
  windows: 'Windows',
  linux: 'Linux',
  ios: 'iOS',
  ipados: 'iPadOS',
  android: 'Android',
};

export class InstallSoftwarePage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly table: DataTable;
  readonly toast: Toast;

  readonly heading: Locator;
  readonly tabList: Locator;
  readonly saveButton: Locator;
  readonly nextButton: Locator;
  readonly previousButton: Locator;
  /**
   * The Name cell of the first data row — column index 1 (after the
   * selection-checkbox column at index 0). Reading its text identifies
   * the row at the top of the current page.
   */
  readonly firstRowNameCell: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.table = new DataTable(page);
    this.toast = new Toast(page);

    this.heading = page.getByRole('heading', { name: 'Install software' });
    this.tabList = page.getByRole('tablist');
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });
    this.nextButton = page.getByRole('button', { name: 'Next', exact: true });
    this.previousButton = page.getByRole('button', { name: 'Previous', exact: true });
    this.firstRowNameCell = this.table.firstRow.locator('td').nth(1);
  }

  /** Trimmed text of the first row's Name cell. */
  async firstRowName(): Promise<string> {
    return (await this.firstRowNameCell.innerText()).trim();
  }

  async goto(platform: InstallSoftwarePlatform, opts: { fleetId?: number } = {}): Promise<void> {
    const qs = opts.fleetId !== undefined ? `?fleet_id=${opts.fleetId}` : '';
    await this.page.goto(`/controls/setup-experience/install-software/${platform}${qs}`);
    await expect(this.heading).toBeVisible();
    // Either the empty-state "Add software" button or a real row should appear.
    await expect(this.table.rowOrEmpty()).toBeVisible();
  }

  /** Tab locator by display label ("macOS", "Windows", …). */
  tab(label: string): Locator {
    return this.tabList.getByRole('tab', { name: label, exact: true });
  }

  async expectAllPlatformTabs(): Promise<void> {
    for (const label of Object.values(PLATFORM_TAB_LABELS)) {
      await expect(this.tab(label)).toBeVisible();
    }
  }

  async switchPlatform(platform: InstallSoftwarePlatform): Promise<void> {
    await this.tab(PLATFORM_TAB_LABELS[platform]).click();
    await expect(this.page).toHaveURL(new RegExp(`/install-software/${platform}`));
    await expect(this.table.rowOrEmpty()).toBeVisible();
  }

  /**
   * Match a software-title row by display name. Software names sometimes
   * include trailing version text, so match on substring rather than
   * exact text.
   */
  rowByName(name: string): Locator {
    return this.table.rowWith(name);
  }

  async expectListed(name: string): Promise<void> {
    await expect(this.rowByName(name)).toBeVisible();
  }

  /** The selection checkbox is the first cell of each data row. */
  async toggleSelection(name: string): Promise<void> {
    const row = this.rowByName(name);
    await expect(row).toBeVisible();
    await row.getByRole('checkbox').first().click();
  }

  async expectSelected(name: string): Promise<void> {
    const row = this.rowByName(name);
    await expect(row.getByRole('checkbox').first()).toBeChecked();
  }

  async expectNotSelected(name: string): Promise<void> {
    const row = this.rowByName(name);
    await expect(row.getByRole('checkbox').first()).not.toBeChecked();
  }

  async save(): Promise<void> {
    await this.saveButton.click();
    await this.toast.expectSuccess('Successfully updated.');
  }
}
