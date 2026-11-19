import { Locator, expect } from '@playwright/test';
import type { PolicyAutomationType } from '@helpers/api/policies';
import { ReactSelect } from './dropdowns';

const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Each Automation option's label, matched whole. The webhook or ticket option is
 * named after the scope's settings (`getTicketOrWebhookLabel`,
 * `pages/policies/helpers.ts`): "Send webhook" while the scope's failing-policies
 * webhook is on, "Create ticket" while a ticket integration is, and "Send webhook
 * or create ticket" while neither is.
 */
const OPTION_LABELS: Record<PolicyAutomationType | 'none', RegExp> = {
  none: /^None$/,
  webhook_or_ticket: /^(Send webhook or create ticket|Send webhook|Create ticket)$/,
  software: /^Install software$/,
  script: /^Run script$/,
  configuration_profile: /^Resend configuration profile$/,
  calendar: /^Calendar event$/,
  conditional_access: /^Conditional access$/,
};

/** What a fleet policy's Automation dropdown offers, in order. A global policy (and every policy on free) offers only the first two. */
export const FLEET_POLICY_AUTOMATION_OPTIONS: readonly (PolicyAutomationType | 'none')[] = [
  'none',
  'webhook_or_ticket',
  'software',
  'script',
  'configuration_profile',
  'calendar',
  'conditional_access',
];

/**
 * A policy's automation: Fleet's `PolicyAutomationsFields`, one **Automation**
 * dropdown choosing the policy's single automation, then the picker the choice
 * needs (Software, Script or Configuration profile), and for software and script
 * the "Continuous software & script automations" checkbox. Fleet renders it in
 * the policies list's per-policy **Manage automations** modal, the policy form
 * and the save-new-policy modal, so it's constructed on whichever container holds
 * it.
 *
 * Which options the dropdown offers is decided by the policy, not the tier: a
 * fleet policy's offers every type (Unassigned's all but Calendar event), a global
 * one's, and every policy's on free, only None and the webhook or ticket option.
 *
 * Each dropdown is a `DropdownWrapper` (react-select), whose combobox is a hidden
 * input that never takes a click, so each is found as the wrapper holding a
 * combobox of its accessible name: `Automation` for the type, the placeholder
 * for a picker. `DropdownWrapper` gives its FormField the `dropdown-wrapper`
 * class and nothing else names it.
 */
export class PolicyAutomationsFields {
  readonly root: Locator;
  /** The Automation dropdown: its `control` opens the menu, its `value` reads the chosen type. */
  readonly automation: ReactSelect;
  /** The open menu's options. Only one menu is open at a time. */
  readonly options: Locator;
  readonly continuousCheckbox: Locator;
  private readonly pickers: Record<'software' | 'script', ReactSelect>;

  constructor(container: Locator) {
    this.root = container;
    const page = container.page();
    const wrapperOf = (combobox: string): Locator =>
      container
        .locator('.dropdown-wrapper')
        .filter({ has: page.getByRole('combobox', { name: combobox, exact: true }) });
    this.automation = new ReactSelect(wrapperOf('Automation'));
    this.pickers = {
      software: new ReactSelect(wrapperOf('Select software')),
      script: new ReactSelect(wrapperOf('Select script')),
    };
    this.options = page.getByTestId('dropdown-option');
    this.continuousCheckbox = container.getByRole('checkbox', { name: 'continuous-automations-enabled', exact: true });
  }

  /** The open menu's option for `type`. */
  option(type: PolicyAutomationType | 'none'): Locator {
    return this.options.filter({ hasText: OPTION_LABELS[type] });
  }

  /**
   * Asserts the open menu's option for `type` is offered but can't be chosen, or
   * can. react-select 5.4 gives an option no role and no `aria-disabled`: only a
   * modifier class on the option's wrapper marks a disabled one.
   */
  async expectOptionDisabled(type: PolicyAutomationType, disabled: boolean): Promise<void> {
    const wrapper = this.root.page().locator('.react-select__option').filter({ has: this.option(type) });
    await expect(wrapper).toHaveCount(1);
    if (disabled) await expect(wrapper).toHaveClass(/react-select__option--is-disabled/);
    else await expect(wrapper).not.toHaveClass(/react-select__option--is-disabled/);
  }

  /** Opens the Automation dropdown's menu and waits for its first option. */
  async openAutomationMenu(): Promise<void> {
    await expect(this.automation.control).toBeVisible();
    await this.automation.control.click();
    await expect(this.option('none')).toBeVisible();
  }

  /** Closes the open menu by toggling its control, choosing nothing. Escape would also close the modal around it. */
  async closeAutomationMenu(): Promise<void> {
    await this.automation.control.click();
    await expect(this.options).toHaveCount(0);
  }

  /** Asserts the Automation dropdown shows `type` as the policy's automation. */
  async expectAutomation(type: PolicyAutomationType | 'none'): Promise<void> {
    await expect(this.automation.value).toHaveText(OPTION_LABELS[type]);
  }

  /** Chooses `type` as the policy's automation, which replaces any it had. */
  async chooseAutomation(type: PolicyAutomationType | 'none'): Promise<void> {
    await this.openAutomationMenu();
    await this.option(type).click();
    await this.expectAutomation(type);
  }

  /** The picker's chosen value: the title for Install software, the script for Run script. */
  selectedValue(picker: 'software' | 'script'): Locator {
    return this.pickers[picker].value;
  }

  /**
   * Opens the picker and chooses `value`. A software option is its label, then a
   * help text ("Linux (.deb) • 1.0.0") that runs straight on from it, so the label
   * is matched as a prefix and the match must be unique: give what you pick a name
   * no other option starts with.
   */
  private async pick(picker: 'software' | 'script', value: string): Promise<void> {
    const { control } = this.pickers[picker];
    await expect(control).toBeVisible();
    await control.click();
    const option = this.options.filter({ hasText: new RegExp(`^${esc(value)}`) });
    await expect(option).toHaveCount(1);
    await option.click();
    await expect(this.selectedValue(picker)).toHaveText(value);
  }

  /** Chooses Install software and picks the title the automation installs. */
  async installSoftware(title: string): Promise<void> {
    await this.chooseAutomation('software');
    await this.pick('software', title);
  }

  /** Chooses Run script and picks the script the automation runs. */
  async runScript(scriptName: string): Promise<void> {
    await this.chooseAutomation('script');
    await this.pick('script', scriptName);
  }

  /** Ticks or unticks Continuous and asserts it took. Fleet's checkbox is a `role="checkbox"` div carrying `aria-checked`. */
  async setContinuous(on: boolean): Promise<void> {
    await expect(this.continuousCheckbox).toBeVisible();
    if ((await this.continuousCheckbox.getAttribute('aria-checked')) !== String(on)) await this.continuousCheckbox.click();
    await expect(this.continuousCheckbox).toHaveAttribute('aria-checked', String(on));
  }
}
