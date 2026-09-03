import { Page, Locator, expect } from '@playwright/test';
import { DataTable } from '../components/DataTable';
import { Navbar } from '../components/Navbar';
import { Toast } from '../components/Toast';

/**
 * /packs/manage — list of osquery packs. Has an "Add new pack" button and
 * supports bulk selection via checkboxes, which reveals Enable / Disable /
 * Delete actions in the toolbar.
 */
export class PacksListPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly table: DataTable;
  readonly toast: Toast;

  readonly heading: Locator;
  readonly createNewPackButton: Locator;
  readonly deleteButton: Locator;
  readonly enableButton: Locator;
  readonly disableButton: Locator;
  readonly deleteModal: Locator;
  readonly deleteConfirmButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.table = new DataTable(page);
    this.toast = new Toast(page);

    this.heading = page.getByRole('heading', { name: 'Packs', exact: true });
    // The header button and the empty-state primary button both carry this
    // accessible name, so it resolves whether or not packs already exist.
    this.createNewPackButton = page.getByRole('button', { name: /add new pack/i });
    // Bulk actions — appear once at least one checkbox is selected
    this.deleteButton = page.getByRole('button', { name: /delete/i });
    // Enable renders a check icon whose alt text lands in the accessible name
    // ("Enable check"), so anchor on the leading word rather than matching exactly.
    this.enableButton = page.getByRole('button', { name: /^Enable\b/ });
    this.disableButton = page.getByRole('button', { name: /^Disable\b/ });
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
   * A pack row's Status cell, which renders "Enabled" or "Disabled". Waits for
   * the row itself first: `goto()` anchors on the page heading, which paints
   * before the table, and resolving a column needs rendered headers.
   */
  async statusCell(name: string): Promise<Locator> {
    const row = this.packRow(name);
    await expect(row).toBeVisible();
    return this.table.cellByColumn(row, 'Status');
  }

  /**
   * Select a pack by checkbox and apply a bulk Enable/Disable.
   *
   * The closing wait on the Status cell is this method's completion signal, not
   * a verdict on the feature: Fleet refetches the list in a `.finally()` after
   * the update, so returning any earlier would leave the request in flight for
   * a caller that navigates next. The success toast can't serve as that signal
   * — it auto-dismisses after 5s and races a slow refetch.
   */
  async setEnabled(name: string, enabled: boolean): Promise<void> {
    // Selection lives in table state, so a click landing before the list's
    // refetch resolves is discarded by the re-render and the bulk-action
    // toolbar never appears.
    await this.table.waitForSettled();
    await this.packRow(name).getByRole('checkbox').click();
    await (enabled ? this.enableButton : this.disableButton).click();

    await expect(await this.statusCell(name)).toHaveText(enabled ? 'Enabled' : 'Disabled');
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
