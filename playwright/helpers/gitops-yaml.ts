/**
 * Parses a Fleet GitOps target — a directory holding `default.yml` (the no-team
 * scope) or one `fleets/<name>.yml` file (a fleet) — into a normalized shape
 * that the gitops-verify specs compare against the live instance and the
 * nightly fleetctl checks compare against `generate-gitops` output.
 *
 * Every list Fleet's schema lets a file build from `path:` (one file), `paths:`
 * (a glob, relative to the referencing file) or inline entries is expanded the
 * same way, so a config can mix the three. Names come from where Fleet takes
 * them: the `name:` field for labels, policies, reports and custom host vitals;
 * the file's basename for a script; the top-level PayloadDisplayName of a
 * .mobileconfig and the basename without extension for a Windows or Android
 * profile; the installer's filename (the URL's last segment, or the script's
 * name for a script-only package) for a custom package; the slug for a
 * Fleet-maintained app.
 *
 * `$VAR` / `${VAR}` references are expanded from the environment the way
 * fleetctl expands them — in every YAML file, except inside `description:` and
 * `resolution:` values, and never for `$FLEET_VAR_*` / `$FLEET_SECRET_*`, which
 * the server fills in. An unset variable throws, naming it: a comparison against
 * a half-expanded value would fail somewhere less obvious.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

/** `labels_include_all` / `labels_include_any` / `labels_exclude_any`, as Fleet scopes an entity to hosts. */
export interface LabelTargets {
  labelsIncludeAll?: string[];
  labelsIncludeAny?: string[];
  labelsExcludeAny?: string[];
}

export interface LabelEntry {
  name: string;
  description?: string;
  /** `label_membership_type`; Fleet's default is dynamic. */
  membership: 'dynamic' | 'manual' | 'host_vitals';
  query?: string;
  platform?: string;
  hosts?: string[];
  criteria?: Record<string, unknown>;
}

export interface PolicyEntry extends LabelTargets {
  name: string;
  query?: string;
  platform?: string;
  description?: string;
  resolution?: string;
  critical?: boolean;
  type?: 'dynamic' | 'patch';
  /** The automation's target: a Fleet-maintained app slug, a custom package by its package file or hash, or an App Store id. */
  installSoftware?: { slug?: string; packagePath?: string; hash?: string; appStoreId?: string; patch?: true };
  /** The remediation script's basename, as Fleet names it. */
  runScript?: string;
  resendConfigurationProfile?: string;
  calendarEventsEnabled?: boolean;
  conditionalAccessEnabled?: boolean;
  continuousAutomationsEnabled?: boolean;
  webhooksAndTicketsEnabled?: boolean;
  patchWhenClosed?: boolean;
  notifyBeforePatching?: boolean;
  fleetMaintainedAppSlug?: string;
}

export interface ReportEntry {
  name: string;
  query?: string;
  platform?: string;
  description?: string;
  interval?: number;
  logging?: string;
  discardData?: boolean;
  observerCanRun?: boolean;
  automationsEnabled?: boolean;
  minOsqueryVersion?: string;
  labelsIncludeAny?: string[];
  labelsIncludeAll?: string[];
}

export interface ScriptEntry {
  /** The basename, which is the name Fleet gives the script. */
  name: string;
  platform: 'darwin' | 'windows' | 'linux';
  path: string;
  body: string;
}

export type ProfilePlatform = 'darwin' | 'windows' | 'android';

export interface ProfileEntry extends LabelTargets {
  name: string;
  platform: ProfilePlatform;
  path: string;
}

export interface PackageEntry extends LabelTargets {
  /** The installer's filename: the URL's last segment, or the script's name for a script-only package. */
  fileName: string;
  path: string;
  scriptOnly: boolean;
  url?: string;
  hash?: string;
  selfService?: boolean;
  categories?: string[];
  setupExperience?: boolean;
  displayName?: string;
  /** Whether an `icon.path` is declared (the image itself isn't compared). */
  hasIcon?: boolean;
  preInstallQuery?: string;
  installScript?: string;
  uninstallScript?: string;
  postInstallScript?: string;
}

export interface FleetMaintainedAppEntry extends LabelTargets {
  slug: string;
  selfService?: boolean;
  version?: string;
  categories?: string[];
  setupExperience?: boolean;
  displayName?: string;
  hasIcon?: boolean;
  preInstallQuery?: string;
  installScript?: string;
  uninstallScript?: string;
  postInstallScript?: string;
}

