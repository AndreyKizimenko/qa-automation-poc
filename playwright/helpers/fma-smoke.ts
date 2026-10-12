/**
 * Shared pieces of the FMA smoke suite (`tests/fma-smoke/`): the per-app result
 * record each test writes, the rules that sort a failure into who owns it, and
 * the Markdown summary `fma-smoke-reporter.ts` writes from those records.
 *
 * A smoke failure is only useful if it says whose problem it is, and an FMA
 * fails for three unrelated reasons:
 *
 *   - **upstream** — the vendor moved or replaced the installer, so the bytes no
 *     longer hash to what Fleet's manifest says, or the URL is gone. Owner: the
 *     FMA validator / manifest refresh, not a Fleet release.
 *   - **infra** — the shared instance or a VM: a 502 from the 2 GB box, a host
 *     that never picked the install up, a VM that is offline, a request timeout.
 *   - **fleet** — everything Fleet itself decides: a 5xx it raises, stored
 *     metadata that disagrees with the catalog, an install script that ran and
 *     failed on a host that took the job.
 *
 * Anything the rules can't place is `unclassified`, which the summary lists
 * first: a guess in the wrong bucket would send it to the wrong owner. The rules
 * classify; no test asserts on Fleet's error text.
 */
import type { TestInfo } from '@playwright/test';
import type { FmaAddOutcome } from './api/fma';

export type FmaOwner = 'fleet' | 'upstream' | 'infra' | 'unclassified';

export type FmaSmokePhase =
  | 'host-online'
  | 'resolve-title'
  | 'catalog'
  | 'add'
  | 'metadata'
  | 'patch-policy'
  | 'install'
  | 'inventory'
  | 'live-query'
  | 'uninstall'
  | 'remove';

/**
 * How much the host smoke's patch-policy check proved. Fleet's patch query
 * passes on a host *without* the app (`SELECT 1 WHERE NOT EXISTS (… older than
 * X)`, fleetdm/fleet `pkg/patch_policy/patch_policy.go:109-151`), so a pass after
 * the install says little unless the same policy failed before it:
 *
 *   - `strong` — the negative control (app absent) failed, the post-install read passed;
 *   - `weak` — both passed: the policy evaluated after the install, nothing more;
 *   - `not-run` — the step never got that far.
 */
export type FmaPatchCheck = 'strong' | 'weak' | 'not-run';

export interface FmaSmokeResult {
  slug: string;
  layer: 'catalog' | 'host';
  /** The version Fleet's manifest published at run time. */
  version?: string;
  passed: boolean;
  /** The phase that failed; absent on a pass. */
  phase?: FmaSmokePhase;
  owner?: FmaOwner;
  /** One line a person can act on: Fleet's error text or the script's last output line. */
  detail?: string;
  /** Host layer only. */
  patchCheck?: FmaPatchCheck;
  /** Wall-clock milliseconds per phase, for budgeting the nightly. */
  timings: Partial<Record<FmaSmokePhase, number>>;
}

export const FMA_SMOKE_ANNOTATION = 'fma-smoke';
export const FMA_SMOKE_URLS_ANNOTATION = 'fma-smoke-urls';

export function recordFmaSmokeResult(testInfo: TestInfo, result: FmaSmokeResult): void {
  testInfo.annotations.push({ type: FMA_SMOKE_ANNOTATION, description: JSON.stringify(result) });
}

/**
 * Who owns a refused add. The texts are Fleet's own error wraps in
 * `ee/server/service/maintained_apps.go` (AddFleetMaintainedApp).
 */
export function classifyAddFailure(outcome: Extract<FmaAddOutcome, { ok: false }>): FmaOwner {
  const msg = outcome.message.toLowerCase();
  if (msg.includes('mismatch in maintained app sha256 hash')) return 'upstream';
  if (msg.includes('downloading app installer')) {
    // A download that timed out is the instance's network; one the vendor
    // refused (4xx) is the vendor's.
    return /timeout|deadline exceeded|connection reset/.test(msg) ? 'infra' : 'upstream';
  }
  if ([502, 503, 504].includes(outcome.status)) return 'infra';
  if (outcome.status === 0 || /timeout/.test(msg)) return 'infra';
  // Already on the fleet (409, `alreadyExists`): a dirty fleet, not a verdict.
  if (outcome.status === 409) return 'unclassified';
  if (outcome.status >= 400) return 'fleet';
  return 'unclassified';
}

/**
 * Who owns a failed install or uninstall, from the script output the host
 * reported. Fleet serves the installer from its own store, so the host never
 * talks to the vendor: a format the script no longer understands (an archive
 * whose layout changed, a .dmg with a second volume) reads as upstream, and
 * everything else the script did is Fleet's script.
 */
export function classifyScriptFailure(output: string): FmaOwner {
  const out = output.toLowerCase();
  if (!out.trim()) return 'unclassified';
  if (/hdiutil: attach failed|no mountable file systems|not a valid zip|cannot find .*\.app|end-of-central-directory/.test(out)) {
    return 'upstream';
  }
  if (/timed out|timeout reached|killed/.test(out)) return 'infra';
  return 'fleet';
}

