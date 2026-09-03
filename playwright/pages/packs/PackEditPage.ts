import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';
import { Toast } from '../components/Toast';

/**
 * /packs/new and /packs/:id/edit — create / edit pack form.
 *
 * The target picker is a react-select widget that doesn't expose standard
 * ARIA combobox/listbox roles reliably. We fall back to its stable
 * library-generated class names (`.Select-*`, `.target-option__wrapper`)
 * and document the fallback inline. When Fleet adds a `data-testid`
 * upstream on these widgets we can switch.
 */
export class PackEditPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly toast: Toast;

  readonly nameInput: Locator;
  readonly descriptionInput: Locator;
  readonly saveButton: Locator;
  readonly editHeading: Locator;

  // Target picker (react-select) — CSS fallback with rationale
  readonly targetPickerPlaceholder: Locator;
  readonly targetSearchInput: Locator;
  readonly targetDropdownMenu: Locator;
  readonly firstHostOption: Locator;
  readonly uniqueHostCount: Locator;

  // Scheduled queries ("reports") attached to the pack
  readonly addReportButton: Locator;
  readonly queryEditorModal: Locator;
  readonly querySelect: Locator;
  readonly frequencyInput: Locator;
  readonly addQueryConfirmButton: Locator;
  readonly noReportsHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.toast = new Toast(page);

    this.nameInput = page.getByRole('textbox', { name: 'Name' });
    this.descriptionInput = page.getByRole('textbox', { name: 'Description' });
    this.saveButton = page.getByRole('button', { name: /save/i });
    this.editHeading = page.getByRole('heading', { name: /edit pack/i });

    // react-select library classes (no reliable ARIA role on its trigger)
    this.targetPickerPlaceholder = page.locator('.Select-placeholder');
    this.targetSearchInput = page.locator('.Select-input input');
    this.targetDropdownMenu = page.locator('.Select-menu');
    this.firstHostOption = page.locator('.target-option__wrapper.is-host').first();
    // The targets-count label renders "N unique host(s)" and reads "0 unique hosts" on
    // mount, so require a non-zero count: the locator only resolves once a host is added.
    this.uniqueHostCount = page.getByText(/[1-9]\d* unique hosts?/);

    this.addReportButton = page.getByRole('button', { name: /add report/i });
    this.noReportsHeading = page.getByRole('heading', { name: /your pack has no reports/i });
    // "Select query" is the dropdown's placeholder, not a label — it is replaced by
    // the chosen query name — so the modal is identified by the form it wraps, which
    // is stable for the modal's whole lifetime.
    this.queryEditorModal = page.locator('.modal__modal_container').filter({
      has: page.locator('.pack-query-editor-modal__form'),
    });
    // Fleet renders this dropdown with react-select, whose visible control carries no
    // role and whose only labelled node is plain text, so scope by the modal's own
    // per-field wrapper class (PackQueryEditorModal's `baseClass`) instead.
    this.querySelect = this.queryEditorModal.locator(
      '.pack-query-editor-modal__select-query-dropdown-wrapper',
    );
    // Frequency and Shard are the modal's only two number inputs and neither field
    // associates its label with the control, so position is the only discriminator.
    this.frequencyInput = this.queryEditorModal.getByRole('spinbutton').first();
    this.addQueryConfirmButton = this.queryEditorModal.getByRole('button', {
      name: 'Add query',
      exact: true,
    });
  }

  async gotoNew(): Promise<void> {
    await this.page.goto('/packs/new');
    await expect(this.nameInput).toBeVisible();
  }

  /** Fill the form with a name and description. */
  async fillBasics(name: string, description: string): Promise<void> {
    await this.nameInput.fill(name);
    await this.descriptionInput.fill(description);
  }

  /**
   * Open the target picker, search for hosts matching `query`, and add the
   * first matching host to the pack.
   *
   * The picker's search (`POST /targets`) does not filter by status, so the
   * host this lands on may well be offline — roughly half the QA fleet is at
   * any time. That is fine for asserting a pack's host *count*, which is all
   * this is used for. A test that needs the pack to actually run must resolve
   * an online host instead: see the `liveMacosHost` worker fixture and
   * tests/api/packs-execution.spec.ts.
   */
  async addFirstHostTarget(query: string): Promise<void> {
    await this.targetPickerPlaceholder.click();
    await this.targetSearchInput.fill(query);
    await expect(this.targetDropdownMenu).toBeVisible();

    await expect(this.firstHostOption).toBeVisible();
    // Each host option row contains a dedicated "add" button (.target-option__add-btn)
    // rendered by Fleet's <Button variant="icon">. Click it directly — the inner
    // SVG has pointer-events:none, so clicking the button avoids needing force.
    await this.firstHostOption.locator('.target-option__add-btn').click();

    // Confirms the add actually selected a host: the locator matches only a non-zero count.
    await expect(this.uniqueHostCount).toBeVisible();
  }

  /** Click "Save query pack" and wait for redirect to the edit page. */
  async saveNew(): Promise<void> {
    await this.page.getByRole('button', { name: /save query pack/i }).click();
    await expect(this.page).toHaveURL(/\/packs\/\d+/);
    await expect(this.editHeading).toBeVisible();
  }

  /** A row in the pack's scheduled-queries table, matched by query name. */
  scheduledQueryRow(queryName: string): Locator {
    return this.page.getByRole('row').filter({ hasText: queryName });
  }

  /**
   * Attach an existing saved query to the pack on a schedule. `intervalSeconds`
   * is what the form calls "Frequency (seconds)"; the table renders it back
   * humanised (60 → "1 minute").
   */
  async addScheduledQuery(queryName: string, intervalSeconds: number): Promise<void> {
    await this.addReportButton.click();
    await expect(this.queryEditorModal).toBeVisible();

    await this.querySelect.click();
    await this.queryEditorModal.getByRole('option', { name: queryName, exact: true }).click();
    await this.frequencyInput.fill(String(intervalSeconds));

    await expect(this.addQueryConfirmButton).toBeEnabled();
    await this.addQueryConfirmButton.click();
    await expect(this.queryEditorModal).toBeHidden();
  }

  /** On the edit page, update description and click Save. */
  async updateDescription(description: string): Promise<void> {
    await this.descriptionInput.fill(description);
    await this.saveButton.click();
    // Wait for the server to confirm the save — Fleet flashes this on the edit page
    // once the update request resolves, so a caller that navigates away next doesn't
    // abort the in-flight request and lose the change.
    await this.toast.expectSuccess('Successfully updated this pack.');
  }
}
