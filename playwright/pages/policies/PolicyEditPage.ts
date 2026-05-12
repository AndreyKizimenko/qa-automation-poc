import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';
import { Toast } from '../components/Toast';

/**
 * `/policies/new` (new) and `/policies/:id/edit` (existing) — same form,
 * two modes. Saving a new policy opens a "Save policy" modal that
 * collects name + description + resolution + platform; saving an
 * existing one updates directly with no confirmation modal.
 *
 * The SQL editor is Fleet's `SQLEditor` (`.sql-editor` wrapper) around
 * Ace; visible content lives in `.ace_content` and keyboard input is
 * routed through the standard hidden `textarea.ace_text-input`.
 */
export type PolicyPlatform = 'macOS' | 'Windows' | 'Linux' | 'ChromeOS';
export type PolicyTargetType = 'All hosts' | 'Custom';

export interface PolicyFormValues {
  name: string;
  description: string;
  resolution: string;
  platforms: PolicyPlatform[];
  sql: string;
}

/**
 * Fields collected by the "Save policy" modal that pops on Save for a
 * new policy. Platforms / target / critical are left at their modal
 * defaults (macOS, All hosts, not critical) — the smoke flow doesn't
 * need to exercise them at creation time.
 */
export interface SavePolicyValues {
  name: string;
  description: string;
  resolution: string;
}

