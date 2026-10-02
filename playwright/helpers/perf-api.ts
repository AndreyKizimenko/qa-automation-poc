/**
 * API timing engine for the `loadtest-api` project.
 *
 * A *shape* is one request the suite times: a path under `/api/latest/fleet`,
 * its query params, and the metadata that decides how it is sampled and
 * judged. `tests/loadtest/api/shapes.ts` holds the matrix; this module turns it
 * into concrete URLs, samples each one several times with one request in
 * flight, and classifies the outcome:
 *
 * - `ok`          every sample 2xx and the median is within the budget
 * - `slow`        every sample 2xx but the median is over the budget — flagged,
 *                 never a failure, and still sampled until its time cap
 * - `error`       some samples failed (non-2xx or timed out) and some succeeded
 * - `broken`      no sample ever succeeded — the request never completes
 * - `unavailable` an `optional` shape answered 4xx on every sample (the feature
 *                 is off on this instance, e.g. Apple MDM summaries with MDM off)
 * - `skipped`     a placeholder it needs could not be resolved (no policies in
 *                 the fleet, no batch run, …) — reported, never a fast empty number
 *
 * Only `error` and `broken` fail the family's test. Fleet's generic
 * "The request could not be processed." 422 is a MySQL error in disguise
 * (`server/platform/endpointer/transport_error.go` → `safeReason`), so the
 * response `uuid` is captured — it is what an engineer needs to find the real
 * error in the server logs.
 *
 * Node's own `fetch` is used rather than Playwright's request fixture so the
 * time to first byte and the full download are measured separately and the
 * engine also works outside the test runner.
 */
import type { TestInfo } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { apiLatestUrl, authHeaders } from './api/core';

export type Priority = 'P0' | 'P1' | 'P2';
/** Which `fleet_id` variants a shape emits: fleet-scoped, no `fleet_id`, or one of each. */
export type ShapeScope = 'fleet' | 'global' | 'both';
export type RunScope = 'fleet' | 'global';
export type Severity = 'ok' | 'slow' | 'error' | 'broken' | 'unavailable' | 'skipped';
export type ParamValue = string | number | boolean;
export type Params = Record<string, ParamValue | undefined>;

export interface Shape {
  family: string;
  /** Stable key for history comparison, e.g. `hosts.sort.display_name.asc`. */
  id: string;
  label: string;
  /** Path under `/api/latest/fleet`; `{NAME}` placeholders resolve from `Resolved`. */
  path: string;
  params?: Params;
  /** Default `both` for list endpoints; `fleet` when the path carries the fleet, `global` when `fleet_id` means nothing. */
  scope?: ShapeScope;
  priority: Priority;
  /** The fleetdm/fleet issue this shape reproduces or guards. */
  issue?: string;
  /** Placeholder names that must resolve; unresolved → `skipped` with the resolver's reason. */
  needs?: string[];
  /** Also time `hosts/count` with the same filters — the UI pairs every list load with it. */
  countTwin?: boolean;
  /** 4xx on every sample is `unavailable`, not `broken` (feature off on this instance). */
  optional?: boolean;
  /** Override the per-priority sample count. */
  samples?: number;
}

export interface Sample {
  status: number;
  ms: number;
  ttfbMs: number;
  bytes: number;
  /** `count` from the body when the endpoint returns one. */
  count?: number;
  /** Fleet's error reference from a non-2xx JSON body. */
  uuid?: string;
  error?: string;
}

export interface ShapeResult {
  family: string;
  id: string;
  /** `id`, suffixed `@fleet` / `@global` when the shape expanded to both scopes. */
  key: string;
  label: string;
  scope: RunScope;
  url: string;
  priority: Priority;
  issue?: string;
  optional: boolean;
  wanted: number;
  samples: Sample[];
  ok: number;
  failed: number;
  /** Sampling stopped early because the shape used up its time cap. */
  capped: boolean;
  firstMs?: number;
  medianMs?: number;
  p95Ms?: number;
  maxMs?: number;
  minMs?: number;
  severity: Severity;
  skipReason?: string;
}

