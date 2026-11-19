import { Page, Locator, expect } from '@playwright/test';
import { DataSet } from '../components/DataSet';
import { waitForTableSettled } from '../components/DataTable';
import { ActionsMenu } from '../components/dropdowns';
import { FilterModal } from '../components/FilterModal';
import { fleetModal } from '../components/Modal';
import { Toast } from '../components/Toast';

/** The page's tabs, in Fleet's order (`DeviceUserPage.tsx`). Which of them show depends on the tier and the host. */
export type MyDeviceTab = 'Self service' | 'Details' | 'Controls' | 'Software' | 'Policies';

/**
 * /device/:token — the end user's own page for one host, "My device". A global admin reaches a real host's
 * from Host details (`HostDetailsPage.openMyDevice`), which opens it in a new window and logs a "retrieved the
 * My device URL" activity, so this object wraps that window's page. The link lands on the Details tab.
 *
 * The page names no host: its heading is "My device" whatever the host, so a test tells hosts apart by the
 * vitals it shows (IP and MAC address). Its tabs, in order: **Self service** (premium, while the host's fleet
 * offers it something), **Details**, **Controls** (macOS and Windows, and Linux once it has a control),
 * **Software** (the inventory) and **Policies** (premium). A tab with a count reads "Policies 1", so tabs are
 * matched by the start of their name.
 *
 * Its disk-encryption banner is the only way to ask a Linux host for its key: *Create key* queues the escrow,
 * and fleetd acts on it at its next check-in (`DeviceUserBanners.tsx`). The banner is yellow and role-less, so
 * it is matched by its text.
 */
export class MyDevicePage {
  readonly page: Page;
  readonly heading: Locator;
  /** *Create key* refused by the server says so in a toast, and its modal closes. */
  readonly toast: Toast;
  /** "Disk encryption: Create a new disk encryption key…", shown while a Linux host's key isn't escrowed. */
  readonly createKeyBanner: Locator;
  readonly createKeyButton: Locator;
  /**
   * Raised by *Create key*. Its body is the instructions for the passphrase prompt, or, while fleetd reports
   * the prompt open, "Fleet is already asking this device for a disk encryption key" (`CreateLinuxKeyModal.tsx`).
   */
  readonly createKeyModal: Locator;
  /** The ordinary body's instructions for the passphrase prompt, as opposed to the in-flight one. */
  readonly createKeyInstructions: Locator;

  /** The Details tab's vitals, as on Host details (`Vitals.tsx`). */
  readonly vitals: DataSet;
  /** Disabled while a refetch is in flight, and on an offline host (`HostHeader.tsx`). */
  readonly refetchButton: Locator;
  /** "Refetching... This can take up to 1 minute.", in place of "Last fetched …" while a refetch is in flight. */
  readonly refetching: Locator;
  readonly lastFetched: Locator;

  /** The Software tab: the host's inventory, the same table as Host details' (`HostSoftwareTable`). */
  readonly softwareSearch: Locator;
  readonly softwareRows: Locator;
  /** The Software tab's filters: the same "Add filters" modal as Host details' Inventory. */
  readonly filter: FilterModal;

  /** The Policies tab's table: Name and Status ("Pass", "Fail", "Action required" or "---"). */
  readonly policyRows: Locator;

