/**
 * Runner-side checks of Fleet-maintained app installers: whether each vendor URL
 * still answers, and what Fleet's manifest says about its SHA-256. Nothing here
 * talks to the Fleet instance, so the whole-catalog pass can probe 1,400+
 * vendor URLs without adding a request to the shared 2 GB box.
 *
 * Plain `fetch` rather than Playwright's `request`: an `APIRequestContext`
 * buffers the whole body and doesn't count redirects, and a vendor that ignores
 * `Range` would make it download the full installer. Here the body is cancelled
 * as soon as the headers arrive, and redirects are followed by hand.
 */

/** A desktop browser's user agent: some vendor CDNs refuse a bare client's. */
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const MAX_REDIRECTS = 10;

/** Fleet's own manifest source (fleetdm/fleet `server/mdm/maintainedapps/sync.go:32`, path at `:208`). */
const FMA_MANIFEST_BASE = 'https://maintained-apps.fleetdm.com/manifests';

export type InstallerUrlOutcome = 'ok' | 'upstream' | 'infra' | 'unclassified';

export interface InstallerUrlProbe {
  url: string;
  outcome: InstallerUrlOutcome;
  /** Final HTTP status after redirects; 0 when no response came back. */
  status: number;
  redirects: number;
  /** Full installer size from `Content-Range` (or `Content-Length` on a 200), when the server says. */
  totalBytes: number | null;
  /** Network error text, or why a status was classified as it was. */
  note?: string;
}

function totalFrom(res: Response): number | null {
  const range = res.headers.get('content-range');
  const fromRange = range?.match(/\/(\d+)\s*$/)?.[1];
  if (fromRange) return Number(fromRange);
  const len = res.headers.get('content-length');
  return res.status === 200 && len ? Number(len) : null;
}

async function probeOnce(url: string, timeoutMs: number): Promise<InstallerUrlProbe> {
  let current = url;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    const res = await fetch(current, {
      method: 'GET',
      redirect: 'manual',
      headers: { Range: 'bytes=0-0', 'User-Agent': BROWSER_UA, Accept: '*/*' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    // Headers are all that's needed; a server that ignores Range would otherwise stream the installer.
    await res.body?.cancel().catch(() => undefined);
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      current = new URL(location, current).toString();
      continue;
    }
    const base = { url, status: res.status, redirects, totalBytes: totalFrom(res) };
    if (res.status === 206 || res.status === 200) return { ...base, outcome: 'ok' };
    if (res.status >= 400 && res.status < 500) return { ...base, outcome: 'upstream' };
    // TODO: decide whether a vendor 5xx is upstream or infra once the first runs show how often it recovers.
    return { ...base, outcome: 'unclassified', note: `HTTP ${res.status}` };
  }
  return { url, outcome: 'upstream', status: 0, redirects: MAX_REDIRECTS, totalBytes: null, note: 'too many redirects' };
}

/**
 * GETs the first byte of an installer. One retry on a network error (timeout,
 * reset, DNS); a status answer is final. A network error on both tries is infra.
 */
export async function probeInstallerUrl(url: string, timeoutMs = 20_000): Promise<InstallerUrlProbe> {
  let lastError = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await probeOnce(url, timeoutMs);
    } catch (err) {
      lastError = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    }
  }
  return { url, outcome: 'infra', status: 0, redirects: 0, totalBytes: null, note: lastError };
}

/** Runs `fn` over `items` with at most `limit` in flight, results in input order. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * The SHA-256 Fleet's manifest records for a slug's current version, or null
 * when the manifest can't be read. `no_check` means Fleet stores whatever the
 * vendor serves without verifying it.
 */
export async function fetchManifestSha256(slug: string, timeoutMs = 20_000): Promise<string | null> {
  try {
    const res = await fetch(`${FMA_MANIFEST_BASE}/${slug}.json`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const body = (await res.json()) as { versions?: Array<{ sha256?: string }> };
    return body.versions?.[0]?.sha256 ?? null;
  } catch {
    return null;
  }
}
