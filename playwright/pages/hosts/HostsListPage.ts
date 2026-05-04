import { Page, Locator, expect } from '@playwright/test';
import { DataTable } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { Navbar } from '../components/Navbar';
import { TeamDropdown } from '../components/TeamDropdown';
import { StatusFilter } from '../components/StatusFilter';
import { LabelFilter } from '../components/LabelFilter';

/**
 * /hosts/manage — the list of all hosts enrolled in Fleet.
 */
export class HostsListPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly table: DataTable;
  readonly pagination: Pagination;
  readonly teamDropdown: TeamDropdown;
  readonly statusFilter: StatusFilter;
  readonly labelFilter: LabelFilter;

  readonly search: Locator;
  readonly addHostsButton: Locator;
  readonly editColumnsButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.table = new DataTable(page);
    this.pagination = new Pagination(page);
    this.teamDropdown = new TeamDropdown(page);
    this.statusFilter = new StatusFilter(page);
    this.labelFilter = new LabelFilter(page);

    this.search = page.getByPlaceholder('Search');
    this.addHostsButton = page.getByRole('button', { name: 'Add hosts' });
    this.editColumnsButton = page.getByRole('button', { name: /edit columns/i });
  }

  async goto(opts: { sort?: { key: string; direction: 'asc' | 'desc' } } = {}) {
    const params = new URLSearchParams();
    if (opts.sort) {
      params.set('order_key', opts.sort.key);
      params.set('order_direction', opts.sort.direction);
    }
    const qs = params.toString();
    await this.page.goto(`/hosts/manage${qs ? '?' + qs : ''}`);
    await expect(this.table.firstRowWithLink).toBeVisible();
  }

  /** Read the display name of the first host in the list. */
  async firstHostName(): Promise<string> {
    const link = this.table.firstRowWithLink.getByRole('link').first();
    return (await link.textContent())?.trim() ?? '';
  }

  /** Click the first host in the list — navigates to its detail page. */
  async clickFirstHost(): Promise<void> {
    await this.table.firstRowWithLink.getByRole('link').first().click();
  }
}