export class PolicyEditPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly toast: Toast;

  readonly editor: Locator;
  readonly editorContent: Locator;
  readonly editorTextarea: Locator;

  // Inline name input — only renders for an existing policy.
  readonly nameInput: Locator;
  readonly descriptionInput: Locator;
  readonly resolutionInput: Locator;
  readonly saveButton: Locator;

  // "Edit policy" button on the policy results/details page
  // (`/policies/:id`) that opens this form.
  readonly editFromDetailsButton: Locator;

  // "Back to policy" button on the /edit page → `/policies/:id`.
  readonly backToPolicyButton: Locator;

  // Modal that pops on Save for a new policy — contains the full form
  // (name, description, resolution, platforms, target, critical).
  readonly saveNewModal: Locator;
  readonly saveNewNameInput: Locator;
  readonly saveNewDescriptionInput: Locator;
  readonly saveNewResolutionInput: Locator;
  readonly saveNewSubmitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.toast = new Toast(page);

    // The /policies/new and /policies/:id/edit pages also render a
    // schema-sidebar SQL example that uses the same `.sql-editor`
    // wrapper. Filter by the non-readonly textarea (only the main
    // editor is editable; the example's textarea has `readonly`).
    this.editor = page.locator('.sql-editor').filter({
      has: page.locator('textarea.ace_text-input:not([readonly])'),
    });
    this.editorContent = this.editor.locator('.ace_content');
    this.editorTextarea = this.editor.locator('textarea.ace_text-input');

    this.nameInput = page.locator('input[name="policy-name"]');
    this.descriptionInput = page.locator('textarea[name="policy-description"]');
    this.resolutionInput = page.locator('textarea[name="policy-resolution"]');
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });

    this.editFromDetailsButton = page.getByRole('button', { name: 'Edit policy' });
    this.backToPolicyButton = page.getByRole('button', { name: 'Back to policy' });

    this.saveNewModal = page.locator('.modal__modal_container').filter({ hasText: 'Save policy' });
    this.saveNewNameInput = this.saveNewModal.locator('input[name="name"]');
    this.saveNewDescriptionInput = this.saveNewModal.locator('textarea[name="description"]');
    this.saveNewResolutionInput = this.saveNewModal.locator('textarea[name="resolution"]');
    this.saveNewSubmitButton = this.saveNewModal.getByRole('button', { name: 'Save', exact: true });
  }

  /** Platform target checkbox by visible label. */
  platformCheckbox(os: PolicyPlatform): Locator {
    return this.page.getByRole('checkbox', { name: os, exact: true });
  }

  /** All hosts / Custom radio. */
  targetTypeRadio(value: PolicyTargetType): Locator {
    return this.page.getByRole('radio', { name: value });
  }

  async gotoNew(opts: { fleetId?: number } = {}): Promise<void> {
    const qs = opts.fleetId !== undefined ? `?fleet_id=${opts.fleetId}` : '';
    await this.page.goto(`/policies/new${qs}`);
    await expect(this.editorContent).toBeVisible();
  }

  async gotoEdit(id: number, opts: { fleetId?: number } = {}): Promise<void> {
    const qs = opts.fleetId !== undefined ? `?fleet_id=${opts.fleetId}` : '';
    await this.page.goto(`/policies/${id}`);
    // Policies route to the details page; navigate explicitly to the editor.
    await this.page.goto(`/policies/${id}/edit${qs}`);
    await expect(this.nameInput).toBeVisible();
    await expect(this.editorContent).toBeVisible();
  }

  /**
   * Click "Edit policy" on the results page (`/policies/:id`) to open the
   * editor. The list links land on results, not directly on /edit, so
   * specs entering via list → openPolicy() come through here next.
   */
  async clickEditFromDetails(): Promise<void> {
    await this.editFromDetailsButton.click();
    await expect(this.page).toHaveURL(/\/policies\/\d+\/edit/);
    await expect(this.nameInput).toBeVisible();
    await expect(this.editorContent).toBeVisible();
  }

  /**
   * Toggle platform checkboxes so the resulting checked set equals
   * `platforms` exactly. Each policy has at least one platform selected,
   * so callers can't pass `[]`.
   */
  async setPlatforms(platforms: PolicyPlatform[]): Promise<void> {
    for (const os of ['macOS', 'Windows', 'Linux', 'ChromeOS'] as const) {
      const cb = this.platformCheckbox(os);
      if (platforms.includes(os)) await cb.check();
      else await cb.uncheck();
    }
  }

  /** Read back the set of checked platforms. */
  async checkedPlatforms(): Promise<PolicyPlatform[]> {
    const result: PolicyPlatform[] = [];
    for (const os of ['macOS', 'Windows', 'Linux', 'ChromeOS'] as const) {
      if (await this.platformCheckbox(os).isChecked()) result.push(os);
    }
    return result;
  }

  /**
   * Fill every editable field. SQL + platform interactions trigger
   * React re-renders that reset earlier text-field values, so the text
   * inputs (name/description/resolution) go LAST and are re-asserted
   * before save. Critical isn't covered — Fleet's role=checkbox proxy
   * for it doesn't resolve reliably under Playwright.
   */
  async fillAll(values: PolicyFormValues): Promise<void> {
    await this.setSql(values.sql);
    await this.setPlatforms(values.platforms);
    await this.nameInput.fill(values.name);
    await this.descriptionInput.fill(values.description);
    await this.resolutionInput.fill(values.resolution);
    await expect(this.nameInput).toHaveValue(values.name);
    await expect(this.descriptionInput).toHaveValue(values.description);
    await expect(this.resolutionInput).toHaveValue(values.resolution);
  }

  /** Assert every editable field equals `values` (use after re-opening). */
  async expectValues(values: PolicyFormValues): Promise<void> {
    await expect(this.nameInput).toHaveValue(values.name);
    await expect(this.descriptionInput).toHaveValue(values.description);
    await expect(this.resolutionInput).toHaveValue(values.resolution);
    expect(await this.checkedPlatforms()).toEqual(values.platforms);
    expect(await this.sqlText()).toContain(values.sql.trim());
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

  async sqlText(): Promise<string> {
    return (await this.editorContent.innerText()).trim();
  }

  /**
   * New-policy save flow: clicks Save → opens "Save policy" modal → fills
   * name + description + resolution → submits → waits for the success
   * toast. Fleet redirects to `/policies/:id` (the results page) on
   * success; the parsed id is returned.
   */
  async saveNew(values: SavePolicyValues): Promise<number> {
    await this.saveButton.click();
    await expect(this.saveNewModal).toBeVisible();
    await this.saveNewNameInput.fill(values.name);
    await this.saveNewDescriptionInput.fill(values.description);
    await this.saveNewResolutionInput.fill(values.resolution);
    await this.saveNewSubmitButton.click();
    await this.toast.expectSuccess('Policy created.');
    await this.page.waitForURL(/\/policies\/\d+(?:\?|$)/);
    const id = parseInt(
      new URL(this.page.url()).pathname.match(/\/policies\/(\d+)/)?.[1] ?? '0',
      10,
    );
    if (!id) throw new Error(`Could not parse policy id from ${this.page.url()}`);
    return id;
  }

  /** Click "Back to policy" → returns to `/policies/:id` (the results page). */
  async backToPolicy(): Promise<void> {
    await this.backToPolicyButton.click();
    await expect(this.page).toHaveURL(/\/policies\/\d+(?:\?|$)/);
  }

  /** Existing-policy save: clicks Save and waits for the success toast. */
  async saveExisting(): Promise<void> {
    await this.saveButton.click();
    await this.toast.expectSuccess('Policy updated.');
  }
}
