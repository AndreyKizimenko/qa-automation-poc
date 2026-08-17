import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';
import { Toast } from '../components/Toast';

/**
 * `/controls/setup-experience/users` — first step of the Setup Experience
 * wizard. Configures the macOS local account ("End user" type: Admin /
 * Standard / Skip, plus a "Create hidden admin" managed option) and the
 * "Require IdP authentication" toggle (requires EUA configured at
 * `/settings/integrations/sso/end-users`).
 */
export class SetupExperienceUsersPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly toast: Toast;

  readonly heading: Locator;
  readonly requireIdpCheckbox: Locator;
  readonly createHiddenAdminCheckbox: Locator;
  // Managed-local-account "Lock end user info" toggle. Only renders once
  // "Require IdP authentication" is enabled (see EndUserAuthSection).
  readonly lockEndUserInfoCheckbox: Locator;
  readonly localAccountAdminRadio: Locator;
  readonly localAccountStandardRadio: Locator;
  readonly localAccountSkipRadio: Locator;
  readonly idpLink: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.toast = new Toast(page);

    this.heading = page.getByRole('heading', { name: 'Users', level: 2 });
    // Fleet renders custom checkboxes (the underlying <input> is display:none);
    // the accessible control is the ARIA checkbox carrying the label text.
    this.requireIdpCheckbox = page.getByRole('checkbox', { name: 'Require IdP authentication' });
    this.createHiddenAdminCheckbox = page.getByRole('checkbox', { name: 'Create hidden admin' });
    this.lockEndUserInfoCheckbox = page.getByRole('checkbox', { name: 'Lock end user info' });
    this.localAccountAdminRadio = page.getByRole('radio', { name: 'Admin' });
    this.localAccountStandardRadio = page.getByRole('radio', { name: 'Standard' });
    this.localAccountSkipRadio = page.getByRole('radio', { name: 'Skip (no account)' });
    this.idpLink = page.getByRole('link', { name: /identity provider/i });
    this.saveButton = page.getByRole('button', { name: 'Save' });
  }

  async goto(opts: { fleetId?: number } = {}): Promise<void> {
    const qs = opts.fleetId !== undefined ? `?fleet_id=${opts.fleetId}` : '';
    await this.page.goto(`/controls/setup-experience/users${qs}`);
    await expect(this.heading).toBeVisible();
  }

  /**
   * Saves the form and waits for the save to have fully settled.
   *
   * Fleet raises the success toast only after awaiting the config (and, for a
   * fleet scope, the fleet) refetch that follows the write, and the form
   * re-initialises from that refetch — so a toggle clicked before it lands is
   * discarded. Clearing older toasts first means the toast waited on here is
   * the one this save raises, which makes it a barrier for the whole write +
   * refetch cycle and leaves the form safe to drive again.
   */
  async save(): Promise<void> {
    await this.toast.dismissAll();
    await this.saveButton.click();
    await this.toast.expectSuccess('Successfully updated.');
  }
}
