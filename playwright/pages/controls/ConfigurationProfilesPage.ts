import { Page, Locator, expect, Download } from '@playwright/test';
import { clickHoverAction } from '../components/clickHoverAction';
import { ContentList } from '../components/ContentList';
import { Navbar } from '../components/Navbar';
import { TeamDropdown } from '../components/TeamDropdown';
import { Toast } from '../components/Toast';

/**
 * `/controls/os-settings/configuration-profiles` — the list of custom MDM
 * configuration profiles uploaded for a fleet (.mobileconfig for Apple,
 * .json for Apple/Android, .xml for Windows).
 *
 * Upload uses an `Add profile` modal whose file input has the id
 * `upload-profile` (different from the FileUploader component used
 * elsewhere in the app, which uses `upload-file`). Selecting a file does
 * not auto-submit; the modal stages the file and a separate "Add profile"
 * button submits.
 *
 * Each profile row is a `.profile-list-item` with download and trash icon
 * buttons; the trash opens a confirmation modal titled "Delete
 * configuration profile".
 */
export class ConfigurationProfilesPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly list: ContentList;
  readonly teamDropdown: TeamDropdown;
  readonly toast: Toast;

  readonly heading: Locator;
  readonly addProfileButton: Locator;
  readonly listItem: Locator;

  readonly uploadModal: Locator;
  readonly uploadInput: Locator;
  readonly uploadConfirmButton: Locator;

  readonly deleteModal: Locator;
  readonly deleteConfirmButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.list = new ContentList(page);
    this.teamDropdown = new TeamDropdown(page);
    this.toast = new Toast(page);

    this.heading = page.getByRole('heading', { name: 'Configuration profiles' });
    // The "Add profile" button label is shared between the empty-state card
    // and the populated-list heading; both open the same modal.
    this.addProfileButton = page.getByRole('button', { name: 'Add profile' }).first();
    this.listItem = page.locator('.profile-list-item');

    // Fleet's Modal component renders as a <div> with no role/aria-modal
    // (catalogued in the reviewer skill as a legitimate class fallback);
    // scope by container class plus the modal's heading text.
    this.uploadModal = page.locator('.modal__modal_container').filter({ hasText: 'Add profile' });
    this.uploadInput = page.locator('input#upload-profile');
    // The modal's submit button shares its label with the page-level
    // "Add profile" button — scope the locator inside the modal.
    this.uploadConfirmButton = this.uploadModal.getByRole('button', { name: 'Add profile' });

    this.deleteModal = page.locator('.modal__modal_container').filter({ hasText: 'Delete configuration profile' });
    this.deleteConfirmButton = this.deleteModal.getByRole('button', { name: 'Delete', exact: true });
  }

  /** `fleetId=0` targets "No team". Omit to use the current fleet. */
  async goto(opts: { fleetId?: number } = {}): Promise<void> {
    const qs = opts.fleetId !== undefined ? `?fleet_id=${opts.fleetId}` : '';
    await this.page.goto(`/controls/os-settings/configuration-profiles${qs}`);
    await expect(this.heading).toBeVisible();
  }

  itemByName(name: string): Locator {
    // Match the row whose title span equals `name` exactly. `hasText` would
    // substring-match on full row content (name + platform tag + date),
    // letting a sibling row match when the platform tag or adjacent text
    // happens to share a substring with another profile's name.
    return this.listItem.filter({ has: this.page.getByText(name, { exact: true }) });
  }

  async uploadProfile(filePath: string): Promise<void> {
    await this.addProfileButton.click();
    await expect(this.uploadModal).toBeVisible();
    await this.uploadInput.setInputFiles(filePath);
    await this.uploadConfirmButton.click();
    await this.toast.expectSuccess('Successfully uploaded.');
    await expect(this.uploadModal).toBeHidden();
  }

  /** Triggers a download for the profile and returns the Download handle. */
  async downloadProfile(name: string): Promise<Download> {
    const row = this.itemByName(name);
    const downloadPromise = this.page.waitForEvent('download');
    await clickHoverAction(row, row.getByTestId('download-icon'));
    return downloadPromise;
  }

  async deleteProfile(name: string): Promise<void> {
    const row = this.itemByName(name);
    await clickHoverAction(row, row.getByTestId('trash-icon'));
    await expect(this.deleteModal).toBeVisible();
    await this.deleteConfirmButton.click();
    await this.toast.expectSuccess('Successfully deleted.');
    await expect(row).toBeHidden();
  }

  async deleteIfExists(name: string): Promise<void> {
    const row = this.itemByName(name);
    if (await row.isVisible().catch(() => false)) {
      await this.deleteProfile(name);
    }
  }
}
