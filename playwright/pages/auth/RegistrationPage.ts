import { Page, Locator, expect } from '@playwright/test';

/**
 * /setup — a brand-new Fleet's first-run setup, which only a server with no user yet offers.
 *
 * Four steps, each with its own heading: "Set up user", "Organization details", "Set Fleet URL" and
 * "Confirm configuration". All four forms stay mounted while the page slides between them, and the
 * steps not in view keep their submit button disabled, so a step's **Next** is the one enabled
 * button of that name (`frontend/components/forms/RegistrationForm`: each step's `Button` takes
 * `disabled={!currentPage}`). Field labels are unique across the steps, so they need no scoping.
 */
export class RegistrationPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly fullNameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly orgNameInput: Locator;
  readonly serverUrlInput: Locator;
  /** The current step's Next: the only one enabled. */
  readonly nextButton: Locator;
  readonly confirmButton: Locator;
  /** The confirmation step's summary of what is about to be saved. */
  readonly summary: Locator;

  constructor(page: Page) {
    this.page = page;
    // The step's title; the breadcrumb above it repeats the step names as buttons.
    this.heading = page.getByRole('heading', { level: 2 });
    this.fullNameInput = page.getByLabel('Full name');
    this.emailInput = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Password', { exact: true });
    this.confirmPasswordInput = page.getByLabel('Confirm password');
    this.orgNameInput = page.getByLabel('Organization name');
    this.serverUrlInput = page.getByLabel('Fleet web address');
    this.nextButton = page.getByRole('button', { name: 'Next', disabled: false });
    this.confirmButton = page.getByRole('button', { name: 'Confirm', disabled: false });
    this.summary = page.getByRole('table', { name: 'Administrator configuration' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/setup');
    await expect(this.heading).toHaveText('Set up user');
  }

  async fillUser(user: { name: string; email: string; password: string }): Promise<void> {
    await this.fullNameInput.fill(user.name);
    await this.emailInput.fill(user.email);
    await this.passwordInput.fill(user.password);
    await this.confirmPasswordInput.fill(user.password);
    await this.next('Organization details');
  }

  async fillOrganization(name: string): Promise<void> {
    await this.orgNameInput.fill(name);
    await this.next('Set Fleet URL');
  }

  async fillServerUrl(url: string): Promise<void> {
    await this.serverUrlInput.fill(url);
    await this.next('Confirm configuration');
  }

  /** Confirm: Fleet saves the admin and the organization, signs the admin in and opens the dashboard. */
  async confirm(): Promise<void> {
    await this.confirmButton.click();
    await expect(this.page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
  }

  private async next(nextHeading: string): Promise<void> {
    await this.nextButton.click();
    await expect(this.heading).toHaveText(nextHeading);
  }
}
