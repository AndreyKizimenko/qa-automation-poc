/**
 * Premium • OS smoke • the same few checks on every OS version the lab holds.
 *
 * One describe per OS version in `lab-hosts.json`: the **matrix** host of each
 * OS flavour, on the OS matrix fleet, a **pool** VM of each OS version the
 * pool holds, on the VMs fleet, and the **ChromeOS** host, on OS matrix. The
 * main suite hands a real-host test whichever pool VM its worker holds, so
 * which macOS a test met last night is chance, and the flavours outside the
 * pool it never meets. Here every version gets the same checks every night:
 *
 *   | smoke | on |
 *   |---|---|
 *   | Online on its fleet, with its OS name and major version and its agent versions, and in MDM where the lab enrolled it | every OS (ChromeOS: the name only, and the extension as its agent) |
 *   | Its page shows the vitals Fleet reads of the machine (disk, memory, model, IP, MAC) and its local users | every OS (ChromeOS: memory and model) |
 *   | It is in the built-in label of its platform | every OS |
 *   | The inventory lists a package known to be on it, as its package type | every OS (ChromeOS: the fleetd extension) |
 *   | A live report comes back with the host's own platform, and finds Fleet Desktop running | every OS; Fleet Desktop on VMs with a desktop, the fleetd extension on ChromeOS |
 *   | A script runs and its output comes back | every VM |
 *   | A script that exits 3 reads as an error: "Error", its exit code, its output and fleetd's line about it, also from the host's Activity card | every VM |
 *   | Its My device page opens from Host details on Details; every value on it, and its Software count, equal Host details'; the tier's tabs (premium: Details, Software and Policies), and the known package on its Software tab | every VM with Fleet Desktop |
 *   | A CVE Fleet matched to the host's software, searched for on My device's Software tab, finds that title, and its row shows the CVE (or how many it has); a host with nothing matched skips, saying so | every VM with Fleet Desktop |
 *   | Vulnerabilities are listed for the OS | the Ubuntu LTS versions, RHEL 9 and 10 |
 *   | Its page is a Chromebook's: disk encryption always on, the extension's agent options, its Chrome profile, no Reports tab, no script | ChromeOS |
 *   | It answers a passing and a failing policy, and its Policies tab shows both | ChromeOS |
 *   | A custom package installs and the inventory lists it; it uninstalls and the inventory drops it | every VM (a tarball has no inventory) |
 *   | A policy's automation installs a package on a host that fails it | one `.deb` host, one `.rpm` host |
 *   | It runs fleetd's edge build; on a fleet that pins the release before it, fleetd goes back to that release, runs a script and Fleet shows it; back on its own fleet it returns to edge | a pool VM of each version |
 *   | fleetd, killed, is started again by its service manager; a script runs under the new process, and the host stays enrolled and online | every VM |
 *
 * Premium only, in the `premium-matrix` project: its own invocation after the
 * main project (`npm run test:premium:matrix`), since it works the pool's VMs
 * too. Free's lab hosts get the checks free has in
 * `tests/e2e/free/matrix/os-smokes.spec.ts`; everything but the two install rows
 * and fleetd's downgrade, which are premium's (free takes no `update_channels`).
 * The checks both tiers make, and what Fleet shows for each OS, are
 * `helpers/os-smokes.ts`'s, so a rename in Fleet's UI is one edit; this file
 * declares the tests and keeps what only premium does.
 *
 * **fleetd's downgrade moves a pool VM off its fleet for one test** (approved by
 * Andrey 2026-11-19, the downgrade check of fleetd's release QA). Premium's lab
 * fleets run fleetd's edge build. The test moves the VM onto a throwaway `pw-*`
 * fleet whose `update_channels` pin orbit and Fleet Desktop to the release
 * before edge, waits until fleetd runs it, runs a script under it, and has Fleet
 * show it after a detail refresh. Then it moves the VM back and waits for edge
 * again (`helpers/fleetd-releases.ts`). A test that dies leaves the VM on
 * Unassigned at worst, where fleetd keeps the pinned release, since Fleet sends
 * no channels for a fleet that declares none. The cleanup's return of each lab
 * host to its fleet then brings it back to edge.
 *
 * **Asked for by `os`, never by name or id.** A matrix or ChromeOS host is the
 * manifest's entry for its `os`; a pool version is the worker's own VM of that
 * version (`requireRealHost(…, { os })`). What each smoke expects of an OS
 * comes from the entry (`fleet_platform`, `package`, `package_manager`,
 * `desktop`) and from the helper's `REPORTED_OS`; a flavour the lab adds fails
 * this file at load until it has a row there.
 *
 * **Only the name and major version of the OS are asserted.** Fleet builds a
 * Linux version from `os-release`'s `VERSION_ID` (`parseOSVersion`,
 * `server/service/osquery_utils/queries.go`), which several distributions keep
 * at the major version: Zorin OS 18.1 reads "Zorin OS 18.0.0", Amazon Linux
 * 2023.12 "Amazon Linux 2023.0.0", Debian 13.7 "Debian GNU/Linux 13.0.0".
 * Kubuntu is Ubuntu to `os-release`, and so to Fleet. ChromeOS's version is
 * Chrome's, which moves every few weeks, so there only the name is held.
 *
 * **ChromeOS is the fleetd Chrome extension**, which runs no script, installs
 * nothing and has no MDM: its host gets the checks that need none of those,
 * and two of its own (the helper's header says what the lab's developer-form
 * extension can't report).
 *
 * **A host that can't be used is one red row, not one per smoke.** The first smoke of
 * an OS fails with what is wrong with its host (`labHostProblem`: offline, on
 * another fleet, not enrolled) and the rest skip, naming it. A ChromeOS host
 * is offline while nobody is signed in to it: the extension runs only in the
 * signed-in session, and only the lab's owner can sign in again.
 *
 * **One host, one worker.** A host works one queue of scripts and installs, so
 * each OS's smokes run in order in one worker (`mode: 'default'`), and the OS
 * versions run beside each other. The Windows matrix hosts are one group more:
 * Fleet names an `.msi`'s title after the product inside it and a fleet holds
 * one installer per title, so the three of them take turns with the one
 * `fleet-playwright-smoke-1.0.0.msi`. A `.deb`, an `.rpm` and a tarball are
 * built per test under a name of their own (`helpers/deb.ts`, `rpm.ts`,
 * `tarball.ts`), so the Linux hosts need no such turn.
 *
 * **What installs.**
 *
 *   | host | package | scripts |
 *   |---|---|---|
 *   | `.deb` host | `fleet-pw-os-smoke-*_1.0.0_all.deb`, built per test | Fleet's own (`apt-get`) |
 *   | `.rpm` host | `fleet-pw-os-smoke-*-1.0.0-1.noarch.rpm`, built per test | Fleet's own (`dnf`) |
 *   | openSUSE | the same `.rpm` | `zypper`, given here: openSUSE has no `dnf`, which Fleet's own call (fleetdm/fleet#58784) |
 *   | Omarchy (Arch) | `fleet-pw-os-smoke-*.tar.gz`, built per test (its title is the file name, extension and all) | given here, as a tarball needs: Fleet takes no `.pkg.tar.zst` |
 *   | Windows matrix host | `fleet-playwright-smoke-1.0.0.msi` (`make-msi.sh smoke`) | Fleet's own |
 *   | Windows and macOS pool VM | the VMs fleet's durable fixture (`helpers/vm-fixtures.ts`), left uninstalled | Fleet's own |
 *   | ChromeOS | nothing | none |
 *
 * Every one of them is inert: a marker file in a directory of its own, removed
 * with the package (each fixture's README, and the helpers' headers, say how
 * that was checked).
 *
 * **An install and an uninstall are each followed into the inventory.** Fleet
 * marks either done when its script exits 0, which says the OS's package
 * manager took the package and gave it back. What the host then reports is a
 * second path, and the one that differs most by flavour: the inventory is read
 * from `deb_packages`, `rpm_packages`, Windows' programs or macOS' apps. So
 * after the install the package has to appear in the host's inventory, with
 * its version in the Library row, and after the uninstall it has to be gone
 * from both. Each wait rides the refetch Fleet asks for itself when an install
 * or uninstall succeeds (`waitForInventoryToFollow`): one collection a half.
 * A tarball is no inventory source, so Omarchy's stops at the status.
 *
 * **Nothing here reaches a host it wasn't aimed at.** OS matrix is declared
 * empty in gitops, and this spec is the one thing that puts anything on it,
 * for the length of a test: a library script and a package nothing installs
 * until this test asks its own host to, a policy held to the test's host by a
 * manual label holding only it, and ChromeOS's two policies, which are for
 * ChromeOS alone and so are sent to no other host there. Never a package with
 * automatic install, a profile, an OS-update or disk-encryption setting, or
 * agent options: each of those is the fleet's, and every host on it would get
 * it. The report the live-report smoke runs is global, with no schedule, so it
 * runs only where the live run targets it.
 *
 * **What it leaves, and who removes it.** Nothing: each test registers the undo
 * of what it made with `cleanup` the moment it exists (a title is uninstalled
 * from its host if the test stopped between install and uninstall, then
 * deleted). Everything is named `pw-os-smoke-*` or `fleet-pw-os-smoke-*`, plus
 * the one `.msi`, and the cleanup's OS matrix step sweeps what a killed run
 * left, on the fleet and on its hosts (`setup/cleanup.steps.ts`).
 *
 * Grounded in: the helper's sources, plus `HostSoftwareLibrary`,
 * `pkg/file/scripts/` (Fleet's install and uninstall scripts per package type)
 * and `server/service/orbit.go` (the refetch Fleet queues after an install or
 * an uninstall succeeds).
 */
