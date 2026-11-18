/**
 * The device lab's hosts, from `lab-hosts.json` beside `fixtures.ts`: every
 * real machine the instances hold, and what each is for.
 *
 * This is the manifest's only copy. The lab's owner edits it in a PR whenever
 * a host is added, removed, renamed or moved, and `npm run lint:lab`, inside
 * `npm run check`, holds it to the shape below. The suite reads an entry's name, tier,
 * platform, `os` and role, and, for the per-OS smokes, what the lab says of the
 * OS itself: the platform Fleet reports it as, its package type and package
 * manager, its desktop, and whether it is enrolled in MDM. The rest (LUKS, the
 * passphrase dialog) waits for the disk-encryption specs.
 *
 * A host's **role** decides what the suite does with it:
 *
 *  - `pool`: an interchangeable target of the real-host specs. Each worker is
 *    handed one of its platform's pool hosts (`requireRealHost`).
 *  - `matrix`: the one host of an OS flavour. No pool spec touches it; a spec
 *    asks for it by its `os`.
 *  - `special`: a host with a single purpose, asked for by that purpose.
 *    A ChromeOS host is always one: it takes no script and no custom
 *    package, so no pool or matrix code may be handed one. The per-OS smokes
 *    take it as the one host of its OS, with the checks that need neither
 *    (`helpers/os-smokes.ts`).
 *  - `physical`: a bare-metal machine, which can't be rolled back or rebuilt
 *    from here. Never a pool target, and never the subject of anything that
 *    needs a reset to recover from.
 *
 * Its **fleet** follows from the role ({@link labHostFleet}). The entry's
 * `fleet` field records the same, and `npm run lint:lab` fails when the two
 * disagree; its `legacy_real` field is a fact about the machine that nothing
 * reads.
 *
 * A Fleet host is matched to an entry by its **display name, lower-cased**
 * ({@link labHostNamed}): Windows reports its name in upper case, and the RHEL
 * hosts' `hostname` is fully qualified. Names are stable; Fleet ids are not.
 */
import * as fs from 'fs';
import * as path from 'path';
import { VMS_FLEET } from './api/static-users';

/** A VM's platform: what every pool and matrix host runs. ChromeOS is only ever a special host. */
export type VmPlatform = 'darwin' | 'windows' | 'linux';
export type LabPlatform = VmPlatform | 'chrome';
export type LabRole = 'pool' | 'matrix' | 'special' | 'physical';
export type LabTier = 'free' | 'premium';
/** `pkg.tar.zst` is Arch's own format, which Fleet takes no custom package of; `none` is ChromeOS, which takes none at all. */
export type LabPackage = 'deb' | 'rpm' | 'msi' | 'pkg' | 'pkg.tar.zst' | 'none';

export interface LabHost {
  /** The host's display name in Fleet, lower-cased. */
  name: string;
  tier: LabTier;
  platform: LabPlatform;
  /**
   * The OS flavour and version (`ubuntu-24.04`, `macos-26`, `windows-server-2025`):
   * what a spec asks for a matrix host by, or for the pool members of one version.
   */
  os: string;
  role: LabRole;
  /** A `special` host's one purpose, as the manifest words it. */
  purpose?: string;
  /**
   * The host's `platform` in Fleet's API (`ubuntu`, `rhel`, `amzn`), which is
   * the distribution's own id and not always its name: Kubuntu reports
   * `ubuntu`, Fedora `rhel`.
   */
  fleetPlatform: string;
  /** The package type its OS installs. */
  package: LabPackage;
  /**
   * What installs that package, where it isn't the type's usual tool: openSUSE
   * installs an `.rpm` with `zypper` and has no `dnf`.
   */
  packageManager?: string;
  /** Its desktop session (`gnome`, `kde`, `hyprland`, `windows`, `macos`), or `none` for a headless host, which runs no Fleet Desktop. */
  desktop: string;
  /** Whether the lab enrolled it in Fleet's MDM. */
  mdm: boolean;
}

/** A host that isn't ChromeOS, as every pool and matrix host is: the manifest refuses a ChromeOS one there. */
export type VmLabHost = LabHost & { platform: VmPlatform; package: Exclude<LabPackage, 'none'> };

export function isVmLabHost(host: LabHost): host is VmLabHost {
  return host.platform !== 'chrome';
}

/** Premium's fleet for the hosts no pool spec touches: one per OS flavour, and the special ones. */
export const OS_MATRIX_FLEET = 'OS matrix';

const MANIFEST = path.join(__dirname, '..', 'lab-hosts.json');

/** A host as the file words it, before any of it is trusted. */
interface ManifestEntry {
  name?: string;
  tier?: string;
  platform?: string;
  os?: string;
  role?: string;
  purpose?: string;
  fleet_platform?: string;
  package?: string;
  package_manager?: string;
  desktop?: string;
  mdm?: boolean;
}
const PLATFORMS: readonly string[] = ['darwin', 'windows', 'linux', 'chrome'];
const ROLES: readonly string[] = ['pool', 'matrix', 'special', 'physical'];
const TIERS: readonly string[] = ['free', 'premium'];
const PACKAGES: readonly string[] = ['deb', 'rpm', 'msi', 'pkg', 'pkg.tar.zst', 'none'];

