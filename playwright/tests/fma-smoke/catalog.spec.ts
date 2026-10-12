/**
 * FMA smoke • Catalog layer — no host.
 *
 * For each app the manifest selects (helpers/catalogs/fma-smoke.ts: p0 nightly,
 * p0 + p1 with FMA_SMOKE_TIER=p1), walk the part of a Fleet-maintained app's
 * life that Fleet decides on its own:
 *
 *   catalog  — the entry Fleet hydrates from its manifest names a version, an
 *              https installer URL and both scripts, for the platform the slug says;
 *   add      — Fleet downloads the installer, checks it against the manifest's
 *              SHA-256 and stores it (one synchronous request);
 *   metadata — the stored title agrees with the catalog: version, platform,
 *              scripts, a SHA-256, the FMA link, and the identifier hosts are
 *              matched on (bundle id on macOS, upgrade code on a Windows MSI);
 *   patch    — a patch policy can be made for it, linked to the title;
 *   remove   — the title leaves the fleet, and its patch policy with it first.
 *
 * What the patch policy's query says is not asserted: Fleet takes it from the
 * app's manifest (`pkg/patch_policy/patch_policy.go:109-141` in fleetdm/fleet),
 * whose wording is the manifest's to change. The host layer runs the query.
 *
 * Each app gets its own `test()` so the report and the job summary have one row
 * per app, and `test.step` per phase so a failure names the phase.
 *
 * **Its own fleet.** Every worker creates a throwaway `pw-fma-<nonce>` fleet with
 * no hosts and deletes it in `afterAll`; the cleanup projects' `pw-*` fleet sweep
 * removes one a killed run left. gitops never deletes an undeclared fleet (no
 * workflow passes `delete-other-fleets`), and no other spec's FMA claim can
 * collide with a fleet nobody else uses.
 *
 * **Size.** Each add stores the installer on the instance: the manifest's size
 * budget is what keeps this safe on the 2 GB premium box. The whole-catalog
 * pass at the end adds nothing: it reads metadata from Fleet and probes the
 * installer URLs from the runner, and runs only with FMA_SMOKE_FULL_CATALOG=1.
 *
 * Premium only: free can't add software. Pure API — `@playwright/test`, not
 * `@fixtures`, so no browser starts for it.
 */
import { test, expect } from '@playwright/test';
import {
  createFleet,
  createFleetPolicy,
  deleteFleet,
  deleteFleetPolicies,
  deleteSoftwareTitle,
  findFmaIdBySlug,
  getFleetMaintainedApp,
  getFleetMaintainedTitleMetadata,
  listAllFleetMaintainedApps,
  tryAddFmaToFleet,
  withApiRequest,
  type FleetMaintainedAppDetail,
  type FleetRef,
} from '@helpers/api';
import { fmaSmokeApps, fmaSmokeSelection } from '@helpers/catalogs/fma-smoke';
import {
  FMA_SMOKE_URLS_ANNOTATION,
  classifyAddFailure,
  recordFmaSmokeResult,
  timed,
  type FmaSmokePhase,
  type FmaSmokeResult,
  type FmaUrlCheckSummary,
} from '@helpers/fma-smoke';
import { fetchManifestSha256, mapWithConcurrency, probeInstallerUrl } from '@helpers/installer-urls';
import { runNonce } from '@helpers/profiles';

const SHA256 = /^[0-9a-f]{64}$/;
const MB = 1024 * 1024;

