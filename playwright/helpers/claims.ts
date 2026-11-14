/**
 * Who uses which shared thing on the instances. The suite runs fully parallel,
 * so two specs handed the same simulated host, or adding the same
 * Fleet-maintained app to the same fleet, break each other. Each use is
 * claimed here, once, and the pickers take a claim's key, not a number.
 * `npm run lint:claims` (part of `npm run check`) fails when two claims
 * overlap, a claim asks for more than its pool holds, a key names a spec that
 * doesn't exist or doesn't use it, or one spec uses another's key.
 *
 * A key is `<spec path under tests/, without .spec.ts>#<what for>`: the path
 * says which tiers the claim lives on (`shared/` and the root of `api/` both,
 * `premium/` or `free/` one), and only that spec may use it.
 *
 * This file imports nothing: the check reads it outside Playwright.
 */

export type SimPlatform = 'darwin' | 'windows' | 'linux';

/**
 * The pools, each an index space of its own over the online simulations
 * (helpers/api/hosts.ts has each picker):
 *  - `transfer` (`findSimulatedHostIds`): every simulation of the platform,
 *    from the end of the display-name ordering; for specs that move or delete
 *    hosts. Only its first {@link TRANSFER_POOL_END} belong to it.
 *  - `plain` (`findSimulations`, `findScriptableSimulations`, `borrowSims`):
 *    past those, the simulations not enrolled in MDM.
 *  - `mdm` (`findMdmSimulations`, `borrowSims` with `mdm`): past those, the
 *    MDM-enrolled ones, scarce, kept for profile targeting.
 *  - `offline` (`findOfflineSimulations`): the set the perf daemons abandoned
 *    at their last daily refresh, on Unassigned, newest first.
 *  - `fleetctl-mdm` (`findSimulatedHostForMdm`): the `transfer` ordering again,
 *    filtered to hosts with a hostname, MDM on or off as the claim says, and
 *    orbit when the claim asks for it. It shares hosts with `transfer`: an
 *    offset here is the lowest position the host can have there. So the check
 *    keeps a `fleetctl-mdm` claim that changes its host apart from every
 *    `transfer` claim on the platform from that offset up to
 *    {@link TRANSFER_POOL_END}. A read-only one may land on a `transfer`
 *    claim's host: its commands are refused client-side, before Fleet sees them.
 */
export type SimPool = 'transfer' | 'plain' | 'mdm' | 'offline' | 'fleetctl-mdm';

/**
 * What the spec does to the hosts. Claims may overlap only where every one
 * of them reads: a host that is moved, deleted or changed is its spec's alone.
 */
export type SimUse = 'read' | 'changed' | 'moved' | 'deleted';

export interface SimClaim {
  pool: SimPool;
  platform: SimPlatform;
  /** Where the slice starts in its pool (0 for `offline`, which has no offsets). */
  offset: number;
  /** How many hosts the picker hands over: the slice is `offset` to `offset + count`. */
  count: number;
  /** The fewest the spec can work with, when that is less than `count` (it filters the slice). */
  need?: number;
  use: SimUse;
  /**
   * `fleetctl-mdm` only, and required there: whether the host is connected to
   * Fleet MDM. **Chosen, never left to chance.** `fleetctl mdm` refuses a host
   * that isn't MDM-connected client-side (`hostMdmActionSetup` in
   * `cmd/fleetctl/fleetctl/mdm.go`) before it calls the server, but only on
   * platforms where `MDMTurnedOnSupported` is true (not Linux). That refusal is
   * what makes the error-path specs safe: a connected macOS or Windows
   * simulation would sail through and enqueue a real lock or wipe. `false` for
   * premium's error paths; `true` only on free, where the licence check stops
   * the command before anything is enqueued.
   */
  mdmConnected?: boolean;
  /**
   * `fleetctl-mdm` only: a host that runs orbit. Only ~40% of the pool does,
   * and only those can ever complete a lock or unlock (on Windows and Linux both
   * run as scripts, which orbit polls for). A simulation locked without orbit
   * sits at `pending_action: 'lock'` for good, refusing every later lock and
   * unlock, so it can only be deleted. Required for a spec that really locks;
   * left off for error paths, which never reach the server.
   */
  withOrbit?: boolean;
}

