/**
 * Premium • OS smoke • the same few checks on every OS version the lab holds.
 *
 * One describe per OS version in `lab-hosts.json`: the **matrix** host of each
 * OS flavour, on the OS matrix fleet, and a **pool** VM of each OS version the
 * pool holds, on the VMs fleet. The main suite hands a real-host test whichever
 * pool VM its worker holds, so which macOS a test met last night is chance, and
 * the flavours outside the pool it never meets. Here every version gets the
 * same checks every night:
 *
 *   | smoke | on |
 *   |---|---|
 *   | Online on its fleet, with its OS name and major version and its agent versions, and in MDM where the lab enrolled it | every OS |
 *   | Its page shows the vitals Fleet reads of the machine (disk, memory, model, IP, MAC) and its local users | every OS |
 *   | It is in the built-in label of its platform | every OS |
 *   | The inventory lists a package known to be on the host, as its package type | every OS |
 *   | A live report comes back with the host's own platform, and finds Fleet Desktop running | every OS; Fleet Desktop on hosts with a desktop |
 *   | A script runs and its output comes back | every OS |
 *   | Vulnerabilities are listed for the OS | the Ubuntu LTS versions, RHEL 9 and 10 |
 *   | A custom package installs and the inventory lists it; it uninstalls and the inventory drops it | every OS (a tarball has no inventory) |
 *   | A policy's automation installs a package on a host that fails it | one `.deb` host, one `.rpm` host |
 *
 * Premium only, in the `premium-matrix` project: its own invocation after the
 * main project (`npm run test:premium:matrix`), since it works the pool's VMs
 * too. Free has no counterpart because it has nothing to tell apart: one VM per
 * platform, which every real-host spec of the free suite already runs on.
 *
 * **Asked for by `os`, never by name or id.** A matrix host is the manifest's
 * entry for its `os`; a pool version is the worker's own VM of that version
 * (`requireRealHost(…, { os })`). What each smoke expects of an OS comes from
 * the entry (`fleet_platform`, `package`, `package_manager`, `desktop`) and
 * from `REPORTED_OS` below; a flavour the lab adds fails this file at load
 * until it has a row there.
 *
 * **Only the name and major version of the OS are asserted.** Fleet builds a
 * Linux version from `os-release`'s `VERSION_ID` (`parseOSVersion`,
 * `server/service/osquery_utils/queries.go`), which several distributions keep
 * at the major version: Zorin OS 18.1 reads "Zorin OS 18.0.0", Amazon Linux
 * 2023.12 "Amazon Linux 2023.0.0", Debian 13.7 "Debian GNU/Linux 13.0.0".
 * Kubuntu is Ubuntu to `os-release`, and so to Fleet.
 *
 * **A host that can't be used is one red row, not one per smoke.** The first smoke of
 * an OS fails with what is wrong with its host (`labHostProblem`: offline, on
 * another fleet, not enrolled) and the rest skip, naming it.
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
 * until this test asks its own host to, and, for the automation, a policy held
 * to the test's host by a manual label holding only it. Never a package with
 * automatic install, a profile, an OS-update or disk-encryption setting, or
 * agent options: each of those is the fleet's, and sixteen hosts would get it.
 * The report the live-report smoke runs is global, with no schedule, so it
 * runs only where the live run targets it.
 *
 * **What it leaves, and who removes it.** Nothing: each test registers the undo
 * of what it made with `cleanup` the moment it exists (a title is uninstalled
 * from its host if the test stopped between install and uninstall, then
 * deleted). Everything is named `pw-os-smoke-*` or `fleet-pw-os-smoke-*`, plus
 * the one `.msi`, and the cleanup's OS matrix step sweeps what a killed run
 * left, on the fleet and on its hosts (`setup/cleanup.steps.ts`).
 *
 * Grounded in: `Vitals.tsx` (the Agent tooltip, the vitals' titles),
 * `DiskSpaceIndicator.tsx`, `LocalUserAccounts.tsx`, `LabelFilterSelect.tsx`
 * (the Platforms group), the built-in labels' queries
 * (`server/datastore/mysql/migrations/data/`), `HostSoftwareLibrary`,
 * `RunScriptModal`, `SoftwareOSDetailsPage.tsx` (the Kernels card),
 * `pkg/file/scripts/` (Fleet's install and uninstall scripts per package type),
 * `server/service/orbit.go` (the refetch Fleet queues after an install or an
 * uninstall succeeds).
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
  getHostAgentReport,
  getHostCollectedAt,
  getHostScriptLastExecution,
  getHostSoftwareState,
  labHostProblem,
  listHostActivities,
  listLabHostRecords,
  newestRecord,
  recordVmOnReport,
  requireRealHost,
  uninstallSoftwareOnHost,
  uploadSoftwarePackageBuffer,
  vmTag,
  waitForHostRefetch,
  waitForHostSoftwareStatus,
  waitForInventoryToFollow,
  waitForNoPendingRefetch,
  type PackageScripts,
} from '@helpers/api';
import { inertDeb } from '@helpers/deb';
import {
  labHostFleet,
  labHostsOfRun,
  poolHostsOfRun,
  type LabHost,
  type LabPackage,
  type LabPlatform,
} from '@helpers/lab-hosts';
import { ownName } from '@helpers/own-name';
import { runNonce } from '@helpers/profiles';
import { inertRpm } from '@helpers/rpm';
import { inertTarball, TARBALL_MARKER } from '@helpers/tarball';
import {
  OS_SMOKE_MSI,
  VM_SOFTWARE_FIXTURES,
  ensureVmFixtureUninstalled,
  findVmFixtureTitle,
} from '@helpers/vm-fixtures';

/**
 * The OS name Fleet shows for each manifest `os`, and the major version the
 * smoke holds it to. An `os` the manifest has and this table doesn't fails the
 * file at load.
 */
