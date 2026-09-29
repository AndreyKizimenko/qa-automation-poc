import { Page, Locator, expect } from '@playwright/test';
import { Toast } from './Toast';

/** What the modal's Status column shows for a script's latest run on this host. */
export type RunScriptStatus = 'Ran' | 'Pending' | 'Error';

/**
 * Host details → Actions → **Run script**. Lists the library scripts that apply
 * to the host, one row per script: its name (a button that opens the script's
 * content), the status of its latest run on this host, and a row Actions menu
 * offering **Run** and **Show run details**.
 *
 * Running goes through a separate "Run script?" confirmation (`ConfirmRunScriptModal`)
 * that names the script and the host. Fleet swaps between the two by hiding one
 * while the other shows, so the list modal stays mounted underneath.
 *
 * Fleet's `Modal` renders no dialog role, so each modal is scoped by its own
 * class. The row Actions menu is a react-select whose options keep no ARIA role
 * either, which leaves the option class as their handle — the same fallback the
 * host Actions menu uses.
 */
export class RunScriptModal {
  readonly page: Page;
  readonly toast: Toast;
  readonly modal: Locator;
  readonly closeButton: Locator;
  /** The "Run script?" confirmation raised by a row's Run action. */
  readonly confirmForm: Locator;
  readonly confirmRunButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.toast = new Toast(page);
    this.modal = page.locator('.run-script-modal');
    this.closeButton = this.modal.getByRole('button', { name: 'Close', exact: true });
    this.confirmForm = page.locator('.confirm-run-script-modal__form');
    this.confirmRunButton = this.confirmForm.getByRole('button', { name: 'Run', exact: true });
  }

  async expectOpen(): Promise<void> {
    await expect(this.modal).toBeVisible();
    await expect(this.modal.getByRole('table')).toBeVisible();
  }

  /** One script's row, matched on the exact name of its name button. */
  row(scriptName: string): Locator {
    return this.modal
      .getByRole('row')
      .filter({ has: this.page.getByRole('button', { name: scriptName, exact: true }) });
  }

  /**
   * The row's Status cell. `ScriptStatusCell` renders `---` for a script the host
   * has never run and otherwise one of {@link RunScriptStatus}; the cell's
   * accessible name is that text, which is what makes it addressable.
   */
  status(scriptName: string): Locator {
    return this.row(scriptName).getByRole('cell', { name: /^(Ran|Pending|Error|---)$/ });
  }

  /** A row Actions option by its exact label ("Run", "Show run details"). */
  private rowActionOption(label: string): Locator {
    return this.page
      .locator('.actions-dropdown-select__option')
      .filter({ hasText: new RegExp(`^${label}$`) });
  }

  private async openRowActions(scriptName: string): Promise<void> {
    // The react-select's own input is a 1px dummy; the control is the click target.
    await this.row(scriptName).locator('.actions-dropdown-select__control').click();
  }

  /**
   * Row Actions → Run → confirm. Returns once Fleet has accepted the run, which
   * it signals with the "running or will run" toast — the host picks the script
   * up on its next check-in, so the result is the caller's to wait for.
   */
  async run(scriptName: string, hostName: string): Promise<void> {
    await this.openRowActions(scriptName);
    await this.rowActionOption('Run').click();
    await expect(this.confirmForm).toContainText(`${scriptName} will run on ${hostName}.`);
    await this.confirmRunButton.click();
    await this.toast.expectSuccess('Script is running or will run when the host comes online.');
    await expect(this.modal).toBeVisible();
  }

  /** Row Actions → Show run details. Only enabled once the host has run the script. */
  async showRunDetails(scriptName: string): Promise<void> {
    await this.openRowActions(scriptName);
    await this.rowActionOption('Show run details').click();
  }

  async close(): Promise<void> {
    await this.closeButton.click();
    await expect(this.modal).toBeHidden();
  }
}
