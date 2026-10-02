/**
 * The request matrix the `loadtest-api` project times. One entry per request
 * shape; `helpers/perf-api.ts` expands scope variants and `hosts/count` twins
 * and resolves the `{PLACEHOLDER}` ids from `resolve.ts`.
 *
 * The matrix follows docs/test-plans/loadtest-api-timing.md §6: every
 * allowlisted `order_key` on the list endpoints (fleetdm/fleet#44388 asked for
 * exactly that inventory), every filter the UI exposes, the payload expanders,
 * deep pages, exports, and the detail fan-outs — with the shapes that broke at
 * scale before carrying their issue number. Priorities decide the sample
 * count: P0 = known-broken or a UI default request, P1 = allowlisted but never
 * measured, P2 = long tail.
 *
 * Paths are relative to `/api/latest/fleet`; `scope: 'both'` (the default)
 * emits a `fleet_id` variant and a no-`fleet_id` variant, since the two
 * aggregate differently in `software_host_counts` / `vulnerability_host_counts`.
 */
import type { Params, Priority, Shape, ShapeScope } from '@helpers/perf-api';

type Opts = Partial<Pick<Shape, 'scope' | 'priority' | 'issue' | 'needs' | 'countTwin' | 'optional' | 'samples'>>;

function family(name: string) {
  return (id: string, label: string, path: string, params: Params = {}, opts: Opts = {}): Shape => ({
    family: name,
    id: `${name}.${id}`,
    label,
    path,
    params,
    priority: opts.priority ?? 'P1',
    scope: opts.scope,
    issue: opts.issue,
    needs: opts.needs,
    countTwin: opts.countTwin,
    optional: opts.optional,
    samples: opts.samples,
  });
}

const DIRS = ['asc', 'desc'] as const;
const PLATFORMS = ['darwin', 'windows', 'linux', 'ios', 'ipados', 'android', 'chrome'] as const;

// ── hosts ────────────────────────────────────────────────────────────────────

const H = family('hosts');
const HOSTS: Shape[] = [];
const hostsBase: Params = { per_page: 50 };

HOSTS.push(H('base', 'hosts, no sort (control)', 'hosts', hostsBase, { priority: 'P0', countTwin: true }));

// The UI's default sort, and the sorts that join or aggregate (issues, seen_time).
for (const dir of DIRS) {
  HOSTS.push(H(`sort.display_name.${dir}`, `hosts order display_name ${dir} (UI default)`, 'hosts', { ...hostsBase, order_key: 'display_name', order_direction: dir }, { priority: 'P0', countTwin: dir === 'asc' }));
  HOSTS.push(H(`sort.issues.${dir}`, `hosts order issues ${dir}`, 'hosts', { ...hostsBase, order_key: 'issues', order_direction: dir }, { priority: 'P0' }));
  HOSTS.push(H(`sort.seen_time.${dir}`, `hosts order seen_time ${dir}`, 'hosts', { ...hostsBase, order_key: 'seen_time', order_direction: dir }, { priority: 'P0' }));
  HOSTS.push(H(`sort.hostname.${dir}`, `hosts order hostname ${dir}`, 'hosts', { ...hostsBase, order_key: 'hostname', order_direction: dir }, { scope: 'fleet' }));
  HOSTS.push(H(`sort.os_version.${dir}`, `hosts order os_version ${dir}`, 'hosts', { ...hostsBase, order_key: 'os_version', order_direction: dir }, { scope: 'fleet' }));
  HOSTS.push(H(`sort.memory.${dir}`, `hosts order memory ${dir}`, 'hosts', { ...hostsBase, order_key: 'memory', order_direction: dir }, { scope: 'fleet' }));
}
// The rest of hostAllowedOrderKeys (server/datastore/mysql/hosts.go), descending.
for (const key of [
  'computer_name', 'last_restarted_at', 'last_enrolled_at', 'created_at', 'updated_at', 'detail_updated_at',
  'platform', 'osquery_version', 'cpu_type', 'hardware_vendor', 'hardware_model', 'hardware_serial',
  'primary_ip', 'primary_mac', 'public_ip', 'team_name', 'agent', 'fleet_desktop_version', 'software_updated_at',
  'gigs_disk_space_available', 'percent_disk_space_available', 'gigs_total_disk_space', 'uuid', 'id',
  'label_updated_at', 'policy_updated_at',
]) {
  HOSTS.push(H(`sort.${key}.desc`, `hosts order ${key} desc`, 'hosts', { ...hostsBase, order_key: key, order_direction: 'desc' }, { scope: 'fleet', issue: 'fleetdm/fleet#44388' }));
}

// Offset pagination with the UI default sort.
for (const page of [100, 1000]) {
  HOSTS.push(H(`page.${page}`, `hosts page ${page}`, 'hosts', { ...hostsBase, page, order_key: 'display_name', order_direction: 'asc' }, { priority: 'P0', scope: 'fleet' }));
}
HOSTS.push(H('page.last', 'hosts last page', 'hosts', { ...hostsBase, page: '{HOSTS_LAST_PAGE}', order_key: 'display_name', order_direction: 'asc' }, { priority: 'P0', scope: 'fleet' }));
for (const perPage of [100, 500]) {
  HOSTS.push(H(`per_page.${perPage}`, `hosts per_page ${perPage}`, 'hosts', { per_page: perPage }, { priority: 'P2', scope: 'fleet' }));
}

for (const status of ['online', 'offline', 'new', 'missing', 'mia', 'enrolled']) {
  HOSTS.push(H(`status.${status}`, `hosts status=${status}`, 'hosts', { ...hostsBase, status }, { priority: 'P0', countTwin: true }));
}

// Search: the hosts search box hits hostname, serial, uuid, ipv4 and end-user email (fleetdm/fleet#15744).
const searches: Array<[string, string, Priority]> = [
  ['prefix', '{HOST_PREFIX}', 'P0'],
  ['hostname', '{HOST_NAME}', 'P0'],
  ['serial', '{HOST_SERIAL}', 'P0'],
  ['uuid', '{HOST_UUID}', 'P1'],
  ['ipv4', '10.', 'P1'],
  ['email_local', '{HOST_EMAIL_LOCAL}', 'P0'],
  ['email', '{HOST_EMAIL}', 'P0'],
  ['one_char', 'a', 'P1'],
];
for (const [name, query, priority] of searches) {
  HOSTS.push(H(`query.${name}`, `hosts query=${name}`, 'hosts', { ...hostsBase, query }, { priority, scope: 'fleet', countTwin: true, issue: 'fleetdm/fleet#15744' }));
}
for (const [name, query] of [['prefix', '{HOST_PREFIX}'], ['email', '{HOST_EMAIL}']]) {
  HOSTS.push(H(`query.${name}.device_mapping`, `hosts query=${name} + device_mapping`, 'hosts', { per_page: 100, query, device_mapping: true }, { priority: 'P0', scope: 'fleet', countTwin: true, issue: 'fleetdm/fleet#47722' }));
}

// Platform and custom labels go through labels/{id}/hosts, as the UI does.
const labelShapes: Array<[string, string, Priority, ShapeScope]> = [
  ['all', 'LABEL_ALL', 'P0', 'both'],
  ['macos', 'LABEL_MAC', 'P0', 'both'],
  ['windows', 'LABEL_WIN', 'P0', 'fleet'],
  ['linux', 'LABEL_LINUX', 'P1', 'fleet'],
  ['dynamic', 'LABEL_DYN', 'P0', 'fleet'],
  ['manual', 'LABEL_MANUAL', 'P1', 'fleet'],
];
for (const [name, ph, priority, scope] of labelShapes) {
  HOSTS.push(H(`label.${name}`, `hosts in ${name} label`, `labels/{${ph}}/hosts`, hostsBase, { priority, scope }));
  HOSTS.push(H(`label.${name}.count`, `hosts/count label ${name}`, 'hosts/count', { label_id: `{${ph}}` }, { priority: 'P1', scope }));
}
HOSTS.push(H('label.all.sorted', 'hosts in All Hosts, display_name asc', 'labels/{LABEL_ALL}/hosts', { ...hostsBase, order_key: 'display_name', order_direction: 'asc' }, { priority: 'P0', scope: 'fleet' }));
HOSTS.push(H('label.all.last_page', 'hosts in All Hosts, last page', 'labels/{LABEL_ALL}/hosts', { ...hostsBase, page: '{HOSTS_LAST_PAGE}', order_key: 'display_name', order_direction: 'asc' }, { priority: 'P0', scope: 'fleet' }));
HOSTS.push(H('label.all.online', 'hosts in All Hosts, status=online', 'labels/{LABEL_ALL}/hosts', { ...hostsBase, status: 'online' }, { priority: 'P1', scope: 'fleet' }));
HOSTS.push(H('label.dynamic.online', 'hosts in dynamic label, status=online', 'labels/{LABEL_DYN}/hosts', { ...hostsBase, status: 'online' }, { priority: 'P1', scope: 'fleet' }));