test.describe('FMA smoke • catalog', () => {
  let fleet: FleetRef;

  test.beforeAll(async () => {
    fleet = await withApiRequest((request) => createFleet(request, `pw-fma-${runNonce()}`));
  });

  test.afterAll(async () => {
    // Deleting the fleet takes its installers and policies with it.
    if (fleet) await withApiRequest((request) => deleteFleet(request, fleet.id, { ignoreMissing: true }));
  });

  for (const app of fmaSmokeSelection()) {
    test(`${app.slug} — add, metadata, patch policy, remove`, async ({ request }, testInfo) => {
      // An add downloads the installer inside the request; the budget covers a
      // slow vendor CDN for the manifest's small apps, not Fleet's 15-minute cap.
      test.setTimeout(240_000);

      const result: FmaSmokeResult = { slug: app.slug, layer: 'catalog', passed: false, timings: {} };
      let phase: FmaSmokePhase = 'catalog';
      let titleId: number | undefined;
      let policyId: number | undefined;
      try {
        const fmaId = await findFmaIdBySlug(request, fleet.id, app.slug);

        const entry = await test.step('catalog entry', () =>
          timed(result.timings, 'catalog', async () => {
            const e = await getFleetMaintainedApp(request, fmaId, fleet.id);
            result.version = e.version;
            expect(e.slug).toBe(app.slug);
            expect(e.platform).toBe(app.platform);
            expect(e.version, 'the manifest publishes a version').not.toBe('');
            expect(e.url, 'the installer URL').toMatch(/^https:\/\//);
            expect(e.installScript.trim(), 'a default install script').not.toBe('');
            expect(e.uninstallScript.trim(), 'a default uninstall script').not.toBe('');
            expect(e.titleId, 'the fresh fleet has not added it yet').toBeNull();
            return e;
          }),
        );

        phase = 'add';
        titleId = await test.step('add to the fleet', () =>
          timed(result.timings, 'add', async () => {
            const outcome = await tryAddFmaToFleet(request, fleet.id, app.slug);
            if (!outcome.ok) {
              result.owner = classifyAddFailure(outcome);
              result.detail = `HTTP ${outcome.status}: ${outcome.message}`;
              throw new Error(`Fleet refused to add ${app.slug} (${result.owner}): ${result.detail}`);
            }
            return outcome.titleId;
          }),
        );

        phase = 'metadata';

        await test.step('stored metadata matches the catalog', () =>
          timed(result.timings, 'metadata', async () => {
            const meta = await getFleetMaintainedTitleMetadata(request, fleet.id, titleId!);
            expect(meta.package, 'the title has an installer on the fleet').not.toBeNull();
            const pkg = meta.package!;
            expect.soft(pkg.fleetMaintainedAppId, 'linked to its catalog entry').toBe(fmaId);
            expect.soft(pkg.platform).toBe(app.platform);
            expect.soft(pkg.version, 'stored version is the published one').toBe(entry.version);
            expect.soft(pkg.hashSha256, 'a SHA-256 for the stored installer').toMatch(SHA256);
            expect.soft(pkg.installScript.trim()).not.toBe('');
            expect.soft(pkg.uninstallScript.trim()).not.toBe('');
            expect.soft(pkg.selfService, 'added without self-service').toBe(false);
            expect.soft(meta.source).toBe(app.platform === 'darwin' ? 'apps' : 'programs');
            if (app.expectedBundleId) expect.soft(meta.bundleIdentifier).toBe(app.expectedBundleId);
            if (app.expectedUpgradeCode) {
              expect.soft(meta.upgradeCode?.toUpperCase()).toBe(app.expectedUpgradeCode.toUpperCase());
            }
            // expect.soft lets every mismatch show; the phase still fails on any of them.
            expect(testInfo.errors, 'stored metadata disagrees with the catalog').toHaveLength(0);
          }),
        );

        phase = 'patch-policy';

        await test.step('patch policy is created for the title', () =>
          timed(result.timings, 'patch-policy', async () => {
            const policy = await createFleetPolicy(request, fleet.id, {
              name: `pw-fma-patch-${runNonce()}`,
              type: 'patch',
              patch_software_title_id: titleId!,
            });
            policyId = policy.id;
            expect(policy.type).toBe('patch');
            expect(policy.patchSoftwareTitleId, 'linked to the title').toBe(titleId);
            expect(policy.query.trim(), 'Fleet generated a query').not.toBe('');
          }),
        );

        phase = 'remove';

        await test.step('remove from the fleet', () =>
          timed(result.timings, 'remove', async () => {
            // A title a policy points at can't be deleted, so the policy goes first.
            await deleteFleetPolicies(request, fleet.id, [policyId!]);
            policyId = undefined;
            await deleteSoftwareTitle(request, fleet.id, titleId!);
            titleId = undefined;
            const after = await getFleetMaintainedApp(request, fmaId, fleet.id);
            expect(after.titleId, 'the fleet no longer has the app').toBeNull();
          }),
        );

        result.passed = true;
      } catch (err) {
        result.phase = phase;
        result.owner ??= phase === 'catalog' || phase === 'metadata' ? 'fleet' : 'unclassified';
        result.detail ??= String(err instanceof Error ? err.message : err).split('\n')[0];
        throw err;
      } finally {
        if (policyId) await deleteFleetPolicies(request, fleet.id, [policyId]).catch(() => undefined);
        if (titleId) await deleteSoftwareTitle(request, fleet.id, titleId).catch(() => undefined);
        recordFmaSmokeResult(testInfo, result);
      }
    });
  }
});

/**
 * Its own describe, skipped at describe level, so a run without
 * FMA_SMOKE_FULL_CATALOG=1 starts no worker hook and creates no fleet for it.
 */
test.describe('FMA smoke • whole catalog', () => {
  // On demand only: ~1,400 metadata reads against the shared instance.
  test.skip(process.env.FMA_SMOKE_FULL_CATALOG !== '1', 'whole-catalog pass runs only with FMA_SMOKE_FULL_CATALOG=1');

  let fleet: FleetRef;

  test.beforeAll(async () => {
    fleet = await withApiRequest((request) => createFleet(request, `pw-fma-${runNonce()}`));
  });

  test.afterAll(async () => {
    if (fleet) await withApiRequest((request) => deleteFleet(request, fleet.id, { ignoreMissing: true }));
  });

  /**
   * Every catalog entry, without adding any:
   *
   *   1. Fleet hydrates each from its manifest (no download): a version, an https
   *      URL and both scripts. One request per entry to the instance.
   *   2. From the runner, never through the instance: each installer URL answers
   *      a 1-byte `Range` GET (GET, not HEAD, which some vendors refuse), and each
   *      manifest's SHA-256 is read from Fleet's manifest source to list the
   *      `no_check` ones. At most 8 in flight, 20 s each, one retry on a network error.
   *
   * Fails on what is broken — an entry Fleet can't hydrate (fleet) or a URL that
   * answers 4xx after its redirects (upstream). Lists without failing: network
   * errors (infra), other statuses, `no_check` manifests, and p0/p1 sizes more
   * than 2× off the manifest's `approxMb`.
   */
  test('whole catalog: metadata hydrates and installer URLs answer', async ({ request }, testInfo) => {
    test.setTimeout(3_600_000);
    const entries = await listAllFleetMaintainedApps(request, { fleetId: fleet.id });
    expect(entries.length, 'the catalog is not empty').toBeGreaterThan(0);

    const hydrateFailures: string[] = [];
    const hydrated: FleetMaintainedAppDetail[] = [];
    for (const e of entries) {
      try {
        const d = await getFleetMaintainedApp(request, e.id, fleet.id);
        const why = [
          !d.version && 'no version',
          !/^https:\/\//.test(d.url) && `url "${d.url}"`,
          !d.installScript.trim() && 'no install script',
          !d.uninstallScript.trim() && 'no uninstall script',
        ].filter(Boolean);
        if (why.length) hydrateFailures.push(`${e.slug}: ${why.join(', ')}`);
        if (/^https:\/\//.test(d.url)) hydrated.push(d);
      } catch (err) {
        hydrateFailures.push(`${e.slug}: ${String(err instanceof Error ? err.message : err).split('\n')[0]}`);
      }
    }

    const probes = await mapWithConcurrency(hydrated, 8, async (d) => ({
      d,
      probe: await probeInstallerUrl(d.url),
      sha: await fetchManifestSha256(d.slug),
    }));

    const sizeFindings: string[] = [];
    for (const app of fmaSmokeApps) {
      const p = probes.find((x) => x.d.slug === app.slug)?.probe;
      if (!p?.totalBytes) continue;
      const mb = p.totalBytes / MB;
      if (mb > app.approxMb * 2 || mb < app.approxMb / 2) {
        sizeFindings.push(`${app.slug}: ${mb.toFixed(1)} MB served, manifest approxMb ${app.approxMb}`);
      }
    }

    const by = (o: string) => probes.filter((x) => x.probe.outcome === o);
    const line = ({ d, probe }: (typeof probes)[number]) =>
      `${d.slug}\t${probe.outcome}\tHTTP ${probe.status}\tredirects ${probe.redirects}\t` +
      `${probe.totalBytes === null ? 'size ?' : `${(probe.totalBytes / MB).toFixed(1)} MB`}` +
      `${probe.note ? `\t${probe.note}` : ''}\t${d.url}`;
    const noCheck = probes.filter((x) => x.sha === 'no_check').map((x) => x.d.slug);

    const summary: FmaUrlCheckSummary = {
      total: probes.length,
      ok: by('ok').length,
      upstream: by('upstream').length,
      infra: by('infra').length,
      unclassified: by('unclassified').length,
      noCheckSha: noCheck.length,
      sizeFindings: sizeFindings.length,
    };
    testInfo.annotations.push({ type: FMA_SMOKE_URLS_ANNOTATION, description: JSON.stringify(summary) });

    const section = (title: string, rows: string[]) => [`## ${title} (${rows.length})`, ...(rows.length ? rows : ['(none)']), ''];
    await testInfo.attach('catalog-broken.txt', {
      contentType: 'text/plain',
      body: [
        ...section('Fleet could not hydrate (fleet)', hydrateFailures),
        ...section('Installer URL refused after redirects (upstream)', by('upstream').map(line)),
        ...section('Installer URL unreachable after a retry (infra)', by('infra').map(line)),
        ...section('Installer URL answered something else (unclassified)', by('unclassified').map(line)),
        ...section('Manifest SHA-256 is no_check (listed, not a failure)', noCheck),
        ...section('p0/p1 size more than 2x off approxMb (manifest finding, not a failure)', sizeFindings),
        ...section('Reachable', by('ok').map(line)),
      ].join('\n'),
    });

    expect.soft(hydrateFailures, `${hydrateFailures.length} catalog entries don't hydrate cleanly`).toEqual([]);
    expect.soft(by('upstream').map((x) => x.d.slug), 'installer URLs the vendor refuses').toEqual([]);
  });
});