export interface AppStoreAppEntry extends LabelTargets {
  appStoreId: string;
  platform?: string;
  selfService?: boolean;
  categories?: string[];
  setupExperience?: boolean;
  displayName?: string;
}

export interface SoftwareSection {
  /** Whether the file carries a `software:` key at all — with the software exception off, a fleet file without one deletes the fleet's software. */
  declared: boolean;
  packages: PackageEntry[];
  fleetMaintainedApps: FleetMaintainedAppEntry[];
  appStoreApps: AppStoreAppEntry[];
}

export type ConfigScope = 'no-team' | 'team';

export interface ParsedConfig {
  scope: ConfigScope;
  /** The directory for the no-team scope, the fleet file for a fleet. */
  source: string;
  /** The YAML file the entities were read from. */
  file: string;
  /** "No team" for the no-team scope, else the fleet file's `name:`. */
  teamName: string;
  /** The whole document, environment-expanded, for keys no typed field covers. */
  doc: Record<string, any>;
  /** `org_settings`, no-team only. */
  orgSettings?: Record<string, any>;
  /** The fleet's `settings:` block, fleet files only. */
  settings?: Record<string, any>;
  /** `agent_options`, resolved through its `path:` when it has one. */
  agentOptions?: Record<string, any>;
  /** The `controls:` block, environment-expanded, minus the lists the typed fields carry. */
  controls: Record<string, any>;
  orgName?: string;
  /** `custom_host_vitals` names; undefined when the key is absent, which makes fleetctl delete every vital. */
  customHostVitals?: string[];
  labels: LabelEntry[];
  policies: PolicyEntry[];
  reports: ReportEntry[];
  scripts: ScriptEntry[];
  profiles: ProfileEntry[];
  software: SoftwareSection;
  /** No-team only: the `name:` of every `fleets/*.yml` beside `default.yml`. */
  fleetFiles: Array<{ file: string; name: string }>;
}

/** Loads a gitops directory's `default.yml`: the no-team scope plus the org settings. */
export function loadGitOpsConfig(rootDir: string): ParsedConfig {
  const file = path.join(rootDir, 'default.yml');
  const doc = loadYaml(file);
  const common = parseCommon(doc, file);

  const fleetsDir = path.join(rootDir, 'fleets');
  const fleetFiles = fs.existsSync(fleetsDir)
    ? fs
        .readdirSync(fleetsDir)
        .filter((f) => f.endsWith('.yml'))
        .sort()
        .map((f) => {
          const fleetFile = path.join(fleetsDir, f);
          return { file: fleetFile, name: String(loadYaml(fleetFile).name ?? '') };
        })
    : [];

  const orgSettings = doc.org_settings ?? {};
  return {
    ...common,
    scope: 'no-team',
    source: rootDir,
    teamName: 'No team',
    orgSettings,
    orgName: orgSettings.org_info?.org_name,
    customHostVitals: Array.isArray(doc.custom_host_vitals)
      ? doc.custom_host_vitals.map((v: any) => String(v.name))
      : undefined,
    fleetFiles,
  };
}

/** Loads a `fleets/<name>.yml` file. Path references resolve relative to the file's directory. */
export function loadFleetConfig(filePath: string): ParsedConfig {
  const doc = loadYaml(filePath);
  return {
    ...parseCommon(doc, filePath),
    scope: 'team',
    source: filePath,
    teamName: String(doc.name),
    settings: doc.settings ?? doc.team_settings,
    fleetFiles: [],
  };
}

/** Auto-detects: directory → no-team config; file → fleet config. */
export function loadAnyConfig(target: string): ParsedConfig {
  const stat = fs.statSync(target);
  return stat.isDirectory() ? loadGitOpsConfig(target) : loadFleetConfig(target);
}

// ── Sections ───────────────────────────────────────────────────────────────

type Common = Pick<
  ParsedConfig,
  'file' | 'doc' | 'agentOptions' | 'controls' | 'labels' | 'policies' | 'reports' | 'scripts' | 'profiles' | 'software'
>;

