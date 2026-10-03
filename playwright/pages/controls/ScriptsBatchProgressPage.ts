import { Page, Locator, expect } from '@playwright/test';
import { ContentList } from '../components/ContentList';
import { Navbar } from '../components/Navbar';
import { TeamDropdown } from '../components/TeamDropdown';

/** The progress page's tabs, in the order Fleet shows them. */
export type BatchProgressTab = 'Started' | 'Scheduled' | 'Finished';

/**
 * /controls/scripts/progress — the fleet's batch script runs, under Started /
 * Scheduled / Finished tabs. Reached from Controls → Scripts through the side
 * nav's **Batch progress**, or from a batch toast's link. Each tab is a list of
 * batches, or an empty state ("No batch scripts started", …).
 */
export class ScriptsBatchProgressPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly list: ContentList;
  readonly teamDropdown: TeamDropdown;

  readonly heading: Locator;
  readonly startedTab: Locator;
  readonly scheduledTab: Locator;
  readonly finishedTab: Locator;
  /** In the Started and Scheduled empty states; opens Fleet's docs in a new tab. */
  readonly learnMoreLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.list = new ContentList(page);
    this.teamDropdown = new TeamDropdown(page);

    this.heading = page.getByRole('heading', { name: 'Batch progress', level: 2 });
    this.startedTab = page.getByRole('tab', { name: 'Started' });
    this.scheduledTab = page.getByRole('tab', { name: 'Scheduled' });
    this.finishedTab = page.getByRole('tab', { name: 'Finished' });
    this.learnMoreLink = page.getByRole('tabpanel').getByRole('link', { name: /Learn more about batch scripts/ });
  }

  async goto(opts: { fleetId?: number } = {}): Promise<void> {
    const qs = opts.fleetId !== undefined ? `?fleet_id=${opts.fleetId}` : '';
    await this.page.goto(`/controls/scripts/progress${qs}`);
    await expect(this.heading).toBeVisible();
  }

  tab(name: BatchProgressTab): Locator {
    return this.page.getByRole('tab', { name, exact: true });
  }

  async openTab(name: BatchProgressTab): Promise<void> {
    await this.tab(name).click();
    await expect(this.tab(name)).toHaveAttribute('aria-selected', 'true');
  }

  /** Switch to the Finished sub-tab. */
  async openFinishedTab(): Promise<void> {
    await this.openTab('Finished');
  }

  /**
   * The open tab's empty-state heading, "No batch scripts <started|scheduled|finished>".
   * Its explanation sits below it in the same panel ({@link emptyStateInfo}).
   */
  emptyState(name: BatchProgressTab): Locator {
    return this.page
      .getByRole('tabpanel')
      .getByRole('heading', { name: `No batch scripts ${name.toLowerCase()}`, level: 3 });
  }

  /** The open tab's text under its empty-state heading, matched by its start. */
  emptyStateInfo(text: string): Locator {
    return this.page.getByRole('tabpanel').getByText(text);
  }

  /**
   * One batch in the open tab, by its script name. Each renders as a list item
   * reading "<script> <when> [<done> / <targeted> hosts]", where <when> is
   * "Will start in …" (Scheduled), "Started …" (Started) or "Completed …" /
   * "Canceled …" (Finished); a scheduled batch has no host count.
   */
  batch(scriptName: string): Locator {
    return this.page.getByRole('tabpanel').getByRole('listitem').filter({ hasText: scriptName });
  }
}
