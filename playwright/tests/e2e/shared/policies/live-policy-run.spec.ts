/**
 * Shared • Policies • A policy run live against the three real VMs.
 *
 * Policies → the policy → Run policy → target the macOS, Windows and Linux VMs by
 * host search → Run → "Policy finished". Then everything the results screen
 * derives from the answers: each host's Pass or Fail, the "(Yes: X%, No: Y%)"
 * summary and its host-count tooltips, the Host column sorting case-insensitively
 * in both directions, and "Export results" writing one yes / no row per host.
 *
 * **Why the real VMs.** A host passes when the policy's query returns rows. The
 * osquery-perf simulations answer every live query with the same canned row,
 * whatever the SQL, so every one of them passes; only a real host can fail. The
 * query here returns a row on macOS only, so the Mac passes and the Windows and
 * Linux VMs fail: Yes 33%, No 67%. `os_version` exists on all three, so none of
 * them lands on the Errors tab instead.
 *
 * **Why host search, not a label or a chip.** The built-in Platforms labels hold
 * whatever osquery-perf answers (the macOS one holds the Ubuntu simulations), and
 * the VMs fleet's chip can include simulations other specs borrow onto it. Picking
 * the three VMs by name targets exactly them, moves nothing and leaves nothing to
 * clean up. The picker must read "3 hosts targeted (100% online)" before Run: with
 * one VM offline the run would finish on two and every number below would be wrong
 * for that reason, not Fleet's.
 *
 * **The sort is evidence because of the names.** The VMs are called `WIN-…`,
 * `macos-…` and `ubuntu-…` on both tiers. A case-sensitive sort puts the
 * upper-case Windows name first; Fleet's case-insensitive one puts it last. The
 * test checks that the two orders differ before relying on it, so a renamed VM
 * fails loudly instead of letting the check pass without proving anything.
 *
 * **The policy is global** (free has no other kind) and deleted in an `afterEach`,
 * which still runs when the test times out. While it exists, any VM that refetches
 * also runs it on schedule and records a failure on Windows and Linux. It carries no
 * automation, so nothing acts on that, and cleanup wipes global policies anyway.
 *
 * A live run ends only once every online targeted host has answered, with no
 * timeout of its own, so the wait for "Policy finished" is bounded here. Live
 * queries go through osquery's distributed path, not the orbit queue the install
 * and script specs wait on, so this costs the VMs seconds.
 *
 * Tier-agnostic: free and premium render the same picker, results and summary.
 * Round 1 C3 #37 and C3 #28.
 */
import { test, expect } from '@fixtures';
import { createPolicy, deletePolicies, requireRealHost } from '@helpers/api';
import { readCsvDownload } from '@helpers/csv';
import { runNonce } from '@helpers/profiles';

/** Returns a row on macOS only: the Mac passes, the Windows and Linux VMs fail. */
const MACOS_ONLY_QUERY = "SELECT 1 FROM os_version WHERE platform = 'darwin';";

