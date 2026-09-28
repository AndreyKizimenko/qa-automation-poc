import { Page, Locator, expect } from '@playwright/test';
import { Toast } from './Toast';

/** The Library row's install-side action. Which one Fleet offers is the contract the update spec asserts. */
export type LibraryInstallAction = 'Install' | 'Reinstall' | 'Update' | 'Retry';
export type LibraryUninstallAction = 'Uninstall' | 'Retry uninstall';

/**
 * Host details → Software → **Library**: the installers available to this host,
 * one row per title, with Status, Installed version, Library version and the
 * row's install and uninstall actions.
 *
 * The install-side button's label *is* the state Fleet derived for the row
 * (`getInstallerActionButtonConfig`): "Install" when nothing is installed,
 * "Reinstall" when the installed version is at or above the library's, "Update"
 * when any installed version is below it, "Retry" after a failed install. The
 * uninstall side reads "Retry uninstall" after a failed uninstall.
 *
 * Scoped to the Library card's own class: the Software tab keeps the Inventory
 * table mounted beside it, and both are role-less wrappers around a `table`.
 */
export class HostSoftwareLibrary {
  readonly page: Page;
  readonly toast: Toast;
  readonly card: Locator;
  readonly search: Locator;
  readonly table: Locator;
  readonly rows: Locator;
  /** "Add software" in the card header — adds an installer to the host's fleet. */
  readonly addSoftwareButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.toast = new Toast(page);
    this.card = page.locator('.host-software-library-card');
    this.search = this.card.getByRole('textbox', { name: 'Search by name' });
    this.table = this.card.getByRole('table');
    this.rows = this.table.locator('tbody').getByRole('row');
    this.addSoftwareButton = this.card.getByRole('button', { name: 'Add software' });
  }

  /** Filters the Library by title (server-side). */
  async searchFor(title: string): Promise<void> {
    await this.search.fill(title);
  }

  /** One title's row, matched on the exact name of its title link. */
  row(title: string): Locator {
    return this.rows.filter({ has: this.page.getByRole('link', { name: title, exact: true }) });
  }

  /**
   * The row's Status. An install or uninstall with a result renders as a button
   * ("Installed", "Failed", …) that opens its details; a pending one as text
   * ("Installing...", "Uninstalling..."); a title never touched on this host is
   * empty — so it is read from the cell rather than a button.
   */
  async status(title: string): Promise<Locator> {
    return this.cell(title, 'Status');
  }

  /**
   * The Installed version / Library version value. Each cell renders its value
   * in a leading `span` — `---` when there is none — followed by a truncation
   * tooltip that repeats it, so the cell's own text reads the version twice.
   */
  async installedVersion(title: string): Promise<Locator> {
    return (await this.cell(title, 'Installed version')).locator('span').first();
  }

  async libraryVersion(title: string): Promise<Locator> {
    return (await this.cell(title, 'Library version')).locator('span').first();
  }

  /** The row's install-side button by label; use `toHaveCount(0)` to assert one isn't offered. */
  installAction(title: string, label: LibraryInstallAction): Locator {
    return this.row(title).getByRole('button', { name: label, exact: true });
  }

  uninstallAction(title: string, label: LibraryUninstallAction = 'Uninstall'): Locator {
    return this.row(title).getByRole('button', { name: label, exact: true });
  }

  /** The Status button that opens the install/uninstall details modal ("Installed", "Failed", …). */
  statusButton(title: string, label: string): Locator {
    return this.row(title).getByRole('button', { name: label, exact: true });
  }

  /**
   * Clicks an install-side action — Install, Reinstall, Update and Retry all
   * queue the same install — and waits for Fleet to accept it. The toast is
   * worded for an online host, which the real VMs always are; the host picks the
   * install up on its next check-in, so the result is the caller's to wait for.
   */
  async install(title: string, label: LibraryInstallAction = 'Install'): Promise<void> {
    await this.installAction(title, label).click();
    await this.toast.expectSuccess('Software is installing. To see details, go to Details > Activity.');
  }

  async uninstall(title: string, label: LibraryUninstallAction = 'Uninstall'): Promise<void> {
    await this.uninstallAction(title, label).click();
    await this.toast.expectSuccess('Software is uninstalling. To see details, go to Details > Activity.');
  }

  /**
   * A row cell by its column header. The column order is resolved from the
   * headers each call rather than assumed, so a reordered or added column moves
   * with it; the cells themselves carry no role or label naming their column.
   */
  private async cell(title: string, header: string): Promise<Locator> {
    const headers = this.table.getByRole('columnheader');
    await expect(headers.first()).toBeVisible();
    const names = (await headers.allInnerTexts()).map((t) => t.trim());
    const index = names.indexOf(header);
    if (index < 0) throw new Error(`Library has no "${header}" column (got ${names.join(', ')})`);
    return this.row(title).getByRole('cell').nth(index);
  }
}
