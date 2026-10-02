/**
 * Resolves the ids the shape matrix refers to (`{HOST_FIRST}`, `{CVE_TOP}`, …)
 * and the dataset counts recorded with every run, once per worker.
 *
 * Every lookup is independent and failure-tolerant: a missing entity (no
 * policies in the fleet, no finished batch run) lands in `missing` with the
 * reason, and the shapes that need it are reported as skipped instead of
 * timing an empty response. Lookups deliberately avoid the request shapes
 * known to be slow or failing at scale — `os_versions` is read with a
 * platform filter, labels through `labels/summary`, titles with the default
 * sort — so resolution stays under a minute even on a struggling build.
 */
import { fetchJson, type Resolved } from '@helpers/perf-api';

export interface Resolution {
  version: string;
  resolved: Resolved;
  counts: Record<string, number | null>;
  missing: Record<string, string>;
}

interface HostRow { id: number; hostname: string; uuid: string; hardware_serial: string; display_name?: string }
interface LabelSummaryRow { id: number; name: string; label_type: string; label_membership_type?: string }
interface IdRow { id: number }

/** The UI's hosts table page size; deep-page shapes are computed against it. */
const HOSTS_PER_PAGE = 50;
const LIST_PER_PAGE = 20;

export async function resolveIds(fleetId: number): Promise<Resolution> {
  const resolved: Resolved = { FLEET: fleetId, HOST_EMAIL: 'john@example.com', HOST_EMAIL_LOCAL: 'john' };
  const counts: Record<string, number | null> = {};
  const missing: Record<string, string> = {};

  const attempt = async (names: string[], fn: () => Promise<Partial<Resolved>>) => {
    try {
      const got = await fn();
      for (const n of names) {
        if (got[n] === undefined || got[n] === '') missing[n] = 'not found';
        else resolved[n] = got[n];
      }
    } catch (e) {
      for (const n of names) missing[n] = (e as Error).message;
    }
  };
  const count = async (name: string, fn: () => Promise<number>) => {
    try {
      counts[name] = await fn();
    } catch {
      counts[name] = null;
    }
  };
  const lastPage = (total: number | null | undefined, perPage: number) =>
    total ? Math.max(0, Math.ceil(total / perPage) - 1) : undefined;

  const version = (await fetchJson<{ version: string }>('version')).version;
  const fleet = `fleet_id=${fleetId}`;

  // MDM-dependent endpoints answer 400 "MDM features aren't turned on" when no
  // MDM is configured; shapes that need `MDM` / `APPLE_MDM` skip instead.
  await attempt(['MDM', 'APPLE_MDM'], async () => {
    const { mdm } = await fetchJson<{ mdm: Record<string, boolean | undefined> }>('config');
    const apple = !!mdm.enabled_and_configured;
    const any = apple || !!mdm.windows_enabled_and_configured || !!mdm.android_enabled_and_configured;
    return { MDM: any ? 'on' : undefined, APPLE_MDM: apple ? 'on' : undefined };
  });
  for (const k of ['MDM', 'APPLE_MDM'] as const) {
    if (missing[k] === 'not found') missing[k] = `${k === 'MDM' ? 'MDM' : 'Apple MDM'} is not turned on in this Fleet instance`;
  }

  // ── Counts ──────────────────────────────────────────────────────────────────
  await count('hosts_fleet', async () => (await fetchJson<{ count: number }>(`hosts/count?${fleet}`)).count);
  await count('hosts_all', async () => (await fetchJson<{ count: number }>('hosts/count')).count);
  await count('software_titles', async () => (await fetchJson<{ count: number }>(`software/titles?${fleet}&per_page=1`)).count);
  await count('software_versions', async () => (await fetchJson<{ count: number }>(`software/versions?${fleet}&per_page=1`)).count);
  await count('vulnerabilities', async () => (await fetchJson<{ count: number }>(`vulnerabilities?${fleet}&per_page=1`)).count);
  await count('os_versions_darwin', async () => (await fetchJson<{ count: number }>(`os_versions?${fleet}&platform=darwin&per_page=1`)).count);
  await count('labels', async () => (await fetchJson<{ labels: LabelSummaryRow[] }>('labels/summary')).labels.length);
  await count('policies_fleet', async () => (await fetchJson<{ count: number }>(`fleets/${fleetId}/policies/count`)).count);
  await count('policies_global', async () => (await fetchJson<{ count: number }>('policies/count')).count);
  await count('reports_fleet', async () => (await fetchJson<{ count: number }>(`reports?${fleet}&per_page=1`)).count);
  await count('reports_global', async () => (await fetchJson<{ count: number }>('reports?per_page=1')).count);
  await count('profiles_fleet', async () => ((await fetchJson<{ profiles: unknown[] | null }>(`configuration_profiles?${fleet}&per_page=1000`)).profiles ?? []).length);
  await count('scripts_fleet', async () => ((await fetchJson<{ scripts: unknown[] | null }>(`scripts?${fleet}&per_page=2000`)).scripts ?? []).length);
  await count('installers_fleet', async () => (await fetchJson<{ count: number }>(`software/titles?${fleet}&available_for_install=true&per_page=1`)).count);
  await count('users', async () => ((await fetchJson<{ users: unknown[] }>('users')).users ?? []).length);
  await count('custom_variables', async () => (await fetchJson<{ count: number }>('custom_variables')).count);

  // ── Hosts ───────────────────────────────────────────────────────────────────
  await attempt(['HOST_FIRST', 'HOST_NAME', 'HOST_UUID', 'HOST_SERIAL', 'HOST_PREFIX'], async () => {
    const { hosts } = await fetchJson<{ hosts: HostRow[] }>(`hosts?${fleet}&per_page=1&order_key=display_name&order_direction=asc`);
    const h = hosts[0];
    if (!h) return {};
    return { HOST_FIRST: h.id, HOST_NAME: h.hostname, HOST_UUID: h.uuid, HOST_SERIAL: h.hardware_serial, HOST_PREFIX: h.hostname.slice(0, 3) };
  });
  await attempt(['HOST_ISSUES', 'HOST_ISSUES_UUID', 'HOST_ISSUES_SERIAL'], async () => {
    const { hosts } = await fetchJson<{ hosts: HostRow[] }>(`hosts?${fleet}&per_page=1&order_key=issues&order_direction=desc`, 90_000);
    const h = hosts[0];
    return h ? { HOST_ISSUES: h.id, HOST_ISSUES_UUID: h.uuid, HOST_ISSUES_SERIAL: h.hardware_serial } : {};
  });

  // ── Labels: built-ins by name from the summary; the custom dynamic / manual
  // ones from the full list (host counts off — with them on it is a 40 s call),
  // since only the full list carries `label_membership_type`.
  await attempt(['LABEL_ALL', 'LABEL_MAC', 'LABEL_WIN', 'LABEL_LINUX'], async () => {
    const { labels } = await fetchJson<{ labels: LabelSummaryRow[] }>('labels/summary');
    const byName = (re: RegExp) => labels.find((l) => l.label_type === 'builtin' && re.test(l.name))?.id;
    return {
      LABEL_ALL: byName(/^all hosts$/i),
      LABEL_MAC: byName(/^macos$/i),
      LABEL_WIN: byName(/^(ms )?windows$/i),
      LABEL_LINUX: byName(/^(all )?linux$/i),
    };
  });
  await attempt(['LABEL_DYN', 'LABEL_MANUAL'], async () => {
    const { labels } = await fetchJson<{ labels: LabelSummaryRow[] }>('labels?include_host_counts=false');
    const custom = labels.filter((l) => l.label_type === 'regular');
    return {
      LABEL_DYN: (custom.find((l) => l.label_membership_type === 'dynamic') ?? custom[0])?.id,
      LABEL_MANUAL: custom.find((l) => l.label_membership_type === 'manual')?.id,
    };
  });
  await attempt(['HOST_WIN', 'HOST_WIN_UUID', 'HOST_WIN_SERIAL'], async () => {
    if (resolved.LABEL_WIN === undefined) throw new Error('no Windows built-in label');
    const { hosts } = await fetchJson<{ hosts: HostRow[] }>(`labels/${resolved.LABEL_WIN}/hosts?${fleet}&per_page=1`);
    const h = hosts[0];
    return h ? { HOST_WIN: h.id, HOST_WIN_UUID: h.uuid, HOST_WIN_SERIAL: h.hardware_serial } : {};
  });

  // ── Software, vulnerabilities, OS ───────────────────────────────────────────
  await attempt(['TITLE_TOP'], async () => {
    const { software_titles } = await fetchJson<{ software_titles: IdRow[] }>(`software/titles?${fleet}&per_page=1&order_key=hosts_count&order_direction=desc`);
    return { TITLE_TOP: software_titles[0]?.id };
  });
  await attempt(['TITLE_INSTALLER'], async () => {
    const { software_titles } = await fetchJson<{ software_titles: IdRow[] }>(`software/titles?${fleet}&per_page=1&available_for_install=true`, 90_000);
    return { TITLE_INSTALLER: software_titles[0]?.id };
  });
  await attempt(['VERSION_TOP'], async () => {
    const { software } = await fetchJson<{ software: IdRow[] }>(`software/versions?${fleet}&per_page=1&order_key=hosts_count&order_direction=desc`);
    return { VERSION_TOP: software[0]?.id };
  });
  await attempt(['CVE_TOP'], async () => {
    const { vulnerabilities } = await fetchJson<{ vulnerabilities: Array<{ cve: string }> }>(`vulnerabilities?${fleet}&per_page=1&order_key=hosts_count&order_direction=desc`, 90_000);
    return { CVE_TOP: vulnerabilities[0]?.cve };
  });
  await attempt(['CVE_RARE'], async () => {
    const { vulnerabilities } = await fetchJson<{ vulnerabilities: Array<{ cve: string }> }>(`vulnerabilities?${fleet}&per_page=1&order_key=hosts_count&order_direction=asc`, 90_000);
    return { CVE_RARE: vulnerabilities[0]?.cve };
  });
  await attempt(['OSV_ID', 'OS_NAME', 'OS_VERSION'], async () => {
    const { os_versions } = await fetchJson<{ os_versions: Array<{ os_version_id: number; name_only: string; version: string }> }>(`os_versions?${fleet}&platform=darwin&per_page=1`);
    const o = os_versions[0];
    return o ? { OSV_ID: o.os_version_id, OS_NAME: o.name_only, OS_VERSION: o.version } : {};
  });

  // ── Policies, reports, controls, admin ──────────────────────────────────────
  await attempt(['POLICY_G'], async () => {
    const { policies } = await fetchJson<{ policies: IdRow[] | null }>('policies?per_page=1');
    return { POLICY_G: policies?.[0]?.id };
  });
  await attempt(['POLICY_T'], async () => {
    const { policies } = await fetchJson<{ policies: IdRow[] | null }>(`fleets/${fleetId}/policies?per_page=1`);
    return { POLICY_T: policies?.[0]?.id };
  });
  await attempt(['REPORT_G'], async () => {
    const { reports } = await fetchJson<{ reports: IdRow[] | null }>('reports?per_page=1');
    return { REPORT_G: reports?.[0]?.id };
  });
  await attempt(['REPORT_T'], async () => {
    const { reports } = await fetchJson<{ reports: IdRow[] | null }>(`reports?${fleet}&per_page=1`);
    return { REPORT_T: reports?.[0]?.id };
  });
  await attempt(['PROFILE_UUID'], async () => {
    const { profiles } = await fetchJson<{ profiles: Array<{ profile_uuid: string }> | null }>(`configuration_profiles?${fleet}&per_page=1`);
    return { PROFILE_UUID: profiles?.[0]?.profile_uuid };
  });
  await attempt(['SCRIPT_ID'], async () => {
    const { scripts } = await fetchJson<{ scripts: IdRow[] | null }>(`scripts?${fleet}&per_page=1`);
    return { SCRIPT_ID: scripts?.[0]?.id };
  });
  await attempt(['BATCH_ID'], async () => {
    const body = await fetchJson<Record<string, Array<{ batch_execution_id: string }> | null>>(`scripts/batch?${fleet}&status=finished`);
    const list = body.batch_executions ?? body.batch_script_executions ?? [];
    return { BATCH_ID: list[0]?.batch_execution_id };
  });
  await attempt(['USER_ID'], async () => {
    const { users } = await fetchJson<{ users: IdRow[] }>('users?per_page=1');
    return { USER_ID: users[0]?.id };
  });

  // ── Deep pages, from the counts above ───────────────────────────────────────
  const pages: Array<[string, number | null | undefined, number]> = [
    ['HOSTS_LAST_PAGE', counts.hosts_fleet, HOSTS_PER_PAGE],
    ['TITLES_LAST_PAGE', counts.software_titles, LIST_PER_PAGE],
    ['VERSIONS_LAST_PAGE', counts.software_versions, LIST_PER_PAGE],
    ['CVES_LAST_PAGE', counts.vulnerabilities, LIST_PER_PAGE],
  ];
  for (const [name, total, perPage] of pages) {
    const p = lastPage(total, perPage);
    if (p === undefined) missing[name] = 'count unavailable';
    else resolved[name] = p;
  }

  return { version, resolved, counts, missing };
}
