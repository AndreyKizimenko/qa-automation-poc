import { Page, Locator, expect } from '@playwright/test';

/**
 * Fleet spotlight — the global command palette rendered by `CoreLayout`, so
 * it is reachable from every authenticated page.
 *
 * Built on cmdk, which supplies real ARIA roles: the dialog is a `dialog`,
 * the input a `combobox`, the result list a `listbox` named "Suggestions",
 * every row an `option`, and each group a `group` named after its heading.
 * Rows are therefore addressed by role rather than by class.
 */
export class CommandPalette {
  readonly page: Page;
  readonly dialog: Locator;
  readonly input: Locator;
  readonly list: Locator;
  readonly overlay: Locator;
  readonly fleetSwitcher: Locator;
  readonly backButton: Locator;
  readonly escHint: Locator;
  readonly announcement: Locator;
  readonly noResults: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.getByRole('dialog', { name: 'Command palette' });
    this.input = this.dialog.getByRole('combobox');
    this.list = this.dialog.getByRole('listbox', { name: 'Suggestions' });
    // Radix renders the backdrop as a role-less <div>; nothing about it is
    // exposed to the accessibility tree, so the class is the only handle.
    this.overlay = page.locator('.command-palette__overlay');
    this.fleetSwitcher = this.dialog.getByRole('button', {
      name: /^Switch fleet \(currently /,
    });
    this.backButton = this.dialog.getByRole('button', { name: 'Back' });
    this.escHint = this.dialog.locator('kbd', { hasText: 'ESC' });
    this.announcement = this.dialog.getByRole('status');
    this.noResults = this.list.getByText('No results found.');
  }

  /**
   * The palette requires the platform-native modifier and deliberately
   * ignores the other one — Cmd on macOS, Ctrl everywhere else. Local runs
   * are macOS and CI runners are Linux, so the key has to be resolved at
   * runtime or every spec passes in one place and fails in the other.
   */
  static get modifier(): 'Meta' | 'Control' {
    return process.platform === 'darwin' ? 'Meta' : 'Control';
  }

  /** The modifier the palette must ignore on this platform. */
  static get wrongModifier(): 'Meta' | 'Control' {
    return this.modifier === 'Meta' ? 'Control' : 'Meta';
  }

  async open(): Promise<void> {
    await this.page.keyboard.press(`${CommandPalette.modifier}+k`);
    await expect(this.dialog).toBeVisible();
    await this.waitForInteractive();
  }

  /**
   * Radix's DismissableLayer computes the layer's index during render but
   * registers the layer in an effect afterwards, so on the commit that paints
   * the dialog the index is still -1 and the Escape handler bails out — a
   * press landing in that window is silently dropped. The follow-up render
   * that registers the layer is also the one that gives the dialog its own
   * `pointer-events: auto` (before it, `body { pointer-events: none }` is
   * inherited), which makes that style an observable proxy for "the dialog
   * can act on Escape".
   */
  private async waitForInteractive(): Promise<void> {
    await expect(this.dialog).toHaveCSS('pointer-events', 'auto');
  }

  /** Toggles the palette shut with the same shortcut that opened it. */
  async toggleClosed(): Promise<void> {
    await this.page.keyboard.press(`${CommandPalette.modifier}+k`);
    await expect(this.dialog).toBeHidden();
  }

  /**
   * Jumps straight to the switch-fleet sub-page. Works whether the palette
   * is open or closed; premium, multi-fleet, non-Primo only.
   */
  async openFleetSwitcher(): Promise<void> {
    await this.page.keyboard.press(`${CommandPalette.modifier}+Shift+F`);
    await expect(this.dialog).toBeVisible();
    await this.waitForInteractive();
  }

  async search(text: string): Promise<void> {
    await this.input.fill(text);
  }

  /**
   * A result row, matched on the start of its accessible name. Anchoring at
   * the start rather than matching the whole name keeps the lookup working
   * when a row carries a trailing fleet chip ("Add report All fleets") or,
   * for a sub-item promoted into Best match, its parent's label.
   */
  item(label: string): Locator {
    return this.list.getByRole('option', {
      name: new RegExp(`^${escapeForRegExp(label)}(\\s|$)`),
    });
  }

  /** A picker row (host, software, report, policy, fleet), matched on any part of its name. */
  row(text: string): Locator {
    return this.list.getByRole('option', { name: new RegExp(escapeForRegExp(text)) });
  }

  /** Every row currently rendered, in list order. */
  get options(): Locator {
    return this.list.getByRole('option');
  }

  group(name: string): Locator {
    return this.list.getByRole('group', { name });
  }

  /**
   * Best match is an unheaded group rendered above the regular ones, so it
   * is identified by position. cmdk suppresses `Command.Separator` while a
   * search is active, which is exactly when Best match renders — there is no
   * rule element to anchor on.
   */
  get bestMatchGroup(): Locator {
    return this.list.getByRole('group').first();
  }

  /** The chevron that expands an item's sub-items — the only button inside a row. */
  expandToggle(label: string): Locator {
    return this.item(label).getByRole('button');
  }

  /**
   * The destination-fleet chip on rows whose navigation would switch fleet
   * context. It is decorative text in a role-less <span>, so it is reached
   * by class within the already role-scoped row.
   */
  chip(label: string): Locator {
    return this.item(label).locator('.command-palette__item-fleet');
  }

  /**
   * Headings of the groups on screen, in render order. Scoped to visible
   * headings because cmdk hides filtered-out groups with the `hidden`
   * attribute instead of unmounting them, so an unscoped lookup would report
   * groups that a search has already emptied.
   */
  async groupNames(): Promise<string[]> {
    // cmdk renders each heading as an aria-hidden <div> that the group
    // references via aria-labelledby, so the heading itself carries no role.
    return this.list.locator('[cmdk-group-heading]:visible').allTextContents();
  }

  async selectItem(label: string): Promise<void> {
    await this.item(label).click();
  }

  /** Clicks the backdrop away from the dialog, which dismisses the palette. */
  async clickOverlay(): Promise<void> {
    await this.overlay.click({ position: { x: 5, y: 5 } });
  }
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
