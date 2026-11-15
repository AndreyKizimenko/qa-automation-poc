/**
 * Tier-agnostic • API • The device lab's hosts are where the suite counts on
 * them: the preflight for every spec that needs a real VM.
 *
 * **One test per pool host** (`lab-hosts.json`, role `pool`, this tier). A
 * worker is handed one pool host per platform and a host that is offline, on
 * the wrong fleet or no longer enrolled simply isn't handed out, so the pool
 * shrinks and the run goes on with the hosts that are there. That is the point
 * of a pool, and it is also silent: two workers queueing on one Ubuntu VM read
 * as a slow night. Each row here is that host's outage, named, with the reason
 * `labHostProblem` gives. Each carries its platform's VM tag, so `--grep
 * @vm-linux` runs the Linux hosts' rows beside the tests that need them.
 *
 * It is a test and not a dependency of the main project: a dependency that
 * fails skips everything behind it, and one missing pool host is no reason to
 * skip a run the other hosts can carry.
 *
 * **The hosts outside the pool are reported, not required.** No spec in this
 * project runs on a matrix, special or physical host, so one that is offline or
 * astray fails nothing here: it is noted on the last test's report and in the
 * job log, where the lab's owner reads it. The same test notes any online host
 * on lab hardware that the manifest doesn't list, which is how a host the lab
 * added shows up before the manifest's PR has merged.
 *
 * The cleanup has already returned every lab host to its role's fleet by the
 * time this runs (`setup/cleanup.steps.ts`), so "on the wrong fleet" here means
 * a host that re-enrolled since, or a return that failed.
 */
import { apiTest as test, expect } from '@fixtures';
import {
  labHostProblem,
  listLabHostRecords,
  listUnlistedLabMachines,
  newestRecord,
  recordVmOnReport,
  vmTag,
} from '@helpers/api';
import { labHostFleet, labHostsOfRun } from '@helpers/lab-hosts';

const hosts = labHostsOfRun();
const pool = hosts.filter((host) => host.role === 'pool');
const others = hosts.filter((host) => host.role !== 'pool');

test.describe('API • device lab hosts', () => {
  for (const entry of pool) {
    const fleet = labHostFleet(entry) ?? 'Unassigned';

    // eslint-disable-next-line playwright/valid-test-tags -- the tag is the host's platform's VM tag, from vmTag()
    test(`pool host ${entry.name} (${entry.os}) is online on ${fleet}`, { tag: vmTag(entry.platform) }, async ({ request }) => {
      const records = await listLabHostRecords(request, [entry]);
      expect(labHostProblem(entry, records), `pool host ${entry.name}`).toBeNull();
      recordVmOnReport(newestRecord(entry, records)!);
    });
  }

  test('hosts outside the pool, and lab machines the manifest does not list, are reported', async ({ request }) => {
    const records = await listLabHostRecords(request, others);
    const notes = [
      ...others.map((entry) => labHostProblem(entry, records)).filter((problem): problem is string => !!problem),
      ...(await listUnlistedLabMachines(request)).map(
        (host) =>
          `"${host.displayName}" (id ${host.id}, on ${host.fleetName ?? 'Unassigned'}) is online on lab hardware and lab-hosts.json doesn't list it: ` +
          'the lab\'s owner adds it to lab-hosts.json in a PR',
      ),
    ];
    for (const note of notes) {
      test.info().annotations.push({ type: 'lab host', description: note });
      console.warn(`[lab preflight] ${note}`);
    }
  });
});
