import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../../components/Navbar';
import { UserFormFields } from './UserFormFields';

/**
 * `/settings/users/:id/edit` — sub-page for editing an existing user.
 *
 * The Fleet frontend renders this as a full route (not a modal), branching
 * on `user.api_only` to choose between `UserForm` and `ApiUserForm`. The
 * heading text differs accordingly:
 *   - human user → "Edit user"
 *   - api-only user → "Edit API-only user"
 *
 * For human users the form fields are shared with `CreateUserPage` via
 * {@link UserFormFields}. For API users the editable fields are a narrower
 * subset; specs targeting that path can reach for `apiUserHeading` and
 * drive the inputs they need directly.
 */
export class EditUserPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly form: UserFormFields;

  readonly humanHeading: Locator;
  readonly apiUserHeading: Locator;
  readonly backButton: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;

  // API-only edit: endpoint-access controls (same shape as CreateApiUserPage).
  readonly specificEndpointsLabel: Locator;
  readonly endpointTable: Locator;
  readonly endpointSearch: Locator;
  readonly endpointSuggestionRows: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.form = new UserFormFields(page);

    this.humanHeading = page.getByRole('heading', { name: 'Edit user', level: 1 });
    this.apiUserHeading = page.getByRole('heading', { name: 'Edit API-only user', level: 1 });
    this.backButton = page.getByRole('link', { name: 'Back to users' });
    this.saveButton = page.getByRole('button', { name: 'Save' });
    this.cancelButton = page.getByRole('button', { name: 'Cancel' });

    this.specificEndpointsLabel = page.locator('label[for="specific-endpoints"]');
    // Role-less container div — scoped by its component class (same as create).
    this.endpointTable = page.locator('.endpoint-selector-table');
    this.endpointSearch = page.getByPlaceholder('Search by name or path');
    this.endpointSuggestionRows = page.locator(
      '.endpoint-selector-table__search-dropdown tbody tr',
    );
  }

  /**
   * Search the endpoint catalog and click the matching suggestion to add it
   * to the API user's allow-list (Specific API endpoints mode).
   */
  async addEndpoint(query: string, rowText: string | RegExp): Promise<void> {
    await this.endpointSearch.fill(query);
    await this.endpointSuggestionRows.filter({ hasText: rowText }).first().click();
  }

  /** Direct navigation. Specs typically reach this page via the row's Edit action. */
  async goto(userId: number): Promise<void> {
    await this.page.goto(`/settings/users/${userId}/edit`);
    await expect(this.humanHeading.or(this.apiUserHeading)).toBeVisible();
  }
}