/**
 * Where the `transfer` pool ends and `plain` and `mdm` begin, in the same
 * ordering: the movers and deleters take hosts below it, the borrowers above.
 */
export const TRANSFER_POOL_END = 40;

export const SIM_CLAIMS = {
  // transfer
  'e2e/premium/hosts/bulk-transfer#selected': { pool: 'transfer', platform: 'darwin', offset: 0, count: 3, use: 'moved' },
  'e2e/premium/hosts/host-delete#pair': { pool: 'transfer', platform: 'darwin', offset: 10, count: 2, use: 'deleted' },
  'e2e/premium/hosts/host-delete#single': { pool: 'transfer', platform: 'darwin', offset: 20, count: 1, use: 'deleted' },
  'e2e/premium/hosts/host-delete#windows': { pool: 'transfer', platform: 'windows', offset: 10, count: 1, use: 'deleted' },
  'e2e/premium/hosts/host-transfer-permissions#per-role': { pool: 'transfer', platform: 'windows', offset: 0, count: 3, use: 'moved' },
  'cli/premium/fleets#transfer': { pool: 'transfer', platform: 'darwin', offset: 30, count: 1, use: 'moved' },

  // plain
  'api/free/license#idp-refusal': { pool: 'plain', platform: 'windows', offset: 0, count: 1, use: 'read' },
  'e2e/free/hosts/host-idp-username#host': { pool: 'plain', platform: 'windows', offset: 0, count: 1, use: 'read' },
  'e2e/premium/hosts/host-idp-username#user-card': { pool: 'plain', platform: 'windows', offset: 0, count: 1, use: 'changed' },
  'e2e/premium/hosts/host-idp-username#api': { pool: 'plain', platform: 'windows', offset: 1, count: 1, use: 'changed' },
  'e2e/shared/policies/policy-hosts#darwin': { pool: 'plain', platform: 'darwin', offset: 6, count: 1, use: 'read' },
  'e2e/shared/policies/policy-hosts#linux': { pool: 'plain', platform: 'linux', offset: 6, count: 2, use: 'read' },
  'e2e/shared/policies/policy-hosts#windows': { pool: 'plain', platform: 'windows', offset: 2, count: 1, use: 'read' },
  'e2e/shared/hosts/sort#darwin': { pool: 'plain', platform: 'darwin', offset: 7, count: 1, use: 'read' },
  'e2e/shared/hosts/sort#windows': { pool: 'plain', platform: 'windows', offset: 3, count: 1, use: 'read' },
  'e2e/shared/hosts/sort#linux': { pool: 'plain', platform: 'linux', offset: 20, count: 10, use: 'read' },
  'e2e/shared/hosts/filters#label-member': { pool: 'plain', platform: 'linux', offset: 8, count: 1, use: 'read' },
  'e2e/shared/hosts/filters#search-target': { pool: 'plain', platform: 'linux', offset: 9, count: 1, use: 'read' },
  'e2e/shared/labels/labels#members': { pool: 'plain', platform: 'linux', offset: 2, count: 3, use: 'read' },
  'e2e/shared/controls/scripts/batch-schedule-cancel#batch': { pool: 'plain', platform: 'linux', offset: 10, count: 3, use: 'changed' },
  'e2e/shared/controls/scripts/batch-schedule-cancel#scheduled': { pool: 'plain', platform: 'linux', offset: 13, count: 7, need: 1, use: 'changed' },
  'e2e/shared/controls/scripts/batch-schedule-cancel#edited': { pool: 'plain', platform: 'darwin', offset: 10, count: 30, need: 5, use: 'changed' },
  'e2e/premium/software/software-label-targets#outside': { pool: 'plain', platform: 'linux', offset: 0, count: 2, use: 'moved' },
  'e2e/premium/software/no-teams-views#library-read': { pool: 'plain', platform: 'linux', offset: 5, count: 1, use: 'read' },
  'e2e/premium/controls/os-settings/profile-broken-labels#members': { pool: 'plain', platform: 'darwin', offset: 0, count: 2, use: 'read' },
  'e2e/premium/policies/policy-label-targets#outside': { pool: 'plain', platform: 'darwin', offset: 2, count: 2, use: 'moved' },
  'e2e/premium/reports/report-label-targets#outside': { pool: 'plain', platform: 'darwin', offset: 4, count: 2, use: 'moved' },

  // mdm
  'e2e/premium/controls/os-settings/profile-label-targets#macos': { pool: 'mdm', platform: 'darwin', offset: 0, count: 2, use: 'moved' },
  'e2e/premium/controls/os-settings/profile-label-targets#windows': { pool: 'mdm', platform: 'windows', offset: 0, count: 2, use: 'moved' },
  'e2e/premium/controls/os-settings/profile-declarations#outside': { pool: 'mdm', platform: 'darwin', offset: 2, count: 2, use: 'moved' },

  // offline
  'e2e/premium/hosts/bulk-transfer#staged': { pool: 'offline', platform: 'linux', offset: 0, count: 51, use: 'moved' },
  'e2e/shared/hosts/filters#offline-member': { pool: 'offline', platform: 'darwin', offset: 0, count: 1, use: 'read' },

  // fleetctl-mdm. The lock spec's offset stays small: requiring orbit leaves about 39 of the ~97 Ubuntu
  // simulations, a far shallower pool than the platform count suggests.
  'cli/premium/mdm-lock-lifecycle#locked': {
    pool: 'fleetctl-mdm', platform: 'linux', offset: 5, count: 1, use: 'changed', mdmConnected: false, withOrbit: true,
  },
  'cli/premium/mdm-lock-wipe#darwin': { pool: 'fleetctl-mdm', platform: 'darwin', offset: 0, count: 1, use: 'read', mdmConnected: false },
  'cli/premium/mdm-lock-wipe#windows': { pool: 'fleetctl-mdm', platform: 'windows', offset: 0, count: 1, use: 'read', mdmConnected: false },
  'cli/free/mdm-licensing#darwin': { pool: 'fleetctl-mdm', platform: 'darwin', offset: 0, count: 1, use: 'read', mdmConnected: true },
  'cli/free/mdm-licensing#windows': { pool: 'fleetctl-mdm', platform: 'windows', offset: 0, count: 1, use: 'read', mdmConnected: true },
  'cli/free/mdm-licensing#linux': { pool: 'fleetctl-mdm', platform: 'linux', offset: 0, count: 1, use: 'read', mdmConnected: false },
} as const satisfies Record<string, SimClaim>;

