#!/usr/bin/env node
/**
 * The throwaway instance's data, through Fleet's REST API: first-run setup, the seed the specs and the
 * upgrade check read (`playwright/test-data/shared/throwaway/seed.json`), a wait until every simulated
 * host has answered for it, and a snapshot of it compared across an upgrade.
 *
 * It talks to the last release and to the build under test alike, so it sticks to routes and fields
 * both serve (`/reports`, `/policies`, `/labels`, `/users/admin`, `/spec/enroll_secret`), and reads a
 * list under either of its names (`reports` in Fleet 5, `queries` before). `/policies` without a fleet
 * is the global policies on both; `/global/policies` is served only under `/api/v1`.
 *
 *   node fleet-data.mjs os-templates <hosts>   osquery-perf's -os_templates for <hosts> hosts over the
 *                                              seed's simulations (needs no server)
 *   node fleet-data.mjs setup                  first-run setup as FLEET_ADMIN_EMAIL; prints a session token
 *   node fleet-data.mjs login                  prints a session token for FLEET_ADMIN_EMAIL
 *   node fleet-data.mjs prepare                turns usage statistics off; prints the global enroll secret
 *   node fleet-data.mjs seed                   the seed's report, policies, label and observer
 *   node fleet-data.mjs seed-pack              Fleet 4 only: a 2017 pack scheduling the seed's pack report
 *   node fleet-data.mjs wait <hosts> [secs] [since]
 *                                              until <hosts> hosts are online and have answered for the
 *                                              seed (and checked in after `since`, an ISO time)
 *   node fleet-data.mjs snapshot <file>        what the upgrade must keep, as JSON
 *   node fleet-data.mjs compare <file>         fails on anything of the snapshot that is missing or changed
 *
 * Every command but `setup` and `login` reads FLEET_API_TOKEN. Tokens and secrets are printed only on
 * stdout, for the workflow to mask and keep; nothing else this prints carries one.
 */
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const SEED = JSON.parse(
  readFileSync(new URL('../../playwright/test-data/shared/throwaway/seed.json', import.meta.url), 'utf8'),
);
const FLEET_URL = (process.env.FLEET_URL ?? '').replace(/\/$/, '');
if (!FLEET_URL && process.argv[2] !== 'os-templates') fail('FLEET_URL is not set');

function fail(message) {
  console.error(`fleet-data: ${message}`);
  process.exit(1);
}

