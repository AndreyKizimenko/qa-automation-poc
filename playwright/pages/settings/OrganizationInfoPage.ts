import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';
import { Toast } from '../components/Toast';
import type { OrgLogoMode } from '@helpers/api/config';

/**
 * /settings/organization/info — the Organization info subpage. Has an h1
 * "Settings" for the whole Settings section plus an h2 "Organization info"
 * for this subpage. Mutating this page changes global app config, so specs
 * snapshot + restore via the config API helper.
 *
 * The page carries two logo cards, one per theme ("Organization logo (light
 * mode)" / "(dark mode)"). Each has a pencil "Replace logo" and a trash
 * "Remove logo" button — both `ariaLabel`-ed, so they resolve by role — plus a
 * preview and a hidden `<input type="file">`. "Remove logo" is disabled while
 * the card is showing the built-in Fleet avatar.
 *
 * Picking a file only *stages* it: the preview swaps to a local blob URL and
 * nothing reaches Fleet until Save, which PATCHes org_info and then runs the
 * logo upload/delete per mode. That is also why a staged-but-unsaved card looks
 * identical to a saved one — verify a logo change through the API or a reload,
 * not from the staged preview.
 */
export class OrganizationInfoPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly toast: Toast;

  readonly heading: Locator;
  readonly orgNameInput: Locator;
  readonly supportUrlInput: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.toast = new Toast(page);

    this.heading = page.getByRole('heading', { name: 'Organization info' });
    this.orgNameInput = page.getByRole('textbox', { name: 'Organization name' });
    this.supportUrlInput = page.getByRole('textbox', { name: 'Organization support URL' });
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });
  }

  async goto(): Promise<void> {
    await this.page.goto('/settings/organization/info');
    await expect(this.heading).toBeVisible();
    await expect(this.orgNameInput).toBeVisible();
  }

  async setOrgName(name: string): Promise<void> {
    await this.orgNameInput.fill(name);
  }

  async setSupportUrl(url: string): Promise<void> {
    await this.supportUrlInput.fill(url);
  }

  /**
   * One logo card. Fleet labels the cards with a plain `<span>` carrying no
   * role, so the card is scoped by its BEM class filtered on that label text —
   * which is also the only thing telling the two cards apart.
   */
  logoCard(mode: OrgLogoMode): Locator {
    return this.page
      .locator('.org-info__logo-card')
      .filter({ hasText: `Organization logo (${mode} mode)` });
  }

  /**
   * A card's preview image. Fleet adds a `default-fleet-logo` class while the
   * card is showing the built-in avatar, which is how a spec tells "no custom
   * logo" from "custom logo" without a screenshot.
   */
  logoPreview(mode: OrgLogoMode): Locator {
    return this.logoCard(mode).getByRole('img', { name: 'Organization Logo' });
  }

  replaceLogoButton(mode: OrgLogoMode): Locator {
    return this.logoCard(mode).getByRole('button', { name: 'Replace logo' });
  }

  removeLogoButton(mode: OrgLogoMode): Locator {
    return this.logoCard(mode).getByRole('button', { name: 'Remove logo' });
  }

  /**
   * Stage a logo file for one mode. The card's file input is hidden and driven
   * by the pencil button, so the file goes straight to the input; it has no id
   * and no label, leaving its BEM class as the handle.
   */
  async setLogo(mode: OrgLogoMode, filePath: string): Promise<void> {
    await this.logoCard(mode).locator('input.org-info__hidden-file-input').setInputFiles(filePath);
    await expect(this.removeLogoButton(mode)).toBeEnabled();
  }

  /** Stage the removal of one mode's logo. Takes effect on Save. */
  async removeLogo(mode: OrgLogoMode): Promise<void> {
    await this.removeLogoButton(mode).click();
    await expect(this.removeLogoButton(mode)).toBeDisabled();
  }

  /** Save the form and wait for the success toast. */
  async save(): Promise<void> {
    await this.saveButton.click();
    await this.toast.expectSuccess('Successfully updated settings.');
  }
}