/** Fleet's `caseInsensitive` sort type: lower-case both, then compare code units. */
const caseInsensitiveAsc = (a: string, b: string): number => {
  const [x, y] = [a.toLowerCase(), b.toLowerCase()];
  return x < y ? -1 : x > y ? 1 : 0;
};
const caseSensitiveAsc = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test.describe('Policies • run live on the real VMs', () => {
  let policyId = 0;

  test.afterEach(async ({ request }) => {
    if (policyId) await deletePolicies(request, [policyId]);
    policyId = 0;
  });

  test('marks each VM Pass or Fail, sums them as Yes / No, sorts the hosts case-insensitively and exports them', async ({
    dashboard,
    policiesList,
    policyDetails,
    policyLive,
    request,
    page,
  }) => {
    // Three hosts answer on their distributed interval; the bound covers a VM
    // that checks in late, and the cleanup still has time to run after it.
    test.setTimeout(240_000);

    const [mac, windows, linux] = await Promise.all([
      requireRealHost(request, 'darwin'),
      requireRealHost(request, 'windows'),
      requireRealHost(request, 'linux'),
    ]);
    const vms = [mac, windows, linux];
    const names = vms.map((h) => h.displayName);
    const expectedStatus = new Map([
      [mac.displayName, 'Pass'],
      [windows.displayName, 'Fail'],
      [linux.displayName, 'Fail'],
    ]);

    const ascending = [...names].sort(caseInsensitiveAsc);
    expect(
      [...names].sort(caseSensitiveAsc),
      `the VM names ${JSON.stringify(names)} sort the same with and without case, so the Host sort proves nothing`,
    ).not.toEqual(ascending);

    const name = `pw-live-policy-${runNonce()}`;
    policyId = (await createPolicy(request, { name, query: MACOS_ONLY_QUERY })).id;

    await test.step('open the policy and target the three VMs', async () => {
      await dashboard.goto();
      await dashboard.navbar.goToPolicies();
      await policiesList.teamDropdown.select('All fleets');
      await policiesList.narrowTo(name);
      await policiesList.openPolicy(name);
      await expect(policyDetails.nameHeading).toHaveText(name);

      await policyDetails.runButton.click();
      await expect(page).toHaveURL(new RegExp(`/policies/${policyId}/live`));
      await policyLive.waitForReady();
      for (const vm of vms) await policyLive.targetHost(vm.displayName);
      await expect(policyLive.targetRows).toHaveCount(3);
      await expect(policyLive.targetsTotalCount).toHaveText(/^3\s*hosts targeted\s*\(100%\s*online\)/);
    });

    await test.step('run it until every VM has answered', async () => {
      await policyLive.run();
      await expect(policyLive.finishedHeading).toBeVisible({ timeout: 150_000 });
      await expect(policyLive.runSummary).toContainText('3 hosts targeted');
      await expect(policyLive.runSummary).toContainText('100% responded');
      await expect(policyLive.resultsCount).toHaveText('3 results');
      await expect(policyLive.resultsRows).toHaveCount(3);
    });

    await test.step('each VM is Pass or Fail by what its query returned', async () => {
      const hosts = await policyLive.resultsColumnValues('Host');
      const statuses = await policyLive.resultsColumnValues('Status');
      expect(new Map(hosts.map((h, i) => [h, statuses[i]]))).toEqual(expectedStatus);
    });

    await test.step('the summary splits the answers into Yes and No, with host counts', async () => {
      await expect(policyLive.passFailSummary).toHaveText(/\(Yes:\s*33%,\s*No:\s*67%\)/);

      await policyLive.yesShare.hover();
      await expect(policyLive.shareTooltip('1 host')).toBeVisible();
      // Park the pointer so the No share's tooltip is the only one showing.
      await page.mouse.move(0, 0);
      await expect(policyLive.shareTooltip('1 host')).toHaveCount(0);

      await policyLive.noShare.hover();
      await expect(policyLive.shareTooltip('2 hosts')).toBeVisible();
      await page.mouse.move(0, 0);
    });

    await test.step('the Host column sorts case-insensitively, both ways', async () => {
      await policyLive.resultsSortControl('Host').click();
      await expect.poll(() => policyLive.resultsColumnValues('Host')).toEqual(ascending);
      await policyLive.resultsSortControl('Host').click();
      await expect.poll(() => policyLive.resultsColumnValues('Host')).toEqual([...ascending].reverse());
    });

    await test.step('Export results writes one yes / no row per host', async () => {
      const download = await policyLive.exportResults();
      expect(download.suggestedFilename()).toMatch(
        new RegExp(`^${escapeRegExp(name)} - Results \\(\\d{2}-\\d{2}-\\d{2} \\d{2}-\\d{2}-\\d{2}\\)\\.csv$`),
      );
      const { header, records } = await readCsvDownload(download);
      expect(header).toEqual(['host', 'status']);
      expect(new Map(records.map((r) => [r.host, r.status]))).toEqual(
        new Map(names.map((n) => [n, expectedStatus.get(n) === 'Pass' ? 'yes' : 'no'])),
      );
    });
  });
});
