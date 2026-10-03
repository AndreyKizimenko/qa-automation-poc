import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';
import { Toast } from '../components/Toast';

/**
 * /settings/organization/advanced — the Advanced options subpage under
 * Organization settings.
 *
 * One Save covers the whole card: `performSave` posts host-lifecycle,
 * activity-retention, features and server-authentication values together
 * regardless of which one was edited.
 */
export class OrganizationAdvancedPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly toast: Toast;
  readonly heading: Locator;

  /** SMTP domain — the card's most inert field, unused on the QA instances. */
  readonly domainInput: Locator;
  /**
   * SMTP "Verify SSL certs" and "Enable STARTTLS" — `smtp_settings.verify_ssl_certs`
   * / `enable_start_tls`, inert while SMTP is off (it is on both instances).
   * Fleet's `Checkbox` takes its accessible name from the `name` prop, not the
   * visible label.
   */
  readonly verifySslCertsCheckbox: Locator;
  readonly enableStartTlsCheckbox: Locator;
  readonly saveButton: Locator;

  /**
   * Activity & data retention — the deployment-wide historical collection
   * switches behind the dashboard's chart card.
   *
   * **These read the opposite way round from the per-fleet ones on
   * {@link TeamSettingsPage}.** Here the label is an *enable*
   * ("Hosts online historical reporting", ticked = still collecting); there it
   * is a *disable* ("Disable hosts online historical reporting", ticked =
   * stopped). Both render Fleet's `Checkbox`, whose accessible name is the
   * `name` prop rather than the visible label, so the two surfaces share the
   * `disableHostsActive` / `disableVulnerabilities` names despite the flipped
   * meaning. Read state from `aria-checked`.
   *
   * Turning either off deletes the data already collected for **every** fleet,
   * so specs read these and never write them.
   */
  /**
   * Features → "Script execution". Ticked means scripts **may** run: Fleet binds
   * the checkbox to the inverse of `server_settings.scripts_disabled`. Like the
   * retention switches, its accessible name is Fleet's `name` prop
   * (`disableScripts`), not the visible label.
   */
  readonly scriptExecutionCheckbox: Locator;

  readonly retentionSectionHeading: Locator;
  readonly hostsOnlineHistoricalCheckbox: Locator;
  /** Premium-only: free's Advanced options never renders this checkbox. */
  readonly vulnerabilitiesHistoricalCheckbox: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.toast = new Toast(page);
    // The page has no "Advanced options" title of its own — it opens straight
    // into its sections, of which Host lifecycle is the first.
    this.heading = page.getByRole('heading', { name: 'Host lifecycle', exact: true });

    this.domainInput = page.getByLabel('Domain', { exact: true });
    this.verifySslCertsCheckbox = page.getByRole('checkbox', { name: 'verifySSLCerts' });
    this.enableStartTlsCheckbox = page.getByRole('checkbox', { name: 'enableStartTLS' });
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });

    this.scriptExecutionCheckbox = page.getByRole('checkbox', { name: 'disableScripts' });

    this.retentionSectionHeading = page.getByRole('heading', {
      name: 'Activity & data retention',
    });
    this.hostsOnlineHistoricalCheckbox = page.getByRole('checkbox', {
      name: 'disableHostsActive',
    });
    this.vulnerabilitiesHistoricalCheckbox = page.getByRole('checkbox', {
      name: 'disableVulnerabilities',
    });
  }

  async goto(): Promise<void> {
    await this.page.goto('/settings/organization/advanced');
    await expect(this.heading).toBeVisible();
  }

  async save(): Promise<void> {
    await this.saveButton.click();
  }
}
