import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';

/**
 * `/reports/:id/live` — live-run flow for a saved report. Lands on the
 * "Select targets" step (host/label/team picker); clicking "Run query"
 * advances to the run screen. The smoke spec only verifies that the
 * targets step renders so we don't tie the test to host availability.
 */
export class ReportLivePage {
  readonly page: Page;
  readonly navbar: Navbar;

  readonly heading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.heading = page.getByRole('heading', { name: 'Select targets', level: 1 });
  }

  async waitForReady(): Promise<void> {
    await expect(this.heading).toBeVisible();
  }
}
