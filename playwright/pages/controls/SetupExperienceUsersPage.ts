import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';
import { Toast } from '../components/Toast';

/**
 * `/controls/setup-experience/users` — first step of the Setup Experience
 * wizard. Toggles "End user authentication" (requires EUA configured at
 * `/settings/integrations/sso/end-users`) and "Managed local account".
 */
export class SetupExperienceUsersPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly toast: Toast;

  readonly heading: Locator;
  readonly eaCheckbox: Locator;
  readonly managedLocalCheckbox: Locator;
  readonly idpLink: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.toast = new Toast(page);

    this.heading = page.getByRole('heading', { name: 'Users', level: 2 });
    this.eaCheckbox = page.getByRole('checkbox', { name: 'End user authentication' });
    this.managedLocalCheckbox = page.getByRole('checkbox', { name: 'Managed local account' });
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