export interface PerfApiConfig {
  samplesByPriority: Record<Priority, number>;
  /** Hard cap on one request; a hit is recorded as status 0 / timeout. */
  timeoutMs: number;
  /** Median above this is `slow`. */
  budgetMs: number;
  /** Stop sampling a shape once its samples have consumed this much wall time (after at least two). */
  shapeBudgetMs: number;
  priorities: Priority[];
  scope: ShapeScope;
  /** Substring filter on shape ids, for a focused run. */
  shapeFilter?: string;
}

export type Resolved = Record<string, string | number | undefined>;

export interface RunMeta {
  startedAt: string;
  finishedAt?: string;
  fleetUrl: string;
  fleetVersion: string;
  fleetId: number;
  config: PerfApiConfig;
  counts: Record<string, number | null>;
  resolved: Resolved;
  missing: Record<string, string>;
  families: string[];
  totals?: Record<Severity, number>;
}

const DEFAULT_SAMPLES: Record<Priority, number> = { P0: 10, P1: 5, P2: 2 };
/** Per-family results written as each family finishes; merged by `finishApiRun`. */
export const API_RESULTS_DIR = path.resolve(__dirname, '../.perf-results-api');
const HISTORY_DIR = path.resolve(__dirname, '../.perf-history-api');
const MAX_HISTORY_RUNS = 20;
const COMPARE_RUNS = 3;

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${name} must be a non-negative number, got ${JSON.stringify(raw)}`);
  return n;
}

export function configFromEnv(): PerfApiConfig {
  const all = process.env.API_SAMPLES ? envInt('API_SAMPLES', 0) : undefined;
  const priorities = (process.env.API_PRIORITY ?? 'P0,P1,P2')
    .split(',')
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean) as Priority[];
  for (const p of priorities) {
    if (!['P0', 'P1', 'P2'].includes(p)) throw new Error(`API_PRIORITY must list P0/P1/P2, got ${JSON.stringify(p)}`);
  }
  const scope = (process.env.API_SCOPE ?? 'both') as ShapeScope;
  if (!['fleet', 'global', 'both'].includes(scope)) throw new Error(`API_SCOPE must be fleet|global|both, got ${JSON.stringify(scope)}`);
  return {
    samplesByPriority: {
      P0: all ?? envInt('API_SAMPLES_P0', DEFAULT_SAMPLES.P0),
      P1: all ?? envInt('API_SAMPLES_P1', DEFAULT_SAMPLES.P1),
      P2: all ?? envInt('API_SAMPLES_P2', DEFAULT_SAMPLES.P2),
    },
    timeoutMs: envInt('API_REQUEST_TIMEOUT_MS', 90_000),
    budgetMs: envInt('API_BUDGET_MS', 5_000),
    shapeBudgetMs: envInt('API_SHAPE_BUDGET_MS', 180_000),
    priorities,
    scope,
    shapeFilter: process.env.API_SHAPE || undefined,
  };
}

// ── URL building ─────────────────────────────────────────────────────────────

const PLACEHOLDER = /\{([A-Z][A-Z0-9_]*)\}/g;

function substitute(text: string, resolved: Resolved): { out: string; missing: string[] } {
  const missing: string[] = [];
  const out = text.replace(PLACEHOLDER, (_m, name: string) => {
    const v = resolved[name];
    if (v === undefined || v === '') {
      missing.push(name);
      return '';
    }
    return encodeURIComponent(String(v));
  });
  return { out, missing };
}

export function buildUrl(pathTemplate: string, params: Params, resolved: Resolved): { url: string; missing: string[] } {
  const missing: string[] = [];
  const p = substitute(pathTemplate, resolved);
  missing.push(...p.missing);
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    const s = substitute(String(v), resolved);
    missing.push(...s.missing);
    qs.set(k, decodeURIComponent(s.out));
  }
  const query = qs.toString();
  return { url: apiLatestUrl(p.out) + (query ? `?${query}` : ''), missing };
}

/**
 * Turns the matrix into one `ShapeResult` per concrete request: scope
 * variants, `hosts/count` twins, placeholder substitution, and the config's
 * priority / scope / id filters. Shapes that cannot run are kept with a
 * `skipReason` so the report shows what was not measured and why.
 */
export function expandShapes(
  shapes: Shape[],
  resolved: Resolved,
  missing: Record<string, string>,
  cfg: PerfApiConfig,
): ShapeResult[] {
  const out: ShapeResult[] = [];
  const seen = new Set<string>();

  const push = (shape: Shape, scope: RunScope, suffix: boolean, idOverride?: string, pathOverride?: string, paramsOverride?: Params) => {
    const id = idOverride ?? shape.id;
    const key = suffix ? `${id}@${scope}` : id;
    if (seen.has(key)) throw new Error(`duplicate shape key ${key} — ids must be unique within the matrix`);
    seen.add(key);

    const params: Params = { ...(paramsOverride ?? shape.params ?? {}) };
    if (scope === 'fleet' && !('fleet_id' in params) && !(pathOverride ?? shape.path).includes('{FLEET}')) {
      params.fleet_id = '{FLEET}';
    }
    const built = buildUrl(pathOverride ?? shape.path, params, resolved);
    const needs = new Set([...(shape.needs ?? []), ...built.missing]);
    const unresolved = [...needs].filter((n) => resolved[n] === undefined || resolved[n] === '');
    let skipReason: string | undefined;
    if (!cfg.priorities.includes(shape.priority)) skipReason = `priority ${shape.priority} not selected`;
    else if (cfg.shapeFilter && !id.includes(cfg.shapeFilter)) skipReason = `id does not match API_SHAPE=${cfg.shapeFilter}`;
    else if (unresolved.length) skipReason = unresolved.map((n) => `${n}: ${missing[n] ?? 'unresolved'}`).join('; ');

    out.push({
      family: shape.family,
      id,
      key,
      label: shape.label,
      scope,
      url: built.url,
      priority: shape.priority,
      issue: shape.issue,
      optional: !!shape.optional,
      wanted: shape.samples ?? cfg.samplesByPriority[shape.priority],
      samples: [],
      ok: 0,
      failed: 0,
      capped: false,
      severity: skipReason ? 'skipped' : 'ok',
      skipReason,
    });
  };

  for (const shape of shapes) {
    const shapeScope = shape.scope ?? 'both';
    const scopes: RunScope[] =
      shapeScope === 'both'
        ? cfg.scope === 'both' ? ['fleet', 'global'] : [cfg.scope]
        : [shapeScope];
    const suffix = shapeScope === 'both';
    for (const scope of scopes) {
      push(shape, scope, suffix);
      if (shape.countTwin) {
        // The count has no rows to page or order; a sort key that joins
        // (`issues`) would only add a join the UI never asks the count for.
        const twinParams: Params = { ...(shape.params ?? {}) };
        delete twinParams.page;
        delete twinParams.per_page;
        delete twinParams.order_key;
        delete twinParams.order_direction;
        push(shape, scope, suffix, `${shape.id}.count`, 'hosts/count', twinParams);
      }
    }
  }
  return out;
}

// ── Sampling ─────────────────────────────────────────────────────────────────

function extractFromBody(status: number, buf: Buffer, contentType: string): { count?: number; uuid?: string; error?: string } {
  if (!contentType.includes('json') || buf.length === 0 || buf.length > 64 * 1024 * 1024) return {};
  try {
    const body = JSON.parse(buf.toString('utf8')) as Record<string, unknown>;
    if (status >= 200 && status < 300) {
      return typeof body.count === 'number' ? { count: body.count } : {};
    }
    const errors = Array.isArray(body.errors) ? (body.errors as Array<{ reason?: string }>) : [];
    return {
      uuid: typeof body.uuid === 'string' ? body.uuid : undefined,
      error: [body.message, errors[0]?.reason].filter(Boolean).join(': ') || undefined,
    };
  } catch {
    return {};
  }
}

/** One timed request. Never throws — a timeout or network error becomes status 0. */
export async function sampleOnce(url: string, timeoutMs: number): Promise<Sample> {
  const base = process.env.FLEET_URL!;
  const start = performance.now();
  try {
    const res = await fetch(`${base}${url}`, {
      headers: { ...authHeaders(), 'Accept-Encoding': 'gzip, deflate, br' },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'manual',
    });
    const ttfbMs = performance.now() - start;
    const buf = Buffer.from(await res.arrayBuffer());
    const ms = performance.now() - start;
    const extracted = extractFromBody(res.status, buf, res.headers.get('content-type') ?? '');
    const sample: Sample = { status: res.status, ms, ttfbMs, bytes: buf.length, ...extracted };
    if (res.status >= 500 && !sample.error) {
      // ALB / nginx gateway pages are HTML; keep the first line for the report.
      sample.error = buf.toString('utf8', 0, 120).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || `HTTP ${res.status}`;
    }
    return sample;
  } catch (e) {
    const ms = performance.now() - start;
    const err = e as Error & { name?: string; cause?: { code?: string } };
    const reason = err.name === 'TimeoutError' ? `timeout after ${timeoutMs} ms` : (err.cause?.code ?? err.message);
    return { status: 0, ms, ttfbMs: ms, bytes: 0, error: reason };
  }
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function consumed(r: ShapeResult): number {
  return r.samples.reduce((t, s) => t + s.ms, 0);
}

function wantsMore(r: ShapeResult, cfg: PerfApiConfig): boolean {
  if (r.skipReason || r.capped) return false;
  if (r.samples.length >= r.wanted) return false;
  if (r.samples.length >= 2 && consumed(r) >= cfg.shapeBudgetMs) {
    r.capped = true;
    return false;
  }
  return true;
}

/**
 * Samples every runnable shape in the list, one request at a time. Each pass
 * visits the shapes in a fresh random order so a slow neighbour's cache
 * warming is spread across the family instead of landing on one row, and a
 * shape stops early once it has used its time cap — a 50 s endpoint gets
 * three samples, not ten.
 */
export async function sampleFamily(
  results: ShapeResult[],
  cfg: PerfApiConfig,
  log: (line: string) => void = () => {},
): Promise<void> {
  const runnable = results.filter((r) => !r.skipReason);
  const maxWanted = Math.max(0, ...runnable.map((r) => r.wanted));
  for (let pass = 0; pass < maxWanted; pass++) {
    for (const r of shuffle(runnable)) {
      if (!wantsMore(r, cfg)) continue;
      const s = await sampleOnce(r.url, cfg.timeoutMs);
      r.samples.push(s);
      if (s.status >= 200 && s.status < 300) r.ok++;
      else r.failed++;
      if (!wantsMore(r, cfg)) {
        finalize(r, cfg);
        log(formatLine(r));
      }
    }
  }
  for (const r of runnable) finalize(r, cfg);
}

// ── Statistics and severity ──────────────────────────────────────────────────

function median(sorted: number[]): number {
  const n = sorted.length;
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[idx];
}

export function finalize(r: ShapeResult, cfg: PerfApiConfig): void {
  if (r.skipReason) {
    r.severity = 'skipped';
    return;
  }
  const okMs = r.samples.filter((s) => s.status >= 200 && s.status < 300).map((s) => s.ms).sort((a, b) => a - b);
  r.ok = okMs.length;
  r.failed = r.samples.length - okMs.length;
  r.firstMs = r.samples[0]?.ms;
  if (okMs.length) {
    r.medianMs = median(okMs);
    r.p95Ms = percentile(okMs, 0.95);
    r.maxMs = okMs[okMs.length - 1];
    r.minMs = okMs[0];
  } else {
    r.medianMs = r.p95Ms = r.maxMs = r.minMs = undefined;
  }
  if (r.samples.length === 0) {
    r.severity = 'skipped';
    r.skipReason = 'not sampled';
  } else if (r.ok === 0) {
    const all4xx = r.samples.every((s) => s.status >= 400 && s.status < 500);
    r.severity = r.optional && all4xx ? 'unavailable' : 'broken';
  } else if (r.failed > 0) {
    r.severity = 'error';
  } else if ((r.medianMs ?? 0) > cfg.budgetMs) {
    r.severity = 'slow';
  } else {
    r.severity = 'ok';
  }
}

export function fmtMs(ms?: number): string {
  if (ms === undefined || Number.isNaN(ms)) return '—';
  return ms >= 10_000 ? `${(ms / 1000).toFixed(1)}s` : `${(ms / 1000).toFixed(2)}s`;
}

function firstError(r: ShapeResult): string {
  const s = r.samples.find((x) => !(x.status >= 200 && x.status < 300));
  if (!s) return '';
  return `${s.status || 'timeout'}${s.uuid ? ` uuid=${s.uuid}` : ''}${s.error ? ` ${s.error}` : ''}`;
}

export function formatLine(r: ShapeResult): string {
  const base = `${r.key.padEnd(56)} ${r.priority} n=${String(r.samples.length).padStart(2)} ok=${String(r.ok).padStart(2)} med=${fmtMs(r.medianMs).padStart(7)} p95=${fmtMs(r.p95Ms).padStart(7)} max=${fmtMs(r.maxMs).padStart(7)} ${r.severity}${r.capped ? ' (capped)' : ''}`;
  const err = firstError(r);
  return err ? `${base}  ${err}` : base;
}

/** Push the non-ok shapes into the test's annotations so the HTML report lists them. */
export function annotate(testInfo: TestInfo, results: ShapeResult[]): void {
  for (const r of results) {
    if (r.severity === 'ok') continue;
    const detail =
      r.severity === 'skipped'
        ? r.skipReason
        : `median ${fmtMs(r.medianMs)} p95 ${fmtMs(r.p95Ms)} max ${fmtMs(r.maxMs)} (${r.ok}/${r.samples.length} ok)${firstError(r) ? ` ${firstError(r)}` : ''}`;
    testInfo.annotations.push({ type: `perf-api:${r.severity}`, description: `${r.key} — ${detail}` });
  }
}

// ── Persistence and reporting ────────────────────────────────────────────────

interface StoredRun {
  meta: RunMeta;
  results: ShapeResult[];
}

function runTimestamp(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export function totals(results: ShapeResult[]): Record<Severity, number> {
  const t: Record<Severity, number> = { ok: 0, slow: 0, error: 0, broken: 0, unavailable: 0, skipped: 0 };
  for (const r of results) t[r.severity]++;
  return t;
}

function loadPreviousRuns(exclude: string): Array<{ name: string; medians: Map<string, number | undefined> }> {
  if (!fs.existsSync(HISTORY_DIR)) return [];
  const dirs = fs
    .readdirSync(HISTORY_DIR)
    .filter((d) => d !== exclude && fs.existsSync(path.join(HISTORY_DIR, d, 'results.json')))
    .sort()
    .slice(-COMPARE_RUNS);
  return dirs.map((name) => {
    const stored = JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, name, 'results.json'), 'utf8')) as StoredRun;
    const medians = new Map<string, number | undefined>();
    for (const r of stored.results) if (r.severity !== 'skipped') medians.set(r.key, r.medianMs);
    return { name, medians };
  });
}

function pruneHistory(): void {
  if (!fs.existsSync(HISTORY_DIR)) return;
  const dirs = fs
    .readdirSync(HISTORY_DIR)
    .filter((d) => fs.statSync(path.join(HISTORY_DIR, d)).isDirectory())
    .sort();
  for (const d of dirs.slice(0, Math.max(0, dirs.length - MAX_HISTORY_RUNS))) {
    fs.rmSync(path.join(HISTORY_DIR, d), { recursive: true });
  }
}

const SEVERITY_ORDER: Severity[] = ['broken', 'error', 'slow', 'ok', 'unavailable', 'skipped'];

function sortForReport(results: ShapeResult[]): ShapeResult[] {
  return [...results].sort((a, b) => {
    if (a.family !== b.family) return a.family.localeCompare(b.family);
    const sa = SEVERITY_ORDER.indexOf(a.severity);
    const sb = SEVERITY_ORDER.indexOf(b.severity);
    if (sa !== sb) return sa - sb;
    return (b.medianMs ?? -1) - (a.medianMs ?? -1);
  });
}

const ICON: Record<Severity, string> = { ok: '✅', slow: '⚠️', error: '❌', broken: '⛔', unavailable: '➖', skipped: '⏭️' };

export function toMarkdown(meta: RunMeta, results: ShapeResult[], previous = loadPreviousRuns('')): string {
  const t = meta.totals ?? totals(results);
  const lines: string[] = [];
  lines.push(`# API timing — ${meta.fleetVersion} — ${meta.startedAt}`);
  lines.push('');
  lines.push(`- Instance: ${meta.fleetUrl} (fleet ${meta.fleetId})`);
  lines.push(`- Window: ${meta.startedAt} → ${meta.finishedAt ?? '…'}`);
  lines.push(`- Samples: P0 ${meta.config.samplesByPriority.P0} / P1 ${meta.config.samplesByPriority.P1} / P2 ${meta.config.samplesByPriority.P2}; budget ${fmtMs(meta.config.budgetMs)}; request cap ${fmtMs(meta.config.timeoutMs)}; per-shape cap ${fmtMs(meta.config.shapeBudgetMs)}; scope ${meta.config.scope}; priorities ${meta.config.priorities.join(',')}`);
  lines.push(`- Families: ${meta.families.join(', ')}`);
  lines.push(`- Totals: ${ICON.ok} ok ${t.ok} · ${ICON.slow} slow ${t.slow} · ${ICON.error} error ${t.error} · ${ICON.broken} broken ${t.broken} · ${ICON.unavailable} unavailable ${t.unavailable} · ${ICON.skipped} skipped ${t.skipped}`);
  lines.push('');
  lines.push('## Dataset');
  lines.push('');
  lines.push('| Entity | Count |');
  lines.push('|---|---:|');
  for (const [k, v] of Object.entries(meta.counts)) lines.push(`| ${k} | ${v ?? 'n/a'} |`);
  if (Object.keys(meta.missing).length) {
    lines.push('');
    lines.push('Unresolved placeholders (their shapes are skipped):');
    lines.push('');
    for (const [k, v] of Object.entries(meta.missing)) lines.push(`- \`${k}\`: ${v}`);
  }
  lines.push('');
  lines.push('## Results');
  lines.push('');
  const prevHeaders = previous.map((p) => ` ${p.name} |`).join('');
  lines.push(`| | Shape | Pri | n | ok | first | median | p95 | max | Issue |${prevHeaders}`);
  lines.push(`|---|---|---|---:|---:|---:|---:|---:|---:|---|${previous.map(() => '---:|').join('')}`);
  let family = '';
  for (const r of sortForReport(results)) {
    if (r.family !== family) {
      family = r.family;
      lines.push(`| | **${family}** | | | | | | | | |${previous.map(() => ' |').join('')}`);
    }
    const prev = previous.map((p) => ` ${fmtMs(p.medians.get(r.key))} |`).join('');
    const note =
      r.severity === 'skipped'
        ? `_${r.skipReason}_`
        : [r.issue ?? '', firstError(r)].filter(Boolean).join(' · ');
    lines.push(
      `| ${ICON[r.severity]} | \`${r.key}\`${r.capped ? ' (capped)' : ''} | ${r.priority} | ${r.samples.length} | ${r.ok} | ${fmtMs(r.firstMs)} | ${fmtMs(r.medianMs)} | ${fmtMs(r.p95Ms)} | ${fmtMs(r.maxMs)} | ${note} |${prev}`,
    );
  }
  lines.push('');
  lines.push('## Resolved ids');
  lines.push('');
  lines.push('```');
  for (const [k, v] of Object.entries(meta.resolved)) lines.push(`${k} = ${String(v)}`);
  lines.push('```');
  lines.push('');
  return lines.join('\n');
}

