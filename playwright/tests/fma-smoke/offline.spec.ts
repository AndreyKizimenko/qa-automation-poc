/**
 * FMA smoke • checks that need no instance.
 *
 *   - **Manifest vs gitops.** A `host: true` app is a durable fixture on the VMs
 *     fleet, so `gitops/premium-fleetqa/fleets/vms.yml` must declare it; every
 *     other manifest app must be declared on no standing fleet, or the catalog
 *     layer's add would collide with a title a fleet keeps. Read from the YAML,
 *     never a hard-coded list, so a gitops edit can't drift past it.
 *   - **Manifest vs denylist.** Nothing the manifest selects may be denylisted.
 *   - **Summary and owner rules.** `buildFmaSmokeSummary` keeps a failed attempt
 *     visible when a retry passes; the classifiers place Fleet's add errors.
 *
 * Runs in the `fma-smoke-catalog` project; locally,
 * `npx playwright test --project=fma-smoke-catalog --no-deps offline` needs no
 * instance and no `.env.premium` values beyond `SUITE`.
 */
import * as fs from 'fs';
import * as path from 'path';
import { test, expect } from '@playwright/test';
import { loadFleetConfig } from '@helpers/gitops-yaml';
import { fmaSmokeApps, fmaSmokeDenylist } from '@helpers/catalogs/fma-smoke';
import {
  ARM64_NOTE,
  buildFmaSmokeSummary,
  classifyAddFailure,
  classifyScriptFailure,
  type FmaSmokeResult,
} from '@helpers/fma-smoke';

const GITOPS = path.resolve(__dirname, '../../../gitops');
const VMS_FILE = path.join(GITOPS, 'premium-fleetqa/fleets/vms.yml');

/** Every fleet file the premium applies use: the baseline's and the min config's. */
function standingFleetFiles(): string[] {
  return ['premium-fleetqa/fleets', 'premium-fleetqa-min/fleets'].flatMap((dir) =>
    fs
      .readdirSync(path.join(GITOPS, dir))
      .filter((f) => f.endsWith('.yml'))
      .map((f) => path.join(GITOPS, dir, f)),
  );
}

const declaredSlugs = (file: string): string[] =>
  loadFleetConfig(file).software.fleetMaintainedApps.map((a) => a.slug);

test.describe('FMA smoke • manifest', () => {
  test('host apps are durable VMs-fleet fixtures', () => {
    const onVms = new Set(declaredSlugs(VMS_FILE));
    const missing = fmaSmokeApps.filter((a) => a.host && !onVms.has(a.slug)).map((a) => a.slug);
    expect(missing, 'host: true apps that vms.yml does not declare').toEqual([]);
  });

  test('catalog-only apps are declared on no standing fleet', () => {
    const clashes = standingFleetFiles().flatMap((file) => {
      const declared = new Set(declaredSlugs(file));
      return fmaSmokeApps
        .filter((a) => !a.host && declared.has(a.slug))
        .map((a) => `${a.slug} (${path.relative(GITOPS, file)})`);
    });
    expect(clashes, 'catalog-only apps a standing fleet already keeps').toEqual([]);
  });

  test('nothing in the manifest is denylisted', () => {
    expect(fmaSmokeApps.filter((a) => a.slug in fmaSmokeDenylist).map((a) => a.slug)).toEqual([]);
  });
});

test.describe('FMA smoke • summary and owner rules', () => {
  const base = (over: Partial<FmaSmokeResult>): FmaSmokeResult => ({
    slug: 'rectangle/darwin',
    layer: 'catalog',
    passed: true,
    timings: {},
    ...over,
  });

  test('a pass on retry is flaky and keeps the failed attempt', () => {
    const md = buildFmaSmokeSummary([
      { retry: 0, result: base({ passed: false, phase: 'add', owner: 'infra', detail: 'HTTP 502: bad gateway' }) },
      { retry: 1, result: base({ passed: true }) },
    ]);
    expect(md).toContain(ARM64_NOTE);
    expect(md).toContain('1/1 passed, 1 flaky');
    expect(md).toContain('⚠️ passed on retry 1');
    expect(md).toContain('attempt 1: add (infra) HTTP 502: bad gateway');
  });

  test('a failure sorts before a pass and shows its owner and patch check', () => {
    const md = buildFmaSmokeSummary([
      { retry: 0, result: base({ slug: 'a/darwin' }) },
      {
        retry: 0,
        result: base({ slug: 'b/windows', layer: 'host', passed: false, phase: 'install', owner: 'fleet', patchCheck: 'not-run' }),
      },
    ]);
    const rows = md.split('\n').filter((l) => l.startsWith('| ✅') || l.startsWith('| ❌'));
    expect(rows[0]).toContain('`b/windows`');
    expect(rows[0]).toContain('| install | fleet | not-run |');
    expect(md).toContain('failures by owner: unclassified 0, fleet 1, upstream 0, infra 0');
  });

  test('the URL pass adds its own section', () => {
    const md = buildFmaSmokeSummary([], {
      total: 3, ok: 1, upstream: 1, infra: 1, unclassified: 0, noCheckSha: 2, sizeFindings: 0,
    });
    expect(md).toContain('| 3 | 1 | 1 | 1 | 0 | 2 | 0 |');
  });

  test('add failures go to their owner by status and Fleet wrap', () => {
    const fail = (status: number, message: string) => ({ ok: false as const, status, message, ms: 0 });
    expect(classifyAddFailure(fail(500, 'mismatch in maintained app SHA256 hash'))).toBe('upstream');
    expect(classifyAddFailure(fail(500, 'downloading app installer: 404 not found'))).toBe('upstream');
    expect(classifyAddFailure(fail(500, 'downloading app installer: context deadline exceeded'))).toBe('infra');
    expect(classifyAddFailure(fail(502, ''))).toBe('infra');
    expect(classifyAddFailure(fail(409, ''))).toBe('unclassified');
    expect(classifyAddFailure(fail(422, 'validation failed'))).toBe('fleet');
  });

  test('script failures go to their owner by output', () => {
    expect(classifyScriptFailure('hdiutil: attach failed - no mountable file systems')).toBe('upstream');
    expect(classifyScriptFailure('Error: timed out waiting')).toBe('infra');
    expect(classifyScriptFailure('exit status 1')).toBe('fleet');
    expect(classifyScriptFailure('')).toBe('unclassified');
  });
});
