import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../../components/Navbar';
import { UserFormFields } from './UserFormFields';

/**
 * `/settings/users/new/human` — sub-page that hosts the regular (human)
 * user-creation form. Reached from the Users list page via the "Add user"
 * dropdown → "Regular user" option.
 *
 * The form fields are shared with the Edit page via {@link UserFormFields}.
 * This page object wires only the page-level chrome (heading, action buttons,
 * confirmation toast) on top of the shared fields.
 */
export class CreateUserPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly form: UserFormFields;

  readonly heading: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.form = new UserFormFields(page);

    this.heading = page.getByRole('heading', { name: /create user|new user/i, level: 1 });
    this.submitButton = page.getByRole('button', { name: 'Add' });
    this.cancelButton = page.getByRole('button', { name: 'Cancel' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/settings/users/new/human');
    await expect(this.form.fullName).toBeVisible();
  }
}
