import { Browser, Page, expect } from '@playwright/test';

import {
  staticUser,
  staticUserPassword,
  type StaticUserKey,
} from './api/static-users';

export async function loginAsAdmin(page: Page, email: string, password: string): Promise<void> {
  // Wait for Fleet's /sso settings probe to resolve before touching inputs —
  // the LoginForm re-renders (detaching its inputs) when the request comes
  // back, racing both .fill() and .click() calls.
  const ssoSettled = page.waitForResponse(
    (res) => res.url().includes('/api/v1/fleet/sso') && res.request().method() === 'GET',
    { timeout: 10_000 },
  ).catch(() => undefined);
  await page.goto('/login');
  await ssoSettled;

  await page.getByPlaceholder('Email').fill(email);
  const passwordInput = page.getByPlaceholder('Password');
  await passwordInput.fill(password);
  // Submitting via Enter keeps the call self-contained (no need to find a
  // separate button locator that could also be racing the same re-render).
  await passwordInput.press('Enter');
  await expect(page).not.toHaveURL(/\/login/);
}

/**
 * Open a fresh, unauthenticated browser context, run `fn` against its page,
 * and dispose of the context afterward. Wraps the explicit empty-storage
 * dance every fresh-context test needs:
 *
 *   - `storageState: { cookies: [], origins: [] }` blocks Playwright's
 *     project-level `use.storageState` from pre-authenticating the new
 *     context as the admin.
 *   - The `finally` close keeps each test from leaking browser handles
 *     across parallel workers.
 */
export async function withCleanContext<T>(
  browser: Browser,
  fn: (page: Page) => Promise<T>,
): Promise<T> {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  try {
    return await fn(page);
  } finally {
    await context.close();
  }
}

/**
 * Log into a fresh context as the given static human user and run `fn`
 * against the authenticated page. Throws on API-only catalog entries —
 * those auth via bearer token and cannot use the login form.
 */
export async function withStaticUser<T>(
  browser: Browser,
  key: StaticUserKey,
  fn: (page: Page) => Promise<T>,
): Promise<T> {
  const spec = staticUser(key);
  if (spec.apiOnly) {
    throw new Error(`[withStaticUser] "${key}" is an API-only user — log in via bearer token instead`);
  }
  return withCleanContext(browser, async (page) => {
    await loginAsAdmin(page, spec.email, staticUserPassword());
    return fn(page);
  });
}
