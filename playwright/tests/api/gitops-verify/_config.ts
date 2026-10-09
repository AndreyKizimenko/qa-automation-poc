/**
 * Loads the GitOps target once per worker and exposes what every spec in this
 * project shares: the parsed config, the scope's fleet id, paginated reads,
 * and the two comparisons the specs are built from — an exact name set, and a
 * declared-keys subset of a live object.
 *
 * The target comes from GITOPS_TARGET, resolved against `process.cwd()`:
 *   GITOPS_TARGET=../gitops/free-fleetqa-min                          (no-team config — a directory)
 *   GITOPS_TARGET=../gitops/premium-fleetqa/fleets/workstations.yml   (a fleet — a file)
 * and defaults to the tier's baseline directory. A target that doesn't belong to
 * SUITE's tier is refused at load: the two tiers' configs are near-identical, so
 * most of a run against the wrong one would pass.
 */
import * as fs from 'fs';
import * as path from 'path';
import { APIRequestContext, expect } from '@playwright/test';
import { apiLatestUrl } from '@helpers/api';
import { loadAnyConfig, type LabelTargets } from '@helpers/gitops-yaml';

export const suite = process.env.SUITE;
if (suite !== 'free' && suite !== 'premium') {
  throw new Error(`SUITE must be "free" or "premium" for the gitops-verify project (got ${JSON.stringify(suite)})`);
}
export const isPremium = suite === 'premium';

const gitopsRoot = path.resolve(__dirname, '../../../../gitops');
const target = process.env.GITOPS_TARGET
  ? path.resolve(process.cwd(), process.env.GITOPS_TARGET)
  : path.join(gitopsRoot, `${suite}-fleetqa`);
if (!target.split(path.sep).some((segment) => segment === `${suite}-fleetqa` || segment === `${suite}-fleetqa-min`)) {
  throw new Error(`GITOPS_TARGET ${target} is not a ${suite} config (SUITE=${suite})`);
}

export const gitopsTarget = target;
export const gitopsLabel = path.basename(target, path.extname(target));
export const gitopsConfig = loadAnyConfig(target);

/**
 * The baseline and min variants of a tier declare the same fleets between them
 * (the nightly applies the baseline's QA and VMs files in both passes), so the
 * fleet set the instance should hold is the union of both directories' fleet
 * files. `HAND_KEPT_FLEETS` are the fleets gitops deliberately doesn't declare —
 * see gitops/premium-fleetqa/README.md › "Do not pass --delete-other-fleets".
 */
export const HAND_KEPT_FLEETS = ['Mobile'];
export function siblingConfigDir(): string | undefined {
  const dir = gitopsConfig.scope === 'no-team' ? gitopsConfig.source : path.dirname(path.dirname(gitopsConfig.source));
  const base = path.basename(dir);
  const sibling = base.endsWith('-min') ? base.slice(0, -'-min'.length) : `${base}-min`;
  const siblingDir = path.join(path.dirname(dir), sibling);
  return fs.existsSync(siblingDir) ? siblingDir : undefined;
}

/**
 * Resolves the fleet id for the loaded config: 0 for the no-team scope, else a
 * lookup by name through GET /teams. Cached per worker process.
 */
let cachedTeamId: number | undefined;
export async function resolveTeamId(request: APIRequestContext): Promise<number> {
  if (cachedTeamId !== undefined) return cachedTeamId;
  if (gitopsConfig.scope === 'no-team') {
    cachedTeamId = 0;
    return 0;
  }
  const body = await getJson(request, 'teams?per_page=200');
  const team = (body.teams as Array<{ id: number; name: string }>).find((t) => t.name === gitopsConfig.teamName);
  if (!team) {
    const known = (body.teams as Array<{ name: string }>).map((t) => t.name).join(', ');
    throw new Error(`fleet "${gitopsConfig.teamName}" not found on the server. Existing: [${known}]`);
  }
  cachedTeamId = team.id;
  return team.id;
}

/** One GET, failing loudly on anything but 2xx — a swallowed error would read as "nothing declared". */
export async function getJson(request: APIRequestContext, pathAndQuery: string): Promise<Record<string, any>> {
  const res = await request.get(apiLatestUrl(pathAndQuery));
  if (!res.ok()) {
    throw new Error(`GET ${pathAndQuery} → HTTP ${res.status()}: ${await res.text()}`);
  }
  return res.json();
}

/** One GET whose body is a file (a script, a profile), returned as text. */
export async function getText(request: APIRequestContext, pathAndQuery: string): Promise<string> {
  const res = await request.get(apiLatestUrl(pathAndQuery));
  if (!res.ok()) {
    throw new Error(`GET ${pathAndQuery} → HTTP ${res.status()}: ${await res.text()}`);
  }
  return res.text();
}

/**
 * Every item of a paginated list. Follows `meta.has_next_results` where the
 * endpoint sends it, and otherwise keeps paging while a page comes back full,
 * so a list past 200 entities is read whole instead of compared truncated.
 */
export async function getAll<T>(request: APIRequestContext, pathAndQuery: string, key: string): Promise<T[]> {
  const perPage = 200;
  const joiner = pathAndQuery.includes('?') ? '&' : '?';
  const items: T[] = [];
  for (let page = 0; ; page++) {
    const body = await getJson(request, `${pathAndQuery}${joiner}per_page=${perPage}&page=${page}`);
    const pageItems = (body[key] ?? []) as T[];
    items.push(...pageItems);
    const hasNext = body.meta?.has_next_results ?? pageItems.length === perPage;
    if (!hasNext || pageItems.length === 0) break;
  }
  return items;
}

// ── Comparisons ────────────────────────────────────────────────────────────

