/**
 * Software: the fleet's installable titles are exactly the declared custom
 * packages and Fleet-maintained apps, and each carries the declared options.
 *
 * A custom package is matched by its hash when the package file declares one
 * (the hash is what makes an apply skip the download, so it identifies the
 * file), else by its installer filename (the URL's last segment, as Fleet
 * records it; the name of a script-only package). A Fleet-maintained app is
 * matched by slug through the catalog, which reports the title each slug
 * resolved to on this fleet. The option fields (self-service, categories,
 * label targets, setup experience, the scripts and the pre-install query) are
 * read from the title detail, the only place Fleet returns them.
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

  /**
   * Pairs each declared package with the live installer it identifies — by hash
   * when the package file declares one, else by filename — each live installer
   * claimed at most once. What is left on either side is a difference.
   */
  function matchPackages() {
    const live = customTitles().map((t) => t.package!);
    const claimed = new Set<Record<string, any>>();
    const matched = new Map<(typeof gitopsConfig.software.packages)[number], Record<string, any>>();
    const missing: string[] = [];
    for (const declared of gitopsConfig.software.packages) {
      const pkg = live.find(
        (p) => !claimed.has(p) && (declared.hash ? p.hash_sha256 === declared.hash : p.name === declared.fileName),
      );
      if (pkg) {
        claimed.add(pkg);
        matched.set(declared, pkg);
      } else {
        missing.push(declared.fileName);
      }
    }
    const extra = live.filter((p) => !claimed.has(p)).map((p) => p.name as string);
    return { matched, missing, extra };
  }

  test('the custom package set matches gitops exactly', async () => {
    const { missing, extra } = matchPackages();
    expect.soft(missing, 'custom packages declared in gitops but missing on the instance').toEqual([]);
    expect.soft(extra, "custom packages on the instance that gitops doesn't declare").toEqual([]);
    expect(missing.length + extra.length, 'custom package differences').toBe(0);
  });

  test("each custom package's options match gitops", async () => {
    for (const [declared, pkg] of matchPackages().matched) {
      const at = `package "${declared.fileName}"`;
      expectSubset(at, pkg, {
        self_service: declared.selfService,
        install_during_setup: declared.setupExperience,
      });
      if (declared.categories) {
        expect.soft([...(pkg.categories ?? [])].sort(), `${at} categories`).toEqual([...declared.categories].sort());
      }
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