/** A claim's key, optionally narrowed to the claims of one pool. */
export type SimClaimKey<P extends SimPool = SimPool> = {
  [K in keyof typeof SIM_CLAIMS]: (typeof SIM_CLAIMS)[K]['pool'] extends P ? K : never;
}[keyof typeof SIM_CLAIMS];

export function simClaim(key: SimClaimKey): SimClaim {
  return SIM_CLAIMS[key];
}

/**
 * How many online simulations each pool held, per tier, measured 2026-11-13
 * with each picker asked for 1000 (`transfer` capped at
 * {@link TRANSFER_POOL_END}). The perf daemons re-enroll a fresh set every day,
 * so these move: re-measure when a claim near the edge starts coming up short.
 * `fleetctl-mdm` isn't measured, so its claims aren't held to a size.
 */
export const POOL_SIZES: Record<'premium' | 'free', Partial<Record<SimPool, Partial<Record<SimPlatform, number>>>>> = {
  premium: {
    transfer: { darwin: TRANSFER_POOL_END, windows: TRANSFER_POOL_END },
    plain: { darwin: 34, windows: 42, linux: 60 },
    mdm: { darwin: 14, windows: 14 },
    offline: { darwin: 97, windows: 99, linux: 100 },
  },
  free: {
    transfer: { darwin: TRANSFER_POOL_END, windows: TRANSFER_POOL_END },
    plain: { darwin: 46, windows: 35, linux: 60 },
    mdm: { darwin: 14, windows: 25 },
    offline: { darwin: 100, windows: 100, linux: 100 },
  },
};

