import { Page, Locator, expect } from '@playwright/test';

/**
 * The "Transfer" modal raised from the hosts list's bulk-select bar or from a
 * host's Actions menu. Offers every fleet except the one the hosts are already
 * on, plus "Unassigned" when they are on a fleet.
 *
 * Fleet's `Modal` renders its title in a `<span>` with no `role="dialog"`, so
 * the container is scoped by the modal's own `transfer-host-modal` class.
 */
export class TransferHostModal {
  readonly page: Page;
  readonly modal: Locator;
  readonly transferButton: Locator;
  readonly cancelButton: Locator;
  /** "Add a fleet" — the escape hatch to fleet settings when the target doesn't exist yet. */
  readonly addFleetLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.modal = page.locator('.transfer-host-modal');
    this.transferButton = this.modal.getByRole('button', { name: 'Transfer', exact: true });
    this.cancelButton = this.modal.getByRole('button', { name: 'Cancel', exact: true });
    this.addFleetLink = this.modal.getByRole('link', { name: 'Add a fleet' });
  }

  /**
   * Opens the fleet dropdown. It's a react-select whose visible control is a
   * role-less div, so the control class is the only stable click target.
   */
  async openFleetDropdown(): Promise<void> {
    await this.modal.locator('.react-select__control').click();
  }

  /**
   * Types into the searchable fleet dropdown to narrow the options. Leaves the
   * menu open so callers can assert on what remains.
   */
  async searchFleet(term: string): Promise<void> {
    await this.openFleetDropdown();
    await this.modal.getByRole('combobox').fill(term);
  }

  /** Currently-listed fleet options (Fleet's DropdownWrapper tags each one). */
  get fleetOptions(): Locator {
    return this.page.getByTestId('dropdown-option');
  }

  /** Picks a destination fleet by its exact visible name. */
  async selectFleet(name: string): Promise<void> {
    await this.openFleetDropdown();
    await this.fleetOptions.filter({ hasText: new RegExp(`^${name}$`) }).click();
  }

  /** Picks a destination and submits, waiting for the modal to close. */
  async transferTo(name: string): Promise<void> {
    await this.selectFleet(name);
    await this.transferButton.click();
    await expect(this.modal).toBeHidden();
  }
}