/** The last non-empty line of a script's output, trimmed for a table cell. */
export function lastLine(output: string, max = 160): string {
  const line = output.trim().split('\n').filter((l) => l.trim()).pop() ?? '';
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

/** Times one phase into `timings`. */
export async function timed<T>(
  timings: FmaSmokeResult['timings'],
  phase: FmaSmokePhase,
  fn: () => Promise<T>,
): Promise<T> {
  const started = Date.now();
  try {
    return await fn();
  } finally {
    timings[phase] = Date.now() - started;
  }
}

// ── Summary ──────────────────────────────────────────────────────────────────

/** One attempt of one app's test, as the reporter saw it. */
export interface FmaSmokeAttempt {
  /** Playwright's retry index: 0 for the first attempt. */
  retry: number;
  result: FmaSmokeResult;
}

/** Counts from the whole-catalog installer-URL pass (`installer-urls.ts`). */
export interface FmaUrlCheckSummary {
  total: number;
  ok: number;
  upstream: number;
  infra: number;
  unclassified: number;
  /** Manifests whose SHA-256 is `no_check`: Fleet can't verify those bytes. Listed, not failed. */
  noCheckSha: number;
  /** p0/p1 entries whose reported size is outside 2× of `approxMb`. Listed, not failed. */
  sizeFindings: number;
}

export const ARM64_NOTE =
  '> Windows results come from an ARM64 VM running x64 installers under emulation.';

const OWNER_ORDER: Record<string, number> = { unclassified: 0, fleet: 1, upstream: 2, infra: 3 };
const OWNERS: FmaOwner[] = ['unclassified', 'fleet', 'upstream', 'infra'];

const cell = (s: string | undefined): string => (s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

/**
 * The run's Markdown summary: one row per app and layer from its last attempt.
 * An app that passed only on a retry is marked flaky, and every failed attempt
 * before the last stays in the Detail column, so a retry never hides a failure.
 */
export function buildFmaSmokeSummary(
  attempts: readonly FmaSmokeAttempt[],
  urls?: FmaUrlCheckSummary,
): string {
  const byApp = new Map<string, FmaSmokeAttempt[]>();
  for (const a of attempts) {
    const key = `${a.result.layer}:${a.result.slug}`;
    byApp.set(key, [...(byApp.get(key) ?? []), a]);
  }
  const rows = [...byApp.values()].map((list) => {
    const sorted = [...list].sort((x, y) => x.retry - y.retry);
    const last = sorted[sorted.length - 1];
    const earlier = sorted.slice(0, -1).filter((a) => !a.result.passed);
    const flaky = last.result.passed && last.retry > 0 ? `passed on retry ${last.retry}` : '';
    const history = earlier
      .map((a) => `attempt ${a.retry + 1}: ${a.result.phase ?? '?'} (${a.result.owner ?? '?'}) ${a.result.detail ?? ''}`.trim())
      .join('; ');
    const detail = [last.result.detail, history].filter(Boolean).join(' — ');
    return { r: last.result, flaky, detail };
  });
  rows.sort(
    (a, b) =>
      Number(a.r.passed) - Number(b.r.passed) ||
      (OWNER_ORDER[a.r.owner ?? ''] ?? 9) - (OWNER_ORDER[b.r.owner ?? ''] ?? 9) ||
      a.r.slug.localeCompare(b.r.slug),
  );

  const failed = rows.filter((x) => !x.r.passed);
  const flakyCount = rows.filter((x) => x.flaky).length;
  const lines = [
    '## FMA smoke',
    '',
    ARM64_NOTE,
    '',
    `${rows.length - failed.length}/${rows.length} passed` +
      (flakyCount ? `, ${flakyCount} flaky` : '') +
      (failed.length
        ? ` — failures by owner: ${OWNERS.map((o) => `${o} ${failed.filter((x) => x.r.owner === o).length}`).join(', ')}`
        : ''),
    '',
    '| Result | Layer | App | Version | Failed phase | Owner | Patch check | Flaky | Detail | Install s |',
    '|---|---|---|---|---|---|---|---|---|---|',
    ...rows.map(
      ({ r, flaky, detail }) =>
        `| ${[
          r.passed ? '✅ pass' : '❌ fail',
          r.layer,
          `\`${r.slug}\``,
          cell(r.version),
          r.phase ?? '',
          r.owner ?? '',
          r.patchCheck ?? '',
          flaky ? `⚠️ ${flaky}` : '',
          cell(detail),
          r.timings.install ? (r.timings.install / 1000).toFixed(0) : '',
        ].join(' | ')} |`,
    ),
    '',
  ];
  if (urls) {
    lines.push(
      '### Installer URLs (whole catalog, checked from the runner)',
      '',
      '| Total | Reachable | Upstream | Infra | Unclassified | SHA-256 `no_check` | Size findings |',
      '|---|---|---|---|---|---|---|',
      `| ${urls.total} | ${urls.ok} | ${urls.upstream} | ${urls.infra} | ${urls.unclassified} | ${urls.noCheckSha} | ${urls.sizeFindings} |`,
      '',
      'Per-entry results are in the `catalog-broken.txt` attachment.',
      '',
    );
  }
  return lines.join('\n');
}
