// The Fleet-maintained apps the FMA smoke suite (`tests/fma-smoke/`) exercises,
// and the ones it must never pick.
//
// Two layers read this list:
//
//   - the **catalog smoke** adds each entry to a throwaway `pw-fma-*` fleet (no
//     hosts) and checks what Fleet stored against what the entry expects. Adding
//     an FMA downloads its installer onto the instance, so every entry here has to
//     respect the premium box's size rule (gitops/premium-fleetqa/fleets/qa.yml:
//     a 2 GB Render box, 502'd once by a ~1.7 GB installer).
//   - the **host smoke** installs, verifies and uninstalls the `host: true`
//     entries on the real VM of their platform. A `host: true` entry must be
//     declared in gitops/premium-fleetqa/fleets/vms.yml (a durable fixture, at
//     rest uninstalled); every other entry must be declared on no standing
//     fleet. `tests/fma-smoke/manifest.spec.ts` reads the gitops YAML to enforce
//     both.
//
// `tier: 'p0'` runs every night. `tier: 'p1'` runs on demand
// (`FMA_SMOKE_TIER=p1`), for an RC sign-off.
//
// The expected identifiers come from Fleet's own catalog
// (ee/maintained-apps/outputs/apps.json and outputs/<slug>.json) and are what
// Fleet stores on the title: `bundle_identifier` for macOS, `upgrade_code` for
// Windows MSIs. A Windows entry's `unique_identifier` in apps.json can carry a
// stale version ("PuTTY release 0.83 (x64)" while 0.85 ships), so it is never
// used as an inventory key here.
import type { FmaPlatform } from './types';

export type FmaSmokeTier = 'p0' | 'p1';

/** How the vendor ships it — decides which install/uninstall path Fleet's scripts take. */
export type FmaInstallerKind = 'dmg' | 'zip' | 'pkg' | 'msi' | 'exe';

export interface FmaSmokeApp {
  /** Catalog slug, platform suffix included (`rectangle/darwin`). */
  slug: string;
  platform: FmaPlatform;
  tier: FmaSmokeTier;
  installer: FmaInstallerKind;
  /** macOS: the bundle id Fleet stores on the title and osquery's `apps` table reports. */
  expectedBundleId?: string;
  /** Windows MSI: the upgrade code Fleet stores on the title. */
  expectedUpgradeCode?: string;
  /**
   * Windows: how osquery's `programs` table names it once installed, for the
   * live-query check — the same match Fleet's manifest uses in its `exists`
   * query (outputs/<slug>.json). `name` may end in `%` where Windows embeds the
   * version in the program name.
   */
  programs?: { name: string; publisher: string };
  /** Installs on the real VM in the host smoke, as a durable VMs-fleet fixture. */
  host: boolean;
  /** Rough installer size when the entry was chosen, for the size budget. */
  approxMb: number;
}

export const fmaSmokeApps: readonly FmaSmokeApp[] = [
  // macOS — one .dmg and one .zip, both menu-bar utilities that are never launched.
  {
    slug: 'rectangle/darwin',
    platform: 'darwin',
    tier: 'p0',
    installer: 'dmg',
    expectedBundleId: 'com.knollsoft.Rectangle',
    host: false,
    approxMb: 4.5,
  },
  {
    slug: 'maccy/darwin',
    platform: 'darwin',
    tier: 'p0',
    installer: 'zip',
    expectedBundleId: 'org.p0deje.Maccy',
    host: false,
    approxMb: 4.5,
  },
  {
    slug: 'stats/darwin',
    platform: 'darwin',
    tier: 'p1',
    installer: 'dmg',
    expectedBundleId: 'eu.exelban.Stats',
    host: false,
    approxMb: 7.3,
  },
  // Windows — one per-machine MSI with an upgrade code, one NSIS .exe.
  {
    slug: 'putty/windows',
    platform: 'windows',
    tier: 'p0',
    installer: 'msi',
    expectedUpgradeCode: '{C9EAA861-2B72-4FAF-9FEE-EEB1AD5FD15E}',
    programs: { name: 'PuTTY release %', publisher: 'Simon Tatham' },
    host: false,
    approxMb: 3.7,
  },
  {
    slug: 'notepad++/windows',
    platform: 'windows',
    tier: 'p0',
    installer: 'exe',
    programs: { name: 'Notepad++', publisher: 'Notepad++ Team' },
    // TODO: promote to host: true once one manual run on the Windows VM shows the
    // x64 NSIS installer completes under ARM64 emulation within the install budget.
    host: false,
    approxMb: 6.6,
  },
  {
    slug: 'keepassxc/windows',
    platform: 'windows',
    tier: 'p1',
    installer: 'msi',
    expectedUpgradeCode: '{88785A72-3EAE-4F29-89E3-BC6B19BA9A5B}',
    programs: { name: 'KeePassXC', publisher: 'KeePassXC Team' },
    host: false,
    approxMb: 34.2,
  },
];

/**
 * Slugs no smoke run may add, with why. Apps declared on a standing fleet are
 * not listed here: the manifest test reads those from the gitops YAML.
 */
export const fmaSmokeDenylist: Readonly<Record<string, string>> = {
  // The VMs fleet's 7-Zip .exe custom package merges into the 7-zip FMA title
  // (reconcile_windows_maintained_app_titles), so the two can't coexist there.
  '7-zip/windows': 'merges with the VMs fleet custom 7-Zip .exe title',
  // Size: the premium QA instance is a 2 GB box.
  'docker/windows': '~606 MB installer; a ~1.7 GB one 502d the instance',
  'docker-desktop/darwin': 'large installer',
  'google-chrome/darwin': '~254 MB, and its manifest carries sha256 no_check, so Fleet cannot verify it',
  'microsoft-excel/darwin': 'large installer',
  'microsoft-outlook/darwin': 'large installer',
  'microsoft-powerpoint/darwin': 'large installer',
  'microsoft-word/darwin': 'large installer',
  'microsoft-teams/darwin': 'large installer',
  'android-studio/darwin': 'large installer',
  // Kernel/system extensions or a reboot: they change the VM beyond an app bundle.
  'parallels/darwin': 'system extension; needs approval and a reboot',
  'virtualbox/darwin': 'kernel extension',
  'displaylink/darwin': 'driver; asks for a reboot',
  // TODO: extend from the whole-catalog pass's findings (per-user Windows
  // installers such as Slack, Discord, Spotify and Zoom report under HKU and are
  // flaky in `programs` when no user is logged in).
};

export const fmaSmokeTier = (): FmaSmokeTier => (process.env.FMA_SMOKE_TIER === 'p1' ? 'p1' : 'p0');

/** The entries a run covers: p0 always, p1 too when FMA_SMOKE_TIER=p1. */
export function fmaSmokeSelection(opts: { host?: boolean } = {}): FmaSmokeApp[] {
  const tier = fmaSmokeTier();
  return fmaSmokeApps.filter(
    (a) => (tier === 'p1' || a.tier === 'p0') && (opts.host === undefined || a.host === opts.host),
  );
}
