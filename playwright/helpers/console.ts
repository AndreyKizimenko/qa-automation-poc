import { Page } from '@playwright/test';

// Console-error substrings to ignore: browser-native noise that doesn't
// reflect a real bug. JS errors that break the UI surface separately and
// are caught by the assertions inside specs.
export const DEFAULT_IGNORED_CONSOLE_ERRORS = [
  'favicon',
  'net::ERR',
  'ResizeObserver',
  'Failed to load resource: the server responded with a status of',
  'data: Object, status:',
  // TODO(fleetdm/fleet#52434): remove once the scripts editor registers Fleet's
  // ace theme again. Since 4.92 `components/Editor` mounts without the theme
  // module in scope, so ace tries to fetch it over the network and Fleet 404s
  // it. Cosmetic (the editor falls back to ace's default theme) and the scripts
  // flows themselves pass, so this stays an ignored error rather than a skip —
  // see docs/blocked-by-product-bugs.md.
  'theme-fleet.js',
];

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

// Uncaught exceptions inside the page — a React render blowing up, an
// unhandled rejection reaching the top level. Chromium does not report these
// as console messages, so `monitorConsoleErrors` never sees them and a broken
// render passes unless a spec assertion happens to trip over the consequence.
export function monitorPageErrors(page: Page): { getErrors: () => string[] } {
  const errors: string[] = [];
  page.on('pageerror', (error) => {
    errors.push(error.message);
  });
  return { getErrors: () => errors };
}

// Server errors only — 4xx is normal app behaviour (auth probes, "no
// resource yet" 404s, premium-gated 402s) and assertions catch the
// meaningful ones. 5xx is always a real backend bug worth surfacing.
export function monitorNetworkFailures(page: Page): { getFailures: () => string[] } {
  const failures: string[] = [];
  page.on('response', (response) => {
    if (response.status() >= 500) {
      failures.push(`${response.status()} ${response.url()}`);
    }
  });
  return { getFailures: () => failures };
}
