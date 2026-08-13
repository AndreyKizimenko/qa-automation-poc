#!/usr/bin/env node
/**
 * fleet-upgrade-preflight — predict which Playwright tests a Fleet upgrade
 * will break, BEFORE the instance is upgraded.
 *
 * The core idea is a two-tree presence check, not a diff heuristic:
 *
 *   For every selector token the suite depends on (CSS class, accessible
 *   name, placeholder, test id, API route), ask two questions —
 *     1. does it exist in Fleet's source at the revision we run TODAY?
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
 */

import { execFileSync } from 'node:child_process';
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
const SUITE_DIR = path.join(REPO_DIR, 'playwright');

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

const CACHE_DIR = path.join(os.tmpdir(), 'fleet-upgrade-preflight');

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

// ── Corpus: the full text of Fleet's UI + route tables at one revision ───────
//
// Materialised once per SHA and cached in the OS temp dir. Whitespace is
// collapsed so that copy JSX wrapped across lines ("Add\n  software") still
// matches a suite selector written on one line.

function corpusFor(repo, sha) {
  const cached = path.join(CACHE_DIR, `${sha}.txt`);
  if (fs.existsSync(cached)) return fs.readFileSync(cached, 'utf8');

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const work = fs.mkdtempSync(path.join(CACHE_DIR, 'extract-'));
  log(`  materialising ${sha.slice(0, 10)} (${CORPUS_PATHS.join(', ')})…`);
  execFileSync(
    'bash',
    ['-c', `git -C "${repo}" archive ${sha} ${CORPUS_PATHS.join(' ')} | tar -x -C "${work}"`],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );

  const chunks = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.(tsx?|jsx?|scss|css|go|html)$/.test(entry.name)) {
        chunks.push(fs.readFileSync(p, 'utf8'));
      }
    }
  };
  walk(work);
  fs.rmSync(work, { recursive: true, force: true });

  const corpus = chunks.join('\n').replace(/\s+/g, ' ');
  fs.writeFileSync(cached, corpus);
  return corpus;
}

const normalise = (s) => s.replace(/\s+/g, ' ').trim();

// ── Suite vocabulary: everything the tests name in Fleet's UI ────────────────

const SCAN_ROOTS = ['pages', 'helpers', 'tests', 'setup', 'fixtures.ts'];

