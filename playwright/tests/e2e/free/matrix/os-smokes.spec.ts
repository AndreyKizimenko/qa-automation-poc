/**
 * Free • OS smoke • the same few checks on each of free's lab hosts.
 *
 * One describe per OS version in `lab-hosts.json` for the free tier: its pool
 * VMs (Ubuntu 24.04, Windows 11, macOS 26, one each) and its ChromeOS host, all
 * in Unassigned. Free's main suite runs its real-host specs on the same VMs,
 * but each takes what it needs of one platform (a script interpreter, a live
 * report on the Mac, a policy run across three), so none reads what Fleet
 * shows of each OS, and none reaches the ChromeOS host. Here every host gets
 * the checks premium's smokes make that free has too:
 *
 *   | smoke | on |
 *   |---|---|
 *   | Online, with its OS name and major version and its agent versions, and in MDM where the lab enrolled it | every OS (ChromeOS: the name only, and the extension as its agent) |
 *   | Its page shows the vitals Fleet reads of the machine (disk, memory, model, IP, MAC) and its local users | every OS (ChromeOS: memory and model) |
 *   | It is in the built-in label of its platform | every OS |
 *   | The inventory lists a package known to be on it, as its package type | every OS (ChromeOS: the fleetd extension) |
 *   | A live report comes back with the host's own platform, and finds Fleet Desktop running | every OS; the fleetd extension on ChromeOS |
 *   | A script runs and its output comes back | every VM |
 *   | Vulnerabilities are listed for the OS | Ubuntu 24.04 |
 *   | Its page is a Chromebook's: disk encryption always on, the extension's agent options, its Chrome profile, no Reports tab, no script | ChromeOS |
 *   | It answers a passing and a failing policy, and its Policies tab shows both | ChromeOS |
 *
 * Premium's smokes (`tests/e2e/premium/matrix/os-smokes.spec.ts`) also install
 * a custom package and run a policy's automation: both are premium features,
 * so free has neither. The checks themselves, and what Fleet shows for each OS,
 * are `helpers/os-smokes.ts`'s; that file's header says what a ChromeOS host
 * is and isn't asked. On free a host has no fleet, so the Fleet vital and the
 * fleet dropdown aren't read, and its Software tab is the inventory, with no
 * Library beside it (`HostDetailsPage.openInventory`).
 *
 * In the `free-matrix` project: its own invocation after the main project and
 * the exclusive specs (`npm run test:free:matrix`; in CI a step of free's job
 * after those two), since it works the same VMs.
 *
 * **A host that can't be used is one red row, not one per smoke.** The first
 * smoke of an OS fails with what is wrong with its host (offline, not
 * enrolled) and the rest skip, naming it. The ChromeOS host is offline while
 * nobody is signed in to it, which only the lab's owner can fix.
 *
 * **One host, one worker.** A VM works one queue of scripts, so each OS's
 * smokes run in order in one worker (`mode: 'default'`), and the hosts run
 * beside each other.
 *
 * **What it touches.** The VMs sit in Unassigned, which free's whole library
 * shares: a script nothing runs until the test asks its own host to, a global
 * report with no schedule, run live on the test's host only, and ChromeOS's
 * two global policies, which are for ChromeOS alone and so are sent to no
 * other host. Each is named `pw-os-smoke-*`, registered with `cleanup` the
 * moment it exists, and swept by the cleanup's Unassigned and global steps
 * after a killed run.
 */
import { test, HOST_RETRIES } from '@fixtures';
import {
  GATE,
  isChromebook,
  liveReportTitle,
  requireLinuxSubjects,
  smoke,
  smokeDetails,
  smokeSubjects,
  takesScripts,
  type Subject,
} from '@helpers/os-smokes';

/** The OS versions Fleet matches vulnerabilities to, of free's: Ubuntu's kernels, from the vendor's data. */
const OS_WITH_VULNERABILITIES = ['ubuntu-24.04'];

const SUBJECTS = smokeSubjects();
requireLinuxSubjects(SUBJECTS, OS_WITH_VULNERABILITIES, 'the vulnerabilities smoke');

/** The smokes of one OS version, in one worker, in this order. */
function smokesOf(subject: Subject): void {
  const liveReport = liveReportTitle(subject);

  test.describe(subject.title, smokeDetails(subject), () => {
    test.describe.configure({ mode: 'default', retries: HOST_RETRIES });

    test(GATE, ({ hostDetails, request }) => smoke.gate({ hostDetails, request }, subject));

    test('shows its vitals and its local users', ({ hostDetails, request }) =>
      smoke.vitalsAndUsers({ hostDetails, request }, subject));

    test('is in the built-in label of its platform', ({ hostsList, request }) =>
      smoke.platformLabel({ hostsList, request }, subject));

    test('lists a package known to be on it in its software inventory', ({ hostDetails, request }) =>
      smoke.knownPackage({ hostDetails, request }, subject));

    test(liveReport, ({ hostDetails, reportEdit, reportLive, seed, request, page }) =>
      smoke.liveReport({ hostDetails, reportEdit, reportLive, seed, request, page }, subject));

    if (takesScripts(subject)) {
      test('runs a script, and its output comes back', ({ hostDetails, seed, request }) =>
        smoke.script({ hostDetails, seed, request }, subject));
    }

    if (OS_WITH_VULNERABILITIES.includes(subject.os)) {
      test('has vulnerabilities listed for its OS', ({ softwareOs, softwareOsDetail, softwareTitles, request }) =>
        smoke.osVulnerabilities({ softwareOs, softwareOsDetail, softwareTitles, request }, subject));
    }

    if (isChromebook(subject)) {
      test("shows a Chromebook's page: disk encryption always on, the extension's agent options, its Chrome profile, no reports or scripts", ({
        hostDetails,
        request,
      }) => smoke.chromebookPage({ hostDetails, request }, subject));

      test('answers a passing and a failing policy, and its Policies tab shows both', ({ hostDetails, seed, request }) =>
        smoke.policies({ hostDetails, seed, request }, subject));
    }
  });
}

test.describe('Free • OS smoke', () => {
  for (const subject of SUBJECTS) smokesOf(subject);
});
