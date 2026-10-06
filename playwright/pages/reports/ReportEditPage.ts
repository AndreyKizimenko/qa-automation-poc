import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';
import { TargetLabelSelector } from '../components/TargetLabelSelector';
import { TeamDropdown } from '../components/TeamDropdown';
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
 *
 * The edit form's fields come from report state Fleet keeps across
 * client-side navigation, and are filled again when the page's own fetch of
 * the report returns. Reached by clicking "Edit report", the form can show the
 * right values and still overwrite an edit a moment later: the save then
 * stores nothing and asks nothing. To edit a report that was just saved, load
 * the page with `gotoEdit()` and wait for the saved values to show (a fresh
 * load starts from Fleet's defaults), or let `fillAll()` re-apply what drifted.
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
  /** The Automations slider; left as it is when omitted. */
  automations?: boolean;
}

/**
 * Fields collected by the "Save report" modal that pops on Save for a
 * new report. Platforms and Automations are left at the modal's defaults
 * when omitted (every platform the SQL is compatible with; automations off).
 */
export interface SaveReportValues {
  name: string;
  description: string;
  interval: ReportInterval;
  observersCanRun: boolean;
  platforms?: ReportPlatform[];
  automations?: boolean;
  /** Store data, under the modal's Advanced options; left at its default (on) when omitted. */
  storeData?: boolean;
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
  // Inline validator message the SQLEditor shows for a syntactically invalid
  // query. Fleet still permits saving (to support catching false-positives),
  // so specs assert it appears while Save stays enabled.
  readonly sqlSyntaxError: Locator;

  // "Edit report" button on the report results/details page
  // (`/reports/:id`) that opens this form. The button's class is the
  // misleading `query-details-page__manage-automations` — match by
  // visible text instead.
  readonly editFromDetailsButton: Locator;

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
  readonly saveNewCancelButton: Locator;
  /** The Save report modal's Automations slider and the log-destination copy beside it. */
  readonly saveNewAutomationsSwitch: Locator;
  readonly saveNewAutomationsCopy: Locator;
  readonly saveNewAdvancedOptionsButton: Locator;
  readonly saveNewStoreDataCheckbox: Locator;
  /** The Save report modal's label target — the dropdown variant (Include any / Include all; premium). */
  readonly saveNewTargets: TargetLabelSelector;

  // The edit form's Automations slider and its log-destination copy, and the
  // Store data checkbox under Advanced options.
  readonly automationsSwitch: Locator;
  readonly automationsCopy: Locator;
  readonly advancedOptionsButton: Locator;
  readonly storeDataCheckbox: Locator;

  // Modal that pops on Save for an existing report.
  readonly confirmSaveModal: Locator;
  readonly confirmSaveButton: Locator;

  // "Save as new" secondary button (renders on the edit form for an existing
  // report, save-permitted roles) and the modal it opens.
  readonly saveAsNewButton: Locator;
  readonly saveAsNewModal: Locator;
  readonly saveAsNewNameInput: Locator;
  readonly saveAsNewSubmitButton: Locator;
  readonly saveAsNewCancelButton: Locator;
  /** The modal's "Fleet" field (premium, and only when the user has more than one fleet to choose). */
  readonly saveAsNewFleetDropdown: TeamDropdown;

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
    // Same validator as the policy editor, so the same three messages apply —
    // see PolicyEditPage for the breakdown.
    this.sqlSyntaxError = page.getByText(
      /Syntax error(?: on line \d+, column \d+)?\. Please review before saving\.|Expected a SELECT statement on line \d+\./,
    );

    this.editFromDetailsButton = page.getByRole('button', { name: 'Edit report' });

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
    this.saveNewCancelButton = this.saveNewModal.getByRole('button', { name: 'Cancel', exact: true });
    // Fleet's Slider is a nameless `role="switch"` button, and the modal holds
    // only one. Its label ("Automations on/off") and the log-destination
    // sentence render as one text run beside it.
    this.saveNewAutomationsSwitch = this.saveNewModal.getByRole('switch');
    this.saveNewAutomationsCopy = this.saveNewModal.getByText(/Historical results will (not )?be sent to your log destination/);
    this.saveNewAdvancedOptionsButton = this.saveNewModal.getByRole('button', { name: 'Advanced options' });
    this.saveNewStoreDataCheckbox = this.saveNewModal.getByRole('checkbox', { name: 'discardData' });
    this.saveNewTargets = new TargetLabelSelector(this.saveNewModal);

    // The edit form has the same nameless slider, the only switch on the page.
    this.automationsSwitch = page.getByRole('switch');
    this.automationsCopy = page.getByText(/Historical results will (not )?be sent to your log destination/);
    this.advancedOptionsButton = page.getByRole('button', { name: 'Advanced options' });
    // "Store data" is a role=checkbox proxy whose aria-label is the form field
    // it inverts (`discardData`): ticked means results are stored.
    this.storeDataCheckbox = page.getByRole('checkbox', { name: 'discardData' });

