/**
 * Shared • Settings • Integrations • MDM — the Apple MDM details.
 *
 * Settings → Integrations → MDM shows a card per MDM platform; Apple's "Edit"
 * opens the Apple Push Certificate details: common name, organization name,
 * MDM server URL and renew date. Both tiers have Apple MDM on, and the card
 * and page aren't license-gated (`MdmSettings.tsx`: only the EULA and end user
 * migration cards are premium), so this is shared. Each value is checked
 * against what it's built from — the certificate Fleet holds (`GET /mdm/apple`)
 * and the org and server settings (`GET /config`) — not just for presence.
 *
 * Read-only. "Turn off MDM" and "Renew certificate" are asserted present and
 * never clicked: one turns Apple MDM off for the whole instance, the other
 * starts a certificate renewal.
 *
 * The organization name is compared with the config read beside it, and both
 * are re-read until they agree: `organization-info.spec.ts` renames the
 * organization for a few seconds on both tiers, and may do it between this
 * spec's read and the page's.
 *
 * The renew date is formatted the way the page formats it (`readableDate`: the
 * browser's locale, long month), in the page itself, so the browser's time zone
 * decides the day on both sides. The server URL is the configured one with
 * `/mdm/apple/mdm` appended; the page concatenates, so a configured URL that
 * ends in `/` shows as `…//mdm/apple/mdm` (free's does), and the match allows it.
 */
import { test, expect } from '@fixtures';
import { getAppConfig, getAppleApnsInfo } from '@helpers/api';

test.describe('Shared • Settings • Apple MDM', () => {
  test('the Apple MDM card opens the push certificate details Fleet holds', async ({
    integrationsPage,
    request,
    page,
  }) => {
    const apns = await getAppleApnsInfo(request);
    const config = await getAppConfig(request);
    const serverUrl = (config.server_settings as { server_url?: string } | undefined)?.server_url ?? '';
    expect(serverUrl, 'the config names no server URL').toBeTruthy();

    await integrationsPage.goto();
    await integrationsPage.openMdm();
    await expect(integrationsPage.appleMdmCard).toBeVisible();
    await integrationsPage.openAppleMdm();

    await expect(integrationsPage.apnsValue('Common name (CN)')).toHaveText(apns.commonName);
    let reread = false;
    await expect(async () => {
      if (reread) {
        await page.reload();
        await expect(integrationsPage.apnsHeading).toBeVisible();
      }
      reread = true;
      const orgName = (await getAppConfig(request)).org_info?.org_name ?? '';
      expect(orgName, 'the organization has no name').toBeTruthy();
      await expect(integrationsPage.apnsValue('Organization name')).toHaveText(orgName, { timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    const base = serverUrl.replace(/\/+$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await expect(integrationsPage.apnsValue('MDM server URL')).toHaveText(new RegExp(`^${base}/+mdm/apple/mdm$`));
    const renewDate = await page.evaluate(
      (iso) =>
        new Intl.DateTimeFormat(navigator.language, { year: 'numeric', month: 'long', day: 'numeric' }).format(
          new Date(iso),
        ),
      apns.renewDate,
    );
    await expect(integrationsPage.apnsValue('Renew date')).toHaveText(renewDate);

    await expect(integrationsPage.turnOffMdmButton).toBeVisible();
    await expect(integrationsPage.renewCertificateButton).toBeVisible();
  });
});
