// `npm run lint:lab` (part of `npm run check`) and `npm run lab:sync`: hold
// lab-hosts.json, the suite's copy of the device lab's manifest, to its shape
// and to the lab's own copy.
//
// The lab edits its `lab-hosts.json` first; the suite reads the copy beside
// fixtures.ts (helpers/lab-hosts.ts). Nothing carries a change across by
// itself, so:
//   - `lint:lab` fails on an entry the suite couldn't place (no name, an
//     unknown tier, platform, role or package type, no `fleet_platform` or
//     `desktop`, a name listed twice), and, on a machine
//     that has the lab's folder, while the two files differ, naming the hosts
//     that do. Where the lab's folder isn't (CI, another machine) there is
//     nothing to compare and only the shape is checked.
//   - `lab:sync` copies the lab's file over the suite's.
// The lab's file is `$LAB_HOSTS_JSON`, else `qa-stuff/device-lab/lab-hosts.json`
// in Fleet's checkout (`$FLEET_REPO`, else `fleet` beside this repository).
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const suiteCopy = path.join(root, 'lab-hosts.json');
const labCopy =
  process.env.LAB_HOSTS_JSON ||
  path.join(process.env.FLEET_REPO || path.resolve(root, '..', '..', 'fleet'), 'qa-stuff', 'device-lab', 'lab-hosts.json');

const TIERS = ['free', 'premium'];
const PLATFORMS = ['darwin', 'windows', 'linux'];
const ROLES = ['pool', 'matrix', 'special', 'physical'];
const PACKAGES = ['deb', 'rpm', 'msi', 'pkg', 'pkg.tar.zst'];

function hostsOf(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8')).hosts ?? [];
}

/** What helpers/lab-hosts.ts would refuse at load, found here before a run does. */
function shapeProblems(hosts) {
  const problems = [];
  const seen = new Set();
  for (const host of hosts) {
    const name = String(host.name ?? '').toLowerCase();
    const wrong = [
      !name && 'no name',
      !TIERS.includes(host.tier) && `tier "${host.tier}"`,
      !PLATFORMS.includes(host.platform) && `platform "${host.platform}"`,
      !ROLES.includes(host.role) && `role "${host.role}"`,
      !host.os && 'no os',
      host.role === 'special' && !host.purpose && 'no purpose (a special host is asked for by it)',
      !host.fleet_platform && 'no fleet_platform',
      !PACKAGES.includes(host.package) && `package "${host.package}"`,
      !host.desktop && 'no desktop ("none" for a headless host)',
    ].filter(Boolean);
    if (wrong.length) problems.push(`"${host.name}" has ${wrong.join(', ')}`);
    if (seen.has(name)) problems.push(`"${host.name}" is listed twice`);
    seen.add(name);
  }
  return problems;
}

/** The hosts that differ between the two copies, each with how. */
function differences(suite, lab) {
  const byName = (hosts) => new Map(hosts.map((h) => [String(h.name).toLowerCase(), h]));
  const [ours, theirs] = [byName(suite), byName(lab)];
  const out = [];
  for (const [name, host] of theirs) {
    if (!ours.has(name)) out.push(`${name}: in the lab's copy only`);
    else if (JSON.stringify(ours.get(name)) !== JSON.stringify(host)) {
      const keys = [...new Set([...Object.keys(host), ...Object.keys(ours.get(name))])].filter(
        (key) => JSON.stringify(host[key]) !== JSON.stringify(ours.get(name)[key]),
      );
      out.push(`${name}: ${keys.map((key) => `${key} is ${JSON.stringify(ours.get(name)[key])} here, ${JSON.stringify(host[key])} in the lab's`).join('; ')}`);
    }
  }
  for (const name of ours.keys()) if (!theirs.has(name)) out.push(`${name}: in the suite's copy only`);
  return out;
}

function main() {
  if (process.argv.includes('--sync')) {
    if (!fs.existsSync(labCopy)) {
      console.error(`lab manifest: the lab's copy is not at ${labCopy} (set LAB_HOSTS_JSON or FLEET_REPO)`);
      process.exit(1);
    }
    const before = fs.existsSync(suiteCopy) ? hostsOf(suiteCopy) : [];
    const changed = differences(before, hostsOf(labCopy));
    fs.copyFileSync(labCopy, suiteCopy);
    console.log(changed.length ? `lab manifest: copied from the lab's\n  ${changed.join('\n  ')}` : "lab manifest: already level with the lab's copy");
  }

  const hosts = hostsOf(suiteCopy);
  const problems = shapeProblems(hosts);
  if (problems.length) {
    console.error(`lab manifest: ${problems.length} problem(s) in lab-hosts.json:\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  if (!fs.existsSync(labCopy)) {
    console.log(`lab manifest: ${hosts.length} hosts (the lab's copy is not on this machine, so only the shape is checked)`);
    return;
  }
  const lab = hostsOf(labCopy);
  const drift = fs.readFileSync(suiteCopy, 'utf8') === fs.readFileSync(labCopy, 'utf8') ? [] : differences(hosts, lab);
  if (drift.length) {
    console.error(
      `lab manifest: lab-hosts.json differs from the lab's copy (${labCopy}):\n  ${drift.join('\n  ')}\n` +
        'The lab edits its copy first: run `npm run lab:sync`, check what the change means for the suite, and commit it.',
    );
    process.exit(1);
  }
  console.log(`lab manifest: ${hosts.length} hosts, level with the lab's copy`);
}

main();
