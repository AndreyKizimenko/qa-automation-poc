import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';
import { FileUploader } from '../components/FileUploader';
import { Toast } from '../components/Toast';

/**
 * /settings/integrations — the Integrations section, with a left-side nav
 * listing integration categories. The default subpage is "Ticketing".
 * Premium-only IdP / SCIM / Calendars / etc. subpages are gated on license.
 *
 * The MDM subpage (`/settings/integrations/mdm`) opens with a card per MDM
 * platform (each "Edit" opens that platform's page; Apple's is
 * `/settings/integrations/mdm/apple`, the Apple Push Certificate details), on
 * both tiers. On premium with Apple Business Manager configured it also hosts
 * the macOS EULA upload/delete and the end user migration workflow.
 */
export class IntegrationsPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly uploader: FileUploader;
  readonly toast: Toast;

  /** Default subpage heading when landing on /settings/integrations. */
  readonly ticketingHeading: Locator;
  readonly scimText: Locator;

  // MDM subpage — the platform cards and the Apple MDM page.
  readonly mdmHeading: Locator;
  readonly mdmNavLink: Locator;
  readonly appleMdmCard: Locator;
  readonly appleMdmEditButton: Locator;
  readonly apnsHeading: Locator;
  readonly turnOffMdmButton: Locator;
  readonly renewCertificateButton: Locator;

  // MDM subpage — end user migration workflow (premium, ABM configured).
  readonly migrationSection: Locator;
  readonly migrationSwitch: Locator;
  readonly migrationVoluntaryRadio: Locator;
  readonly migrationForcedRadio: Locator;
  readonly migrationWebhookUrl: Locator;
  readonly migrationSaveButton: Locator;

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
  /** "Percentage of hosts" and "Number of days": rendered only while the webhook is enabled. */
  readonly hostStatusPercentageField: Locator;
  readonly hostStatusDaysField: Locator;

  // SSO subpage — end-user authentication (IdP) form. The "Fleet users" tab
  // has the same field labels, so everything is scoped to this section.
  readonly endUserAuthSection: Locator;
  readonly idpNameField: Locator;
  readonly entityIdField: Locator;
  readonly metadataUrlField: Locator;
  readonly metadataField: Locator;
  readonly endUserAuthSaveButton: Locator;
  readonly idpNameError: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.uploader = new FileUploader(page);
    this.toast = new Toast(page);

    this.ticketingHeading = page.getByRole('heading', { name: 'Ticketing', exact: true });
    this.scimText = page.getByText(/SCIM/i);

    this.mdmHeading = page.getByRole('heading', { name: 'Mobile device management (MDM)', level: 2 });
    this.mdmNavLink = page.getByRole('navigation', { name: 'settings' }).getByRole('link', { name: 'MDM', exact: true });
    // Fleet's SectionCard is a role-less <div> whose only distinguishing content
    // is its status line, and the MDM page shows several, each with an "Edit".
    this.appleMdmCard = page
      .locator('.section-card')
      .filter({ hasText: 'Apple (macOS, iOS, iPadOS) MDM turned on.' });
    this.appleMdmEditButton = this.appleMdmCard.getByRole('button', { name: 'Edit' });
    this.apnsHeading = page.getByRole('heading', { name: 'Apple Push Certificate Portal', level: 1 });
    // Located only to assert they're offered. A spec never clicks either: one
    // turns Apple MDM off for the instance, the other starts a certificate renewal.
    this.turnOffMdmButton = page.getByRole('button', { name: 'Turn off MDM' });
    this.renewCertificateButton = page.getByRole('button', { name: 'Renew certificate' });

    this.migrationSection = this.settingsSection('End user migration workflow');
    // The Slider is a role="switch" button with no accessible name; it's the
    // section's only switch.
    this.migrationSwitch = this.migrationSection.getByRole('switch');
    this.migrationVoluntaryRadio = this.migrationSection.getByRole('radio', { name: 'Voluntary' });
    this.migrationForcedRadio = this.migrationSection.getByRole('radio', { name: 'Forced' });
    // The "Webhook URL" InputField's label has no htmlFor, so the input is reached by its name.
    this.migrationWebhookUrl = this.migrationSection.locator('input[name="webhook_url"]');
    this.migrationSaveButton = this.migrationSection.getByRole('button', { name: 'Save', exact: true });

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
    // Fleet's react-select v1 Dropdown: `getByLabel` doesn't reach its combobox
    // and the wrapper has no role, so the wrapper class plus the label text is
    // the handle. Inside it the current value is a selected `role=option`.
    this.hostStatusPercentageField = page
      .locator('.form-field--dropdown')
      .filter({ hasText: 'Percentage of hosts' });
    this.hostStatusDaysField = page.locator('.form-field--dropdown').filter({ hasText: 'Number of days' });

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
    // Fleet's FormField renders a field's validation error *in place of* its
    // label (`{error || label}`), so the error is the label element's text and
    // `idpNameField`'s accessible name changes while it is showing. Assert on
    // the message, not on the field, once validation has fired.
    this.idpNameError = this.endUserAuthSection.getByText(
      'Enter an identity provider name',
      { exact: true },
    );
  }

  async goto(): Promise<void> {
    await this.page.goto('/settings/integrations');
    await expect(this.ticketingHeading).toBeVisible();
  }

  /** Settings → Integrations → MDM, from anywhere the Integrations nav is showing. */
  async openMdm(): Promise<void> {
    await this.mdmNavLink.click();
    await expect(this.mdmHeading).toBeVisible();
  }

  /** The Apple MDM card's Edit → the Apple Push Certificate details. */
  async openAppleMdm(): Promise<void> {
    await this.appleMdmEditButton.click();
    await expect(this.page).toHaveURL(/\/settings\/integrations\/mdm\/apple/);
    await expect(this.apnsHeading).toBeVisible();
  }

  /**
   * One value on the Apple MDM page, by its term ("Common name (CN)", "Renew
   * date"). The page renders a bare `<dl>` of `<div><dt/><dd/></div>` pairs —
   * not Fleet's DataSet, and `dt` exposes no accessible name — so the pair is
   * found by its term's exact text.
   */
  apnsValue(term: string): Locator {
    return this.page
      .locator('dl > div')
      .filter({ has: this.page.locator('dt').getByText(term, { exact: true }) })
      .locator('dd');
  }

  /** Turns the migration workflow's switch on or off (client-side until Save). */
  async setMigrationEnabled(enabled: boolean): Promise<void> {
    if ((await this.migrationSwitch.getAttribute('aria-checked')) !== String(enabled)) {
      await this.migrationSwitch.click();
    }
    await expect(this.migrationSwitch).toHaveAttribute('aria-checked', String(enabled));
  }

  /**
   * Picks a migration mode. Fleet's radio inputs are visually hidden behind a
   * styled control, so this clicks the `<label>` wrapping the radio, then
   * asserts the radio took it.
   */
  async chooseMigrationMode(mode: 'voluntary' | 'forced'): Promise<void> {
    const name = mode === 'forced' ? 'Forced' : 'Voluntary';
    // The `has` locator is rooted at the page: one built from the section would
    // look for the section inside each label.
    await this.migrationSection
      .locator('label')
      .filter({ has: this.page.getByRole('radio', { name, exact: true }) })
      .click();
    await expect(mode === 'forced' ? this.migrationForcedRadio : this.migrationVoluntaryRadio).toBeChecked();
  }

  /** Saves the migration workflow and waits for its own toast. */
  async saveMigration(): Promise<void> {
    await this.toast.dismissAll();
    await this.migrationSaveButton.click();
    await this.toast.expectSuccess('Successfully updated end user migration.');
  }

  /** MDM subpage. Anchors on the EULA heading (present when ABM is configured). */
  async gotoMdm(): Promise<void> {
    await this.page.goto('/settings/integrations/mdm');
    await expect(this.eulaHeading).toBeVisible();
  }

  /**
   * One titled card on an Integrations subpage (Fleet's `SettingsSection`).
   * The card is an unnamed `<section>`, which exposes no landmark role, so
   * the tag is filtered by its exact heading.
   */
  settingsSection(title: string): Locator {
    return this.page
      .locator('section')
      .filter({ has: this.page.getByRole('heading', { name: title, exact: true }) });
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

  /** The option a host-status dropdown currently shows ("5%", "3 days"). */
  hostStatusValue(field: Locator): Locator {
    return field.getByRole('option', { selected: true });
  }

  /**
   * Picks `option` ("5%", "3 days") in one of the host-status dropdowns. The
   * shown value opens the menu, which renders as a `listbox`; only one is open
   * at a time.
   */
  async selectHostStatusOption(field: Locator, option: string): Promise<void> {
    await this.hostStatusValue(field).click();
    await this.page.getByRole('listbox').getByRole('option', { name: option, exact: true }).click();
    await expect(this.hostStatusValue(field)).toHaveText(option);
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
