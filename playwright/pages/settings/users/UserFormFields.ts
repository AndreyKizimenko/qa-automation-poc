import { Page, Locator, expect } from '@playwright/test';

/**
 * Shared form fields rendered by Fleet's `UserForm` React component on the
 * Create-user and Edit-user pages.
 *
 * Locator notes (verified against the live DOM):
 *
 * - **Full name** has a plain `<label>` and works with `getByLabel`.
 * - **Email** and **Password** have a tooltip-wrapper inside the label,
 *   which breaks `getByLabel({ exact: true })` matching. Both inputs do
 *   carry placeholders, so we anchor on those instead.
 * - **Permissions** radio defaults to **"Assign to fleet(s)"** on premium —
 *   the role dropdown isn't rendered until "Global user" is selected.
 * - **Role dropdown** wrapper carries the `user-form__global-role-dropdown`
 *   class on the regular form. The trigger isn't accessible-name addressable
 *   (react-select v5), so the class fallback is the chosen anchor.
 * - **Options** are emitted by Fleet's `CustomOption` with
 *   `data-testid="dropdown-option"` and contain the role label as text.
 */
export type GlobalRole =
  | 'Observer'
  | 'Observer+'
  | 'Technician'
  | 'Maintainer'
  | 'GitOps'
  | 'Admin';

export class UserFormFields {
  readonly page: Page;

  readonly fullName: Locator;
  readonly email: Locator;
  readonly password: Locator;

  // Permissions radio group — the `<input type="radio">` (hidden by CSS)
  // is what carries the checked state for `toBeChecked()` assertions, and
  // the matching `<label for=…>` is the visible click target.
  readonly globalUserRadio: Locator;
  readonly globalUserLabel: Locator;
  readonly assignToFleetsRadio: Locator;
  readonly assignToFleetsLabel: Locator;

  // Authentication radio group (rendered when SSO is configured org-wide).
  readonly authPasswordRadio: Locator;
  readonly authSsoRadio: Locator;

  // Role dropdown trigger (only present in Global user mode).
  readonly roleDropdownTrigger: Locator;

  // Per-fleet assignment rows shown when "Assign to fleet(s)" is selected.
  readonly fleetRows: Locator;

  constructor(page: Page) {
    this.page = page;

    this.fullName = page.getByLabel('Full name');
    // Placeholders avoid the tooltip-wrapper label-matching pitfall AND the
    // collision between the "Password" radio label and the password input.
    this.email = page.getByPlaceholder('Email');
    this.password = page.getByPlaceholder('Password');

    this.globalUserRadio = page.getByRole('radio', { name: 'Global user' });
    this.globalUserLabel = page.locator('label[for="global-user"]');
    this.assignToFleetsRadio = page.getByRole('radio', { name: /Assign to fleet/i });
    this.assignToFleetsLabel = page.locator('label[for="assign-teams"]');

    this.authPasswordRadio = page.getByRole('radio', { name: 'Password' });
    this.authSsoRadio = page.getByRole('radio', { name: 'Single sign-on' });

    // Class fallback: DropdownWrapper renders the react-select control with
    // no usable role on the trigger. Fleet stamps a stable class suffix on
    // the FormField wrapper that the user-form passes through.
    this.roleDropdownTrigger = page.locator('.user-form__global-role-dropdown');

    // Each selected-fleet entry is a list item with a row-scoped role dropdown.
    this.fleetRows = page.locator('.selected-teams-form__team-item');
  }

  /**
   * Switch Permissions to "Global user" mode. Waits for the radio input
   * to be enabled (the form gates it while team data is still loading)
   * and clicks the visible label, since the underlying input has
   * `display:none`.
   */
  async useGlobalUser(): Promise<void> {
    await expect(this.globalUserRadio).toBeEnabled();
    await this.globalUserLabel.click();
    await expect(this.globalUserRadio).toBeChecked();
  }

  /** Switch Permissions to "Assign to fleet(s)" mode. */
  async useAssignToFleets(): Promise<void> {
    await expect(this.assignToFleetsRadio).toBeEnabled();
    await this.assignToFleetsLabel.click();
    await expect(this.assignToFleetsRadio).toBeChecked();
  }

  async selectGlobalRole(role: GlobalRole): Promise<void> {
    await this.roleDropdownTrigger.click();
    await this.dropdownOption(role).click();
  }

  /** Toggle a fleet's checkbox by visible name. */
  async toggleFleet(fleetName: string): Promise<void> {
    await this.page.getByRole('checkbox', { name: fleetName }).click();
  }

  /**
   * Picks a role for the already-checked fleet row. The per-row dropdown
   * is its own DropdownWrapper inside `.selected-teams-form`, with the
   * `selected-teams-form__role-dropdown` modifier class.
   */
  async selectFleetRole(fleetName: string, role: GlobalRole): Promise<void> {
    const row = this.fleetRows.filter({ hasText: fleetName });
    await row.locator('.selected-teams-form__role-dropdown').click();
    await this.dropdownOption(role).click();
  }

  /**
   * Open dropdown-wrapper option by exact label. Anchored regex avoids the
   * `Observer` / `Observer+` collision.
   */
  private dropdownOption(label: string): Locator {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return this.page.getByTestId('dropdown-option').filter({ hasText: new RegExp(`^${escaped}$`) });
  }
}
