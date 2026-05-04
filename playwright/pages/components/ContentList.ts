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

  constructor(page: Page) {
    this.firstItem = page.getByRole('listitem').filter({ hasText: /ago/ }).first();
  }
}
