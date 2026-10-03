import { Page, Locator, expect } from '@playwright/test';

/**
 * The "Manage enroll secrets" modal, its "Add secret" editor and its "Delete
 * secret" confirmation. Reached from the Hosts page's gear menu, from a fleet's
 * settings page, or — because those buttons are themselves gated in gitops
 * mode — from the Hosts page via `?manage_enroll_secrets=1`, which the router
 * strips once the modal is open.
 *
 * **Every row action is scoped to one secret, by its value.** Fleet saves the
 * list it has cached minus or plus one secret, and Fleet's global list is what
 * the simulated hosts re-enroll with, so an action that landed on the wrong row
 * would delete a secret the instance depends on. There is deliberately no
 * "first row" shortcut here.
 */
export class EnrollSecretModal {
  readonly page: Page;
  readonly modal: Locator;

  readonly addSecretButton: Locator;
  readonly doneButton: Locator;
  /** One per secret. Fleet's own `data-testid` on `EnrollSecretRow`. */
  readonly rows: Locator;

  /** "Add secret" editor, pre-filled with a generated secret. */
  readonly editor: Locator;
  readonly editorSecretInput: Locator;
  readonly editorSaveButton: Locator;

  readonly deleteModal: Locator;
  readonly deleteConfirmButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // Fleet's Modal renders a role-less container; the BEM modifier is what
    // separates this one from any other modal the host page can open. The
    // modal's own form carries the same base class, so the container class
    // comes along to keep the two apart.
    this.modal = page.locator('.enroll-secret-modal.modal__modal_container');

    this.addSecretButton = this.modal.getByRole('button', { name: 'Add secret' });
    this.doneButton = this.modal.getByRole('button', { name: 'Done' });
    this.rows = this.modal.locator('[data-testid="osquery-secret"]');

    // The editor shares its "Add secret" title with the button above; its
    // helper text is unique to it.
    this.editor = page
      .locator('.modal__modal_container')
      .filter({ hasText: 'Must contain at least 32 characters' });
    this.editorSecretInput = this.editor.getByRole('textbox', { name: 'Secret' });
    this.editorSaveButton = this.editor.getByRole('button', { name: 'Save', exact: true });

    this.deleteModal = page
      .locator('.modal__modal_container')
      .filter({ hasText: 'Hosts can no longer enroll using this secret.' });
    this.deleteConfirmButton = this.deleteModal.getByRole('button', { name: 'Delete', exact: true });
  }

  /**
   * Opens the modal over the Hosts page — the global list without a fleet id,
   * else that fleet's. This entry point has no gitops gate of its own, so it
   * reaches the modal whatever the mode is set to.
   */
  async goto(fleetId?: number): Promise<void> {
    const fleet = fleetId === undefined ? '' : `fleet_id=${fleetId}&`;
    await this.page.goto(`/hosts/manage?${fleet}manage_enroll_secrets=1`);
    await expect(this.modal).toBeVisible();
  }

  /**
   * Waits until the modal lists `count` secrets. The modal renders its empty
   * state ("You have no enroll secrets", with Add secret live) for a moment
   * before the list arrives, and a secret saved in that moment would replace
   * the whole list — so pass the API's count and wait before adding.
   */
  async expectLoaded(count: number): Promise<void> {
    await expect(this.rows).toHaveCount(count);
  }

  /**
   * The row holding `secret`. The value sits in the row's (password-type)
   * input's `value` attribute; nothing else in the row names it.
   */
  rowFor(secret: string): Locator {
    return this.rows.filter({ has: this.page.locator(`input[value="${secret}"]`) });
  }

  /**
   * A row's four controls, for reading their state — the gitops-mode specs
   * check which are gated. Act on a secret through `copy` / `delete`, which
   * find the row by value.
   */
  rowControls(row: Locator): { edit: Locator; delete: Locator; copy: Locator; show: Locator } {
    return {
      edit: row.getByRole('button', { name: 'Edit enroll secret' }),
      delete: row.getByRole('button', { name: 'Delete enroll secret' }),
      copy: row.getByRole('button', { name: 'Copy to clipboard' }),
      show: row.getByRole('button', { name: 'Show secret' }),
    };
  }

  /** Adds `secret` through the editor, replacing the generated value. */
  async add(secret: string): Promise<void> {
    await this.addSecretButton.click();
    await expect(this.editor).toBeVisible();
    await this.editorSecretInput.fill(secret);
    await this.editorSaveButton.click();
    await expect(this.editor).toBeHidden();
  }

  /** Adds a secret, keeping the editor's generated value; returns it. */
  async addGenerated(): Promise<string> {
    await this.addSecretButton.click();
    await expect(this.editor).toBeVisible();
    const secret = await this.editorSecretInput.inputValue();
    await this.editorSaveButton.click();
    await expect(this.editor).toBeHidden();
    return secret;
  }

  /** Copies `secret` with its row's copy button and waits for "Copied!". */
  async copy(secret: string): Promise<void> {
    const row = this.rowFor(secret);
    await expect(row).toHaveCount(1);
    await row.getByRole('button', { name: 'Copy to clipboard' }).click();
    await expect(row.getByText('Copied!')).toBeVisible();
  }

  /** Deletes `secret` — only its row — through the confirmation modal. */
  async delete(secret: string): Promise<void> {
    const row = this.rowFor(secret);
    await expect(row).toHaveCount(1);
    await row.getByRole('button', { name: 'Delete enroll secret' }).click();
    await expect(this.deleteModal).toBeVisible();
    await this.deleteConfirmButton.click();
    await expect(this.deleteModal).toBeHidden();
  }

  async close(): Promise<void> {
    await this.doneButton.click();
    await expect(this.modal).toBeHidden();
  }
}