    this.confirmSaveModal = page.locator('.modal__modal_container').filter({ hasText: 'Save changes' });
    this.confirmSaveButton = this.confirmSaveModal.getByRole('button', { name: 'Save', exact: true });

    this.saveAsNewButton = page.getByRole('button', { name: 'Save as new' });
    this.saveAsNewModal = page.locator('.modal__modal_container').filter({ hasText: 'Save as new' });
    // InputField name="queryName" renders id="queryName" with no associated
    // <label htmlFor>, so target it by id within the modal.
    this.saveAsNewNameInput = this.saveAsNewModal.locator('#queryName');
    this.saveAsNewSubmitButton = this.saveAsNewModal.getByRole('button', { name: 'Save', exact: true });
    this.saveAsNewCancelButton = this.saveAsNewModal.getByRole('button', { name: 'Cancel', exact: true });
    this.saveAsNewFleetDropdown = new TeamDropdown(page, this.saveAsNewModal);
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
   * Replace SQL by writing directly into Ace's buffer. Going through
   * the hidden textarea (`pressSequentially`) routes through Ace's
   * key-event pipeline, which in SQL mode can auto-insert characters
   * around `;` and duplicate the trailing terminator. `setValue` on
   * the Ace instance attached to the editor DOM bypasses that layer
   * entirely; the `1` cursor-position arg places the caret at the end.
   */
  async setSql(sql: string): Promise<void> {
    await this.editorContent.click();
    await this.editorContent.evaluate((el, newSql) => {
      const aceEl = el.closest('.ace_editor');
      const env = (aceEl as unknown as { env?: { editor?: { setValue: (v: string, c?: number) => void } } } | null)?.env;
      if (!env?.editor) throw new Error('Ace editor instance not found on .ace_editor element');
      env.editor.setValue(newSql, 1);
    }, sql);
    await expect(this.editorContent).toHaveText(sql);
  }

  /** Trimmed text shown in the editor. */
  async sqlText(): Promise<string> {
    return (await this.editorContent.innerText()).trim();
  }

