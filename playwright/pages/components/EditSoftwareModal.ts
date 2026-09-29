import { Page, Locator, expect } from '@playwright/test';
import { TargetLabelSelector, type LabelScopeOption } from './TargetLabelSelector';

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
 *
 * "Advanced options" is a collapsed section holding the four scripts Fleet
 * generates per package format — pre-install query, install, post-install and
 * uninstall. Each is an Ace editor; the rendered code lives in `.ace_content`
 * and the wrappers carry stable ids, which is the only thing separating the
 * four (they share every role and class).
 */

/**
 * Ace renders each line as its own element and drops blank lines from the text
 * layer, so `innerText` is never byte-identical to the script Fleet stored.
 * Normalising both sides — trailing whitespace off, empty lines out — compares
 * what the user can actually read against what the API holds.
 */
export const normalizeScript = (text: string): string =>
  text
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .filter((line) => line.length > 0)
    .join('\n');

export class EditSoftwareModal {
  readonly page: Page;
  readonly modal: Locator;
  readonly selfServiceToggle: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;
  readonly confirmModal: Locator;
  readonly confirmSaveButton: Locator;

  readonly advancedOptionsToggle: Locator;
  /** The package's label scope — the dropdown variant (Include any / Include all / Exclude any). */
  readonly targets: TargetLabelSelector;
  readonly preInstallQueryEditor: Locator;
  readonly installScriptEditor: Locator;
  readonly postInstallScriptEditor: Locator;
  readonly uninstallScriptEditor: Locator;

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

    this.advancedOptionsToggle = this.modal.getByRole('button', { name: 'Advanced options' });
    this.targets = new TargetLabelSelector(this.modal);

    // The four editors are identical in role, class and accessible name; only
    // the Ace wrapper's id tells them apart. `.ace_content` holds the rendered
    // code (see `normalizeScript` for why its text needs normalising).
    this.preInstallQueryEditor = this.modal.locator('#preInstallQuery .ace_content');
    this.installScriptEditor = this.modal.locator('#install-script .ace_content');
    this.postInstallScriptEditor = this.modal.locator('#post-install-script-editor .ace_content');
    this.uninstallScriptEditor = this.modal.locator('#uninstall-script-editor .ace_content');
  }

  async expectOpen(): Promise<void> {
    await expect(this.modal).toBeVisible();
    await expect(this.selfServiceToggle).toBeVisible();
  }

  /** Expand "Advanced options" and wait for the scripts to render. Idempotent. */
  async openAdvancedOptions(): Promise<void> {
    if (!(await this.installScriptEditor.isVisible())) {
      await this.advancedOptionsToggle.click();
    }
    await expect(this.installScriptEditor).toBeVisible();
    await expect(this.uninstallScriptEditor).toBeVisible();
  }

  /** The code one Advanced-options editor shows, normalised for comparison. */
  async scriptText(editor: Locator): Promise<string> {
    return normalizeScript(await editor.innerText());
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
   * Scopes the package to `labels` under `option` — or back to All hosts —
   * replacing any scope it had: ticked labels are unticked first, once each.
   */
  async setTarget(target: { option: LabelScopeOption; labels: string[] } | 'All hosts'): Promise<void> {
    if (target === 'All hosts') {
      await this.targets.chooseAllHosts();
      return;
    }
    await this.targets.chooseCustom();
    const ticked = await this.targets.root
      .getByRole('checkbox', { checked: true })
      .evaluateAll((boxes) => boxes.map((b) => b.getAttribute('aria-label') ?? ''));
    for (const name of ticked) {
      const box = this.targets.labelCheckbox(name);
      await box.click();
      await expect(box).not.toBeChecked();
    }
    await this.targets.scope(target.option, target.labels);
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
