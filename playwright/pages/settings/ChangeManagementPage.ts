import { Page, Locator, expect } from '@playwright/test';
import type { GitOpsEntity } from '@helpers/api/gitops-mode';
import { Navbar } from '../components/Navbar';
import { Toast } from '../components/Toast';

/**
 * `/settings/integrations/change-management` — the only UI that turns gitops
 * mode on and off.
 *
 * Nothing on this card is ever gated, by necessity: gate it and gitops mode
 * becomes a one-way door with no way back through the UI. The one exception is
 * the repository URL, which the form itself disables while the mode is off.
 */
export class ChangeManagementPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly toast: Toast;

  readonly heading: Locator;
  readonly gitopsModeToggle: Locator;
  readonly repositoryUrlInput: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.toast = new Toast(page);

    this.heading = page.getByRole('heading', { name: 'Change management' });
    // Fleet's Checkbox names the interactive element after the form field, not
    // after the visible label text.
    this.gitopsModeToggle = page.getByRole('checkbox', { name: 'gitOpsModeEnabled' });
    this.repositoryUrlInput = page.getByLabel('Git repository URL');
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });
  }

  async goto(): Promise<void> {
    await this.page.goto('/settings/integrations/change-management');
    await expect(this.heading).toBeVisible();
  }

  /**
   * The "Exceptions" checkbox for one entity. Same naming rule as the mode
   * toggle: the accessible name is the form field, so the friendly entity name
   * is mapped here and specs never see the raw string.
   */
  exceptionCheckbox(entity: GitOpsEntity): Locator {
    const field = {
      labels: 'exceptLabels',
      software: 'exceptSoftware',
      secrets: 'exceptSecrets',
    }[entity];
    return this.page.getByRole('checkbox', { name: field });
  }

  async save(): Promise<void> {
    await this.saveButton.click();
    await this.toast.expectSuccess('Successfully updated settings');
  }
}
