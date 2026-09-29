import { Page, Locator, expect } from '@playwright/test';
import { clickHoverAction } from '../components/clickHoverAction';
import { DataTable } from '../components/DataTable';
import { Navbar } from '../components/Navbar';
import { TeamDropdown } from '../components/TeamDropdown';
import { Toast } from '../components/Toast';

export type OsUpdatesPlatform = 'macOS' | 'Windows' | 'iOS' | 'iPadOS';
export type AppleUpdatesTarget = 'No updates enforced' | 'Custom version' | 'Latest version';

/**
 * /controls/os-updates — "Current versions" (the fleet's OS versions with host
 * counts; each row has a hover-only "View all hosts" button) and "Target", one
 * tab per platform holding the form that enforces an update.
 *
 * macOS / iOS / iPadOS: a target dropdown (No updates enforced / Custom version /
 * Latest version); "Custom version" reveals **Minimum version** and
 * **Deadline**. Windows: **Days after release** and **Grace period**. Each form
 * has its own Save. A platform tab's name gains " check" once it's configured.
 *
 * Fleet's form fields put a validation error *in place of* the field's label,
 * so a field that's invalid can't be found by its label. The Apple inputs are
 * reached by their `name`; an error is asserted as the input's label
 * (`getByLabel(error)`), which is where Fleet puts it. The Windows inputs have
 * no `name` and so no associated label; they're reached through their field.
 *
 * **Never set a minimum version, deadline or Windows deadline on a fleet with
 * real hosts** — the VMs would download and install an OS update. Workstations
 * holds none.
 */
export class OsUpdatesPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly table: DataTable;
  readonly teamDropdown: TeamDropdown;
  readonly toast: Toast;

  readonly targetHeading: Locator;
  /** "Current versions" with no hosts on the fleet. */
  readonly noOsVersions: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.table = new DataTable(page);
    this.teamDropdown = new TeamDropdown(page);
    this.toast = new Toast(page);
    this.targetHeading = page.getByRole('heading', { name: 'Target', level: 2 });
    this.noOsVersions = page.getByRole('heading', { name: 'No OS versions detected' });
  }

  /** Waits for "Current versions" to settle — its first row, or its empty state. */
  async goto(opts: { fleetId?: number } = {}): Promise<void> {
    const qs = opts.fleetId !== undefined ? `?fleet_id=${opts.fleetId}` : '';
    await this.page.goto(`/controls/os-updates${qs}`);
    await expect(this.table.firstRow.or(this.noOsVersions).first()).toBeVisible();
  }

  /**
   * Click the first row's "View all hosts" button. The button uses
   * `row-hover-button` and only renders while the row is hovered.
   */
  async viewHostsForFirstOs(): Promise<void> {
    const firstRow = this.table.firstRow;
    await clickHoverAction(firstRow, firstRow.getByRole('button', { name: 'View all hosts' }));
  }

  /**
   * "View all hosts" on the first "Current versions" row of one OS type
   * ("macOS", "Ubuntu", …) — the rows mix every platform.
   */
  async viewHostsForOsType(osType: string): Promise<void> {
    const row = this.table.rowWith(osType).first();
    await clickHoverAction(row, row.getByRole('button', { name: 'View all hosts' }));
  }

  platformTab(platform: OsUpdatesPlatform): Locator {
    return this.page.getByRole('tab', { name: new RegExp(`^${platform}( check)?$`) });
  }

  /** The tab name Fleet shows once the platform has an update enforced. */
  platformConfigured(platform: OsUpdatesPlatform): Locator {
    return this.page.getByRole('tab', { name: `${platform} check`, exact: true });
  }

  panel(platform: OsUpdatesPlatform): Locator {
    return this.page.getByRole('tabpanel', { name: new RegExp(`^${platform}( check)?$`) });
  }

  async openPlatform(platform: OsUpdatesPlatform): Promise<void> {
    await this.platformTab(platform).click();
    await expect(this.platformTab(platform)).toHaveAttribute('aria-selected', 'true');
  }

  // ── Apple target form ──────────────────────────────────────────────────────

  /** The target dropdown's current value. */
  appleTargetValue(platform: Exclude<OsUpdatesPlatform, 'Windows'> = 'macOS'): Locator {
    // react-select renders its value as a role-less div; the class is the only handle.
    return this.panel(platform).locator('.react-select__single-value');
  }

  async chooseAppleTarget(target: AppleUpdatesTarget, platform: Exclude<OsUpdatesPlatform, 'Windows'> = 'macOS'): Promise<void> {
    // react-select v5 trigger (catalogued in the reviewer skill); options carry
    // DropdownWrapper's `dropdown-option` test id.
    await this.panel(platform).locator('.react-select__control').click();
    await this.page.getByTestId('dropdown-option').filter({ hasText: target }).click();
    await expect(this.appleTargetValue(platform)).toHaveText(target);
  }

  minimumVersionInput(platform: Exclude<OsUpdatesPlatform, 'Windows'> = 'macOS'): Locator {
    // By name: an error replaces the field's label (see the class comment).
    return this.panel(platform).locator('input[name="minimum_version"]');
  }

  deadlineInput(platform: Exclude<OsUpdatesPlatform, 'Windows'> = 'macOS'): Locator {
    return this.panel(platform).locator('input[name="deadline"]');
  }

  // ── Windows target form ────────────────────────────────────────────────────

  /**
   * The Windows inputs carry no `name`, so Fleet's labels aren't associated with
   * them and they have no accessible name at all; each is reached through the
   * form field that holds its label text (`FormField`'s wrapper has no role).
   */
  private windowsField(label: string): Locator {
    return this.panel('Windows').locator('.form-field').filter({ hasText: label }).getByRole('textbox');
  }

  windowsDeadlineDaysInput(): Locator {
    return this.windowsField('Days after release');
  }

  windowsGracePeriodInput(): Locator {
    return this.windowsField('Grace period');
  }

  // ── Both ───────────────────────────────────────────────────────────────────

  saveButton(platform: OsUpdatesPlatform): Locator {
    return this.panel(platform).getByRole('button', { name: 'Save', exact: true });
  }

  /** A validation error, where Fleet puts it: as the field's label. */
  fieldError(platform: OsUpdatesPlatform, message: string): Locator {
    return this.panel(platform).getByLabel(message, { exact: true });
  }

  /** The panel's "End user experience" preview: the copy, the Learn more link, the image. */
  endUserPreview(platform: OsUpdatesPlatform = 'macOS'): { heading: Locator; learnMore: Locator; image: Locator } {
    const panel = this.panel(platform);
    return {
      heading: panel.getByRole('heading', { name: 'End user experience' }),
      learnMore: panel.getByRole('link', { name: /^Learn more/ }),
      image: panel.getByRole('img', { name: 'OS update preview screenshot' }),
    };
  }
}
