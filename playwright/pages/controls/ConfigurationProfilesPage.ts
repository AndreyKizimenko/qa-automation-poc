import { Page, Locator, expect, Download } from '@playwright/test';
import { clickHoverAction } from '../components/clickHoverAction';
import { ContentList } from '../components/ContentList';
import { Navbar } from '../components/Navbar';
import { TargetLabelSelector, type LabelMode } from '../components/TargetLabelSelector';
import { TeamDropdown } from '../components/TeamDropdown';
import { Toast } from '../components/Toast';

/**
 * A profile's custom target, as the Add / Edit profile modal sets it. Omit it for
 * "All hosts". Profiles exclude "any" of their Exclude labels; there is no mode.
 */
export interface ProfileTarget {
  include?: { labels: string[]; mode?: LabelMode };
  exclude?: string[];
}

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
 * Each profile row is a `.profile-list-item` with details, edit, download
 * and trash buttons, each named for the profile ("Edit <name>"); the trash
 * opens a confirmation modal titled "Delete configuration profile". On
 * premium a targeted row also shows "N labels", with a warning icon when one
 * of them is broken.
 *
 * On premium both modals carry the label target — see
 * {@link TargetLabelSelector}. Free renders neither.
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

  readonly uploadTargets: TargetLabelSelector;

  readonly editModal: Locator;
  readonly editTargets: TargetLabelSelector;
  readonly editUpdateButton: Locator;
  readonly editCancelButton: Locator;

  readonly deleteModal: Locator;
  readonly deleteConfirmButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.list = new ContentList(page);
    this.teamDropdown = new TeamDropdown(page);
    this.toast = new Toast(page);

    // Exact: a fleet with no profiles also shows a "No configuration profiles" heading.
    this.heading = page.getByRole('heading', { name: 'Configuration profiles', exact: true });
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
    this.uploadTargets = new TargetLabelSelector(this.uploadModal);

    this.editModal = page.locator('.modal__modal_container').filter({ hasText: 'Edit profile' });
    this.editTargets = new TargetLabelSelector(this.editModal);
    this.editUpdateButton = this.editModal.getByRole('button', { name: 'Update profile', exact: true });
    this.editCancelButton = this.editModal.getByRole('button', { name: 'Cancel', exact: true });

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

  /**
   * Uploads a profile through the Add profile modal, custom-targeted when
   * `target` is given (premium only).
   */
  async uploadProfile(filePath: string, target?: ProfileTarget): Promise<void> {
    await this.addProfileButton.click();
    await expect(this.uploadModal).toBeVisible();
    await this.uploadInput.setInputFiles(filePath);
    if (target) await this.setTarget(this.uploadTargets, target);
    await this.uploadConfirmButton.click();
    await this.toast.expectSuccess('Successfully uploaded.');
    await expect(this.uploadModal).toBeHidden();
  }

  private async setTarget(selector: TargetLabelSelector, target: ProfileTarget): Promise<void> {
    await selector.chooseCustom();
    if (target.include) await selector.include(target.include.labels, target.include.mode);
    if (target.exclude) await selector.exclude(target.exclude);
  }

  /** The row's "N labels" count — premium, targeted profiles only. */
  labelCount(name: string): Locator {
    return this.itemByName(name).getByText(/^\d+ labels?$/);
  }

  /** The warning icon a row shows beside its label count when a label is broken. */
  brokenLabelWarning(name: string): Locator {
    // Icon renders an unnamed <svg>; its test id is the only handle.
    return this.itemByName(name).getByTestId('warning-icon');
  }

  /**
   * One of a profile row's action buttons, by the name `ProfileListItem` gives
   * it: "View <name> details", "Edit <name>", "Download <name>", "Delete <name>".
   * They render only while the row is hovered, so hover `itemByName(name)` before
   * reading one.
   */
  rowButton(name: string, action: 'View' | 'Edit' | 'Download' | 'Delete'): Locator {
    const label = action === 'View' ? `View ${name} details` : `${action} ${name}`;
    return this.itemByName(name).getByRole('button', { name: label, exact: true });
  }

  /**
   * Opens a profile's Edit profile modal, where its target is read and changed.
   * Like download and delete, the button only renders while the row is hovered.
   */
  async openEdit(name: string): Promise<void> {
    const row = this.itemByName(name);
    await clickHoverAction(row, row.getByRole('button', { name: `Edit ${name}`, exact: true }));
    await expect(this.editModal).toBeVisible();
  }

  /** Replaces the open Edit modal's target with `target` and saves it. */
  async updateTarget(target: ProfileTarget | 'All hosts'): Promise<void> {
    if (target === 'All hosts') {
      await this.editTargets.chooseAllHosts();
    } else {
      await this.clearTicked(this.editTargets);
      await this.setTarget(this.editTargets, target);
    }
    await this.editUpdateButton.click();
    await this.toast.expectSuccess('Successfully updated profile.');
    await expect(this.editModal).toBeHidden();
  }

  /**
   * Unticks every label on both tabs, so a new target isn't merged with the old
   * one. Reads the ticked names first and unticks each once, so a checkbox that
   * refuses the click fails its assertion instead of looping.
   */
  private async clearTicked(selector: TargetLabelSelector): Promise<void> {
    await selector.chooseCustom();
    for (const tab of ['Include', 'Exclude'] as const) {
      await (tab === 'Include' ? selector.includeTab : selector.excludeTab).click();
      const names = await selector
        .panel(tab)
        .getByRole('checkbox', { checked: true })
        .evaluateAll((boxes) => boxes.map((b) => b.getAttribute('aria-label') ?? ''));
      for (const name of names) {
        const box = selector.labelCheckbox(name, tab);
        await box.click();
        await expect(box).not.toBeChecked();
      }
    }
  }

  /**
   * Stages a profile in the Add-profile modal and submits without asserting
   * success — for negative-path uploads where the caller asserts the
   * rejection message Fleet renders.
   */
  async submitProfileUpload(filePath: string): Promise<void> {
    await this.addProfileButton.click();
    await expect(this.uploadModal).toBeVisible();
    await this.uploadInput.setInputFiles(filePath);
    await this.uploadConfirmButton.click();
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

  /**
   * Delete `name` if the list has it. Waits for the list to have rendered
   * — rows or the empty state — before looking: a check that runs ahead of the
   * list's fetch sees nothing, skips the delete, and the upload that follows is
   * refused as a duplicate ("a profile with this name already exists"), which
   * is how a serial group's retry fails after a leftover from its first attempt.
   */
  async deleteIfExists(name: string): Promise<void> {
    await expect(this.list.firstItem.or(this.list.emptyState)).toBeVisible();
    if (await this.itemByName(name).isVisible()) {
      await this.deleteProfile(name);
    }
  }
}
