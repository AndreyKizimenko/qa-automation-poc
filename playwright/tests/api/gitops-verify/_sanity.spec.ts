/**
 * The target parsed into something worth comparing. Every other spec here is a
 * set or field comparison, and a comparison of two empty sets passes: a YAML
 * key that went missing, a `path:` list that stopped resolving, or a glob that
 * matches nothing would turn the whole project green with nothing asserted.
 * This spec pins the shape the configs are known to have, so that failure is
 * named here instead.
 */
import { test, expect } from '@playwright/test';
import { gitopsConfig, gitopsLabel } from './_config';

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
    const declared =
      gitopsConfig.labels.length +
      gitopsConfig.policies.length +
      gitopsConfig.reports.length +
      gitopsConfig.scripts.length +
      gitopsConfig.profiles.length +
      gitopsConfig.software.packages.length +
      gitopsConfig.software.fleetMaintainedApps.length +
      gitopsConfig.software.appStoreApps.length;
    expect(declared, `${gitopsConfig.teamName} declares nothing the specs could verify`).toBeGreaterThan(0);
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
