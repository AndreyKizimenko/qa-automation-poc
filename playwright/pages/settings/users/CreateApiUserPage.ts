import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../../components/Navbar';

/**
 * `/settings/users/new/api` — API-only user creation sub-page. Different
 * form shape from the regular user form:
 *   - Only a `Name` input (no Email, no Password; Fleet generates an API
 *     token instead).
 *   - Default Permissions radio is **"Global user"** (the regular form
 *     defaults to Assign-to-fleets on premium).
 *   - "API access" radio adds a "Specific API endpoints" mode that
 *     reveals an endpoint selector table.
 *
 * After submit, Fleet replaces the form with an `ApiKeyDisplay` panel
 * surfacing the generated token + a "Done" button. Clicking Done
 * navigates back to `/settings/users`.
 */
export type GlobalRole =
  | 'Observer'
  | 'Observer+'
  | 'Technician'
  | 'Maintainer'
  | 'GitOps'
  | 'Admin';

export class CreateApiUserPage {
  readonly page: Page;
  readonly navbar: Navbar;

  readonly heading: Locator;

  readonly name: Locator;

  readonly globalUserRadio: Locator;
  readonly globalUserLabel: Locator;
  readonly assignToFleetsRadio: Locator;
  readonly assignToFleetsLabel: Locator;

  readonly roleDropdownTrigger: Locator;

  readonly allEndpointsRadio: Locator;
  readonly allEndpointsLabel: Locator;
  readonly specificEndpointsRadio: Locator;
  readonly specificEndpointsLabel: Locator;

  readonly endpointSearch: Locator;
  readonly endpointTable: Locator;

  readonly submitButton: Locator;
  readonly cancelButton: Locator;

  // Post-submit ApiKeyDisplay panel — shown after a successful create until
  // the user clicks "Done".
  readonly apiKeyInput: Locator;
  readonly showSecretButton: Locator;
  readonly hideSecretButton: Locator;
  readonly copyButton: Locator;
  readonly apiKeyBanner: Locator;
  readonly doneButton: Locator;

  // Endpoint search dropdown rows (Specific API endpoints mode only).
  readonly endpointSuggestionRows: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);

    this.heading = page.getByRole('heading', { name: 'New API-only user', level: 1 });

    // No placeholder on the API form's name input — use the id-based
    // anchor, which is stable across Fleet versions.
    this.name = page.locator('#name');

    this.globalUserRadio = page.getByRole('radio', { name: 'Global user' });
    this.globalUserLabel = page.locator('label[for="global-user"]');
    this.assignToFleetsRadio = page.getByRole('radio', { name: /Assign to fleet/i });
    this.assignToFleetsLabel = page.locator('label[for="assign-teams"]');

    // The API form's role dropdown carries no Fleet-specific class suffix.
    // Scope to the page container; the first .dropdown-wrapper inside the
    // form is the role dropdown (per-fleet dropdowns only appear later).
    this.roleDropdownTrigger = page.locator('.create-api-user-page form .dropdown-wrapper').first();

    this.allEndpointsRadio = page.getByRole('radio', { name: 'All API endpoints' });
    this.allEndpointsLabel = page.locator('label[for="all-endpoints"]');
    this.specificEndpointsRadio = page.getByRole('radio', { name: 'Specific API endpoints' });
    this.specificEndpointsLabel = page.locator('label[for="specific-endpoints"]');

    this.endpointSearch = page.getByPlaceholder('Search by name or path');
    this.endpointTable = page.locator('.endpoint-selector-table');

    this.submitButton = page.getByRole('button', { name: 'Add' });
    this.cancelButton = page.getByRole('button', { name: 'Cancel' });

    // ApiKeyDisplay panel locators.
    this.apiKeyInput = page.locator('input[name="api-key"]');
    this.showSecretButton = page.getByRole('button', { name: 'Show secret' });
    this.hideSecretButton = page.getByRole('button', { name: 'Hide secret' });
    this.copyButton = page.getByRole('button', { name: 'Copy to clipboard' });
    this.apiKeyBanner = page.locator('.info-banner').filter({ hasText: /API key/i });
    this.doneButton = page.getByRole('button', { name: 'Done' });

    // Each row in the endpoint search-dropdown table represents a Fleet
    // API endpoint suggestion (e.g. "List users GET /api/v1/fleet/users").
    this.endpointSuggestionRows = page.locator(
      '.endpoint-selector-table__search-dropdown tbody tr',
    );
  }

  async goto(): Promise<void> {
    await this.page.goto('/settings/users/new/api');
    await expect(this.name).toBeVisible();
  }

  async selectGlobalRole(role: GlobalRole): Promise<void> {
    await this.roleDropdownTrigger.click();
    const escaped = role.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await this.page
      .getByTestId('dropdown-option')
      .filter({ hasText: new RegExp(`^${escaped}$`) })
      .click();
  }

  /**
   * Switch Permissions to "Assign to fleet(s)". Waits for the radio to
   * be enabled — the form gates it while the teams query is in-flight
   * (no fleets available → disabled).
   */
  async useAssignToFleets(): Promise<void> {
    await expect(this.assignToFleetsRadio).toBeEnabled();
    await this.assignToFleetsLabel.click();
    await expect(this.assignToFleetsRadio).toBeChecked();
  }

  /** Toggle a fleet's checkbox by visible name. */
  async toggleFleet(fleetName: string): Promise<void> {
    await this.page.getByRole('checkbox', { name: fleetName }).click();
  }

  /** Picks a role for an already-checked fleet row on the API form. */
  async selectFleetRole(fleetName: string, role: GlobalRole): Promise<void> {
    const row = this.page
      .locator('.selected-teams-form__team-item')
      .filter({ hasText: fleetName });
    await row.locator('.selected-teams-form__role-dropdown').click();
    const escaped = role.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await this.page
      .getByTestId('dropdown-option')
      .filter({ hasText: new RegExp(`^${escaped}$`) })
      .click();
  }

  /**
   * Submit the form, dismiss the API-key reveal panel, and return to the
   * users list page. Used by the success-flow specs once the form is
   * filled in.
   */
  async submitAndDone(): Promise<void> {
    await this.submitButton.click();
    await expect(this.doneButton).toBeVisible();
    await this.doneButton.click();
  }

  /**
   * Search the endpoint catalog and click the matching suggestion row to
   * add the endpoint to the user's allow-list. The dropdown auto-renders
   * a small table of suggestions as the user types; clicking a row
   * appends to the Selected endpoints table below.
   */
  async addEndpoint(query: string, rowText: string | RegExp): Promise<void> {
    await this.endpointSearch.fill(query);
    await this.endpointSuggestionRows.filter({ hasText: rowText }).first().click();
  }
}
