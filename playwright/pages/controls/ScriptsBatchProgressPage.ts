import { Page, Locator } from '@playwright/test';
import { ContentList } from '../components/ContentList';
import { Navbar } from '../components/Navbar';

/**
 * /controls/scripts/progress — batch script execution progress with
 * Started / Scheduled / Finished sub-tabs. Each tab shows paginated list
 * items for completed or in-progress batch runs.
 */
export class ScriptsBatchProgressPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly list: ContentList;

  readonly startedTab: Locator;
  readonly scheduledTab: Locator;
  readonly finishedTab: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.list = new ContentList(page);

    this.startedTab = page.getByRole('tab', { name: 'Started' });
    this.scheduledTab = page.getByRole('tab', { name: 'Scheduled' });
    this.finishedTab = page.getByRole('tab', { name: 'Finished' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/controls/scripts/progress');
  }

  /** Switch to the Finished sub-tab and wait for its list items to render. */
  async openFinishedTab(): Promise<void> {
    await this.finishedTab.click();
  }
}