import * as fs from 'fs';
import * as path from 'path';
import type { APIRequestContext } from '@playwright/test';
import { test, expect, HOST_RETRIES, type Cleanup } from '@fixtures';
import { activityCopy } from '@helpers/activity-copy';
import {
  createFleetPolicy,
  deleteFleetPolicies,
  deleteSoftwareTitle,
  getAgentOptions,
  getHostCollectedAt,
  getHostSoftwareState,
  lastSoftwareActionOutput,
  listHostActivities,
  runAdHocScript,
  setAgentOptions,
  transferHosts,
  uninstallSoftwareOnHost,
  uploadSoftwarePackageBuffer,
  waitForHostRefetch,
  waitForHostSoftwareStatus,
  waitForInventoryToFollow,
  waitForNoPendingRefetch,
  type HostSoftwareStatus,
  type PackageScripts,
} from '@helpers/api';
import { inertDeb } from '@helpers/deb';
import { fleetdOnHost, fleetdReleases } from '@helpers/fleetd-releases';
import { isVmLabHost, type LabHost } from '@helpers/lab-hosts';
import {
  GATE,
  isChromebook,
  liveReportTitle,
  requireLinuxSubjects,
  smoke,
  smokeDetails,
  smokeSubjects,
  takesScripts,
  hasMyDevice,
  hostOf,
  type SmokeHost,
  type Subject,
} from '@helpers/os-smokes';
import { ownName } from '@helpers/own-name';
import { inertRpm } from '@helpers/rpm';
import { inertTarball, TARBALL_MARKER } from '@helpers/tarball';
import {
  OS_SMOKE_MSI,
  VM_SOFTWARE_FIXTURES,
  ensureVmFixtureUninstalled,
  findVmFixtureTitle,
} from '@helpers/vm-fixtures';

