import { Page, Locator, expect } from '@playwright/test';

/**
 * The Library section on `/software/titles/:id`. Fleet renders one
 * `LibraryItemAccordion` row per installer (custom package, Fleet-maintained
 * app, VPP / App Store, or Play Store app). The active (installed) version's
 * row is the "an installer is managing this title" signal; extra cached
 * "rollback" versions render as inert `--inactive` rows.
 *
 * The row's action buttons (Edit software / Download installer / Delete this
 * version) live in the panel the header reveals when expanded, so every method
 * that uses one expands the row first. Nothing in the row's role or text
 * separates active from rollback, so the row is scoped by its BEM class; the
 * actions themselves resolve by accessible name.
 *
 * The collapsed header carries the row's badges. Fleet-maintained rows show the
 * pin state — "Latest", "Pinned" or "Major version" — as a button that opens the
 * Versions modal; every editable row also shows the label-scope badge ("All
 * hosts", or a tag count), which opens the Edit-software modal.
 */
export class SoftwareInstallerCard {
  readonly page: Page;
  /** The active installer row — doubles as the "installer present" signal. */
  readonly card: Locator;
  readonly header: Locator;
  readonly editBadge: Locator;
  /**
   * The label-scope badge in either state — "All hosts", or the count of labels
   * once the package is scoped — both open the Edit-software modal.
   */
  readonly scopeBadge: Locator;
  readonly latestBadge: Locator;
  readonly pinnedBadge: Locator;
  readonly majorVersionBadge: Locator;
  readonly editSoftwareButton: Locator;
  readonly downloadButton: Locator;
  readonly deleteButton: Locator;
  readonly deleteModal: Locator;
  readonly deleteConfirmButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // The active version's row is the only expandable one; rollback rows carry
    // the `--inactive` modifier and reveal no actions. Nothing in the row's
    // role/text separates active from rollback, so this BEM class is the handle.
    this.card = page.locator(
      '.library-item-accordion:not(.library-item-accordion--inactive)',
    );

    // The row header is the only descendant carrying aria-expanded, which sets
    // it apart from the nested badge buttons. Matched by class rather than by
    // expanded state so the same locator works collapsed and expanded — a
    // state-filtered locator silently resolves to nothing once the row opens,
    // and `count()` on it can't tell "already expanded" from "not rendered yet".
    this.header = this.card.locator('.library-item-accordion__header');

    // The label-scope badge in the collapsed header opens the Edit-software
    // modal. A package with no custom label scope shows the "All hosts" badge;
    // it's the reliable edit affordance for a fresh custom package (the
    // self-service icon only appears once self-service is already on). Exact
    // match: the accordion header is itself a role="button" whose accessible
    // name nests this badge's text, so a substring match resolves to both.
    this.editBadge = this.card.getByRole('button', { name: 'All hosts', exact: true });
    // The count badge's name is the number alone (its tag icon has none);
    // anchored, like the exact match above, so the header's nested name can't match.
    this.scopeBadge = this.card.getByRole('button', { name: /^(All hosts|\d+)$/ });

    // Pin-state badges. Only Fleet-maintained rows render one, and only one at
    // a time; each opens the Versions modal. Exact match for the same reason as
    // the label badge — the accordion header's accessible name nests them.
    this.latestBadge = this.card.getByRole('button', { name: 'Latest', exact: true });
    this.pinnedBadge = this.card.getByRole('button', { name: 'Pinned', exact: true });
    this.majorVersionBadge = this.card.getByRole('button', { name: 'Major version', exact: true });

    this.editSoftwareButton = this.card.getByRole('button', { name: 'Edit software' });
    this.downloadButton = this.card.getByRole('button', { name: 'Download installer' });
    this.deleteButton = this.card.getByRole('button', { name: 'Delete this version' });

    // Title is "Delete package" for custom-package titles (which can hold
    // several packages) and "Delete software" for FMA / App Store / Play Store.
    this.deleteModal = page
      .locator('.modal__modal_container')
      .filter({ hasText: /Delete (software|package)/ });
    // Exact match: the modal also contains a Cancel button.
    this.deleteConfirmButton = this.deleteModal.getByRole('button', { name: /^delete$/i });
  }

  /** Opens the Edit-software modal via the collapsed header's label badge. */
  async openEdit(): Promise<void> {
    await this.editBadge.click();
  }

  /** Opens the Edit-software modal from the scope badge, scoped or not. */
  async openScopeEditor(): Promise<void> {
    await this.scopeBadge.click();
  }

  /**
   * Expand the active row so its action panel renders. Idempotent — a row
   * that is already open is left alone.
   */
  async expand(): Promise<void> {
    // getAttribute auto-waits for the header, so this also covers a row that
    // hasn't finished rendering when expand() is called.
    if ((await this.header.getAttribute('aria-expanded')) !== 'true') {
      await this.header.click();
    }
    await expect(this.deleteButton).toBeVisible();
  }

  /**
   * Download the row's installer and hand back the saved file's path. Fleet
   * mints a one-shot token and triggers a synthetic `<a download>` click, so
   * the download event is the only signal the request happened.
   */
  async download(): Promise<{ suggestedFilename: string; path: string }> {
    await this.expand();
    const downloadPromise = this.page.waitForEvent('download');
    await this.downloadButton.click();
    const download = await downloadPromise;
    const filePath = await download.path();
    if (!filePath) throw new Error('Installer download produced no file on disk');
    return { suggestedFilename: download.suggestedFilename(), path: filePath };
  }

  async delete(): Promise<void> {
    await this.expand();
    await this.deleteButton.click();
    await expect(this.deleteModal).toBeVisible();
    await this.deleteConfirmButton.click();
    // Deleting the sole installer redirects to the software library list, so
    // the title-detail Library row unmounts.
    await expect(this.card).toBeHidden();
  }
}
