/**
 * Shared • Hosts • the Certificates card on `/hosts/:id/details`.
 *
 * The card lists the certificates a host reports out of its system and login
 * keychains, across five columns — Name, Issuer, Scope, Issued, Expires — plus
 * a per-row "View details" that opens the full certificate.
 *
 * ## Why the real VM, and why not premium-only
 *
 * Fleet mounts the card only for an Apple or Windows host that reports at least
 * one certificate (`HostDetailsPage.tsx`, `showCertificatesCard`). An
 * osquery-perf simulation reports none, so against one the card never renders
 * and every assertion here would be vacuous — `liveMacosHost` resolves the real
 * macOS VM instead.
 *
 * The card is **not** premium-gated: the condition above is platform and data
 * only. Both tiers' macOS VMs carry the same four system-keychain certificates
 * (two Apple defaults plus Fleet's own CA and identity), so this runs shared
 * rather than duplicated per tier.
 *
 * Rows are asserted against what Fleet's API reports for this host rather than
 * against fixed names: the VMs are re-provisioned and re-enrolled, which rotates
 * the Fleet identity certificate and changes its dates. `getHostCertificates`
 * asks for the card's own page size and default sort, so the comparison stays
 * row-for-row if a VM ever reports more certificates than one page holds.
 *
 * No `toHaveScreenshot` of the table: it fails on font rendering and never says
 * what changed.
 */
import { test, expect } from '@fixtures';
import { getHostCertificates } from '@helpers/api';

const COLUMNS = ['Name', 'Issuer', 'Scope', 'Issued', 'Expires'] as const;

test('Host details — the certificates card lists every reported certificate', async ({
  hostDetails,
  liveMacosHost,
  request,
}) => {
  const { certificates, total } = await getHostCertificates(request, liveMacosHost.id);
  expect(
    total,
    `${liveMacosHost.displayName} reports no certificates — the card only mounts when it reports at least one`,
  ).toBeGreaterThan(0);

  await hostDetails.goto(liveMacosHost.id);
  await hostDetails.certificates.waitForReady();

  for (const column of COLUMNS) {
    await expect(hostDetails.certificates.columnHeader(column)).toBeVisible();
  }

  // The count is the host's total; the table shows one page of it.
  await expect(hostDetails.certificates.count).toHaveText(
    `${total} certificate${total === 1 ? '' : 's'}`,
  );
  await expect(hostDetails.certificates.rows).toHaveCount(certificates.length);

  // Every certificate Fleet reports has a row, and that row carries the issuer
  // and scope Fleet reports for it. `source` is rendered capitalised, and a
  // user-scope certificate renders the bare word "User" with the username in a
  // tooltip (`CertificatesTableConfig.tsx`).
  for (const certificate of certificates) {
    const row = hostDetails.certificates.row(certificate.commonName);
    await expect(row).toBeVisible();

    // Both assertions read their own column. A row-wide `toContainText` would
    // pass because the word appeared anywhere in the row — and for the issuer it
    // would pass unconditionally when Fleet reports no issuer common name, since
    // the helper defaults that to '' and every string contains ''.
    // `toContainText`, not `toHaveText`: Fleet renders these through
    // `TooltipTruncatedTextCell`, which emits the value twice — once visible,
    // once for the tooltip — so the cell's text content is the value doubled.
    // The column scoping is what matters; it is the cell's own value either way.
    if (certificate.issuerCommonName) {
      await expect(
        await hostDetails.certificates.cell(certificate.commonName, 'Issuer'),
      ).toContainText(certificate.issuerCommonName);
    }
    await expect(
      await hostDetails.certificates.cell(certificate.commonName, 'Scope'),
    ).toContainText(certificate.source === 'system' ? 'System' : 'User');
  }
});

test('Host details — a certificate row opens its full details', async ({
  hostDetails,
  liveMacosHost,
  request,
}) => {
  const { certificates } = await getHostCertificates(request, liveMacosHost.id);
  expect(certificates.length, 'expected the VM to report a certificate').toBeGreaterThan(0);
  const certificate = certificates[0];

  await hostDetails.goto(liveMacosHost.id);
  await hostDetails.certificates.waitForReady();

  await hostDetails.certificates.openDetails(certificate.commonName);

  // The modal splits the certificate into sections; Subject name, Issuer name
  // and Validity period render for any certificate the card can list, while the
  // remaining sections depend on fields the host may not report.
  await expect(hostDetails.certificates.detailsSection('Subject name')).toBeVisible();
  await expect(hostDetails.certificates.detailsSection('Issuer name')).toBeVisible();
  await expect(hostDetails.certificates.detailsSection('Validity period')).toBeVisible();

  // The opened certificate is the row's, not an arbitrary one. Both sections
  // carry a "Common name", so each is read from inside its own section.
  await expect(
    hostDetails.certificates.detailsValue('Subject name', 'Common name'),
  ).toHaveText(certificate.commonName);
  await expect(
    hostDetails.certificates.detailsValue('Issuer name', 'Common name'),
  ).toHaveText(certificate.issuerCommonName);

  await hostDetails.certificates.closeDetails();
});
