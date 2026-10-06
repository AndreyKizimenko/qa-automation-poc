import { Page, Locator, expect } from '@playwright/test';
import { DataTable } from '../components/DataTable';
import { Navbar } from '../components/Navbar';
import { PolicyAutomationsFields } from '../components/PolicyAutomationsFields';
import { TeamDropdown } from '../components/TeamDropdown';
import { Toast } from '../components/Toast';

/**
 * /policies/manage — list of policies. Supports team scoping and an
 * `automation_type` query param for filtering (Other / Software).
 *
 * Bulk delete: select rows via the row checkbox, then click the "Delete"
 * action button that appears in the table header. The confirmation modal
 * is titled "Delete policies".
 */
export class PoliciesListPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly table: DataTable;
  readonly teamDropdown: TeamDropdown;
  readonly toast: Toast;

  readonly addPolicyButton: Locator;

  readonly search: Locator;

  // Premium's "Filter by automation" (a react-select). Its options are read
  // only after the control is clicked open.
  readonly automationFilter: Locator;
  readonly automationFilterOptions: Locator;

  readonly bulkDeleteButton: Locator;
  readonly deleteModal: Locator;
  readonly deleteConfirmButton: Locator;

  // Global policy automations ("Automations" button → "Automations" modal).
  // The webhook/ticket controls live in the modal's "Webhooks or tickets"
  // section (Fleet's OtherWorkflowsModal).
  readonly manageAutomationsButton: Locator;
  readonly automationsModal: Locator;
  readonly policyAutomationsToggle: Locator;
  readonly policyWebhookUrlInput: Locator;
  readonly saveAutomationsButton: Locator;
  // The Ticket workflow's empty state, shown when no Jira or Zendesk
  // integration is configured.
  readonly noIntegrationsMessage: Locator;
  readonly addIntegrationButton: Locator;

  // One policy's automations (a row's Automations cell → "Manage automations"
  // modal, Fleet's ManageAutomationsModal), as opposed to the scope-wide
  // webhook modal above.
  readonly policyAutomationsModal: Locator;
  readonly policyAutomations: PolicyAutomationsFields;
  readonly savePolicyAutomationsButton: Locator;
  readonly cancelPolicyAutomationsButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.table = new DataTable(page);
    this.teamDropdown = new TeamDropdown(page);
    this.toast = new Toast(page);

    // The "Add policy" label is shared by the page-header CTA and the
    // empty-state card's CTA; both open the add-policy flow. The header one
    // comes first in the DOM, so take it to stay single-match on a list that
    // renders empty (or is still refetching over an empty render).
    this.addPolicyButton = page.getByRole('button', { name: /add policy/i }).first();
    this.search = page.getByPlaceholder('Search by name');
    // The named combobox is react-select's hidden dummy input, which never takes
    // a click; the control around it is what opens the menu, and it has no role
    // of its own, so it's the react-select control holding that input.
    this.automationFilter = page
      .locator('.react-select__control')
      .filter({ has: page.getByRole('combobox', { name: 'Filter by automation' }) });
    // DropdownWrapper stamps every option with the one test id Fleet emits; an
    // option's text is its label followed by its help text.
    this.automationFilterOptions = page.getByTestId('dropdown-option');

    this.bulkDeleteButton = page.getByRole('button', { name: 'Delete', exact: true });
    this.deleteModal = page.locator('.modal__modal_container').filter({ hasText: 'Delete policies' });
    this.deleteConfirmButton = this.deleteModal.getByRole('button', { name: 'Delete', exact: true });

    // AutomationsButton renders the visible label "Manage automations"; it's
    // disabled until the scope has at least one policy.
    this.manageAutomationsButton = page.getByRole('button', { name: 'Manage automations', exact: true });
    // The modal's title is "Automations" (role-less Modal span).
    this.automationsModal = page.locator('.modal__modal_container').filter({ hasText: 'Automations' });
    // Enable/disable is Fleet's Slider (role="switch" button); the "Destination
    // URL" label is tooltip-wrapped, so target the field by placeholder.
    this.policyAutomationsToggle = this.automationsModal.getByRole('switch');
    this.policyWebhookUrlInput = this.automationsModal.getByPlaceholder('https://server.com/example');
    this.saveAutomationsButton = this.automationsModal.getByRole('button', { name: 'Save', exact: true });
    this.noIntegrationsMessage = this.automationsModal.getByText('You have no integrations.', { exact: true });
    this.addIntegrationButton = this.automationsModal.getByRole('button', { name: 'Add integration', exact: true });

    // Fleet's Modal is a role-less div whose title is a plain span; the
    // component's own class is the only thing that tells this modal apart from
    // the webhook one, whose title also reads "...automations".
    this.policyAutomationsModal = page.locator('.manage-automations-modal');
    this.policyAutomations = new PolicyAutomationsFields(this.policyAutomationsModal);
    this.savePolicyAutomationsButton = this.policyAutomationsModal.getByRole('button', { name: 'Save', exact: true });
    this.cancelPolicyAutomationsButton = this.policyAutomationsModal.getByRole('button', { name: 'Cancel', exact: true });
  }

  /**
   * A policy row's Automations cell. It's a `role="button"` div whose name says
   * what it holds: "Add automation" when empty, "Edit automation: <name>" with
   * one, "Edit automations" (showing "N automations") with more. Read-only roles
   * get a plain span instead, with no button at all.
   */
  automationsCell(policyName: string): Locator {
    return this.table
      .rowWith(policyName)
      .getByRole('button', { name: /^(Add automation|Edit automations?\b)/ });
  }

  /** An open automation filter's option, by its label (its help text follows it). */
  automationFilterOption(label: string): Locator {
    return this.automationFilterOptions.filter({ hasText: new RegExp(`^${label}`) });
  }

  /**
   * Searches the list down to `policyName` and returns its row. The list pages at
   * 20 and other specs add policies beside this one, so a row is read only once a
   * search has left it alone on screen.
   */
  async narrowTo(policyName: string): Promise<Locator> {
    await this.search.fill(policyName);
    await this.table.waitForSettled();
    const row = this.table.rowWith(policyName);
    await expect(row).toHaveCount(1);
    return row;
  }

  /**
   * Opens the hosts behind a policy's Pass or Fail count: an "N hosts" link
   * Fleet renders once its hourly job has counted the policy (`---` until then).
   * The list is narrowed to the policy first, so a row past page 1 is reachable.
   */
  async openHostCount(policyName: string, column: 'Pass' | 'Fail'): Promise<void> {
    await this.search.fill(policyName);
    await this.table.waitForSettled();
    const row = this.table.rowWith(policyName);
    await expect(row).toHaveCount(1);
    const link = (await this.table.cellByColumn(row, column)).getByRole('link', { name: /^\d+ hosts?$/ });
    await expect(link).toBeVisible();
    await link.click();
    await expect(this.page).toHaveURL(/\/hosts\/manage\?.*policy_id=\d+/);
  }

  /**
   * Narrows the list to `policyName` and opens its Manage automations modal from
   * the row's Automations cell. Searching first keeps a row past the first page
   * reachable.
   */
  async openPolicyAutomations(policyName: string): Promise<void> {
    await this.search.fill(policyName);
    const cell = this.automationsCell(policyName);
    await expect(cell).toHaveCount(1);
    await cell.click();
    await expect(this.policyAutomationsModal).toBeVisible();
  }

  /** Saves the policy's automations; the modal closes once Fleet has stored them. */
  async savePolicyAutomations(): Promise<void> {
    await this.savePolicyAutomationsButton.click();
    await expect(this.policyAutomationsModal).toBeHidden();
  }

  async cancelPolicyAutomations(): Promise<void> {
    await this.cancelPolicyAutomationsButton.click();
    await expect(this.policyAutomationsModal).toBeHidden();
  }

  /** Open the "Automations" modal (button is enabled once a policy exists). */
  async openAutomations(): Promise<void> {
    await this.manageAutomationsButton.click();
    await expect(this.automationsModal).toBeVisible();
  }

  /** Toggle the policy-automations slider to `enabled` (idempotent). */
  async setPolicyAutomations(enabled: boolean): Promise<void> {
    const isOn = (await this.policyAutomationsToggle.getAttribute('aria-checked')) === 'true';
    if (isOn !== enabled) await this.policyAutomationsToggle.click();
    await expect(this.policyAutomationsToggle).toHaveAttribute('aria-checked', String(enabled));
  }

  /**
   * Select the "Webhook" workflow radio (the modal may open on "Ticket"). The
   * Radio's real <input> is hidden, so click the label; the destination-URL
   * field renders once it's selected.
   */
  async selectWebhookWorkflow(): Promise<void> {
    await this.automationsModal.locator('label').filter({ hasText: 'Webhook' }).click();
    await expect(this.policyWebhookUrlInput).toBeVisible();
  }

  /** Select the "Ticket" workflow radio; same hidden-input Radio as Webhook, so the label is the target. */
  async selectTicketWorkflow(): Promise<void> {
    await this.automationsModal.locator('label').filter({ hasText: 'Ticket' }).click();
    await expect(this.automationsModal.getByRole('radio', { name: 'Ticket' })).toBeChecked();
  }

  /** Save the automations modal; waits for it to close (reliable completion). */
  async saveAutomations(): Promise<void> {
    await this.saveAutomationsButton.click();
    await expect(this.automationsModal).toBeHidden();
  }

  async goto(opts: { fleetId?: number; automationType?: 'other' | 'software' } = {}): Promise<void> {
    const params = new URLSearchParams();
    if (opts.fleetId !== undefined) params.set('fleet_id', String(opts.fleetId));
    if (opts.automationType) params.set('automation_type', opts.automationType);
    const qs = params.toString();
    await this.page.goto(`/policies/manage${qs ? '?' + qs : ''}`);
    await expect(this.table.rowOrEmpty()).toBeVisible();
  }

  /** Click "Add policy" → editor for a new policy. */
  async addPolicy(): Promise<void> {
    await this.addPolicyButton.click();
    await expect(this.page).toHaveURL(/\/policies\/new/);
  }

  /**
   * Click a policy's name link in the list to open its details page. The link
   * also holds the name's tags ("Inherited" on a fleet's list, "Patch"), so it's
   * matched from the start of its name up to a word boundary rather than whole.
   */
  async openPolicy(name: string): Promise<void> {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await this.page.getByRole('link', { name: new RegExp(`^${escaped}(?:\\s|$)`) }).click();
    await expect(this.page).toHaveURL(/\/policies\/\d+/);
  }

  /**
   * Selects the row matching `name` via its checkbox, clicks the bulk
   * "Delete" button, and confirms in the "Delete policies" modal. The
   * list is narrowed by name first so a row past the first page is
   * still reachable.
   */
  async deletePolicy(name: string): Promise<void> {
    await this.search.fill(name);
    const row = this.table.rowWith(name);
    await expect(row).toBeVisible();
    await row.getByRole('checkbox').check();
    await this.bulkDeleteButton.click();
    await expect(this.deleteModal).toBeVisible();
    await this.deleteConfirmButton.click();
    await expect(this.deleteModal).toBeHidden();
  }

  /** Reload the current page with an automation_type filter applied. */
  async applyAutomationFilter(type: 'other' | 'software'): Promise<void> {
    const url = new URL(this.page.url());
    url.searchParams.set('automation_type', type);
    await this.page.goto(url.pathname + url.search);
    await expect(this.table.rowOrEmpty()).toBeVisible();
  }
}
