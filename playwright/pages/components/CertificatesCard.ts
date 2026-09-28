import { Page, Locator, expect } from '@playwright/test';
import { clickHoverAction } from './clickHoverAction';
import { DataSet } from './DataSet';

/**
 * The "Certificates" card on `/hosts/:id/details` (and the end user's My device
 * page), which lists the certificates a host reports out of its system and
 * login keychains.
 *
 * Fleet renders it only for Apple and Windows hosts that actually report at
 * least one certificate (`HostDetailsPage.tsx`, `showCertificatesCard`), so a
 * spec must resolve a real VM — an osquery-perf simulation reports none and the
 * card never mounts.
 *
 * The card, its table and its rows are role-less wrappers, so the card itself is
 * scoped by its own `certificates-card` class; everything inside is reached by
 * role from there. Scoping matters: the Details tab renders several tables
 * (local user accounts, Munki issues) that an unscoped table locator would also
 * match.
 */
export class CertificatesCard {
  readonly page: Page;
  readonly card: Locator;
  readonly heading: Locator;
  /** "N certificates" — Fleet's `TableCount` above the table. */
  readonly count: Locator;
  readonly rows: Locator;
  /**
   * The modal raised by a row's "View details", scoped by its own BEM class —
   * Fleet's `Modal` renders its title as a bare `<span>`, so there is no
   * heading or dialog role to target.
   */
  readonly detailsModal: Locator;

  constructor(page: Page) {
    this.page = page;
    this.card = page.locator('.certificates-card');
    this.heading = this.card.getByRole('heading', { name: 'Certificates', exact: true });
    this.count = this.card.locator('.table-container__results-count');
    this.rows = this.card.getByRole('table').locator('tbody').getByRole('row');
    this.detailsModal = page.locator('.certificate-details-modal');
  }

  /** One column header by its exact visible label. */
  columnHeader(name: string): Locator {
    return this.card.getByRole('columnheader', { name, exact: true });
  }

  /**
   * The row whose **Name** cell is exactly `commonName`. Pinned to the first
   * column, not to row text or to any cell: Fleet issues a host both a "Fleet"
   * CA certificate and a "Fleet Identity" certificate whose Issuer cell reads
   * "Fleet", so matching any cell resolves "Fleet" to two rows. The Name cell is
   * addressed positionally because the table's cells expose no role or label
   * distinguishing one column from another.
   */
  row(commonName: string): Locator {
    return this.rows.filter({
      has: this.page.locator('td:first-child').getByText(commonName, { exact: true }),
    });
  }

  /**
   * One cell of a certificate's row, addressed by its column's visible header.
   * The table's cells carry no role or label of their own, so the column is
   * resolved to an index from the header row and the cell taken positionally —
   * which keeps an assertion on "the Issuer of this certificate" from passing
   * because the word happened to appear in some other column.
   */
  async cell(commonName: string, column: string): Promise<Locator> {
    const headers = this.card.getByRole('columnheader');
    const labels = await headers.allInnerTexts();
    const index = labels.findIndex((l) => l.trim() === column);
    expect(index, `column "${column}" not found in the certificates table`).toBeGreaterThan(-1);
    return this.row(commonName).locator('td').nth(index);
  }

  /** Waits for the card to mount and render its first certificate. */
  async waitForReady(): Promise<void> {
    await expect(this.heading).toBeVisible();
    await expect(this.rows.first()).toBeVisible();
  }

  /**
   * Opens a certificate's details modal. "View details" is a `row-hover-button`
   * that Fleet keeps hidden until the row is hovered, so the click goes through
   * `clickHoverAction` to survive a hover lost to a re-render.
   */
  async openDetails(commonName: string): Promise<void> {
    const row = this.row(commonName);
    await clickHoverAction(row, row.getByText('View details'));
    await expect(this.detailsModal).toBeVisible();
  }

  /** Closes the certificate details modal and waits for it to unmount. */
  async closeDetails(): Promise<void> {
    await this.detailsModal.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(this.detailsModal).toBeHidden();
  }

  /**
   * A section heading inside the details modal — "Subject name", "Issuer name",
   * "Validity period", "Key info", "Basic constraints", "Signature". Each is
   * rendered only when the certificate carries a value for it
   * (`CertificateDetailsModal.tsx`).
   */
  detailsSection(name: string): Locator {
    return this.detailsModal.getByRole('heading', { level: 3, name, exact: true });
  }

  /**
   * A term/value pair inside one section of the details modal. Scoped by
   * section because the modal repeats terms across sections — "Common name"
   * appears under both Subject name and Issuer name, "Algorithm" under both Key
   * info and Signature — so an unscoped lookup matches two elements.
   */
  detailsValue(section: string, title: string): Locator {
    const scope = this.detailsModal.locator(
      `.certificate-details-modal__section:has(h3:text-is("${section}"))`,
    );
    return new DataSet(scope).value(title);
  }
}
