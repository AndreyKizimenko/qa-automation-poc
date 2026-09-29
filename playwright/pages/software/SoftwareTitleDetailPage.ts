import { Page, Locator, expect } from '@playwright/test';
import { DataSet } from '../components/DataSet';
import { DataTable } from '../components/DataTable';
import { Navbar } from '../components/Navbar';
import { SoftwareInstallerCard } from '../components/SoftwareInstallerCard';
import { EditSoftwareModal } from '../components/EditSoftwareModal';
import { EditAppearanceModal } from '../components/EditAppearanceModal';
import { Toast } from '../components/Toast';
import { VersionsModal } from '../components/VersionsModal';

/** Items Fleet offers in the summary card's Actions menu. */
export type SoftwareTitleAction =
  | 'Edit appearance'
  | 'Edit software'
  | 'Edit configuration'
  | 'Deploy'
  | 'Versions'
  | 'Schedule auto updates';

/**
 * /software/titles/:id — versions table for a software title. Titles managed
 * by an installer also render a Library section of accordion rows, modelled
 * by `SoftwareInstallerCard`.
 *
 * The summary card's edit affordance has two shapes, which is why
 * {@link openEditAppearance} branches. A premium **custom package** is a
 * multi-package title: per-installer editing moves down into the accordion row
 * and the card collapses to a single pencil "Edit" button that opens Edit
 * appearance directly. Everything else (Fleet-maintained, VPP, Play Store, iOS
 * in-house) keeps the "Actions" dropdown, where Edit appearance is one item
 * among several.
 */
export class SoftwareTitleDetailPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly table: DataTable;
  readonly installerCard: SoftwareInstallerCard;
  readonly editSoftwareModal: EditSoftwareModal;
  readonly editAppearanceModal: EditAppearanceModal;
  readonly versionsModal: VersionsModal;
  readonly toast: Toast;
  /**
   * The page's main software-name heading. The visible text is the title's
   * display name, but the accessible name is the static `software display
   * name` aria-label, so getByLabel resolves the element correctly. Scoped to
   * the summary card because the Edit-appearance modal renders a preview copy
   * of the same heading.
   */
  readonly displayHeading: Locator;
  /**
   * The "Hosts" summary metric links to the hosts list filtered by this title.
   * Its visible text is the volatile host-count number, so it's targeted by the
   * `software_title_id` it links to rather than by name.
   */
  readonly hostCountLink: Locator;
  /** Summary card values — Fleet renders each as a `<dt>`/`<dd>` DataSet. */
  readonly typeValue: Locator;
  readonly versionsValue: Locator;
  /** Chips beside the title: "Fleet-maintained", "Custom package", … */
  readonly headerPills: Locator;
  /** The pencil "Edit" button premium custom-package titles show instead of Actions. */
  readonly editAppearanceButton: Locator;
  /** The summary card's "Actions" dropdown trigger (every other installer type). */
  readonly actionsDropdown: Locator;
  /**
   * The `<img>` Fleet renders only when a title has a custom (or VPP-supplied)
   * icon — it fetches the blob and swaps in this element. The fallback matched
   * icon renders a different element, so this locator's presence *is* the
   * "custom icon in effect" signal for installer titles that have no VPP
   * artwork. `alt` is empty by design, leaving the class as the only handle.
   */
  readonly customIcon: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.table = new DataTable(page);
    this.installerCard = new SoftwareInstallerCard(page);
    this.editSoftwareModal = new EditSoftwareModal(page);
    this.editAppearanceModal = new EditAppearanceModal(page);
    this.versionsModal = new VersionsModal(page);
    this.toast = new Toast(page);
    this.hostCountLink = page.locator('a[href*="software_title_id"]').first();

    // Scoped to the summary card: the Edit-appearance modal renders its own
    // preview copy of the same heading and DataSets and would otherwise collide.
    const summaryCard = page.locator('.software-summary-card');
    this.displayHeading = summaryCard.getByLabel('software display name');
    const summary = new DataSet(summaryCard);
    this.typeValue = summary.value('Type');
    this.versionsValue = summary.value('Versions');
    this.headerPills = summaryCard.locator('.software-details-summary__header-pills .chip');

    const actionsWrapper = summaryCard.locator('.software-details-summary__actions-wrapper');
    this.editAppearanceButton = actionsWrapper.getByRole('button', { name: 'Edit', exact: true });
    // Fleet's ActionsDropdown is a react-select control whose trigger keeps no
    // usable role; `.actions-dropdown__wrapper` is the outer element, unique
    // within the card.
    this.actionsDropdown = actionsWrapper.locator('.actions-dropdown__wrapper');

    this.customIcon = page.locator('.software-icon__software-img');
  }

  /** The visible display-name text shown in the title's `<h1>` heading. */
  async displayName(): Promise<string> {
    return (await this.displayHeading.innerText()).trim();
  }

  async goto(opts: { titleId: number; fleetId?: number }): Promise<void> {
    const qs = opts.fleetId !== undefined ? `?fleet_id=${opts.fleetId}` : '';
    await this.page.goto(`/software/titles/${opts.titleId}${qs}`);
    await expect(this.displayHeading).toBeVisible();
  }

  /**
   * An item in the summary card's Actions menu. Fleet's ActionsDropdown
   * renders options through a custom react-select Option component that keeps
   * no `role="option"`, so the class is the handle — the same fallback the
   * users and labels pages use.
   */
  actionOption(action: SoftwareTitleAction): Locator {
    return this.page
      .locator('.actions-dropdown-select__option')
      .filter({ hasText: action })
      .first();
  }

  /** Open the Actions menu and pick an item. Not available on custom packages. */
  async runAction(action: SoftwareTitleAction): Promise<void> {
    await this.actionsDropdown.click();
    await this.actionOption(action).click();
  }

  /**
   * Open the Edit-appearance modal by whichever affordance this title renders
   * (see the class note on the two shapes).
   */
  async openEditAppearance(): Promise<void> {
    if (await this.editAppearanceButton.count()) {
      await this.editAppearanceButton.click();
    } else {
      await this.runAction('Edit appearance');
    }
    await this.editAppearanceModal.expectOpen();
  }

  /**
   * Open the Versions modal from the Actions menu. Fleet-maintained apps on
   * premium only; the accordion row's pin badge opens the same modal.
   */
  async openVersions(): Promise<void> {
    await this.runAction('Versions');
    await this.versionsModal.expectOpen();
  }

  async clickVersion(version: string): Promise<void> {
    const link = this.table.rowWith(version).getByRole('link', { name: version, exact: true }).first();
    await expect(link, `version ${version} on this title`).toBeVisible();
    await link.click();
  }

  /** Throws if no version has vulnerabilities (`---` in the column). */
  async clickFirstVersionWithVulnerabilities(): Promise<void> {
    const rows = this.table.table.locator('tbody tr');
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const vulnCell = await this.table.cellByColumn(row, 'Vulnerabilities');
      const text = (await vulnCell.innerText()).trim();
      if (text !== '---') {
        await row.locator('td').first().getByRole('link').first().click();
        return;
      }
    }
    throw new Error('No version with vulnerabilities found on this software title');
  }

  async waitForReady(): Promise<void> {
    await expect(this.table.firstRow).toBeVisible();
  }

  /** Clicks the "Hosts" count → the hosts list filtered by this software title. */
  async viewHosts(): Promise<void> {
    await this.hostCountLink.click();
  }
}
