import { Page, Locator, expect } from '@playwright/test';
import { Toast } from '../components/Toast';
import { TeamDropdown } from '../components/TeamDropdown';

/** The platform tabs the disk-encryption page renders, in render order. */
export type DiskEncryptionPlatform = 'macos' | 'windows' | 'linux';

const TAB_NAMES: Record<DiskEncryptionPlatform, string> = {
  macos: 'macOS',
  windows: 'Windows',
  linux: 'Linux',
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
    this.escrowCheckbox = page.getByRole('checkbox', { name: 'Escrow recovery key with Fleet' });
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
   * Saves the current tab and waits for the success toast, so callers know the
   * write landed before they reload.
   */
  async save(): Promise<void> {
    await this.saveButton.click();
    await this.toast.expectSuccess('Successfully updated disk encryption settings.');
  }
}
