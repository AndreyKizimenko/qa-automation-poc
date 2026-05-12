import { Page, expect } from '@playwright/test';
import { ContentList } from '../components/ContentList';
import { Navbar } from '../components/Navbar';

/**
 * /controls/os-settings/certificates — list of certificates managed by Fleet.
 */
export class CertificatesPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly list: ContentList;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.list = new ContentList(page);
  }

  async goto(opts: { fleetId?: number } = {}): Promise<void> {
    const qs = opts.fleetId !== undefined ? `?fleet_id=${opts.fleetId}` : '';
    await this.page.goto(`/controls/os-settings/certificates${qs}`);
    await expect(this.list.firstItem).toBeVisible();
  }
}
