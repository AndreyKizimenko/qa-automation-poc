// `npm run lint:contract`: how many places each suite rule still finds, and in
// how many files. The toast rule is counted too, though the config keeps it
// off, so its number is known the day toast copy gets a home.
const { ESLint } = require('eslint');
const { rules } = require('./index');

async function main() {
  const eslint = new ESLint({
    overrideConfig: [{ files: ['tests/**/*.ts'], rules: { 'suite/no-toast-copy-in-spec': 'warn' } }],
  });
  const results = await eslint.lintFiles(['.']);

  const found = new Map(Object.keys(rules).map((name) => [`suite/${name}`, { places: 0, files: new Set() }]));
  for (const result of results) {
    for (const message of result.messages) {
      const entry = found.get(message.ruleId);
      if (!entry) continue;
      entry.places += 1;
      entry.files.add(result.filePath);
    }
  }

  const width = Math.max(...[...found.keys()].map((id) => id.length));
  let total = 0;
  for (const [id, { places, files }] of found) {
    total += places;
    console.log(`${id.padEnd(width)}  ${String(places).padStart(4)} in ${String(files.size).padStart(3)} files`);
  }
  console.log(`${'total'.padEnd(width)}  ${String(total).padStart(4)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
