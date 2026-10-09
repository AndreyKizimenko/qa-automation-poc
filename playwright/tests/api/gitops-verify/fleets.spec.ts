/**
 * Fleets: the instance's fleets are exactly the ones the tier's gitops files
 * declare, plus the ones gitops deliberately leaves alone. The nightly applies
 * the baseline's QA and VMs files in both passes, so the expected set is the
 * union of the baseline and min directories' fleet files, and `Mobile` is
 * hand-kept (gitops/premium-fleetqa/README.md). A fleet the suite's cleanup
 * would sweep (`pw-*`, a throwaway a dead run left) is reported, not failed on:
 * the chain runs before that sweep.
 *
 * Free has no fleets, and the no-team config is where the fleet files sit, so
 * this runs for a premium no-team target only.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { gitopsConfig, gitopsLabel, isPremium, getJson, HAND_KEPT_FLEETS, siblingConfigDir } from './_config';

test.describe(`GitOps verify · fleets · ${gitopsLabel}`, () => {
  test.skip(!isPremium, 'free has no fleets');
  test.skip(gitopsConfig.scope !== 'no-team', 'the fleet set is checked once, from the no-team target');

  test('the fleet set matches the gitops fleet files plus the hand-kept fleets', async ({ request }) => {
    const declared = new Set(gitopsConfig.fleetFiles.map((f) => f.name));
    const sibling = siblingConfigDir();
    if (sibling) {
      const fleetsDir = path.join(sibling, 'fleets');
      for (const file of fs.existsSync(fleetsDir) ? fs.readdirSync(fleetsDir).filter((f) => f.endsWith('.yml')) : []) {
        const doc = yaml.load(fs.readFileSync(path.join(fleetsDir, file), 'utf-8')) as { name?: string };
        if (doc?.name) declared.add(doc.name);
      }
    }
    for (const name of HAND_KEPT_FLEETS) declared.add(name);

    const live = ((await getJson(request, 'teams?per_page=200')).teams as Array<{ name: string }>).map((t) => t.name);
    const throwaway = live.filter((n) => n.startsWith('pw-'));
    if (throwaway.length) console.warn(`[gitops-verify] throwaway fleets left by a dead run, ignored: ${throwaway.join(', ')}`);
    const standing = live.filter((n) => !n.startsWith('pw-')).sort();

    expect(standing, 'the standing fleets').toEqual([...declared].sort());
  });
});
