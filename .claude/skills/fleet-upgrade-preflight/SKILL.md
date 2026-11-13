---
name: fleet-upgrade-preflight
description: Run BEFORE upgrading a Fleet QA instance to predict which Playwright tests the upgrade will break. Diffs the Fleet release the instance runs today against the one you're upgrading to, and reports the selectors, copy and API routes the suite depends on that disappear — with the PR that removed each and its replacement. Triggers on "what will break when I upgrade", "compare 4.90.1 to 4.91", "preflight the upgrade", "we're moving the instance to 4.96", "diff the releases before I upgrade", "upgrade impact on the suite". Pair with playwright-run-reviewer, which triages the run AFTER the upgrade.
---

Predicts which specs a Fleet upgrade breaks, before the upgrade happens. Run
every command below from the **repo root**; paths are relative to it.

The driver is [.claude/skills/fleet-upgrade-preflight/preflight.mjs](preflight.mjs)
— zero deps, 3–8s. It locates the suite by walking up to the repo root, so it
works from any cwd. It reads the running instance's exact revision, then asks one
question of every selector the suite names and every phrase it expects or keeps
in a constant: *does this exist in the source Fleet ships today, and does it
still exist in the target?*

    present → absent   BREAKING. The suite names something Fleet deleted.
    present → present  safe.
    absent  → absent   proves nothing. Dropped, not reported.

That third bucket keeps the report free of noise: a token that was never literal
in Fleet's source can't be evidence, so it never reaches the report. What does
reach it is a floor, not the full list. Backtested on the last three upgrades
(4.93, 4.94, 4.95), section 1 named 0, 12 and 3 tokens, every one a real
breakage, and they pointed at 0, 7 and 2 of the 4, 12 and 10 clusters that
broke. The rest were flows, controls and messages that changed while their
selectors and copy stayed in the source. The scan is the first ten minutes; the
hand-check after it (*Then hand-check*, below) is the job.

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
without an instance, `--out <file>` to redirect, `--suite <path>` to read another checkout's
`playwright/` directory (the suite at an older commit, to backtest a release).

## Reading the report

1. **Breaking selectors and copy** — act on these. Each carries the QA
   `file:line`, the Fleet PR that removed it, and a replacement **checked
   against the target tree**. A `⚠︎` means the obvious rename is wrong and the
   component was reshaped; the line then lists what the successor actually
   emits, so you pick. The last two groups are not locators: **Expected
   values** are arguments of a matcher or an `expect…` helper, **Constants and
   page-object arguments** are phrases held in a constant or handed to a page
   object. Each site says how it uses the token: `used at` (a locator),
   `expected at`, `named at`. No false positive showed up in the backtests, but
   one is possible: copy or a class Fleet still renders and now builds another
   way (a template, a child component), so the literal left the source. Read
   the removing PR before changing a spec.
2. **UI churn by spec area** — surviving selectors don't mean surviving flows.
   Read the top rows as "expect surprises here."
3. **Fixes on the running build with no equivalent on the target** — the
   upgrade may roll a fix back. Match by title, not SHA (see Gotchas).
4. **Changelog fragments** — the release's own notes, for behaviour changes no
   static check can see.
5. **Unverifiable tokens** — locator tokens never literal in Fleet's source at
   either revision, so mostly inert. A class built on a component's `baseClass`
   (`` `${baseClass}__list-item-button` ``) is checked through that component
   and doesn't land here. Read the `class` entries that do: they are built some
   other way (react-select's `classNamePrefix`), and one a release removes
   stays here unreported.

## Then hand-check

A text-presence check can't see most of what breaks a spec. What it missed on
recent upgrades, in the order it cost time:

- **Flows that changed shape**: a modal that became a page, a section collapsed
  under "Advanced", a dropdown replaced by a filter, a role that lost an action.
  Every selector survives and the test still fails.
- **Copy that changed in one component** while the same string survives in
  another (`Email field must be completed` changed in the user forms and stayed
  in the login forms), or inside a longer one (a subheader that gained a full
  stop still contains the old text).
- **Copy the scan doesn't read**: expected values and constants count only as
  plain strings of two or more words (three for a piece of a template). A
  single word (`cellByColumn(row, 'Role')`), a regex
  (`hasText: /Edit (package|software)/`) and a name with an apostrophe, which
  Fleet writes as `&apos;`, are never checked.
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
  and *nowhere* in the source as a literal string. The presence check and the
  successor lookup both resolve through the file that declares the base, and
  only that file: nearly every component has a `` `${baseClass}__title` ``.
- **The obvious base swap is often wrong.** `.team-dropdown__control` →
  `.fleet-dropdown__control` reads as certain and is the wrong target: 4.91 made
  the visible trigger a plain `<button>` (`.fleet-dropdown__button`) and kept
  react-select only as a hidden control for keyboard navigation. Every hint is
  verified against the target tree before it is printed — trust the `⚠︎` when you
  see it.
- **It under-reports.** A token counts as present if it appears anywhere in the
  source Fleet ships: in any component, not just the one a page object drives,
  and in a code comment as readily as in markup. (Fleet's tests, mocks and
  Storybook stories are not in the corpus.) So a class or copy a component
  dropped, but that another component or a comment still names, reads as
  present → present: 4.95's `macOS app` type label lives on in two Go comments.
  Treat section 1 as a floor, not the full list.
- **A class counts by its dotted or its bare name.** SCSS writes
  `.activity-feed-card`, TSX `className: "activity-feed-card"`, and a release
  can delete the rule and keep the class. The bare name counts only between
  quotes or spaces. A one-word class (`.tag`) meets its bare name in any
  string, so it always reads as present.
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
  `ee/server/service` only, so a message built in `server/fleet` is never seen.
- **Fleet's `frontend/pages/queries` is the Reports UI.** Renamed in the
  product, never on disk. The area map handles it; remember it when reading raw
  paths.
- **Corpora are cached in `$TMPDIR/fleet-upgrade-preflight/<sha>-<rules>.txt`.**
  Keyed by commit, so they can't go stale — but a moving branch ref resolves to
  a new SHA and re-extracts (~2s). `<rules>` is a digest of what goes into a
  corpus (trees, file types, the test-file filter): change those in the script
  and it re-extracts instead of reusing a corpus built the old way.

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
