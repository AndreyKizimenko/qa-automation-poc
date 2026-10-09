/**
 * Configuration profiles: the scope's profiles are exactly the declared files,
 * per platform, and each one's label targeting is as declared. A profile's
 * payload is what a host receives, so it is compared too, as Fleet serves it
 * back: Fleet stores a profile as uploaded, so the repo file and the served
 * body differ only in line endings.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import {
  gitopsConfig,
  gitopsLabel,
  resolveTeamId,
  getAll,
  getText,
  expectExactNames,
  declaredTargets,
  targetNames,
  normalizeBody,
} from './_config';

interface ApiProfile {
  profile_uuid: string;
  name: string;
  platform: 'darwin' | 'windows' | 'android' | 'ios' | 'ipados';
  labels_include_all: unknown;
  labels_include_any: unknown;
  labels_exclude_any: unknown;
}

let teamId = 0;
let live: ApiProfile[] = [];

test.beforeAll(async ({ request }) => {
  teamId = await resolveTeamId(request);
  live = await getAll<ApiProfile>(request, `configuration_profiles?team_id=${teamId}`, 'profiles');
});

const key = (p: { platform: string; name: string }) => `${p.platform}:${p.name}`;

test.describe(`GitOps verify · configuration profiles · ${gitopsLabel}`, () => {
  test('the profile set matches gitops exactly, per platform', async () => {
    expectExactNames('profiles', live.map(key), gitopsConfig.profiles.map(key));
  });

  test("each profile's targeting matches gitops", async () => {
    const byKey = new Map(live.map((p) => [key(p), p]));
    for (const declared of gitopsConfig.profiles) {
      const profile = byKey.get(key(declared));
      if (!profile) continue; // reported by the set test
      const at = `profile "${declared.name}" (${declared.platform})`;
      const targets = declaredTargets(declared);
      expect.soft(targetNames(profile.labels_include_all), `${at} labels_include_all`).toEqual(targets.labels_include_all);
      expect.soft(targetNames(profile.labels_include_any), `${at} labels_include_any`).toEqual(targets.labels_include_any);
      expect.soft(targetNames(profile.labels_exclude_any), `${at} labels_exclude_any`).toEqual(targets.labels_exclude_any);
    }
  });

  test("each profile's payload matches the repo", async ({ request }) => {
    const byKey = new Map(live.map((p) => [key(p), p]));
    for (const declared of gitopsConfig.profiles) {
      const profile = byKey.get(key(declared));
      if (!profile) continue; // reported by the set test
      const served = await getText(request, `configuration_profiles/${profile.profile_uuid}?alt=media`);
      const repo = fs.readFileSync(declared.path, 'utf-8');
      expect.soft(normalizeBody(served), `profile "${declared.name}" (${declared.platform}) payload`).toBe(normalizeBody(repo));
    }
  });
});
