import { Locator, expect } from '@playwright/test';

/**
 * The rows of Fleet's `PolicyAutomationsFields`, by the `name` Fleet gives each
 * row's checkbox — which is also the checkbox's accessible name (Fleet's
 * `Checkbox` sets `aria-label={name}`), so the names are snake_case, not the
 * visible labels.
 */
export type PolicyAutomationKey =
  | 'ticket_webhook'
  | 'install_software'
  | 'run_script'
  | 'resend_configuration_profile'
  | 'calendar_event'
  | 'conditional_access';

/** What a fleet policy's modal lists, in order. A global policy (and every policy on free) lists only the first. */
export const FLEET_POLICY_AUTOMATION_KEYS: readonly PolicyAutomationKey[] = [
  'ticket_webhook',
  'install_software',
  'run_script',
  'resend_configuration_profile',
  'calendar_event',
  'conditional_access',
];

const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A policy's automations — one checkbox row per automation type, a picker beside
 * Install software and Run script, and the "Continuous software & script
 * automations" checkbox. Fleet renders the same component
 * (`pages/policies/components/PolicyAutomationsFields`) in the policies list's
 * per-policy **Manage automations** modal, the policy form and the save-new-policy
 * modal, so it's constructed on whichever container holds it.
 *
 * Which rows render is decided by the policy, not the tier: a fleet policy lists
 * all six; a global one — and every policy on free — lists only *Send webhook or
 * create ticket*, with no Continuous checkbox.
 *
 * The rows are a role-less `<table>`, and a row's accessible name starts with its
 * checkbox's name and goes on with the picker's selected value, so rows are
 * matched by that prefix.
 */
export class PolicyAutomationsFields {
  readonly root: Locator;
  readonly continuousCheckbox: Locator;

  constructor(container: Locator) {
    this.root = container;
    this.continuousCheckbox = container.getByRole('checkbox', { name: 'continuous-automations-enabled', exact: true });
  }

  row(key: PolicyAutomationKey): Locator {
    return this.root.getByRole('row', { name: new RegExp(`^${key}\\b`) });
  }

  checkbox(key: PolicyAutomationKey): Locator {
    return this.root.getByRole('checkbox', { name: key, exact: true });
  }

  /** Every automation checkbox the fields render, Continuous excluded. */
  allCheckboxes(): Locator {
    return this.root.getByRole('row').getByRole('checkbox');
  }

  /**
   * The picker's chosen value — the title for Install software, the script for
   * Run script. react-select renders it in a role-less div; the class is all that
   * marks it.
   */
  selectedValue(key: 'install_software' | 'run_script'): Locator {
    return this.row(key).locator('.react-select__single-value');
  }

  /** Ticks or unticks `checkbox` and asserts it took. Fleet's checkbox is a `role="checkbox"` div carrying `aria-checked`. */
  private async setChecked(checkbox: Locator, on: boolean): Promise<void> {
    await expect(checkbox).toBeVisible();
    if ((await checkbox.getAttribute('aria-checked')) !== String(on)) await checkbox.click();
    await expect(checkbox).toHaveAttribute('aria-checked', String(on));
  }

  async setAutomation(key: PolicyAutomationKey, on: boolean): Promise<void> {
    await this.setChecked(this.checkbox(key), on);
  }

  async setContinuous(on: boolean): Promise<void> {
    await this.setChecked(this.continuousCheckbox, on);
  }

  /**
   * Opens the row's picker and chooses `value`. The picker is react-select: its
   * `combobox` input sits under the control and never takes a click, so the
   * control's class is the click target, and the options carry Fleet's
   * `dropdown-option` test id. An option is its label as a bare text node, then —
   * for software — a help-text span ("Linux (.deb) • 1.0.0") whose text runs
   * straight on from it, so the label is matched as a prefix and the match must be
   * unique: give what you pick a name no other option starts with.
   */
  private async pick(key: 'install_software' | 'run_script', value: string): Promise<void> {
    const control = this.row(key).locator('.react-select__control');
    await expect(control).toBeVisible();
    await control.click();
    const option = this.root
      .page()
      .getByTestId('dropdown-option')
      .filter({ hasText: new RegExp(`^${esc(value)}`) });
    await expect(option).toHaveCount(1);
    await option.click();
    await expect(this.selectedValue(key)).toHaveText(value);
  }

  /** Ticks Install software and picks the title the automation installs. */
  async installSoftware(title: string): Promise<void> {
    await this.setAutomation('install_software', true);
    await this.pick('install_software', title);
  }

  /** Ticks Run script and picks the script the automation runs. */
  async runScript(scriptName: string): Promise<void> {
    await this.setAutomation('run_script', true);
    await this.pick('run_script', scriptName);
  }
}
