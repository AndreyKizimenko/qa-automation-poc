import { Page, Locator, expect } from '@playwright/test';

/** Possible scopes for the team dropdown on premium. Free has no dropdown. */
export type TeamScope = 'All fleets' | 'Workstations' | 'Unassigned';

/**
 * Team / fleet scope dropdown shown on Hosts, Software, Reports, Policies,
 * Controls.
 *
 * The visible trigger is a real `<button>` (`aria-haspopup="listbox"`), so the
 * trigger and its label could be reached by role. The class is used instead
 * because react-select stays mounted alongside it for keyboard nav, rendering
 * a second, visually-hidden control whose own label would make a role query
 * ambiguous. The options keep no role at all — react-select v5 drives
 * highlighting through `aria-activedescendant` rather than `role="option"` —
 * so a class selector is the only stable target for those.
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
    this.trigger = page.locator('.fleet-dropdown__button');
    this.currentValue = page.locator('.fleet-dropdown__button-label');
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
    // Free has no fleet scoping, so the dropdown never renders there. The
    // tier is the gate rather than the trigger's presence: keying off a
    // missing trigger would turn any premium markup change into a silent
    // no-op, letting scope-loop specs run against whatever fleet the URL
    // happened to carry instead of failing where the breakage is.
    if (process.env.SUITE !== 'premium') return;

    await expect(this.trigger).toBeVisible();

    const current = (await this.currentValue.textContent())?.trim();
    if (current === label) return;

    await this.trigger.click();
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await this.page
      .locator('.fleet-dropdown__option')
      .filter({ hasText: new RegExp(`^${escaped}$`) })
      .click();
    await expect(this.currentValue).toHaveText(label);
  }
}