/** Writes `results.json` + `summary.md` under `.perf-history-api/<timestamp>/` and returns the directory. */
export function writeRun(meta: RunMeta, results: ShapeResult[]): string {
  meta.finishedAt = new Date().toISOString();
  meta.totals = totals(results);
  const dir = path.join(HISTORY_DIR, runTimestamp());
  fs.mkdirSync(dir, { recursive: true });
  const stored: StoredRun = { meta, results };
  fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(stored, null, 2));
  fs.writeFileSync(path.join(dir, 'summary.md'), toMarkdown(meta, results, loadPreviousRuns(path.basename(dir))));
  pruneHistory();
  return dir;
}

const supportsColor = process.stdout.isTTY && !process.env.NO_COLOR;
function c(code: string, text: string): string {
  return supportsColor ? `\x1b[${code}m${text}\x1b[0m` : text;
}
function colorSeverity(s: Severity): string {
  switch (s) {
    case 'ok': return s;
    case 'slow': return c('33', s);
    case 'error': return c('31', s);
    case 'broken': return c('1;31', s);
    default: return c('90', s);
  }
}

/** Console table: one row per shape, grouped by family, worst first, with the last runs' medians beside it. */
export function printSummary(meta: RunMeta, results: ShapeResult[], runDir: string): void {
  const previous = loadPreviousRuns(path.basename(runDir));
  const t = meta.totals ?? totals(results);
  const keyW = Math.min(60, Math.max(...results.map((r) => r.key.length), 5) + 2);
  const line = '─'.repeat(keyW + 72 + previous.length * 9);
  console.log(`\n${line}`);
  console.log(` API timing — ${meta.fleetVersion} — ok ${t.ok} · slow ${t.slow} · error ${t.error} · broken ${t.broken} · unavailable ${t.unavailable} · skipped ${t.skipped}`);
  console.log(` results: ${runDir}`);
  console.log(line);
  let header = ` ${'Shape'.padEnd(keyW)}${'Pri'.padEnd(4)}${'n'.padStart(3)}${'ok'.padStart(4)}${'median'.padStart(9)}${'p95'.padStart(9)}${'max'.padStart(9)}  ${'severity'.padEnd(12)}`;
  for (const p of previous) header += p.name.slice(0, 8).padStart(9);
  console.log(header);
  console.log(line);
  let family = '';
  for (const r of sortForReport(results)) {
    if (r.family !== family) {
      family = r.family;
      console.log(` ${c('1', family)}`);
    }
    if (r.severity === 'skipped') {
      console.log(`   ${c('90', `${r.key.padEnd(keyW - 2)} skipped — ${r.skipReason ?? ''}`)}`);
      continue;
    }
    let row = `   ${r.key.padEnd(keyW - 2)}${r.priority.padEnd(4)}${String(r.samples.length).padStart(3)}${String(r.ok).padStart(4)}${fmtMs(r.medianMs).padStart(9)}${fmtMs(r.p95Ms).padStart(9)}${fmtMs(r.maxMs).padStart(9)}  `;
    const sev = colorSeverity(r.severity) + (r.capped ? '*' : '');
    row += sev + ' '.repeat(Math.max(0, 12 - r.severity.length - (r.capped ? 1 : 0)));
    for (const p of previous) {
      const prev = p.medians.get(r.key);
      const cur = r.medianMs;
      let txt = fmtMs(prev).padStart(9);
      if (prev !== undefined && cur !== undefined) {
        const delta = cur - prev;
        if (Math.abs(delta) < 200) txt = c('90', txt);
        else if (delta < 0) txt = c('32', txt);
        else txt = c('33', txt);
      } else {
        txt = c('90', txt);
      }
      row += txt;
    }
    const err = firstError(r);
    console.log(err ? `${row}  ${c('31', err)}` : row);
  }
  console.log(line);
  console.log(c('90', ` * = sampling capped at ${fmtMs(meta.config.shapeBudgetMs)} total | prev columns: green = now faster, yellow = now slower | ${previous.length} previous run(s)`));
  console.log('');
}