// Entity filters: the "view all hosts" links from policies, software, OS and CVEs.
for (const resp of ['failing', 'passing']) {
  HOSTS.push(H(`policy.global.${resp}`, `hosts policy_id (global) ${resp}`, 'hosts', { ...hostsBase, policy_id: '{POLICY_G}', policy_response: resp }, { priority: 'P0', countTwin: true }));
  HOSTS.push(H(`policy.fleet.${resp}`, `hosts policy_id (fleet) ${resp}`, 'hosts', { ...hostsBase, policy_id: '{POLICY_T}', policy_response: resp }, { priority: 'P0', scope: 'fleet', countTwin: true }));
}
HOSTS.push(H('software_title_id', 'hosts software_title_id', 'hosts', { ...hostsBase, software_title_id: '{TITLE_TOP}' }, { scope: 'fleet', countTwin: true }));
HOSTS.push(H('software_version_id', 'hosts software_version_id', 'hosts', { ...hostsBase, software_version_id: '{VERSION_TOP}' }, { scope: 'fleet', countTwin: true }));
for (const st of ['installed', 'pending', 'failed']) {
  HOSTS.push(H(`software_status.${st}`, `hosts software_title_id + software_status=${st}`, 'hosts', { ...hostsBase, software_title_id: '{TITLE_INSTALLER}', software_status: st }, { scope: 'fleet', countTwin: true }));
}
HOSTS.push(H('os_version_id', 'hosts os_version_id', 'hosts', { ...hostsBase, os_version_id: '{OSV_ID}' }, { scope: 'fleet', countTwin: true }));
HOSTS.push(H('os_name_version', 'hosts os_name + os_version', 'hosts', { ...hostsBase, os_name: '{OS_NAME}', os_version: '{OS_VERSION}' }, { scope: 'fleet', countTwin: true }));
HOSTS.push(H('vulnerability.top', 'hosts vulnerability=<most hosts>', 'hosts', { ...hostsBase, vulnerability: '{CVE_TOP}' }, { priority: 'P0', countTwin: true, issue: 'fleetdm/fleet#52213' }));
HOSTS.push(H('vulnerability.rare', 'hosts vulnerability=<fewest hosts>', 'hosts', { ...hostsBase, vulnerability: '{CVE_RARE}' }, { priority: 'P0', countTwin: true, issue: 'fleetdm/fleet#52213' }));

// MDM filters.
// The REST docs say `manual-personal`; the server constant is `personal`
// (server/fleet/hosts.go MDMEnrollStatusPersonal) and rejects the documented
// spelling with 400.
for (const st of ['enrolled', 'manual', 'automatic', 'pending', 'unenrolled', 'personal']) {
  HOSTS.push(H(`mdm_enrollment_status.${st}`, `hosts mdm_enrollment_status=${st}`, 'hosts', { ...hostsBase, mdm_enrollment_status: st }, { scope: 'fleet', countTwin: true }));
}
HOSTS.push(H('mdm_name.fleet', 'hosts mdm_name=Fleet', 'hosts', { ...hostsBase, mdm_name: 'Fleet' }, { scope: 'fleet', countTwin: true }));
HOSTS.push(H('connected_to_fleet', 'hosts connected_to_fleet=true', 'hosts', { ...hostsBase, connected_to_fleet: true }, { scope: 'fleet', countTwin: true }));
for (const st of ['verified', 'verifying', 'pending', 'failed']) {
  HOSTS.push(H(`os_settings.${st}`, `hosts os_settings=${st}`, 'hosts', { ...hostsBase, os_settings: st }, { priority: 'P0', scope: 'fleet', countTwin: true, issue: 'fleetdm/fleet#48996' }));
  HOSTS.push(H(`macos_settings.${st}`, `hosts macos_settings=${st}`, 'hosts', { ...hostsBase, macos_settings: st }, { scope: 'fleet', countTwin: true }));
}
for (const st of ['verified', 'enforcing', 'action_required', 'failed']) {
  HOSTS.push(H(`os_settings_disk_encryption.${st}`, `hosts os_settings_disk_encryption=${st}`, 'hosts', { ...hostsBase, os_settings_disk_encryption: st }, { scope: 'fleet', countTwin: true }));
}
for (const st of ['installed', 'pending', 'failed']) {
  HOSTS.push(H(`bootstrap_package.${st}`, `hosts bootstrap_package=${st}`, 'hosts', { ...hostsBase, bootstrap_package: st }, { scope: 'fleet', countTwin: true }));
}
for (const st of ['verified', 'pending', 'failed']) {
  HOSTS.push(H(`profile_status.${st}`, `hosts profile_uuid + profile_status=${st}`, 'hosts', { ...hostsBase, profile_uuid: '{PROFILE_UUID}', profile_status: st }, { scope: 'fleet', countTwin: true }));
}
HOSTS.push(H('dep_profile_error', 'hosts dep_profile_error=true', 'hosts', { ...hostsBase, dep_profile_error: true }, { scope: 'fleet', countTwin: true }));
HOSTS.push(H('dep_assign_profile_response', 'hosts dep_assign_profile_response=SUCCESS', 'hosts', { ...hostsBase, dep_assign_profile_response: 'SUCCESS' }, { scope: 'fleet', countTwin: true }));
for (const gb of [10, 32]) {
  HOSTS.push(H(`low_disk_space.${gb}`, `hosts low_disk_space=${gb}`, 'hosts', { ...hostsBase, low_disk_space: gb }, { scope: 'fleet', countTwin: true }));
}
for (const st of ['ran', 'pending', 'errored']) {
  HOSTS.push(H(`script_batch.${st}`, `hosts script_batch_execution_status=${st}`, 'hosts', { ...hostsBase, script_batch_execution_id: '{BATCH_ID}', script_batch_execution_status: st }, { scope: 'fleet' }));
}

// Payload expanders — each changes the per-row cost, not the row count.
HOSTS.push(H('populate_software.true', 'hosts populate_software=true', 'hosts', { ...hostsBase, populate_software: true }, { priority: 'P0', scope: 'fleet' }));
HOSTS.push(H('populate_software.no_details', 'hosts populate_software=without_vulnerability_details', 'hosts', { ...hostsBase, populate_software: 'without_vulnerability_details' }, { priority: 'P0', scope: 'fleet' }));
for (const p of ['populate_policies', 'populate_users', 'populate_labels', 'include_device_status', 'device_mapping']) {
  HOSTS.push(H(`${p}`, `hosts ${p}=true`, 'hosts', { ...hostsBase, [p]: true }, { priority: 'P0', scope: 'fleet' }));
}
HOSTS.push(H('disable_failing_policies', 'hosts disable_failing_policies=true (documented fast path)', 'hosts', { ...hostsBase, disable_failing_policies: true }, { priority: 'P0', scope: 'fleet' }));

// Realistic combinations.
HOSTS.push(H('combo.label_online_query', 'hosts macOS label + online + query', 'labels/{LABEL_MAC}/hosts', { ...hostsBase, status: 'online', query: '{HOST_PREFIX}' }, { scope: 'fleet' }));
HOSTS.push(H('combo.os_settings_failed_issues', 'hosts os_settings=failed + order issues', 'hosts', { ...hostsBase, os_settings: 'failed', order_key: 'issues', order_direction: 'desc' }, { scope: 'fleet', countTwin: true }));
HOSTS.push(H('combo.vuln_sorted', 'hosts vulnerability + order display_name', 'hosts', { ...hostsBase, vulnerability: '{CVE_TOP}', order_key: 'display_name', order_direction: 'asc' }, { scope: 'fleet' }));

