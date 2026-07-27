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