function parseCommon(doc: Record<string, any>, file: string): Common {
  const baseDir = path.dirname(file);
  const controls = doc.controls ?? {};

  const agentOptions =
    doc.agent_options && typeof doc.agent_options === 'object' && 'path' in doc.agent_options
      ? loadYaml(path.resolve(baseDir, doc.agent_options.path))
      : doc.agent_options;

  const labels = expandEntities(doc.labels, baseDir).map(
    ({ item }): LabelEntry => ({
      name: String(item.name),
      description: item.description,
      membership: item.label_membership_type ?? 'dynamic',
      query: item.query,
      platform: item.platform,
      hosts: item.hosts,
      criteria: item.criteria,
    }),
  );

  const policies = expandEntities(doc.policies, baseDir).map(({ item, dir }): PolicyEntry => {
    const install = item.install_software;
    return {
      name: String(item.name),
      query: item.query,
      platform: item.platform,
      description: item.description,
      resolution: item.resolution,
      critical: item.critical,
      type: item.type,
      installSoftware:
        install === true
          ? { patch: true }
          : install && typeof install === 'object'
            ? {
                slug: install.fleet_maintained_app_slug,
                packagePath: install.package_path ? path.resolve(dir, install.package_path) : undefined,
                hash: install.hash_sha256,
                appStoreId: install.app_store_id,
              }
            : undefined,
      runScript: item.run_script?.path ? path.basename(item.run_script.path) : undefined,
      resendConfigurationProfile: item.resend_configuration_profile,
      calendarEventsEnabled: item.calendar_events_enabled,
      conditionalAccessEnabled: item.conditional_access_enabled,
      continuousAutomationsEnabled: item.continuous_automations_enabled,
      webhooksAndTicketsEnabled: item.webhooks_and_tickets_enabled,
      patchWhenClosed: item.patch_when_closed,
      notifyBeforePatching: item.notify_before_patching,
      fleetMaintainedAppSlug: item.fleet_maintained_app_slug,
      ...labelTargets(item),
    };
  });

  const reports = expandEntities(doc.reports ?? doc.queries, baseDir).map(
    ({ item }): ReportEntry => ({
      name: String(item.name),
      query: item.query,
      platform: item.platform,
      description: item.description,
      interval: item.interval,
      logging: item.logging,
      discardData: item.discard_data,
      observerCanRun: item.observer_can_run,
      automationsEnabled: item.automations_enabled,
      minOsqueryVersion: item.min_osquery_version,
      labelsIncludeAny: item.labels_include_any,
      labelsIncludeAll: item.labels_include_all,
    }),
  );

  // Fleet keeps only .sh, .py and .ps1 from a scripts glob; a `path:` is taken as written.
  const scripts = expandFiles(controls.scripts, baseDir, /\.(sh|py|ps1)$/).map(
    ({ file: scriptFile }): ScriptEntry => ({
      name: path.basename(scriptFile),
      platform: scriptPlatform(scriptFile),
      path: scriptFile,
      body: fs.readFileSync(scriptFile, 'utf-8'),
    }),
  );

  const profileSections: Array<[ProfilePlatform, any]> = [
    ['darwin', controls.apple_settings ?? controls.macos_settings],
    ['windows', controls.windows_settings],
    ['android', controls.android_settings],
  ];
  const profiles = profileSections.flatMap(([platform, section]) =>
    expandFiles(section?.configuration_profiles ?? section?.custom_settings, baseDir).map(
      ({ file: profileFile, entry }): ProfileEntry => ({
        name:
          platform === 'darwin' && profileFile.endsWith('.mobileconfig')
            ? extractMacosProfileName(profileFile)
            : path.basename(profileFile, path.extname(profileFile)),
        platform,
        path: profileFile,
        ...labelTargets(entry),
      }),
    ),
  );

  return {
    file,
    doc,
    agentOptions,
    controls,
    labels,
    policies,
    reports,
    scripts,
    profiles,
    software: parseSoftware(doc.software, baseDir),
  };
}