// Export hosts (CSV) — a full dump of the filtered view.
HOSTS.push(H('report.csv', 'hosts/report csv', 'hosts/report', { format: 'csv' }, { priority: 'P0', samples: 5 }));
HOSTS.push(H('report.csv.label', 'hosts/report csv, macOS label', 'hosts/report', { format: 'csv', label_id: '{LABEL_MAC}' }, { priority: 'P0', scope: 'fleet', samples: 5 }));
HOSTS.push(H('report.csv.online', 'hosts/report csv, status=online', 'hosts/report', { format: 'csv', status: 'online' }, { scope: 'fleet', samples: 3 }));
HOSTS.push(H('report.csv.query', 'hosts/report csv, query', 'hosts/report', { format: 'csv', query: '{HOST_PREFIX}' }, { scope: 'fleet', samples: 3 }));
HOSTS.push(H('report.csv.columns', 'hosts/report csv, three columns', 'hosts/report', { format: 'csv', columns: 'hostname,hardware_serial,os_version' }, { scope: 'fleet', samples: 3 }));

// Summaries the dashboard and the hosts page header load.
HOSTS.push(H('host_summary', 'host_summary', 'host_summary', {}, { priority: 'P0' }));
for (const p of PLATFORMS) {
  HOSTS.push(H(`host_summary.${p}`, `host_summary platform=${p}`, 'host_summary', { platform: p }, { priority: 'P0', scope: 'fleet' }));
}
HOSTS.push(H('host_summary.low_disk_space', 'host_summary low_disk_space=32', 'host_summary', { low_disk_space: 32 }, { priority: 'P0', scope: 'fleet' }));
HOSTS.push(H('summary.mdm', 'hosts/summary/mdm', 'hosts/summary/mdm', {}, { priority: 'P0' }));
HOSTS.push(H('summary.mdm.darwin', 'hosts/summary/mdm platform=darwin', 'hosts/summary/mdm', { platform: 'darwin' }, { scope: 'fleet' }));
HOSTS.push(H('macadmins', 'macadmins (dashboard MDM/Munki card)', 'macadmins', {}, { priority: 'P0' }));

// ── host-details (three hosts: first by name, most issues, a Windows one) ────

const D = family('host-details');
const DETAILS: Shape[] = [];
const hostTargets: Array<[string, string, string, string, Priority]> = [
  ['first', 'HOST_FIRST', 'HOST_UUID', 'HOST_SERIAL', 'P0'],
  ['issues', 'HOST_ISSUES', 'HOST_ISSUES_UUID', 'HOST_ISSUES_SERIAL', 'P0'],
  ['windows', 'HOST_WIN', 'HOST_WIN_UUID', 'HOST_WIN_SERIAL', 'P0'],
];
for (const [name, id, uuid, serial, base] of hostTargets) {
  const g = { scope: 'global' as const };
  const d = (sid: string, label: string, path: string, params: Params = {}, opts: Opts = {}) =>
    DETAILS.push(D(`${name}.${sid}`, `${label} (${name} host)`, path, params, { ...g, priority: base, ...opts }));
  const sw = `hosts/{${id}}/software`;
  d('host', 'hosts/{id}', `hosts/{${id}}`);
  d('identifier', 'hosts/identifier/{serial}', `hosts/identifier/{${serial}}`);
  d('identifier.exclude_software', 'hosts/identifier/{serial} exclude_software', `hosts/identifier/{${serial}}`, { exclude_software: true }, { priority: 'P1' });
  d('software', 'host software', sw, { per_page: 20 }, { issue: 'fleetdm/fleet#51896' });
  d('software.name_desc', 'host software order name desc', sw, { per_page: 20, order_key: 'name', order_direction: 'desc' }, { priority: 'P1' });
  d('software.per_page_100', 'host software per_page 100', sw, { per_page: 100 }, { priority: 'P1' });
  d('software.query', 'host software query', sw, { per_page: 20, query: 'a' }, { priority: 'P1' });
  d('software.vulnerable', 'host software vulnerable', sw, { per_page: 20, vulnerable: true });
  d('software.exploit', 'host software exploit', sw, { per_page: 20, vulnerable: true, exploit: true }, { priority: 'P1' });
  d('software.min_cvss', 'host software min_cvss 7', sw, { per_page: 20, vulnerable: true, min_cvss_score: 7 }, { priority: 'P1' });
  d('software.available_for_install', 'host software available_for_install (Library)', sw, { per_page: 20, available_for_install: true });
  d('software.include_available', 'host software include_available_for_install', sw, { per_page: 20, include_available_for_install: true }, { priority: 'P1' });
  d('software.self_service', 'host software self_service', sw, { per_page: 20, self_service: true }, { priority: 'P1' });
  d('software.macos_applications', 'host software macos_applications', sw, { per_page: 20, macos_applications: true }, { priority: 'P2' });
  d('activities', 'host past activities', `hosts/{${id}}/activities`, { per_page: 10 }, { priority: 'P1' });
  d('activities.page_100', 'host past activities page 100', `hosts/{${id}}/activities`, { per_page: 10, page: 100 }, { priority: 'P2' });
  d('activities.upcoming', 'host upcoming activities', `hosts/{${id}}/activities/upcoming`, { per_page: 10 }, { priority: 'P1' });
  d('reports', 'host reports', `hosts/{${id}}/reports`, {}, { priority: 'P1' });
  d('reports.one', 'host report rows', `hosts/{${id}}/reports/{REPORT_G}`, {}, { priority: 'P1' });
  d('configuration_profiles', 'host configuration profiles', `hosts/{${id}}/configuration_profiles`, {}, { priority: 'P1', optional: true });
  d('certificates', 'host certificates', `hosts/{${id}}/certificates`, {}, { priority: 'P1' });
  d('certificates.sorted', 'host certificates order not_valid_after', `hosts/{${id}}/certificates`, { order_key: 'not_valid_after', order_direction: 'asc' }, { priority: 'P2' });
  d('scripts', 'host scripts', `hosts/{${id}}/scripts`, {}, { priority: 'P1' });
  d('device_mapping', 'host device mapping', `hosts/{${id}}/device_mapping`, {}, { priority: 'P1' });
  d('macadmins', 'host macadmins', `hosts/{${id}}/macadmins`, {}, { priority: 'P1' });
  d('mdm', 'host mdm', `hosts/{${id}}/mdm`, {}, { priority: 'P1', optional: true });
  d('encryption_key', 'host encryption key', `hosts/{${id}}/encryption_key`, {}, { priority: 'P2', optional: true });
  d('health', 'host health', `hosts/{${id}}/health`, {}, { priority: 'P2' });
  d('dep_assignment', 'host DEP assignment', `hosts/{${id}}/dep_assignment`, {}, { priority: 'P2', optional: true });
  const mdm = { needs: ['MDM'] };
  d('commands', 'commands for host', 'commands', { host_identifier: `{${uuid}}`, per_page: 10 }, { ...mdm, issue: 'fleetdm/fleet#44170' });
  for (const st of ['ran', 'pending', 'failed']) {
    d(`commands.${st}`, `commands for host status=${st}`, 'commands', { host_identifier: `{${uuid}}`, per_page: 10, command_status: st }, { ...mdm, priority: 'P1', issue: 'fleetdm/fleet#44170' });
  }
  d('commands.request_type', 'commands for host request_type=InstallProfile', 'commands', { host_identifier: `{${uuid}}`, per_page: 10, request_type: 'InstallProfile' }, { ...mdm, priority: 'P2' });
  d('commands.sorted', 'commands for host order updated_at desc', 'commands', { host_identifier: `{${uuid}}`, per_page: 10, order_key: 'updated_at', order_direction: 'desc' }, { ...mdm, priority: 'P1' });
  d('commands.page_10', 'commands for host page 10', 'commands', { host_identifier: `{${uuid}}`, per_page: 10, page: 10 }, { ...mdm, priority: 'P2' });
}

// ── software ─────────────────────────────────────────────────────────────────

const S = family('software');
const SOFTWARE: Shape[] = [];
const titles = 'software/titles';
const versions = 'software/versions';
const pg: Params = { per_page: 20 };

