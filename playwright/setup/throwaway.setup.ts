import { test as setup } from '@playwright/test';
import * as path from 'path';
import { loginAsAdmin } from '../helpers/auth';

// The throwaway instance's admin is the one the workflow made for this run (first-run setup in the
// browser on a brand-new server, or through the API on the release an upgrade starts from).
setup('authenticate as admin', async ({ page }) => {
  await loginAsAdmin(page, process.env.FLEET_ADMIN_EMAIL!, process.env.FLEET_ADMIN_PASSWORD!);
  await page.context().storageState({ path: path.resolve(__dirname, '../.auth/throwaway-admin.json') });
});