  /**
   * New-report save flow: clicks Save → opens "Save report" modal → fills
   * name + description + interval + observers-can-run, and the platforms,
   * Automations and Store data when given → submits → waits for the success
   * toast. Fleet redirects to `/reports/:id` on success; the parsed id is
   * returned.
   */
  async saveNew(
    values: SaveReportValues,
    target?: { option: 'Include any' | 'Include all'; labels: string[] },
  ): Promise<number> {
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
    if (values.platforms) await this.setPlatforms(values.platforms);
    if (values.automations !== undefined) await this.setSwitch(this.saveNewAutomationsSwitch, values.automations);
    if (values.storeData !== undefined) {
      if (!(await this.saveNewStoreDataCheckbox.isVisible())) await this.saveNewAdvancedOptionsButton.click();
      if (values.storeData) await this.saveNewStoreDataCheckbox.check();
      else await this.saveNewStoreDataCheckbox.uncheck();
      await expect(this.saveNewStoreDataCheckbox).toBeChecked({ checked: values.storeData });
    }
    if (target) {
      await this.saveNewTargets.chooseCustom();
      await this.saveNewTargets.scope(target.option, target.labels);
    }
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

  /**
   * Existing-report save flow: clicks Save → confirms the "Save changes?"
   * modal → waits for the success toast. Fleet then redirects to the report
   * details page (`/reports/:id`).
   *
   * Fleet asks for that confirmation only when the save would delete the
   * report's stored results: the report stores them and the edit changes its
   * SQL, platforms or minimum osquery version, turns Store data off, or moves
   * to differential logging (`EditQueryForm`'s `confirmChanges`). Pass
   * `prompt: false` for an edit that saves straight away; the method then
   * asserts the modal never opened.
   */
  async saveExisting(opts: { prompt?: boolean } = {}): Promise<void> {
    await this.saveButton.click();
    if (opts.prompt === false) {
      // Whichever comes first — the prompt or the save — then fail on the prompt
      // by name rather than as a toast that never came.
      await expect(this.confirmSaveModal.or(this.toast.success)).not.toHaveCount(0);
      await expect(this.confirmSaveModal, 'Fleet asked to confirm a save that deletes nothing').toHaveCount(0);
      await this.toast.expectSuccess('Report updated.');
    } else {
      await expect(this.confirmSaveModal).toBeVisible();
      await this.confirmSaveButton.click();
      await this.toast.expectSuccess('Report updated.');
    }
    await this.page.waitForURL(/\/reports\/\d+(?:\?|$)/);
  }

  /** Opens Advanced options on the edit form, if it isn't already. */
  async openAdvancedOptions(): Promise<void> {
    if (!(await this.storeDataCheckbox.isVisible())) await this.advancedOptionsButton.click();
    await expect(this.storeDataCheckbox).toBeVisible();
  }

  /** Ticks or unticks Store data under Advanced options. */
  async setStoreData(on: boolean): Promise<void> {
    await this.openAdvancedOptions();
    if (on) await this.storeDataCheckbox.check();
    else await this.storeDataCheckbox.uncheck();
    await expect(this.storeDataCheckbox).toBeChecked({ checked: on });
  }

  /** Sets the edit form's Automations slider. */
  async setAutomations(on: boolean): Promise<void> {
    await this.setSwitch(this.automationsSwitch, on);
  }

  /** Flips a Fleet Slider (`role="switch"`, state in `aria-checked`) to `on`. */
  private async setSwitch(slider: Locator, on: boolean): Promise<void> {
    await expect(slider).toBeVisible();
    if ((await slider.getAttribute('aria-checked')) !== String(on)) await slider.click();
    await expect(slider).toHaveAttribute('aria-checked', String(on));
  }

  /**
   * Open the "Save as new" modal from the edit form. Returns the copy name it
   * pre-fills ("Copy of <original>").
   */
  async openSaveAsNew(): Promise<string> {
    await this.saveAsNewButton.click();
    await expect(this.saveAsNewModal).toBeVisible();
    return (await this.saveAsNewNameInput.inputValue()).trim();
  }

  /** Submit the "Save as new" modal, optionally overriding the copy name. */
  async submitSaveAsNew(name?: string): Promise<void> {
    if (name !== undefined) await this.saveAsNewNameInput.fill(name);
    await this.saveAsNewSubmitButton.click();
  }

  /** Click "Live report" → `/reports/:id/live`, or `/reports/new/live` from an unsaved report. */
  async clickLiveReport(): Promise<void> {
    await this.liveReportButton.click();
    await this.page.waitForURL(/\/reports\/(?:\d+|new)\/live/);
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
   * Fill every editable field. The interval react-select, platform/observer
   * clicks, and the Custom-target useEffect that landed in
   * fleetdm/fleet#41565 all trigger React re-renders that can clobber
   * earlier field values mid-fill. The first pass sets every field; the
   * second pass verifies each one and re-applies any drift before save.
   * Without the second pass the suite is flaky — the most common symptom
   * is the SQL editor reverting to the stored value, which then makes
   * `confirmChanges` false and `saveExisting()` hang waiting for the
   * Save Changes confirm modal that never opens.
   */
  async fillAll(values: ReportFormValues): Promise<void> {
    await this.setSql(values.sql);
    await this.setInterval(values.interval);
    if (values.observersCanRun) await this.observersCanRunCheckbox.check();
    else await this.observersCanRunCheckbox.uncheck();
    await this.setPlatforms(values.platforms);
    if (values.automations !== undefined) await this.setAutomations(values.automations);
    await this.nameInput.fill(values.name);
    await this.descriptionInput.fill(values.description);

    if ((await this.intervalLabel()) !== values.interval) {
      await this.setInterval(values.interval);
    }
    if ((await this.observersCanRunCheckbox.isChecked()) !== values.observersCanRun) {
      if (values.observersCanRun) await this.observersCanRunCheckbox.check();
      else await this.observersCanRunCheckbox.uncheck();
    }
    const currentPlatforms = await this.checkedPlatforms();
    if (JSON.stringify(currentPlatforms) !== JSON.stringify(values.platforms)) {
      await this.setPlatforms(values.platforms);
    }
    if (
      values.automations !== undefined &&
      (await this.automationsSwitch.getAttribute('aria-checked')) !== String(values.automations)
    ) {
      await this.setAutomations(values.automations);
    }
    if ((await this.nameInput.inputValue()) !== values.name) {
      await this.nameInput.fill(values.name);
    }
    if ((await this.descriptionInput.inputValue()) !== values.description) {
      await this.descriptionInput.fill(values.description);
    }
    if (!(await this.sqlText()).includes(values.sql.trim())) {
      await this.setSql(values.sql);
    }

    await expect(this.nameInput).toHaveValue(values.name);
    await expect(this.descriptionInput).toHaveValue(values.description);
    await expect(this.intervalValueLabel).toHaveText(values.interval);
    await expect(this.observersCanRunCheckbox).toBeChecked({ checked: values.observersCanRun });
    expect(await this.checkedPlatforms()).toEqual(values.platforms);
    expect(await this.sqlText()).toContain(values.sql.trim());
    if (values.automations !== undefined) {
      await expect(this.automationsSwitch).toHaveAttribute('aria-checked', String(values.automations));
    }
  }

  /** Assert every editable field equals `values` (use after re-opening). */
  async expectValues(values: ReportFormValues): Promise<void> {
    await expect(this.nameInput).toHaveValue(values.name);
    await expect(this.descriptionInput).toHaveValue(values.description);
    await expect(this.intervalValueLabel).toHaveText(values.interval);
    await expect(this.observersCanRunCheckbox).toBeChecked({ checked: values.observersCanRun });
    expect(await this.checkedPlatforms()).toEqual(values.platforms);
    expect(await this.sqlText()).toContain(values.sql.trim());
  }
}