SOFTWARE.push(S('titles', 'titles default (hosts_count desc)', titles, pg, { priority: 'P0' }));
for (const dir of DIRS) {
  SOFTWARE.push(S(`titles.sort.name.${dir}`, `titles order name ${dir}`, titles, { ...pg, order_key: 'name', order_direction: dir }, { priority: 'P0', issue: 'fleetdm/fleet#35799' }));
}
SOFTWARE.push(S('titles.sort.hosts_count.asc', 'titles order hosts_count asc', titles, { ...pg, order_key: 'hosts_count', order_direction: 'asc' }, { priority: 'P0' }));
for (const page of [100, 1000]) {
  SOFTWARE.push(S(`titles.page.${page}`, `titles page ${page}`, titles, { ...pg, page }, { priority: 'P0', scope: 'fleet' }));
}
SOFTWARE.push(S('titles.page.last', 'titles last page', titles, { ...pg, page: '{TITLES_LAST_PAGE}' }, { priority: 'P0', scope: 'fleet' }));
SOFTWARE.push(S('titles.page.1000.name', 'titles page 1000, order name', titles, { ...pg, page: 1000, order_key: 'name', order_direction: 'asc' }, { priority: 'P0', scope: 'fleet', issue: 'fleetdm/fleet#35799' }));
SOFTWARE.push(S('titles.vulnerable', 'titles vulnerable=true', titles, { ...pg, vulnerable: true }, { priority: 'P0', issue: 'fleetdm/fleet#51954' }));
SOFTWARE.push(S('titles.exploit', 'titles vulnerable + exploit', titles, { ...pg, vulnerable: true, exploit: true }, { priority: 'P0', issue: 'fleetdm/fleet#35799' }));
SOFTWARE.push(S('titles.min_cvss', 'titles vulnerable + min_cvss 7', titles, { ...pg, vulnerable: true, min_cvss_score: 7 }, { priority: 'P0', issue: 'fleetdm/fleet#35799' }));
SOFTWARE.push(S('titles.max_cvss', 'titles vulnerable + max_cvss 8', titles, { ...pg, vulnerable: true, max_cvss_score: 8 }, { priority: 'P0', issue: 'fleetdm/fleet#35799' }));
SOFTWARE.push(S('titles.cvss_range', 'titles vulnerable + cvss 7–9', titles, { ...pg, vulnerable: true, min_cvss_score: 7, max_cvss_score: 9 }, { priority: 'P0', issue: 'fleetdm/fleet#35799' }));
SOFTWARE.push(S('titles.query.chrome', 'titles query=chrome', titles, { ...pg, query: 'chrome' }, { priority: 'P0', issue: 'fleetdm/fleet#35799' }));
SOFTWARE.push(S('titles.query.a', 'titles query=a', titles, { ...pg, query: 'a' }, { priority: 'P0', scope: 'fleet' }));
SOFTWARE.push(S('titles.query.microsoft', 'titles query=Microsoft', titles, { ...pg, query: 'Microsoft' }, { scope: 'fleet' }));
SOFTWARE.push(S('titles.query.cve', 'titles query=<CVE>', titles, { ...pg, query: '{CVE_TOP}' }, { scope: 'fleet' }));
SOFTWARE.push(S('titles.available_for_install', 'titles available_for_install (Library tab)', titles, { ...pg, available_for_install: true }, { priority: 'P0' }));
SOFTWARE.push(S('titles.self_service', 'titles self_service', titles, { ...pg, self_service: true }, { priority: 'P0', scope: 'fleet' }));
SOFTWARE.push(S('titles.packages_only', 'titles packages_only', titles, { ...pg, packages_only: true }, { scope: 'fleet' }));
for (const p of ['darwin', 'windows', 'linux', 'ios', 'ipados', 'android']) {
  SOFTWARE.push(S(`titles.available.${p}`, `titles available_for_install platform=${p}`, titles, { ...pg, available_for_install: true, platform: p }, { scope: 'fleet' }));
}
// `exclude_fleet_maintained_apps` is in the REST docs but no server code
// decodes it on 4.93, so a shape for it would only re-measure the plain list.
SOFTWARE.push(S('titles.combo', 'titles vulnerable+exploit+min_cvss+name+query', titles, { ...pg, vulnerable: true, exploit: true, min_cvss_score: 7, order_key: 'name', order_direction: 'asc', query: 'a' }, { scope: 'fleet' }));
SOFTWARE.push(S('title.detail', 'software/titles/{id}', 'software/titles/{TITLE_TOP}', {}, { priority: 'P0' }));
SOFTWARE.push(S('title.installer.detail', 'software/titles/{installer id}', 'software/titles/{TITLE_INSTALLER}', {}, { scope: 'fleet' }));
SOFTWARE.push(S('title.package', 'software/titles/{id}/package metadata', 'software/titles/{TITLE_INSTALLER}/package', {}, { scope: 'fleet', optional: true }));

SOFTWARE.push(S('versions', 'versions default, details off (what the UI sends)', versions, { ...pg, without_vulnerability_details: true }, { priority: 'P0' }));
// The API default includes vulnerability details; that path, not the row
// count, is what made the global list 8–9 s on a 19-host / 12k-CVE instance.
SOFTWARE.push(S('versions.details', 'versions default, details on (API default)', versions, pg, { priority: 'P0', issue: 'fleetdm/fleet#45415' }));
for (const dir of DIRS) {
  SOFTWARE.push(S(`versions.sort.name.${dir}`, `versions order name ${dir}`, versions, { ...pg, order_key: 'name', order_direction: dir, without_vulnerability_details: true }, { priority: 'P0', issue: 'fleetdm/fleet#45415' }));
}
// The CVE sort keys are only accepted while vulnerability details are
// included (server/datastore/mysql/software.go softwareOrderKeys), which the
// docs don't say; with `without_vulnerability_details=true` they are a 422.
for (const key of ['cve_published', 'cvss_score', 'epss_probability', 'cisa_known_exploit']) {
  SOFTWARE.push(S(`versions.sort.${key}.desc`, `versions order ${key} desc (details on)`, versions, { ...pg, order_key: key, order_direction: 'desc', without_vulnerability_details: false }, { scope: 'fleet', issue: 'fleetdm/fleet#44388' }));
}
SOFTWARE.push(S('versions.page.1000', 'versions page 1000', versions, { ...pg, page: 1000, without_vulnerability_details: true }, { priority: 'P0', scope: 'fleet' }));
SOFTWARE.push(S('versions.page.last', 'versions last page', versions, { ...pg, page: '{VERSIONS_LAST_PAGE}', without_vulnerability_details: true }, { scope: 'fleet' }));
for (const details of [true, false]) {
  const sfx = details ? 'details' : 'no_details';
  const w = { without_vulnerability_details: !details };
  const sc: ShapeScope = details ? 'fleet' : 'both';
  SOFTWARE.push(S(`versions.vulnerable.${sfx}`, `versions vulnerable (${sfx})`, versions, { ...pg, vulnerable: true, ...w }, { priority: 'P0', scope: sc, issue: 'fleetdm/fleet#45415' }));
  SOFTWARE.push(S(`versions.exploit.${sfx}`, `versions vulnerable + exploit (${sfx})`, versions, { ...pg, vulnerable: true, exploit: true, ...w }, { priority: 'P0', scope: 'fleet', issue: 'fleetdm/fleet#45415' }));
  SOFTWARE.push(S(`versions.min_cvss.${sfx}`, `versions vulnerable + min_cvss 7 (${sfx})`, versions, { ...pg, vulnerable: true, min_cvss_score: 7, ...w }, { priority: 'P0', scope: 'fleet', issue: 'fleetdm/fleet#45415' }));
  SOFTWARE.push(S(`versions.max_cvss.${sfx}`, `versions vulnerable + max_cvss 8 (${sfx})`, versions, { ...pg, vulnerable: true, max_cvss_score: 8, ...w }, { scope: 'fleet', issue: 'fleetdm/fleet#45415' }));
  SOFTWARE.push(S(`versions.query.chrome.${sfx}`, `versions query=chrome (${sfx})`, versions, { ...pg, query: 'chrome', ...w }, { priority: 'P0', scope: 'fleet', issue: 'fleetdm/fleet#45415' }));
}
SOFTWARE.push(S('versions.no_per_page', 'versions without per_page', versions, { without_vulnerability_details: true }, { priority: 'P0', scope: 'fleet', samples: 3, issue: 'fleetdm/fleet#47755' }));
SOFTWARE.push(S('version.detail', 'software/versions/{id}', 'software/versions/{VERSION_TOP}', {}, {}));
// The dashboard's top-software card sends exactly this — and no
// `without_vulnerability_details`, so it pays for CVE details its three
// columns never show.
SOFTWARE.push(S('legacy.software', 'software (legacy list, dashboard card, details on)', 'software', { per_page: 8, order_key: 'hosts_count', order_direction: 'desc' }, { priority: 'P0' }));
SOFTWARE.push(S('legacy.software.no_details', 'software (legacy list) details off', 'software', { per_page: 8, order_key: 'hosts_count', order_direction: 'desc', without_vulnerability_details: true }, { priority: 'P0' }));
SOFTWARE.push(S('legacy.software.vulnerable', 'software (legacy list) vulnerable', 'software', { ...pg, vulnerable: true }, { priority: 'P2', scope: 'fleet' }));