function parseSoftware(section: any, baseDir: string): SoftwareSection {
  if (!section || typeof section !== 'object') {
    return { declared: section !== undefined, packages: [], fleetMaintainedApps: [], appStoreApps: [] };
  }

  const packages: PackageEntry[] = (section.packages ?? []).flatMap((entry: any): PackageEntry[] => {
    const fleetLevel = {
      selfService: entry.self_service,
      categories: entry.categories,
      setupExperience: entry.setup_experience,
      displayName: entry.display_name,
      hasIcon: entry.icon ? true : undefined,
      ...labelTargets(entry),
    };
    // A script-only package: the referenced .sh / .ps1 / .py is the installer itself.
    if (entry.path && /\.(sh|py|ps1)$/.test(entry.path)) {
      const scriptFile = path.resolve(baseDir, entry.path);
      return [{ fileName: path.basename(scriptFile), path: scriptFile, scriptOnly: true, ...fleetLevel }];
    }
    const packageFile = entry.path ? path.resolve(baseDir, entry.path) : undefined;
    const packageDir = packageFile ? path.dirname(packageFile) : baseDir;
    const items: any[] = packageFile ? asList(loadYaml(packageFile)) : [entry];
    return items.map((item): PackageEntry => {
      const url: string | undefined = item.url;
      const readRef = (ref: any) => (ref?.path ? fs.readFileSync(path.resolve(packageDir, ref.path), 'utf-8') : undefined);
      return {
        // A package declared by hash alone (already in Fleet's storage) has no filename to show; the hash names it.
        fileName: url ? path.basename(new URL(url).pathname) : `sha256:${String(item.hash_sha256 ?? '').slice(0, 12)}`,
        path: packageFile ?? baseDir,
        scriptOnly: false,
        url,
        hash: item.hash_sha256,
        preInstallQuery: readRef(item.pre_install_query),
        installScript: readRef(item.install_script),
        uninstallScript: readRef(item.uninstall_script),
        postInstallScript: readRef(item.post_install_script),
        ...stripUndefined({
          selfService: item.self_service,
          categories: item.categories,
          setupExperience: item.setup_experience,
          displayName: item.display_name,
          hasIcon: item.icon ? true : undefined,
          ...labelTargets(item),
        }),
        ...stripUndefined(fleetLevel),
      };
    });
  });

  const fleetMaintainedApps: FleetMaintainedAppEntry[] = (section.fleet_maintained_apps ?? []).map(
    (item: any): FleetMaintainedAppEntry => {
      const readRef = (ref: any) => (ref?.path ? fs.readFileSync(path.resolve(baseDir, ref.path), 'utf-8') : undefined);
      return {
        slug: String(item.slug),
        selfService: item.self_service,
        version: item.version,
        categories: item.categories,
        setupExperience: item.setup_experience,
        displayName: item.display_name,
        hasIcon: item.icon ? true : undefined,
        preInstallQuery: readRef(item.pre_install_query),
        installScript: readRef(item.install_script),
        uninstallScript: readRef(item.uninstall_script),
        postInstallScript: readRef(item.post_install_script),
        ...labelTargets(item),
      };
    },
  );

  const appStoreApps: AppStoreAppEntry[] = (section.app_store_apps ?? []).map(
    (item: any): AppStoreAppEntry => ({
      appStoreId: String(item.app_store_id),
      platform: item.platform,
      selfService: item.self_service,
      categories: item.categories,
      setupExperience: item.setup_experience,
      displayName: item.display_name,
      ...labelTargets(item),
    }),
  );

  return { declared: true, packages, fleetMaintainedApps, appStoreApps };
}

// ── Expansion ──────────────────────────────────────────────────────────────

/**
 * Expands a list whose entries are YAML entities — inline, or `path:` / `paths:`
 * references to files that each hold one entity or a list of them. `dir` is the
 * directory the entity's own relative paths resolve against.
 */
function expandEntities(entries: any[] | undefined, baseDir: string): Array<{ item: any; dir: string }> {
  if (!Array.isArray(entries)) return [];
  return entries.flatMap((entry) => {
    if (entry && typeof entry === 'object' && ('path' in entry || 'paths' in entry)) {
      return resolveRefs(entry, baseDir).flatMap((file) =>
        asList(loadYaml(file)).map((item) => ({ item, dir: path.dirname(file) })),
      );
    }
    return [{ item: entry, dir: baseDir }];
  });
}

/** Expands a list of `path:` / `paths:` references to the files themselves (scripts, profiles). */
function expandFiles(
  entries: any[] | undefined,
  baseDir: string,
  keep?: RegExp,
): Array<{ file: string; entry: any }> {
  if (!Array.isArray(entries)) return [];
  return entries.flatMap((entry) =>
    resolveRefs(entry, baseDir)
      .filter((file) => !keep || !('paths' in entry) || keep.test(file))
      .map((file) => ({ file, entry })),
  );
}