const REPORTED_OS: Record<string, { name: string; major: string }> = {
  'ubuntu-22.04': { name: 'Ubuntu', major: '22.04' },
  'ubuntu-24.04': { name: 'Ubuntu', major: '24.04' },
  'ubuntu-24.04-server': { name: 'Ubuntu', major: '24.04' },
  'ubuntu-26.04': { name: 'Ubuntu', major: '26.04' },
  'kubuntu-24.04': { name: 'Ubuntu', major: '24.04' },
  'debian-13': { name: 'Debian GNU/Linux', major: '13' },
  'zorin-18.1': { name: 'Zorin OS', major: '18' },
  'rhel-9': { name: 'Red Hat Enterprise Linux', major: '9' },
  'rhel-10': { name: 'Red Hat Enterprise Linux', major: '10' },
  'fedora-45': { name: 'Fedora Linux', major: '45' },
  'amazon-linux-2023': { name: 'Amazon Linux', major: '2023' },
  'opensuse-leap-16.1': { name: 'openSUSE Leap', major: '16' },
  'omarchy-4.5': { name: 'Omarchy', major: '4' },
  'windows-10': { name: 'Windows', major: '10' },
  'windows-11': { name: 'Windows', major: '11' },
  'windows-server-2022': { name: 'Windows Server', major: '2022' },
  'windows-server-2025': { name: 'Windows Server', major: '2025' },
  'macos-15': { name: 'macOS', major: '15' },
  'macos-26': { name: 'macOS', major: '26' },
};

/** The OS versions Fleet matches vulnerabilities to: Ubuntu's and Red Hat's kernels, from the vendors' data. */
const OS_WITH_VULNERABILITIES = ['ubuntu-22.04', 'ubuntu-24.04', 'ubuntu-26.04', 'rhel-9', 'rhel-10'];

/** One `.deb` host and one `.rpm` host for the policy automation: neither is Ubuntu, which the pool's specs cover. */
const OS_WITH_POLICY_INSTALL = ['debian-13', 'rhel-9'];

/**
 * A package every host of a package type has, and the Type its inventory
 * lists it as: fleetd's own package, which is what enrolled the host, and on
 * macOS, where fleetd is no app, Safari.
 */
const KNOWN_PACKAGE: Record<LabPackage, { name: string; type: string }> = {
  deb: { name: 'fleet-osquery', type: 'Package (deb)' },
  rpm: { name: 'fleet-osquery', type: 'Package (RPM)' },
  'pkg.tar.zst': { name: 'fleet-osquery', type: 'Package (pacman)' },
  msi: { name: 'Fleet osquery', type: 'App (Windows)' },
  pkg: { name: 'Safari', type: 'App (macOS)' },
};