SOFTWARE.push(S('fma', 'fleet_maintained_apps (Add software catalog)', 'software/fleet_maintained_apps', {}, { priority: 'P0', scope: 'fleet' }));
for (const p of ['darwin', 'windows']) {
  SOFTWARE.push(S(`fma.${p}`, `fleet_maintained_apps platform=${p}`, 'software/fleet_maintained_apps', { platform: p }, { scope: 'fleet' }));
}
SOFTWARE.push(S('fma.available', 'fleet_maintained_apps available=true', 'software/fleet_maintained_apps', { available: true }, { scope: 'fleet' }));
SOFTWARE.push(S('fma.sorted', 'fleet_maintained_apps order name', 'software/fleet_maintained_apps', { order_key: 'name', order_direction: 'asc' }, { scope: 'fleet' }));
SOFTWARE.push(S('app_store_apps', 'app_store_apps (needs a VPP token)', 'software/app_store_apps', {}, { priority: 'P2', scope: 'fleet', optional: true }));
SOFTWARE.push(S('self_service_categories', 'self_service_categories', 'software/self_service_categories', {}, { priority: 'P2', scope: 'fleet' }));
for (const p of ['macos', 'windows', 'linux', 'ios', 'ipados', 'android']) {
  SOFTWARE.push(S(`setup_experience.${p}`, `setup_experience/software platform=${p}`, 'setup_experience/software', { platform: p }, { scope: 'fleet' }));
}
SOFTWARE.push(S('setup_experience.script', 'setup_experience/script', 'setup_experience/script', {}, { priority: 'P2', scope: 'fleet', optional: true }));

// ── vulnerabilities ──────────────────────────────────────────────────────────

const V = family('vulnerabilities');
const VULNS: Shape[] = [];
const vulns = 'vulnerabilities';
VULNS.push(V('default', 'vulnerabilities, no sort params', vulns, pg, { priority: 'P0' }));
VULNS.push(V('sort.created_at.desc', 'vulnerabilities order created_at desc (explicit default)', vulns, { ...pg, order_key: 'created_at', order_direction: 'desc' }, { priority: 'P0', issue: 'fleetdm/fleet#45415' }));
for (const key of ['cve', 'cvss_score', 'epss_probability', 'cve_published', 'hosts_count']) {
  for (const dir of DIRS) {
    const p0 = dir === 'desc' && (key === 'cvss_score' || key === 'hosts_count');
    VULNS.push(V(`sort.${key}.${dir}`, `vulnerabilities order ${key} ${dir}`, vulns, { ...pg, order_key: key, order_direction: dir }, { priority: p0 ? 'P0' : 'P1', scope: 'fleet', issue: 'fleetdm/fleet#44388' }));
  }
}
VULNS.push(V('exploit', 'vulnerabilities exploit=true', vulns, { ...pg, exploit: true }, { priority: 'P0' }));
VULNS.push(V('exploit.cvss', 'vulnerabilities exploit + order cvss_score desc', vulns, { ...pg, exploit: true, order_key: 'cvss_score', order_direction: 'desc' }, { priority: 'P0', scope: 'fleet' }));
for (const [name, q] of [['year', 'CVE-2024'], ['top', '{CVE_TOP}'], ['digits', '2021']]) {
  VULNS.push(V(`query.${name}`, `vulnerabilities query=${name}`, vulns, { ...pg, query: q }, { scope: 'fleet' }));
}
VULNS.push(V('page.100', 'vulnerabilities page 100', vulns, { ...pg, page: 100 }, { scope: 'fleet' }));
VULNS.push(V('page.last', 'vulnerabilities last page', vulns, { ...pg, page: '{CVES_LAST_PAGE}' }, { scope: 'fleet' }));
VULNS.push(V('per_page.100', 'vulnerabilities per_page 100', vulns, { per_page: 100 }, { scope: 'fleet' }));
VULNS.push(V('detail.top', 'vulnerabilities/{cve} (most hosts)', 'vulnerabilities/{CVE_TOP}', {}, { priority: 'P0' }));
VULNS.push(V('detail.rare', 'vulnerabilities/{cve} (fewest hosts)', 'vulnerabilities/{CVE_RARE}', {}, { priority: 'P0' }));

// ── os-versions ──────────────────────────────────────────────────────────────

const O = family('os-versions');
const OS: Shape[] = [];
OS.push(O('default', 'os_versions, no platform (Dashboard OS card, Software › OS, OS updates)', 'os_versions', pg, { priority: 'P0' }));
for (const p of PLATFORMS) {
  OS.push(O(`platform.${p}`, `os_versions platform=${p}`, 'os_versions', { ...pg, platform: p }, { priority: 'P0', scope: p === 'darwin' ? 'both' : 'fleet' }));
}
for (const dir of DIRS) {
  OS.push(O(`sort.hosts_count.${dir}`, `os_versions order hosts_count ${dir}`, 'os_versions', { ...pg, order_key: 'hosts_count', order_direction: dir }, { scope: 'fleet' }));
}
OS.push(O('page.1', 'os_versions page 1', 'os_versions', { ...pg, page: 1 }, { scope: 'fleet' }));
OS.push(O('per_page.100', 'os_versions per_page 100', 'os_versions', { per_page: 100 }, { scope: 'fleet' }));
OS.push(O('max_vulnerabilities', 'os_versions max_vulnerabilities=5', 'os_versions', { ...pg, max_vulnerabilities: 5 }, { scope: 'fleet' }));
OS.push(O('os_name_version', 'os_versions os_name + os_version', 'os_versions', { ...pg, os_name: '{OS_NAME}', os_version: '{OS_VERSION}' }, { scope: 'fleet' }));
OS.push(O('detail', 'os_versions/{id}', 'os_versions/{OSV_ID}', {}, {}));

// ── policies ─────────────────────────────────────────────────────────────────

const P = family('policies');
const POLICIES: Shape[] = [];
const fp = 'fleets/{FLEET}/policies';
POLICIES.push(P('global', 'policies (global)', 'policies', pg, { priority: 'P0', scope: 'global' }));
POLICIES.push(P('global.count', 'policies/count', 'policies/count', {}, { priority: 'P0', scope: 'global' }));
POLICIES.push(P('fleet', 'fleets/{id}/policies', fp, pg, { priority: 'P0', scope: 'fleet', needs: ['POLICY_T'] }));
POLICIES.push(P('fleet.count', 'fleets/{id}/policies/count', `${fp}/count`, {}, { priority: 'P0', scope: 'fleet' }));
POLICIES.push(P('fleet.merge_inherited', 'fleets/{id}/policies merge_inherited', fp, { ...pg, merge_inherited: true }, { scope: 'fleet', needs: ['POLICY_T'] }));
POLICIES.push(P('fleet.inherited_page', 'fleets/{id}/policies inherited_page', fp, { ...pg, inherited_page: 1, inherited_per_page: 20 }, { scope: 'fleet', needs: ['POLICY_T'] }));
for (const t of ['software', 'patch', 'scripts', 'calendar', 'conditional_access', 'profiles', 'other']) {
  POLICIES.push(P(`fleet.automation_type.${t}`, `fleets/{id}/policies automation_type=${t}`, fp, { ...pg, automation_type: t }, { scope: 'fleet', needs: ['POLICY_T'] }));
}
POLICIES.push(P('fleet.platform', 'fleets/{id}/policies platform=darwin', fp, { ...pg, platform: 'darwin' }, { scope: 'fleet', needs: ['POLICY_T'] }));
POLICIES.push(P('fleet.query', 'fleets/{id}/policies query', fp, { ...pg, query: 'policy-1' }, { scope: 'fleet', needs: ['POLICY_T'] }));
POLICIES.push(P('global.query', 'policies query', 'policies', { ...pg, query: 'policy' }, { scope: 'global' }));
for (const key of ['name', 'failing_host_count', 'passing_host_count', 'updated_at']) {
  for (const dir of DIRS) {
    const p0 = key.endsWith('host_count');
    POLICIES.push(P(`fleet.sort.${key}.${dir}`, `fleets/{id}/policies order ${key} ${dir}`, fp, { ...pg, order_key: key, order_direction: dir }, { priority: p0 ? 'P0' : 'P1', scope: 'fleet', needs: ['POLICY_T'], issue: 'fleetdm/fleet#44388' }));
    POLICIES.push(P(`global.sort.${key}.${dir}`, `policies order ${key} ${dir}`, 'policies', { ...pg, order_key: key, order_direction: dir }, { priority: p0 ? 'P0' : 'P1', scope: 'global', issue: 'fleetdm/fleet#44388' }));
  }
}
POLICIES.push(P('fleet.page.10', 'fleets/{id}/policies page 10', fp, { ...pg, page: 10 }, { scope: 'fleet', needs: ['POLICY_T'] }));
POLICIES.push(P('global.detail', 'policies/{id}', 'policies/{POLICY_G}', {}, { scope: 'global' }));
POLICIES.push(P('fleet.detail', 'fleets/{id}/policies/{id}', `${fp}/{POLICY_T}`, {}, { scope: 'fleet' }));
POLICIES.push(P('automation_activities', 'policies/{id}/automation_activities', 'policies/{POLICY_G}/automation_activities', pg, { scope: 'global' }));
for (const st of ['error', 'success']) {
  POLICIES.push(P(`automation_activities.${st}`, `policies/{id}/automation_activities status=${st}`, 'policies/{POLICY_G}/automation_activities', { ...pg, status: st }, { priority: 'P2', scope: 'global' }));
}

