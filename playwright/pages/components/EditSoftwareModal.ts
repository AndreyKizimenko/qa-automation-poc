import { Page, Locator, expect } from '@playwright/test';

/**
 * The Edit-software modal opened from a software title's Library accordion row
 * (Fleet's `EditSoftwareModal` → `PackageForm`). Its title is "Edit package"
 * for premium custom packages (`canActivateMultiplePackages`) and
 * "Edit software" otherwise; both render the same form, so the container is
 * scoped by whichever title is present.
 *
 * The "Self-service" control is a Fleet `<Slider>`, rendered as
 * `<button role="switch">` with no accessible name — the visible "Self-service"
 * text is a sibling span. State is read from `aria-checked`. In edit mode the
 * deploy slider is not rendered, so a single `role="switch"` is unambiguous.
 *
 * Saving opens a "Save changes?" confirmation whenever the form changed by more
 * than nothing but `self_service` — and *enabling* self-service always trips
 * that, because it reveals the categories field (an extra diffed change). While
 * the confirmation is open the edit modal is CSS-hidden (not closed), so
 * `save()` drives the confirmation through and waits for both to clear.
 */
export class EditSoftwareModal {
  readonly page: Page;
  readonly modal: Locator;
  readonly selfServiceToggle: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;
  readonly confirmModal: Locator;
  readonly confirmSaveButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Fleet's Modal renders the title in a role-less <span> (no role="dialog"),
    // so each container is scoped by class + the visible title text.
    this.modal = page
      .locator('.modal__modal_container')
      .filter({ hasText: /Edit (package|software)/ });

    this.selfServiceToggle = this.modal.getByRole('switch');
    this.saveButton = this.modal.getByRole('button', { name: 'Save', exact: true });
    this.cancelButton = this.modal.getByRole('button', { name: 'Cancel', exact: true });

    this.confirmModal = page
      .locator('.modal__modal_container')
      .filter({ hasText: 'Save changes?' });
    this.confirmSaveButton = this.confirmModal.getByRole('button', { name: 'Save', exact: true });
  }

  async expectOpen(): Promise<void> {
    await expect(this.modal).toBeVisible();
    await expect(this.selfServiceToggle).toBeVisible();
  }

  async isSelfServiceOn(): Promise<boolean> {
    return (await this.selfServiceToggle.getAttribute('aria-checked')) === 'true';
  }

  /** Flips the Self-service slider and confirms the new `aria-checked` state. */
  async toggleSelfService(): Promise<void> {
    const target = !(await this.isSelfServiceOn());
    await this.selfServiceToggle.click();
    await expect(this.selfServiceToggle).toHaveAttribute('aria-checked', String(target));
  }

  /**
   * Saves the edit, confirms the "Save changes?" dialog, and waits for both
   * modals to clear. The confirm-button click auto-waits for the dialog, so
   * it also covers the brief gap between the edit save and the confirmation.
   */
  async save(): Promise<void> {
    await this.saveButton.click();
    await this.confirmSaveButton.click();
    await expect(this.confirmModal).toBeHidden();
    await expect(this.modal).toBeHidden();
  }
}