function resolveRefs(entry: any, baseDir: string): string[] {
  if (entry.path) return [path.resolve(baseDir, String(entry.path))];
  if (entry.paths) return globFiles(String(entry.paths), baseDir);
  return [];
}

/**
 * A small glob: `*` and `?` match within one path segment, `**` matches across
 * segments. Patterns are relative to the referencing file, like `path:`, and
 * the matches come back sorted so counts and sets are stable.
 */
function globFiles(pattern: string, baseDir: string): string[] {
  const absolute = path.resolve(baseDir, pattern);
  const segments = absolute.split(path.sep);
  const firstWild = segments.findIndex((s) => /[*?[{]/.test(s));
  if (firstWild === -1) return fs.existsSync(absolute) ? [absolute] : [];
  const root = segments.slice(0, firstWild).join(path.sep) || path.sep;
  const rest = segments.slice(firstWild).join('/');
  const regex = new RegExp(
    '^' +
      rest
        .split('/')
        .map((seg) =>
          seg === '**'
            ? '(?:[^/]+/)*'
            : seg.replace(/[.+^$()|\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]') + '/',
        )
        .join('')
        .replace(/\/$/, '') +
      '$',
  );
  const matches: string[] = [];
  const walk = (dir: string) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const rel = path.relative(root, full).split(path.sep).join('/');
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (regex.test(rel)) matches.push(full);
    }
  };
  if (fs.existsSync(root)) walk(root);
  return matches.sort();
}

// ── Helpers ────────────────────────────────────────────────────────────────

function loadYaml(file: string): Record<string, any> {
  const doc = yaml.load(fs.readFileSync(file, 'utf-8'));
  return expandEnv(doc, file) as Record<string, any>;
}

/** Expands `$VAR` / `${VAR}` throughout a document the way fleetctl does. */
function expandEnv(node: unknown, file: string, key?: string): unknown {
  if (typeof node === 'string') {
    if (key === 'description' || key === 'resolution') return node;
    return node.replace(/\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/g, (match, name: string) => {
      if (name.startsWith('FLEET_VAR_') || name.startsWith('FLEET_SECRET_')) return match;
      const value = process.env[name];
      if (value === undefined) {
        throw new Error(`${name} is not set, and ${file} references it as ${match}`);
      }
      return value;
    });
  }
  if (Array.isArray(node)) return node.map((item) => expandEnv(item, file, key));
  if (node && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node as Record<string, unknown>).map(([k, v]) => [k, expandEnv(v, file, k)]),
    );
  }
  return node;
}

function asList(doc: unknown): any[] {
  return Array.isArray(doc) ? doc : doc == null ? [] : [doc];
}

function labelTargets(item: any): LabelTargets {
  return stripUndefined({
    labelsIncludeAll: item?.labels_include_all,
    labelsIncludeAny: item?.labels_include_any,
    labelsExcludeAny: item?.labels_exclude_any,
  });
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

function scriptPlatform(p: string): ScriptEntry['platform'] {
  if (p.includes('/macos/') || p.includes('/darwin/')) return 'darwin';
  if (p.includes('/windows/') || p.endsWith('.ps1')) return 'windows';
  return 'linux';
}

function extractMacosProfileName(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    // A .mobileconfig is a plist with nested <dict> elements. The profile's
    // top-level PayloadDisplayName is the one with the smallest indentation;
    // PayloadDisplayName values inside <array>/<dict> belong to sub-payloads
    // (which Fleet does not use as the profile name).
    const lines = content.split('\n');
    let best: { indent: number; lineIdx: number } | null = null;
    for (let i = 0; i < lines.length; i++) {
      if (/<key>PayloadDisplayName<\/key>/.test(lines[i])) {
        const indent = lines[i].match(/^[\t ]*/)![0].length;
        if (best === null || indent < best.indent) {
          best = { indent, lineIdx: i };
        }
      }
    }
    if (best !== null) {
      for (let j = best.lineIdx + 1; j < lines.length; j++) {
        const m = lines[j].match(/<string>([^<]*)<\/string>/);
        if (m) return m[1];
      }
    }
  } catch {
    /* fall through to filename fallback */
  }
  return path.basename(filePath, path.extname(filePath));
}