// ── reports ──────────────────────────────────────────────────────────────────

const R = family('reports');
const REPORTS: Shape[] = [];
REPORTS.push(R('list', 'reports', 'reports', pg, { priority: 'P0' }));
REPORTS.push(R('merge_inherited', 'reports merge_inherited', 'reports', { ...pg, merge_inherited: true }, { priority: 'P0', scope: 'fleet' }));
for (const p of ['macos', 'windows', 'linux']) {
  REPORTS.push(R(`platform.${p}`, `reports platform=${p}`, 'reports', { ...pg, platform: p }, { scope: 'fleet' }));
}
REPORTS.push(R('query.name', 'reports query=query-1', 'reports', { ...pg, query: 'query-1' }, { scope: 'fleet' }));
REPORTS.push(R('query.one_char', 'reports query=q', 'reports', { ...pg, query: 'q' }, { scope: 'fleet' }));
for (const key of ['name', 'updated_at', 'created_at']) {
  for (const dir of DIRS) {
    REPORTS.push(R(`sort.${key}.${dir}`, `reports order ${key} ${dir}`, 'reports', { ...pg, order_key: key, order_direction: dir }, { scope: key === 'name' ? 'both' : 'fleet', issue: 'fleetdm/fleet#44388' }));
  }
}
REPORTS.push(R('page.10', 'reports page 10', 'reports', { ...pg, page: 10 }, { scope: 'fleet' }));
REPORTS.push(R('detail', 'reports/{id}', 'reports/{REPORT_G}', {}, { scope: 'global' }));
REPORTS.push(R('results', 'reports/{id}/report (rows)', 'reports/{REPORT_G}/report', {}, { priority: 'P0' }));
REPORTS.push(R('results.paged', 'reports/{id}/report per_page 20 page 100', 'reports/{REPORT_G}/report', { per_page: 20, page: 100 }, { priority: 'P0', scope: 'fleet' }));
REPORTS.push(R('results.query', 'reports/{id}/report query', 'reports/{REPORT_G}/report', { per_page: 20, query: 'a' }, { scope: 'fleet' }));
REPORTS.push(R('spec', 'spec/reports', 'spec/reports', {}, { priority: 'P2', scope: 'global' }));
REPORTS.push(R('schedule', 'schedule', 'schedule', {}, { priority: 'P2', scope: 'global' }));
REPORTS.push(R('packs', 'packs', 'packs', {}, { priority: 'P2', scope: 'global' }));

// ── labels ───────────────────────────────────────────────────────────────────

const L = family('labels');
const LABELS: Shape[] = [];
LABELS.push(L('default', 'labels (include_host_counts default on)', 'labels', {}, { priority: 'P0', scope: 'global', issue: 'fleetdm/fleet#4890' }));
LABELS.push(L('no_counts', 'labels include_host_counts=false (UI)', 'labels', { include_host_counts: false }, { priority: 'P0', scope: 'global' }));
LABELS.push(L('fleet_global', 'labels fleet_id=global', 'labels', { fleet_id: 'global', include_host_counts: false }, { scope: 'global' }));
LABELS.push(L('fleet', 'labels fleet_id=<fleet>', 'labels', { fleet_id: '{FLEET}', include_host_counts: false }, { scope: 'global' }));
LABELS.push(L('fleet.counts', 'labels fleet_id=<fleet> with host counts', 'labels', { fleet_id: '{FLEET}' }, { scope: 'global', issue: 'fleetdm/fleet#4890' }));
for (const key of ['name', 'host_count', 'created_at']) {
  for (const dir of DIRS) {
    LABELS.push(L(`sort.${key}.${dir}`, `labels order ${key} ${dir}`, 'labels', { order_key: key, order_direction: dir, include_host_counts: key === 'host_count' }, { scope: 'global', issue: 'fleetdm/fleet#44388' }));
  }
}
LABELS.push(L('summary', 'labels/summary', 'labels/summary', {}, { priority: 'P0', scope: 'global' }));
LABELS.push(L('summary.fleet', 'labels/summary fleet_id', 'labels/summary', { fleet_id: '{FLEET}' }, { scope: 'global' }));
for (const [name, ph] of [['dynamic', 'LABEL_DYN'], ['manual', 'LABEL_MANUAL'], ['macos', 'LABEL_MAC']]) {
  LABELS.push(L(`detail.${name}`, `labels/{id} (${name})`, `labels/{${ph}}`, {}, { scope: 'global' }));
}
LABELS.push(L('spec', 'spec/labels', 'spec/labels', {}, { priority: 'P2', scope: 'global' }));

// ── controls ─────────────────────────────────────────────────────────────────

