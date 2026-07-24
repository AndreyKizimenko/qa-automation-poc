import { Page, Locator, expect } from '@playwright/test';

/**
 * The Library section on `/software/titles/:id`. Fleet renders one
 * `LibraryItemAccordion` row per installer (custom package, Fleet-maintained
 * app, VPP / App Store, or Play Store app). The active (installed) version's
 * row is the "an installer is managing this title" signal; extra cached
 * "rollback" versions render as inert `--inactive` rows.
 *
 * The row's action buttons (Download / Delete) live in the panel the header
 * reveals when expanded, so `delete()` expands the row first. Nothing in the
 * row's role or text separates active from rollback, so the row is scoped by
 * its BEM class; the actions themselves resolve by accessible name.
 */
export class SoftwareInstallerCard {
  readonly page: Page;
  /** The active installer row — doubles as the "installer present" signal. */
  readonly card: Locator;
  readonly header: Locator;
  readonly editBadge: Locator;
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
    // it apart from the nested badge buttons; a fresh page load renders it
    // collapsed.
    this.header = this.card.getByRole('button', { expanded: false });

    // The label-scope badge in the collapsed header opens the Edit-software
    // modal. A package with no custom label scope shows the "All hosts" badge;
    // it's the reliable edit affordance for a fresh custom package (the
    // self-service icon only appears once self-service is already on). Exact
    // match: the accordion header is itself a role="button" whose accessible
    // name nests this badge's text, so a substring match resolves to both.
    this.editBadge = this.card.getByRole('button', { name: 'All hosts', exact: true });
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

  async delete(): Promise<void> {
    // Expand the active row so its action panel (Download / Delete) renders.
    await this.header.click();
    await this.deleteButton.click();
    await expect(this.deleteModal).toBeVisible();
    await this.deleteConfirmButton.click();
    // Deleting the sole installer redirects to the software library list, so
    // the title-detail Library row unmounts.
    await expect(this.card).toBeHidden();
  }
}
