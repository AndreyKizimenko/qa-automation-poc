/**
 * The per-OS smokes' shared part: which hosts a tier smokes, what Fleet shows
 * for each OS, and the checks both tiers make. Two specs run them:
 * `tests/e2e/premium/matrix/os-smokes.spec.ts` (the `premium-matrix` project)
 * and `tests/e2e/free/matrix/os-smokes.spec.ts` (`free-matrix`). Each spec
 * declares its own tests, in its own order, and gives each one of these for its
 * body; what only one tier can do (a custom package's install, a policy's
 * automation: premium's) stays in that tier's spec. What Fleet shows an OS is
 * written once, here, so a rename in Fleet's UI is one edit.
 *
 * **The subjects.** One per OS version of the tier's lab hosts
 * (`lab-hosts.json`): a pool VM of each version the pool holds, the matrix
 * host of each flavour, and the ChromeOS host. A ChromeOS host is `special` in
 * the manifest, since it takes no script and no package and so is never handed
 * to pool or matrix code (`isVmLabHost`), but it is the one host of its OS all
 * the same, and the smokes that need neither run on it.
 *
 * **ChromeOS is the fleetd Chrome extension**, not fleetd: it answers live
 * reports, labels, policies and Fleet's detail queries from tables of its own
 * (`ee/fleetd-chrome/src/tables/`), and runs no script, installs nothing and
 * has no MDM. The lab's two hosts run its developer form, which reads no serial
 * number, no network interfaces and no disk, so their serial, IP and MAC are
 * empty and their hardware model is a placeholder: those vitals are not
 * checked. Its version is Chrome's, which moves every few weeks, so only the
 * OS's name is held.
 *
 * Grounded in: `Vitals.tsx` (the Agent value and its tooltip, the vitals a
 * Chromebook does without, "Always on"), `AgentOptions.tsx` (a Chromebook's
 * fixed values), `User.tsx` ("Google Chrome profiles"), `HostDetailsPage.tsx`
 * (no Reports tab on ChromeOS), `HostActionsDropdown/helpers.tsx`
 * (`canRunScript`), `LabelFilterSelect.tsx` (the Platforms group),
 * `SoftwareOSDetailsPage.tsx` (the Kernels card), and `interfaces/software.ts`
 * (an extension's Type).
 */
import type { APIRequestContext, Page } from '@playwright/test';
import { test, expect, type Seed } from '@fixtures';
import type {
  HostDetailsPage,
  HostsListPage,
  ReportEditPage,
  ReportLivePage,
  SoftwareOsDetailPage,
  SoftwareOsPage,
  SoftwareTitlesPage,
} from '@pages';
import type { MyDeviceTab } from '@pages/hosts/MyDevicePage';
import {
  getHostAgentReport,
  getHostPolicyResponses,
  getHostScriptLastExecution,
  labHostProblem,
  listHostVulnerableTitles,
  listLabHostRecords,
  newestRecord,
  recordVmOnReport,
  requestHostRefetch,
  requireRealHost,
  runAdHocScript,
  vmTag,
  waitForNoPendingRefetch,
} from './api';
import { isVmLabHost, labHostFleet, labHostsOfRun, poolHostsOfRun, type LabHost, type LabPackage, type VmPlatform } from './lab-hosts';
import { runNonce } from './profiles';
import { activityCopy } from './activity-copy';
import { expectDetailsMatchHostDetails, expectSoftwareCountMatchesHostDetails } from './my-device';

/**
 * The OS name Fleet shows for each manifest `os`, and the major version the
 * smoke holds it to; `null` where the version moves on its own (ChromeOS is on
 * Chrome's release train). An `os` the manifest has and this table doesn't
 * fails {@link smokeSubjects}.
 */
const REPORTED_OS: Record<string, { name: string; major: string | null }> = {
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
  'chromeos-flex': { name: 'ChromeOS', major: null },
};

/** fleetd's and osquery's versions on a VM. */
const VERSION = /^\d+\.\d+\.\d+/;
/** The one agent of a ChromeOS host, as it reports itself in osquery's place. */
const CHROME_AGENT = /^fleetd-chrome-\d+\.\d+\.\d+$/;

/**
 * A package every host of a package type has, and the Type its inventory
 * lists it as: fleetd's own package, which is what enrolled the host; on
 * macOS, where fleetd is no app, Safari; on ChromeOS, which has no packages,
 * the fleetd extension among the browser's extensions.
 */
const KNOWN_PACKAGE: Record<LabPackage, { name: string; type: string }> = {
  deb: { name: 'fleet-osquery', type: 'Package (deb)' },
  rpm: { name: 'fleet-osquery', type: 'Package (RPM)' },
  'pkg.tar.zst': { name: 'fleet-osquery', type: 'Package (pacman)' },
  msi: { name: 'Fleet osquery', type: 'App (Windows)' },
  pkg: { name: 'Safari', type: 'App (macOS)' },
  none: { name: 'Fleetd for Chrome', type: 'Browser extension (Chrome)' },
};