const C = family('controls');
const CONTROLS: Shape[] = [];
const profiles = 'configuration_profiles';
// Profiles, commands and the Apple summaries answer 400 when MDM is off, so
// they need the `MDM` / `APPLE_MDM` flags the resolver sets from /config.
const mdm = { needs: ['MDM'] };
const appleMdm = { needs: ['APPLE_MDM'] };
CONTROLS.push(C('profiles', 'configuration_profiles', profiles, pg, { ...mdm, priority: 'P0', scope: 'fleet' }));
for (const key of ['name', 'uploaded_at']) {
  CONTROLS.push(C(`profiles.sort.${key}`, `configuration_profiles order ${key}`, profiles, { ...pg, order_key: key, order_direction: 'desc' }, { ...mdm, scope: 'fleet', issue: 'fleetdm/fleet#44388' }));
}
CONTROLS.push(C('profiles.per_page_1000', 'configuration_profiles per_page 1000', profiles, { per_page: 1000 }, { ...mdm, scope: 'fleet' }));
CONTROLS.push(C('profiles.page_5', 'configuration_profiles page 5', profiles, { ...pg, page: 5 }, { ...mdm, scope: 'fleet' }));
CONTROLS.push(C('profiles.summary', 'configuration_profiles/summary (OS settings page)', 'configuration_profiles/summary', {}, { priority: 'P0', scope: 'fleet', issue: 'fleetdm/fleet#42565' }));
CONTROLS.push(C('disk_encryption', 'disk_encryption summary', 'disk_encryption', {}, { priority: 'P0', scope: 'fleet' }));
CONTROLS.push(C('filevault.summary', 'mdm/apple/filevault/summary (Apple MDM)', 'mdm/apple/filevault/summary', {}, { ...appleMdm, priority: 'P0', scope: 'fleet' }));
CONTROLS.push(C('bootstrap.summary', 'bootstrap/summary (Apple MDM)', 'bootstrap/summary', {}, { ...appleMdm, priority: 'P0', scope: 'fleet' }));
CONTROLS.push(C('profile.detail', 'configuration_profiles/{uuid}', 'configuration_profiles/{PROFILE_UUID}', {}, { ...mdm, scope: 'global' }));
CONTROLS.push(C('profile.status', 'configuration_profiles/{uuid}/status', 'configuration_profiles/{PROFILE_UUID}/status', {}, { ...mdm, scope: 'global' }));
CONTROLS.push(C('scripts', 'scripts', 'scripts', pg, { priority: 'P0', scope: 'fleet' }));
for (const key of ['name', 'updated_at']) {
  CONTROLS.push(C(`scripts.sort.${key}`, `scripts order ${key}`, 'scripts', { ...pg, order_key: key, order_direction: 'desc' }, { scope: 'fleet', issue: 'fleetdm/fleet#44388' }));
}
CONTROLS.push(C('scripts.per_page_400', 'scripts per_page 400', 'scripts', { per_page: 400 }, { scope: 'fleet' }));
CONTROLS.push(C('scripts.page_10', 'scripts page 10', 'scripts', { ...pg, page: 10 }, { scope: 'fleet' }));
CONTROLS.push(C('script.detail', 'scripts/{id}', 'scripts/{SCRIPT_ID}', {}, { scope: 'global' }));
CONTROLS.push(C('script.download', 'scripts/{id}?alt=media', 'scripts/{SCRIPT_ID}', { alt: 'media' }, { priority: 'P2', scope: 'global' }));
for (const st of ['started', 'finished', 'scheduled']) {
  CONTROLS.push(C(`batch.${st}`, `scripts/batch status=${st}`, 'scripts/batch', { status: st }, { scope: 'fleet' }));
}
CONTROLS.push(C('batch.detail', 'scripts/batch/{id}', 'scripts/batch/{BATCH_ID}', {}, { scope: 'global' }));
for (const st of ['ran', 'pending', 'errored', 'incompatible', 'canceled']) {
  CONTROLS.push(C(`batch.host_results.${st}`, `scripts/batch/{id}/host_results status=${st}`, 'scripts/batch/{BATCH_ID}/host_results', { status: st, per_page: 20 }, { scope: 'global' }));
}
CONTROLS.push(C('batch.host_results.sorted', 'scripts/batch/{id}/host_results order display_name', 'scripts/batch/{BATCH_ID}/host_results', { status: 'ran', per_page: 20, order_key: 'display_name', order_direction: 'asc' }, { priority: 'P2', scope: 'global' }));
CONTROLS.push(C('custom_variables', 'custom_variables', 'custom_variables', {}, { priority: 'P2', scope: 'global' }));
CONTROLS.push(C('custom_host_vitals', 'custom_host_vitals', 'custom_host_vitals', {}, { priority: 'P2', scope: 'global' }));
CONTROLS.push(C('certificates', 'certificates (templates)', 'certificates', {}, { priority: 'P2', scope: 'fleet' }));
CONTROLS.push(C('certificate_authorities', 'certificate_authorities', 'certificate_authorities', {}, { priority: 'P2', scope: 'global' }));
CONTROLS.push(C('enrollment_profiles.automatic', 'enrollment_profiles/automatic', 'enrollment_profiles/automatic', {}, { ...appleMdm, priority: 'P2', scope: 'fleet', optional: true }));
CONTROLS.push(C('bootstrap.metadata', 'bootstrap/{fleet}/metadata', 'bootstrap/{FLEET}/metadata', {}, { ...appleMdm, priority: 'P2', scope: 'global', optional: true }));
CONTROLS.push(C('eula.metadata', 'setup_experience/eula/metadata', 'setup_experience/eula/metadata', {}, { ...appleMdm, priority: 'P2', scope: 'global', optional: true }));
for (const p of ['apns', 'abm', 'ab_tokens', 'vpp_tokens', 'mdm/apple', 'scim/details', 'microsoft_graph_credentials']) {
  CONTROLS.push(C(`integrations.${p.replace('/', '_')}`, p, p, {}, { priority: 'P2', scope: 'global', optional: true }));
}

// ── dashboard (what /dashboard loads at once; the max is the page's cost) ────

const B = family('dashboard');
const DASHBOARD: Shape[] = [
  B('config', 'config', 'config', {}, { priority: 'P0', scope: 'global' }),
  B('fleets', 'fleets', 'fleets', {}, { priority: 'P0', scope: 'global' }),
  B('me', 'me', 'me', { include_ui_settings: true }, { priority: 'P0', scope: 'global' }),
  B('host_summary', 'host_summary', 'host_summary', {}, { priority: 'P0' }),
  B('labels.summary', 'labels/summary', 'labels/summary', {}, { priority: 'P0', scope: 'global' }),
  B('summary.mdm', 'hosts/summary/mdm', 'hosts/summary/mdm', {}, { priority: 'P0' }),
  B('macadmins', 'macadmins', 'macadmins', {}, { priority: 'P0' }),
  B('os_versions', 'os_versions (OS card)', 'os_versions', {}, { priority: 'P0' }),
  B('software', 'software top-8 card', 'software', { per_page: 8, order_key: 'hosts_count', order_direction: 'desc' }, { priority: 'P0' }),
  B('activities', 'activities (All-fleets view)', 'activities', { per_page: 8, order_key: 'created_at', order_direction: 'desc' }, { priority: 'P0', scope: 'global' }),
];

// ── admin (users, fleets, config, activity feed) ─────────────────────────────

const A = family('admin');
const ADMIN: Shape[] = [];
const g = { scope: 'global' as const };
ADMIN.push(A('users', 'users', 'users', pg, { ...g, priority: 'P0' }));
ADMIN.push(A('users.query', 'users query', 'users', { ...pg, query: 'admin' }, { ...g }));
ADMIN.push(A('users.fleet', 'users fleet_id', 'users', { ...pg, fleet_id: '{FLEET}' }, { ...g }));
for (const key of ['name', 'email', 'created_at']) {
  ADMIN.push(A(`users.sort.${key}`, `users order ${key}`, 'users', { ...pg, order_key: key, order_direction: 'asc' }, { ...g, priority: 'P2', issue: 'fleetdm/fleet#44388' }));
}
ADMIN.push(A('user.detail', 'users/{id}', 'users/{USER_ID}', {}, { ...g, priority: 'P2' }));
ADMIN.push(A('invites', 'invites', 'invites', {}, { ...g, priority: 'P2' }));
ADMIN.push(A('fleets', 'fleets', 'fleets', {}, { ...g, priority: 'P0' }));
ADMIN.push(A('fleets.query', 'fleets query', 'fleets', { query: 'a' }, { ...g }));
ADMIN.push(A('fleets.sort.name', 'fleets order name', 'fleets', { order_key: 'name', order_direction: 'asc' }, { ...g, issue: 'fleetdm/fleet#44388' }));
ADMIN.push(A('fleet.detail', 'fleets/{id}', 'fleets/{FLEET}', {}, { ...g }));
ADMIN.push(A('fleet.users', 'fleets/{id}/users', 'fleets/{FLEET}/users', {}, { ...g, priority: 'P2' }));
ADMIN.push(A('fleet.secrets', 'fleets/{id}/secrets', 'fleets/{FLEET}/secrets', {}, { ...g, priority: 'P2' }));
ADMIN.push(A('config', 'config', 'config', {}, { ...g }));
ADMIN.push(A('config.certificate', 'config/certificate', 'config/certificate', {}, { ...g, priority: 'P2' }));
ADMIN.push(A('version', 'version', 'version', {}, { ...g, priority: 'P2' }));
ADMIN.push(A('me', 'me', 'me', {}, { ...g, priority: 'P2' }));
ADMIN.push(A('activities', 'activities', 'activities', pg, { ...g, priority: 'P0' }));
ADMIN.push(A('activities.sort.created_at.desc', 'activities order created_at desc', 'activities', { ...pg, order_key: 'created_at', order_direction: 'desc' }, { ...g, priority: 'P0' }));
for (const key of ['id', 'user_name', 'activity_type']) {
  ADMIN.push(A(`activities.sort.${key}.desc`, `activities order ${key} desc`, 'activities', { ...pg, order_key: key, order_direction: 'desc' }, { ...g, issue: 'fleetdm/fleet#44388' }));
}
ADMIN.push(A('activities.query', 'activities query=admin', 'activities', { ...pg, query: 'admin' }, { ...g }));
ADMIN.push(A('activities.type', 'activities activity_type=user_logged_in', 'activities', { ...pg, activity_type: 'user_logged_in' }, { ...g }));
ADMIN.push(A('activities.since', 'activities start_created_at', 'activities', { ...pg, start_created_at: '2026-01-01T00:00:00Z' }, { ...g, priority: 'P2' }));
for (const page of [100, 1000]) {
  ADMIN.push(A(`activities.page.${page}`, `activities page ${page}`, 'activities', { ...pg, page, order_key: 'created_at', order_direction: 'desc' }, { ...g }));
}
ADMIN.push(A('activities.per_page.100', 'activities per_page 100', 'activities', { per_page: 100 }, { ...g }));
ADMIN.push(A('rest_api', 'rest_api', 'rest_api', {}, { ...g, priority: 'P2' }));
ADMIN.push(A('status.result_store', 'status/result_store', 'status/result_store', {}, { ...g, priority: 'P2' }));
ADMIN.push(A('status.live_query', 'status/live_query', 'status/live_query', {}, { ...g, priority: 'P2' }));
ADMIN.push(A('spec.enroll_secret', 'spec/enroll_secret', 'spec/enroll_secret', {}, { ...g, priority: 'P2' }));
ADMIN.push(A('carves', 'carves', 'carves', {}, { ...g, priority: 'P2' }));