/** The OS versions Fleet matches vulnerabilities to: Ubuntu's and Red Hat's kernels, from the vendors' data. */
const OS_WITH_VULNERABILITIES = ['ubuntu-22.04', 'ubuntu-24.04', 'ubuntu-26.04', 'rhel-9', 'rhel-10'];

/** One `.deb` host and one `.rpm` host for the policy automation: neither is Ubuntu, which the pool's specs cover. */
const OS_WITH_POLICY_INSTALL = ['debian-13', 'rhel-9'];

/** The Windows matrix hosts' package (`OS_SMOKE_MSI`, which the cleanup's sweep knows by the same name). */
const SMOKE_MSI_PATH = path.resolve(__dirname, '../../../../test-data/windows/software', OS_SMOKE_MSI.packageName);

/**
 * Where the tarball's scripts put its marker. One fixed place rather than one
 * per run: a tarball is no inventory source, so nothing could find a per-run
 * directory a killed run left, while this one the next install overwrites and
 * the next uninstall removes.
 */
const TARBALL_DIR = '/usr/share/fleet-pw-os-smoke';

const SUBJECTS = smokeSubjects();
requireLinuxSubjects(SUBJECTS, OS_WITH_VULNERABILITIES, 'the vulnerabilities smoke');
requireLinuxSubjects(SUBJECTS, OS_WITH_POLICY_INSTALL, "the policy automation's install");

