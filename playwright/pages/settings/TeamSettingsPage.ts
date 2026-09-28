import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';
import { Toast } from '../components/Toast';

/**
 * `/settings/fleets/settings?fleet_id=:id` — a single fleet's settings: its own
 * host-status webhook (separate from the global one), its host-expiry override,
 * and the "Activity & data retention" switches that stop Fleet collecting this
 * fleet's contribution to the dashboard's historical charts. Premium only, and
 * reachable by that fleet's team admin as well as global admins.
 *
 * The two retention checkboxes are phrased as **disables** — ticking one turns
 * collection off — and each is greyed out with a "Disabled globally" tooltip
 * when the matching global switch is already off. Turning one on raises a
 * confirmation, because Fleet deletes the data it has already collected.
 */
export class TeamSettingsPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly toast: Toast;

  readonly webhookSectionHeading: Locator;
  /**
   * Fleet's `Checkbox` exposes `role="checkbox"` whose accessible name is the
   * `name` prop, not the visible label; read state from `aria-checked`.
   */
  readonly hostStatusWebhookCheckbox: Locator;
  readonly destinationUrlInput: Locator;
  readonly saveButton: Locator;

  // Host expiry settings.
  readonly hostExpiryCheckbox: Locator;
  readonly hostExpiryLabel: Locator;
  readonly hostExpiryHelpText: Locator;

  // Activity & data retention — historical chart collection.
  readonly retentionSectionHeading: Locator;
  readonly disableHostsOnlineCheckbox: Locator;
  readonly disableVulnerabilitiesCheckbox: Locator;
  readonly confirmDisableModal: Locator;
  readonly confirmDisableDatasets: Locator;
  readonly confirmDisableButton: Locator;
  readonly confirmDisableCancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.toast = new Toast(page);

    this.webhookSectionHeading = page.getByRole('heading', { name: 'Webhook settings' });
    this.hostStatusWebhookCheckbox = page.getByRole('checkbox', {
      name: 'teamHostStatusWebhookEnabled',
    });
    // Targeted by placeholder, not label: this InputField is tooltip-wrapped and
    // its label isn't `htmlFor`-associated, and when the value is invalid
    // FormField swaps the label text for the error message. The placeholder is
    // stable through both.
    this.destinationUrlInput = page.getByPlaceholder('https://server.com/example');
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });

    this.hostExpiryCheckbox = page.getByRole('checkbox', { name: 'enableHostExpiry' });
    // The tooltip hangs off the visible label, not the role="checkbox" element,
    // so hovering the label is what reveals it.
    this.hostExpiryLabel = page.getByText('Enable host expiry', { exact: true });
    this.hostExpiryHelpText = page.getByText(
      /Host expiry is globally enabled in organization settings/,
    );

    this.retentionSectionHeading = page.getByRole('heading', {
      name: 'Activity & data retention',
    });
    // Same Checkbox component as above: the accessible name is the `name` prop,
    // not the visible "Disable ... historical reporting" label.
    this.disableHostsOnlineCheckbox = page.getByRole('checkbox', {
      name: 'disableHostsActive',
    });
    this.disableVulnerabilitiesCheckbox = page.getByRole('checkbox', {
      name: 'disableVulnerabilities',
    });

    // Fleet's Modal renders no role="dialog"; scoped by the component's class.
    this.confirmDisableModal = page.locator('.confirm-data-collection-disable-modal');
    // The datasets whose collected data this save deletes, one list item each.
    // Only newly-disabled datasets are listed, so a dataset already off is absent.
    this.confirmDisableDatasets = this.confirmDisableModal.getByRole('listitem');
    this.confirmDisableButton = this.confirmDisableModal.getByRole('button', {
      name: 'Save and disable',
    });
    this.confirmDisableCancelButton = this.confirmDisableModal.getByRole('button', {
      name: 'Cancel',
    });
  }

  async goto(fleetId: number): Promise<void> {
    await this.page.goto(`/settings/fleets/settings?fleet_id=${fleetId}`);
    await expect(this.webhookSectionHeading).toBeVisible();
  }

  /** Ticks or unticks the fleet's host-status webhook, reading current state from aria-checked. */
  async setHostStatusWebhookEnabled(enabled: boolean): Promise<void> {
    const checked = (await this.hostStatusWebhookCheckbox.getAttribute('aria-checked')) === 'true';
    if (checked !== enabled) await this.hostStatusWebhookCheckbox.click();
    await expect(this.hostStatusWebhookCheckbox).toHaveAttribute(
      'aria-checked',
      String(enabled),
    );
  }

  /**
   * Ticks or unticks one of the retention checkboxes. `disabled: true` stops
   * collection — the checkbox is a *disable* switch, so this reads the same way
   * the label does.
   */
  async setHistoricalDataDisabled(
    dataset: 'hostsOnline' | 'vulnerabilities',
    disabled: boolean,
  ): Promise<void> {
    const checkbox =
      dataset === 'hostsOnline'
        ? this.disableHostsOnlineCheckbox
        : this.disableVulnerabilitiesCheckbox;
    const checked = (await checkbox.getAttribute('aria-checked')) === 'true';
    if (checked !== disabled) await checkbox.click();
    await expect(checkbox).toHaveAttribute('aria-checked', String(disabled));
  }

  async save(): Promise<void> {
    await this.saveButton.click();
  }

  /**
   * Confirms the modal Fleet raises when a save turns collection off, because
   * the data it already holds is deleted. Waits for the modal to clear and the
   * success toast to show. Callers assert the modal's contents between
   * {@link save} and this.
   */
  async confirmDisable(): Promise<void> {
    await expect(this.confirmDisableModal).toBeVisible();
    await this.confirmDisableButton.click();
    await expect(this.confirmDisableModal).toBeHidden();
    await this.toast.expectSuccess('Successfully updated settings.');
  }
}