/**
 * What the host page shows of a VM, from Fleet's own detail queries, and the
 * shape a filled-in value has. An empty one reads "---".
 */
const VM_VITALS: Array<[vital: string, shape: RegExp]> = [
  ['Disk space available', /\d+(\.\d+)? GB/],
  ['Memory', /\d+(\.\d+)? GB/],
  ['Hardware model', /\w/],
  ['Private IP address', /\b\d{1,3}(\.\d{1,3}){3}\b/],
  ['MAC address', /\b[0-9a-f]{2}(:[0-9a-f]{2}){5}\b/i],
];

/**
 * What it shows of a Chromebook that the lab's can fill in: Fleet shows no disk
 * space for one, and the extension's developer form reads no network
 * interfaces (the file's header).
 */
const CHROME_VITALS: Array<[vital: string, shape: RegExp]> = [
  ['Memory', /\d+(\.\d+)? GB/],
  ['Hardware model', /\w/],
];

/**
 * The Hosts list's platform filter for each platform. Its Platforms group is
 * Fleet's built-in labels under shorter names: Linux is "All Linux", Windows
 * "MS Windows". A host is in one once it has answered that label's query, as
 * for any label, so membership says the label queries reach the host and its
 * answers come back. A Mac that enrolled in MDM is put in "macOS" by Fleet
 * itself, before osquery answers anything, so there it says less: the host is
 * in the label, and has not answered that it isn't. The macOS and Windows
 * queries read `os_version`; the Linux one reads osquery's own build, so it
 * holds whatever the distribution; ChromeOS's is the extension's `os_version`.
 */
const PLATFORM_FILTER: Record<LabHost['platform'], string> = {
  linux: 'Linux',
  windows: 'Windows',
  darwin: 'macOS',
  chrome: 'ChromeOS',
};

/**
 * One row from the host: the platform it reports, which the manifest knows,
 * and whether its agent's own process is there to see. On a VM that is Fleet
 * Desktop (`fleet-desktop` on Linux and macOS, `fleet-desktop.exe` on
 * Windows); ChromeOS's tables have no `processes`, and its agent is a browser
 * extension, so there it is the fleetd extension among the browser's.
 */
const VM_LIVE_QUERY =
  "SELECT (SELECT platform FROM os_version) AS platform, " +
  "CASE WHEN EXISTS (SELECT 1 FROM processes WHERE name LIKE 'fleet-desktop%') THEN 'yes' ELSE 'no' END AS fleet_desktop_running;";
const CHROME_LIVE_QUERY =
  "SELECT (SELECT platform FROM os_version) AS platform, " +
  "CASE WHEN EXISTS (SELECT 1 FROM chrome_extensions WHERE name = 'Fleetd for Chrome') THEN 'yes' ELSE 'no' END AS fleetd_extension;";

/** How Fleet words a count of vulnerabilities in a table cell: "2,567 vulnerabilities", "1 vulnerability". */
const VULNERABILITY_COUNT = /\d[\d,]* vulnerabilit(y|ies)/;
const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The first smoke of every OS: the one that fails when its host can't be used, while the others skip. */
export const GATE = 'is online on its fleet, and reports its OS and its agent versions';

/** One OS version under smoke. */
export interface Subject {
  /** The manifest's `os`. */
  os: string;
  /** Its describe's title: `rhel-9 (prem-rhel9-01)`, `ubuntu-24.04 (a pool VM on VMs)`. `-g "rhel-9 \("` runs one OS. */
  title: string;
  /**
   * The matrix or ChromeOS host of the OS, or, for a pool version, any pool
   * host of it: the pool's hosts of one version are alike in everything the
   * smokes read.
   */
  entry: LabHost;
}

/**
 * The OS versions this run's tier smokes, one subject each (the file's
 * header). Throws for an `os` that {@link REPORTED_OS} lacks: a smoke that
 * silently covers nothing is worse than a file that won't load.
 */
export function smokeSubjects(): Subject[] {
  const lab = labHostsOfRun();
  const poolVersions = new Map<string, LabHost>();
  for (const host of lab) {
    if (host.role === 'pool' && !poolVersions.has(host.os)) poolVersions.set(host.os, host);
  }
  const subjects = [
    ...poolVersions.values(),
    ...lab.filter((host) => host.role === 'matrix'),
    ...lab.filter((host) => !isVmLabHost(host)),
  ].map((entry) => ({ os: entry.os, title: smokeTitle(entry), entry }));
  const unreported = subjects.filter((s) => !REPORTED_OS[s.os]).map((s) => s.os);
  if (unreported.length) {
    throw new Error(`[os-smokes] lab-hosts.json has ${unreported.join(', ')}: add what Fleet shows for it to REPORTED_OS (helpers/os-smokes.ts)`);
  }
  return subjects;
}

