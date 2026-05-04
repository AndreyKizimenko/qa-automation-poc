import { Page, Locator, expect } from '@playwright/test';

/**
 * /login/forgot — password reset request page.
 */
export class ForgotPasswordPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly emailInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Reset password' });
    this.emailInput = page.getByPlaceholder('Email');
  }

  async goto(): Promise<void> {
    await this.page.goto('/login/forgot');
    await expect(this.heading).toBeVisible();
  }
}
