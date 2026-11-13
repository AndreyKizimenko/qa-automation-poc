// `npm run catalogue`: writes the test catalogue to docs/test-catalogue/ (not
// committed), built from the suite itself, so it can't drift from it:
//   - which tests exist and which projects run them: `playwright test --list`
//     for each browser, API and CLI project, without dependencies;
//   - what each spec covers and why: its header comment;
//   - what each test does: its `test.step` titles, read from the source.
// A title or tag built at run time shows as the source wrote it (`${platform}`).
// Not listed: the gitops-verify and gitops-nightly projects, whose tests are
// generated from a gitops target, and the local-only loadtest projects.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'docs/test-catalogue');
const PROJECTS = ['premium', 'premium-exclusive', 'gitops-mode', 'free', 'free-exclusive'];

/** Every test of `project`, as Playwright lists it. */
function listProject(project) {
  const json = execFileSync('npx', ['playwright', 'test', `--project=${project}`, '--list', '--reporter=json', '--no-deps'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, PLAYWRIGHT_HTML_OPEN: 'never' },
  });
  const tests = [];
  const walk = (suite, titles) => {
    const here = suite.title && !suite.title.endsWith('.ts') ? [...titles, suite.title] : titles;
    for (const spec of suite.specs ?? []) {
      tests.push({ file: spec.file, line: spec.line, titlePath: [...here, spec.title], tags: spec.tags ?? [] });
    }
    for (const child of suite.suites ?? []) walk(child, here);
  };
  for (const suite of JSON.parse(json).suites) walk(suite, []);
  return tests;
}

/** A spec's header comment, its comment markers stripped. */
function headerOf(sourceFile) {
  const text = sourceFile.getFullText();
  const first = ts.getLeadingCommentRanges(text, 0)?.find((c) => text.startsWith('/**', c.pos));
  if (!first) return '';
  return text
    .slice(first.pos + 3, first.end - 2)
    .split('\n')
    .map((line) => line.replace(/^\s*\* ?/, ''))
    .join('\n')
    .trim();
}

/** The `test.step` titles inside the test declared on `line`, in source order. */
function stepsAt(sourceFile, line) {
  let declaration;
  const find = (node) => {
    if (declaration) return;
    if (
      ts.isCallExpression(node) &&
      /^test(\.(only|skip|fixme|fail))?$/.test(node.expression.getText(sourceFile)) &&
      sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1 === line
    ) {
      declaration = node;
      return;
    }
    ts.forEachChild(node, find);
  };
  find(sourceFile);
  if (!declaration) return [];
  const steps = [];
  const collect = (node) => {
    if (ts.isCallExpression(node) && node.expression.getText(sourceFile) === 'test.step' && node.arguments[0]) {
      const title = node.arguments[0];
      steps.push(ts.isStringLiteral(title) || ts.isNoSubstitutionTemplateLiteral(title) ? title.text : title.getText(sourceFile));
    }
    ts.forEachChild(node, collect);
  };
  collect(declaration);
  return steps;
}

function main() {
  const tests = new Map();
  for (const project of PROJECTS) {
    for (const t of listProject(project)) {
      const key = `${t.file}\u0000${t.titlePath.join('\u0000')}`;
      const entry = tests.get(key) ?? { ...t, projects: [] };
      entry.projects.push(project);
      tests.set(key, entry);
    }
  }

  const byFile = new Map();
  for (const t of tests.values()) byFile.set(t.file, [...(byFile.get(t.file) ?? []), t]);

  const byFolder = new Map();
  for (const [file, fileTests] of [...byFile].sort(([a], [b]) => a.localeCompare(b))) {
    const source = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true);
    const lines = [`## ${file}`, ''];
    const header = headerOf(source);
    if (header) lines.push(header, '');
    for (const t of fileTests.sort((a, b) => a.line - b.line)) {
      // The JSON listing drops a tag's leading `@`.
      const tags = t.tags.length ? ` ${t.tags.map((tag) => `@${tag.replace(/^@/, '')}`).join(' ')}` : '';
      lines.push(`- **${t.titlePath.join(' › ')}**${tags} — ${t.projects.join(', ')}`);
      for (const step of stepsAt(source, t.line)) lines.push(`  - ${step}`);
    }
    const folder = path.dirname(file);
    byFolder.set(folder, [...(byFolder.get(folder) ?? []), lines.join('\n')]);
  }

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const index = [
    '# Test catalogue',
    '',
    `Built by \`npm run catalogue\` from the suite at ${new Date().toISOString().slice(0, 10)}: ${tests.size} tests in ${byFile.size} spec files.`,
    'Each spec\'s header says what it covers and why; each test lists the projects that run it and its steps.',
    '',
  ];
  for (const [folder, sections] of byFolder) {
    const name = `${folder.replace(/^tests\//, '').replace(/\//g, '-')}.md`;
    fs.writeFileSync(path.join(outDir, name), `# ${folder}\n\n${sections.join('\n\n')}\n`);
    index.push(`- [${folder}](${name}) — ${sections.length} spec${sections.length === 1 ? '' : 's'}`);
  }
  fs.writeFileSync(path.join(outDir, 'README.md'), `${index.join('\n')}\n`);
  console.log(`catalogue: ${tests.size} tests in ${byFile.size} spec files, written to docs/test-catalogue/`);
}

main();
