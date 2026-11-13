#!/usr/bin/env node
/**
 * fleet-upgrade-preflight — predict which Playwright tests a Fleet upgrade
 * will break, BEFORE the instance is upgraded.
 *
 * The core idea is a two-tree presence check, not a diff heuristic:
 *
 *   For every selector token the suite depends on (CSS class, accessible
 *   name, placeholder, test id, API route) and every phrase it expects or
 *   keeps as a constant, ask two questions —
 *     1. does it exist in the source Fleet ships at the revision we run TODAY?
 *     2. does it still exist at the revision we're upgrading TO?
 *
 *   present → absent  = BREAKING. The suite names something Fleet deleted.
 *   present → present  = safe.
 *   absent  → absent   = unverifiable (dynamic/derived text, or copy the
 *                        suite invents). Dropped — it tells us nothing.
 *
 * That third bucket is what makes this trustworthy: a token the suite uses
 * but that never appeared in Fleet's source can't be evidence of anything,
 * so it is never reported. The check calibrates itself against the FROM
 * tree instead of guessing.
 *
 * Selector renames are only half of it, though. A flow can break with every
 * selector intact (4.89 made "save an edited report" redirect to a different
 * page — no markup changed, the test still broke). So the report also carries
 * a churn map: Fleet UI directories that changed heavily, mapped to the spec
 * areas that drive them, plus the release's changelog fragments.
 *
 * Zero dependencies. Node >= 20 (uses fetch).
 *
 * Usage:
 *   node .claude/skills/fleet-upgrade-preflight/preflight.mjs detect
 *   node .claude/skills/fleet-upgrade-preflight/preflight.mjs scan --to origin/rc-minor-fleet-v4.91.0
 *   node .claude/skills/fleet-upgrade-preflight/preflight.mjs scan --from <sha> --to <ref> --out report.md
 *   node .claude/skills/fleet-upgrade-preflight/preflight.mjs scan --from <ref> --to <ref> --suite <other checkout>/playwright
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

// ── Layout ───────────────────────────────────────────────────────────────────

const SKILL_DIR = path.dirname(fileURLToPath(import.meta.url));

/** Walk up to the repo root rather than counting `..` levels — the skill
 *  directory moves (root vs. nested `.claude/skills/`) and a hard-coded
 *  depth silently resolves to the wrong tree when it does. */
function findRepoRoot(start) {
  let dir = start;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    dir = path.dirname(dir);
  }
  die(`Cannot find the repo root above ${start}.`);
}

const REPO_DIR = findRepoRoot(SKILL_DIR);

/** The suite to read: `--suite <its playwright/ directory>`, else the one in this repo. */
function resolveSuiteDir(explicit) {
  const dir = path.resolve(typeof explicit === 'string' ? explicit : path.join(REPO_DIR, 'playwright'));
  if (!SCAN_ROOTS.some((root) => fs.existsSync(path.join(dir, root)))) {
    die(`No suite at ${dir} (looked for ${SCAN_ROOTS.join(', ')}). --suite takes the playwright/ directory itself.`);
  }
  return dir;
}

/** Fleet source checkout. Override with FLEET_REPO. */
function resolveFleetRepo(explicit) {
  const candidates = [
    explicit,
    process.env.FLEET_REPO,
    path.resolve(REPO_DIR, '../fleet'),
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, '.git'))) return path.resolve(c);
  }
  die(
    `No Fleet checkout found. Tried:\n${candidates.map((c) => `  ${c}`).join('\n')}\n` +
      `Clone it (git clone git@github.com:fleetdm/fleet.git) or set FLEET_REPO=/path/to/fleet.`,
  );
}

// Trees we materialise for the presence check. frontend/ carries every
// selector and every string of UI copy; server/service carries the route
// table the API helpers call.
const CORPUS_PATHS = ['frontend', 'server/service', 'ee/server/service'];
const CORPUS_EXT = /\.(tsx?|jsx?|scss|css|go|html)$/;

// Fleet's own tests, the helpers and mocks they run on, and Storybook stories.
// None of it reaches a browser, so a class or a line of copy that survives only
// there must not read as present: a Go integration-test comment once kept
// "Turn on disk encryption" alive in the corpus a release after the UI dropped it.
const NOT_SHIPPED = [
  /_test\.go$/, // Go tests
  /(^|\/)test(ing)?_[^/]*\.go$/, // test_types.go: constants and types those tests share
  /(^|\/)[a-z_]+test\/.*\.go$/, // Go test-helper packages: svctest, integrationtest, sceptest, …
  /\.(tests?|stories)\.[jt]sx?$/, // Jest tests, Storybook stories
  /^frontend\/test\//, // Jest setup, request handlers, stubs
  /(^|\/)(__mocks__|mocks?|mock_service|testdata)\//, // mock data, the Go service mock, fixtures
];
const inCorpus = (file) => CORPUS_EXT.test(file) && !NOT_SHIPPED.some((re) => re.test(file));

const CACHE_DIR = path.join(os.tmpdir(), 'fleet-upgrade-preflight');

// A digest of everything that decides what a corpus holds: which trees, which
// files, and how the text is laid out. It is part of each cache file's name, so
// a corpus built under other rules is never read back as if it were current.
const CORPUS_LAYOUT = 'one line per file, whitespace collapsed';
const CORPUS_RULES = createHash('sha1')
  .update(JSON.stringify([CORPUS_LAYOUT, CORPUS_PATHS, String(CORPUS_EXT), NOT_SHIPPED.map(String)]))
  .digest('hex')
  .slice(0, 8);

// ── Fleet UI directory → QA spec area ────────────────────────────────────────
//
// Hand-maintained because the names genuinely don't line up: Fleet still calls
// the reports UI "queries" on disk (renamed in the product, not in the tree),
// and Fleet's settings live under pages/admin. Anything unmapped is reported
// as unmapped rather than silently dropped.
const AREA_MAP = [
  [/^frontend\/pages\/SoftwarePage/, 'software'],
  [/^frontend\/pages\/hosts/, 'hosts'],
  [/^frontend\/pages\/policies/, 'policies'],
  [/^frontend\/pages\/queries/, 'reports'],
  [/^frontend\/pages\/packs/, 'packs'],
  [/^frontend\/pages\/labels/, 'labels'],
  [/^frontend\/pages\/ManageControlsPage/, 'controls'],
  [/^frontend\/pages\/DashboardPage/, 'dashboard'],
  [/^frontend\/pages\/admin/, 'settings'],
  [/^frontend\/pages\/AccountPage/, 'account'],
  [/^frontend\/pages\/(LoginPage|MfaPage|ForgotPasswordPage|ResetPasswordPage|ConfirmSSOInvitePage|ConfirmInvitePage|LogoutPage|RegistrationPage)/, 'auth'],
  [/^frontend\/components\/CommandPalette/i, 'command-palette'],
  [/^frontend\/components/, '(shared components)'],
  [/^frontend\/services/, '(API client)'],
  [/^server\/service|^ee\/server\/service/, '(API routes)'],
];

