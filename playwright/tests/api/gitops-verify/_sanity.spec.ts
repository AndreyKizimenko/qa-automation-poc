/**
 * The target parsed into something worth comparing. Every other spec here is a
 * set or field comparison, and a comparison of two empty sets passes: a YAML
 * key that went missing, a `path:` list that stopped resolving, or a glob that
 * matches nothing would turn the whole project green with nothing asserted.
 * This spec pins the shape the configs are known to have, so that failure is
 * named here instead.
 *
 * One fleet is the other way round: OS matrix is declared empty on purpose
 * (`EMPTY_FLEETS`), so for it an entity that *appears* in the file is the
 * failure, and the entity specs' comparisons against empty lists are what hold
 * the fleet to holding nothing.
 */
import { test, expect } from '@playwright/test';
import { EMPTY_FLEETS, gitopsConfig, gitopsLabel } from './_config';

/** How many entities the target declares, of every kind the specs compare. */
function declaredEntities(): number {
  return (
    gitopsConfig.labels.length +
    gitopsConfig.policies.length +
    gitopsConfig.reports.length +
    gitopsConfig.scripts.length +
    gitopsConfig.profiles.length +
    gitopsConfig.software.packages.length +
    gitopsConfig.software.fleetMaintainedApps.length +
    gitopsConfig.software.appStoreApps.length
  );
}

const emptyByDesign = gitopsConfig.scope === 'team' && EMPTY_FLEETS.includes(gitopsConfig.teamName ?? '');

test.describe(`GitOps verify · target · ${gitopsLabel}`, () => {
  test('the no-team config declares every entity kind', async () => {
    test.skip(gitopsConfig.scope !== 'no-team', 'a fleet file may legitimately leave a kind empty');
    expect(gitopsConfig.orgName, 'org_settings.org_info.org_name').toBeTruthy();
    expect(gitopsConfig.agentOptions, 'agent_options').toBeTruthy();
    expect(gitopsConfig.labels.length, 'labels').toBeGreaterThan(0);
    expect(gitopsConfig.policies.length, 'policies').toBeGreaterThan(0);
    expect(gitopsConfig.reports.length, 'reports').toBeGreaterThan(0);
    expect(gitopsConfig.scripts.length, 'controls.scripts').toBeGreaterThan(0);
    expect(gitopsConfig.profiles.length, 'configuration profiles').toBeGreaterThan(0);
  });

  test('a fleet file declares at least one entity', async () => {
    test.skip(gitopsConfig.scope !== 'team', 'no-team configs are checked kind by kind');
    test.skip(emptyByDesign, `${gitopsConfig.teamName} is declared empty on purpose`);
    expect(declaredEntities(), `${gitopsConfig.teamName} declares nothing the specs could verify`).toBeGreaterThan(0);
  });

  test('a fleet that holds lab hosts declares no entity, and disk encryption off', async () => {
    test.skip(!emptyByDesign, 'only a fleet kept empty on purpose (OS matrix)');
    // Soft throughout, so one run names everything the file should not carry.
    expect
      .soft(
        declaredEntities(),
        `${gitopsConfig.teamName} holds the device lab's hosts: whatever its file declares reaches every one of them`,
      )
      .toBe(0);
    // Declared off, not left out, so the controls spec asserts them off on the instance.
    const { apple_settings: apple, windows_settings: windows, linux_settings: linux } = gitopsConfig.controls;
    expect.soft(apple?.enable_disk_encryption, 'controls.apple_settings.enable_disk_encryption').toBe(false);
    expect.soft(windows?.enable_disk_encryption, 'controls.windows_settings.enable_disk_encryption').toBe(false);
    expect
      .soft(linux?.enable_escrow_disk_encryption_key, 'controls.linux_settings.enable_escrow_disk_encryption_key')
      .toBe(false);
    for (const key of ['macos_updates', 'ios_updates', 'ipados_updates', 'windows_updates', 'setup_experience']) {
      expect.soft(gitopsConfig.controls[key], `controls.${key}`).toBeUndefined();
    }
  });

  test('every declared name is unique within its kind', async () => {
    for (const [kind, names] of [
      ['labels', gitopsConfig.labels.map((l) => l.name)],
      ['policies', gitopsConfig.policies.map((p) => p.name)],
      ['reports', gitopsConfig.reports.map((r) => r.name)],
      ['scripts', gitopsConfig.scripts.map((s) => s.name)],
      ['profiles', gitopsConfig.profiles.map((p) => `${p.platform}:${p.name}`)],
    ] as const) {
      const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
      expect.soft(duplicates, `${kind} declared twice`).toEqual([]);
    }
  });
});