/** The fleet a premium smoke host sits on: every one sits on a fleet. */
function fleetIdOf(host: SmokeHost): number {
  if (host.fleetId === undefined) throw new Error(`[os-smokes] ${host.displayName} is on no fleet, which no premium lab host is`);
  return host.fleetId;
}

/** A package for one test to install on its host. */
interface SmokePackage {
  titleId: number;
  /**
   * The title, as the Library and the host's activities name it: the package's
   * own name for a `.deb` or an `.rpm`, the product's for an `.msi`, the file
   * name, extension and all, for a tarball.
   */
  title: string;
  /** The installer's file name. */
  fileName: string;
  /** Whether the host's inventory lists it once installed. A tarball is no inventory source. */
  inventoried: boolean;
  /** For a pool VM's durable fixture: sees it through to rest, inventory included. */
  rest?: () => Promise<void>;
}

/** What a test uploads for a host of a package type, under a name of its own where the type lets it have one. */
function perRunPackage(entry: LabHost): { fileName: string; buffer: Buffer; scripts?: PackageScripts } {
  const name = `fleet-${ownName('os-smoke')}`;
  switch (entry.package) {
    case 'deb':
      return { fileName: `${name}_1.0.0_all.deb`, buffer: inertDeb(name, '1.0.0') };
    case 'rpm':
      return {
        fileName: `${name}-1.0.0-1.noarch.rpm`,
        buffer: inertRpm(name, '1.0.0'),
        // TODO(fleetdm/fleet#58784): Fleet's own scripts for an .rpm call dnf,
        // which openSUSE doesn't have, so its install fails with them. A host
        // that installs with zypper gets the same two steps in its words; the
        // package is unsigned, which zypper has to be told to accept.
        scripts:
          entry.packageManager === 'zypper'
            ? {
                installScript: '#!/bin/sh\nzypper --non-interactive install --allow-unsigned-rpm "$INSTALLER_PATH"\n',
                uninstallScript: `#!/bin/sh\nzypper --non-interactive remove ${name}\n`,
              }
            : undefined,
      };
    case 'pkg.tar.zst':
      // fleetd unpacks the tarball into the directory $INSTALLER_PATH names.
      return {
        fileName: `${name}.tar.gz`,
        buffer: inertTarball(`fleet playwright fixture ${name}\n`),
        scripts: {
          installScript: `#!/bin/sh\nset -e\nmkdir -p ${TARBALL_DIR}\ncp "$INSTALLER_PATH/${TARBALL_MARKER}" ${TARBALL_DIR}/${TARBALL_MARKER}\n`,
          uninstallScript: `#!/bin/sh\nset -e\nrm -f ${TARBALL_DIR}/${TARBALL_MARKER}\nrmdir ${TARBALL_DIR}\n`,
        },
      };
    case 'msi':
      return { fileName: OS_SMOKE_MSI.packageName, buffer: fs.readFileSync(SMOKE_MSI_PATH) };
    default:
      throw new Error(`[os-smokes] no per-run package for a ${entry.package} host (${entry.name}): build one, or give its fleet a durable fixture`);
  }
}

/**
 * Uninstalls a title from the host if the test stopped with it installed. It
 * goes by the install's status, not by the inventory: right after the test's
 * own uninstall the inventory can still list the package, and a second
 * uninstall would fail on a package that is gone. The wait stays inside the
 * `cleanup` fixture's own budget.
 */
async function uninstallIfLeftInstalled(request: APIRequestContext, host: SmokeHost, titleId: number): Promise<void> {
  if ((await getHostSoftwareState(request, host.id, titleId))?.status !== 'installed') return;
  await uninstallSoftwareOnHost(request, host.id, titleId);
  await waitForHostSoftwareStatus(request, host.id, titleId, null, 100_000);
}

/**
 * Puts a package of the host's own on its fleet for this test, registered for
 * removal. Nothing installs it until the test asks its host to.
 */