/** Calls Fleet; returns the parsed body, or throws with the status and Fleet's error unless `allow` names it. */
async function api(method, path, { body, token = process.env.FLEET_API_TOKEN, allow = [] } = {}) {
  const res = await fetch(`${FLEET_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok && !allow.includes(res.status)) {
    throw new Error(`${method} ${path} answered ${res.status}: ${text.slice(0, 500)}`);
  }
  return { status: res.status, body: text ? JSON.parse(text) : {} };
}

const get = async (path) => (await api('GET', `/api/latest/fleet${path}`)).body;
const post = async (path, body) => (await api('POST', `/api/latest/fleet${path}`, { body })).body;

/** A password Fleet accepts: 12-48 characters with a number and a symbol. */
const newPassword = () => `Pw-${randomBytes(12).toString('hex')}-1!`;

const admin = () => {
  const email = process.env.FLEET_ADMIN_EMAIL;
  const password = process.env.FLEET_ADMIN_PASSWORD;
  if (!email || !password) fail('FLEET_ADMIN_EMAIL and FLEET_ADMIN_PASSWORD must be set');
  return { email, password };
};

async function login() {
  const { email, password } = admin();
  const { body } = await api('POST', '/api/latest/fleet/login', { body: { email, password }, token: '' });
  return body.token;
}

async function setup() {
  const { email, password } = admin();
  const { body } = await api('POST', '/api/v1/setup', {
    token: '',
    body: {
      admin: { admin: true, name: 'Throwaway admin', email, password, password_confirmation: password },
      org_info: { org_name: SEED.orgName },
      server_url: FLEET_URL,
    },
  });
  return body.token ?? (await login());
}

async function prepare() {
  await api('PATCH', '/api/latest/fleet/config', {
    body: { server_settings: { enable_analytics: false } },
  });
  const spec = (await get('/spec/enroll_secret')).spec;
  if (spec?.secrets?.length) return spec.secrets[0].secret;
  // A server set up through the API may hold no secret yet: give it one.
  const secret = randomBytes(24).toString('base64url');
  await post('/spec/enroll_secret', { spec: { secrets: [{ secret }] } });
  return secret;
}

async function seed() {
  const { report, policies, label, observer } = SEED;
  await post('/reports', {
    name: report.name,
    description: report.description,
    query: report.query,
    interval: report.interval,
    automations_enabled: report.automations_enabled,
    logging: report.logging,
    observer_can_run: false,
  });
  for (const policy of policies) {
    await post('/policies', { name: policy.name, description: policy.description, query: policy.query });
  }
  await post('/labels', { name: label.name, description: label.description, query: label.query });
  await post('/users/admin', {
    name: observer.name,
    email: observer.email,
    password: newPassword(),
    global_role: 'observer',
  });
  console.error(`seeded ${report.name}, ${policies.map((p) => p.name).join(', ')}, ${label.name}, ${observer.email}`);
}

/** A Fleet version's major, with a `main` build (0.0.0-SNAPSHOT-<sha>) counted as the newest. */
function majorOf(version) {
  const major = Number(version.split('.')[0]);
  return major === 0 ? Infinity : major;
}

const majorVersion = async () => majorOf((await get('/version')).version);

async function seedPack() {
  if ((await majorVersion()) >= 5) fail('Fleet 5 has no 2017 packs to seed');
  const { pack } = SEED;
  await post('/reports', {
    name: pack.report,
    description: 'Runs only through the seeded 2017 pack.',
    query: pack.query,
  });
  // The pack spec's fields as Fleet 4's server reads them (`queries`, `query`): its fleetctl rewrote
  // the newer names to these before sending.
  await post('/spec/packs', {
    specs: [
      {
        name: pack.name,
        description: 'Seeded 2017 pack: Fleet 5 drops it, fleetctl upgrade-packs keeps its report.',
        targets: { labels: ['All Hosts'] },
        queries: [{ query: pack.report, name: pack.report, interval: pack.interval, snapshot: true }],
      },
    ],
  });
  console.error(`seeded the 2017 pack ${pack.name}`);
}

const listOf = (body, ...keys) => keys.map((k) => body[k]).find(Array.isArray) ?? [];
const reportsList = async () => listOf(await get('/reports?per_page=1000'), 'reports', 'queries');
const hostsWhere = async (query) => listOf(await get(`/hosts?per_page=1000${query}`), 'hosts');
const byName = (items, name, what) => {
  const item = items.find((i) => i.name === name);
  if (!item) throw new Error(`no ${what} named ${name}`);
  return item;
};

/**
 * Polls until <hosts> hosts are online and each has answered every seeded thing, or the deadline.
 * With `since` (an ISO time, the moment an upgrade began), each host must also have checked in after
 * it: a host Fleet saw just before the server stopped still counts as online for a while.
 */
async function wait(hostsArg, secondsArg = '600', sinceArg) {
  const want = Number(hostsArg);
  const deadline = Date.now() + Number(secondsArg) * 1000;
  const since = sinceArg ? Date.parse(sinceArg) : null;
  if (!want) fail('wait needs the expected host count');
  if (Number.isNaN(since)) fail(`"${sinceArg}" is not a time`);
  const report = byName(await reportsList(), SEED.report.name, 'report');
  const policies = listOf(await get('/policies'), 'policies');
  const label = byName(listOf(await get('/labels'), 'labels'), SEED.label.name, 'label');
  let last = '';
  for (;;) {
    const online = await hostsWhere('&status=online');
    const counts = [
      ['hosts online', online.length],
      ...(since === null
        ? []
        : [['checked in since then', online.filter((h) => Date.parse(h.seen_time) >= since).length]]),
      ...(await Promise.all(
        SEED.policies.map(async (p) => [
          `${p.name} ${p.response}`,
          (await hostsWhere(`&policy_id=${byName(policies, p.name, 'policy').id}&policy_response=${p.response}`)).length,
        ]),
      )),
      [`in ${label.name}`, listOf(await get(`/labels/${label.id}/hosts?per_page=1000`), 'hosts').length],
      [
        `${report.name} results`,
        new Set(listOf(await get(`/reports/${report.id}/report`), 'results').map((r) => r.host_id)).size,
      ],
    ];
    const line = counts.map(([what, n]) => `${what} ${n}/${want}`).join(' · ');
    if (line !== last) console.error(`${new Date().toISOString().slice(11, 19)} ${line}`);
    last = line;
    if (counts.every(([, n]) => n === want)) return;
    if (Date.now() > deadline) fail(`gave up after ${secondsArg} s: ${line}`);
    await new Promise((r) => setTimeout(r, 10_000));
  }
}

const pick = (item, keys) => Object.fromEntries(keys.map((k) => [k, item[k] ?? null]));

async function snapshotNow() {
  const config = await get('/config');
  const packs = await api('GET', '/api/latest/fleet/packs', { allow: [404, 410] });
  return {
    version: (await get('/version')).version,
    config: { org_name: config.org_info?.org_name ?? null, server_url: config.server_settings?.server_url ?? null },
    hosts: (await hostsWhere('')).map((h) => pick(h, ['uuid', 'hostname', 'platform'])),
    reports: (await reportsList()).map((r) =>
      pick(r, ['name', 'description', 'query', 'interval', 'automations_enabled', 'logging', 'platform'])),
    policies: listOf(await get('/policies'), 'policies').map((p) => pick(p, ['name', 'description', 'query'])),
    labels: listOf(await get('/labels'), 'labels')
      .filter((l) => l.label_type === 'regular')
      .map((l) => pick(l, ['name', 'description', 'query', 'label_membership_type'])),
    users: listOf(await get('/users'), 'users').map((u) => pick(u, ['email', 'name', 'global_role'])),
    enrollSecrets: (await get('/spec/enroll_secret')).spec?.secrets?.length ?? 0,
    packs: packs.status === 200 ? listOf(packs.body, 'packs').map((p) => p.name) : null,
  };
}

/** Every item of `before` must be in `after` under the same key, with the same fields. */
function compareList(what, before, after, key, problems) {
  const now = new Map(after.map((item) => [item[key], item]));
  for (const item of before) {
    const match = now.get(item[key]);
    if (!match) {
      problems.push(`${what} ${item[key]}: missing`);
      continue;
    }
    for (const [field, value] of Object.entries(item)) {
      if (JSON.stringify(match[field]) !== JSON.stringify(value)) {
        problems.push(`${what} ${item[key]}: ${field} was ${JSON.stringify(value)}, now ${JSON.stringify(match[field])}`);
      }
    }
  }
}

async function compare(file) {
  const before = JSON.parse(readFileSync(file, 'utf8'));
  const after = await snapshotNow();
  const problems = [];
  compareList('host', before.hosts, after.hosts, 'uuid', problems);
  compareList('report', before.reports, after.reports, 'name', problems);
  compareList('policy', before.policies, after.policies, 'name', problems);
  compareList('label', before.labels, after.labels, 'name', problems);
  compareList('user', before.users, after.users, 'email', problems);
  if (after.config.org_name !== before.config.org_name) {
    problems.push(`organization name was ${before.config.org_name}, now ${after.config.org_name}`);
  }
  if (after.enrollSecrets !== before.enrollSecrets) {
    problems.push(`enroll secrets: ${before.enrollSecrets} before, ${after.enrollSecrets} now`);
  }
  // Packs: an upgrade within Fleet 4 keeps them. One to Fleet 5 drops them, and the reports
  // `fleetctl upgrade-packs` made from them, applied before the upgrade, are among the reports
  // compared above.
  const toFleet5 = majorOf(after.version) >= 5;
  for (const pack of before.packs ?? []) {
    if (!toFleet5) {
      if (!after.packs?.includes(pack)) problems.push(`2017 pack ${pack}: missing`);
      continue;
    }
    if (after.packs !== null) problems.push(`2017 packs are still served after the upgrade (${after.packs.join(', ')})`);
    if (!before.reports.some((r) => r.description?.includes(`converted from pack "${pack}"`))) {
      problems.push(`no report converted from 2017 pack ${pack} was applied before the upgrade`);
    }
  }
  console.error(
    `${before.version} → ${after.version}: compared ${before.hosts.length} hosts, ${before.reports.length} reports, ` +
      `${before.policies.length} policies, ${before.labels.length} labels, ${before.users.length} users` +
      (before.packs?.length ? `, and ${before.packs.length} 2017 pack(s)` : ''),
  );
  if (problems.length) fail(`${problems.length} difference(s) after the upgrade:\n  ${problems.join('\n  ')}`);
  console.error('everything from before the upgrade is still there');
}

/** `<template>:<count>,…`, the hosts shared out over the seed's simulations, every one at least once. */
function osTemplates(hostsArg) {
  const hosts = Number(hostsArg);
  const sims = SEED.simulations;
  if (!Number.isInteger(hosts) || hosts < sims.length) fail(`os-templates needs at least ${sims.length} hosts`);
  return sims
    .map((s, i) => `${s.template}:${Math.floor(hosts / sims.length) + (i < hosts % sims.length ? 1 : 0)}`)
    .join(',');
}

const [command, ...args] = process.argv.slice(2);
const commands = {
  'os-templates': async () => console.log(osTemplates(args[0])),
  setup: async () => console.log(await setup()),
  login: async () => console.log(await login()),
  prepare: async () => console.log(await prepare()),
  seed,
  'seed-pack': seedPack,
  wait: () => wait(...args),
  snapshot: async () => {
    if (!args[0]) fail('snapshot needs a file');
    writeFileSync(args[0], JSON.stringify(await snapshotNow(), null, 2));
    console.error(`snapshot written to ${args[0]}`);
  },
  compare: () => (args[0] ? compare(args[0]) : fail('compare needs the snapshot file')),
};
if (!commands[command]) fail(`unknown command "${command ?? ''}"; see the header of this file`);
commands[command]().catch((error) => fail(error.message));