function areaFor(file) {
  for (const [re, area] of AREA_MAP) if (re.test(file)) return area;
  return null;
}

// ── git plumbing ─────────────────────────────────────────────────────────────

function git(repo, args, { allowFail = false } = {}) {
  try {
    return execFileSync('git', ['-C', repo, ...args], {
      encoding: 'utf8',
      maxBuffer: 512 * 1024 * 1024,
    }).trim();
  } catch (err) {
    if (allowFail) return null;
    die(`git ${args.join(' ')} failed:\n${err.stderr || err.message}`);
  }
}

/** Resolve a ref to a full SHA, fetching from origin if it isn't local yet. */
function resolveRef(repo, ref) {
  let sha = git(repo, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], {
    allowFail: true,
  });
  if (sha) return sha;

  log(`  ref "${ref}" not in the local clone — fetching from origin…`);
  // A targeted fetch prints nothing on success, so "" and null both look
  // falsy — compare against null explicitly. FETCH_HEAD may only be consulted
  // when THIS fetch succeeded: a stale FETCH_HEAD left by any earlier fetch
  // would otherwise resolve a typo'd ref to whatever was fetched last, and the
  // scan would silently report on the wrong pair of commits.
  const fetched = git(repo, ['fetch', 'origin', ref], { allowFail: true }) !== null;
  git(repo, ['fetch', 'origin', '--tags'], { allowFail: true });
  sha =
    git(repo, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { allowFail: true }) ||
    git(repo, ['rev-parse', '--verify', '--quiet', `origin/${ref}^{commit}`], { allowFail: true }) ||
    (fetched
      ? git(repo, ['rev-parse', '--verify', '--quiet', 'FETCH_HEAD^{commit}'], { allowFail: true })
      : null);
  if (!sha) die(`Cannot resolve "${ref}" in ${repo}, even after fetching origin.`);
  return sha;
}

function describeRef(repo, sha) {
  const subject = git(repo, ['log', '-1', '--format=%s', sha]);
  const date = git(repo, ['log', '-1', '--format=%cs', sha]);
  const branches = git(repo, ['branch', '-r', '--contains', sha], { allowFail: true }) || '';
  const rc = branches
    .split('\n')
    .map((b) => b.trim())
    .filter((b) => /rc-(minor|patch)-fleet/.test(b));
  return { sha, short: sha.slice(0, 10), subject, date, rcBranches: rc };
}

// ── Corpus: the text of the UI + route tables Fleet ships at one revision ────
//
// Materialised once per SHA and cached in the OS temp dir. Whitespace is
// collapsed so that copy JSX wrapped across lines ("Add\n  software") still
// matches a suite selector written on one line. Each file becomes one line,
// which lets a check that has to stay inside one component (a class built on
// that component's `baseClass`) find the file's edges.

function corpusFor(repo, sha) {
  const cached = path.join(CACHE_DIR, `${sha}-${CORPUS_RULES}.txt`);
  if (fs.existsSync(cached)) return fs.readFileSync(cached, 'utf8');

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const work = fs.mkdtempSync(path.join(CACHE_DIR, 'extract-'));
  log(`  materialising ${sha.slice(0, 10)} (${CORPUS_PATHS.join(', ')})…`);
  execFileSync(
    'bash',
    ['-c', `git -C "${repo}" archive ${sha} ${CORPUS_PATHS.join(' ')} | tar -x -C "${work}"`],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );

  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (inCorpus(path.relative(work, p).split(path.sep).join('/'))) {
        files.push(fs.readFileSync(p, 'utf8').replace(/\s+/g, ' '));
      }
    }
  };
  walk(work);
  fs.rmSync(work, { recursive: true, force: true });

  const corpus = files.join('\n');
  fs.writeFileSync(cached, corpus);
  return corpus;
}

const normalise = (s) => s.replace(/\s+/g, ' ').trim();

// ── Suite vocabulary: everything the tests name in Fleet's UI ────────────────

const SCAN_ROOTS = ['pages', 'helpers', 'tests', 'setup', 'fixtures.ts'];

function listSuiteFiles(suiteDir) {
  const out = [];
  const walk = (p) => {
    const st = fs.statSync(p);
    if (st.isFile()) {
      if (/\.ts$/.test(p)) out.push(p);
      return;
    }
    for (const e of fs.readdirSync(p, { withFileTypes: true })) {
      if (e.name === 'node_modules') continue;
      walk(path.join(p, e.name));
    }
  };
  for (const root of SCAN_ROOTS) {
    const p = path.join(suiteDir, root);
    if (fs.existsSync(p)) walk(p);
  }
  return out;
}

/**
 * Token kinds, in descending order of how conclusive "it vanished" is:
 *
 *   class   — `.software-installer-card`. A rename is unambiguous death.
 *   testid  — `getByTestId('…')`.
 *   name    — accessible name / visible copy. Strong, but copy can be built
 *             from variables, so the FROM-tree check does the filtering.
 *   route   — `/api/v1/fleet/…`. Normalised to Fleet's `_version_` form.
 *
 * Those four are what a locator is built from. Two more kinds are copy the
 * suite compares against or passes around, found by reading every string
 * literal (see `stringLiterals` and `phraseUse`):
 *
 *   expect  — an argument of a matcher or of one of the suite's `expect…`
 *             helpers: `toHaveText('Application (macOS)')`.
 *   literal — any other phrase: a lookup constant, an argument a page object
 *             turns into a locator (`selectSoftwareView('Full inventory')`).
 */
