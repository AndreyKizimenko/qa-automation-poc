import fs from 'fs';
import path from 'path';
import { Browser, BrowserContextOptions, Page, expect } from '@playwright/test';

import {
  staticUser,
  staticUserPassword,
  type StaticUserKey,
} from './api/static-users';

/** A captured `context.storageState()` — cookies plus per-origin localStorage. */
type StoredSession = Exclude<BrowserContextOptions['storageState'], string | undefined>;

export async function loginAsAdmin(page: Page, email: string, password: string): Promise<void> {
  // Fleet throttles POST /login to 10/min (burst 9) in a single bucket shared by
  // every user and worker, and a throttled attempt just leaves the browser on
  // /login with no visible error. Retrying gives the bucket time to refill
  // instead of failing the test on a neighbour's login spend.
  await expect(async () => {
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
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
  }).toPass({ timeout: 90_000, intervals: [5_000, 10_000, 15_000] });
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
 * Where a static user's reusable session is parked on disk, alongside the
 * setup projects' admin states. Shared across workers *and* runs, so a role
 * costs one login for the whole suite rather than one per test.
 *
 * This matters because Fleet rate-limits `POST /login` to 10/min with a burst
 * of 9, in **one bucket shared by every user and every parallel worker**
 * (`server/service/handler.go`). Logging in per test spends from a suite-wide
 * budget, and enough role specs running together push the rest into HTTP 429 —
 * which surfaces as a login that silently leaves the browser on `/login`.
 */
const sessionPath = (key: StaticUserKey): string =>
  path.join('.auth', `static-${process.env.SUITE ?? 'unknown'}-${key}.json`);

function readSession(key: StaticUserKey): StoredSession | undefined {
  try {
    return JSON.parse(fs.readFileSync(sessionPath(key), 'utf8')) as StoredSession;
  } catch {
    return undefined;
  }
}

function writeSession(key: StaticUserKey, state: StoredSession): void {
  try {
    fs.mkdirSync('.auth', { recursive: true });
    fs.writeFileSync(sessionPath(key), JSON.stringify(state));
  } catch {
    // A cache miss only costs an extra login; never fail a test over it.
  }
}

/**
 * Log into a context as the given static human user and run `fn` against the
 * authenticated page. Throws on API-only catalog entries — those auth via
 * bearer token and cannot use the login form.
 *
 * The first call for a user logs in and caches the resulting session; later
 * calls in the same worker restore it instead of logging in again. A cached
 * session that has expired or been invalidated falls back to a fresh login, so
 * callers can't be handed a signed-out page.
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

  const cached = readSession(key);
  if (cached) {
    const context = await browser.newContext({ storageState: cached });
    const page = await context.newPage();
    try {
      // A session that has expired or been invalidated bounces to /login; fall
      // through to a fresh login rather than handing `fn` a signed-out page.
      await page.goto('/dashboard');
      if (!/\/login/.test(page.url())) return await fn(page);
    } finally {
      await context.close();
    }
  }

  return withCleanContext(browser, async (page) => {
    await loginAsAdmin(page, spec.email, staticUserPassword());
    writeSession(key, await page.context().storageState());
    return fn(page);
  });
}
