import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';
import { Toast } from '../components/Toast';
import { clickHoverAction } from '../components/clickHoverAction';

export type FleetRowAction = 'Rename' | 'Delete';

/**
 * `/settings/fleets` — Settings › Fleets: the fleets table, **Add fleet**, and
 * each row's Actions (Rename / Delete) with their modals. Premium only.
 *
 * Only a spec that owns a throwaway `pw-*` fleet acts here; the standing
 * fleets (Workstations, VMs and QA from gitops; Mobile, kept by hand) are never
 * renamed or deleted.
 */
export class FleetsPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly toast: Toast;

  readonly addFleetButton: Locator;

  // Fleet's Modal renders a role-less container; each is told apart by its title.
  readonly addModal: Locator;
  readonly addNameInput: Locator;
  readonly createButton: Locator;

  readonly renameModal: Locator;
  readonly renameNameInput: Locator;
  readonly renameSaveButton: Locator;

  readonly deleteModal: Locator;
  readonly deleteConfirmButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.toast = new Toast(page);

    this.addFleetButton = page.getByRole('button', { name: 'Add fleet' });

    this.addModal = page.locator('.modal__modal_container').filter({ hasText: 'Add fleet' });
    this.addNameInput = this.addModal.getByRole('textbox', { name: 'Fleet name' });
    this.createButton = this.addModal.getByRole('button', { name: 'Create', exact: true });

    this.renameModal = page.locator('.modal__modal_container').filter({ hasText: 'Rename fleet' });
    this.renameNameInput = this.renameModal.getByRole('textbox', { name: 'Fleet name' });
    this.renameSaveButton = this.renameModal.getByRole('button', { name: 'Save', exact: true });

    this.deleteModal = page.locator('.modal__modal_container').filter({ hasText: 'Delete fleet' });
    this.deleteConfirmButton = this.deleteModal.getByRole('button', { name: 'Delete', exact: true });
  }

  async goto(): Promise<void> {
    await this.page.goto('/settings/fleets');
    await expect(this.addFleetButton).toBeVisible();
  }

  /** A fleet's row, by its name link (exact, so `pw-x` doesn't match `pw-x-renamed`). */
  row(name: string): Locator {
    return this.page.getByRole('row').filter({ has: this.page.getByRole('link', { name, exact: true }) });
  }

  async addFleet(name: string): Promise<void> {
    await this.addFleetButton.click();
    await expect(this.addModal).toBeVisible();
    await this.addNameInput.fill(name);
    await this.createButton.click();
    await expect(this.addModal).toBeHidden();
  }

  /**
   * Opens a row's Actions and picks `action`. The control is Fleet's
   * react-select ActionsDropdown: it reveals on row hover, has no accessible
   * name, and portals its options with no role, so classes are the handle (as
   * on the Labels page).
   */
  async runRowAction(name: string, action: FleetRowAction): Promise<void> {
    const row = this.row(name);
    await expect(row).toHaveCount(1);
    await clickHoverAction(row, row.locator('.actions-dropdown-select__control'));
    await this.page.locator('.actions-dropdown-select__option').filter({ hasText: action }).click();
  }

  async renameFleet(name: string, newName: string): Promise<void> {
    await this.runRowAction(name, 'Rename');
    await expect(this.renameModal).toBeVisible();
    await this.renameNameInput.fill(newName);
    await this.renameSaveButton.click();
    await expect(this.renameModal).toBeHidden();
  }

  async deleteFleet(name: string): Promise<void> {
    await this.runRowAction(name, 'Delete');
    await expect(this.deleteModal).toBeVisible();
    await this.deleteConfirmButton.click();
    await expect(this.deleteModal).toBeHidden();
  }
}
