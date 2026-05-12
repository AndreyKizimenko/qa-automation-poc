import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';
import { Toast } from '../components/Toast';

/**
 * `/reports/new` (new) and `/reports/:id/edit` (existing) — same form, two
 * modes. Saving a new report opens a "Save report" modal that collects
 * name + description + interval before persisting; saving an existing one
 * opens a "Save changes?" confirmation modal.
 *
 * The SQL editor is Fleet's `SQLEditor` component (`.sql-editor` wrapper)
 * around Ace; visible code lives in `.ace_content` and keyboard input is
 * routed through the standard hidden `textarea.ace_text-input`.
 */
export type ReportPlatform = 'macOS' | 'Windows' | 'Linux' | 'ChromeOS';
export type ReportInterval =
  | 'Never'
  | 'Every 5 minutes'
  | 'Every 10 minutes'
  | 'Every 15 minutes'
  | 'Every 30 minutes'
  | 'Every hour'
  | 'Every 6 hours'
  | 'Every 12 hours'
  | 'Every day'
  | 'Every week';

export interface ReportFormValues {
  name: string;
  description: string;
  interval: ReportInterval;
  observersCanRun: boolean;
  platforms: ReportPlatform[];
  sql: string;
}

/**
 * Fields collected by the "Save report" modal that pops on Save for a
 * new report. Platforms / target are left at their modal defaults — the
 * smoke flow exercises name + description + interval + observers-can-run.
 */
export interface SaveReportValues {
  name: string;
  description: string;
  interval: ReportInterval;
  observersCanRun: boolean;
}

