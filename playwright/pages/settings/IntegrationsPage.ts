import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';

/**
 * /settings/integrations — the Integrations section, with a left-side nav
 * listing integration categories. The default subpage is "Ticket destinations".
 * Premium-only IdP / SCIM / Calendars / etc. subpages are gated on license.
 */
export class IntegrationsPage {
  readonly page: Page;
  readonly navbar: Navbar;

  /** Default subpage heading when landing on /settings/integrations. */
  readonly ticketDestinationsHeading: Locator;
  readonly scimText: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.ticketDestinationsHeading = page.getByRole('heading', {
      name: 'Ticket destinations',
      exact: true,
    });
    this.scimText = page.getByText(/SCIM/i);
  }

  async goto(): Promise<void> {
    await this.page.goto('/settings/integrations');
    await expect(this.ticketDestinationsHeading).toBeVisible();
  }
}
