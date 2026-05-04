import { Page } from '@playwright/test';

/**
 * Console-error substrings to ignore by default. The network monitor
 * catches HTTP failures by URL — these patterns match the duplicate
 * console noise that accompanies them so we don't double-flag.
 */
export const DEFAULT_IGNORED_CONSOLE_ERRORS = [
  'favicon',
  'net::ERR',
  'ResizeObserver',
  // Browser-native "Failed to load resource" lines for 4xx/5xx — the
  // associated network failure is caught by monitorNetworkFailures, so
  // the console duplicate is noise.
  'Failed to load resource: the server responded with a status of',
  // Axios error-object dumps for 4xx/5xx — same reasoning as above.
  'data: Object, status:',
];

/**
 * Network-failure URL substrings to ignore by default. Includes Fleet's
 * empty-state probes: Fleet uses 404 as the "no resource yet" signal on
 * Bootstrap, Run script, Setup Assistant, and the Setup Experience
 * progress indicator. Functional tests visit these pages on every run,
 * so we suppress them globally rather than ask each spec to opt in.
 */
export const DEFAULT_IGNORED_NETWORK_PATTERNS = [
  'favicon',
  '/NaN', // known client-side routing quirk — bad IDs get NaN in URLs
  '/mdm/bootstrap/',
  '/setup_experience/script',
  '/mdm/apple/enrollment_profile',
];

/**
 * Start monitoring console errors on a page. Returns a getter that
 * returns only errors not matching any ignore pattern. The auto
 * `pageHealth` fixture in `fixtures.ts` wires this in for every test
 * by default; specs rarely need to call this directly.
 */
export function monitorConsoleErrors(
  page: Page,
  { ignore = DEFAULT_IGNORED_CONSOLE_ERRORS }: { ignore?: string[] } = {},
): { getErrors: () => string[] } {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return {
    getErrors: () => errors.filter((e) => !ignore.some((p) => e.includes(p))),
  };
}

/**
 * Start monitoring network failures (4xx/5xx) on a page. Returns a getter
 * that returns only failures not matching any ignore pattern.
 */
export function monitorNetworkFailures(
  page: Page,
  { ignore = DEFAULT_IGNORED_NETWORK_PATTERNS }: { ignore?: string[] } = {},
): { getFailures: () => string[] } {
  const failures: string[] = [];
  page.on('response', (response) => {
    const url = response.url();
    if (
      response.status() >= 400 &&
      !ignore.some((p) => url.includes(p))
    ) {
      failures.push(`${response.status()} ${url}`);
    }
  });
  return { getFailures: () => failures };
}