export class ReportEditPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly toast: Toast;

  readonly editor: Locator;
  readonly editorContent: Locator;
  readonly editorTextarea: Locator;

  // Inline name input — only renders for an existing report.
  readonly nameInput: Locator;
  readonly descriptionInput: Locator;
  readonly observersCanRunCheckbox: Locator;
  // Buttons rendered by EditQueryForm.
  readonly saveButton: Locator;
  readonly liveReportButton: Locator;

  // "Edit report" button on the report results/details page
  // (`/reports/:id`) that opens this form. The button's class is the
  // misleading `query-details-page__manage-automations` — match by
  // visible text instead.
  readonly editFromDetailsButton: Locator;

  // "Back to report" button on the /edit page → `/reports/:id`.
  readonly backToReportButton: Locator;

  // Interval is a react-select v1 widget scoped by `form-field--frequency`.
  readonly intervalControl: Locator;
  readonly intervalValueLabel: Locator;

  // Modal that pops on Save for a new report — contains the full form
  // (name, description, interval, observers-can-run, platforms, target).
  readonly saveNewModal: Locator;
  readonly saveNewNameInput: Locator;
  readonly saveNewDescriptionInput: Locator;
  readonly saveNewObserversCheckbox: Locator;
  readonly saveNewIntervalControl: Locator;
  readonly saveNewIntervalValueLabel: Locator;
  readonly saveNewSubmitButton: Locator;

  // Modal that pops on Save for an existing report.
  readonly confirmSaveModal: Locator;
  readonly confirmSaveButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.toast = new Toast(page);

    // The /reports/new and /reports/:id/edit pages also render a
    // schema-sidebar SQL example that uses the same `.sql-editor`
    // wrapper. `.first()` is unreliable here — initial render order
    // changes whether the main or example editor lands first in the
    // DOM. Filter by the non-readonly textarea (only the main editor
    // is editable; the example's textarea has `readonly`).
    this.editor = page.locator('.sql-editor').filter({
      has: page.locator('textarea.ace_text-input:not([readonly])'),
    });
    this.editorContent = this.editor.locator('.ace_content');
    this.editorTextarea = this.editor.locator('textarea.ace_text-input');

    this.nameInput = page.locator('input[name="query-name"]');
    this.descriptionInput = page.locator('textarea[name="query-description"]');
    // Visible "Observers can run" label wraps a display:none real input plus
    // a role=checkbox proxy whose accessible name is the visible text.
    this.observersCanRunCheckbox = page.getByRole('checkbox', { name: 'Observers can run' });
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });
    this.liveReportButton = page.getByRole('button', { name: /Live report/ });

    this.editFromDetailsButton = page.getByRole('button', { name: 'Edit report' });
    this.backToReportButton = page.getByRole('button', { name: 'Back to report' });

    this.intervalControl = page.locator('.form-field--frequency .Select-control');
    this.intervalValueLabel = page.locator('.form-field--frequency .Select-value-label');

    // Fleet's Modal renders without role/aria-modal; scope by container class
    // plus heading text. New-report modal title is "Save report".
    this.saveNewModal = page.locator('.modal__modal_container').filter({ hasText: 'Save report' });
    this.saveNewNameInput = this.saveNewModal.locator('input[name="name"]');
    this.saveNewDescriptionInput = this.saveNewModal.locator('textarea[name="description"]');
    // The save-new modal's "Observers can run" role=checkbox proxy
    // carries aria-label="observerCanRun" (camelCase API field name).
    // This differs from the inline edit form's equivalent, which has
    // no aria-label and inherits its accessible name from the wrapping
    // <label> text.
    this.saveNewObserversCheckbox = this.saveNewModal.getByRole('checkbox', { name: 'observerCanRun' });
    this.saveNewIntervalControl = this.saveNewModal.locator('.form-field--frequency .Select-control');
    this.saveNewIntervalValueLabel = this.saveNewModal.locator('.form-field--frequency .Select-value-label');
    this.saveNewSubmitButton = this.saveNewModal.getByRole('button', { name: 'Save', exact: true });

    this.confirmSaveModal = page.locator('.modal__modal_container').filter({ hasText: 'Save changes' });
    this.confirmSaveButton = this.confirmSaveModal.getByRole('button', { name: 'Save', exact: true });
  }

  /** Platform target checkbox by visible label. */
  platformCheckbox(os: ReportPlatform): Locator {
    return this.page.getByRole('checkbox', { name: os, exact: true });
  }

  /** `/reports/new` — fresh editor, no name field, no description field. */
  async gotoNew(opts: { fleetId?: number } = {}): Promise<void> {
    const qs = opts.fleetId !== undefined ? `?fleet_id=${opts.fleetId}` : '';
    await this.page.goto(`/reports/new${qs}`);
    await expect(this.editorContent).toBeVisible();
  }

  /** `/reports/:id/edit` — name + description inputs render, editor pre-loaded. */
  async gotoEdit(id: number, opts: { fleetId?: number } = {}): Promise<void> {
    const qs = opts.fleetId !== undefined ? `?fleet_id=${opts.fleetId}` : '';
    await this.page.goto(`/reports/${id}/edit${qs}`);
    await expect(this.nameInput).toBeVisible();
    await expect(this.editorContent).toBeVisible();
  }

  /**
   * Replace SQL via the hidden Ace textarea. The /reports/new editor
   * pre-fills with `SELECT * FROM osquery_info;`, so the select-all +
   * delete + type sequence has to fully replace it. All keyboard ops
   * route through `editorTextarea` so Ctrl/Cmd+A reaches Ace's
   * select-all handler — `page.keyboard.press` targets the focused
   * element, which after clicking the visible div is the wrong target.
   * The trailing `toHaveText` guards against dropped keystrokes.
   */
  async setSql(sql: string): Promise<void> {
    await this.editorContent.click();
    await this.editorTextarea.focus();
    await this.editorTextarea.press('ControlOrMeta+A');
    await this.editorTextarea.press('Delete');
    await this.editorTextarea.pressSequentially(sql);
    await expect(this.editorContent).toHaveText(sql);
  }

  /** Trimmed text shown in the editor. */
  async sqlText(): Promise<string> {
    return (await this.editorContent.innerText()).trim();
  }

  /**
   * New-report save flow: clicks Save → opens "Save report" modal → fills
   * name + description + interval + observers-can-run → submits → waits
   * for the success toast. Fleet redirects to `/reports/:id` on success;
   * the parsed id is returned.
   */
  async saveNew(values: SaveReportValues): Promise<number> {
    await this.saveButton.click();
    await expect(this.saveNewModal).toBeVisible();
    await this.saveNewNameInput.fill(values.name);
    await this.saveNewDescriptionInput.fill(values.description);
    // Interval is a react-select v1 widget inside the modal — open it,
    // wait for the option to render, click it, and confirm the new label.
    if ((await this.saveNewIntervalValueLabel.innerText()).trim() !== values.interval) {
      await this.saveNewIntervalControl.click();
      const option = this.page.locator('.Select-option', { hasText: values.interval });
      await option.waitFor({ state: 'visible' });
      await option.click();
      await expect(this.saveNewIntervalValueLabel).toHaveText(values.interval);
    }
    if (values.observersCanRun) await this.saveNewObserversCheckbox.check();
    else await this.saveNewObserversCheckbox.uncheck();
    await this.saveNewSubmitButton.click();
    await this.toast.expectSuccess('Report created.');
    await this.page.waitForURL(/\/reports\/\d+(?:\?|$)/);
    const id = parseInt(
      new URL(this.page.url()).pathname.match(/\/reports\/(\d+)/)?.[1] ?? '0',
      10,
    );
    if (!id) throw new Error(`Could not parse report id from ${this.page.url()}`);
    return id;
  }

  /** Click "Back to report" → returns to `/reports/:id` (the results page). */
  async backToReport(): Promise<void> {
    await this.backToReportButton.click();
    await expect(this.page).toHaveURL(/\/reports\/\d+(?:\?|$)/);
  }

  /**
   * Existing-report save flow: clicks Save → confirms the "Save changes?"
   * modal → waits for the success toast.
   */
  async saveExisting(): Promise<void> {
    await this.saveButton.click();
    await expect(this.confirmSaveModal).toBeVisible();
    await this.confirmSaveButton.click();
    await this.toast.expectSuccess('Report updated.');
  }

  /** Click "Live report" → navigates to `/reports/:id/live`. */
  async clickLiveReport(): Promise<void> {
    await this.liveReportButton.click();
    await this.page.waitForURL(/\/reports\/\d+\/live/);
  }

  /**
   * Click "Edit report" on the results page (`/reports/:id`) to open the
   * editor. The list links land on results, not directly on /edit, so
   * specs entering via list → openReport() come through here next.
   */
  async clickEditFromDetails(): Promise<void> {
    await this.editFromDetailsButton.click();
    await expect(this.page).toHaveURL(/\/reports\/\d+\/edit/);
    await expect(this.nameInput).toBeVisible();
    await expect(this.editorContent).toBeVisible();
  }

  /** Read the currently-selected interval label. */
  async intervalLabel(): Promise<ReportInterval> {
    return (await this.intervalValueLabel.innerText()).trim() as ReportInterval;
  }

  /**
   * Select an interval option. No-op if already selected. Opens the
   * react-select v1 menu, waits for the target option to render before
   * clicking, and confirms the new label is visible. The explicit
   * `waitFor` on the option avoids a race where the menu is mid-render
   * when Playwright tries to click and the option click silently misses.
   */
  async setInterval(label: ReportInterval): Promise<void> {
    if ((await this.intervalLabel()) === label) return;
    await this.intervalControl.click();
    const option = this.page.locator('.Select-option', { hasText: label });
    await option.waitFor({ state: 'visible' });
    await option.click();
    await expect(this.intervalValueLabel).toHaveText(label);
  }

  /**
   * Toggle platform checkboxes so the resulting checked set equals
   * `platforms` exactly. Each report has at least one platform selected,
   * so callers can't pass `[]`.
   */
  async setPlatforms(platforms: ReportPlatform[]): Promise<void> {
    for (const os of ['macOS', 'Windows', 'Linux', 'ChromeOS'] as const) {
      const cb = this.platformCheckbox(os);
      if (platforms.includes(os)) await cb.check();
      else await cb.uncheck();
    }
  }

  /** Read back the set of checked platforms. */
  async checkedPlatforms(): Promise<ReportPlatform[]> {
    const result: ReportPlatform[] = [];
    for (const os of ['macOS', 'Windows', 'Linux', 'ChromeOS'] as const) {
      if (await this.platformCheckbox(os).isChecked()) result.push(os);
    }
    return result;
  }

  /**
   * Fill every editable field. SQL + platform/observer clicks + the
   * interval react-select trigger React re-renders that reset earlier
   * text-field values, so the text inputs go LAST and are re-asserted
   * before save.
   */
  async fillAll(values: ReportFormValues): Promise<void> {
    await this.setSql(values.sql);
    await this.setInterval(values.interval);
    if (values.observersCanRun) await this.observersCanRunCheckbox.check();
    else await this.observersCanRunCheckbox.uncheck();
    await this.setPlatforms(values.platforms);
    await this.nameInput.fill(values.name);
    await this.descriptionInput.fill(values.description);
    await expect(this.nameInput).toHaveValue(values.name);
    await expect(this.descriptionInput).toHaveValue(values.description);
  }

  /** Assert every editable field equals `values` (use after re-opening). */
  async expectValues(values: ReportFormValues): Promise<void> {
    await expect(this.nameInput).toHaveValue(values.name);
    await expect(this.descriptionInput).toHaveValue(values.description);
    expect(await this.intervalLabel()).toBe(values.interval);
    await expect(this.observersCanRunCheckbox).toBeChecked({ checked: values.observersCanRun });
    expect(await this.checkedPlatforms()).toEqual(values.platforms);
    expect(await this.sqlText()).toContain(values.sql.trim());
  }
}
