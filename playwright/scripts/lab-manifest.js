// `npm run lint:lab` (part of `npm run check`): holds lab-hosts.json, the
// device lab's manifest, to the shape the suite reads.
//
// This is the manifest's only copy. The lab's owner (the `device-lab` skill)
// edits it here, in a PR, whenever a host is added, removed, renamed or moved;
// nothing else writes it. `lint:lab` fails on an entry the suite couldn't place
// (no name, an unknown tier, platform, role or package type, no
// `fleet_platform` or `desktop`, a name listed twice) and on a `fleet` that
// disagrees with the host's role: the cleanup returns every host to its role's
// fleet, so a `fleet` that says otherwise is a record nobody kept up to date.
const fs = require('fs');
const path = require('path');

const manifest = path.join(path.resolve(__dirname, '..'), 'lab-hosts.json');

const TIERS = ['free', 'premium'];
const PLATFORMS = ['darwin', 'windows', 'linux', 'chrome'];
const ROLES = ['pool', 'matrix', 'special', 'physical', 'experiment'];
const PACKAGES = ['deb', 'rpm', 'msi', 'pkg', 'pkg.tar.zst', 'none'];

/** The fleet a host's role puts it on, as helpers/lab-hosts.ts' labHostFleet decides; undefined where the role names none. */
function fleetOfRole(host) {
  if (host.tier === 'free') return 'Unassigned';
  if (host.role === 'pool') return 'VMs';
  if (host.role === 'matrix' || host.role === 'special') return 'OS matrix';
  return undefined;
}

/** What helpers/lab-hosts.ts would refuse at load, found here before a run does. */
function shapeProblems(hosts) {
  const problems = [];
  const seen = new Set();
  for (const host of hosts) {
    const name = String(host.name ?? '').toLowerCase();
    const fleet = fleetOfRole(host);
    const wrong = [
      !name && 'no name',
      !TIERS.includes(host.tier) && `tier "${host.tier}"`,
      !PLATFORMS.includes(host.platform) && `platform "${host.platform}"`,
      !ROLES.includes(host.role) && `role "${host.role}"`,
      !host.os && 'no os',
      host.role === 'special' && !host.purpose && 'no purpose (a special host is asked for by it)',
      host.role === 'experiment' && !host.purpose && 'no purpose (say which exploration the host is for)',
      !host.fleet_platform && 'no fleet_platform',
      !PACKAGES.includes(host.package) && `package "${host.package}"`,
      !host.desktop && 'no desktop ("none" for a headless host)',
      host.platform === 'chrome' && host.role !== 'special' && `role "${host.role}" (a ChromeOS host is special: nothing in the pool or the matrix runs on it)`,
      host.platform === 'chrome' && host.package !== 'none' && `package "${host.package}" (ChromeOS takes no package: "none")`,
      host.platform !== 'chrome' && host.package === 'none' && 'package "none", which only a ChromeOS host has',
      fleet && host.fleet !== fleet && `fleet "${host.fleet}" where its role puts it on "${fleet}"`,
    ].filter(Boolean);
    if (wrong.length) problems.push(`"${host.name}" has ${wrong.join(', ')}`);
    if (seen.has(name)) problems.push(`"${host.name}" is listed twice`);
    seen.add(name);
  }
  return problems;
}

const hosts = JSON.parse(fs.readFileSync(manifest, 'utf8')).hosts ?? [];
const problems = shapeProblems(hosts);
if (problems.length) {
  console.error(`lab manifest: ${problems.length} problem(s) in lab-hosts.json:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`lab manifest: ${hosts.length} hosts`);