async function addPerRunPackage(
  request: APIRequestContext,
  cleanup: Cleanup,
  host: SmokeHost,
  entry: LabHost,
): Promise<SmokePackage> {
  const fleetId = fleetIdOf(host);
  const built = perRunPackage(entry);
  const { titleId, name: title } = await uploadSoftwarePackageBuffer(
    request,
    fleetId,
    built.fileName,
    built.buffer,
    built.scripts,
  );
  cleanup.add(`take ${built.fileName} off ${host.displayName} and off ${host.fleetName}`, async (r) => {
    await uninstallIfLeftInstalled(r, host, titleId);
    await deleteSoftwareTitle(r, fleetId, titleId);
  });
  // The .msi keeps its name from run to run, so one a killed run left installed
  // would read as installed here. A no-op otherwise: one read of the host.
  if (entry.package === 'msi') {
    await ensureVmFixtureUninstalled(request, host.id, { titleId, name: title, packageName: built.fileName });
  }
  return { titleId, title, fileName: built.fileName, inventoried: entry.package !== 'pkg.tar.zst' };
}

/**
 * The package a pool VM installs: the VMs fleet's durable fixture of its
 * package type, at rest before the test. The test returns it to rest itself
 * (`rest`), within its own budget.
 */
async function durablePackage(
  request: APIRequestContext,
  cleanup: Cleanup,
  host: SmokeHost,
  entry: LabHost,
): Promise<SmokePackage> {
  const fixture = VM_SOFTWARE_FIXTURES.find(
    (f) => f.platform === entry.platform && f.packageName?.endsWith(`.${entry.package}`),
  );
  if (!fixture) throw new Error(`[os-smokes] the VMs fleet keeps no .${entry.package} fixture for ${entry.platform} (helpers/vm-fixtures.ts)`);
  const title = await findVmFixtureTitle(request, fleetIdOf(host), fixture);
  await ensureVmFixtureUninstalled(request, host.id, title);
  // What a test that stops halfway can still do inside the fixture's budget;
  // the cleanup's resting-state step sees to the inventory.
  cleanup.add(`uninstall ${title.packageName} from ${host.displayName} if it was left installed`, (r) =>
    uninstallIfLeftInstalled(r, host, title.titleId),
  );
  return {
    titleId: title.titleId,
    title: title.name,
    fileName: title.packageName,
    inventoried: true,
    rest: () => ensureVmFixtureUninstalled(request, host.id, title),
  };
}

/**
 * Waits for the host's install or uninstall of a package to end, and fails with
 * what the host printed when it ends failed. Fleet has made its retries by
 * then, and the reason is the host's (its package manager busy or locked, a
 * dependency, a refused package): a longer wait changes nothing, and the red
 * row should say it.
 *
 * A failed status counts once it has been read twice, five seconds apart.
 * Fleet records a failed attempt and queues its retry in two writes of one
 * request, so a single read between them shows a failure that is about to
 * become pending again.
 */
async function waitForPackage(
  request: APIRequestContext,
  host: SmokeHost,
  pkg: SmokePackage,
  action: 'install' | 'uninstall',
  timeout = 300_000,
): Promise<void> {
  const done: HostSoftwareStatus = action === 'install' ? 'installed' : null;
  const failed: HostSoftwareStatus = action === 'install' ? 'failed_install' : 'failed_uninstall';
  let status: HostSoftwareStatus | undefined;
  let failedReads = 0;
  await expect
    .poll(
      async () => {
        status = (await getHostSoftwareState(request, host.id, pkg.titleId))?.status;
        failedReads = status === failed ? failedReads + 1 : 0;
        return status === done || failedReads >= 2;
      },
      { message: `the ${action} of ${pkg.title} on ${host.displayName} never ended`, timeout, intervals: [5_000] },
    )
    .toBe(true);
  if (status !== failed) return;
  const output = (await lastSoftwareActionOutput(request, host.id, pkg.title, action)).trim();
  throw new Error(
    `${host.displayName} failed to ${action} ${pkg.title} (${pkg.fileName}). What the host printed last:\n` +
      (output.slice(-1200) || '(nothing on record)'),
  );
}

/** When the host's newest uninstall of `title` was recorded, or 0. */
async function lastUninstalledAt(request: APIRequestContext, hostId: number, title: string): Promise<number> {
  const uninstall = (await listHostActivities(request, hostId)).find(
    (a) => a.type === 'uninstalled_software' && a.details.software_title === title,
  );
  return uninstall ? Date.parse(uninstall.createdAt) : 0;
}

