import { Page, Locator, expect } from '@playwright/test';
import { Toast } from '../components/Toast';
import { TeamDropdown } from '../components/TeamDropdown';

/**
 * /controls/os-settings/passwords — the **Passwords** card: one setting,
 * *Turn on Recovery Lock password*, per fleet (or for Unassigned), and its
 * Save. With it on, Fleet sets a Recovery Lock password on every Apple silicon
 * Mac in scope, escrows it, and shows it on the host (Actions → *Show Recovery
 * Lock password*); turning it off clears the password from the Macs.
 *
 * On free the card shows the Fleet Premium message instead of the form
 * (`Passwords.tsx`); technicians see neither the checkbox nor Save.
 *
 * The checkbox is a Fleet `<Checkbox>` with no `name` prop, so its accessible
 * name is the visible label.
 */
export class PasswordsPage {
  readonly page: Page;
  readonly toast: Toast;
  readonly teamDropdown: TeamDropdown;

  readonly heading: Locator;
  readonly recoveryLockCheckbox: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.toast = new Toast(page);
    this.teamDropdown = new TeamDropdown(page);

    this.heading = page.getByRole('heading', { name: 'Passwords', level: 2 });
    this.recoveryLockCheckbox = page.getByRole('checkbox', { name: 'Turn on Recovery Lock password' });
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });
  }

  /** `fleetId=0` targets Unassigned. Anchors on the checkbox, which renders once the fleet's settings load. */
  async goto(opts: { fleetId?: number } = {}): Promise<void> {
    const qs = opts.fleetId !== undefined ? `?fleet_id=${opts.fleetId}` : '';
    await this.page.goto(`/controls/os-settings/passwords${qs}`);
    await expect(this.heading).toBeVisible();
    await expect(this.recoveryLockCheckbox).toBeEnabled();
  }

  /** Sets the checkbox and saves, waiting for Fleet's confirmation. */
  async setRecoveryLock(enabled: boolean): Promise<void> {
    await expect(this.recoveryLockCheckbox).toBeEnabled();
    await this.recoveryLockCheckbox.setChecked(enabled);
    await this.saveButton.click();
    await this.toast.expectSuccess('Successfully updated Recovery Lock password enforcement.');
  }
}
