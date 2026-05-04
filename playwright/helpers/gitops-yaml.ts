/**
 * Parses a Fleet GitOps directory (default.yml + path-referenced files) into a
 * normalized shape that API-verify tests can compare against the live instance.
 *
 * Conventions:
 * - Policy / report / label names come from the `name:` field inside the .yml.
 * - Script names come from the file basename (Fleet uses the basename as the script name).
 * - Profile names: macOS reads <PayloadDisplayName> from the .mobileconfig;
 *   Windows / Android fall back to file basename without extension.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export interface PolicyEntry {
  name: string;
  platform?: string;
}

export interface ReportEntry {
  name: string;
  platform?: string;
}

export interface LabelEntry {
  name: string;
}

export interface ScriptEntry {
  name: string;
  platform: 'darwin' | 'windows' | 'linux';
}

export type ProfilePlatform = 'darwin' | 'windows' | 'android';

export interface ProfileEntry {
  name: string;
  platform: ProfilePlatform;
}

export type ConfigScope = 'no-team' | 'team';

export interface ParsedConfig {
  scope: ConfigScope;
  source: string; // dir for no-team, file path for team
  /** Team name; "No team" for the no-team / default.yml scope. */
  teamName: string;
  // Org-level — only meaningful for no-team scope
  orgName?: string;
  ssoEntityId?: string;
  ssoIdpName?: string;
  enableSso?: boolean;
  enableSoftwareInventory?: boolean;
  enableHostUsers?: boolean;
  windowsMdmEnabled?: boolean;
  // Common
  policies: PolicyEntry[];
  reports: ReportEntry[];
  labels: LabelEntry[];
  scripts: ScriptEntry[];
  profiles: ProfileEntry[];
}

export function loadGitOpsConfig(rootDir: string): ParsedConfig {
  const defaultYmlPath = path.join(rootDir, 'default.yml');
  const doc = yaml.load(fs.readFileSync(defaultYmlPath, 'utf-8')) as any;
  const resolve = (p: string) => path.resolve(rootDir, p);

  const policies = expandList<PolicyEntry>(doc.policies, resolve, (item) => ({
    name: item.name,
    platform: item.platform,
  }));

  const reports = expandList<ReportEntry>(doc.reports, resolve, (item) => ({
    name: item.name,
    platform: item.platform,
  }));

  const labels = expandList<LabelEntry>(doc.labels, resolve, (item) => ({
    name: item.name,
  }));

  const scripts: ScriptEntry[] = (doc.controls?.scripts ?? []).map((entry: any) => {
    const filePath = entry.path as string;
    const name = path.basename(filePath);
    return { name, platform: scriptPlatform(filePath) };
  });

  const profiles: ProfileEntry[] = [
    ...(doc.controls?.apple_settings?.configuration_profiles ?? []).map((entry: any) => ({
      name: extractMacosProfileName(resolve(entry.path)),
      platform: 'darwin' as const,
    })),
    ...(doc.controls?.windows_settings?.configuration_profiles ?? []).map((entry: any) => ({
      name: path.basename(entry.path, path.extname(entry.path)),
      platform: 'windows' as const,
    })),
    ...(doc.controls?.android_settings?.configuration_profiles ?? []).map((entry: any) => ({
      name: path.basename(entry.path, path.extname(entry.path)),
      platform: 'android' as const,
    })),
  ];

  const orgSettings = doc.org_settings;
  return {
    scope: 'no-team',
    source: rootDir,
    teamName: 'No team',
    orgName: orgSettings.org_info.org_name,
    ssoEntityId: orgSettings.sso_settings?.entity_id ?? '',
    ssoIdpName: orgSettings.sso_settings?.idp_name ?? '',
    enableSso: orgSettings.sso_settings?.enable_sso === true,
    enableSoftwareInventory: orgSettings.features?.enable_software_inventory === true,
    enableHostUsers: orgSettings.features?.enable_host_users === true,
    windowsMdmEnabled: doc.controls?.windows_enabled_and_configured === true,
    policies,
    reports,
    labels,
    scripts,
    profiles,
  };
}

/** Loads a `fleets/<name>.yml` file. Path references resolve relative to the file's directory. */
export function loadFleetConfig(filePath: string): ParsedConfig {
  const doc = yaml.load(fs.readFileSync(filePath, 'utf-8')) as any;
  const fileDir = path.dirname(filePath);
  const resolve = (p: string) => path.resolve(fileDir, p);

  const policies = expandList<PolicyEntry>(doc.policies, resolve, (item) => ({
    name: item.name,
    platform: item.platform,
  }));

  const reports = expandList<ReportEntry>(doc.reports, resolve, (item) => ({
    name: item.name,
    platform: item.platform,
  }));

  const scripts: ScriptEntry[] = (doc.controls?.scripts ?? []).map((entry: any) => {
    const fp = entry.path as string;
    return { name: path.basename(fp), platform: scriptPlatform(fp) };
  });

  const profiles: ProfileEntry[] = [
    ...(doc.controls?.apple_settings?.configuration_profiles ?? []).map((entry: any) => ({
      name: extractMacosProfileName(resolve(entry.path)),
      platform: 'darwin' as const,
    })),
    ...(doc.controls?.windows_settings?.configuration_profiles ?? []).map((entry: any) => ({
      name: path.basename(entry.path, path.extname(entry.path)),
      platform: 'windows' as const,
    })),
    ...(doc.controls?.android_settings?.configuration_profiles ?? []).map((entry: any) => ({
      name: path.basename(entry.path, path.extname(entry.path)),
      platform: 'android' as const,
    })),
  ];

  return {
    scope: 'team',
    source: filePath,
    teamName: doc.name,
    policies,
    reports,
    labels: [],    // labels are global
    scripts,
    profiles,
  };
}

/** Auto-detects: directory → no-team config; file → fleet config. */
export function loadAnyConfig(target: string): ParsedConfig {
  const stat = fs.statSync(target);
  return stat.isDirectory() ? loadGitOpsConfig(target) : loadFleetConfig(target);
}

function expandList<T>(
  entries: Array<{ path: string }> | undefined,
  resolveFn: (p: string) => string,
  map: (item: any) => T,
): T[] {
  if (!entries) return [];
  return entries.flatMap((entry) => {
    const filePath = resolveFn(entry.path);
    const items = yaml.load(fs.readFileSync(filePath, 'utf-8')) as any;
    return (Array.isArray(items) ? items : [items]).map(map);
  });
}

function scriptPlatform(p: string): ScriptEntry['platform'] {
  if (p.includes('/macos/')) return 'darwin';
  if (p.includes('/windows/')) return 'windows';
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
