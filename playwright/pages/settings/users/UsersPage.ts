import { Page, Locator, expect } from '@playwright/test';
import { DataTable } from '../../components/DataTable';
import { Navbar } from '../../components/Navbar';
import { Toast } from '../../components/Toast';

/**
 * `/settings/users` — user management list page. Hosts:
 *   - "Add user" dropdown (Regular user / API-only user options) — both
 *     options navigate to dedicated sub-pages, not modals.
 *   - User table with Name / Role / Fleets (premium) / Status / Email /
 *     Actions columns. Rows have no link cells; navigation happens via
 *     the per-row Actions dropdown.
 *   - Inline modals: Delete user, Require password reset, Reset sessions.
 *     The Edit action navigates to `/settings/users/:id/edit` — a separate
 *     sub-page covered by `EditUserPage`, not a modal on this page.
 */
export type AddUserOption = 'Regular user' | 'API-only user';
export type RowAction = 'Edit' | 'Require password reset' | 'Reset sessions' | 'Delete';

export class UsersPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly table: DataTable;
  readonly toast: Toast;

  // Page-level controls
  readonly addUserButton: Locator;
  readonly search: Locator;

  // Add-user dropdown options. The dropdown is react-select-backed and
  // renders options with `role="option"` after the trigger is clicked.
  readonly addUserDropdownPanel: Locator;

  // Inline modals on this page
  readonly deleteModal: Locator;
  readonly deleteConfirmButton: Locator;
  readonly resetPasswordModal: Locator;
  readonly resetPasswordConfirmButton: Locator;
  readonly resetSessionsModal: Locator;
  readonly resetSessionsConfirmButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.table = new DataTable(page);
    this.toast = new Toast(page);

    this.addUserButton = page.getByRole('button', { name: 'Add user', exact: true });
    this.search = page.getByPlaceholder('Search by name or email');

    // The dropdown's options are not nested under the trigger button —
    // they render in a portal-ish wrapper. Scoping by class keeps the
    // option lookup unambiguous when other dropdowns are on the page.
    this.addUserDropdownPanel = page.locator('.add-user-dropdown');

    // Fleet's Modal component doesn't set role="dialog", so we anchor each
    // modal via the shared `.modal__modal_container` class filtered by the
    // header title text. Same pattern other settings POMs use.
    this.deleteModal = page.locator('.modal__modal_container').filter({ hasText: 'Delete user' });
    this.deleteConfirmButton = this.deleteModal.getByRole('button', { name: 'Delete', exact: true });

    this.resetPasswordModal = page.locator('.modal__modal_container').filter({ hasText: 'Require password reset' });
    this.resetPasswordConfirmButton = this.resetPasswordModal.getByRole('button', { name: 'Confirm' });

    this.resetSessionsModal = page.locator('.modal__modal_container').filter({ hasText: 'Reset sessions' });
    this.resetSessionsConfirmButton = this.resetSessionsModal.getByRole('button', { name: 'Confirm' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/settings/users');
    await expect(this.table.firstRow).toBeVisible();
  }

  /**
   * Click "Add user" and select either option. Both options navigate to
   * a sub-page rather than opening a modal.
   *
   * Class fallback: Fleet's ActionsDropdown renders the option content
   * via a custom react-select Option component as a plain `<div>` with
   * class `actions-dropdown__option` — no `role="option"` survives on
   * that div, so the class is the most reliable handle. The `hasText`
   * filter matches the label inside.
   */
  async openAddUser(option: AddUserOption): Promise<void> {
    await this.addUserButton.click();
    await this.dropdownOption(option).click();
  }

  /** Locator for any open ActionsDropdown option whose label starts with `label`. */
  dropdownOption(label: string): Locator {
    return this.page.locator('.actions-dropdown__option').filter({ hasText: label });
  }

  /** Locator for the table row containing the given email. */
  rowByEmail(email: string): Locator {
    return this.table.rowWith(email).first();
  }

  /** Locator for the table row containing the given name. */
  rowByName(name: string): Locator {
    return this.table.rowWith(name).first();
  }

  /**
   * Open a row's Actions dropdown and click one of its items. The trigger
   * is a small-button-variant ActionsDropdown — a react-select control
   * with no usable accessible role on the trigger itself. The outer
   * `.actions-dropdown__wrapper` element is unique within a row; the
   * inner `.actions-dropdown` class is also applied to the wrapper div
   * AND the chevron indicator, so it's ambiguous on its own.
   *
   * Options are anchored on the same `.actions-dropdown__option` class
   * fallback used by {@link openAddUser}.
   */
  async clickRowAction(rowLocator: Locator, action: RowAction): Promise<void> {
    await rowLocator.locator('.actions-dropdown__wrapper').click();
    await this.dropdownOption(action).click();
  }
}
