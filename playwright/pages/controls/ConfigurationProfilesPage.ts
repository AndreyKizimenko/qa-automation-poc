import { Page, Locator, expect, Download } from '@playwright/test';
import { clickHoverAction } from '../components/clickHoverAction';
import { ContentList } from '../components/ContentList';
import { Navbar } from '../components/Navbar';
import { TargetLabelSelector, type LabelMode } from '../components/TargetLabelSelector';
import { TeamDropdown } from '../components/TeamDropdown';
import { Toast } from '../components/Toast';

/**
 * A profile's custom target, as the Add / Edit profile page sets it. Omit it for
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
 * Adding and editing happen on a page of their own, not in a modal:
 * "Add profile" opens `configuration-profiles/new` and a row's "Edit <name>"
 * opens `configuration-profiles/<uuid>`, both rendering `ProfileForm` under an
 * "Add profile" / "Edit profile" heading. Its file input has the id
 * `upload-profile` (the FileUploader used elsewhere in the app uses
 * `upload-file`); choosing a file loads it into the form's editor without
 * submitting, and a separate "Add profile" / "Update profile" button submits.
 * A saved form, and Cancel, return to the list.
 *
 * Each profile row is a `.profile-list-item` with details, edit, download
 * and trash buttons, each named for the profile ("Edit <name>"); the trash
 * opens a confirmation modal titled "Delete configuration profile". On
 * premium a targeted row also shows "N labels", with a warning icon when one
 * of them is broken.
 *
 * On premium the form carries the label target — see
 * {@link TargetLabelSelector}. Free renders none.
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

  /** The Add / Edit profile page's form. */
  readonly profileForm: Locator;
  /** The page's "Add profile" or "Edit profile" heading. */
  readonly formHeading: Locator;
  readonly uploadInput: Locator;
  readonly addProfileSubmitButton: Locator;
  readonly updateProfileButton: Locator;
  readonly formCancelButton: Locator;
  readonly formTargets: TargetLabelSelector;

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
    // and the populated-list heading; both open the Add profile page.
    this.addProfileButton = page.getByRole('button', { name: 'Add profile' }).first();
    this.listItem = page.locator('.profile-list-item');

    // A <form> has no role without an accessible name and Fleet gives this one
    // none, so its class (`ProfileForm`'s base) is the scope. It keeps the
    // submit button apart from the list's "Add profile" button of the same name.
    this.profileForm = page.locator('form.profile-form');
    this.formHeading = page.getByRole('heading', { name: /^(Add|Edit) profile$/, level: 1 });
    this.uploadInput = this.profileForm.locator('input#upload-profile');
    this.addProfileSubmitButton = this.profileForm.getByRole('button', { name: 'Add profile', exact: true });
    this.updateProfileButton = this.profileForm.getByRole('button', { name: 'Update profile', exact: true });
    this.formCancelButton = this.profileForm.getByRole('button', { name: 'Cancel', exact: true });
    this.formTargets = new TargetLabelSelector(this.profileForm);

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

  /** Opens the Add profile page from the list. */
  async openAddProfile(): Promise<void> {
    await this.addProfileButton.click();
    await expect(this.page).toHaveURL(/\/configuration-profiles\/new/);
    await expect(this.formHeading).toHaveText('Add profile');
    await expect(this.profileForm).toBeVisible();
  }

  /**
   * Chooses `filePath` on the open Add profile page. The submit button stays
   * disabled until the form has read the file, so its enabling is the wait.
   */
  private async chooseProfileFile(filePath: string): Promise<void> {
    await this.uploadInput.setInputFiles(filePath);
    await expect(this.addProfileSubmitButton).toBeEnabled();
  }

  /**
   * Uploads a profile through the Add profile page, custom-targeted when
   * `target` is given (premium only), and waits to be back on the list.
   */
  async uploadProfile(filePath: string, target?: ProfileTarget): Promise<void> {
    await this.openAddProfile();
    await this.chooseProfileFile(filePath);
    if (target) await this.setTarget(this.formTargets, target);
    await this.addProfileSubmitButton.click();
    await this.toast.expectSuccess('Successfully uploaded.');
    await this.expectBackOnList();
  }

  /** The form is gone and the list's heading shows: a save or Cancel returned to the list. */
  private async expectBackOnList(): Promise<void> {
    await expect(this.profileForm).toBeHidden();
    await expect(this.heading).toBeVisible();
  }

  /** Leaves the Add / Edit profile page through Cancel, saving nothing. */
  async cancelProfileForm(): Promise<void> {
    await this.formCancelButton.click();
    await this.expectBackOnList();
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
   * Opens a profile's Edit profile page, where its target is read and changed.
   * Like download and delete, the button only renders while the row is hovered.
   */
  async openEdit(name: string): Promise<void> {
    const row = this.itemByName(name);
    await clickHoverAction(row, row.getByRole('button', { name: `Edit ${name}`, exact: true }));
    await expect(this.formHeading).toHaveText('Edit profile');
    await expect(this.profileForm).toBeVisible();
  }

  /** Replaces the open Edit page's target with `target`, saves it, and waits to be back on the list. */
  async updateTarget(target: ProfileTarget | 'All hosts'): Promise<void> {
    if (target === 'All hosts') {
      await this.formTargets.chooseAllHosts();
    } else {
      await this.clearTicked(this.formTargets);
      await this.setTarget(this.formTargets, target);
    }
    await this.updateProfileButton.click();
    await this.toast.expectSuccess('Successfully updated profile.');
    await this.expectBackOnList();
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
   * Chooses a profile on the Add profile page and submits without asserting
   * success — for negative-path uploads where the caller asserts the
   * rejection message Fleet toasts. A refused upload leaves the page open.
   */
  async submitProfileUpload(filePath: string): Promise<void> {
    await this.openAddProfile();
    await this.chooseProfileFile(filePath);
    await this.addProfileSubmitButton.click();
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
