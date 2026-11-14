// `npm run lint:claims` (part of `npm run check`): holds helpers/claims.ts to
// what it promises. Fails, listing every problem, when
//   - two simulation claims share hosts on a tier, unless every one of them
//     only reads (or both belong to one spec, whose tests share on purpose),
//     a `fleetctl-mdm` claim that changes its host included, against the
//     `transfer` claims whose ordering it walks;
//   - a claim needs more hosts than its pool held when last measured;
//   - a key names a spec that doesn't exist or doesn't use it, or another
//     spec uses it;
//   - a catalog app's spec doesn't exist, or doesn't name the slug it adds.
// The registry imports nothing, so it is transpiled and run here as it is.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const testsDir = path.join(root, 'tests');

function loadRegistry() {
  const source = fs.readFileSync(path.join(root, 'helpers/claims.ts'), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const module = { exports: {} };
  vm.runInNewContext(outputText, { module, exports: module.exports });
  return module.exports;
}

/** Every spec, by its path under tests/ without `.spec.ts`. */
function readSpecs(dir = testsDir, out = new Map()) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) readSpecs(full, out);
    else if (entry.name.endsWith('.spec.ts')) {
      out.set(path.relative(testsDir, full).replace(/\\/g, '/').replace(/\.spec\.ts$/, ''), fs.readFileSync(full, 'utf8'));
    }
  }
  return out;
}

/** The tiers a spec runs on, from its folder: `premium/` or `free/` one, anything else both. */
function tiersOf(spec) {
  if (/(^|\/)premium\//.test(spec)) return ['premium'];
  if (/(^|\/)free\//.test(spec)) return ['free'];
  return ['premium', 'free'];
}

/** Whether `text` uses `key`: as a literal, or as a template over its spec's prefix (`…#${platform}`). */
function usesKey(text, key) {
  const prefix = key.slice(0, key.indexOf('#') + 1);
  return text.includes(`'${key}'`) || text.includes(`\`${key}\``) || text.includes(`\`${prefix}\${`);
}

function main() {
  const { SIM_CLAIMS, POOL_SIZES, CATALOG_CLAIMS, TRANSFER_POOL_END } = loadRegistry();
  const specs = readSpecs();
  const problems = [];

  const claims = Object.entries(SIM_CLAIMS).map(([key, claim]) => ({ key, spec: key.split('#')[0], ...claim }));
  for (const c of claims) {
    if (!c.key.includes('#')) problems.push(`${c.key}: a key is <spec path>#<what for>`);
    const text = specs.get(c.spec);
    if (text === undefined) {
      problems.push(`${c.key}: tests/${c.spec}.spec.ts doesn't exist`);
      continue;
    }
    if (!usesKey(text, c.key)) problems.push(`${c.key}: tests/${c.spec}.spec.ts doesn't use it`);
    for (const [other, otherText] of specs) {
      if (other !== c.spec && usesKey(otherText, c.key)) problems.push(`${c.key}: tests/${other}.spec.ts uses another spec's claim`);
    }
    if (c.pool === 'fleetctl-mdm' && typeof c.mdmConnected !== 'boolean') {
      problems.push(`${c.key}: a fleetctl-mdm claim says whether MDM is on (mdmConnected)`);
    }
    if (c.pool === 'offline' && c.offset !== 0) problems.push(`${c.key}: the offline pool has no offsets`);
    const need = c.need ?? c.count;
    for (const tier of tiersOf(c.spec)) {
      const size = POOL_SIZES[tier]?.[c.pool]?.[c.platform];
      if (size !== undefined && c.offset + need > size) {
        problems.push(
          `${c.key}: needs hosts ${c.offset}–${c.offset + need - 1} of ${tier}'s ${c.pool} ${c.platform} pool, which held ${size}`,
        );
      }
    }
  }

  for (let i = 0; i < claims.length; i++) {
    for (let j = i + 1; j < claims.length; j++) {
      const a = claims[i];
      const b = claims[j];
      if (a.pool !== b.pool || a.platform !== b.platform || a.spec === b.spec) continue;
      if (a.pool === 'fleetctl-mdm' && a.mdmConnected !== b.mdmConnected) continue;
      if (a.use === 'read' && b.use === 'read') continue;
      const tiers = tiersOf(a.spec).filter((t) => tiersOf(b.spec).includes(t));
      if (!tiers.length) continue;
      if (a.offset < b.offset + b.count && b.offset < a.offset + a.count) {
        problems.push(
          `${a.key} (${a.offset}–${a.offset + a.count - 1}, ${a.use}) and ${b.key} (${b.offset}–${b.offset + b.count - 1}, ${b.use}) ` +
            `share ${a.platform} hosts of the ${a.pool} pool on ${tiers.join(' and ')}`,
        );
      }
    }
  }

  // `fleetctl-mdm` walks the `transfer` ordering with a filter, so a claim's
  // host sits at its offset or later there: one that changes its host must not
  // meet a `transfer` claim anywhere from that offset to the pool's end.
  for (const a of claims.filter((c) => c.pool === 'fleetctl-mdm' && c.use !== 'read')) {
    for (const b of claims.filter((c) => c.pool === 'transfer' && c.platform === a.platform)) {
      const tiers = tiersOf(a.spec).filter((t) => tiersOf(b.spec).includes(t));
      if (tiers.length && b.offset + b.count > a.offset && b.offset < TRANSFER_POOL_END) {
        problems.push(
          `${a.key} (${a.use}, ${a.platform} from ${a.offset}) can land on ${b.key}'s hosts ` +
            `(${b.offset}–${b.offset + b.count - 1}): fleetctl-mdm walks the transfer ordering`,
        );
      }
    }
  }

  for (const [slug, claim] of Object.entries(CATALOG_CLAIMS)) {
    const text = specs.get(claim.spec);
    if (text === undefined) problems.push(`${slug}: tests/${claim.spec}.spec.ts doesn't exist`);
    else if (claim.how === 'api' && !text.includes(`'${slug}'`)) problems.push(`${slug}: tests/${claim.spec}.spec.ts doesn't add it`);
  }

  if (problems.length) {
    console.error(`helpers/claims.ts — ${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  console.log(
    `claims: ${claims.length} simulation claims and ${Object.keys(CATALOG_CLAIMS).length} catalog apps, none overlapping, each inside its pool`,
  );
}

main();