// ── ui (the requests the pages send, verbatim) ───────────────────────────────
// Captured by driving each page in Playwright on 2026-10-01 and recording its
// API calls. They differ from the API-doc defaults in ways that change the
// cost: lists are 50 rows, the hosts list always adds `device_mapping=true`,
// the vulnerabilities page sorts by hosts_count, the OS page caps
// vulnerabilities per row. Timing these tells you what a user waits for.

const U = family('ui');
const uiFleet = { scope: 'fleet' as const, priority: 'P0' as const };
const uiList: Params = { page: 0, per_page: 50 };
const uiHosts: Params = { ...uiList, device_mapping: true, order_key: 'display_name', order_direction: 'asc' };
const uiTitles: Params = { ...uiList, order_direction: 'desc', order_key: 'hosts_count', vulnerable: false, exploit: false };
const uiVersions: Params = { ...uiTitles, without_vulnerability_details: true };
const UI: Shape[] = [
  U('hosts.list', 'Hosts list, default view', 'hosts', uiHosts, { ...uiFleet, countTwin: true, issue: 'fleetdm/fleet#47722' }),
  U('hosts.page_1000', 'Hosts list, page 1000', 'hosts', { ...uiHosts, page: 1000 }, uiFleet),
  U('hosts.search', 'Hosts list, search', 'hosts', { ...uiHosts, query: 'chrome' }, { ...uiFleet, countTwin: true }),
  U('hosts.export_csv', 'Hosts › Export hosts', 'hosts/report', { order_key: 'display_name', order_direction: 'asc', columns: 'display_name,team_name,os_version,detail_updated_at,gigs_disk_space_available,status,orbit_version,osquery_version,last_restarted_at', format: 'csv' }, { ...uiFleet, samples: 3 }),
  U('titles.inventory', 'Software › Inventory, default', 'software/titles', uiTitles, uiFleet),
  U('titles.vulnerable', 'Software › Inventory › Vulnerable', 'software/titles', { ...uiTitles, vulnerable: true }, { ...uiFleet, issue: 'fleetdm/fleet#51954' }),
  U('titles.vulnerable_exploited', 'Software › Inventory › Vulnerable + Exploited', 'software/titles', { ...uiTitles, vulnerable: true, exploit: true }, { ...uiFleet, issue: 'fleetdm/fleet#35799' }),
  U('titles.severity_high', 'Software › Inventory › Severity High', 'software/titles', { ...uiTitles, vulnerable: true, min_cvss_score: 7, max_cvss_score: 8.9 }, { ...uiFleet, issue: 'fleetdm/fleet#35799' }),
  U('titles.search_chrome', 'Software › Inventory › search "chrome"', 'software/titles', { ...uiTitles, query: 'chrome' }, { ...uiFleet, issue: 'fleetdm/fleet#35799' }),
  U('titles.search_a', 'Software › Inventory › search "a"', 'software/titles', { ...uiTitles, query: 'a' }, uiFleet),
  U('titles.sort_name', 'Software › Inventory › sort by Name', 'software/titles', { ...uiTitles, order_key: 'name', order_direction: 'asc' }, { ...uiFleet, issue: 'fleetdm/fleet#35799' }),
  U('titles.library', 'Software › Library', 'software/titles', { ...uiList, order_direction: 'desc', order_key: 'hosts_count', available_for_install: true }, uiFleet),
  U('versions.default', 'Software › Versions, default', 'software/versions', uiVersions, uiFleet),
  U('versions.vulnerable', 'Software › Versions › Vulnerable', 'software/versions', { ...uiVersions, vulnerable: true }, { ...uiFleet, issue: 'fleetdm/fleet#45415' }),
  U('versions.severity_high', 'Software › Versions › Severity High', 'software/versions', { ...uiVersions, vulnerable: true, min_cvss_score: 7, max_cvss_score: 8.9 }, { ...uiFleet, issue: 'fleetdm/fleet#45415' }),
  U('versions.search_chrome', 'Software › Versions › search "chrome"', 'software/versions', { ...uiVersions, query: 'chrome' }, { ...uiFleet, issue: 'fleetdm/fleet#45415' }),
  U('versions.sort_name', 'Software › Versions › sort by Name', 'software/versions', { ...uiVersions, order_key: 'name', order_direction: 'asc' }, { ...uiFleet, issue: 'fleetdm/fleet#45415' }),
  U('vulnerabilities.page', 'Software › Vulnerabilities, default', 'vulnerabilities', { ...uiList, order_key: 'hosts_count', order_direction: 'desc', exploit: false }, { ...uiFleet, issue: 'fleetdm/fleet#45415' }),
  U('vulnerabilities.exploited', 'Software › Vulnerabilities › Exploited', 'vulnerabilities', { ...uiList, order_key: 'hosts_count', order_direction: 'desc', exploit: true }, uiFleet),
  U('os.page', 'Software › OS, default', 'os_versions', { ...uiList, order_key: 'hosts_count', order_direction: 'desc', max_vulnerabilities: 3 }, uiFleet),
  U('os.page_linux', 'Software › OS › Linux', 'os_versions', { ...uiList, platform: 'linux', order_key: 'hosts_count', order_direction: 'desc', max_vulnerabilities: 3 }, uiFleet),
  U('dashboard.os_card_linux', 'Dashboard › Linux, OS card', 'os_versions', { platform: 'linux', max_vulnerabilities: 0 }, uiFleet),
  U('dashboard.software_card', 'Dashboard, software card', 'software', { page: 0, per_page: 8, order_key: 'hosts_count', order_direction: 'desc', vulnerable: false }, uiFleet),
  U('dashboard.host_summary', 'Dashboard, host summary', 'host_summary', { low_disk_space: 32 }, uiFleet),
  U('dashboard.uptime_chart', 'Dashboard, uptime chart', 'charts/uptime', { days: 31, tz_offset: 300 }, { ...uiFleet, priority: 'P1' }),
  U('fma.tab', 'Software › Add software › Fleet-maintained', 'software/fleet_maintained_apps', { page: 0, per_page: 100, order_direction: 'asc', order_key: 'name' }, uiFleet),
  U('setup_experience.macos', 'Controls › Setup experience › Install software (macOS)', 'setup_experience/software', { platform: 'macos', per_page: 3000 }, uiFleet),
  U('labels.page', 'Labels page', 'labels', { include_host_counts: false }, { scope: 'global', priority: 'P0' }),
  U('policies.fleet', 'Policies, fleet page', 'fleets/{FLEET}/policies', { page: 0, per_page: 20, order_key: 'name', order_direction: 'asc', merge_inherited: true }, { ...uiFleet, needs: ['POLICY_T'] }),
  U('reports.fleet', 'Reports, fleet page', 'reports', { page: 0, per_page: 20, order_direction: 'asc', order_key: 'name', merge_inherited: true }, uiFleet),
];

export const SHAPES: Shape[] = [
  ...UI, ...HOSTS, ...DETAILS, ...SOFTWARE, ...VULNS, ...OS, ...POLICIES, ...REPORTS, ...LABELS, ...CONTROLS, ...DASHBOARD, ...ADMIN,
];

/** Families in run order; each becomes one test in `api-timing.spec.ts`. */
export const FAMILIES = [
  'ui', 'dashboard', 'hosts', 'host-details', 'software', 'vulnerabilities', 'os-versions', 'policies', 'reports', 'labels', 'controls', 'admin',
] as const;