/** GET a JSON body from `/api/latest/fleet/<path>`; throws on non-2xx so a resolver failure is visible. */
export async function fetchJson<T = Record<string, unknown>>(apiPath: string, timeoutMs = 60_000): Promise<T> {
  const res = await fetch(`${process.env.FLEET_URL}${apiLatestUrl(apiPath)}`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const text = (await res.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
    throw new Error(`GET ${apiPath} → HTTP ${res.status} ${text}`);
  }
  return (await res.json()) as T;
}

/**
 * Global-teardown half of the API run: merges the per-family files the spec
 * wrote into one run under `.perf-history-api/`, prints the summary table,
 * and clears the scratch dir. Returns early when no API family ran.
 */
export function finishApiRun(): void {
  if (!fs.existsSync(API_RESULTS_DIR)) return;
  const files = fs.readdirSync(API_RESULTS_DIR).filter((f) => f.endsWith('.json') && !f.startsWith('_')).sort();
  if (files.length === 0) {
    fs.rmSync(API_RESULTS_DIR, { recursive: true });
    return;
  }
  let meta: RunMeta | undefined;
  const results: ShapeResult[] = [];
  for (const f of files) {
    const stored = JSON.parse(fs.readFileSync(path.join(API_RESULTS_DIR, f), 'utf8')) as StoredRun;
    if (!meta) meta = { ...stored.meta, families: [] };
    meta.families.push(...stored.meta.families);
    results.push(...stored.results);
  }
  fs.rmSync(API_RESULTS_DIR, { recursive: true });
  if (!meta) return;
  const dir = writeRun(meta, results);
  printSummary(meta, results, dir);
}
