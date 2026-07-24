import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';
import { FileUploader } from '../components/FileUploader';
import { Toast } from '../components/Toast';

/**
 * /settings/integrations — the Integrations section, with a left-side nav
 * listing integration categories. The default subpage is "Ticket destinations".
 * Premium-only IdP / SCIM / Calendars / etc. subpages are gated on license.
 *
 * The MDM subpage (`/settings/integrations/mdm`) hosts the macOS EULA
 * upload/delete used by Apple automatic enrollment. That section only renders
 * when Apple Business Manager is configured on the instance.
 */
export class IntegrationsPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly uploader: FileUploader;
  readonly toast: Toast;

  /** Default subpage heading when landing on /settings/integrations. */
  readonly ticketDestinationsHeading: Locator;
  readonly scimText: Locator;

  // MDM subpage — EULA section.
  readonly eulaHeading: Locator;
  readonly eulaListItem: Locator;
  readonly eulaName: Locator;
  readonly eulaDeleteButton: Locator;
  readonly deleteEulaModal: Locator;
  readonly deleteEulaConfirmButton: Locator;

  // Host status webhook subpage (global).
  readonly hostStatusHeading: Locator;
  readonly hostStatusWebhookToggle: Locator;
  readonly hostStatusDestinationUrl: Locator;
  readonly hostStatusSaveButton: Locator;

  // SSO subpage — end-user authentication (IdP) form. The "Fleet users" tab
  // has the same field labels, so everything is scoped to this section.
  readonly endUserAuthSection: Locator;
  readonly idpNameField: Locator;
  readonly entityIdField: Locator;
  readonly metadataUrlField: Locator;
  readonly metadataField: Locator;
  readonly endUserAuthSaveButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.uploader = new FileUploader(page);
    this.toast = new Toast(page);

    this.ticketDestinationsHeading = page.getByRole('heading', {
      name: 'Ticket destinations',
      exact: true,
    });
    this.scimText = page.getByText(/SCIM/i);

    this.eulaHeading = page.getByRole('heading', {
      name: 'End user license agreement (EULA)',
    });
    // Fleet's ListItem renders as a role-less <div>; the uploaded EULA is the
    // only one on the page, so the BEM class is the handle.
    this.eulaListItem = page.locator('.eula-list-item');
    this.eulaName = this.eulaListItem.locator('.eula-list-item__list-item-name');
    // The delete control is an icon-only Button (no text, no aria-label); it's
    // distinguished from the sibling "open" button by its trash Icon, which
    // Fleet's Icon renders with data-testid="trash-icon".
    this.eulaDeleteButton = this.eulaListItem
      .locator('.eula-list-item__list-item-button')
      .filter({ has: page.locator('[data-testid="trash-icon"]') });

    this.deleteEulaModal = page
      .locator('.modal__modal_container')
      .filter({ hasText: 'Delete EULA' });
    this.deleteEulaConfirmButton = this.deleteEulaModal.getByRole('button', {
      name: 'Delete',
      exact: true,
    });

    this.hostStatusHeading = page.getByRole('heading', { name: 'Host status alerts' });
    // Fleet's Checkbox exposes the interactive element as role="checkbox" whose
    // accessible name is the `name` prop (not the visible label text).
    this.hostStatusWebhookToggle = page.getByRole('checkbox', { name: 'enableHostStatusWebhook' });
    this.hostStatusDestinationUrl = page.getByLabel('Destination URL');
    this.hostStatusSaveButton = page.getByRole('button', { name: 'Save', exact: true });

    // The end-user IdP form's root; the sibling "Fleet users" tab reuses the
    // same field labels, so scope every field/button to this section.
    this.endUserAuthSection = page.locator('.end-user-auth-section');
    this.idpNameField = this.endUserAuthSection.getByLabel('Identity provider name', { exact: true });
    this.entityIdField = this.endUserAuthSection.getByLabel('Entity ID', { exact: true });
    // Exact so "Metadata URL" and "Metadata" don't cross-match.
    this.metadataUrlField = this.endUserAuthSection.getByLabel('Metadata URL', { exact: true });
    this.metadataField = this.endUserAuthSection.getByLabel('Metadata', { exact: true });
    this.endUserAuthSaveButton = this.endUserAuthSection.getByRole('button', {
      name: 'Save',
      exact: true,
    });
  }

  async goto(): Promise<void> {
    await this.page.goto('/settings/integrations');
    await expect(this.ticketDestinationsHeading).toBeVisible();
  }

  /** MDM subpage. Anchors on the EULA heading (present when ABM is configured). */
  async gotoMdm(): Promise<void> {
    await this.page.goto('/settings/integrations/mdm');
    await expect(this.eulaHeading).toBeVisible();
  }

  /**
   * Stages a PDF into the EULA FileUploader (which auto-submits) and waits for
   * the uploaded EULA to render. `file` is a path or an in-memory payload.
   */
  async uploadEula(file: Parameters<FileUploader['setFile']>[0]): Promise<void> {
    await this.uploader.setFile(file);
    await expect(this.eulaListItem).toBeVisible();
  }

  /** Deletes the uploaded EULA via the trash action + confirmation modal. */
  async deleteEula(): Promise<void> {
    await this.eulaDeleteButton.click();
    await expect(this.deleteEulaModal).toBeVisible();
    await this.deleteEulaConfirmButton.click();
    await expect(this.eulaListItem).toBeHidden();
  }

  /** Global host-status webhook settings page. */
  async gotoHostStatusWebhook(): Promise<void> {
    await this.page.goto('/settings/integrations/host-status-webhook');
    await expect(this.hostStatusHeading).toBeVisible();
  }

  /**
   * Ensures the host-status-webhook enable checkbox matches `enabled`. Reading
   * aria-checked keeps it idempotent regardless of the starting config state.
   */
  async setHostStatusWebhookEnabled(enabled: boolean): Promise<void> {
    const checked = (await this.hostStatusWebhookToggle.getAttribute('aria-checked')) === 'true';
    if (checked !== enabled) await this.hostStatusWebhookToggle.click();
    await expect(this.hostStatusWebhookToggle).toHaveAttribute('aria-checked', String(enabled));
  }

  /** Saves the host-status-webhook card and waits for the success toast. */
  async saveHostStatusWebhook(): Promise<void> {
    await this.hostStatusSaveButton.click();
    await this.toast.expectSuccess('Successfully updated settings.');
  }

  /** SSO → End users tab, where the end-user IdP form lives. */
  async gotoSsoEndUsers(): Promise<void> {
    await this.page.goto('/settings/integrations/sso/end-users');
    await expect(this.endUserAuthSection).toBeVisible();
  }

  /** Fills the end-user IdP form (client-side only — does not save). */
  async fillEndUserAuth(fields: {
    idpName: string;
    entityId: string;
    metadataUrl: string;
  }): Promise<void> {
    await this.idpNameField.fill(fields.idpName);
    await this.entityIdField.fill(fields.entityId);
    await this.metadataUrlField.fill(fields.metadataUrl);
  }
}