/** The smokes of one OS version, in one worker, in this order. */
function smokesOf(subject: Subject): void {
  const { os, entry } = subject;
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

      test('runs a failing script, which reads as an error, here and in its Activity', ({ hostDetails, seed, request }) =>
        smoke.failingScript({ hostDetails, seed, request }, subject));
    }

    if (hasMyDevice(subject)) {
      test("opens its My device page from Host details, which shows what the admin sees, the tier's tabs and its software", ({ hostDetails, request }) =>
        smoke.myDevice({ hostDetails, request }, subject, { shown: ['Details', 'Software', 'Policies'], absent: [] }));

      test('lists its vulnerable software on My device, found by a CVE', ({ hostDetails, request }) =>
        smoke.myDeviceVulnerabilities({ hostDetails, request }, subject));
    }

    if (OS_WITH_VULNERABILITIES.includes(os)) {
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

    if (isVmLabHost(entry)) {
      test('installs a custom package and uninstalls it again, and its inventory follows both', async ({
        hostDetails,
        cleanup,
        request,
      }) => {
        // Two actions on the host's queue, each picked up at its next check-in and
        // each followed by a collection; a pool VM's fixture is also brought to
        // rest before and after.
        test.setTimeout(900_000);
        const host = await hostOf(request, subject);
        const pkg =
          entry.role === 'pool' && entry.platform !== 'linux'
            ? await durablePackage(request, cleanup, host, entry)
            : await addPerRunPackage(request, cleanup, host, entry);
        const library = hostDetails.library;
        const offered = await getHostSoftwareState(request, host.id, pkg.titleId);
        expect(offered, `${pkg.title} isn't offered to ${host.displayName}`).not.toBeNull();
        // What the Library row has to show once the host reports the package. A
        // tarball carries no version, and its row is never read for one.
        const version = offered!.libraryVersion;
        if (pkg.inventoried) expect(version, `the Library gives ${pkg.title} no version`).toBeTruthy();

        await test.step('install it from the Library, and the inventory lists it', async () => {
          await hostDetails.goto(host.id);
          await hostDetails.openLibrary(pkg.title);
          await library.install(pkg.title);
          expect((await getHostSoftwareState(request, host.id, pkg.titleId))?.status).toBe('pending_install');
          await waitForPackage(request, host, pkg, 'install');

          await hostDetails.goto(host.id);
          await hostDetails.openLibrary(pkg.title);
          await library.statusButton(pkg.title, 'Installed').click();
          const details = hostDetails.installDetailsModal;
          await details.expectOpen();
          await expect(details.statusMessage).toContainText(
            `installed ${pkg.title} (${pkg.fileName}) on ${host.displayName}`,
          );
          await details.close();
          if (!pkg.inventoried) return;

          await waitForInventoryToFollow(request, host.id, pkg.titleId, 'listed');
          await hostDetails.goto(host.id);
          await hostDetails.openLibrary(pkg.title);
          await expect(await library.installedVersion(pkg.title)).toHaveText(version!);
          await hostDetails.goto(host.id);
          await hostDetails.openInventory(pkg.title);
          await expect(hostDetails.softwareNameLink(pkg.title)).toBeVisible();
        });

        await test.step('uninstall it from the Library, and the inventory drops it', async () => {
          // A title that keeps its name from run to run (the .msi, a durable
          // fixture) has earlier uninstalls on record, which read the same.
          const before = await lastUninstalledAt(request, host.id, pkg.title);
          await hostDetails.goto(host.id);
          await hostDetails.openLibrary(pkg.title);
          await library.uninstall(pkg.title);
          expect((await getHostSoftwareState(request, host.id, pkg.titleId))?.status).toBe('pending_uninstall');
          await waitForPackage(request, host, pkg, 'uninstall');
          expect(
            await lastUninstalledAt(request, host.id, pkg.title),
            'this uninstall recorded no activity of its own',
          ).toBeGreaterThan(before);

          await hostDetails.goto(host.id);
          await hostDetails.showPastActivities();
          await hostDetails.activityItem(activityCopy.hostSoftware.uninstalled({ title: pkg.title })).first().click();
          const details = hostDetails.uninstallDetailsModal;
          await details.expectOpen();
          await expect(details.statusMessage).toContainText(`uninstalled ${pkg.title} from ${host.displayName}`);
          await details.close();
          if (!pkg.inventoried) return;

          await waitForInventoryToFollow(request, host.id, pkg.titleId, 'gone');
          await hostDetails.goto(host.id);
          await hostDetails.openLibrary(pkg.title);
          await expect(await library.installedVersion(pkg.title)).toHaveText('---');
          await expect(library.installAction(pkg.title, 'Install')).toBeVisible();
          await expect(library.uninstallAction(pkg.title)).toHaveCount(0);
          await hostDetails.goto(host.id);
          await hostDetails.openInventory(pkg.title);
          await expect(hostDetails.softwareEmptyState).toBeVisible();
          await expect(hostDetails.softwareNameLink(pkg.title)).toHaveCount(0);
        });

        // Only a durable fixture has one: the fleet keeps it, and the next spec
        // to install it expects the host's inventory to agree it is gone.
        await pkg.rest?.();
      });
    }

    if (OS_WITH_POLICY_INSTALL.includes(os)) {
      test("a policy's automation installs a package on it", async ({ hostDetails, seed, cleanup, request }) => {
        // A policy run (a refetch brings one), the install it queues, and the
        // uninstall that takes the package off again.
        test.setTimeout(900_000);
        const host = await hostOf(request, subject);
        const fleetId = fleetIdOf(host);
        // The policy is the fleet's: the label is what holds it to this host.
        const label = await seed.label('os-smoke-auto', [host.id]);
        const pkg = await addPerRunPackage(request, cleanup, host, entry);
        const policy = await createFleetPolicy(request, fleetId, {
          name: ownName('os-smoke-auto'),
          // Fails while the package isn't on the host, which is when Fleet installs it.
          query: `SELECT 1 FROM ${entry.package}_packages WHERE name = '${pkg.title}';`,
          platform: 'linux',
          labels_include_any: [label.name],
          automation_type: 'software',
          software_title_id: pkg.titleId,
        });
        // Registered last, so undone first: Fleet won't delete a title a policy installs.
        cleanup.add(`delete policy ${policy.name}`, (r) => deleteFleetPolicies(r, fleetId, [policy.id]));
        expect(policy.installSoftwareTitleId).toBe(pkg.titleId);

        // A collection already under way was sent before the policy existed.
        await waitForNoPendingRefetch(request, host.id);
        const since = await getHostCollectedAt(request, host.id, 'policy_updated_at');
        await waitForHostRefetch(request, host.id, { since, field: 'policy_updated_at', refetch: true });
        await waitForPackage(request, host, pkg, 'install', 420_000);

        const install = (await listHostActivities(request, host.id)).find(
          (a) => a.type === 'installed_software' && a.details.software_title === pkg.title,
        );
        expect(install?.details.policy_id, 'the install is the policy automation\'s').toBe(policy.id);

        await hostDetails.goto(host.id);
        await hostDetails.showPastActivities();
        const activity = hostDetails.activityItem(activityCopy.hostSoftware.installed({ title: pkg.title })).first();
        await expect(activity).toBeVisible();
        await expect(activity).toHaveAccessibleName(/^Fleet installed/);
      });
    }
    if (entry.role === 'pool' && isVmLabHost(entry)) {
      test("runs fleetd's edge build, goes back a release when its fleet pins one, and returns", async ({
        hostDetails,
        throwawayFleet,
        cleanup,
        request,
      }) => {
        // Two restarts of fleetd, each with its download, a script, and a detail refresh.
        test.setTimeout(900_000);
        const host = await hostOf(request, subject, false, { exclude: FLEETD_NOT_UPDATING });
        const home = host.fleetId!;
        const { edge, previous } = await fleetdReleases(request, entry.platform);
        // A headless host has no Fleet Desktop to ask.
        const desktop = entry.desktop !== 'none';
        // fleetd restarts more than once on a channel change (orbit, then the components it updates), and
        // between restarts osquery can be up before fleetd's extension has registered `orbit_info`: a read
        // that fails then is "not there yet", and the poll asks again.
        const running = async (): Promise<string> => {
          const fleetd = await fleetdOnHost(request, host.id).catch(() => null);
          if (!fleetd) return 'fleetd unreadable';
          return desktop ? `orbit ${fleetd.orbit}, Fleet Desktop ${fleetd.desktop}` : `orbit ${fleetd.orbit}`;
        };
        const runs = async (version: string): Promise<void> => {
          await expect
            .poll(running, {
              message: `fleetd on ${host.displayName} never ran ${version}`,
              timeout: 420_000,
              intervals: [10_000],
            })
            .toBe(desktop ? `orbit ${version}, Fleet Desktop ${version}` : `orbit ${version}`);
        };

        const atStart = await fleetdOnHost(request, host.id);

        await test.step(`it runs fleetd's edge build, ${edge}, which its fleet declares`, async () => {
          expect(atStart.orbit, `${host.displayName} isn't on edge's build`).toBe(edge);
          expect(atStart.channel).toBe('edge');
          if (desktop) expect(atStart.desktop, 'Fleet Desktop').toBe(edge);
        });

        const fleet = await throwawayFleet('fleetd-pin');
        // A new fleet takes the global agent options, which name no channel.
        await setAgentOptions(
          request,
          { ...(await getAgentOptions(request, fleet.id)), update_channels: { orbit: previous, osqueryd: 'edge', desktop: previous } },
          fleet.id,
        );
        // Registered after the fleet, so undone before its delete, which would leave the host on Unassigned.
        cleanup.add(`return ${host.displayName} to its fleet`, (r) => transferHosts(r, home, [host.id]));

        await test.step(`on a fleet that pins ${previous}, fleetd goes back to it and runs a script`, async () => {
          await transferHosts(request, fleet.id, [host.id]);
          await runs(previous);
          const windows = entry.platform === 'windows';
          const { exitCode, output } = await runAdHocScript(request, host.id, windows ? 'Write-Output "fleetd $env:COMPUTERNAME"\n' : '#!/bin/sh\necho "fleetd $(uname -n)"\n');
          expect(exitCode, output).toBe(0);
          expect(output.toLowerCase()).toContain(`fleetd ${host.displayName.toLowerCase().split('.')[0]}`);
        });

        await test.step(`Fleet shows ${previous} on the host's page, online`, async () => {
          await waitForNoPendingRefetch(request, host.id);
          const since = await getHostCollectedAt(request, host.id, 'detail_updated_at');
          await waitForHostRefetch(request, host.id, { since, refetch: true });
          await hostDetails.goto(host.id);
          await expect(hostDetails.vitals.value('Status')).toContainText('Online');
          await expect(hostDetails.vitals.value('Agent')).toContainText(previous);
        });

        await test.step(`back on its own fleet, fleetd returns to ${edge}`, async () => {
          await transferHosts(request, home, [host.id]);
          await runs(edge);
        });
      });
    }

    if (takesScripts(subject)) {
      // Last: the restart is this host's alone, and no smoke after it meets it.
      test('fleetd comes back by itself after it is killed, and the host stays enrolled', ({ hostDetails, request }) =>
        smoke.selfHealing({ hostDetails, request }, subject));
    }
  });
}