function listSuiteFiles() {
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
    const p = path.join(SUITE_DIR, root);
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

/** Copy tokens that are too generic to mean anything in a 27 MB corpus. */
const NOISE = new Set(['.first', '.last', '.and', '.or', '.not']);
const isNoise = (t) => NOISE.has(t) || t.length < 3;

function buildVocabulary() {
  /** @type {Map<string, {kind:string, token:string, sites:{file:string,line:number}[]}>} */
  const vocab = new Map();

  for (const file of listSuiteFiles()) {
    const src = fs.readFileSync(file, 'utf8');
    // Offset → line number, computed once per file.
    const lineAt = (idx) => src.slice(0, idx).split('\n').length;
    const rel = path.relative(SUITE_DIR, file);

    for (const { kind, re, pick } of EXTRACTORS) {
      for (const m of src.matchAll(re)) {
        for (let token of pick(m)) {
          if (!token || isNoise(token)) continue;
          if (kind === 'route') token = normaliseRoute(token);
          const key = `${kind} ${token}`;
          if (!vocab.has(key)) vocab.set(key, { kind, token, sites: [] });
          vocab.get(key).sites.push({ file: rel, line: lineAt(m.index) });
        }
      }
    }
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
 * indexOf-and-check beats a regex here — absent tokens fail on the first scan
 * instead of backtracking across 38 MB.
 */
function containsClass(corpus, token) {
  let i = corpus.indexOf(token);
  while (i !== -1) {
    const rest = corpus.slice(i + token.length, i + token.length + 2);
    if (rest === '' || rest.startsWith('--') || !/[A-Za-z0-9_-]/.test(rest[0])) return true;
    i = corpus.indexOf(token, i + 1);
  }
  return false;
}

const present = (corpus, entry) =>
  entry.kind === 'class'
    ? containsClass(corpus, entry.token)
    : corpus.includes(normalise(entry.token));

function classify(vocab, fromCorpus, toCorpus) {
  const broken = [];
  const unverifiable = [];
  let ok = 0;

  for (const entry of vocab) {
    const inFrom = present(fromCorpus, entry);
    const inTo = present(toCorpus, entry);

    if (inFrom && !inTo) broken.push(entry);
    else if (inFrom) ok++;
    else unverifiable.push(entry);
  }
  return { broken, unverifiable, ok };
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
  const owners = git(repo, ['grep', '-l', '-F', `baseClass = "${base}"`, toSha, '--', 'frontend'], {
    allowFail: true,
  });
  if (!owners) return [];

  const found = new Set();
  for (const entry of owners.split('\n').filter(Boolean).slice(0, 4)) {
    const file = entry.replace(`${toSha}:`, '');
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

/** Pickaxe the commit that removed a token, so the report can name the PR. */
function blameRemoval(repo, fromSha, toSha, token) {
  const needle = token.startsWith('.') ? token.slice(1) : token;
  const out = git(
    repo,
    ['log', '--format=%H%x09%s', '--max-count=3', `-S${needle}`, `${fromSha}..${toSha}`, '--', ...CORPUS_PATHS],
    { allowFail: true },
  );
  if (!out) return [];
  return out.split('\n').filter(Boolean).map((l) => {
    const [sha, subject] = l.split('\t');
    const pr = subject.match(/\(#(\d+)\)/);
    return { sha, short: sha.slice(0, 10), subject, pr: pr ? pr[1] : null };
  });
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
  const diff = git(repo, ['show', '--format=', commitSha, '--', ...CORPUS_PATHS], {
    allowFail: true,
  });
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
      if (containsClass(toCorpus, direct)) {
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
  } else if (kind === 'name') {
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
    if (best && toCorpus.includes(normalise(best.cand))) {
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

function readEnv(tier) {
  const file = path.join(SUITE_DIR, `.env.${tier}`);
  if (!fs.existsSync(file)) return null;
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

async function fleetVersion(tier) {
  const env = readEnv(tier);
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
    from, to, live, broken, unverifiable, okCount, vocabCount,
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
  p(`Checked **${vocabCount}** selector tokens from the suite against both trees: ` +
    `**${broken.length} breaking**, ${okCount} still present, ${unverifiable.length} unverifiable ` +
    `(never literal in Fleet's source — dynamic copy or API-derived text).`);
  p();

  // 1. Breaking selectors
  p(`## 1. Breaking selectors — present today, gone after the upgrade`);
  p();
  if (!broken.length) {
    p(`_None._ No selector the suite names disappears between these two revisions.`);
    p();
  } else {
    const byKind = { class: [], testid: [], name: [], route: [] };
    for (const b of broken) byKind[b.kind].push(b);
    const KIND_TITLE = {
      class: 'CSS classes',
      testid: 'Test IDs',
      name: 'Accessible names / visible copy',
      route: 'API routes',
    };
    for (const kind of ['class', 'testid', 'route', 'name']) {
      const items = byKind[kind];
      if (!items.length) continue;
      p(`### ${KIND_TITLE[kind]} (${items.length})`);
      p();
      for (const item of items) {
        const blame = blameRemoval(repo, fromSha, toSha, item.token);
        p(`- \`${item.token}\``);
        for (const s of item.sites.slice(0, 6)) {
          p(`  - used at [${s.file}:${s.line}](${s.file}#L${s.line})`);
        }
        if (item.sites.length > 6) p(`  - …and ${item.sites.length - 6} more site(s)`);
        for (const b of blame) {
          const link = b.pr ? ` — https://github.com/fleetdm/fleet/pull/${b.pr}` : '';
          p(`  - removed by \`${b.short}\` ${b.subject}${link}`);
        }
        if (blame.length) {
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

  // 5. Unverifiable
  p(`## 5. Unverifiable tokens (${unverifiable.length})`);
  p();
  p(`Never present as a literal in Fleet's source at **either** revision, so their`);
  p(`absence in the target proves nothing. Listed for completeness — copy that is`);
  p(`assembled from variables, or text that comes back from the API, lands here.`);
  p();
  p(`<details><summary>expand</summary>`);
  p();
  for (const u of unverifiable.slice(0, 200)) {
    p(`- \`${u.token}\` (${u.kind}) — ${u.sites[0].file}:${u.sites[0].line}`);
  }
  if (unverifiable.length > 200) p(`- …and ${unverifiable.length - 200} more`);
  p();
  p(`</details>`);
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

async function cmdDetect() {
  const results = await Promise.all([fleetVersion('premium'), fleetVersion('free')]);
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
  log(`fleet repo: ${repo}`);

  log(`\ndetecting the running build…`);
  const live = await Promise.all([fleetVersion('premium'), fleetVersion('free')]);
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

  log(`\nbuilding corpora…`);
  const fromCorpus = corpusFor(repo, fromSha);
  const toCorpus = corpusFor(repo, toSha);
  log(`  from: ${(fromCorpus.length / 1e6).toFixed(1)} MB   to: ${(toCorpus.length / 1e6).toFixed(1)} MB`);

  log(`\nextracting the suite's selector vocabulary…`);
  const vocab = buildVocabulary();
  log(`  ${vocab.length} distinct tokens`);

  const { broken, unverifiable, ok } = classify(vocab, fromCorpus, toCorpus);
  log(`  ${broken.length} breaking, ${ok} present in both, ${unverifiable.length} unverifiable`);

  log(`\nmapping churn + changelog…`);
  const churn = churnByArea(repo, fromSha, toSha);
  const fragments = changelogFragments(repo, fromSha, toSha);
  const missing = missingOnTarget(repo, fromSha, toSha);
  log(`  ${churn.areas.length} spec areas touched, ${fragments.length} changelog fragments, ${missing.length} commits with no equivalent on target`);

  const md = renderReport({
    from, to, fromRef, toRef: args.to, fromSha, toSha, repo, live, toCorpus,
    broken, unverifiable, okCount: ok, vocabCount: vocab.length,
    churn, fragments, missing,
  });

  const outPath = path.resolve(
    args.out ||
      path.join(SUITE_DIR, 'docs', 'upgrade-preflight', `${from.short}-to-${to.short}.md`),
  );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, md);
  log(`\nreport → ${outPath}`);
  console.log(outPath);
}

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];

if (cmd === 'detect') await cmdDetect();
else if (cmd === 'scan') await cmdScan(args);
else {
  console.error(`usage:
  preflight.mjs detect
  preflight.mjs scan --to <ref> [--from <ref|sha>] [--fleet-repo <path>] [--out <file>]

  --to           Fleet ref you are upgrading TO (e.g. origin/rc-minor-fleet-v4.91.0)
  --from         Fleet ref running now. Defaults to the live instance's revision.
  --fleet-repo   Path to a fleetdm/fleet checkout. Defaults to ../fleet, or $FLEET_REPO.
  --out          Report path. Defaults to docs/upgrade-preflight/<from>-to-<to>.md
`);
  process.exit(cmd ? 1 : 0);
}
