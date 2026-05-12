import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';

/**
 * `/policies/:id` — the policy results / details page. Rendered when a
 * user clicks a policy name in the list. Shows the policy's metadata
 * (name, description, resolution, platforms, fleet/team, author) and
 * three primary actions: "Show query" (opens a modal with the SQL),
 * "Run policy", and "Edit policy" (navigates to `/policies/:id/edit`).
 */
export interface PolicyDetailsValues {
  name: string;
  description: string;
  resolution: string;
}

export class PolicyDetailsPage {
  readonly page: Page;
  readonly navbar: Navbar;

  readonly nameHeading: Locator;
  readonly descriptionParagraph: Locator;
  readonly resolutionDefinition: Locator;
  readonly platformsDefinition: Locator;

  readonly showQueryButton: Locator;
  readonly editButton: Locator;
  readonly backToPoliciesButton: Locator;

  // Modal shown by "Show query" — contains an Ace-rendered SQL block + Close.
  readonly queryModal: Locator;
  readonly queryModalCloseButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);

    // Scope to the details container so locators don't collide with the
    // page-level `.unsupported-screen-size` overlay (it has its own
    // h1+p with "This screen size is not supported yet. Please enlarge…"
    // that would otherwise match generic h1/p selectors).
    const container = page.locator('.main-content.policy-details-page');
    this.nameHeading = container.locator('.policy-details-page__policy-name');
    this.descriptionParagraph = container.locator('.policy-details-page__policy-description');
    // Resolution / Platforms render as <dd> nodes adjacent to <dt>
    // terms with the visible label ("Resolve" — yes, "Resolve", not
    // "Resolution" — and "Platforms").
    this.resolutionDefinition = container.locator('dt:has-text("Resolve") + dd');
    this.platformsDefinition = container.locator('dt:has-text("Platforms") + dd');

    this.showQueryButton = page.getByRole('button', { name: 'Show query' });
    this.editButton = page.getByRole('button', { name: 'Edit policy' });
    this.backToPoliciesButton = page.getByRole('button', { name: 'Back to policies' });

    this.queryModal = page.locator('.modal__modal_container').filter({ hasText: 'Query' });
    this.queryModalCloseButton = this.queryModal.getByRole('button', { name: 'Close' });
  }

  async goto(id: number, opts: { fleetId?: number } = {}): Promise<void> {
    const qs = opts.fleetId !== undefined ? `?fleet_id=${opts.fleetId}` : '';
    await this.page.goto(`/policies/${id}${qs}`);
    await expect(this.editButton).toBeVisible();
  }

  /** Click "Edit policy" → navigates to `/policies/:id/edit`. */
  async clickEdit(): Promise<void> {
    await this.editButton.click();
    await expect(this.page).toHaveURL(/\/policies\/\d+\/edit/);
  }

  /**
   * Open the "Show query" modal, read its SQL, close the modal, and
   * return the SQL string. The modal renders the SQL inside an Ace
   * block (`.ace_content`).
   */
  async showQuery(): Promise<string> {
    await this.showQueryButton.click();
    await expect(this.queryModal).toBeVisible();
    const sql = (await this.queryModal.locator('.ace_content').innerText()).trim();
    await this.queryModalCloseButton.click();
    await expect(this.queryModal).toBeHidden();
    return sql;
  }

  /** Assert name / description / resolution match `values`. */
  async expectValues(values: PolicyDetailsValues): Promise<void> {
    await expect(this.nameHeading).toHaveText(values.name);
    await expect(this.descriptionParagraph).toHaveText(values.description);
    await expect(this.resolutionDefinition).toHaveText(values.resolution);
  }
}