/**
 * Pool hosts the fleetd downgrade leaves out: a host it can't downgrade, because its fleetd takes no update.
 * Another VM of the same version runs it instead.
 *
 * TODO(fleetdm/fleet#59221): `prem-win11-02`'s fleetd holds a timestamp whose snapshot it never fetched, so it
 * takes no update and stays on 1.63.0 until Fleet's update server publishes a newer timestamp. Remove it once
 * #59221 is fixed, or once the host has run edge's build for a few nights.
 */
const FLEETD_NOT_UPDATING: readonly string[] = ['prem-win11-02'];

/** A fixed-title package (the `.msi`) on a fleet shared with others of its kind: these take turns. */
const takesTurns = ({ entry }: Subject): boolean => entry.role === 'matrix' && entry.package === 'msi';

test.describe('Premium • OS smoke', () => {
  // Declared first, so a worker starts on it with the run: three hosts in turn
  // are the longest thing here, and what the run's length comes down to once
  // there are workers enough for the other OS versions.
  test.describe('the Windows matrix hosts, in turn', () => {
    test.describe.configure({ mode: 'default' });
    for (const subject of SUBJECTS.filter(takesTurns)) smokesOf(subject);
  });

  for (const subject of SUBJECTS.filter((s) => !takesTurns(s))) smokesOf(subject);
});
