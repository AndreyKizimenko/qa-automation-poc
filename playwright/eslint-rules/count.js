// `npm run lint:contract`: how many places each rule still finds, and in how
// many files. This is what eslint-suppressions.json keeps quiet, read from the
// code instead of the record, so the two can be compared.
const { ESLint } = require('eslint');

async function main() {
  // The ESLint class does not apply the suppressions file (only the CLI does),
  // so every place a rule finds comes back here.
  const eslint = new ESLint();
  const results = await eslint.lintFiles(['.']);

  const found = new Map();
  for (const result of results) {
    for (const message of result.messages) {
      if (!message.ruleId) continue;
      const entry = found.get(message.ruleId) ?? { places: 0, files: new Set() };
      entry.places += 1;
      entry.files.add(result.filePath);
      found.set(message.ruleId, entry);
    }
  }

  const rows = [...found].sort(([a], [b]) => a.localeCompare(b));
  const width = Math.max(5, ...rows.map(([id]) => id.length));
  let total = 0;
  for (const [id, { places, files }] of rows) {
    total += places;
    console.log(`${id.padEnd(width)}  ${String(places).padStart(4)} in ${String(files.size).padStart(3)} files`);
  }
  console.log(`${'total'.padEnd(width)}  ${String(total).padStart(4)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
