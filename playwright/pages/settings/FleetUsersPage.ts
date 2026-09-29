import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';
import { Toast } from '../components/Toast';
import { UserFormFields } from './users/UserFormFields';

/** The roles a fleet's "Team role" dropdown offers (no GitOps: that one is global-only here). */
export type FleetRole = 'Observer' | 'Observer+' | 'Technician' | 'Maintainer' | 'Admin';

/**
 * `/settings/fleets/users?fleet_id=:id` — one fleet's **Users** tab, where its
 * team admin (or a global admin) manages the fleet's members. A team admin
 * reaches it from the user menu's *Users* item.
 *
 * The fleet header above the tabs carries *Add hosts*, *Manage enroll secrets*,
 * *Rename fleet* and, for global admins only, *Delete fleet*
 * (`TeamDetailsWrapper.tsx` — `hideAction: !isGlobalAdmin`).
 *
 * *Add user* differs by role (`UsersPage.tsx`): a team admin gets the create-user
 * modal (`add-user-modal`), a global admin a picker of existing users. Row
 * actions are *Edit* (the `edit-user-modal__edit-user-modal`, one `UserForm` whose fleet role is
 * a "Team role" dropdown) and *Remove*, which takes the user off this fleet
 * without deleting them.
 *
 * Fleet's `Modal` renders no `role="dialog"`, so each modal is scoped by its
 * component's class.
 */
export class FleetUsersPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly toast: Toast;
  /** The create and edit modals render the same `UserForm`, one at a time. */
  readonly form: UserFormFields;

  readonly renameFleetButton: Locator;
  readonly deleteFleetButton: Locator;
  // The icon's alt text leads the accessible name ("plus Add user").
  readonly addUserButton: Locator;
  readonly search: Locator;
  readonly rows: Locator;

  readonly createModal: Locator;
  readonly createSubmitButton: Locator;
  readonly editModal: Locator;
  readonly editSaveButton: Locator;
  readonly removeModal: Locator;
  readonly removeConfirmButton: Locator;
  readonly renameModal: Locator;
  readonly renameInput: Locator;
  readonly renameCancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.toast = new Toast(page);
    this.form = new UserFormFields(page);

    this.renameFleetButton = page.getByRole('button', { name: 'Rename fleet', exact: true });
    this.deleteFleetButton = page.getByRole('button', { name: 'Delete fleet', exact: true });
    this.addUserButton = page.getByRole('button', { name: /Add user$/ });
    this.search = page.getByRole('textbox', { name: 'Search' });
    // `team-users` is the tab's own class; scoping keeps the modals' markup out.
    this.rows = page.locator('.team-users').getByRole('table').locator('tbody').getByRole('row');

    this.createModal = page.locator('.add-user-modal');
    this.createSubmitButton = this.createModal.getByRole('button', { name: 'Add', exact: true });
    // EditUserModal passes `${baseClass}__edit-user-modal` as the Modal's class.
    this.editModal = page.locator('.edit-user-modal__edit-user-modal');
    this.editSaveButton = this.editModal.getByRole('button', { name: 'Save', exact: true });
    this.removeModal = page.locator('.remove-user-modal');
    this.removeConfirmButton = this.removeModal.getByRole('button', { name: 'Remove', exact: true });
    this.renameModal = page.locator('.rename-fleet-modal');
    this.renameInput = this.renameModal.getByRole('textbox', { name: 'Fleet name' });
    this.renameCancelButton = this.renameModal.getByRole('button', { name: 'Cancel', exact: true });
  }

  async goto(fleetId: number): Promise<void> {
    await this.page.goto(`/settings/fleets/users?fleet_id=${fleetId}`);
    await expect(this.addUserButton).toBeVisible();
  }

  /** The row whose Email cell is exactly `email`. */
  rowByEmail(email: string): Locator {
    return this.rows.filter({ has: this.page.getByRole('cell', { name: email, exact: true }) });
  }

  /** Searches down to one member and returns their row — the list pages, so never scan it. */
  async findRowByEmail(email: string): Promise<Locator> {
    await this.search.fill(email);
    return this.rowByEmail(email);
  }

  /** Opens a row's Actions menu and picks an item. */
  async runRowAction(row: Locator, action: 'Edit' | 'Remove'): Promise<void> {
    await expect(row).toBeVisible();
    // The row's Actions menu is a react-select whose control has no usable role.
    await row.locator('.actions-dropdown__wrapper').click();
    await this.clickOption(action);
  }

  /**
   * Picks the fleet role in the open create or edit modal. "Team role" is a
   * react-select: its `combobox` input sits under the control and never takes
   * a click, so the control's class is the click target (the modal's only
   * react-select). Its options carry Fleet's `dropdown-option` test id.
   */
  async selectTeamRole(modal: Locator, role: FleetRole): Promise<void> {
    await modal.locator('.react-select__control').click();
    await this.clickOption(role);
  }

  /** Clicks an open react-select's option by exact text, asserting it's offered first so a missing one fails fast. */
  private async clickOption(text: string): Promise<void> {
    const escaped = text.replace(/[+]/g, '\\+');
    const option = this.page.getByTestId('dropdown-option').filter({ hasText: new RegExp(`^${escaped}$`) });
    await expect(option).toBeVisible();
    await option.click();
  }
}