/**
 * What the host page shows of the machine, from Fleet's own detail queries, and
 * the shape a filled-in value has. An empty one reads "---".
 */
const VITALS: Array<[vital: string, shape: RegExp]> = [
  ['Disk space available', /\d+(\.\d+)? GB/],
  ['Memory', /\d+(\.\d+)? GB/],
  ['Hardware model', /\w/],
  ['Private IP address', /\b\d{1,3}(\.\d{1,3}){3}\b/],
  ['MAC address', /\b[0-9a-f]{2}(:[0-9a-f]{2}){5}\b/i],
];

/**
 * The Hosts list's platform filter for each platform. Its Platforms group is
 * Fleet's built-in labels under shorter names: Linux is "All Linux", Windows
 * "MS Windows". A host is in one once it has answered that label's query, as
 * for any label, so membership says the label queries reach the host and its
 * answers come back. The macOS and Windows queries read `os_version`; the
 * Linux one reads osquery's own build, so it holds whatever the distribution.
 */
const PLATFORM_FILTER: Record<LabPlatform, string> = { linux: 'Linux', windows: 'Windows', darwin: 'macOS' };

/**
 * One row from the host: the platform osquery reports, which the manifest
 * knows, and whether a Fleet Desktop process is up (`fleet-desktop` on Linux
 * and macOS, `fleet-desktop.exe` on Windows).
 */
const LIVE_QUERY =
  "SELECT (SELECT platform FROM os_version) AS platform, " +
  "CASE WHEN EXISTS (SELECT 1 FROM processes WHERE name LIKE 'fleet-desktop%') THEN 'yes' ELSE 'no' END AS fleet_desktop_running;";

/** The Windows matrix hosts' package (`OS_SMOKE_MSI`, which the cleanup's sweep knows by the same name). */
const SMOKE_MSI_PATH = path.resolve(__dirname, '../../../../test-data/windows/software', OS_SMOKE_MSI.packageName);

/**
 * Where the tarball's scripts put its marker. One fixed place rather than one
 * per run: a tarball is no inventory source, so nothing could find a per-run
 * directory a killed run left, while this one the next install overwrites and
 * the next uninstall removes.
 */
const TARBALL_DIR = '/usr/share/fleet-pw-os-smoke';

const VERSION = /^\d+\.\d+\.\d+/;
/** How Fleet words a count of vulnerabilities in a table cell: "2,567 vulnerabilities", "1 vulnerability". */
const VULNERABILITY_COUNT = /\d[\d,]* vulnerabilit(y|ies)/;
const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** One OS version under smoke. */
interface Subject {
  /** The manifest's `os`. */
  os: string;
  /**
   * The matrix host of the OS, or, for a pool version, any pool host of it: the
   * pool's hosts of one version are alike in everything the smokes read here.
   */
  entry: LabHost;
}

const lab = labHostsOfRun();
const poolVersions = new Map<string, LabHost>();
for (const host of lab) {
  if (host.role === 'pool' && !poolVersions.has(host.os)) poolVersions.set(host.os, host);
}
const SUBJECTS: Subject[] = [...poolVersions.values(), ...lab.filter((host) => host.role === 'matrix')].map(
  (entry) => ({ os: entry.os, entry }),
);

// A smoke that silently covers nothing is worse than a file that won't load:
// each table above has to match the manifest it reads.
{
  const known = new Set(SUBJECTS.map((subject) => subject.os));
  const unreported = [...known].filter((os) => !REPORTED_OS[os]);
  if (unreported.length) {
    throw new Error(`[os-smokes] lab-hosts.json has ${unreported.join(', ')}: add what Fleet shows for it to REPORTED_OS`);
  }
  for (const os of [...OS_WITH_VULNERABILITIES, ...OS_WITH_POLICY_INSTALL]) {
    const subject = SUBJECTS.find((s) => s.os === os);
    if (!subject) throw new Error(`[os-smokes] "${os}" is listed for a smoke and lab-hosts.json has no such OS`);
    if (subject.entry.platform !== 'linux') {
      throw new Error(`[os-smokes] "${os}" isn't Linux: its vulnerabilities aren't per kernel, and its package isn't a .deb or an .rpm`);
    }
  }
}

