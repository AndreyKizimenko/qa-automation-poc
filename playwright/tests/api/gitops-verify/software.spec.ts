/**
 * Software: the fleet's installable titles are exactly the declared custom
 * packages and Fleet-maintained apps, and each carries the declared options.
 *
 * A custom package is matched by its installer filename (the URL's last
 * segment, as Fleet records it) and then held to its hash — the hash is what
 * makes an apply skip the download, so a mismatch means a different file is on
 * the instance. A Fleet-maintained app is matched by slug through the catalog,
 * which reports the title each slug resolved to on this fleet. The option
 * fields (self-service, categories, label targets, setup experience, the
 * scripts and the pre-install query) are read from the title detail, the only
 * place Fleet returns them.
 *
 * Software is declared by fleet files (and `fleets/unassigned.yml`); a
 * `default.yml` can't carry it, so the no-team scope skips.
 */
import { test, expect } from '@playwright/test';
import {
  gitopsConfig,
  gitopsLabel,
  resolveTeamId,
  expectExactNames,
  expectSubset,
  declaredTargets,
  targetNames,
  normalizeBody,
  normalizeSql,
  resolveFleetSoftware,
  type FleetSoftware,
} from './_config';

let software: FleetSoftware;

test.describe(`GitOps verify · software · ${gitopsLabel}`, () => {
  test.skip(gitopsConfig.scope !== 'team', 'software is declared by fleet files');

  test.beforeAll(async ({ request }) => {
    software = await resolveFleetSoftware(request, await resolveTeamId(request));
  });

  const customTitles = () => software.titles.filter((t) => t.package && t.package.fleet_maintained_app_id == null);
  const fmaTitles = () => software.titles.filter((t) => t.package && t.package.fleet_maintained_app_id != null);

  test('the custom package set matches gitops exactly', async () => {
    expectExactNames(
      'custom packages',
      customTitles().map((t) => t.package!.name as string),
      gitopsConfig.software.packages.map((p) => p.fileName),
    );
  });

  test("each custom package's hash and options match gitops", async () => {
    const byFile = new Map(customTitles().map((t) => [t.package!.name as string, t.package!]));
    for (const declared of gitopsConfig.software.packages) {
      const pkg = byFile.get(declared.fileName);
      if (!pkg) continue; // reported by the set test
      const at = `package "${declared.fileName}"`;
      if (declared.hash) expect.soft(pkg.hash_sha256, `${at} hash_sha256`).toBe(declared.hash);
      expectSubset(at, pkg, {
        self_service: declared.selfService,
        categories: declared.categories ? [...declared.categories].sort() : undefined,
        install_during_setup: declared.setupExperience,
      });
      if (pkg.categories) expect.soft([...pkg.categories].sort(), `${at} categories`).toEqual(declared.categories ?? []);
      expectTargets(at, pkg, declared);
      expectScripts(at, pkg, declared);
    }
  });

  test('the Fleet-maintained app set matches gitops exactly', async () => {
    expectExactNames(
      'Fleet-maintained apps',
      [...software.addedSlugs.keys()],
      gitopsConfig.software.fleetMaintainedApps.map((a) => a.slug),
    );
    // Every added slug must have produced a title with an installer on this fleet.
    const titleIds = new Set(fmaTitles().map((t) => t.id));
    for (const [slug, titleId] of software.addedSlugs) {
      expect.soft(titleIds.has(titleId), `Fleet-maintained app "${slug}" has an installer on this fleet`).toBe(true);
    }
  });

  test("each Fleet-maintained app's options match gitops", async () => {
    for (const declared of gitopsConfig.software.fleetMaintainedApps) {
      const titleId = software.addedSlugs.get(declared.slug);
      const pkg = software.titles.find((t) => t.id === titleId)?.package;
      if (!pkg) continue; // reported by the set test
      const at = `Fleet-maintained app "${declared.slug}"`;
      expectSubset(at, pkg, {
        self_service: declared.selfService,
        install_during_setup: declared.setupExperience,
      });
      if (declared.categories) {
        expect.soft([...(pkg.categories ?? [])].sort(), `${at} categories`).toEqual([...declared.categories].sort());
      }
      // An exact pin is a version the installer must be; a caret pin only bounds the major.
      if (declared.version && !declared.version.startsWith('^')) {
        expect.soft(pkg.version, `${at} version`).toBe(declared.version);
      } else if (declared.version) {
        expect.soft(String(pkg.version).split('.')[0], `${at} major version`).toBe(declared.version.slice(1).split('.')[0]);
      }
      expectTargets(at, pkg, declared);
      expectScripts(at, pkg, declared);
    }
  });

  test('the App Store app set matches gitops exactly', async () => {
    const live = software.titles.filter((t) => t.appStoreApp).map((t) => `${t.appStoreApp!.platform}:${t.appStoreApp!.app_store_id}`);
    const declared = gitopsConfig.software.appStoreApps.map((a) => `${a.platform ?? ''}:${a.appStoreId}`);
    // An app declared without a platform is added once per platform the store offers, so compare on the id alone then.
    if (gitopsConfig.software.appStoreApps.some((a) => !a.platform)) {
      expectExactNames(
        'App Store apps',
        [...new Set(live.map((k) => k.split(':')[1]))],
        [...new Set(declared.map((k) => k.split(':')[1]))],
      );
    } else {
      expectExactNames('App Store apps', live, declared);
    }
  });
});

function expectTargets(at: string, pkg: Record<string, any>, declared: Parameters<typeof declaredTargets>[0]): void {
  const targets = declaredTargets(declared);
  expect.soft(targetNames(pkg.labels_include_all), `${at} labels_include_all`).toEqual(targets.labels_include_all);
  expect.soft(targetNames(pkg.labels_include_any), `${at} labels_include_any`).toEqual(targets.labels_include_any);
  expect.soft(targetNames(pkg.labels_exclude_any), `${at} labels_exclude_any`).toEqual(targets.labels_exclude_any);
}

function expectScripts(
  at: string,
  pkg: Record<string, any>,
  declared: { preInstallQuery?: string; installScript?: string; uninstallScript?: string; postInstallScript?: string },
): void {
  if (declared.preInstallQuery !== undefined) {
    expect.soft(normalizeSql(pkg.pre_install_query), `${at} pre_install_query`).toBe(normalizeSql(declared.preInstallQuery));
  }
  for (const [key, body] of [
    ['install_script', declared.installScript],
    ['uninstall_script', declared.uninstallScript],
    ['post_install_script', declared.postInstallScript],
  ] as const) {
    if (body !== undefined) expect.soft(normalizeBody(pkg[key] ?? ''), `${at} ${key}`).toBe(normalizeBody(body));
  }
}
