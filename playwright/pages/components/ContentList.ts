import { Page, Locator } from '@playwright/test';

/**
 * Content list widget used on pages where data is rendered as `<li>` items
 * rather than a <table>: Configuration profiles, Certificates, Scripts
 * library, Variables, Scripts batch progress.
 *
 * Data items always contain a timestamp ("ago"), which distinguishes them
 * from nav/tab listitems at the page level.
 */
export class ContentList {
  readonly firstItem: Locator;
  // Marker for Fleet's shared empty-state component. Pages that hand their
  // list a `<EmptyState>` (Variables, Scripts batch progress, etc.) render
  // it inside `.empty-state` — pair with `firstItem.or(emptyState)` when a
  // page should accept either populated rows or the empty placeholder.
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.firstItem = page.getByRole('listitem').filter({ hasText: /ago/ }).first();
    this.emptyState = page.locator('.empty-state');
  }
}
