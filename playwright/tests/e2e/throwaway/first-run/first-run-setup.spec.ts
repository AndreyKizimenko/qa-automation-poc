/**
 * Throwaway • First-run setup • a brand-new server's setup page, from the empty form to the dashboard.
 *
 * Only a Fleet with no user offers `/setup`, so only the throwaway instance's Helm job can run this: it
 * installs the build under test with Fleet's chart, waits for the pods, and runs this project before
 * anything else touches the server. The admin it creates is the run's admin (`FLEET_ADMIN_EMAIL` /
 * `FLEET_ADMIN_PASSWORD`, made up by the workflow), the one every later step signs in as, and the
 * organization name is the seed's, which the `throwaway` project reads back.
 *
 * The four steps: the user, the organization, the Fleet web address (which the page fills in from the
 * browser's own origin; the test types `FLEET_URL` so the server's URL is the one osquery-perf and
 * fleetctl reach) and the confirmation, whose summary must show what the steps collected. Then the
 * server no longer offers setup: `/setup` sends the signed-in admin away.
 *
 * Grounded in `frontend/pages/RegistrationPage` and `frontend/components/forms/RegistrationForm`, and
 * `server/service/endpoint_setup.go` (the page posts everything in one `POST /api/v1/setup`).
 *
 * No retries (`throwaway-first-run` in playwright.config.ts): a second attempt would meet a server that
 * is set up already, and fail for that instead of for what broke the first.
 */
import { test, expect } from '@fixtures';
import { THROWAWAY_SEED } from '@helpers/throwaway';

test('Throwaway • First-run setup • creates the admin and opens the dashboard', async ({
  registrationPage,
  dashboard,
  page,
}) => {
  const admin = {
    name: 'Throwaway admin',
    email: process.env.FLEET_ADMIN_EMAIL!,
    password: process.env.FLEET_ADMIN_PASSWORD!,
  };
  const serverUrl = process.env.FLEET_URL!.replace(/\/$/, '');

  await test.step('a brand-new server sends the browser to setup', async () => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/setup$/);
    await expect(registrationPage.heading).toHaveText('Set up user');
  });

  await test.step('fill in the user, the organization and the web address', async () => {
    await registrationPage.fillUser(admin);
    await registrationPage.fillOrganization(THROWAWAY_SEED.orgName);
    await registrationPage.fillServerUrl(serverUrl);
  });

  await test.step('the confirmation shows what the steps collected', async () => {
    await expect(registrationPage.summary).toContainText(admin.name);
    await expect(registrationPage.summary).toContainText(admin.email);
    await expect(registrationPage.summary).toContainText(THROWAWAY_SEED.orgName);
    await expect(registrationPage.summary).toContainText(serverUrl);
  });

  await test.step('confirm signs the admin in on the dashboard', async () => {
    await registrationPage.confirm();
    await expect(dashboard.hostsEnrolledHeading).toBeVisible();
  });

  await test.step('setup is no longer offered', async () => {
    await page.goto('/setup');
    await expect(page).not.toHaveURL(/\/setup$/);
  });
});