/**
 * Throws unless every `os` a spec lists for one of its smokes is a Linux
 * subject of this tier: a list naming an OS the manifest doesn't have would
 * smoke nothing, and the Linux-only smokes (vulnerabilities by kernel, a
 * `.deb` or an `.rpm`) would be wrong on anything else.
 */
export function requireLinuxSubjects(subjects: readonly Subject[], oses: readonly string[], smoke: string): void {
  for (const os of oses) {
    const subject = subjects.find((s) => s.os === os);
    if (!subject) throw new Error(`[os-smokes] "${os}" is listed for ${smoke}, and lab-hosts.json has no such OS on ${process.env.SUITE}`);
    if (subject.entry.platform !== 'linux') throw new Error(`[os-smokes] "${os}" is listed for ${smoke}, which only a Linux host can take`);
  }
}

/** The describe title of a host's OS: the host by name, or a pool version by where its VMs are. */
function smokeTitle(entry: LabHost): string {
  if (entry.role !== 'pool') return `${entry.os} (${entry.name})`;
  const fleet = labHostFleet(entry);
  return `${entry.os} (a pool VM${fleet ? ` on ${fleet}` : ''})`;
}

/** A subject's describe details: a VM's tag, which `requireRealHost` asks of a pool version. ChromeOS has none. */
export function smokeDetails({ entry }: Subject): { tag?: string } {
  return isVmLabHost(entry) ? { tag: vmTag(entry.platform) } : {};
}

/** Whether a host takes scripts and packages: every VM, and no ChromeOS host. */
export function takesScripts({ entry }: Subject): boolean {
  return isVmLabHost(entry);
}

/** Whether the subject is ChromeOS, which gets the two smokes of its own ({@link smoke}'s `chromebookPage` and `policies`). */
export function isChromebook({ entry }: Subject): boolean {
  return entry.platform === 'chrome';
}

/** The host a smoke runs on: the matrix or ChromeOS host of the OS, or the worker's pool VM of the version. */
export interface SmokeHost {
  id: number;
  /** As Fleet shows it: Windows in upper case. */
  displayName: string;
  /** The fleet it sits on; neither on free, which has no fleets. */
  fleetId?: number;
  fleetName?: string;
}

/**
 * The OS's host, online where its role puts it. When it isn't, the first smoke
 * of the OS (`gate`) fails with the reason and every other one skips, naming
 * that smoke. `exclude` leaves named pool hosts (manifest names) out, for a
 * smoke one of them can't take; a matrix or ChromeOS subject has one host only.
 */
export async function hostOf(
  request: APIRequestContext,
  { os, entry }: Subject,
  gate = false,
  { exclude = [] }: { exclude?: readonly string[] } = {},
): Promise<SmokeHost> {
  const candidates = entry.role === 'pool' && isVmLabHost(entry) ? poolHostsOfRun(entry.platform, os) : [entry];
  const records = await listLabHostRecords(request, candidates);
  const problems = candidates.map((candidate) => labHostProblem(candidate, records));
  const unusable = problems.every((problem) => problem !== null) ? problems.join('; ') : null;
  if (unusable && gate) throw new Error(`no host to smoke ${os} on: ${unusable}`);
  test.skip(unusable !== null, `${unusable} (the failure of "${GATE}")`);

  // A string on premium; null on free, where every host is in Unassigned.
  const fleet = labHostFleet(entry);
  if (fleet === undefined) throw new Error(`[os-smokes] ${entry.name} (${entry.role}, ${entry.tier}) has no fleet of its own`);
  const fleetName = fleet ?? undefined;
  if (entry.role === 'pool' && isVmLabHost(entry)) {
    const vm = await requireRealHost(request, entry.platform, { os, exclude });
    return { id: vm.id, displayName: vm.displayName, fleetId: fleetName ? vm.fleetId : undefined, fleetName };
  }
  const record = recordVmOnReport(newestRecord(entry, records)!);
  return { id: record.id, displayName: record.displayName, fleetId: fleetName ? record.fleetId! : undefined, fleetName };
}

/** The test title of the live-report smoke: what its second column says of the host. */
export function liveReportTitle({ entry }: Subject): string {
  if (!isVmLabHost(entry)) return 'answers a live report with its own platform, and lists the fleetd extension';
  return `answers a live report with its own platform${entry.desktop !== 'none' ? ', and Fleet Desktop is running' : ''}`;
}

