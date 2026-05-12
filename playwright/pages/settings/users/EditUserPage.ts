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

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.form = new UserFormFields(page);

    this.humanHeading = page.getByRole('heading', { name: 'Edit user', level: 1 });
    this.apiUserHeading = page.getByRole('heading', { name: 'Edit API-only user', level: 1 });
    this.backButton = page.getByRole('link', { name: 'Back to users' });
    this.saveButton = page.getByRole('button', { name: 'Save' });
    this.cancelButton = page.getByRole('button', { name: 'Cancel' });
  }

  /** Direct navigation. Specs typically reach this page via the row's Edit action. */
  async goto(userId: number): Promise<void> {
    await this.page.goto(`/settings/users/${userId}/edit`);
    await expect(this.humanHeading.or(this.apiUserHeading)).toBeVisible();
  }
}
