import { Locator, expect } from '@playwright/test';

export type LabelMode = 'any' | 'all';

/**
 * Fleet's label-targeting control: "All hosts" or "Custom", then which labels.
 * Premium only — free renders no target at all. Named after Fleet's own
 * component (`components/TargetLabelSelector/`), which comes in two variants
 * sharing the `.target-label-selector` root and the two radios:
 *
 *  - **tabbed** (`TargetLabelSelector.tsx`) — profiles, declarations and
 *    policies. An **Include** and an **Exclude** tab, each a checkbox list with a
 *    "Search labels" field. Include has an Any / All toggle; Exclude has one only
 *    on policies (profiles exclude "any"). A label ticked on one tab is disabled
 *    on the other.
 *  - **dropdown** (`DropdownTargetLabelSelector.tsx`) — software and reports.
 *    One dropdown picks Include any / Include all / Exclude any for one list.
 *
 * Construct it on the form or modal that owns it. Fleet's radio inputs are
 * visually hidden behind a styled control, so a choice clicks the `<label>` that
 * wraps the radio and then asserts the radio took it.
 */
/**
 * A tab's accessible name — and so its panel's — is "Include" until the tab holds
 * a label, then "Include check": the check icon Fleet adds carries that text.
 */
const tabName = (tab: 'Include' | 'Exclude'): RegExp => new RegExp(`^${tab}( check)?$`);

export class TargetLabelSelector {
  readonly root: Locator;
  readonly allHostsRadio: Locator;
  readonly customRadio: Locator;
  readonly includeTab: Locator;
  readonly excludeTab: Locator;

  constructor(container: Locator) {
    // The root carries no role or accessible name; both variants set this class.
    this.root = container.locator('.target-label-selector');
    this.allHostsRadio = this.root.getByRole('radio', { name: 'All hosts', exact: true });
    this.customRadio = this.root.getByRole('radio', { name: 'Custom', exact: true });
    this.includeTab = this.root.getByRole('tab', { name: tabName('Include') });
    this.excludeTab = this.root.getByRole('tab', { name: tabName('Exclude') });
  }

  /**
   * Clicks the `<label>` wrapping the radio named `name` inside `within`, then
   * asserts the radio took it. The `has` locator is built from the page, not from
   * `within`: a `has` locator is matched *inside* each label, so one carrying the
   * container's chain would look for the container inside the label and match
   * nothing.
   */
  private async pick(within: Locator, name: string): Promise<void> {
    const radio = within.getByRole('radio', { name, exact: true });
    await within
      .locator('label')
      .filter({ has: within.page().getByRole('radio', { name, exact: true }) })
      .click();
    await expect(radio).toBeChecked();
  }

  async chooseAllHosts(): Promise<void> {
    await this.pick(this.root, 'All hosts');
  }

  async chooseCustom(): Promise<void> {
    await this.pick(this.root, 'Custom');
  }

  /** The tabbed variant's open panel for `tab`. */
  panel(tab: 'Include' | 'Exclude'): Locator {
    return this.root.getByRole('tabpanel', { name: tabName(tab) });
  }

  /** A tab's Any / All radio (Include always; Exclude on policies only). */
  modeRadio(tab: 'Include' | 'Exclude', mode: LabelMode): Locator {
    return this.panel(tab).getByRole('radio', { name: mode === 'all' ? 'All' : 'Any', exact: true });
  }

  /** A label's checkbox — in a tab's panel for the tabbed variant, anywhere for the dropdown one. */
  labelCheckbox(name: string, tab?: 'Include' | 'Exclude'): Locator {
    return (tab ? this.panel(tab) : this.root).getByRole('checkbox', { name, exact: true });
  }

  /** The check Fleet adds to a tab's heading once the tab holds a label. */
  tabHasSelection(tab: 'Include' | 'Exclude'): Locator {
    return this.root.getByRole('tab', { name: `${tab} check`, exact: true });
  }

  private async openTab(tab: 'Include' | 'Exclude'): Promise<void> {
    const handle = tab === 'Include' ? this.includeTab : this.excludeTab;
    await handle.click();
    await expect(handle).toHaveAttribute('aria-selected', 'true');
  }

  private async setMode(tab: 'Include' | 'Exclude', mode: LabelMode): Promise<void> {
    await this.pick(this.panel(tab), mode === 'all' ? 'All' : 'Any');
  }

  async tick(labels: string[], tab?: 'Include' | 'Exclude'): Promise<void> {
    for (const name of labels) {
      const box = this.labelCheckbox(name, tab);
      await box.click();
      await expect(box).toBeChecked();
    }
  }

  /** Tabbed variant: tick `labels` on the Include tab in `mode`. */
  async include(labels: string[], mode: LabelMode = 'any'): Promise<void> {
    await this.openTab('Include');
    await this.setMode('Include', mode);
    await this.tick(labels, 'Include');
  }

  /**
   * Tabbed variant: tick `labels` on the Exclude tab. `mode` only where the tab
   * offers one (policies); profiles always exclude "any".
   */
  async exclude(labels: string[], mode?: LabelMode): Promise<void> {
    await this.openTab('Exclude');
    if (mode) await this.setMode('Exclude', mode);
    await this.tick(labels, 'Exclude');
  }
}