/** Online on its fleet, with its OS name and major version, its agent's versions, and in MDM where the lab enrolled it. */
async function gate(
  { hostDetails, request }: { hostDetails: HostDetailsPage; request: APIRequestContext },
  subject: Subject,
): Promise<void> {
  const { os, entry } = subject;
  const host = await hostOf(request, subject, true);
  const reported = await getHostAgentReport(request, host.id);
  // Not on the page, and what every platform picker in the suite matches on.
  expect(reported.platform, `the platform Fleet records for ${os}`).toBe(entry.fleetPlatform);
  if (isVmLabHost(entry)) {
    expect(reported.orbitVersion, `${host.displayName} reports no fleetd version`).toMatch(VERSION);
    expect(reported.osqueryVersion, `${host.displayName} reports no osquery version`).toMatch(VERSION);
  } else {
    // The extension reports itself where osquery's version goes, and there is no fleetd.
    expect(reported.osqueryVersion, `${host.displayName} reports no extension version`).toMatch(CHROME_AGENT);
    expect(reported.orbitVersion, `${host.displayName} reports a fleetd version`).toBe('');
  }

  await hostDetails.goto(host.id);
  await expect(hostDetails.hostHeading).toHaveText(host.displayName);
  await expect(hostDetails.vitals.value('Status')).toContainText('Online');
  // Free has no fleets, and no Fleet vital.
  if (host.fleetName) await expect(hostDetails.vitals.value('Fleet')).toContainText(host.fleetName);
  const { name, major } = REPORTED_OS[os];
  await expect(hostDetails.vitals.value('Operating system')).toHaveText(
    new RegExp(`^${escapeRegExp(name)} ${major ? `${escapeRegExp(major)}(?!\\d)` : '\\d'}`),
  );

  // Only an enrolled host has the vital at all.
  if (entry.mdm) await expect(hostDetails.vitals.value('MDM status')).toContainText('On');

  if (!isVmLabHost(entry)) {
    // A Chromebook's Agent value is the extension's version, with no tooltip of versions behind it.
    await expect(hostDetails.vitals.value('Agent')).toHaveText(reported.osqueryVersion);
    return;
  }
  // The Agent value is fleetd's version; osquery's is in its tooltip.
  await expect(hostDetails.vitals.value('Agent')).toContainText(reported.orbitVersion);
  await hostDetails.hoverAgentVersion();
  await expect(hostDetails.tooltip).toContainText(`osquery: ${reported.osqueryVersion}`);
  await expect(hostDetails.tooltip).toContainText(`Orbit: ${reported.orbitVersion}`);
}

/** Its page shows the vitals Fleet reads of the machine, and one of the local users the host reported. */
async function vitalsAndUsers(
  { hostDetails, request }: { hostDetails: HostDetailsPage; request: APIRequestContext },
  subject: Subject,
): Promise<void> {
  const host = await hostOf(request, subject);

  await hostDetails.goto(host.id);
  for (const [vital, shape] of isVmLabHost(subject.entry) ? VM_VITALS : CHROME_VITALS) {
    await expect(hostDetails.vitals.value(vital), `${vital} of ${host.displayName}`).toHaveText(shape);
  }
  // The card shows "No users detected" until the host's users query has
  // answered. Then it lists what the host reported: one of them, by name.
  const { usernames } = await getHostAgentReport(request, host.id);
  expect(usernames, `${host.displayName} reports no local user`).not.toHaveLength(0);
  await expect(hostDetails.usersHeading).toBeVisible();
  await hostDetails.searchUsers(usernames[0]);
  await expect(hostDetails.userRow(usernames[0])).toBeVisible();
}

/** It is in the built-in label of its platform, as the Hosts list's platform filter. */
async function platformLabel(
  { hostsList, request }: { hostsList: HostsListPage; request: APIRequestContext },
  subject: Subject,
): Promise<void> {
  const host = await hostOf(request, subject);

  await hostsList.goto({ fleetId: host.fleetId });
  if (host.fleetName) await hostsList.teamDropdown.selectByLabel(host.fleetName);
  const platform = PLATFORM_FILTER[subject.entry.platform];
  await hostsList.filterTo({ platform, status: 'Online' });
  await hostsList.searchFor(host.displayName);
  await expect(hostsList.hostLink(host.displayName)).toBeVisible();
  // The search alone would find the host: the list is still the label's.
  await expect(hostsList.labelFilter.selected).toContainText(platform);
}

/** Its software inventory lists a package known to be on it, as its package type. */
async function knownPackage(
  { hostDetails, request }: { hostDetails: HostDetailsPage; request: APIRequestContext },
  subject: Subject,
): Promise<void> {
  const host = await hostOf(request, subject);
  const known = KNOWN_PACKAGE[subject.entry.package];

  await hostDetails.goto(host.id);
  await hostDetails.openInventory(known.name);
  const row = hostDetails.softwareRow(known.name);
  await expect(row).toBeVisible();
  await expect(row.getByRole('cell', { name: known.type, exact: true })).toBeVisible();
}

/**
 * A live report from its page comes back from it alone, with the platform the
 * manifest has for it, and finds its agent's own process or extension where
 * there is one to find (a headless VM has no Fleet Desktop).
 */
