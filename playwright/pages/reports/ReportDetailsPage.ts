import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';

/**
 * `/reports/:id` — the report results / details page. Rendered when a
 * user clicks a report name in the list. Shows the report's name and
 * description plus three primary actions: "Show query" (opens a modal
 * with the SQL), "Live report" (navigates to `/reports/:id/live`), and
 * "Edit report" (navigates to `/reports/:id/edit`).
 */
export interface ReportDetailsValues {
  name: string;
  description: string;
}

export class ReportDetailsPage {
  readonly page: Page;
  readonly navbar: Navbar;

  readonly nameHeading: Locator;
  readonly descriptionParagraph: Locator;

  readonly showQueryButton: Locator;
  readonly liveReportButton: Locator;
  readonly editButton: Locator;
  readonly backToReportsButton: Locator;

  readonly queryModal: Locator;
  readonly queryModalCloseButton: Locator;

  /** "Automations: On / Off / Paused" and "Log destination: <plugin>" under the description. */
  readonly automationsStatus: Locator;
  readonly logDestination: Locator;
  /** The empty state's heading ("Nothing to report", "Collecting results...") and its explanation. */
  readonly emptyStateHeading: Locator;
  readonly emptyStateInfo: Locator;
  /** The stored-results table's rows (header excluded). */
  readonly resultRows: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);

    // Scope to the details container so locators don't collide with the
    // page-level `.unsupported-screen-size` overlay (it has its own
    // h1+p with "This screen size is not supported yet. Please enlarge…").
    // Fleet labels the wrapper `.query-details-page` (the entity is
    // called "query" in source; the UI exposes it as "report").
    const container = page.locator('.main-content.query-details-page');
    // The report name is the container's only <h1>; the overlay's h1 sits outside it.
    this.nameHeading = container.getByRole('heading', { level: 1 });
    this.descriptionParagraph = container.locator('.query-details-page__query-description');

    this.showQueryButton = page.getByRole('button', { name: 'Show query' });
    this.liveReportButton = page.getByRole('button', { name: /Live report/ });
    this.editButton = page.getByRole('button', { name: 'Edit report' });
    this.backToReportsButton = page.getByRole('button', { name: 'Back to reports' });

    this.queryModal = page.locator('.modal__modal_container').filter({ hasText: 'Query' });
    this.queryModalCloseButton = this.queryModal.getByRole('button', { name: 'Close' });

    // Each is a role-less div holding a tooltip-wrapped label and a status
    // component, with nothing to name it by, so the containers' classes are
    // the handle.
    this.automationsStatus = container.locator('.query-details-page__automations');
    this.logDestination = container.locator('.query-details-page__log-destination');
    // Fleet's EmptyState: the header is an <h3>, the explanation a role-less div.
    const emptyState = container.locator('.empty-state');
    this.emptyStateHeading = emptyState.getByRole('heading', { level: 3 });
    this.emptyStateInfo = emptyState.locator('.empty-state__info');
    this.resultRows = container.locator('table tbody tr');
  }

  /**
   * A stored result's Host cell, which links to that host's results for this
   * report (`/hosts/:id/reports/:reportId`). A host with several result rows
   * links from each, so this is the first.
   */
  hostResultLink(hostName: string): Locator {
    return this.resultRows.getByRole('link', { name: hostName, exact: true }).first();
  }

  async goto(id: number, opts: { fleetId?: number } = {}): Promise<void> {
    const qs = opts.fleetId !== undefined ? `?fleet_id=${opts.fleetId}` : '';
    await this.page.goto(`/reports/${id}${qs}`);
    await expect(this.editButton).toBeVisible();
  }

  /** Click "Edit report" → `/reports/:id/edit`. */
  async clickEdit(): Promise<void> {
    await this.editButton.click();
    await expect(this.page).toHaveURL(/\/reports\/\d+\/edit/);
  }

  /** Click "Live report" → `/reports/:id/live`. */
  async clickLiveReport(): Promise<void> {
    await this.liveReportButton.click();
    await this.page.waitForURL(/\/reports\/\d+\/live/);
  }

  /** Open the "Show query" modal, read its SQL, close, return the SQL. */
  async showQuery(): Promise<string> {
    await this.showQueryButton.click();
    await expect(this.queryModal).toBeVisible();
    const sql = (await this.queryModal.locator('.ace_content').innerText()).trim();
    await this.queryModalCloseButton.click();
    await expect(this.queryModal).toBeHidden();
    return sql;
  }

  /** Assert name + description match `values`. */
  async expectValues(values: ReportDetailsValues): Promise<void> {
    await expect(this.nameHeading).toHaveText(values.name);
    await expect(this.descriptionParagraph).toHaveText(values.description);
  }
}
