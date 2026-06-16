import { Page, Locator, expect } from '@playwright/test';
import { DataTable } from '../components/DataTable';
import { FilterModal } from '../components/FilterModal';
import { Navbar } from '../components/Navbar';

/**
 * /hosts/:id/details — detailed view of a single host with tabs for Details,
 * Software, Reports, and Policies.
 *
 * The Software tab hosts a DataTable with a Vulnerable filter (same
 * FilterModal component as on /software/titles). Library is a sub-tab of
 * Software.
 */
export class HostDetailsPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly table: DataTable;
  readonly filter: FilterModal;

  readonly hostHeading: Locator;
  readonly backButton: Locator;
  readonly refetchButton: Locator;
  readonly actionsButton: Locator;

  readonly detailsTab: Locator;
  readonly softwareTab: Locator;
  readonly reportsTab: Locator;
  readonly policiesTab: Locator;

  readonly inventoryTab: Locator;
  readonly libraryTab: Locator;

  readonly vitalsDiskSpace: Locator;
  readonly vitalsOperatingSystem: Locator;

  readonly firstActivityTimestamp: Locator;
  // Empty-state placeholder rendered by the Activity card when the host has
  // no past activities yet. Use `firstActivityTimestamp.or(activityEmptyState)`
  // when the test only needs the card to finish loading.
  readonly activityEmptyState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.table = new DataTable(page);
    this.filter = new FilterModal(page);

    this.hostHeading = page.getByRole('heading', { level: 1 });
    this.backButton = page.getByRole('button', { name: 'Back to all hosts' });
    this.refetchButton = page.getByRole('button', { name: 'Refetch' });
    this.actionsButton = page.getByRole('button', { name: 'Actions' });

    this.detailsTab = page.getByRole('tab', { name: 'Details' });
    this.softwareTab = page.getByRole('tab', { name: 'Software' });
    this.reportsTab = page.getByRole('tab', { name: 'Reports' });
    this.policiesTab = page.getByRole('tab', { name: 'Policies' });

    this.inventoryTab = page.getByRole('tab', { name: 'Inventory' });
    this.libraryTab = page.getByRole('tab', { name: 'Library' });

    this.vitalsDiskSpace = page.getByText('Disk space available');
    this.vitalsOperatingSystem = page.getByText('Operating system');

    // Activity rows are buttons whose aria-label ends with "ago".
    this.firstActivityTimestamp = page.getByRole('button', { name: /\bago\b/ }).first();
    // EmptyFeed renders an `<h3>No activity</h3>` inside the Activity card
    // when the host has no past activities yet.
    this.activityEmptyState = page.getByRole('heading', { level: 3, name: 'No activity' });
  }

  async goto(hostId: number): Promise<void> {
    await this.page.goto(`/hosts/${hostId}`);
    await expect(this.vitalsDiskSpace).toBeVisible();
  }

  async openSoftwareTab(): Promise<void> {
    await this.softwareTab.click();
    // Wait for the table to settle to either rows or its empty state — a macOS
    // host defaults to the "Applications" view, which is empty when the host
    // reports only non-app packages (so `firstRow` alone would never resolve;
    // callers switch to full inventory via showFullInventory() next).
    await expect(this.table.rowOrEmpty()).toBeVisible();
  }

  /**
   * macOS hosts default the Software list to the "Applications" view (top-level
   * apps only) and expose a filter dropdown to switch it; other platforms show
   * the full list and render no dropdown. Selects "Full inventory" so the table
   * lists every reported package. No-op on Windows/Linux hosts, where the
   * dropdown isn't present.
   *
   * The react-select trigger has no accessible role, so it's scoped by the host
   * software table's filter container class to avoid colliding with the team
   * dropdown or the vulnerable filter modal; options carry `dropdown-option`.
   */
  async showFullInventory(): Promise<void> {
    const trigger = this.page.locator(
      '.host-software-table__software-filter .react-select__control',
    );
    if ((await trigger.count()) === 0) return;
    await trigger.click();
    await this.page.getByTestId('dropdown-option').filter({ hasText: 'Full inventory' }).click();
    // The selection drives the list via the `macos_applications` query param;
    // waiting on it confirms the table has switched before downstream steps.
    await expect(this.page).toHaveURL(/macos_applications=false/);
  }

  async applyVulnerableFilter(): Promise<void> {
    await this.filter.applyVulnerable();
  }

  async clickFirstSoftware(): Promise<void> {
    await this.table.firstRowWithLink.locator('td').first().getByRole('link').first().click();
  }
}