const EXTRACTORS = [
  // Every string handed to locator()/filter() — pull CSS class tokens out.
  {
    kind: 'class',
    re: /\.locator\(\s*(['"`])([^'"`]+)\1/g,
    pick: (m) => [...m[2].matchAll(/\.(-?[a-z][a-z0-9]*(?:[-_]{1,2}[a-z0-9]+)*)/gi)].map((c) => `.${c[1]}`),
  },
  {
    kind: 'testid',
    re: /getByTestId\(\s*(['"`])([^'"`]+)\1/g,
    pick: (m) => [m[2]],
  },
  {
    kind: 'name',
    re: /getBy(?:Role\(\s*['"`][a-z]+['"`]\s*,\s*\{[^}]*?name:\s*|Text\(\s*|Label\(\s*|Placeholder\(\s*)(['"`])([^'"`\n]{3,})\1/g,
    pick: (m) => [m[2]],
  },
  {
    kind: 'name',
    re: /hasText:\s*(['"`])([^'"`\n]{3,})\1/g,
    pick: (m) => [m[2]],
  },
  {
    kind: 'route',
    re: /(['"`])(\/api\/(?:v1|latest)\/fleet\/[^'"`\s]*)\1/g,
    pick: (m) => [m[2]],
  },
];

/** Fleet declares routes as /api/_version_/fleet/... with {id} placeholders. */
function normaliseRoute(route) {
  return route
    .replace(/\/api\/(v1|latest)\//, '/api/_version_/')
    .replace(/\$\{[^}]*\}/g, '{}')
    .replace(/\/:\w+/g, '/{}')
    .replace(/\/\d+/g, '/{}')
    .replace(/\?.*$/, '')
    .replace(/\/+$/, '');
}

/** Copy tokens that are too generic to mean anything in 10 MB of source. */
const NOISE = new Set(['.first', '.last', '.and', '.or', '.not']);
const isNoise = (t) => NOISE.has(t) || t.length < 3;

/** A `/` here opens a regex literal; after anything else it divides. */
const REGEX_MAY_START = /(^|[(,=:[!&|?{};+\-*%<>~^])$|\b(return|typeof|case|in|of|delete|void|throw|new|else|do)$/;

/**
 * Every string literal in a TypeScript source: its text, where it starts and
 * the call whose arguments it sits in. A hand-rolled pass rather than a regex,
 * because comments, regex literals and `${…}` nesting all hold quote
 * characters that open no string. A template with interpolations yields its
 * static pieces one by one, each marked `piece`.
 *
 * `call` is the nearest enclosing `name(`, seen through array and object
 * literals but not through a function body: `'x'` in `toHaveText(['x'])`
 * belongs to toHaveText, while a constant declared inside a `test(…)` callback
 * belongs to no call.
 */
function stringLiterals(src) {
  const out = [];
  const frames = []; // every open "(", "{" and "${", innermost last
  let i = 0;
  let sig = 0; // where the last significant token ended: what precedes position i

  const preceding = (n) => src.slice(Math.max(0, sig - n), sig);
  const enclosingCall = () => {
    for (let f = frames.length - 1; f >= 0; f--) {
      if (frames[f].block) return '';
      if (frames[f].call !== undefined) return frames[f].call;
    }
    return '';
  };
  // What the two-character escape at j stands for. A whitespace escape becomes
  // a space, which is all normalise() would leave of it.
  const unescaped = (j) => (/[ntr\n]/.test(src[j + 1]) ? ' ' : (src[j + 1] ?? ''));

  // Reads template text from i up to the next `${` (then code resumes, and the
  // matching "}" brings us back here) or to the closing backtick.
  const readTemplate = (tpl) => {
    const start = i;
    let text = '';
    while (i < src.length && src[i] !== '`') {
      if (src[i] === '\\') {
        text += unescaped(i);
        i += 2;
      } else if (src[i] === '$' && src[i + 1] === '{') {
        tpl.pieces.push({ index: start, text });
        frames.push({ template: tpl });
        sig = i += 2;
        return;
      } else text += src[i++];
    }
    tpl.pieces.push({ index: start, text });
    for (const p of tpl.pieces) out.push({ ...p, piece: tpl.pieces.length > 1, call: tpl.call });
    sig = ++i;
  };

  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {
      const eol = src.indexOf('\n', i);
      i = eol === -1 ? src.length : eol;
    } else if (c === '/' && src[i + 1] === '*') {
      const close = src.indexOf('*/', i + 2);
      i = close === -1 ? src.length : close + 2;
    } else if (c === '"' || c === "'") {
      const start = i++;
      let text = '';
      while (i < src.length && src[i] !== c && src[i] !== '\n') {
        if (src[i] === '\\') {
          text += unescaped(i);
          i += 2;
        } else text += src[i++];
      }
      out.push({ index: start, text, piece: false, call: enclosingCall() });
      sig = ++i;
    } else if (c === '`') {
      i++;
      readTemplate({ pieces: [], call: enclosingCall() });
    } else if (c === '/' && REGEX_MAY_START.test(preceding(8))) {
      let j = i + 1;
      let inClass = false;
      while (j < src.length && src[j] !== '\n' && (inClass || src[j] !== '/')) {
        if (src[j] === '\\') j++;
        else if (src[j] === '[') inClass = true;
        else if (src[j] === ']') inClass = false;
        j++;
      }
      sig = i = src[j] === '/' ? j + 1 : i + 1;
    } else if (c === '(') {
      frames.push({ call: preceding(60).match(/([A-Za-z_$][\w$]*)$/)?.[1] ?? '' });
      sig = ++i;
    } else if (c === ')') {
      while (frames.length && frames.pop().call === undefined);
      sig = ++i;
    } else if (c === '{') {
      // After ")", "=>", a keyword or a statement's end a brace opens a block;
      // after "(", ",", ":", "=" and the like it opens an object literal.
      frames.push({ block: sig === 0 || /[)>\w$;{}]$/.test(preceding(1)) });
      sig = ++i;
    } else if (c === '}') {
      const top = frames[frames.length - 1];
      i++;
      if (top?.template) {
        frames.pop();
        readTemplate(top.template);
      } else {
        if (top?.block !== undefined) frames.pop();
        sig = i;
      }
    } else {
      if (!/\s/.test(c)) sig = i + 1;
      i++;
    }
  }
  return out;
}

// Calls whose string arguments are a locator's: the EXTRACTORS above own those.
const LOCATOR_CALL = /^(locator|filter|getBy[A-Z]\w*)$/;
// Calls whose string arguments are prose the suite wrote for its own reader:
// test and step titles, skip reasons, assertion messages, errors, logs. A title
// often repeats a piece of UI copy without depending on it.
const PROSE_CALL = /^(test|setup|describe|serial|parallel|only|step|skip|fixme|fail|slow|expect|soft|poll|\w*Error|log|warn)$/;
// The matchers that take text, and the suite's own `expect…` helpers (`toast.expectSuccess`).
const EXPECTATION_CALL =
  /^(to(Have|Contain)Text|toHaveValues?|toHaveAttribute|toHaveAccessible\w+|toHaveTitle|toBe|toEqual|toStrictEqual|toContain|toContainEqual|toMatchObject|expect[A-Z]\w*)$/;

/**
 * Whether a string literal is copy worth checking, and as what: 'expect',
 * 'literal' or null.
 *
 * Only phrases qualify. A single word, an identifier, a file name or a URL
 * meets Fleet's source by coincidence too easily (`README.md` in a code
 * comment), and when that coincidence ends the report would call it a
 * breakage. A whole literal needs two words; a piece of an interpolated
 * template is a sentence cut short, so it needs three. A backslash marks a
 * regex source, not copy.
 */
function phraseUse(literal, token) {
  if (LOCATOR_CALL.test(literal.call) || PROSE_CALL.test(literal.call)) return null;
  if (token.includes('\\')) return null;
  const words = token.split(' ').filter((w) => /[A-Za-z0-9]/.test(w)).length;
  if (words < (literal.piece ? 3 : 2)) return null;
  return EXPECTATION_CALL.test(literal.call) ? 'expect' : 'literal';
}

const PHRASE_KINDS = new Set(['expect', 'literal']);

function buildVocabulary(suiteDir) {
  /** @type {Map<string, {kind:string, token:string, sites:{file:string,line:number,as:string}[]}>} */
  const vocab = new Map();
  const add = (kind, token, site) => {
    const key = `${kind} ${token}`;
    if (!vocab.has(key)) vocab.set(key, { kind, token, sites: [] });
    vocab.get(key).sites.push(site);
  };

  for (const file of listSuiteFiles(suiteDir)) {
    const src = fs.readFileSync(file, 'utf8');
    // Offset → line number, computed once per file.
    const lineAt = (idx) => src.slice(0, idx).split('\n').length;
    const rel = path.relative(suiteDir, file);

    for (const { kind, re, pick } of EXTRACTORS) {
      for (const m of src.matchAll(re)) {
        for (let token of pick(m)) {
          if (!token || isNoise(token)) continue;
          if (kind === 'route') token = normaliseRoute(token);
          add(kind, token, { file: rel, line: lineAt(m.index), as: kind });
        }
      }
    }

    for (const literal of stringLiterals(src)) {
      const token = normalise(literal.text);
      const use = phraseUse(literal, token);
      if (use) add(use, token, { file: rel, line: lineAt(literal.index), as: use });
    }
  }

  // One entry per piece of copy. A phrase a locator also names joins that `name`
  // entry, and one that is expected somewhere is an `expect` entry everywhere;
  // each site keeps how it uses the phrase.
  for (const entry of [...vocab.values()]) {
    if (!PHRASE_KINDS.has(entry.kind)) continue;
    const stronger = vocab.get(`name ${entry.token}`) || (entry.kind === 'literal' && vocab.get(`expect ${entry.token}`));
    if (!stronger) continue;
    stronger.sites.push(...entry.sites);
    vocab.delete(`${entry.kind} ${entry.token}`);
  }
  return [...vocab.values()];
}

// ── Presence check ───────────────────────────────────────────────────────────

/**
 * Substring matching is wrong for class tokens: plain `.includes('.tag')`
 * is satisfied by `.tagName`, so a class Fleet actually deleted would be
 * reported as surviving. Class tokens therefore have to end on a character
 * that can't continue a class name.
 *
 * With one exception — a BEM modifier counts as its base. Fleet's SCSS often
 * mentions a class only in modifier form (`&.team-dropdown__control--is-focused`)
 * while the DOM carries base and modifier together, so demanding a hard
 * boundary would call a class that plainly exists "absent". `--` continues the
 * match; a single `-` does not, because `.fleet-dropdown-wrapper` is its own
 * class and says nothing about `.fleet-dropdown`.
 *
 * The dotted form is how a stylesheet writes a class. TSX writes the bare name
 * (`className="activity-feed-card"`, `baseClass = "activity-feed-card"`), and
 * Fleet can delete a class's SCSS rule while still rendering the class, so the
 * bare name counts too, where a quote or whitespace bounds it on both sides the
 * way a class attribute would. The same ending rules apply, so
 * `"fleet-dropdown-wrapper"` still says nothing about `.fleet-dropdown`. A
 * class that is one plain word (`.tag`) meets its bare name in any string
 * (`type: "tag"`), so for those the check can only ever say "present".
 *
 * indexOf-and-check beats a regex here — absent tokens fail on the first scan
 * instead of backtracking across the whole corpus.
 */
function containsClass(corpus, token) {
  const endsName = (end) => corpus.startsWith('--', end) || !/[A-Za-z0-9_-]/.test(corpus[end] ?? ' ');
  for (let i = corpus.indexOf(token); i !== -1; i = corpus.indexOf(token, i + 1)) {
    if (endsName(i + token.length)) return true;
  }

  const bare = token.slice(1);
  const bounds = (ch) => ch === undefined || /[\s"'`]/.test(ch);
  for (let i = corpus.indexOf(bare); i !== -1; i = corpus.indexOf(bare, i + 1)) {
    const end = i + bare.length;
    if (bounds(corpus[i - 1]) && (bounds(corpus[end]) || corpus.startsWith('--', end))) return true;
  }
  return false;
}

/**
 * A class Fleet never writes out, only builds: `${baseClass}__list-item-button`
 * in the file that declares `baseClass = "eula-list-item"`. Returns how that
 * file writes it, or null. The search stays inside the files that declare the
 * base, because nearly every component has a `${baseClass}__title`.
 */
function builtOnBase(bases, token) {
  const bare = token.slice(1);
  for (const sep of bare.matchAll(/__|--|-/g)) {
    const base = bare.slice(0, sep.index);
    const written = '${baseClass}' + bare.slice(sep.index);
    for (const file of bases.get(base) || []) {
      for (let i = file.indexOf(written); i !== -1; i = file.indexOf(written, i + 1)) {
        const end = i + written.length;
        if (file.startsWith('--', end) || !/[A-Za-z0-9_-]/.test(file[end] ?? ' ')) return { base, written };
      }
    }
  }
  return null;
}

const hasClass = (corpus, token) => containsClass(corpus.text, token) || builtOnBase(corpus.bases, token) !== null;

const WORD = /[A-Za-z0-9]+/g;

/**
 * Wraps a corpus with the two lookups that would otherwise mean reading all of
 * it once per token:
 *
 *   wordsAt — where each of `words` starts. `includes` reads the whole corpus
 *             every time a token is absent, and most of the suite's phrases
 *             are: test data and messages the suite composes were never in
 *             Fleet's source. With this, a phrase is tried only where its
 *             rarest word occurs.
 *   bases   — the text of each file that declares `baseClass = "…"`, by base.
 */
function searchable(text, words) {
  const wordsAt = new Map();
  for (const m of text.matchAll(WORD)) {
    if (!words.has(m[0])) continue;
    if (!wordsAt.has(m[0])) wordsAt.set(m[0], []);
    wordsAt.get(m[0]).push(m.index);
  }

  const bases = new Map();
  for (const m of text.matchAll(/\bbaseClass\s*[:=]\s*["'`]([A-Za-z0-9_-]+)["'`]/g)) {
    const end = text.indexOf('\n', m.index);
    const file = text.slice(text.lastIndexOf('\n', m.index) + 1, end === -1 ? text.length : end);
    if (!bases.has(m[1])) bases.set(m[1], []);
    bases.get(m[1]).push(file);
  }
  return { text, wordsAt, bases };
}

/**
 * Whether the corpus holds `phrase`, starting and ending on a word boundary:
 * `Package (deb)` is not found inside `Subpackage (deb)`.
 */
function containsPhrase({ text, wordsAt }, phrase) {
  let rarest = null;
  for (const m of phrase.matchAll(WORD)) {
    const at = wordsAt.get(m[0]);
    if (!at) return false;
    if (!rarest || at.length < rarest.at.length) rarest = { at, offset: m.index };
  }
  if (!rarest) return false;
  const wordChar = (i) => /[A-Za-z0-9]/.test(text[i] ?? ' ');
  const opens = /^[A-Za-z0-9]/.test(phrase);
  const closes = /[A-Za-z0-9]$/.test(phrase);
  return rarest.at.some((at) => {
    const start = at - rarest.offset;
    return (
      start >= 0 &&
      text.startsWith(phrase, start) &&
      !(opens && wordChar(start - 1)) &&
      !(closes && wordChar(start + phrase.length))
    );
  });
}

const present = (corpus, entry) => {
  if (entry.kind === 'class') return hasClass(corpus, entry.token);
  if (PHRASE_KINDS.has(entry.kind)) return containsPhrase(corpus, entry.token);
  return corpus.text.includes(normalise(entry.token));
};

function classify(vocab, fromCorpus, toCorpus) {
  const broken = [];
  const unverifiable = [];
  let ok = 0;

  for (const entry of vocab) {
    // A token the FROM tree never held is unverifiable whatever the target says.
    if (!present(fromCorpus, entry)) unverifiable.push(entry);
    else if (present(toCorpus, entry)) ok++;
    else broken.push(entry);
  }
  return { broken, unverifiable, ok };
}

/** The files that declare `baseClass = "<base>"` at a revision. */
function filesDeclaringBase(repo, sha, base) {
  const out = git(repo, ['grep', '-l', '-F', `baseClass = "${base}"`, sha, '--', 'frontend'], { allowFail: true });
  return out ? out.split('\n').filter(Boolean).map((entry) => entry.replace(`${sha}:`, '')) : [];
}

/**
 * Every class the target tree builds on `base`.
 *
 * A flat text search finds almost none of these: Fleet writes BEM as
 * `` className={`${baseClass}__button`} `` in TSX and `&__button` in nested
 * SCSS, so `fleet-dropdown__button` exists in the DOM and nowhere in the
 * source as a literal. Resolution has to go through the component that owns
 * the base — find the file declaring `baseClass = "<base>"`, then expand its
 * template literals and its stylesheet's `&`-nesting.
 */
function classesForBase(repo, toSha, base) {
  const found = new Set();
  for (const file of filesDeclaringBase(repo, toSha, base).slice(0, 4)) {
    const dir = path.dirname(file);
    const siblings = git(repo, ['ls-tree', '--name-only', `${toSha}:${dir}`], { allowFail: true }) || '';

    for (const name of [path.basename(file), ...siblings.split('\n').filter((n) => n.endsWith('.scss'))]) {
      const src = git(repo, ['show', `${toSha}:${path.join(dir, name)}`], { allowFail: true });
      if (!src) continue;
      // TSX: `${baseClass}__button`, `${baseClass}-wrapper--disabled`
      for (const m of src.matchAll(/\$\{baseClass\}((?:__|--|-)[a-z0-9][a-z0-9-]*(?:--[a-z0-9-]+)?)/g)) {
        found.add(`.${base}${m[1]}`);
      }
      // SCSS: `&__button {`, `&--open {`
      for (const m of src.matchAll(/&((?:__|--)[a-z0-9][a-z0-9-]*)\s*[{,]/g)) {
        found.add(`.${base}${m[1]}`);
      }
    }
  }
  return [...found].sort();
}

const shippedDiffs = new Map();

/**
 * A commit's patch to the files a corpus is built from. Fleet's tests are left
 * out here as they are there, so neither the commit named as the removal nor
 * the replacement read from its diff comes from a test.
 */
function shippedDiff(repo, sha) {
  if (!shippedDiffs.has(sha)) {
    const diff = git(repo, ['show', '--format=', sha, '--', ...CORPUS_PATHS], { allowFail: true }) || '';
    const files = diff.split(/^(?=diff --git )/m);
    shippedDiffs.set(sha, files.filter((f) => inCorpus(f.match(/^diff --git a\/(\S+) b\//)?.[1] ?? '')).join(''));
  }
  return shippedDiffs.get(sha);
}

/**
 * Pickaxe the commit that removed `needle` (a token as Fleet's source writes
 * it) from `paths`, so the report can name the PR.
 */
function blameRemoval(repo, fromSha, toSha, needle, paths = CORPUS_PATHS) {
  const out = git(
    repo,
    ['log', '--format=%H%x09%s', '--max-count=8', `-S${needle}`, `${fromSha}..${toSha}`, '--', ...paths],
    { allowFail: true },
  );
  if (!out) return [];
  const touches = (sha) => shippedDiff(repo, sha).split('\n').some((l) => /^[-+]/.test(l) && l.includes(needle));
  return out
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [sha, subject] = l.split('\t');
      const pr = subject.match(/\(#(\d+)\)/);
      return { sha, short: sha.slice(0, 10), subject, pr: pr ? pr[1] : null };
    })
    .filter((commit) => touches(commit.sha))
    .slice(0, 3);
}

const words = (s) => s.toLowerCase().match(/[a-z0-9]+/g) || [];

/** Fraction of words shared, relative to the longer string. */
function similarity(a, b) {
  const wa = words(a);
  const wb = new Set(words(b));
  if (!wa.length || !wb.size) return 0;
  const hits = wa.filter((w) => wb.has(w)).length;
  return hits / Math.max(wa.length, wb.size);
}

/**
 * What replaced the token. Rename detection is useless here — Fleet's
 * component renames rewrite the file past git's similarity threshold
 * (TeamsDropdown → FleetsDropdown pairs as add+delete, not R) — so instead
 * we read the removing commit's own diff:
 *
 *   class tokens → the `baseClass = "…"` line the commit ADDED. A BEM base
 *                  swap is the whole story: `.team-dropdown__control`
 *                  becomes `.fleet-dropdown__control`.
 *   copy tokens  → the added line in the same diff that shares most of its
 *                  words with the removed one ("View data for all hosts" →
 *                  "View report for all hosts").
 *
 * Every hint is checked against the target tree before it is printed. That
 * matters: swapping the BEM base is only right when the DOM kept its shape.
 * `.team-dropdown__control` → `.fleet-dropdown__control` LOOKS right and is
 * wrong — 4.91 replaced the react-select control with a plain button — so
 * instead of asserting a class that does not exist, the report falls back to
 * listing what the successor component actually emits.
 */
function successorHints(repo, commitSha, toSha, kind, token, toCorpus) {
  const diff = shippedDiff(repo, commitSha);
  if (!diff) return [];
  const lines = diff.split('\n');
  const hints = [];

  if (kind === 'class') {
    // `.pill-badge` → base "pill-badge", suffix "". `.a__b` → base "a", suffix "__b".
    const bare = token.replace(/^\./, '');
    const sep = bare.search(/__|--/);
    const suffix = sep === -1 ? '' : bare.slice(sep);
    const bases = new Set();
    for (const l of lines) {
      const m = l.match(/^\+.*baseClass\s*=\s*["'`]([^"'`]+)["'`]/);
      if (m) bases.add(m[1]);
    }
    for (const b of [...bases].slice(0, 3)) {
      const direct = `.${b}${suffix}`;
      if (hasClass(toCorpus, direct)) {
        hints.push({ confident: true, text: `\`${direct}\`` });
        continue;
      }
      // Base survived, the element didn't. Show the successor's real classes.
      const menu = classesForBase(repo, toSha, b);
      if (menu.length) {
        hints.push({
          confident: false,
          text:
            `\`${direct}\` does **not** exist in the target — the component was reshaped, ` +
            `not just renamed. \`${b}\` now emits: ` +
            menu.slice(0, 12).map((c) => `\`${c}\``).join(', ') +
            (menu.length > 12 ? `, …` : ''),
        });
      }
    }
  } else if (kind === 'name' || PHRASE_KINDS.has(kind)) {
    const norm = normalise(token);
    let best = null;
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].startsWith('-') || !normalise(lines[i]).includes(norm)) continue;
      // Scan the neighbourhood of the removal for its replacement.
      for (let j = Math.max(0, i - 12); j < Math.min(lines.length, i + 12); j++) {
        if (!lines[j].startsWith('+') || lines[j].startsWith('+++')) continue;
        const cand = normalise(lines[j].slice(1));
        if (cand.length < 3 || cand.length > 120) continue;
        const score = similarity(norm, cand);
        if (score >= 0.5 && (!best || score > best.score)) best = { cand, score };
      }
    }
    if (best && toCorpus.text.includes(normalise(best.cand))) {
      hints.push({ confident: true, text: `\`${best.cand}\`` });
    }
  }
  return hints;
}

// ── Churn map + changelog ────────────────────────────────────────────────────

function churnByArea(repo, fromSha, toSha) {
  const numstat = git(repo, ['diff', '--numstat', `${fromSha}...${toSha}`, '--', ...CORPUS_PATHS]);
  /** @type {Map<string, {files:Set<string>, churn:number}>} */
  const areas = new Map();
  const unmapped = [];

  for (const line of numstat.split('\n').filter(Boolean)) {
    const [addStr, delStr, file] = line.split('\t');
    if (!file) continue;
    const churn = (Number(addStr) || 0) + (Number(delStr) || 0);
    const area = areaFor(file);
    if (!area) {
      unmapped.push(file);
      continue;
    }
    if (!areas.has(area)) areas.set(area, { files: new Set(), churn: 0 });
    const rec = areas.get(area);
    rec.files.add(file);
    rec.churn += churn;
  }
  return {
    areas: [...areas.entries()].sort((a, b) => b[1].churn - a[1].churn),
    unmapped,
  };
}

/** changes/ fragments present in TO but not FROM — the release's own notes. */
function changelogFragments(repo, fromSha, toSha) {
  const names = git(repo, ['diff', '--name-only', '--diff-filter=A', `${fromSha}...${toSha}`, '--', 'changes/']);
  const out = [];
  for (const file of names.split('\n').filter(Boolean)) {
    if (file.endsWith('.keep')) continue;
    const body = git(repo, ['show', `${toSha}:${file}`], { allowFail: true });
    if (body) out.push({ file: path.basename(file), body: body.replace(/\s+/g, ' ').trim() });
  }
  return out;
}

/**
 * Commits on FROM whose patch has no equivalent on TO. Upgrading from a patch
 * RC to a minor RC can genuinely LOSE a fix that was only ever cherry-picked
 * to the patch branch — this is the list to eyeball for that.
 */
function missingOnTarget(repo, fromSha, toSha) {
  const out = git(
    repo,
    ['log', '--cherry-mark', '--right-only', '--oneline', `${toSha}...${fromSha}`],
    { allowFail: true },
  );
  if (!out) return [];
  return out
    .split('\n')
    .filter((l) => l && !l.startsWith('='))
    .map((l) => l.replace(/^[+>]\s*/, ''));
}

// ── Live instance ────────────────────────────────────────────────────────────

function readEnv(suiteDir, tier) {
  const file = path.join(suiteDir, `.env.${tier}`);
  if (!fs.existsSync(file)) return null;
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

async function fleetVersion(suiteDir, tier) {
  const env = readEnv(suiteDir, tier);
  if (!env?.FLEET_URL) return { tier, error: `no .env.${tier} (or no FLEET_URL in it)` };
  try {
    const res = await fetch(`${env.FLEET_URL}/api/v1/fleet/version`, {
      headers: env.FLEET_API_TOKEN ? { Authorization: `Bearer ${env.FLEET_API_TOKEN}` } : {},
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return { tier, error: `HTTP ${res.status} from ${env.FLEET_URL}` };
    const body = await res.json();
    return { tier, host: new URL(env.FLEET_URL).host, ...body };
  } catch (err) {
    return { tier, error: err.message };
  }
}

// ── Report ───────────────────────────────────────────────────────────────────

function renderReport(ctx) {
  const {
    from, to, live, broken, unverifiable, okCount, vocabCount, phraseCount,
    churn, fragments, missing, repo, fromSha, toSha,
  } = ctx;

  const L = [];
  const p = (s = '') => L.push(s);

  p(`# Upgrade preflight — ${from.short} → ${to.short}`);
  p();
  p(`| | ref | commit | date |`);
  p(`|---|---|---|---|`);
  p(`| **from** (running now) | \`${ctx.fromRef}\` | \`${from.short}\` | ${from.date} |`);
  p(`| **to** (upgrading to) | \`${ctx.toRef}\` | \`${to.short}\` | ${to.date} |`);
  p();
  if (live.length) {
    p(`Live instances at scan time:`);
    for (const v of live) {
      p(v.error ? `- ${v.tier}: _${v.error}_` : `- **${v.tier}** \`${v.version}\` (${v.branch} @ \`${v.revision.slice(0, 10)}\`)`);
    }
    p();
  }
  p(`Checked **${vocabCount - phraseCount}** locator tokens and **${phraseCount}** expected values and ` +
    `constants from the suite against both trees: **${broken.length} breaking**, ${okCount} still present, ` +
    `${unverifiable.length} unverifiable (never literal in Fleet's source — dynamic copy, API-derived text, ` +
    `the suite's own test data).`);
  p();

  // 1. Breaking selectors and copy
  p(`## 1. Breaking selectors and copy — present today, gone after the upgrade`);
  p();
  if (!broken.length) {
    p(`_None._ Nothing the suite names disappears between these two revisions.`);
    p();
  } else {
    const byKind = { class: [], testid: [], name: [], route: [], expect: [], literal: [] };
    for (const b of broken) byKind[b.kind].push(b);
    const KIND_TITLE = {
      class: 'CSS classes',
      testid: 'Test IDs',
      name: 'Accessible names / visible copy (locators)',
      route: 'API routes',
      expect: 'Expected values',
      literal: 'Constants and page-object arguments',
    };
    const KIND_NOTE = {
      expect:
        'Not locators: text the suite compares the page against, as an argument of a matcher ' +
        '(`toHaveText`, `toContainText`, …) or of one of its own `expect…` helpers.',
      literal:
        'Not locators either: phrases the suite keeps in a constant or hands to a page object, ' +
        'which turns them into a locator or an expectation. Follow each site to see which.',
    };
    // How a site uses the token: a phrase can be located in one file and expected in another.
    const SITE_VERB = { expect: 'expected at', literal: 'named at' };
    for (const kind of ['class', 'testid', 'route', 'name', 'expect', 'literal']) {
      const items = byKind[kind];
      if (!items.length) continue;
      p(`### ${KIND_TITLE[kind]} (${items.length})`);
      p();
      if (KIND_NOTE[kind]) {
        p(KIND_NOTE[kind]);
        p();
      }
      for (const item of items) {
        // A class Fleet only builds is literal nowhere, so its removal is looked
        // for as the owning component writes it, in the files that declare the base.
        const built =
          kind === 'class' && !containsClass(ctx.fromCorpus.text, item.token)
            ? builtOnBase(ctx.fromCorpus.bases, item.token)
            : null;
        const owners = built ? filesDeclaringBase(repo, fromSha, built.base) : [];
        const blame = owners.length
          ? blameRemoval(repo, fromSha, toSha, built.written, owners)
          : blameRemoval(repo, fromSha, toSha, kind === 'class' ? item.token.slice(1) : item.token);
        p(`- \`${item.token}\``);
        if (built) p(`  - Fleet builds it: \`${built.written}\` where \`baseClass = "${built.base}"\``);
        for (const s of item.sites.slice(0, 6)) {
          p(`  - ${SITE_VERB[s.as] || 'used at'} [${s.file}:${s.line}](${s.file}#L${s.line})`);
        }
        if (item.sites.length > 6) p(`  - …and ${item.sites.length - 6} more site(s)`);
        for (const b of blame) {
          const link = b.pr ? ` — https://github.com/fleetdm/fleet/pull/${b.pr}` : '';
          p(`  - removed by \`${b.short}\` ${b.subject}${link}`);
        }
        if (built && ctx.toCorpus.bases.has(built.base)) {
          // The component is still there, so its successor is not some other
          // component the removing commit happened to add.
          const menu = classesForBase(repo, toSha, built.base).slice(0, 12);
          p(`  - ⚠︎ \`${built.base}\` is still a component in the target and no longer builds this class. ` +
            (menu.length ? `It now emits: ${menu.map((c) => `\`${c}\``).join(', ')}` : `It emits no class built on its base.`));
        } else if (blame.length) {
          const hints = successorHints(repo, blame[0].sha, toSha, item.kind, item.token, ctx.toCorpus);
          for (const h of hints) {
            p(`  - ${h.confident ? '**replacement (verified in target):**' : '⚠︎'} ${h.text}`);
          }
        }
      }
      p();
    }
  }

  // 2. Churn map
  p(`## 2. UI churn by spec area — where behaviour may have moved`);
  p();
  p(`Selectors surviving does not mean flows survived. These are the Fleet UI`);
  p(`directories that changed, mapped to the spec areas that drive them.`);
  p();
  p(`| spec area | changed files | churn (± lines) |`);
  p(`|---|---:|---:|`);
  for (const [area, rec] of churn.areas) {
    p(`| ${area} | ${rec.files.size} | ${rec.churn} |`);
  }
  p();
  if (churn.unmapped.length) {
    p(`<details><summary>${churn.unmapped.length} changed file(s) with no spec-area mapping</summary>`);
    p();
    for (const f of churn.unmapped.slice(0, 40)) p(`- \`${f}\``);
    if (churn.unmapped.length > 40) p(`- …and ${churn.unmapped.length - 40} more`);
    p();
    p(`</details>`);
    p();
  }

  // 3. Fixes that may be lost
  p(`## 3. Fixes on the running build with no equivalent on the target`);
  p();
  if (!missing.length) {
    p(`_None._ Every commit on the running build has a patch-equivalent on the target.`);
  } else {
    p(`These commits exist on the build running **today** but have no patch-equivalent`);
    p(`on the target. Some are re-cherry-picks with a different SHA (match by title);`);
    p(`the rest are fixes the upgrade rolls back.`);
    p();
    for (const m of missing) p(`- \`${m}\``);
  }
  p();

  // 4. Changelog
  p(`## 4. Changelog fragments new in the target (${fragments.length})`);
  p();
  if (!fragments.length) {
    p(`_None._`);
  } else {
    p(`<details><summary>expand</summary>`);
    p();
    for (const f of fragments) p(`- **${f.file}** — ${f.body}`);
    p();
    p(`</details>`);
  }
  p();

  // 5. Unverifiable. Only locator tokens are listed: the phrases among them are
  // mostly the suite's own test data, and would bury the classes worth reading.
  const unverifiableLocators = unverifiable.filter((u) => !PHRASE_KINDS.has(u.kind));
  p(`## 5. Unverifiable tokens (${unverifiableLocators.length})`);
  p();
  p(`Never present as a literal in Fleet's source at **either** revision, so their`);
  p(`absence in the target proves nothing. Listed for completeness — copy that is`);
  p(`assembled from variables, or text that comes back from the API, lands here.`);
  p();
  p(`<details><summary>expand</summary>`);
  p();
  for (const u of unverifiableLocators.slice(0, 200)) {
    p(`- \`${u.token}\` (${u.kind}) — ${u.sites[0].file}:${u.sites[0].line}`);
  }
  if (unverifiableLocators.length > 200) p(`- …and ${unverifiableLocators.length - 200} more`);
  p();
  p(`</details>`);
  p();
  p(`Not listed: ${unverifiable.length - unverifiableLocators.length} expected values and constants that Fleet's`);
  p(`source held at neither revision (test data, messages the suite composes).`);
  p();

  return L.join('\n');
}

// ── CLI ──────────────────────────────────────────────────────────────────────

const log = (...a) => console.error(...a);
function die(msg) {
  console.error(`\nerror: ${msg}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) out[a.slice(2)] = argv[i + 1]?.startsWith('--') ? true : argv[++i];
    else out._.push(a);
  }
  return out;
}

async function cmdDetect(args) {
  const suiteDir = resolveSuiteDir(args.suite);
  const results = await Promise.all([fleetVersion(suiteDir, 'premium'), fleetVersion(suiteDir, 'free')]);
  for (const r of results) {
    if (r.error) console.log(`${r.tier.padEnd(8)} ERROR  ${r.error}`);
    else console.log(`${r.tier.padEnd(8)} ${r.version}  branch=${r.branch}  revision=${r.revision}  (${r.host})`);
  }
  const live = results.find((r) => !r.error);
  if (live) {
    console.log(`\nUse as --from: ${live.revision}`);
  }
  return results;
}

async function cmdScan(args) {
  if (!args.to) die(`--to <ref> is required (e.g. --to origin/rc-minor-fleet-v4.91.0).`);
  const repo = resolveFleetRepo(args['fleet-repo']);
  const suiteDir = resolveSuiteDir(args.suite);
  log(`fleet repo: ${repo}`);
  log(`suite:      ${suiteDir}`);

  log(`\ndetecting the running build…`);
  const live = await Promise.all([fleetVersion(suiteDir, 'premium'), fleetVersion(suiteDir, 'free')]);
  for (const v of live) {
    log(v.error ? `  ${v.tier}: ${v.error}` : `  ${v.tier}: ${v.version} (${v.branch})`);
  }

  let fromRef = args.from;
  if (!fromRef) {
    const detected = live.find((v) => !v.error && v.revision);
    if (!detected) die(`Could not read the running revision from any instance. Pass --from <ref> explicitly.`);
    fromRef = detected.revision;
    log(`  → using the live revision as --from`);
  }

  log(`\nresolving refs…`);
  const fromSha = resolveRef(repo, fromRef);
  const toSha = resolveRef(repo, args.to);
  const from = describeRef(repo, fromSha);
  const to = describeRef(repo, toSha);
  log(`  from ${from.short}  ${from.subject}`);
  log(`  to   ${to.short}  ${to.subject}`);
  if (fromSha === toSha) die(`--from and --to resolve to the same commit.`);

  log(`\nextracting the suite's vocabulary…`);
  const vocab = buildVocabulary(suiteDir);
  const phrases = vocab.filter((entry) => PHRASE_KINDS.has(entry.kind));
  log(`  ${vocab.length - phrases.length} locator tokens, ${phrases.length} expected values and constants`);

  log(`\nbuilding corpora…`);
  const phraseWords = new Set(phrases.flatMap((entry) => entry.token.match(WORD) || []));
  const fromCorpus = searchable(corpusFor(repo, fromSha), phraseWords);
  const toCorpus = searchable(corpusFor(repo, toSha), phraseWords);
  log(`  from: ${(fromCorpus.text.length / 1e6).toFixed(1)} MB   to: ${(toCorpus.text.length / 1e6).toFixed(1)} MB`);

  const { broken, unverifiable, ok } = classify(vocab, fromCorpus, toCorpus);
  log(`  ${broken.length} breaking, ${ok} present in both, ${unverifiable.length} unverifiable`);

  log(`\nmapping churn + changelog…`);
  const churn = churnByArea(repo, fromSha, toSha);
  const fragments = changelogFragments(repo, fromSha, toSha);
  const missing = missingOnTarget(repo, fromSha, toSha);
  log(`  ${churn.areas.length} spec areas touched, ${fragments.length} changelog fragments, ${missing.length} commits with no equivalent on target`);

  const md = renderReport({
    from, to, fromRef, toRef: args.to, fromSha, toSha, repo, live, fromCorpus, toCorpus,
    broken, unverifiable, okCount: ok, vocabCount: vocab.length, phraseCount: phrases.length,
    churn, fragments, missing,
  });

  const outPath = path.resolve(
    args.out ||
      path.join(suiteDir, 'docs', 'upgrade-preflight', `${from.short}-to-${to.short}.md`),
  );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, md);
  log(`\nreport → ${outPath}`);
  console.log(outPath);
}

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];

if (cmd === 'detect') await cmdDetect(args);
else if (cmd === 'scan') await cmdScan(args);
else {
  console.error(`usage:
  preflight.mjs detect [--suite <path>]
  preflight.mjs scan --to <ref> [--from <ref|sha>] [--fleet-repo <path>] [--suite <path>] [--out <file>]

  --to           Fleet ref you are upgrading TO (e.g. origin/rc-minor-fleet-v4.91.0)
  --from         Fleet ref running now. Defaults to the live instance's revision.
  --fleet-repo   Path to a fleetdm/fleet checkout. Defaults to $FLEET_REPO, else ../fleet.
  --suite        The playwright/ directory to read: its specs and page objects, and its
                 .env files for the instances. Defaults to this repo's; point it at another
                 checkout's to scan the suite as it was at an older commit.
  --out          Report path. Defaults to docs/upgrade-preflight/<from-sha10>-to-<to-sha10>.md in the suite read.
`);
  process.exit(cmd ? 1 : 0);
}
