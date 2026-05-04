import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';

/**
 * /packs/new and /packs/:id/edit — create / edit pack form.
 *
 * The target picker is a react-select widget that doesn't expose standard
 * ARIA combobox/listbox roles reliably. We fall back to its stable
 * library-generated class names (`.Select-*`, `.target-option__wrapper`)
 * and document the fallback inline. When Fleet adds a `data-testid`
 * upstream on these widgets we can switch.
 */
export class PackEditPage {
  readonly page: Page;
  readonly navbar: Navbar;

  readonly nameInput: Locator;
  readonly descriptionInput: Locator;
  readonly saveButton: Locator;
  readonly editHeading: Locator;

  // Target picker (react-select) — CSS fallback with rationale
  readonly targetPickerPlaceholder: Locator;
  readonly targetSearchInput: Locator;
  readonly targetDropdownMenu: Locator;
  readonly firstHostOption: Locator;
  readonly uniqueHostCount: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);

    this.nameInput = page.getByRole('textbox', { name: 'Name' });
    this.descriptionInput = page.getByRole('textbox', { name: 'Description' });
    this.saveButton = page.getByRole('button', { name: /save/i });
    this.editHeading = page.getByRole('heading', { name: /edit pack/i });

    // react-select library classes (no reliable ARIA role on its trigger)
    this.targetPickerPlaceholder = page.locator('.Select-placeholder');
    this.targetSearchInput = page.locator('.Select-input input');
    this.targetDropdownMenu = page.locator('.Select-menu');
    this.firstHostOption = page.locator('.target-option__wrapper.is-host').first();
    this.uniqueHostCount = page.getByText(/unique host/);
  }

  async gotoNew(): Promise<void> {
    await this.page.goto('/packs/new');
    await expect(this.nameInput).toBeVisible();
  }

  /** Fill the form with a name and description. */
  async fillBasics(name: string, description: string): Promise<void> {
    await this.nameInput.fill(name);
    await this.descriptionInput.fill(description);
  }

  /**
   * Open the target picker, search for hosts matching `query`, and add the
   * first matching host to the pack.
   */
  async addFirstHostTarget(query: string): Promise<void> {
    await this.targetPickerPlaceholder.click();
    await this.targetSearchInput.fill(query);
    await expect(this.targetDropdownMenu).toBeVisible();

    await expect(this.firstHostOption).toBeVisible();
    // Each host option row contains a dedicated "add" button (.target-option__add-btn)
    // rendered by Fleet's <Button variant="icon">. Click it directly — the inner
    // SVG has pointer-events:none, so clicking the button avoids needing force.
    await this.firstHostOption.locator('.target-option__add-btn').click();

    await expect(this.uniqueHostCount).toBeVisible();
  }

  /** Click "Save query pack" and wait for redirect to the edit page. */
  async saveNew(): Promise<void> {
    await this.page.getByRole('button', { name: /save query pack/i }).click();
    await expect(this.page).toHaveURL(/\/packs\/\d+/);
    await expect(this.editHeading).toBeVisible();
  }

  /** On the edit page, update description and click Save. */
  async updateDescription(description: string): Promise<void> {
    await this.descriptionInput.fill(description);
    await this.saveButton.click();
  }
}
