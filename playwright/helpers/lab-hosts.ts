/**
 * The device lab's hosts, from `lab-hosts.json` beside `fixtures.ts`: every
 * real machine the instances hold, and what each is for.
 *
 * The file is a copy. The lab edits its own first (`lab-hosts.json` in the
 * device-lab folder), and `npm run lab:sync` copies that one over this one;
 * `npm run lint:lab`, inside `npm run check`, fails while the two differ on a
 * machine that has the lab folder. The suite reads an entry's name, tier,
 * platform, `os` and role. The rest (package type, desktop, LUKS, …) is the
 * per-OS smokes' to read.
 *
 * A host's **role** decides what the suite does with it:
 *
 *  - `pool`: an interchangeable target of the real-host specs. Each worker is
 *    handed one of its platform's pool hosts (`requireRealHost`).
 *  - `matrix`: the one host of an OS flavour. No pool spec touches it; a spec
 *    asks for it by its `os`.
 *  - `special`: a host with a single purpose, asked for by that purpose.
 *  - `physical`: a bare-metal machine, which can't be rolled back or rebuilt
 *    from here. Never a pool target, and never the subject of anything that
 *    needs a reset to recover from.
 *
 * Its **fleet** follows from the role ({@link labHostFleet}), not from the
 * entry's `fleet`, `parked` or `legacy_real` fields: those record where the
 * lab had a host on the day the file was written, and how it looked to the
 * suite before the suite read this file.
 *
 * A Fleet host is matched to an entry by its **display name, lower-cased**
 * ({@link labHostNamed}): Windows reports its name in upper case, and the RHEL
 * hosts' `hostname` is fully qualified. Names are stable; Fleet ids are not.
 */
import * as fs from 'fs';
import * as path from 'path';
import { VMS_FLEET } from './api/static-users';

export type LabPlatform = 'darwin' | 'windows' | 'linux';
export type LabRole = 'pool' | 'matrix' | 'special' | 'physical';
export type LabTier = 'free' | 'premium';

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
}
const PLATFORMS: readonly string[] = ['darwin', 'windows', 'linux'];
const ROLES: readonly string[] = ['pool', 'matrix', 'special', 'physical'];
const TIERS: readonly string[] = ['free', 'premium'];

/**
 * Reads the manifest, refusing an entry the suite can't place: a host with an
 * unknown role or platform would otherwise be a lab machine nothing targets
 * and nothing reports. `npm run lint:lab` makes the same checks before a run
 * does (`scripts/lab-manifest.js`).
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
export function poolHostsOfRun(platform: LabPlatform, os?: string): LabHost[] {
  return labHostsOfRun()
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
