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

  async save(): Promise<void> {
    await this.saveButton.click();
    await this.toast.expectSuccess('Successfully updated.');
  }
}
