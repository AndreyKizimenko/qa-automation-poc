---
name: fleet-upgrade-preflight
description: Run BEFORE upgrading a Fleet QA instance to predict which Playwright tests the upgrade will break. Diffs the Fleet release the instance runs today against the one you're upgrading to, and reports the selectors, copy and API routes the suite depends on that disappear — with the PR that removed each and its replacement. Triggers on "what will break when I upgrade", "compare 4.90.1 to 4.91", "preflight the upgrade", "we're moving the instance to <version>", "diff the releases before I upgrade", "upgrade impact on the suite". Pair with playwright-run-reviewer, which triages the run AFTER the upgrade.
---

Predicts which specs a Fleet upgrade breaks, before the upgrade happens. Run
every command below from the **repo root**; paths are relative to it.

The driver is [.claude/skills/fleet-upgrade-preflight/preflight.mjs](.claude/skills/fleet-upgrade-preflight/preflight.mjs)
— zero deps, ~5s. It locates the suite by walking up to the repo root, so it
works from any cwd. It reads the running instance's exact revision, then asks one
question of every selector the suite names: *does this exist in Fleet's source
today, and does it still exist in the target?*

    present → absent   BREAKING. The suite names something Fleet deleted.
    present → present  safe.
    absent  → absent   proves nothing. Dropped, not reported.

That third bucket is why the output is trustworthy: a token that was never
literal in Fleet's source can't be evidence, so it never reaches the report.

## Prerequisites

A `fleetdm/fleet` checkout next to this repo (`../fleet`, or `$FLEET_REPO`), and
`playwright/.env.premium` / `.env.free` with `FLEET_URL` + `FLEET_API_TOKEN`.
Node 20+.

```bash
git -C ../fleet fetch origin
```

## Run

Confirm what the instance is actually on — never assume from the ticket:

```bash
node .claude/skills/fleet-upgrade-preflight/preflight.mjs detect
```

```
premium  4.90.1-rc.2608131849  branch=rc-patch-fleet-v4.90.1  revision=e2eb7578a1…
free     4.90.1-rc.2608131849  branch=rc-patch-fleet-v4.90.1  revision=e2eb7578a1…
```

Then scan. `--from` defaults to that live revision, which is what you want —
it pins the diff to the exact build deployed, not to a tag that may not exist:

```bash
node .claude/skills/fleet-upgrade-preflight/preflight.mjs scan \
  --to origin/rc-minor-fleet-v4.91.0
```

Writes `playwright/docs/upgrade-preflight/<from>-to-<to>.md` (gitignored —
regenerate it, don't commit it) and prints the path. Add `--from <ref>` to compare two refs
without an instance, `--out <file>` to redirect.

## Reading the report

1. **Breaking selectors** — act on these. Each carries the QA `file:line`, the
   Fleet PR that removed it, and a replacement **checked against the target
   tree**. A `⚠︎` means the obvious rename is wrong and the component was
   reshaped; the line then lists what the successor actually emits, so you pick.
2. **UI churn by spec area** — surviving selectors don't mean surviving flows.
   Read the top rows as "expect surprises here."
3. **Fixes on the running build with no equivalent on the target** — the
   upgrade may roll a fix back. Match by title, not SHA (see Gotchas).
4. **Changelog fragments** — the release's own notes, for behaviour changes no
   static check can see.
5. **Unverifiable tokens** — deliberately inert. Don't mine it for findings.

Then fix the POMs against the predictions, upgrade, run the suite, and hand the
result to **playwright-run-reviewer** — every failure this report predicted is
already explained, so triage only has to account for the rest.

## Gotchas

- **Selectors surviving ≠ flows surviving.** The 4.89 upgrade made "save an
  edited report" `router.push` to a different page. No markup changed and the
  test still broke. Sections 2 and 4 exist because section 1 cannot catch that.
- **Fleet builds BEM classes as template literals** — `` `${baseClass}__button` ``
  in TSX, `&__button` in nested SCSS. So `fleet-dropdown__button` is in the DOM
  and *nowhere* in the source as a literal string. The successor lookup resolves
  through the component that declares the base; a flat text search finds nothing.
- **The obvious base swap is often wrong.** `.team-dropdown__control` →
  `.fleet-dropdown__control` reads as certain and does not exist: 4.91 replaced
  react-select's control with a plain `<button>`. Every hint is verified against
  the target tree before it is printed — trust the `⚠︎` when you see it.
- **A BEM modifier counts as its base.** 4.90's only mention of
  `.team-dropdown__control` is `&.team-dropdown__control--is-focused`. Demanding
  a hard word boundary silently loses real breakages; a bare `-` still doesn't
  match, because `.fleet-dropdown-wrapper` is a different class.
- **`git cherry` equivalence misses re-cherry-picks.** #51065 on the patch
  branch and #51107 on the minor branch are the same fix with different SHAs, so
  section 3 lists it as "missing". Read the titles before believing it.
- **The diff is three-dot** (`from...to`), so it shows what's *coming*. The
  price is that fixes living only on the patch branch look invisible — which is
  exactly what section 3 is for.
- **`ee/maintained-apps` is 1,594 of the 3,688 changed files** and is pure noise
  (FMA manifests). The corpus scans `frontend/`, `server/service`,
  `ee/server/service` only.
- **Fleet's `frontend/pages/queries` is the Reports UI.** Renamed in the
  product, never on disk. The area map handles it; remember it when reading raw
  paths.
- **Corpora are cached in `$TMPDIR/fleet-upgrade-preflight/<sha>.txt`.** Keyed
  by commit, so they can't go stale — but a moving branch ref resolves to a new
  SHA and re-extracts (~2s).

## Troubleshooting

**`Cannot resolve "<ref>"`** — the RC branch isn't fetched. The driver tries
`git fetch origin <ref>` itself; if that fails the branch doesn't exist yet
upstream. Check the name: `git -C ../fleet branch -r | grep rc-`.

**`detect` prints `HTTP 401`** — `FLEET_API_TOKEN` expired. The version
endpoint needs a valid token; it's the same one the suite uses.

**A live spot-check lands on `/login`** — the stored session in `.auth/`
expired. Refresh it, don't hand-roll a login (this one runs from `playwright/`):

```bash
cd playwright && SUITE=premium npx playwright test --project=premium-setup
```

**`ERR_MODULE_NOT_FOUND: Cannot find package '@playwright/test'`** — you put a
scratch script outside `playwright/`. Node resolves ESM deps from the file's
own location, not the cwd, so ad-hoc verification scripts must live inside the
suite directory.
