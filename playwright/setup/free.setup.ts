import { test as setup } from '@playwright/test';
import * as path from 'path';
import { loginAsAdmin } from '../helpers/auth';

setup('authenticate as admin', async ({ page }) => {
  await loginAsAdmin(page, process.env.FLEET_ADMIN_EMAIL!, process.env.FLEET_ADMIN_PASSWORD!);
  // Step off Fleet's continuously-polling dashboard before capturing state so
  // the Playwright UI-mode runner isn't left holding an instrumented context on
  // a live-polling page (which stalls the setup's teardown). storageState still
  // captures cookies + localStorage for every visited origin, so auth persists.
  await page.goto('about:blank');
  await page.context().storageState({ path: path.resolve(__dirname, '../.auth/free-admin.json') });
});
