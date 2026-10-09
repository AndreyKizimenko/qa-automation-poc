/**
 * Re-running `fleetctl gitops --dry-run` with the config that was just applied
 * must propose **no deletions**.
 *
 * ── Why deletions, and only deletions ────────────────────────────────────────
 *
 * `gitops --dry-run` is not a diff. It reports everything it *would apply*
 * regardless of current state, so a matching instance still prints a wall of
 * `[+] would've applied 22 policies` and friends. Asserting on those would pin
 * the config's own contents, not the instance.
 *
 * `[-] would've deleted …` lines are the exception: gitops only proposes a
 * deletion for something that exists on the server and is absent from the
 * config. On an instance that was just brought to this exact config, there
 * should be nothing left to delete. Anything that shows up here means the apply
 * did not fully take, or something drifted in between.
 *
 * The assertion is not vacuous: a dry-run of a *different* config against this
 * same instance does report deletions, which
 * `tests/cli/shared/gitops-dry-run.spec.ts` asserts positively using the
 * `fleetctl new` scaffold. That spec is this one's negative control.
 *
 * Software deletion lines are the one exception to the exception. fleetctl's
 * dry-run reports `[-] would've deleted software - <title>` for titles the
 * apply keeps — `zoom` on QA, `7-zip` and `Fleet Playwright Install` on VMs,
 * each declared, each still there with the same installer after every apply
 * (gitops/premium-fleetqa/README.md, "A known false report"): the report
 * matches titles on a different key from the deletion itself. Those lines are
 * dropped here, and the software *set* of every fleet file is what the
 * gitops-verify project asserts exactly, after each apply.
 *
 * Runs in the nightly GitOps chain only, in the same window as the
 * generate-gitops checks — but for a different reason than those. The Playwright
 * suite mostly *deletes* global state, which produces no deletions here, so this
 * check tends to pass out of window rather than break. What it cannot survive is
 * running while the suite is mid-flight: the policy and report CRUD specs create
 * entities the config doesn't declare, and gitops would rightly propose deleting
 * them. A failure here outside the nightly chain is that, not a real drift.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fleetctl, output } from '@helpers/fleetctl';
import { minConfigDir, minConfigLabel } from './_generated';

/**
 * Every file the nightly's min apply passes for this tier: the min directory's
 * default.yml and fleets/*.yml, plus — on premium — the baseline directory's
 * fleet files the min apply carries unchanged (QA and VMs hold the suite's
 * durable fixtures, so `gitops-premium-min.yml` applies the same files in both
 * passes). A fleet file left out here would be a fleet the dry-run never
 * looks at.
 */
function appliedFiles(): string[] {
  const files = [path.join(minConfigDir, 'default.yml')];
  const fleetsDir = path.join(minConfigDir, 'fleets');
  if (fs.existsSync(fleetsDir)) {
    for (const entry of fs.readdirSync(fleetsDir).filter((f) => f.endsWith('.yml'))) {
      files.push(path.join(fleetsDir, entry));
    }
  }
  if (process.env.SUITE === 'premium') {
    const baselineFleets = path.join(path.dirname(minConfigDir), 'premium-fleetqa', 'fleets');
    for (const entry of ['qa.yml', 'vms.yml']) files.push(path.join(baselineFleets, entry));
  }
  return files;
}

test.describe(`gitops --dry-run · ${minConfigLabel}`, () => {
  test('proposes no deletions against the config it was applied from', async () => {
    test.setTimeout(180_000);

    const args = ['gitops', '--dry-run'];
    for (const file of appliedFiles()) args.push('-f', file);

    const res = await fleetctl(args);
    expect(res.code, `dry run failed:\n${output(res)}`).toBe(0);
    expect(output(res)).toContain('gitops dry run succeeded');

    const deletions = output(res)
      .split('\n')
      .filter((line) => line.trimStart().startsWith("[-] would've deleted"))
      // fleetctl's false software-deletion report (header); the software set is gitops-verify's.
      .filter((line) => !line.trimStart().startsWith("[-] would've deleted software - "));

    expect(
      deletions,
      'gitops would delete resources that the just-applied config should already account for — ' +
        'either the apply did not fully take, or this ran outside the nightly window (after the ' +
        "Playwright suite's cleanup-setup, the instance no longer matches the config)",
    ).toEqual([]);
  });
});
