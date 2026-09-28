import { Page, Locator, expect } from '@playwright/test';

/**
 * "MDM command details" — one MDM command's request and the host's answer.
 * Raised from both of the host Activity card's views of a command: the activity
 * ("admin ran UserList as a custom MDM command on this host.") and, with
 * "Show MDM commands" on, the command itself ("The UserList command was
 * acknowledged."). The status line differs between the two; the payloads don't.
 *
 * The request payload and the response are read-only textareas whose labels
 * carry no `for`, so `getByLabel` can't reach them. Each is scoped by the form
 * field holding its label text instead.
 */
export class MdmCommandDetailsModal {
  readonly page: Page;
  readonly modal: Locator;
  readonly statusMessage: Locator;
  readonly requestPayload: Locator;
  /** Labelled "Response from <hostname>:"; absent while the command is pending. */
  readonly response: Locator;
  readonly closeButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.modal = page.locator('.command-details-modal');
    this.statusMessage = this.modal.locator('.icon-status-message__content');
    this.requestPayload = this.modal
      .locator('.form-field')
      .filter({ hasText: 'Request payload:' })
      .getByRole('textbox');
    this.response = this.modal
      .locator('.form-field')
      .filter({ hasText: 'Response from' })
      .getByRole('textbox');
    this.closeButton = this.modal.getByRole('button', { name: 'Close', exact: true });
  }

  async expectOpen(): Promise<void> {
    await expect(this.modal).toBeVisible();
    await expect(this.requestPayload).toBeVisible();
  }

  async close(): Promise<void> {
    await this.closeButton.click();
    await expect(this.modal).toBeHidden();
  }
}