/** The host a smoke runs on: the matrix host of the OS, or the worker's pool VM of the version. */
interface SmokeHost {
  id: number;
  /** As Fleet shows it: Windows in upper case. */
  displayName: string;
  fleetId: number;
  fleetName: string;
}

const GATE = 'is online on its fleet, and reports its OS and its agent versions';

/**
 * The OS's host, online on its fleet. When it isn't, the first smoke of the OS
 * (`gate`) fails with the reason and every other one skips, naming that smoke.
 */
async function hostOf(request: APIRequestContext, { os, entry }: Subject, gate = false): Promise<SmokeHost> {
  const candidates = entry.role === 'pool' ? poolHostsOfRun(entry.platform, os) : [entry];
  const records = await listLabHostRecords(request, candidates);
  const problems = candidates.map((candidate) => labHostProblem(candidate, records));
  const unusable = problems.every((problem) => problem !== null) ? problems.join('; ') : null;
  if (unusable && gate) throw new Error(`no host to smoke ${os} on: ${unusable}`);
  test.skip(unusable !== null, `${unusable} (the failure of "${GATE}")`);

  const fleetName = labHostFleet(entry);
  if (typeof fleetName !== 'string') throw new Error(`[os-smokes] ${entry.name} (${entry.role}, ${entry.tier}) has no fleet of its own`);
  if (entry.role === 'pool') {
    const vm = await requireRealHost(request, entry.platform, { os });
    return { id: vm.id, displayName: vm.displayName, fleetId: vm.fleetId, fleetName };
  }
  const record = recordVmOnReport(newestRecord(entry, records)!);
  return { id: record.id, displayName: record.displayName, fleetId: record.fleetId!, fleetName };
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
  const built = perRunPackage(entry);
  const { titleId, name: title } = await uploadSoftwarePackageBuffer(
    request,
    host.fleetId,
    built.fileName,
    built.buffer,
    built.scripts,
  );
  cleanup.add(`take ${built.fileName} off ${host.displayName} and off ${host.fleetName}`, async (r) => {
    await uninstallIfLeftInstalled(r, host, titleId);
    await deleteSoftwareTitle(r, host.fleetId, titleId);
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
  const title = await findVmFixtureTitle(request, host.fleetId, fixture);
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
  const where = entry.role === 'pool' ? `a pool VM on ${labHostFleet(entry)}` : entry.name;

  // eslint-disable-next-line playwright/valid-test-tags -- the tag is the host's platform's VM tag, from vmTag()
  test.describe(`${os} (${where})`, { tag: vmTag(entry.platform) }, () => {
    test.describe.configure({ mode: 'default', retries: HOST_RETRIES });

    test(GATE, async ({ hostDetails, request }) => {
      const host = await hostOf(request, subject, true);
      const reported = await getHostAgentReport(request, host.id);
      // Not on the page, and what every platform picker in the suite matches on.
      expect(reported.platform, `the platform Fleet records for ${os}`).toBe(entry.fleetPlatform);
      expect(reported.orbitVersion, `${host.displayName} reports no fleetd version`).toMatch(VERSION);
      expect(reported.osqueryVersion, `${host.displayName} reports no osquery version`).toMatch(VERSION);

      await hostDetails.goto(host.id);
      await expect(hostDetails.hostHeading).toHaveText(host.displayName);
      await expect(hostDetails.vitals.value('Status')).toContainText('Online');
      await expect(hostDetails.vitals.value('Fleet')).toContainText(host.fleetName);
      const { name, major } = REPORTED_OS[os];
      await expect(hostDetails.vitals.value('Operating system')).toHaveText(
        new RegExp(`^${escapeRegExp(name)} ${escapeRegExp(major)}(?!\\d)`),
      );

      // Only an enrolled host has the vital at all.
      if (entry.mdm) await expect(hostDetails.vitals.value('MDM status')).toContainText('On');

      // The Agent value is fleetd's version; osquery's is in its tooltip.
      await expect(hostDetails.vitals.value('Agent')).toContainText(reported.orbitVersion);
      await hostDetails.hoverAgentVersion();
      await expect(hostDetails.agentTooltip).toContainText(`osquery: ${reported.osqueryVersion}`);
      await expect(hostDetails.agentTooltip).toContainText(`Orbit: ${reported.orbitVersion}`);
    });

    test('shows its vitals and its local users', async ({ hostDetails, request }) => {
      const host = await hostOf(request, subject);

      await hostDetails.goto(host.id);
      for (const [vital, shape] of VITALS) {
        await expect(hostDetails.vitals.value(vital), `${vital} of ${host.displayName}`).toHaveText(shape);
      }
      // The card shows "No users detected" until the host's users query has answered.
      await expect(hostDetails.usersHeading).toBeVisible();
      await expect(hostDetails.usersRows.first()).toBeVisible();
    });

    test('is in the built-in label of its platform', async ({ hostsList, request }) => {
      const host = await hostOf(request, subject);

      await hostsList.goto({ fleetId: host.fleetId });
      await hostsList.teamDropdown.selectByLabel(host.fleetName);
      const platform = PLATFORM_FILTER[entry.platform];
      await hostsList.filterTo({ platform, status: 'Online' });
      await hostsList.searchFor(host.displayName);
      await expect(hostsList.hostLink(host.displayName)).toBeVisible();
      // The search alone would find the host: the list is still the label's.
      await expect(hostsList.labelFilter.selected).toContainText(platform);
    });

    test('lists a package known to be on it in its software inventory', async ({ hostDetails, request }) => {
      const host = await hostOf(request, subject);
      const known = KNOWN_PACKAGE[entry.package];

      await hostDetails.goto(host.id);
      await hostDetails.openInventory(known.name);
      const row = hostDetails.softwareRow(known.name);
      await expect(row).toBeVisible();
      await expect(row.getByRole('cell', { name: known.type, exact: true })).toBeVisible();
    });

    const hasDesktop = entry.desktop !== 'none';

    test(
      `answers a live report with its own platform${hasDesktop ? ', and Fleet Desktop is running' : ''}`,
      async ({ hostDetails, reportEdit, reportLive, seed, request, page }) => {
        // A live run ends only when the host has answered, and a host answers
        // nothing while it is collecting its vitals: the wait for a collection
        // under way, then the run's own.
        test.setTimeout(480_000);
        const host = await hostOf(request, subject);
        const report = await seed.report('os-smoke-live', { query: LIVE_QUERY });
        await waitForNoPendingRefetch(request, host.id);

        await hostDetails.goto(host.id);
        await hostDetails.openLiveReport();
        await hostDetails.selectReportModal.filter(report.name);
        await hostDetails.selectReportModal.selectReport(report.name);
        await expect(page).toHaveURL(new RegExp(`host_id=${host.id}\\b`));
        await reportEdit.clickLiveReport();
        await reportLive.waitForReady();
        await expect(reportLive.targetRows).toHaveCount(1);
        await expect(reportLive.targetRows.first()).toContainText(host.displayName);

        await reportLive.run();
        await expect(reportLive.finishedHeading).toBeVisible({ timeout: 180_000 });
        await expect(reportLive.runSummary).toContainText('100% responded');
        await expect(reportLive.resultsRows).toHaveCount(1);
        const row = reportLive.resultsRows.first();
        await expect(row).toContainText(host.displayName);
        // What the host answered, not only that it did: its platform is the one
        // the manifest has for it.
        await expect(
          row.getByRole('cell', { name: entry.fleetPlatform, exact: true }),
          `the platform ${host.displayName} answered with`,
        ).toBeVisible();
        if (hasDesktop) {
          await expect(
            row.getByRole('cell', { name: 'yes', exact: true }),
            `no Fleet Desktop process on ${host.displayName}`,
          ).toBeVisible();
        }
      },
    );

    test('runs a script, and its output comes back', async ({ hostDetails, seed, request }) => {
      // Upload, the host's next check-in, the run, and the result's way back.
      test.setTimeout(300_000);
      const host = await hostOf(request, subject);
      const marker = `os smoke ${runNonce()}`;
      const windows = entry.platform === 'windows';
      // The host names itself in the output, so the output is this host's.
      const script = await seed.script('os-smoke', {
        fleetId: host.fleetId,
        extension: windows ? '.ps1' : '.sh',
        content: windows
          ? `Write-Output "${marker} on $env:COMPUTERNAME"\n`
          : `#!/bin/sh\necho "${marker} on $(uname -n)"\n`,
      });
      const modal = hostDetails.runScriptModal;
      const details = hostDetails.scriptDetailsModal;

      await hostDetails.goto(host.id);
      await hostDetails.openRunScript();
      await expect(modal.status(script.name)).toHaveText('---');
      await modal.run(script.name, host.displayName);
      await expect
        .poll(async () => (await getHostScriptLastExecution(request, host.id, script.name))?.status, {
          message: `${script.name} never finished on ${host.displayName}`,
          timeout: 180_000,
          intervals: [3_000],
        })
        .toBe('ran');

      // The modal reads its list only when it opens.
      await modal.close();
      await hostDetails.openRunScript();
      await expect(modal.status(script.name)).toHaveText('Ran');
      await modal.showRunDetails(script.name);
      await details.expectOpen();
      await expect(details.statusMessage).toHaveText('Exit code: 0 (Script ran successfully.)');
      // A RHEL host prints its qualified name, and Windows its name in upper case.
      await expect(details.output).toHaveText(new RegExp(`^${marker} on ${escapeRegExp(host.displayName)}`, 'i'));
    });

    if (OS_WITH_VULNERABILITIES.includes(os)) {
      test('has vulnerabilities listed for its OS', async ({ softwareOs, softwareOsDetail, softwareTitles, request }) => {
        const host = await hostOf(request, subject);
        const { osVersion } = await getHostAgentReport(request, host.id);
        const { name } = REPORTED_OS[os];
        const version = osVersion.slice(name.length).trim();

        // The OS list is counted hourly, so a version the host moved to within
        // the hour has no row yet.
        await softwareOs.goto({ fleetId: host.fleetId, platform: 'linux' });
        await softwareTitles.teamDropdown.selectByLabel(host.fleetName);
        const row = softwareOs.osRow(name, version);
        await expect(row, `${host.fleetName} lists no "${osVersion}" among its operating systems`).toBeVisible();
        // The cell reads "---" for an OS Fleet has matched nothing to.
        await expect(row, `Fleet lists no vulnerabilities for ${osVersion} on ${host.fleetName}`).toContainText(
          VULNERABILITY_COUNT,
        );

        // A Linux OS's vulnerabilities are its kernels'.
        await softwareOs.openOs(row);
        await expect(softwareOsDetail.nameHeading).toHaveText(osVersion);
        await expect(softwareOsDetail.kernelsHeading).toBeVisible();
        await expect(
          softwareOsDetail.table.rowWith(VULNERABILITY_COUNT).first(),
          `no kernel of ${osVersion} has a vulnerability listed`,
        ).toBeVisible();
      });
    }

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
        await waitForHostSoftwareStatus(request, host.id, pkg.titleId, 'installed');

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
        await waitForHostSoftwareStatus(request, host.id, pkg.titleId, null);
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

    if (OS_WITH_POLICY_INSTALL.includes(os)) {
      test("a policy's automation installs a package on it", async ({ hostDetails, seed, cleanup, request }) => {
        // A policy run (a refetch brings one), the install it queues, and the
        // uninstall that takes the package off again.
        test.setTimeout(900_000);
        const host = await hostOf(request, subject);
        // The policy is the fleet's: the label is what holds it to this host.
        const label = await seed.label('os-smoke-auto', [host.id]);
        const pkg = await addPerRunPackage(request, cleanup, host, entry);
        const policy = await createFleetPolicy(request, host.fleetId, {
          name: ownName('os-smoke-auto'),
          // Fails while the package isn't on the host, which is when Fleet installs it.
          query: `SELECT 1 FROM ${entry.package}_packages WHERE name = '${pkg.title}';`,
          platform: 'linux',
          labels_include_any: [label.name],
          software_title_id: pkg.titleId,
        });
        // Registered last, so undone first: Fleet won't delete a title a policy installs.
        cleanup.add(`delete policy ${policy.name}`, (r) => deleteFleetPolicies(r, host.fleetId, [policy.id]));
        expect(policy.installSoftwareTitleId).toBe(pkg.titleId);

        // A collection already under way was sent before the policy existed.
        await waitForNoPendingRefetch(request, host.id);
        const since = await getHostCollectedAt(request, host.id, 'policy_updated_at');
        await waitForHostRefetch(request, host.id, { since, field: 'policy_updated_at', refetch: true });
        await waitForHostSoftwareStatus(request, host.id, pkg.titleId, 'installed', 420_000);

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
  });
}

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
