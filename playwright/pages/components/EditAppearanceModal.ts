import { Page, Locator, expect } from '@playwright/test';
import { Toast } from './Toast';

/**
 * The "Edit appearance" modal on a software title's detail page (Fleet's
 * `EditIconModal`). Owns two title-level presentation settings that share one
 * Save: the **custom icon** and the **display name**.
 *
 * Icon rules, enforced client-side before any request leaves the browser
 * (`EditIconModal.onFileSelect`): PNG only, 100 KB or less, square, and between
 * 120x120 and 1024x1024. A rejected file raises an error toast and leaves the
 * staged file untouched — nothing is uploaded until Save.
 *
 * The file control has two shapes and swaps between them, which is why
 * {@link setIcon} targets `input[type="file"]` inside the modal rather than a
 * fixed id. With nothing staged, Fleet renders its `FileUploader` (a hidden
 * `input#upload-file` behind a "Choose file" button). Once a file is staged it
 * renders `FileDetails` instead — the uploader input unmounts and a second,
 * id-less input takes over behind the pencil "Replace file" button. Exactly one
 * file input exists at a time, so `.first()` is unambiguous in both states.
 *
 * Save's toast names what changed: "Successfully edited <name>." for an icon
 * upload, "Successfully removed icon from <name>." for a removal, and
 * "Successfully renamed <name> to <new>." / "Successfully removed custom name
 * for <name>." for the display name.
 */
export class EditAppearanceModal {
  readonly page: Page;
  readonly modal: Locator;
  readonly displayNameInput: Locator;
  readonly fileInput: Locator;
  readonly chooseFileButton: Locator;
  readonly fileName: Locator;
  readonly fileDescription: Locator;
  readonly removeFileButton: Locator;
  readonly iconPreview: Locator;
  readonly selfServiceIconPreview: Locator;
  readonly fleetPreviewTab: Locator;
  readonly selfServicePreviewTab: Locator;
  readonly fleetPreview: Locator;
  readonly selfServicePreview: Locator;
  readonly saveButton: Locator;
  readonly toast: Toast;

  constructor(page: Page) {
    this.page = page;
    // Fleet's Modal renders no role="dialog"; `.edit-icon-modal` is the
    // component's own BEM root and is unique on the page.
    this.modal = page.locator('.edit-icon-modal');

    // Exact match: the modal's preview pane renders the title's own
    // `<h1 aria-label="software display name">`, which a substring match on
    // "Display name" also resolves.
    this.displayNameInput = this.modal.getByRole('textbox', {
      name: 'Display name',
      exact: true,
    });
    this.fileInput = this.modal.locator('input[type="file"]').first();
    this.chooseFileButton = this.modal.getByRole('button', { name: 'Choose file' });

    // FileDetails renders the staged file's name and "Software icon • WxH px"
    // as plain divs with no role, so both are reached by their BEM classes.
    this.fileName = this.modal.locator('.file-details__name');
    this.fileDescription = this.modal.locator('.file-details__description');

    // The trash button wraps a bare `<label for="delete-file">` around an icon,
    // so it computes no accessible name. Fleet does stamp the icon with
    // data-testid, which is the only stable handle on the control.
    this.removeFileButton = this.modal.locator(
      '.file-details__delete [data-testid="trash-icon"]',
    );

    this.iconPreview = this.modal.getByAltText('Uploaded icon preview');
    this.selfServiceIconPreview = this.modal.getByAltText('Uploaded self-service icon');
    this.fleetPreviewTab = this.modal.getByRole('tab', { name: 'Fleet' });
    this.selfServicePreviewTab = this.modal.getByRole('tab', { name: 'Self service' });

    // The two preview cards. Both are role-less `Card` divs whose only stable
    // handle is the component's own BEM class; scoping matters because each
    // renders its own copy of the title's name and icon.
    this.fleetPreview = this.modal.locator('.edit-icon-modal__preview-card__fleet');
    this.selfServicePreview = this.modal.locator(
      '.self-service-preview__preview-card__self-service',
    );

    this.saveButton = this.modal.getByRole('button', { name: 'Save', exact: true });
    this.toast = new Toast(page);
  }

  async expectOpen(): Promise<void> {
    await expect(this.modal).toBeVisible();
    await expect(this.displayNameInput).toBeVisible();
  }

  /** True when a custom icon is already attached (the file card is showing). */
  async hasStagedIcon(): Promise<boolean> {
    return (await this.fileName.count()) > 0;
  }

  /**
   * Stage an icon file. Works whether the modal is showing the empty uploader
   * or an existing file card — see the class note on the input swap. Nothing is
   * sent to Fleet until {@link save}.
   */
  async setIcon(filePath: string): Promise<void> {
    await this.fileInput.setInputFiles(filePath);
  }

  /**
   * Stage a rejected icon and assert the error toast it raises. Fleet validates
   * in the browser, so the file card must stay exactly as it was.
   */
  async expectIconRejected(filePath: string, message: string | RegExp): Promise<void> {
    await this.setIcon(filePath);
    await this.toast.expectError(message);
  }

  /** Clear the staged icon, putting the empty "Choose file" uploader back. */
  async removeIcon(): Promise<void> {
    await this.removeFileButton.click();
    await expect(this.chooseFileButton).toBeVisible();
  }

  /**
   * Switch preview tabs. The modal previews the same title twice — as the Fleet
   * admin sees it and as an end user sees it in Self-service — and each pane
   * renders its own copy of the staged icon and name.
   */
  async showPreview(tab: 'Fleet' | 'Self service'): Promise<void> {
    const target = tab === 'Fleet' ? this.fleetPreviewTab : this.selfServicePreviewTab;
    await target.click();
    await expect(target).toHaveAttribute('aria-selected', 'true');
  }

  /** Set (or, with an empty string, clear) the custom display name. */
  async setDisplayName(name: string): Promise<void> {
    await this.displayNameInput.fill(name);
  }

  /** Save and wait for the toast naming the change, then for the modal to close. */
  async save(expectedToast: string | RegExp): Promise<void> {
    await expect(this.saveButton).toBeEnabled();
    await this.saveButton.click();
    await this.toast.expectSuccess(expectedToast);
    await expect(this.modal).toBeHidden();
  }
}
