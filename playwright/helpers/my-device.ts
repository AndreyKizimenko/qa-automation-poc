/**
 * What a host's My device page shows has to match what an admin sees of the same host on Host details. The
 * end user sees less (no custom host vitals, no MDM server URL or status, no patch deadline, no agent
 * options), but every value the page does show is the admin's value.
 *
 * Both pages render the same cards (`HostSummary`, `Vitals`, `User`) from their own fetch of the host, so the
 * comparison is by title: each title on My device's Details tab must be on Host details with the same value.
 * A title only the end user sees is a mismatch too. Two values are relative times ("4 days ago"), whose
 * wording can turn over between two reads seconds apart, and are left out. A refetch that lands between the
 * two page loads can move a value (disk space), so a mismatch is read again after both pages reload.
 */
import { expect } from '@playwright/test';
import type { HostDetailsPage, MyDevicePage } from '@pages';

/** Relative times, compared nowhere: their wording turns over on its own. */
const RELATIVE_TIMES = new Set(['Added to Fleet', 'Last restarted']);

/**
 * Every value on My device's Details tab equals Host details' value under the same title. Host details must
 * be on its Details tab and My device on its own, as `openMyDevice` and `expectLoaded` leave them.
 */
export async function expectDetailsMatchHostDetails(hostDetails: HostDetailsPage, device: MyDevicePage): Promise<void> {
  let attempt = 0;
  await expect(async () => {
    if (attempt++ > 0) {
      await hostDetails.page.reload();
      await expect(hostDetails.vitals.value('Operating system')).toBeVisible();
      await device.gotoDetails();
    }
    const admin = new Map<string, string[]>();
    for (const [title, value] of await hostDetails.vitals.entries()) admin.set(title, [...(admin.get(title) ?? []), value]);
    const shown = (await device.vitals.entries()).filter(([title]) => !RELATIVE_TIMES.has(title));
    expect(shown.length, 'My device shows no values').toBeGreaterThan(0);
    const mismatches = shown
      .filter(([title, value]) => !(admin.get(title) ?? []).includes(value))
      .map(([title, value]) => `${title}: My device "${value}", Host details ${JSON.stringify(admin.get(title) ?? 'nothing')}`);
    expect(mismatches, 'values My device shows differently from Host details').toEqual([]);
  }).toPass({ timeout: 45_000, intervals: [2_000] });
}

/**
 * My device's Software tab counts as many titles as Host details' Inventory, both unsearched and on the type
 * each opens on. An install or refetch landing between the two reads moves both, so they are read again in
 * pairs until a pair agrees.
 */
export async function expectSoftwareCountMatchesHostDetails(hostDetails: HostDetailsPage, device: MyDevicePage): Promise<void> {
  await expect(async () => {
    await hostDetails.page.reload();
    await hostDetails.openInventoryUnsearched();
    const admin = await hostDetails.softwareItemCount();
    await device.gotoDetails();
    expect(await device.softwareItemCount(), "My device's Software count against Host details' Inventory").toBe(admin);
  }).toPass({ timeout: 90_000, intervals: [5_000] });
}
