import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';
import { Toast } from '../components/Toast';

/**
 * `/settings/fleets/settings?fleet_id=:id` — a single fleet's settings: its own
 * host-status webhook (separate from the global one) and its host-expiry
 * override. Premium only, and reachable by that fleet's team admin as well as
 * global admins.
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

  async save(): Promise<void> {
    await this.saveButton.click();
  }
}