/**
 * Reads the manifest, refusing an entry the suite can't place: a host with an
 * unknown role or platform would otherwise be a lab machine nothing targets
 * and nothing reports, and one with an unknown package type a host the smokes
 * would have no package for. `npm run lint:lab` makes the same checks before a
 * run does (`scripts/lab-manifest.js`).
 */
function loadManifest(): LabHost[] {
  const doc = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) as { hosts?: ManifestEntry[] };
  const hosts = (doc.hosts ?? []).map((raw): LabHost => {
    const name = (raw.name ?? '').toLowerCase();
    const problems = [
      !name && 'no name',
      !TIERS.includes(raw.tier ?? '') && `tier "${raw.tier}"`,
      !PLATFORMS.includes(raw.platform ?? '') && `platform "${raw.platform}"`,
      !ROLES.includes(raw.role ?? '') && `role "${raw.role}"`,
      !raw.os && 'no os',
      raw.role === 'special' && !raw.purpose && 'no purpose (a special host is asked for by it)',
      !raw.fleet_platform && 'no fleet_platform',
      !PACKAGES.includes(raw.package ?? '') && `package "${raw.package}"`,
      !raw.desktop && 'no desktop ("none" for a headless host)',
      raw.platform === 'chrome' && raw.role !== 'special' && `role "${raw.role}" (a ChromeOS host is special: nothing in the pool or the matrix runs on it)`,
      raw.platform === 'chrome' && raw.package !== 'none' && `package "${raw.package}" (ChromeOS takes no package: "none")`,
      raw.platform !== 'chrome' && raw.package === 'none' && 'package "none", which only a ChromeOS host has',
    ].filter(Boolean);
    if (problems.length) {
      throw new Error(`[lab-hosts] ${MANIFEST}: host "${raw.name}" has ${problems.join(', ')}`);
    }
    return {
      name,
      tier: raw.tier as LabTier,
      platform: raw.platform as LabPlatform,
      os: raw.os!,
      role: raw.role as LabRole,
      purpose: raw.purpose,
      fleetPlatform: raw.fleet_platform!,
      package: raw.package as LabPackage,
      packageManager: raw.package_manager,
      desktop: raw.desktop!,
      mdm: raw.mdm === true,
    };
  });
  const twice = hosts.map((h) => h.name).filter((name, i, names) => names.indexOf(name) !== i);
  if (twice.length) throw new Error(`[lab-hosts] ${MANIFEST} lists ${twice.join(', ')} more than once`);
  return hosts;
}

/** Every host of the lab, on both tiers. */
export const LAB_HOSTS: readonly LabHost[] = loadManifest();

const BY_NAME = new Map(LAB_HOSTS.map((host) => [host.name, host]));

/** The manifest's entry for a Fleet host, by its display name; undefined for a host the lab doesn't list. */
export function labHostNamed(displayName: string | null | undefined): LabHost | undefined {
  return displayName ? BY_NAME.get(displayName.toLowerCase()) : undefined;
}

/**
 * The fleet a lab host belongs on, by its role: the pool on VMs, the matrix and
 * special hosts on OS matrix. `null` is Unassigned, which is every free host's
 * place, free having no fleets. `undefined` means the role names no fleet: a
 * physical machine stays where the lab enrolled it.
 */
export function labHostFleet(host: LabHost): string | null | undefined {
  if (host.tier === 'free') return null;
  if (host.role === 'pool') return VMS_FLEET;
  if (host.role === 'physical') return undefined;
  return OS_MATRIX_FLEET;
}

/** The lab hosts of the tier this run is on (`SUITE`); none on a tier the lab has no hosts for. */
export function labHostsOfRun(): LabHost[] {
  return LAB_HOSTS.filter((host) => host.tier === process.env.SUITE);
}

/** This tier's pool hosts of a platform, and of one `os` when given, by name. */
export function poolHostsOfRun(platform: VmPlatform, os?: string): VmLabHost[] {
  return labHostsOfRun()
    .filter(isVmLabHost)
    .filter((host) => host.role === 'pool' && host.platform === platform && (!os || host.os === os))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** This tier's matrix host of an OS flavour (`rhel-9`, `windows-10`). Throws when the manifest has none. */
export function matrixHostOfRun(os: string): LabHost {
  const host = labHostsOfRun().find((h) => h.role === 'matrix' && h.os === os);
  if (!host) {
    const known = labHostsOfRun().filter((h) => h.role === 'matrix').map((h) => h.os).join(', ');
    throw new Error(`[lab-hosts] no matrix host runs "${os}" on ${process.env.SUITE}; the manifest has: ${known || 'none'}`);
  }
  return host;
}

/** This tier's special host whose purpose mentions `purpose` (`LUKS key escrow`). Throws when the manifest has none. */
export function specialHostOfRun(purpose: string): LabHost {
  const host = labHostsOfRun().find(
    (h) => h.role === 'special' && h.purpose?.toLowerCase().includes(purpose.toLowerCase()),
  );
  if (!host) {
    const known = labHostsOfRun().filter((h) => h.role === 'special').map((h) => `"${h.purpose}"`).join(', ');
    throw new Error(`[lab-hosts] no special host is for "${purpose}" on ${process.env.SUITE}; the manifest has: ${known || 'none'}`);
  }
  return host;
}
