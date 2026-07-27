import { Page, Locator, expect } from '@playwright/test';

/** Possible scopes for the team dropdown on premium. Free has no dropdown. */
export type TeamScope = 'All fleets' | 'Workstations' | 'Unassigned';

/**
 * Team / fleet scope dropdown shown on Hosts, Software, Reports, Policies,
 * Controls. Backed by react-select v5 — the visible trigger has no
 * accessible role and the rendered options have no role either, so a class
 * selector is the only stable target here.
 *
 * On the free tier the dropdown isn't rendered. `select()` no-ops in that
 * case so specs don't have to branch on SUITE.
 */
export class TeamDropdown {
  readonly page: Page;
  readonly trigger: Locator;
  readonly currentValue: Locator;

  constructor(page: Page) {
    this.page = page;
    this.trigger = page.locator('.team-dropdown__control');
    this.currentValue = page.locator('.team-dropdown__single-value');
  }

  /**
   * Idempotently selects a scope by its visible label. Fleet persists the
   * selection in the `fleet_id` URL param, so a fresh navigation can land on
   * a leftover team — this normalizes that without an unnecessary click when
   * the dropdown already shows the desired scope.
   */
  async select(name: TeamScope): Promise<void> {
    await this.selectByLabel(name);
  }

  /**
   * Selects any fleet by its exact visible label. {@link select} is the typed
   * entry point for the scope-loop specs; this is the escape hatch for fleets
   * outside the {@link TeamScope} matrix — notably "QA", which host-mutation
   * specs stage into. Idempotent, and a no-op on free.
   *
   * Matching is anchored to the whole label so one fleet name can't select
   * another that merely contains it.
   */
  async selectByLabel(label: string): Promise<void> {
    if ((await this.trigger.count()) === 0) return;

    const current = (await this.currentValue.textContent())?.trim();
    if (current === label) return;

    await this.trigger.click();
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await this.page
      .locator('.team-dropdown__option')
      .filter({ hasText: new RegExp(`^${escaped}$`) })
      .click();
    await expect(this.currentValue).toHaveText(label);
  }
}
