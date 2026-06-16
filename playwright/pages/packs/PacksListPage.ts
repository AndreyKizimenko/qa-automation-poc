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
  readonly deleteModal: Locator;
  readonly deleteConfirmButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.table = new DataTable(page);

    this.heading = page.getByRole('heading', { name: 'Packs', exact: true });
    this.createNewPackButton = page.getByRole('button', { name: /create new pack/i });
    // Bulk delete — appears when at least one checkbox is selected
    this.deleteButton = page.getByRole('button', { name: /delete/i });
    // Fleet's Modal applies DeletePackModal's `remove-pack-modal` baseClass to both
    // the modal container and its inner content div, so `.remove-pack-modal` is not
    // unique; scope to the modal container by its title text (the shared delete-modal
    // pattern) so the confirm button can't be confused with the toolbar's bulk delete.
    this.deleteModal = page.locator('.modal__modal_container').filter({ hasText: 'Delete pack' });
    this.deleteConfirmButton = this.deleteModal.getByRole('button', { name: /delete/i });
  }

  async goto(): Promise<void> {
    await this.page.goto('/packs/manage');
    await expect(this.heading).toBeVisible();
  }

  /**
   * Find a pack row by its visible name. Filters by the row's name-link
   * matching exactly so adjacent rows with similar names can't be picked
   * by accident.
   */
  packRow(name: string): Locator {
    return this.page.getByRole('row').filter({
      has: this.page.getByRole('link', { name, exact: true }),
    });
  }

  /** Click the pack name link to open its edit page. */
  async openPack(name: string): Promise<void> {
    await this.page.getByRole('link', { name, exact: true }).click();
  }

  /**
   * Select a pack by checkbox, click delete, and confirm the deletion modal.
   * The confirmation button is a second "Delete" button inside the modal.
   */
  async deletePack(name: string): Promise<void> {
    await this.packRow(name).getByRole('checkbox').click();
    await this.deleteButton.click();
    await expect(this.deleteModal).toBeVisible();
    await this.deleteConfirmButton.click();
    await expect(this.deleteModal).toBeHidden();
  }
}