async function liveReport(
  {
    hostDetails,
    reportEdit,
    reportLive,
    seed,
    request,
    page,
  }: {
    hostDetails: HostDetailsPage;
    reportEdit: ReportEditPage;
    reportLive: ReportLivePage;
    seed: Seed;
    request: APIRequestContext;
    page: Page;
  },
  subject: Subject,
): Promise<void> {
  // A live run ends only when the host has answered, and a host answers
  // nothing while it is collecting its vitals: the wait for a collection
  // under way, then the run's own.
  test.setTimeout(480_000);
  const { entry } = subject;
  const vm = isVmLabHost(entry);
  const host = await hostOf(request, subject);
  const report = await seed.report('os-smoke-live', { query: vm ? VM_LIVE_QUERY : CHROME_LIVE_QUERY });
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
  if (vm && entry.desktop === 'none') return;
  await expect(
    row.getByRole('cell', { name: 'yes', exact: true }),
    vm ? `no Fleet Desktop process on ${host.displayName}` : `${host.displayName} doesn't list the fleetd extension`,
  ).toBeVisible();
}

/** A script runs on it, and the output it printed comes back. Not for ChromeOS ({@link takesScripts}). */
async function script(
  { hostDetails, seed, request }: { hostDetails: HostDetailsPage; seed: Seed; request: APIRequestContext },
  subject: Subject,
): Promise<void> {
  // Upload, the host's next check-in, the run, and the result's way back.
  test.setTimeout(300_000);
  const host = await hostOf(request, subject);
  const marker = `os smoke ${runNonce()}`;
  const windows = subject.entry.platform === 'windows';
  // The host names itself in the output, so the output is this host's.
  const script = await seed.script('os-smoke', {
    // Unassigned on free, where the library has no fleets.
    fleetId: host.fleetId ?? 0,
    extension: windows ? '.ps1' : '.sh',
    content: windows ? `Write-Output "${marker} on $env:COMPUTERNAME"\n` : `#!/bin/sh\necho "${marker} on $(uname -n)"\n`,
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
}

/** Whether a host has a My device page: a VM with Fleet Desktop (`canShowMyDeviceButton` wants its version). */
export function hasMyDevice(subject: Subject): boolean {
  return takesScripts(subject) && subject.entry.desktop !== 'none';
}

/**
 * Its My device page opens from Host details' link, on Details, and what it shows is what the admin sees: every
 * value on its Details tab equals Host details' value under the same title, and its Software tab counts as many
 * titles as Host details' Inventory (`helpers/my-device.ts`). It shows the tier's tabs, and on its Software tab
 * the package known to be on the host, as its package type. Each tier's spec passes the tabs it expects: a tab
 * listed as absent is checked only after the shown ones, so the absence isn't read off a page that never
 * rendered its tabs. Only for a host with Fleet Desktop ({@link hasMyDevice}).
 */
async function myDevice(
  { hostDetails, request }: { hostDetails: HostDetailsPage; request: APIRequestContext },
  subject: Subject,
  tabs: { shown: MyDeviceTab[]; absent: MyDeviceTab[] },
): Promise<void> {
  test.setTimeout(300_000);
  const host = await hostOf(request, subject);
  const known = KNOWN_PACKAGE[subject.entry.package];

  await hostDetails.goto(host.id);
  const device = await hostDetails.openMyDevice();
  await device.expectLoaded();
  for (const tab of tabs.shown) await expect(device.tab(tab)).toBeVisible();
  for (const tab of tabs.absent) await expect(device.tab(tab)).toHaveCount(0);
  await expectDetailsMatchHostDetails(hostDetails, device);
  await expectSoftwareCountMatchesHostDetails(hostDetails, device);

  const row = await device.findInSoftware(known.name);
  await expect(row).toBeVisible();
  await expect(row.getByRole('cell', { name: known.type, exact: true })).toBeVisible();
}

/**
 * Its My device page lists its vulnerable software: a CVE Fleet has matched to software on the host, searched
 * for on the Software tab, finds the title it was matched to, and the title's row shows its vulnerabilities as
 * Host details does: the CVE itself when it has one, "N vulnerabilities" when it has more
 * (`VulnerabilitiesCell.tsx`). The CVE is the host's own, from Fleet's list of its vulnerable software, so the
 * check follows whatever the host runs today. A title with exactly one CVE is preferred, since its cell names
 * the CVE.
 *
 * A host Fleet has matched nothing on skips, saying so: on 2026-11-18 that was two Windows 11 VMs, Windows
 * Server 2025 and Fedora 45, while every other host had at least one title (`prem-win10-01` and
 * `prem-ws2022-01` one each, Windows Defender). Only for a host with Fleet Desktop ({@link hasMyDevice}).
 */
async function myDeviceVulnerabilities(
  { hostDetails, request }: { hostDetails: HostDetailsPage; request: APIRequestContext },
  subject: Subject,
): Promise<void> {
  test.setTimeout(240_000);
  const host = await hostOf(request, subject);
  const vulnerable = await listHostVulnerableTitles(request, host.id);
  test.skip(vulnerable.length === 0, `Fleet lists no vulnerable software on ${host.displayName}`);
  const title = vulnerable.find((t) => t.cves.length === 1) ?? vulnerable[0];
  const cve = title.cves[0];
  test.info().annotations.push({ type: 'cve', description: `${cve} on ${title.shownAs} (${title.cves.length} in all)` });

  await hostDetails.goto(host.id);
  const device = await hostDetails.openMyDevice();
  await device.expectLoaded();
  const row = await device.findInSoftwareByCve(cve, title.shownAs);
  await expect(row, `My device finds no ${title.shownAs} for ${cve}`).toBeVisible();
  await expect(row).toContainText(title.cves.length === 1 ? cve : `${title.cves.length.toLocaleString('en-US')} vulnerabilities`);
}

/**
 * A script that exits 3 reads as an error. The Run script modal shows "Error". Its details read "Exit code: 3
 * (Script failed.)", with what it printed and the line fleetd appends to a failed run on every platform
 * (`script execution error: exit status 3`, `orbit/pkg/scripts/scripts.go`). The host's Activity card lists
 * the run and opens the same failure. Not for ChromeOS ({@link takesScripts}).
 */
async function failingScript(
  { hostDetails, seed, request }: { hostDetails: HostDetailsPage; seed: Seed; request: APIRequestContext },
  subject: Subject,
): Promise<void> {
  // Upload, the host's next check-in, the run, and the result's way back.
  test.setTimeout(300_000);
  const host = await hostOf(request, subject);
  const marker = `failing on purpose ${runNonce()}`;
  const windows = subject.entry.platform === 'windows';
  const script = await seed.script('os-smoke-fails', {
    fleetId: host.fleetId ?? 0,
    extension: windows ? '.ps1' : '.sh',
    content: windows ? `Write-Output "${marker}"\nexit 3\n` : `#!/bin/sh\necho "${marker}"\nexit 3\n`,
  });
  const modal = hostDetails.runScriptModal;
  const details = hostDetails.scriptDetailsModal;
  const failed = 'Exit code: 3 (Script failed.)';

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
    .toBe('error');

  // The modal reads its list only when it opens.
  await modal.close();
  await hostDetails.openRunScript();
  await expect(modal.status(script.name)).toHaveText('Error');
  await modal.showRunDetails(script.name);
  await details.expectOpen();
  await expect(details.statusMessage).toHaveText(failed);
  await expect(details.output).toHaveText(`${marker} script execution error: exit status 3`);
  await details.close();
  await modal.close();

  // A failed run is still a run: the Activity card lists it, and opens the same failure.
  await hostDetails.goto(host.id);
  await hostDetails.showPastActivities();
  await hostDetails.activityItem(activityCopy.script.ranOnThisHost({ name: script.name })).click();
  await details.expectOpen();
  await expect(details.statusMessage).toHaveText(failed);
  await details.close();
}

/**
 * How a script finds fleetd's own process: the main process of the service its package installed
 * (`orbit/pkg/packaging/`). Each prints `orbit pid: <n>`.
 */
const ORBIT_PID_SH: Record<'linux' | 'darwin', string> = {
  linux: 'systemctl show -p MainPID --value orbit.service',
  darwin: `launchctl print system/com.fleetdm.orbit | awk '$1 == "pid" { print $3; exit }'`,
};
const ORBIT_PID_PS = `(Get-CimInstance Win32_Service -Filter "Name='Fleet osquery'").ProcessId`;

const orbitPidScript = (platform: VmPlatform): string =>
  platform === 'windows'
    ? `$orbit = ${ORBIT_PID_PS}\nWrite-Output "orbit pid: $orbit"\n`
    : `#!/bin/sh\necho "orbit pid: $(${ORBIT_PID_SH[platform]})"\n`;

/**
 * Kills fleetd's process ten seconds after the script ends, from a process of the script's own that outlives
 * it: by then fleetd has sent the script's result. The process writes nowhere, so fleetd isn't left waiting on
 * its output. On Linux and macOS it is a subshell that ignores SIGHUP: a background `nohup` didn't outlive the
 * script on macOS 26, and a subshell did (2026-11-19). Prints the PID it will kill, as {@link orbitPidScript} does.
 */
const killOrbitScript = (platform: VmPlatform): string =>
  platform === 'windows'
    ? [
        `$orbit = ${ORBIT_PID_PS}`,
        `if (-not $orbit) { Write-Output 'no running Fleet osquery service'; exit 1 }`,
        `Start-Process -WindowStyle Hidden -FilePath powershell.exe -ArgumentList '-NoProfile', '-Command', "Start-Sleep -Seconds 10; Stop-Process -Id $orbit -Force"`,
        `Write-Output "orbit pid: $orbit"`,
        '',
      ].join('\n')
    : [
        '#!/bin/sh',
        `orbit=$(${ORBIT_PID_SH[platform]})`,
        `[ "\${orbit:-0}" -gt 0 ] || { echo "no running orbit service"; exit 1; }`,
        `( trap '' HUP; sleep 10; kill -9 "$orbit" ) </dev/null >/dev/null 2>&1 &`,
        `echo "orbit pid: $orbit"`,
        '',
      ].join('\n');

/** The PID an orbit script printed. Throws when it printed none, or 0 (no process). */
function parseOrbitPid(output: string): number {
  const pid = Number(/orbit pid: (\d+)/.exec(output)?.[1] ?? 0);
  if (!pid) throw new Error(`[parseOrbitPid] no orbit PID in the script's output: ${output.slice(0, 200)}`);
  return pid;
}

async function orbitPid(request: APIRequestContext, hostId: number, platform: VmPlatform): Promise<number> {
  const { exitCode, output } = await runAdHocScript(request, hostId, orbitPidScript(platform), { timeout: 180_000 });
  if (exitCode !== 0) throw new Error(`[orbitPid] host ${hostId}: exit ${exitCode}: ${output.slice(0, 200)}`);
  return parseOrbitPid(output);
}

/**
 * fleetd comes back by itself after its process is killed. The service manager its package set up restarts
 * it: systemd (`Restart=always`, after a second), launchd (`KeepAlive`, within ten) or the Windows service's
 * recovery actions (after a second). A script reads orbit's PID, a second kills orbit ten seconds after it
 * ends, and the test then runs the first again until it reads another PID. That it runs at all says the new
 * process takes scripts and sends their results. Both tiers' specs declare it last of a host's smokes, so the
 * restart reaches none of the others. Not for ChromeOS ({@link takesScripts}).
 */
async function selfHealing(
  { hostDetails, request }: { hostDetails: HostDetailsPage; request: APIRequestContext },
  subject: Subject,
): Promise<void> {
  // Two script round trips, then the poll across the restart: its five minutes, plus one attempt of up to
  // three that started just before they ran out, so a host that never comes back fails with the poll's message.
  test.setTimeout(600_000);
  const { entry } = subject;
  if (!isVmLabHost(entry)) throw new Error(`[os-smokes] ${entry.name} runs no fleetd to restart`);
  const host = await hostOf(request, subject);
  const before = await orbitPid(request, host.id, entry.platform);

  await test.step('a script kills fleetd, ten seconds after it has ended', async () => {
    const { exitCode, output } = await runAdHocScript(request, host.id, killOrbitScript(entry.platform));
    expect(exitCode, output).toBe(0);
    expect(parseOrbitPid(output), 'the PID the kill script read').toBe(before);
  });

  await test.step('fleetd is back, under another process, and runs a script', async () => {
    // A script that reaches the host before the kill reads the old PID; the next one waits out the restart.
    await expect
      .poll(() => orbitPid(request, host.id, entry.platform), {
        message: `fleetd on ${host.displayName} never came back under another process`,
        timeout: 300_000,
        intervals: [5_000],
      })
      .not.toBe(before);
  });

  await test.step('the host is still enrolled, and online', async () => {
    await hostDetails.goto(host.id);
    await expect(hostDetails.hostHeading).toHaveText(host.displayName);
    await expect(hostDetails.vitals.value('Status')).toContainText('Online');
  });
}

/** Vulnerabilities are listed for its OS, on its kernels: Linux only ({@link requireLinuxSubjects}). */
async function osVulnerabilities(
  {
    softwareOs,
    softwareOsDetail,
    softwareTitles,
    request,
  }: {
    softwareOs: SoftwareOsPage;
    softwareOsDetail: SoftwareOsDetailPage;
    softwareTitles: SoftwareTitlesPage;
    request: APIRequestContext;
  },
  subject: Subject,
): Promise<void> {
  const host = await hostOf(request, subject);
  const { osVersion } = await getHostAgentReport(request, host.id);
  const { name } = REPORTED_OS[subject.os];
  const version = osVersion.slice(name.length).trim();
  const where = host.fleetName ?? 'the instance';

  // The OS list is counted hourly, so a version the host moved to within
  // the hour has no row yet.
  await softwareOs.goto({ fleetId: host.fleetId, platform: 'linux' });
  if (host.fleetName) await softwareTitles.teamDropdown.selectByLabel(host.fleetName);
  const row = softwareOs.osRow(name, version);
  await expect(row, `${where} lists no "${osVersion}" among its operating systems`).toBeVisible();
  // The cell reads "---" for an OS Fleet has matched nothing to.
  await expect(row, `Fleet lists no vulnerabilities for ${osVersion} on ${where}`).toContainText(VULNERABILITY_COUNT);

  // A Linux OS's vulnerabilities are its kernels'.
  await softwareOs.openOs(row);
  await expect(softwareOsDetail.nameHeading).toHaveText(osVersion);
  await expect(softwareOsDetail.kernelsHeading).toBeVisible();
  await expect(
    softwareOsDetail.table.rowWith(VULNERABILITY_COUNT).first(),
    `no kernel of ${osVersion} has a vulnerability listed`,
  ).toBeVisible();
}

/**
 * ChromeOS only: its page is a Chromebook's. Disk encryption reads "Always
 * on", with Fleet's reason for not checking it; the vitals Fleet doesn't read
 * of a Chromebook aren't there, and Last restarted is when Chrome last started
 * for the signed-in user (fleetdm/fleet#59317); Agent options are the fixed values every
 * Chromebook runs; the signed-in profile is the host's Google Chrome profile;
 * there is no Reports tab (a Chromebook runs no scheduled report); and the
 * Actions menu offers a live report but no script.
 */
async function chromebookPage(
  { hostDetails, request }: { hostDetails: HostDetailsPage; request: APIRequestContext },
  subject: Subject,
): Promise<void> {
  const host = await hostOf(request, subject);
  const { usernames } = await getHostAgentReport(request, host.id);

  await hostDetails.goto(host.id);
  await expect(hostDetails.vitalsDiskEncryption).toContainText('Always on');
  await hostDetails.hoverVital('Disk encryption');
  await expect(hostDetails.tooltip).toContainText(
    'Fleet does not check for disk encryption on Chromebooks, as they are encrypted by default.',
  );
  // Asserted beside a vital that is there, so the absences are of a loaded card.
  await expect(hostDetails.vitals.value('Memory')).toBeVisible();
  await expect(hostDetails.vitals.value('Disk space available')).toHaveCount(0);
  // The extension records Chrome's start (`chrome.runtime.onStartup`), so it reads "Never" until Chrome
  // has started with the extension running, and a time ago after.
  await expect(hostDetails.vitals.value('Last restarted')).toHaveText(/^(Never|.+ ago)$/);

  await expect(hostDetails.agentOptions.value('Config TLS refresh')).toHaveText('Not supported');
  await expect(hostDetails.agentOptions.value('Logger TLS period')).toHaveText('Not supported');
  await expect(hostDetails.agentOptions.value('Distributed interval')).toHaveText('10 secs');
  await hostDetails.hoverAgentOptionsHeading();
  await expect(hostDetails.tooltip).toContainText(
    'Chromebooks ignore Fleet’s agent options configuration. The options displayed below are the same for all Chromebooks.',
  );

  // The extension reads the profile it runs under as the host's one local
  // user, and Fleet maps the same address to the host as its Chrome profile.
  expect(usernames, `${host.displayName} reports no signed-in profile`).toHaveLength(1);
  await expect(hostDetails.userCardData.value('Google Chrome profiles')).toHaveText(usernames[0]);

  await expect(hostDetails.softwareTab).toBeVisible();
  await expect(hostDetails.policiesTab).toBeVisible();
  await expect(hostDetails.reportsTab).toHaveCount(0);

  await hostDetails.openActions();
  await expect(hostDetails.actionOption('Live report')).toBeVisible();
  await expect(hostDetails.actionOption('Run script')).toHaveCount(0);
}

/**
 * ChromeOS only: it answers its policies, through the extension, and its
 * Policies tab shows both answers. Each policy is for ChromeOS alone, so on
 * premium's OS matrix fleet and among free's global policies no other host
 * is sent either.
 */
async function policies(
  { hostDetails, seed, request }: { hostDetails: HostDetailsPage; seed: Seed; request: APIRequestContext },
  subject: Subject,
): Promise<void> {
  // A refetch or two, each answered at the extension's next 10-second poll.
  test.setTimeout(300_000);
  const host = await hostOf(request, subject);
  const passing = await seed.policy('os-smoke-pass', {
    fleetId: host.fleetId,
    platform: 'chrome',
    query: "SELECT 1 FROM os_version WHERE platform = 'chrome';",
  });
  const failing = await seed.policy('os-smoke-fail', {
    fleetId: host.fleetId,
    platform: 'chrome',
    query: "SELECT 1 FROM os_version WHERE platform = 'darwin';",
  });

  // A policy's answer moves only on a refetch (or the hourly run), and a
  // refetch already under way was asked for before the policies existed.
  await waitForNoPendingRefetch(request, host.id);
  await expect
    .poll(
      async () => {
        const responses = await getHostPolicyResponses(request, host.id);
        const answered = [responses.get(passing.id), responses.get(failing.id)];
        if (answered.includes('') || answered.includes(undefined)) await requestHostRefetch(request, host.id);
        return answered;
      },
      { message: `${host.displayName} never answered its policies`, timeout: 180_000, intervals: [15_000] },
    )
    .toEqual(['pass', 'fail']);

  await hostDetails.goto(host.id);
  await hostDetails.openPoliciesTab();
  await expect(hostDetails.policyRow(passing.name)).toContainText('Pass');
  await expect(hostDetails.policyRow(failing.name)).toContainText('Fail');
}

/**
 * The checks, one per test. Each takes the fixtures it uses, as the test
 * destructured them, and the subject: `smoke.gate({ hostDetails, request }, subject)`.
 */
export const smoke = { gate, vitalsAndUsers, platformLabel, knownPackage, liveReport, script, failingScript, myDevice, myDeviceVulnerabilities, osVulnerabilities, chromebookPage, policies, selfHealing };