  /**
   * The Self service tab's table: Name, Install status, Installed version, Available version and the row's
   * actions (`SelfServiceTableConfig.tsx`). Matched by its Install status column, since the tab can also
   * hold an Updates card. The Name cell is plain text, not a link.
   */
  readonly selfServiceTable: Locator;
  readonly selfServiceRows: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'My device', level: 1 });
    this.toast = new Toast(page);
    this.createKeyBanner = page.getByText(/^Disk encryption: Create a new disk encryption key/);
    this.createKeyButton = page.getByRole('button', { name: 'Create key' });
    this.createKeyModal = fleetModal(page, 'Create key');
    this.createKeyInstructions = this.createKeyModal.getByText('If a pop-up appears asking for your passphrase');

    this.vitals = new DataSet(page);
    this.refetchButton = page.getByRole('button', { name: 'Refetch' });
    this.refetching = page.getByText(/^Refetching\.\.\./);
    this.lastFetched = page.getByText(/^Last fetched/);

    this.softwareSearch = page.getByPlaceholder('Search by name or vulnerability (CVE)');
    // The inventory table's own class, as on Host details: HostSoftwareTable renders as a role-less wrapper.
    this.softwareRows = page.locator('.host-software-table').locator('tbody').getByRole('row');
    this.filter = new FilterModal(page);

    this.policyRows = page.getByRole('tabpanel').getByRole('table').locator('tbody').getByRole('row');

    this.selfServiceTable = page
      .getByRole('tabpanel')
      .getByRole('table')
      .filter({ has: page.getByRole('columnheader', { name: /^Install status/ }) });
    this.selfServiceRows = this.selfServiceTable.locator('tbody').getByRole('row');
  }

  /** A tab by its label; a count after the label ("Policies 1") still matches. */
  tab(label: MyDeviceTab): Locator {
    return this.page.getByRole('tab', { name: new RegExp(`^${label}`) });
  }

  /** Waits for the page: the heading, and the Details tab the admin's link lands on. */
  async expectLoaded(): Promise<void> {
    await expect(this.heading).toBeVisible();
    await expect(this.tab('Details')).toHaveAttribute('aria-selected', 'true');
    await expect(this.vitals.value('Operating system')).toBeVisible();
  }

  /**
   * Loads the page afresh on its Details tab. Each tab is a path under the device's URL (`/device/:token/software`,
   * …) and a reload stays on it, so this loads the device's own URL instead.
   */
  async gotoDetails(): Promise<void> {
    await this.page.goto(this.page.url().replace(/\/(self-service|controls|software|policies)([?#].*)?$/, ''));
    await this.expectLoaded();
  }

  async openTab(label: MyDeviceTab): Promise<void> {
    await this.tab(label).click();
    await expect(this.tab(label)).toHaveAttribute('aria-selected', 'true');
  }

  /**
   * Software tab, unsearched, as it opens (a macOS host on the "App (macOS)" type, like Host details' Inventory):
   * the "N items" above the table, as a number. Fleet localises it past a thousand ("1,401 items").
   */
  async softwareItemCount(): Promise<number> {
    await this.openTab('Software');
    // The same table component as Host details' Inventory, and the count is its own class there too.
    const count = this.page.locator('.host-software-table .table-container__results-count');
    await expect(count).toHaveText(/^[\d,]+ items?$/);
    return Number((await count.innerText()).replace(/[^\d]/g, ''));
  }

  /** Software tab, searched for one title: its inventory row, matched on the title's exact text. */
  async findInSoftware(name: string): Promise<Locator> {
    await this.openTab('Software');
    await expect(this.softwareSearch).toBeVisible();
    await this.softwareSearch.fill(name);
    return this.softwareRows.filter({ has: this.page.getByText(name, { exact: true }) });
  }

  /**
   * Software tab, searched for a CVE (the search box takes a name or a CVE): the row of the title named `name`
   * among what the search finds. One CVE can be matched to several titles (a kernel and its modules), so the row
   * is picked by the title's exact text.
   */
  async findInSoftwareByCve(cve: string, name: string): Promise<Locator> {
    await this.openTab('Software');
    await this.showFullInventory();
    await this.softwareSearch.fill(cve);
    return this.softwareRows.filter({ has: this.page.getByText(name, { exact: true }) });
  }

  /**
   * Software tab: lists every software type. A macOS host opens it on the "App (macOS)" type, as Host details'
   * Inventory does (`HostSoftware.tsx` writes `types=macos_app` into the URL), which hides packages and
   * extensions; other platforms open on every type, so this is a no-op there. The URL is read once the search
   * field shows: Fleet renders a spinner, not the table, until the default type is in the URL.
   */
  async showFullInventory(): Promise<void> {
    await expect(this.softwareSearch).toBeVisible();
    const types = new URL(this.page.url()).searchParams.get('types');
    if (types === null || types === 'none') return;
    await this.filter.open();
    await this.filter.selectTypes([]);
    await this.filter.applyButton.click();
    await expect(this.filter.modal).toBeHidden();
    await expect(this.page).not.toHaveURL(/[?&]types=(?!none)/);
    await waitForTableSettled(this.page);
  }

  /** A policy's row on the Policies tab, by its exact name. */
  policyRow(name: string): Locator {
    return this.policyRows.filter({ has: this.page.getByText(name, { exact: true }) });
  }

  /**
   * Opens a policy's details from its row on the Policies tab: a modal titled with the policy's name. The name
   * is an anchor with no href, so it has no link role, and its text is there twice: the truncated name, then
   * a hidden copy in its tooltip. The first is the one to click.
   */
  async openPolicy(name: string): Promise<Locator> {
    const nameText = this.policyRow(name).getByText(name, { exact: true }).first();
    await expect(nameText).toBeVisible();
    await nameText.click();
    const details = fleetModal(this.page, name);
    await expect(details).toBeVisible();
    return details;
  }

  /** A title's row on the Self service tab, by its exact name. */
  selfServiceRow(name: string): Locator {
    return this.selfServiceRows.filter({ has: this.page.getByText(name, { exact: true }) });
  }

  /**
   * A Self service row's Install status cell: "---" before an install and after an uninstall, "Installing..."
   * and "Uninstalling..." while one is pending, then "Installed" or "Failed" (`InstallStatusCell.tsx`). Its
   * column is read from the headers, since the cells carry nothing naming their column.
   */
  async selfServiceStatus(name: string): Promise<Locator> {
    const headers = this.selfServiceTable.getByRole('columnheader');
    await expect(headers.first()).toBeVisible();
    const index = (await headers.allInnerTexts()).map((t) => t.trim()).indexOf('Install status');
    if (index < 0) throw new Error('[MyDevicePage] the Self service table has no "Install status" column');
    return this.selfServiceRow(name).getByRole('cell').nth(index);
  }

  /** Clicks a Self service row's Install. Fleet sends the request at once: there is no confirmation. */
  async selfServiceInstall(name: string): Promise<void> {
    const install = this.selfServiceRow(name).getByRole('button', { name: 'Install', exact: true });
    await expect(install, `${name}'s Self service row doesn't offer Install`).toBeVisible();
    await install.click();
  }

  /**
   * Uninstalls a title from its Self service row and confirms the modal. A macOS app or Windows program,
   * which also offers "How to open", has Uninstall inside the row's "More" menu; anything else shows an
   * Uninstall button (`HostInstallerActionCell.tsx`). The modal is titled with the title's name.
   */
  async selfServiceUninstall(name: string): Promise<void> {
    const row = this.selfServiceRow(name);
    const button = row.getByRole('button', { name: 'Uninstall', exact: true });
    const more = row.getByText('More', { exact: true });
    await expect(button.or(more), `${name}'s Self service row offers no Uninstall`).toBeVisible();
    if (await button.isVisible()) await button.click();
    else await new ActionsMenu(row).choose('Uninstall');
    const modal = fleetModal(this.page, `Uninstall ${name}`);
    await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: 'Uninstall', exact: true }).click();
    await expect(modal).toBeHidden();
  }

  /**
   * Clicks *Create key* and waits for its modal to finish loading. The modal opens at once, in a loading state,
   * and closes again if the server refuses the click, with a toast that says so: that ends this with the toast's
   * text, where a later click on the closed modal would wait out the test. A spec that expects the refusal
   * clicks `createKeyButton` itself.
   */
  async createKey(): Promise<void> {
    await this.createKeyButton.click();
    const close = this.createKeyModal.getByRole('button', { name: 'Close' });
    await expect(close.or(this.toast.error)).toBeVisible();
    if (await this.toast.error.isVisible()) {
      throw new Error(`[MyDevicePage.createKey] the server refused Create key: ${await this.toast.error.innerText()}`);
    }
  }

  async closeCreateKeyModal(): Promise<void> {
    await this.createKeyModal.getByRole('button', { name: 'Close' }).click();
    await expect(this.createKeyModal).toBeHidden();
  }
}
