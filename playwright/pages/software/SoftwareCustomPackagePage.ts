import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';
import { FileUploader } from '../components/FileUploader';
import { setAceValue } from '../components/aceEditor';
import { Toast } from '../components/Toast';

/**
 * `/software/add/package` — the "Custom package" tab of the Add software
 * flow. Reuses the shared `FileUploader` component (`input#upload-file`).
 * Submitting the "Add software" button uploads the package and Fleet
 * redirects to the new title's detail page.
 *
 * Toast on success: "<filename> successfully added." (the filename text
 * comes from the uploaded file), so we match on the loose `/successfully
 * added/` regex rather than pinning the exact filename.
 */
export class SoftwareCustomPackagePage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly uploader: FileUploader;
  readonly toast: Toast;

  readonly heading: Locator;
  readonly customPackageTab: Locator;
  readonly addSoftwareButton: Locator;
  readonly cancelButton: Locator;
  readonly progressModal: Locator;
  /** The upload's "N%" readout under the progress bar, shown while the file is sent. */
  readonly progressPercent: Locator;
  /**
   * "Deploy" — installs the package automatically on every host missing it, by
   * creating an `[Install software] <title> (<ext>)` policy with an install
   * automation. Fleet's `Slider` gives the switch no accessible name (its label
   * is a sibling span), so it's scoped by the slider's own wrapper class.
   * Only rendered once a file is chosen.
   */
  readonly deploySwitch: Locator;
  /**
   * "Advanced options" — disabled until a file is chosen ("Choose a file to
   * modify advanced options.") — and the two scripts a package has no default
   * for. The editors are Ace instances told apart only by their wrappers' ids,
   * the same ids the Edit modal uses.
   */
  readonly advancedOptionsButton: Locator;
  readonly preInstallQueryEditor: Locator;
  readonly postInstallScriptEditor: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.uploader = new FileUploader(page);
    this.toast = new Toast(page);

    this.heading = page.getByRole('heading', { name: 'Add software', level: 1 });
    this.customPackageTab = page.getByRole('tab', { name: 'Custom package' });
    this.addSoftwareButton = page.getByRole('button', { name: 'Add software', exact: true });
    this.cancelButton = page.getByRole('button', { name: 'Cancel' });
    this.progressModal = page.locator('.file-progress-modal');
    this.progressPercent = this.progressModal.getByText(/^\d{1,3}%$/);
    this.deploySwitch = page.locator('.software-deploy-slider__container').getByRole('switch');
    this.advancedOptionsButton = page.getByRole('button', { name: 'Advanced options' });
    this.preInstallQueryEditor = page.locator('#preInstallQuery .ace_content');
    this.postInstallScriptEditor = page.locator('#post-install-script-editor .ace_content');
  }

  /**
   * Direct URL navigation. Reserved for verification steps and subsequent
   * sub-tests; the primary `add` sub-test reaches this view by clicking
   * "Add software" on the titles page and then `openTab()`.
   *
   * `fleetId` is required for the page to render content (use 0 for no-team).
   */
  async goto(opts: { fleetId: number }): Promise<void> {
    await this.page.goto(`/software/add/package?fleet_id=${opts.fleetId}`);
    await this.expectLoaded();
  }

  /**
   * Switch to this tab from another Add software tab. Idempotent — a no-op
   * if already selected. Carries the current `fleet_id` query param.
   */
  async openTab(): Promise<void> {
    if ((await this.customPackageTab.getAttribute('aria-selected')) !== 'true') {
      await this.customPackageTab.click();
      await expect(this.page).toHaveURL(/\/software\/add\/package/);
    }
    await this.expectLoaded();
  }

  async expectLoaded(): Promise<void> {
    await expect(this.heading).toBeVisible();
    await expect(this.customPackageTab).toBeVisible();
  }

  /**
   * Stages the file, clicks "Add software", waits for the upload progress
   * modal to clear, and confirms Fleet redirected to the new title's
   * detail page. Returns the new title's id (parsed from the URL).
   *
   * `preInstallQuery` / `postInstallScript` are entered under Advanced options
   * before the upload; the install and uninstall scripts keep the defaults
   * Fleet generates for the file.
   */
  async uploadPackage(
    filePath: string,
    opts: { deploy?: boolean; preInstallQuery?: string; postInstallScript?: string } = {},
  ): Promise<number> {
    await this.uploader.setFile(filePath);
    if (opts.preInstallQuery !== undefined || opts.postInstallScript !== undefined) {
      await expect(this.advancedOptionsButton).toBeEnabled();
      if (!(await this.preInstallQueryEditor.isVisible())) await this.advancedOptionsButton.click();
      if (opts.preInstallQuery !== undefined) {
        await setAceValue(this.preInstallQueryEditor, opts.preInstallQuery);
        await expect(this.preInstallQueryEditor).toHaveText(opts.preInstallQuery);
      }
      if (opts.postInstallScript !== undefined) {
        await setAceValue(this.postInstallScriptEditor, opts.postInstallScript);
      }
    }
    if (opts.deploy) {
      await this.deploySwitch.click();
      await expect(this.deploySwitch).toHaveAttribute('aria-checked', 'true');
    }
    await expect(this.addSoftwareButton).toBeEnabled();
    await this.addSoftwareButton.click();

    // Progress modal may flash briefly or not at all for tiny packages; a real
    // upload clears in a few seconds, so 45s is generous headroom under load.
    if (await this.progressModal.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await expect(this.progressModal).toBeHidden({ timeout: 45_000 });
    }

    await this.page.waitForURL(/\/software\/titles\/\d+/, { timeout: 30_000 });
    await this.toast.expectSuccess(/successfully added/);

    const url = new URL(this.page.url());
    const id = parseInt(url.pathname.match(/\/software\/titles\/(\d+)/)?.[1] ?? '0', 10);
    if (!id) throw new Error(`Could not parse software title id from URL: ${this.page.url()}`);
    return id;
  }
}