/**
 * The live name set equals the declared one: nothing declared is missing, and
 * nothing live is undeclared. Both directions are soft so one run reports every
 * difference, and the final count makes the test fail when either did.
 */
export function expectExactNames(what: string, live: string[], declared: string[]): void {
  const liveSet = new Set(live);
  const declaredSet = new Set(declared);
  const missing = declared.filter((n) => !liveSet.has(n));
  const extra = live.filter((n) => !declaredSet.has(n));
  expect.soft(missing, `${what} declared in gitops but missing on the instance`).toEqual([]);
  expect.soft(extra, `${what} on the instance that gitops doesn't declare`).toEqual([]);
  expect(live.length, `${what} count`).toBe(declared.length);
}

/**
 * Every key the YAML declares has the same value on the instance. Keys the YAML
 * leaves out are not compared — Fleet fills defaults and adds read-only fields,
 * and a key the config doesn't manage can't drift from it. Objects recurse;
 * everything else must deep-equal.
 */
export function expectSubset(what: string, live: unknown, declared: unknown): void {
  if (declared === undefined) return;
  if (declared && typeof declared === 'object' && !Array.isArray(declared)) {
    for (const [key, value] of Object.entries(declared as Record<string, unknown>)) {
      if (value === undefined) continue;
      const liveValue = live && typeof live === 'object' ? (live as Record<string, unknown>)[key] : undefined;
      expectSubset(`${what}.${key}`, liveValue, value);
    }
    return;
  }
  expect.soft(live, what).toEqual(declared);
}

/** Label targets as the API reports them (objects with a name) → sorted names, for comparison with the YAML's lists. */
export function targetNames(live: unknown): string[] | undefined {
  if (!Array.isArray(live) || live.length === 0) return undefined;
  return live.map((l) => (typeof l === 'string' ? l : (l as { name: string }).name)).sort();
}

/** The three label-targeting keys of a declared entity, each as a sorted list, for `expectSubset` against the live ones. */
export function declaredTargets(entry: LabelTargets): Record<string, string[] | undefined> {
  return {
    labels_include_all: entry.labelsIncludeAll ? [...entry.labelsIncludeAll].sort() : undefined,
    labels_include_any: entry.labelsIncludeAny ? [...entry.labelsIncludeAny].sort() : undefined,
    labels_exclude_any: entry.labelsExcludeAny ? [...entry.labelsExcludeAny].sort() : undefined,
  };
}

/** SQL as Fleet stores it versus as a YAML block scalar carries it: whitespace runs and a trailing newline are not differences. */
export function normalizeSql(sql: string | undefined): string {
  return (sql ?? '').replace(/\s+/g, ' ').trim();
}

/** A file body as Fleet returns it versus as the repo holds it: line endings and trailing whitespace are not differences. */
export function normalizeBody(body: string): string {
  return body.replace(/\r\n/g, '\n').trimEnd();
}

/**
 * The fleet's installable software, read once per worker: every title with an
 * installer, with its package detail (the hash and the scripts live only on the
 * detail endpoint), and which of them came from the Fleet-maintained-app
 * catalog. A title is a Fleet-maintained app when its package carries
 * `fleet_maintained_app_id` — the catalog's own `software_title_id` is not that
 * signal: Fleet also sets it on a catalog entry whose app was uploaded as a
 * custom package (7-Zip on the VMs fleet), which would count as both.
 */
export interface FleetSoftware {
  titles: Array<{
    id: number;
    name: string;
    source: string;
    package?: Record<string, any>;
    appStoreApp?: Record<string, any>;
  }>;
  /** Catalog slugs whose app is installed on this fleet from the catalog, with the software title each produced. */
  addedSlugs: Map<string, number>;
  /** Every catalog entry, by slug. */
  catalog: Map<string, { id: number; name: string; platform: string }>;
}
const softwareCache = new Map<number, Promise<FleetSoftware>>();
export function resolveFleetSoftware(request: APIRequestContext, teamId: number): Promise<FleetSoftware> {
  let pending = softwareCache.get(teamId);
  if (!pending) {
    pending = (async () => {
      const listed = await getAll<Record<string, any>>(
        request,
        `software/titles?team_id=${teamId}&available_for_install=true`,
        'software_titles',
      );
      const titles = await Promise.all(
        listed.map(async (t) => {
          const detail = (await getJson(request, `software/titles/${t.id}?team_id=${teamId}`)).software_title;
          return {
            id: t.id as number,
            name: t.name as string,
            source: t.source as string,
            package: detail.software_package ?? undefined,
            appStoreApp: detail.app_store_app ?? undefined,
          };
        }),
      );
      // One page holds the whole catalog: it is read with a page size above its count.
      const catalogBody = await getJson(request, `software/fleet_maintained_apps?team_id=${teamId}&per_page=5000`);
      const apps = catalogBody.fleet_maintained_apps as Array<Record<string, any>>;
      if (catalogBody.meta?.has_next_results) {
        throw new Error(`the Fleet-maintained-app catalog has more than ${apps.length} entries; raise the page size`);
      }
      const catalog = new Map<string, { id: number; name: string; platform: string }>();
      const slugById = new Map<number, string>();
      for (const app of apps) {
        catalog.set(app.slug, { id: app.id, name: app.name, platform: app.platform });
        slugById.set(app.id, app.slug);
      }
      const addedSlugs = new Map<string, number>();
      for (const title of titles) {
        const appId = title.package?.fleet_maintained_app_id;
        if (appId == null) continue;
        const slug = slugById.get(appId);
        if (!slug) throw new Error(`title ${title.id} (${title.name}) names Fleet-maintained app ${appId}, which the catalog doesn't list`);
        addedSlugs.set(slug, title.id);
      }
      return { titles, addedSlugs, catalog };
    })();
    softwareCache.set(teamId, pending);
  }
  return pending;
}
