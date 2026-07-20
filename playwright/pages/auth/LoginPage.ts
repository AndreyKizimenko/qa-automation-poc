import { Page, Locator, expect } from '@playwright/test';

/**
 * /login — Fleet's email/password login page. Also hosts the SSO sign-in
 * button when SSO is configured. The button carries a generic "Sign in with
 * SSO" label; the configured IdP name (e.g. Okta) shows in a hover tooltip.
 */
export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly forgotPasswordLink: Locator;
  readonly ssoButton: Locator;
  readonly ssoTooltip: Locator;
  readonly authFailedMessage: Locator;
  readonly emailRequiredMessage: Locator;
  readonly passwordRequiredMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByPlaceholder('Email');
    this.passwordInput = page.getByPlaceholder('Password');
    this.loginButton = page.getByRole('button', { name: 'Log in' });
    this.forgotPasswordLink = page.getByRole('link', { name: 'Forgot password?' });
    this.ssoButton = page.getByRole('button', { name: /sign in with/i });
    // Names the configured IdP; rendered only while the SSO button is hovered.
    this.ssoTooltip = page.getByRole('tooltip');
    this.authFailedMessage = page.getByText('Authentication failed');
    this.emailRequiredMessage = page.getByText('Email field must be completed');
    this.passwordRequiredMessage = page.getByText('Password field must be completed');
  }

  async goto(): Promise<void> {
    await this.page.goto('/login');
    await expect(this.emailInput).toBeVisible();
  }

  /** Fill credentials and submit the form. Does NOT assert success. */
  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  /** Full successful login flow — asserts the dashboard loads after. */
  async loginAndExpectDashboard(email: string, password: string): Promise<void> {
    await this.login(email, password);
    await expect(this.page).toHaveURL(/\/dashboard/);
  }
}
