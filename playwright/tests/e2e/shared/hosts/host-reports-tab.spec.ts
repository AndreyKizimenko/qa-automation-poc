/**
 * Shared • Hosts • Host Reports tab.
 *
 * The Reports tab lists every saved report that applies to the host, with a
 * count, a "don't store results" toggle, a name search, and a sort dropdown.
 * Seeds two uniquely-named reports via the API and deletes them.
 *
 * Reports appear as soon as they apply to the host — they don't need a stored
 * result first; one without results renders as "Fleet is awaiting results". Note
 * that a report card's "Show details" action (the drill into this host's report
 * results) only exists once the report *has* a stored result for the host
 * (`HostReportCard.tsx` gates it on `last_fetched`), which needs a scheduled run,
 * so that drill isn't covered here.
 *
 * Every assertion is made against this test's own two reports, reached by
 * searching for its marker: other specs seed global reports, and those apply to
 * this host too, so the unfiltered list and count are shared mutable state.
 * C2 #5/#15/#23.
 */
import { test, expect } from '@fixtures';
import { createReport, deleteReportsMatching } from '@helpers/api';

const rand = () => Math.random().toString(36).slice(2, 8);

test('Host details — reports tab lists the host reports, searches, and sorts', async ({
  hostDetails,
  liveMacosHost,
  request,
  page,
}) => {
  const marker = `pw-hostrpt-${Date.now()}-${rand()}`;
  const alpha = `${marker}-alpha`;
  const omega = `${marker}-omega`;
  // Created omega-first so the default "Newest results" order differs from the
  // name order the sort assertions expect.
  await createReport(request, { name: omega });
  await createReport(request, { name: alpha });

  try {
    await hostDetails.goto(liveMacosHost.id);
    await hostDetails.openReportsTab();

    await expect(hostDetails.reportsCount).toHaveText(/\d+ reports?/);
    await expect(hostDetails.dontStoreResultsToggle).toHaveAttribute('aria-checked', 'false');

    await hostDetails.searchReports(marker);
    await expect(hostDetails.reportCards).toHaveCount(2);
    await expect(hostDetails.reportCard(alpha)).toBeVisible();
    await expect(hostDetails.reportCard(omega)).toBeVisible();

    // A report with no stored result for this host says so on its card.
    await expect(hostDetails.reportCard(alpha)).toContainText(
      `Fleet is awaiting results from ${liveMacosHost.displayName}`,
    );

    await hostDetails.sortReports('Name A-Z');
    await expect(page).toHaveURL(/sort=name_asc/);
    await expect.poll(() => hostDetails.reportCardNames()).toEqual([alpha, omega]);

    await hostDetails.sortReports('Name Z-A');
    await expect(page).toHaveURL(/sort=name_desc/);
    await expect.poll(() => hostDetails.reportCardNames()).toEqual([omega, alpha]);
  } finally {
    await deleteReportsMatching(request, marker);
  }
});

/**
 * The Reports tab's recency sorts — "Newest results" (the default) and "Oldest
 * results" — order cards by `last_fetched`, and Fleet keeps the cards still
 * awaiting a result **last under both**, not at whichever end a null sorts to.
 * That partition is the invariant asserted here; the relative order of the
 * awaiting cards among themselves is not a contract.
 *
 * Asserted on the unfiltered list rather than on this test's own report,
 * because that one is awaiting results — a report only gains one after a
 * scheduled run the host actually performed, which no test can seed inside its
 * own lifetime. The tab is read in one pass (see `reportCardResultStates`):
 * sibling specs seed global reports that apply to this host too, so the card
 * set can change between two reads.
 *
 * On premium the instance carries `pw-host-report-results` on the VMs fleet
 * (see `premium/hosts/host-report-details.spec.ts`), which gives the partition
 * something on both sides. Free has no long-lived report — `cleanup-setup`
 * wipes every global one — so there the invariant holds trivially and what this
 * still proves is that each sort reaches the server and keeps the host's
 * reports listed.
 *
 * "Newest results" is Fleet's default, and `HostReportsTab.onSortChange` writes
 * the default as `undefined` — so selecting it *removes* the `sort` param
 * rather than setting one.
 */
test('Host details — the results-recency sorts keep reports awaiting results last', async ({
  hostDetails,
  liveMacosHost,
  request,
  page,
}) => {
  const marker = `pw-hostsort-${Date.now()}-${rand()}`;
  const seeded = `${marker}-alpha`;
  await createReport(request, { name: seeded });

  /**
   * Every card carrying a stored result precedes every card without one.
   * Expressed as "the sequence equals itself sorted" so the assertion holds —
   * and stays readable — whichever side is empty.
   */
  const expectAwaitingLast = async (label: string): Promise<void> => {
    const states = await hostDetails.reportCardResultStates();
    expect(states.length, 'expected the host to list at least one report').toBeGreaterThan(0);
    const hasResults = states.map((s) => s.hasResults);
    expect(
      hasResults,
      `cards awaiting results must sort last under "${label}": ${states
        .map((s) => `${s.name}=${s.hasResults}`)
        .join(', ')}`,
    ).toEqual([...hasResults].sort((a, b) => Number(b) - Number(a)));
  };

  try {
    await hostDetails.goto(liveMacosHost.id);
    await hostDetails.openReportsTab();

    await expect(hostDetails.reportsSortValue).toHaveText('Newest results');
    await expect(hostDetails.reportCard(seeded)).toBeVisible();
    await expectAwaitingLast('Newest results');

    await hostDetails.sortReports('Oldest results');
    await expect(page).toHaveURL(/sort=oldest_results/);
    await expect(hostDetails.reportsSortValue).toHaveText('Oldest results');
    // The seeded report survives the re-sort, so it narrowed nothing.
    await expect(hostDetails.reportCard(seeded)).toBeVisible();
    await expectAwaitingLast('Oldest results');

    await hostDetails.sortReports('Newest results');
    await expect(page).not.toHaveURL(/sort=/);
    await expect(hostDetails.reportsSortValue).toHaveText('Newest results');
    await expect(hostDetails.reportCard(seeded)).toBeVisible();
    await expectAwaitingLast('Newest results');
  } finally {
    await deleteReportsMatching(request, marker);
  }
});
