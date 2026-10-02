/**
 * Loadtest • API timing. One test per request family; each samples every
 * shape in `shapes.ts` with one request in flight and judges it with
 * `helpers/perf-api.ts`:
 *
 * - over the 5 s budget but answering → `slow`, flagged, the family still passes
 * - never answering (non-2xx or past the request cap on every sample) → `broken`
 * - a mix → `error`
 *
 * Only `error` / `broken` fail a family, through soft expectations so every
 * shape is still sampled and reported. Each family's results are written to
 * `.perf-results-api/` as it finishes; the global teardown (`perf-teardown.ts`)
 * merges them into `.perf-history-api/<timestamp>/` and prints the comparison
 * table, so a failed family (which restarts the worker) loses nothing.
 *
 * Runs against the loadtest instance only (`npm run test:loadtest:api`). Knobs,
 * all env vars: API_SAMPLES (or API_SAMPLES_P0/P1/P2), API_PRIORITY=P0[,P1],
 * API_SCOPE=fleet|global|both, API_SHAPE=<id substring>, API_REQUEST_TIMEOUT_MS,
 * API_BUDGET_MS, API_SHAPE_BUDGET_MS. `-g <family>` runs one family.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { getApiToken } from '@helpers/api';
import {
  API_RESULTS_DIR,
  annotate,
  configFromEnv,
  expandShapes,
  fmtMs,
  sampleFamily,
  type RunMeta,
} from '@helpers/perf-api';
import { FAMILIES, SHAPES } from './shapes';
import { resolveIds, type Resolution } from './resolve';

const cfg = configFromEnv();
let meta: RunMeta;
let resolution: Resolution;

function loadtestFleetId(): number {
  const raw = process.env.FLEET_LOADTEST_FLEET_ID;
  const id = Number(raw);
  if (!raw || !Number.isInteger(id) || id <= 0) {
    throw new Error(`FLEET_LOADTEST_FLEET_ID must be a positive integer (got ${JSON.stringify(raw)}). Set it in .env.loadtest to the id of the fleet holding the loadtest dataset.`);
  }
  return id;
}

test.beforeAll(async () => {
  process.env.FLEET_API_TOKEN = await getApiToken(process.env.FLEET_URL!);
  const fleetId = loadtestFleetId();

  // A failed family restarts the worker; reuse the resolution the first
  // worker wrote rather than paying for the lookups again.
  const cache = path.join(API_RESULTS_DIR, '_resolution.json');
  if (fs.existsSync(cache)) {
    resolution = JSON.parse(fs.readFileSync(cache, 'utf8')) as Resolution;
  } else {
    resolution = await resolveIds(fleetId);
    fs.mkdirSync(API_RESULTS_DIR, { recursive: true });
    fs.writeFileSync(cache, JSON.stringify(resolution, null, 2));
  }

  meta = {
    startedAt: new Date().toISOString(),
    fleetUrl: process.env.FLEET_URL!,
    fleetVersion: resolution.version,
    fleetId,
    config: cfg,
    counts: resolution.counts,
    resolved: resolution.resolved,
    missing: resolution.missing,
    families: [],
  };

  console.log(`\nAPI timing against ${meta.fleetUrl} (${meta.fleetVersion}), fleet ${fleetId}`);
  console.log(`samples P0/P1/P2 = ${cfg.samplesByPriority.P0}/${cfg.samplesByPriority.P1}/${cfg.samplesByPriority.P2}, budget ${fmtMs(cfg.budgetMs)}, request cap ${fmtMs(cfg.timeoutMs)}, shape cap ${fmtMs(cfg.shapeBudgetMs)}, scope ${cfg.scope}, priorities ${cfg.priorities.join(',')}`);
  console.log(`counts: ${Object.entries(resolution.counts).map(([k, v]) => `${k}=${v ?? 'n/a'}`).join(' ')}`);
  const missing = Object.entries(resolution.missing);
  if (missing.length) console.log(`unresolved: ${missing.map(([k, v]) => `${k} (${v})`).join('; ')}`);
});

test.describe('Loadtest • API timing', () => {
  for (const family of FAMILIES) {
    // Playwright requires a destructuring pattern as the first argument even
    // when no fixture is used; the shapes are sampled with Node's fetch.
    test(family, async ({}, testInfo) => {
      const results = expandShapes(SHAPES.filter((s) => s.family === family), resolution.resolved, resolution.missing, cfg);
      const runnable = results.filter((r) => !r.skipReason).length;
      console.log(`\n── ${family}: ${runnable} shapes to sample, ${results.length - runnable} skipped ──`);

      await sampleFamily(results, cfg, (line) => console.log(`  ${line}`));

      annotate(testInfo, results);
      fs.mkdirSync(API_RESULTS_DIR, { recursive: true });
      fs.writeFileSync(
        path.join(API_RESULTS_DIR, `${family}.json`),
        JSON.stringify({ meta: { ...meta, families: [family] }, results }, null, 2),
      );

      for (const r of results) {
        if (r.severity !== 'error' && r.severity !== 'broken') continue;
        const failing = r.samples.find((s) => !(s.status >= 200 && s.status < 300));
        expect.soft(
          r.severity,
          `${r.key} — ${r.ok}/${r.samples.length} samples succeeded; first failure: HTTP ${failing?.status || 'timeout'}${failing?.uuid ? ` uuid=${failing.uuid}` : ''}${failing?.error ? ` ${failing.error}` : ''} — ${r.url}`,
        ).not.toMatch(/^(error|broken)$/);
      }
    });
  }
});
