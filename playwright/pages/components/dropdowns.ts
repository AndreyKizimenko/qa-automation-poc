import { expect, Locator } from '@playwright/test';
import { clickHoverAction } from './clickHoverAction';

/** A pattern that matches `text` whole and nothing more, its special characters escaped. */
export function exactText(text: string): RegExp {
  return new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
}

/**
 * One of Fleet's `DropdownWrapper` dropdowns (react-select v5, class prefix
 * `react-select`), found inside `root`, the caller's container for it.
 *
 * react-select's combobox is a hidden dummy input that never takes a click, so
 * the visible control (`.react-select__control`) opens it and the chosen value
 * reads from `.react-select__single-value`: classes, because nothing else
 * names them. The options carry Fleet's `dropdown-option` test id and are
 * picked by their whole text, so "iOS" can't pick "iPadOS".
 */
export class ReactSelect {
  readonly control: Locator;
  readonly value: Locator;

  constructor(private readonly root: Locator) {
    this.control = root.locator('.react-select__control');
    this.value = root.locator('.react-select__single-value');
  }

  /** Picks `label` (nothing, when it is already chosen) and waits until the control shows it. */
  async select(label: string): Promise<void> {
    await expect(this.control).toBeVisible();
    // `count()` first: a dropdown still showing its placeholder has no value
    // element, and `textContent()` would wait for one until the test times out.
    if ((await this.value.count()) && (await this.value.textContent())?.trim() === label) return;
    await this.control.click();
    await this.root.page().getByTestId('dropdown-option').filter({ hasText: exactText(label) }).click();
    await expect(this.value).toHaveText(label);
  }
}

/**
 * A table row's Actions menu: Fleet's `ActionsDropdown` (react-select, class
 * prefix `actions-dropdown-select`). Its control has no accessible name and
 * shows only while the row is hovered, so it is clicked through
 * `clickHoverAction`; its options carry the `dropdown-option` test id.
 */
export class ActionsMenu {
  constructor(private readonly row: Locator) {}

  /** Opens the menu and picks `action` by its whole text, failing fast when it isn't offered. */
  async choose(action: string): Promise<void> {
    await expect(this.row).toBeVisible();
    await clickHoverAction(this.row, this.row.locator('.actions-dropdown-select__control'));
    const option = this.row.page().getByTestId('dropdown-option').filter({ hasText: exactText(action) });
    await expect(option).toBeVisible();
    await option.click();
  }
}