/**
 * Fleet-maintained apps a spec adds to a fleet. A fleet takes each app once,
 * so two specs adding the same one to the same fleet refuse each other
 * ("already added"): each slug has one spec. `addFmaToFleet` takes only a
 * claimed slug; an app added through the UI (`how: 'ui'`) is claimed all the
 * same. The durable apps gitops declares live on QA and VMs, which no spec
 * adds to.
 */
export interface CatalogClaim {
  spec: string;
  fleets: readonly ('Unassigned' | 'Workstations')[];
  how: 'api' | 'ui';
}

export const CATALOG_CLAIMS = {
  'clockify/darwin': { spec: 'e2e/premium/software/display-name', fleets: ['Unassigned'], how: 'api' },
  'anydesk/darwin': { spec: 'e2e/premium/software/custom-icons', fleets: ['Unassigned'], how: 'api' },
  'archaeology/darwin': { spec: 'e2e/premium/software/custom-icons', fleets: ['Unassigned'], how: 'api' },
  'localsend/darwin': { spec: 'e2e/premium/software/patch-policy', fleets: ['Workstations'], how: 'api' },
  'keepassxc/windows': { spec: 'e2e/premium/software/patch-policy', fleets: ['Workstations'], how: 'api' },
  'airtame/darwin': { spec: 'e2e/premium/software/library', fleets: ['Unassigned', 'Workstations'], how: 'ui' },
  '7-zip/windows': { spec: 'e2e/premium/software/library', fleets: ['Unassigned', 'Workstations'], how: 'ui' },
  '1password/darwin': { spec: 'e2e/premium/controls/setup-experience/install-software', fleets: ['Unassigned', 'Workstations'], how: 'api' },
  '1password/windows': { spec: 'e2e/premium/controls/setup-experience/install-software', fleets: ['Unassigned', 'Workstations'], how: 'api' },
  '010-editor/darwin': { spec: 'e2e/premium/controls/setup-experience/install-software', fleets: ['Unassigned', 'Workstations'], how: 'api' },
  'apparency/darwin': { spec: 'e2e/premium/controls/setup-experience/install-software', fleets: ['Unassigned', 'Workstations'], how: 'api' },
  'appcleaner/darwin': { spec: 'e2e/premium/controls/setup-experience/install-software', fleets: ['Unassigned', 'Workstations'], how: 'api' },
  'bbedit/darwin': { spec: 'e2e/premium/controls/setup-experience/install-software', fleets: ['Unassigned', 'Workstations'], how: 'api' },
  'bitwarden/darwin': { spec: 'e2e/premium/controls/setup-experience/install-software', fleets: ['Unassigned', 'Workstations'], how: 'api' },
  'box-drive/darwin': { spec: 'e2e/premium/controls/setup-experience/install-software', fleets: ['Unassigned', 'Workstations'], how: 'api' },
  'brave-browser/darwin': { spec: 'e2e/premium/controls/setup-experience/install-software', fleets: ['Unassigned', 'Workstations'], how: 'api' },
  'coteditor/darwin': { spec: 'e2e/premium/controls/setup-experience/install-software', fleets: ['Unassigned', 'Workstations'], how: 'api' },
  'cyberduck/darwin': { spec: 'e2e/premium/controls/setup-experience/install-software', fleets: ['Unassigned', 'Workstations'], how: 'api' },
  'discord/darwin': { spec: 'e2e/premium/controls/setup-experience/install-software', fleets: ['Unassigned', 'Workstations'], how: 'api' },
  'drawio/darwin': { spec: 'e2e/premium/controls/setup-experience/install-software', fleets: ['Unassigned', 'Workstations'], how: 'api' },
} as const satisfies Record<string, CatalogClaim>;

export type CatalogSlug = keyof typeof CATALOG_CLAIMS;
