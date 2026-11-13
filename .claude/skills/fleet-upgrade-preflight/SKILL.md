---
name: fleet-upgrade-preflight
description: Run BEFORE upgrading a Fleet QA instance to predict which Playwright tests the upgrade will break. Diffs the Fleet release the instance runs today against the one you're upgrading to, and reports the selectors, copy and API routes the suite depends on that disappear — with the PR that removed each and its replacement. Triggers on "what will break when I upgrade", "compare 4.90.1 to 4.91", "preflight the upgrade", "we're moving the instance to 4.96", "diff the releases before I upgrade", "upgrade impact on the suite". Pair with playwright-run-reviewer, which triages the run AFTER the upgrade.
---

Predicts which specs a Fleet upgrade breaks, before the upgrade happens. Run
every command below from the **repo root**; paths are relative to it.

The driver is [.claude/skills/fleet-upgrade-preflight/preflight.mjs](preflight.mjs)
— zero deps, ~5s. It locates the suite by walking up to the repo root, so it
works from any cwd. It reads the running instance's exact revision, then asks one
question of every selector the suite names: *does this exist in Fleet's source
today, and does it still exist in the target?*

    present → absent   BREAKING. The suite names something Fleet deleted.
    present → present  safe.
    absent  → absent   proves nothing. Dropped, not reported.

That third bucket keeps the report free of noise: a token that was never literal
in Fleet's source can't be evidence, so it never reaches the report. What does
reach it is a floor, not the full list. On the last three upgrades the scan
reported 0, 5 and 1 real breakages where the suite turned out to have 2, 12 and
10 broken clusters. The scan is the first ten minutes; the hand-check after it
(*Then hand-check*, below) is the job.

## Prerequisites

A `fleetdm/fleet` checkout (`--fleet-repo <path>`, else `$FLEET_REPO`, else
`../fleet` next to this repo), and `playwright/.env.premium` / `.env.free` with
`FLEET_URL` + `FLEET_API_TOKEN`. Node 20+.

```bash
git -C ../fleet fetch origin
```

## Run

Confirm what the instance is actually on — never assume from the ticket:

```bash
node .claude/skills/fleet-upgrade-preflight/preflight.mjs detect
```

```
premium  4.90.1-rc.2608131849  branch=rc-patch-fleet-v4.90.1  revision=e2eb7578a1…  (<instance host>)
free     4.90.1-rc.2608131849  branch=rc-patch-fleet-v4.90.1  revision=e2eb7578a1…  (<instance host>)

Use as --from: e2eb7578a1…
```

Each line ends with the instance's real hostname. This repo is public, so trim it
before you paste the output anywhere that gets committed.

Then scan. `--from` defaults to that live revision, which is what you want —
it pins the diff to the exact build deployed, not to a tag that may not exist:

```bash
node .claude/skills/fleet-upgrade-preflight/preflight.mjs scan \
  --to origin/rc-minor-fleet-v4.91.0
```

Writes `playwright/docs/upgrade-preflight/<from-sha10>-to-<to-sha10>.md` (gitignored —
regenerate it, don't commit it) and prints the path. Add `--from <ref>` to compare two refs
without an instance, `--out <file>` to redirect.

## Reading the report

1. **Breaking selectors** — act on these. Each carries the QA `file:line`, the
   Fleet PR that removed it, and a replacement **checked against the target
   tree**. A `⚠︎` means the obvious rename is wrong and the component was
   reshaped; the line then lists what the successor actually emits, so you pick.
   One false positive to rule out first: the scan looks for a class with its
   dot (`.activity-feed-card`), which only the SCSS rule has. When a release
   deletes the stylesheet rule and keeps `className: "activity-feed-card"`, the
   class reads as removed while Fleet still renders it. Grep the target TSX for
   the bare name before changing a locator.
2. **UI churn by spec area** — surviving selectors don't mean surviving flows.
   Read the top rows as "expect surprises here."
3. **Fixes on the running build with no equivalent on the target** — the
   upgrade may roll a fix back. Match by title, not SHA (see Gotchas).
4. **Changelog fragments** — the release's own notes, for behaviour changes no
   static check can see.
5. **Unverifiable tokens** — never literal in Fleet's source at either revision,
   so mostly inert. Read its `class` entries, though: a class Fleet builds from
   a template (`` `${baseClass}__list-item-button` ``) lands here whether or not
   the release removed it, and one that was removed has sat here unreported.

## Then hand-check

A text-presence check can't see most of what breaks a spec. What it missed on
recent upgrades, in the order it cost time:

- **Flows that changed shape**: a modal that became a page, a section collapsed
  under "Advanced", a dropdown replaced by a filter, a role that lost an action.
  Every selector survives and the test still fails.
- **Copy that changed in one component** while the same string survives in
  another (`Email field must be completed` changed in the user forms and stayed
  in the login forms), and copy a spec *expects* rather than locates:
  `toHaveText` and `toContainText` values and lookup constants aren't in the
  scan's vocabulary.
- **A constant demoted to a fallback**: the literal is still in the source, but
  the message users see is now built by a template next to it.
- **A control that gained an explicit accessible name**: once a dropdown has an
  `ariaLabel`, its `name` prop no longer names it, so
  `getByRole('combobox', { name: 'date-filter' })` matches nothing, and an
  absence check written that way passes without checking anything.

Three diffs find most of these. `<from>` and `<to>` are the revisions the scan
printed; the second writes its list to the scratchpad:

```bash
# column headers that changed
git -C ../fleet diff <from>...<to> -- frontend | grep -E '^[-+][[:space:]]*(title|Header): "'

# copy that left a file and that the suite still names: candidates to read, not verdicts
git -C ../fleet diff <from>...<to> -- frontend | grep '^-' | grep -oE '"[A-Za-z][^"]{12,90}"' \
  | tr -d '"' | grep ' ' | sort -u > <scratchpad>/removed-copy.txt
grep -rhoFf <scratchpad>/removed-copy.txt playwright/tests playwright/pages playwright/helpers \
  | sort | uniq -c | sort -rn

# controls that gained an accessible name
git -C ../fleet diff <from>...<to> -- frontend | grep -E '^\+.*ariaLabel='
```

For each candidate, look at the target tree before touching a spec: a string
that left one file is often still rendered from another.

Then read the change itself. Split the release's changelog fragments and UI
churn (sections 2 and 4) by area, and give each area to a read-only agent with
the specs and page objects that cover it: what does each changed component now
render, and which test steps no longer match? Three agents covered a release in
one pass, and that pass is where most of the real breakages were found.

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
  `.fleet-dropdown__control` reads as certain and is the wrong target: 4.91 made
  the visible trigger a plain `<button>` (`.fleet-dropdown__button`) and kept
  react-select only as a hidden control for keyboard navigation. Every hint is
  verified against the target tree before it is printed — trust the `⚠︎` when you
  see it.
- **It under-reports.** A token counts as present if it appears anywhere in the
  corpus, including Fleet's own tests (`*.tests.tsx`, `*_test.go`) and in any
  component, not just the one a page object drives. So a class or copy a
  component dropped, but that a test or an unrelated component still names, reads
  as present → present. Treat section 1 as a floor, not the full list.
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
