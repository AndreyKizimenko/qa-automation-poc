import { Page, Locator, expect } from '@playwright/test';
import { DataTable } from '../components/DataTable';
import { Navbar } from '../components/Navbar';

/**
 * /packs/manage — list of osquery packs. Has a "Create new pack" button and
 * supports bulk selection/deletion via checkboxes.
 */
export class PacksListPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly table: DataTable;

  readonly heading: Locator;
  readonly createNewPackButton: Locator;
  readonly deleteButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.table = new DataTable(page);

    this.heading = page.getByRole('heading', { name: 'Packs', exact: true });
    this.createNewPackButton = page.getByRole('button', { name: /create new pack/i });
    // Bulk delete — appears when at least one checkbox is selected
    this.deleteButton = page.getByRole('button', { name: /delete/i });
  }

  async goto(): Promise<void> {
    await this.page.goto('/packs/manage');
    await expect(this.heading).toBeVisible();
  }

  /** Find a pack row by its visible name. */
  packRow(name: string): Locator {
    return this.page.getByRole('row').filter({ hasText: name });
  }

  /** Click the pack name link to open its edit page. */
  async openPack(name: string): Promise<void> {
    await this.page.getByRole('link', { name }).click();
  }

  /**
   * Select a pack by checkbox, click delete, and confirm the deletion modal.
   * The confirmation button is a second "Delete" button inside the modal.
   */
  async deletePack(name: string): Promise<void> {
    await this.packRow(name).getByRole('checkbox').click();
    await this.deleteButton.click();
    // Modal has another "Delete" button for confirmation — the last one on screen
    await this.deleteButton.last().click();
  }
}
