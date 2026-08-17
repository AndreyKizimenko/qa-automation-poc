# `fleetctl` CLI — E2E test plan

Covers the `fleetctl` command surface as a first-class section of the suite, with explicit
free/premium tier separation.

Research basis: `cmd/fleetctl/fleetctl/` on the Fleet checkout, plus live probing of both QA
instances (`4.91.0-rc.2608131639`) on 2026-08-14 with `fleetctl` 4.85.1. Every licensing claim
below was observed, not inferred from source alone.

## Scope decision

`fleetctl` already carries **~28,700 lines of Go tests** in `cmd/fleetctl/fleetctl/*_test.go`,
plus real-server integration tests in `cmd/fleetctl/integrationtest/gitops/`. Re-deriving
flag parsing, YAML marshalling, or per-key output shape in Playwright buys nothing.

What those tests *cannot* do, and what this section owns:

1. **A real license.** The unit tests drive a `MockClient` whose tier is a struct field.
   `generate_gitops_test.go` is 3,239 lines and sets `IsFree = true` in exactly **one** test
   (`TestGenerateGitopsFree`) against a golden directory. Every other premium/free branch in
   `generate_gitops.go` — and there are ~18 `License.IsPremium()` checks — is exercised on the
   premium path only. The free path is effectively one snapshot.
2. **A real, richly-configured server.** The Go integration test that does exercise
   `generate-gitops` against a live server (`gitops_enterprise_integration_test.go:6040`) runs
   it for a **single team** with `--fleet <name> --insecure`. Nothing covers a whole-instance
   generate (global + every fleet + unassigned), and nothing covers the free tier live at all.
3. **Generated output vs. the config that produced the state.** No test compares
   `generate-gitops` output against a known applied config on a live server. Doing it right
   after the min GitOps apply turns the whole command into a checkable contract — see
   [the nightly step](#folding-into-the-nightly-gitops-chain).
4. **The `fleetctl new` scaffold against a real server.** `new_test.go` (241 lines) checks
   local file emission only. Nobody checks that the repo Fleet ships to new customers actually
   applies.
5. **Client/server version skew.** Only an E2E harness runs a real binary against a real server.

Non-goals: flag-parse errors, help text, `fleetctl preview` (spins up Docker), `fleetctl
package` (builds installers, slow and platform-bound), `debug profile/heap/trace` (produces
artifacts, no assertable contract), `updates` (TUF repo management), `goquery` (interactive).

## Licensing matrix

Observed on both QA instances. This is the contract the premium/free split must encode.

### Commands and subcommands

| Command | Free | Premium | Free-tier failure |
|---|---|---|---|
| `get fleets` / `get teams` | ❌ | ✅ | `could not list teams: missing or invalid license` |
| `get mdm-apple-bm` (ABM) | ❌ | ✅ | `could not get Apple BM information: missing or invalid license` |
| `hosts transfer` | ❌ | ✅ | teams don't exist; client resolves the host first, so the error depends on args |
| `mdm lock` / `mdm unlock` | ❌ | ✅ | `ErrMissingLicense` — unconditional in `server/service/scripts.go:1266,1295` |
| `mdm wipe` | ⚠️ Android only | ✅ | non-Android → `ErrMissingLicense` (`scripts.go:1333`) |
| `get labels`, `get user_roles`, `get enroll_secret`, `get carves`, `get software`, `get packs`, `get reports`, `get hosts` | ✅ | ✅ | — |
| `get mdm-apple` (APNs), `get mdm-commands`, `get mdm-command-results` | ✅ | ✅ | — |
| `debug migrations`, `debug connection`, `trigger` | ✅ | ✅ | — |
| `user create` / `delete` / `create-users` | ✅ | ✅ | team roles are premium-only; `--global-role` works on both |
| `run-script` | ✅ | ✅ | saved scripts with `team_id > 0` → `ErrMissingLicense` (`scripts.go:126`) |
| `new` | ✅ | ✅ | fully local, never contacts a server |
| `gitops`, `generate-gitops`, `apply`, `delete`, `convert`, `api`, `config` | ✅ | ✅ | behaviour differs — see below |

### `generate-gitops` output shape

The single most tier-sensitive command. Observed by generating both instances into a temp dir:

```
premium/                     free/
  default.yml                  default.yml
  fleets/qa.yml
  fleets/unassigned.yml
  fleets/vms.yml
  fleets/workstations.yml
```

Top-level keys:

| Key | Free `default.yml` | Premium `default.yml` | Premium `fleets/*.yml` |
|---|---|---|---|
| `agent_options` | ✅ | ✅ | ✅ (real fleets only) |
| `controls` | ✅ **(global)** | ❌ | ✅ |
| `labels` | ✅ | ✅ | ✅ |
| `org_settings` | ✅ | ✅ | ❌ (uses `settings`) |
| `policies` / `reports` | ✅ | ✅ | ✅ |
| `software` | ❌ | ❌ | ✅ |
| `name` / `settings` | ❌ | ❌ | ✅ |

`controls` moving from global (free) to per-fleet (premium) comes from `generate_gitops.go:566`.
`software` is hard-returned `nil` on free at `generate_gitops.go:2077`.

Field-level differences inside shared keys:

- `org_settings.sso_settings.enable_jit_provisioning` — premium only (`:1249`). Verified: present
  on premium, absent on free.
- `org_settings.microsoft_graph_credentials` — premium only (`:930`).
- Google Workspace IdP entry in `integrations` — premium only (`:976`).
- Policy/report label scoping (`labels_include_any`, `labels_exclude_any`, …) — premium only
  (`:1852-1861`, `:1926`).
- `--fleet` flag is documented "(Premium only)". On free it is silently ignored: the tier check
  at `:426` short-circuits to global-only, so `--fleet Workstations --key controls` returns
  `Key controls not found in fleets/workstations.yml` rather than a licensing error.

### `fleetctl gitops` tier behaviour

- Free skips team files with an exact, assertable line:
  `[!] skipping team config <path> since teams are only supported for premium Fleet users`
- Free rejects `microsoft_graph_credentials` in org settings (`gitops.go:403`).
- `--delete-other-fleets` is a no-op on free (`gitops.go:711`).
- `controls` must be set on global config; premium additionally accepts it on
  `unassigned.yml`/`no-team.yml`, and the error text differs by tier (`gitops.go:386-395`).

## Status

Delivered and green on both tiers — **34 premium / 27 free** CLI tests in the regular run, plus
the 5-assertion nightly project:

```
helpers/fleetctl.ts                        # runner: HOME isolation, banner strip, no-throw
tests/cli/shared/
  get-read-only.spec.ts                    #  8 · tier-agnostic get + debug migrations
  new.spec.ts                              #  5 · fleetctl new scaffold
tests/cli/premium/
  fleets.spec.ts                           #  2 · get fleets, hosts transfer
  generate-gitops.spec.ts                  #  5 · JIT, per-fleet controls, flag validation
  mdm-lock-wipe.spec.ts                    # 12 · lock/unlock/wipe refusals (macOS, Windows)
  mdm-lock-lifecycle.spec.ts               #  2 · real lock → unlock (Ubuntu)
tests/cli/free/
  licensing.spec.ts                        #  5 · licence denials + premium-key omissions
  mdm-licensing.spec.ts                    #  9 · lock/unlock/wipe denied (macOS, Windows, Linux)
tests/cli/nightly/                         # nightly-only project (see below)
  _generated.ts                            # runs generate once, parses output
  generate-gitops.spec.ts                  #  5 · entity sets vs. the applied min config
```

Remaining: `config.spec.ts` (context isolation), `user.spec.ts` (create/delete lifecycle),
`gitops-dry-run.spec.ts` (premium team files applied), and the free
`gitops-skips-teams.spec.ts` asserting the skip line verbatim.

`tests/cli/**` specs import `test`/`expect` from `@playwright/test`, not `@fixtures` — they
drive a subprocess, never a page, so the auto `pageHealth` fixture doesn't apply. Same exception
that `tests/api/**` already uses.

### Project wiring

`tests/cli/{shared,premium,free}/` ride the existing premium/free projects — scope falls out of
the folder names with no new project needed. `tests/cli/nightly/` is deliberately
separated the same way `gitops-verify` already is: its own project with a `testDir`, added to
`SUITE_AMBIGUOUS_PROJECTS`, and `'**/cli/nightly/**'` added to both browser projects'
`testIgnore`. It never runs in a regular suite run.

Both Playwright CI workflows gained a step installing `fleetctl` at the server's version, and
the nightly GitOps orchestrators gained a `verify-generate-gitops` job.

## Harness design

### `helpers/fleetctl.ts`

Three jobs, all of which I hit manually during research:

1. **Isolated config.** `fleetctl config set` writes `~/.fleetctl/config` by default and would
   clobber the developer's own context. Every invocation must pass
   `--config <.auth/fleetctl-<suite>.yml>`. A worker fixture writes it once from `FLEET_URL` +
   `FLEET_API_TOKEN`.
2. **Binary resolution + version guard.** Local `fleetctl` is 4.85.1 against 4.91 servers; the
   binary prints a `Warning: Version mismatch.` banner on **every** command, which will wreck
   naive stdout assertions. The runner strips it, and a dedicated spec asserts client and server
   versions match so nobody debugs a phantom failure caused by skew.
   `.github/gitops-action/action.yml` already solves the install side
   (`npm install -g fleetctl@$SERVER_VERSION`); reuse that step in the Playwright workflows and
   expose the path via `FLEETCTL_BIN`.
3. **A typed result.** `{ code, stdout, stderr }` with the mismatch banner filtered, so specs
   assert on `expect(res.stderr).toContain('missing or invalid license')` rather than regexing
   raw output.

Sketch:

```ts
export type FleetctlResult = { code: number; stdout: string; stderr: string };

export async function fleetctl(args: string[], opts?: { env?: Record<string, string> }):
  Promise<FleetctlResult>;
```

Keep it a plain helper, not a page object — there is no page and no UI state to model.

### Safety rules

These specs share the QA instances with the browser suite running `fullyParallel`. Two rules:

- **No spec applies a `fleetctl gitops` config for real.** `--dry-run` only. A real apply is
  declaratively destructive across the whole instance — the `fleetctl new` scaffold dry-run
  reported `would've deleted 19 labels` and would have created a `💻 Workstations` fleet
  distinct from our gitops-provisioned `Workstations`. Real applies belong in the nightly
  chain (below), which already serialises against the gitops concurrency group.
- **`generate-gitops --dir` targets a temp dir, never the repo.** With `--insecure` it writes
  live enroll secrets to disk, so the dir must never become a CI artifact.

- **Destructive or host-moving commands target simulated hosts only.** `hosts transfer`, and
  `mdm lock`/`wipe` if they are ever built, draw from the osquery-perf pool via
  `findSimulatedHostIds`, which excludes virtualized hardware so a real QA VM can never be
  selected. Read-only data pulls may use a real VM (`findOnlineHost({ kind: 'real' })`).
  `tests/cli/premium/fleets.spec.ts` claims offset 30 to stay clear of the slices the browser
  specs already use (host-delete takes 10 and 20, bulk-transfer takes 0).

Mutating commands that *are* safe because they're already suite conventions: `user create` /
`user delete` (cleaned up in the same test, same as the User-management specs) and
`run-script` against a resolved host.

### Two traps the harness absorbs

- **The version banner is on stderr, on every command.** With a client/server mismatch,
  `fleetctl` prefixes three lines to stderr before any real output. `helpers/fleetctl.ts` strips
  it, so `expect(res.stderr).toMatch(/missing or invalid license/)` works regardless of skew.
- **Several failure modes exit 0.** `generate-gitops` writes "Either --dir or --key must be
  specified", "Only one of --dir or --key", and "You are not authorized to run this command" to
  its error writer and then returns nil. Assert on message content for those, not exit code —
  which is what the `output(res)` helper is for.

## Folding into the nightly GitOps chain

Andrey's idea, and it's the strongest oracle available. **No re-apply — generate only, then a
handful of assertions.** That keeps the step read-only and sidesteps the secrets problem noted
at the bottom entirely.

The premium nightly already runs: apply baseline → verify baseline → **apply min** → verify min.
After the min apply, instance state is known and small (`gitops/premium-fleetqa-min/`: 152-line
default + 82-line workstations; free-min is a 137-line default). That makes `generate-gitops`
output deterministic enough to assert against, which it never is against the full mutable
instance.

### This was validated, not assumed

Generated the live premium instance (currently in min state) and diffed the resolved entity
sets against `premium-fleetqa-min`:

| Entity | Min config declares | Generated output | Result |
|---|---|---|---|
| Labels | 23 | 23 | **exact match**, name-for-name |
| Global policies | 22 | 22 | **exact match** |
| Global reports | 26 | 0 | drained — see below |

Running the delivered project confirms it: 4 of 5 assertions pass against the live premium
instance today, and the fifth fails exactly as the ordering constraint predicts. Its failure
message says so, so nobody misdiagnoses it as a `generate-gitops` regression.

So equality assertions are achievable, not just superset ones. Two traps found while proving it:

- **Count file refs ≠ count entities.** `premium-fleetqa-min/default.yml` lists 10 label
  `path:` refs, but `lib/labels/macs-with-fleet-maintained-apps-installed.yml` alone declares
  many labels — 10 files resolve to 23 labels. Resolve the lib files (as
  `helpers/gitops-yaml.ts` already does for `gitops-verify`); never count `path:` lines.
- **Byte-diffing the YAML will not work.** `generate-gitops` emits inline content where the
  source config used `path:` refs. Compare resolved entity name sets, not text.

### Ordering constraint (important)

Global `reports:` came back **empty** from the live generate. That is the Playwright suite's
`cleanup-setup` project draining every global report before its first test. So the generate
step must run **inside the nightly gitops chain, immediately after apply-min** — before the
Playwright nightly touches the instance. Anywhere later and the report assertion is
meaningless. This is also why it belongs in `nightly-qa-gitops-{premium,free}.yml` rather than
as a Playwright spec in `tests/cli/`.

### The assertions

A fifth workflow step after `verify-min`, running `fleetctl generate-gitops --dir $TMP` and then:

1. **Labels** — generated name set equals the min config's resolved set.
2. **Global policies** — same.
3. **Global reports** — same (given the ordering constraint above).
4. **Scalars gitops owns** — e.g. `org_settings.org_info.org_name` is
   `Premium QA Automation (min)` / the free equivalent. Cheap, and catches a whole class of
   silent generate failures.
5. **Tier shape** — premium emits `fleets/workstations.yml` with `controls` + `software`; free
   emits `default.yml` only, with `controls` at global scope and no `software` key.
6. **`gitops --dry-run` of the same min config proposes no deletions.**

That last one needs care, because `--dry-run` is **not a diff**: it reports everything it *would
apply* regardless of current state, so a matching instance still prints a wall of
`[+] would've applied 22 policies`. Asserting on those would pin the config's own contents, not
the instance. The `[-] would've deleted …` lines are the exception — gitops only proposes
deleting something that exists on the server and is absent from the config — so on a
freshly-applied instance there should be none. The negative control lives in
`tests/cli/shared/gitops-dry-run.spec.ts`, which asserts that a *different* config (the
`fleetctl new` scaffold) does propose deletions against this same instance.

Six assertions per tier. That's the whole step.

## Side notes (not blocking this plan)

**1. `generate-gitops` output cannot be re-applied on the premium instance.** Not something the
plan above depends on any more, but worth reporting since it surfaced during research. Both
paths fail:

```
# without --insecure (placeholder secret comment)
Error: 1 error occurred:
  * each item in 'secrets' must have a 'secret' key containing an ASCII string value

# with --insecure (real secrets emitted)
Error: "secrets" is excepted from GitOps management. Remove the "secrets:" key from your
GitOps file or disable the exception in Fleet settings.
```

`generate-gitops` doesn't know about the GitOps secrets-exception setting, so on any instance
with UI-managed enroll secrets its output is unusable as-is. The same round trip **succeeds on
free**, where secrets are GitOps-managed. Looks like a real product gap rather than a QA config
problem — worth filing on its own merits, but nothing here waits on it.

**2. Minor, lower confidence.** `fleetctl get reports` on **free** prints
`To see fleet reports, run this command with the --fleet flag.` — advertising a premium-only
flag to free users. Worth a quick confirm with the team before filing; it may be intentional
generic copy.

## `mdm lock` / `unlock` / `wipe` against simulations

Characterised live on 2026-08-14 by locking one simulation per platform and watching it through.
The behaviour is not uniform, and the differences decide what is testable.

| Platform | `lock` | `unlock` | Recovers? |
|---|---|---|---|
| **Linux** | → `locked` at once | script, succeeded first try | ✅ |
| **Windows** | → `locked` at once | script, **needed 2–3 requests** | ✅ |
| **macOS** | **502 `bad device token`** — never locks | n/a | ✅ (unlock clears it) |

Three findings shaped the specs:

1. **macOS simulations can never be locked.** osquery-perf enrols in MDM with a synthetic APNs
   device token, so Fleet's DeviceLock push fails with a 502 every time. The host still briefly
   records `pending_action: 'lock'`, then an `unlock` clears it back to `unlocked`. Asserting
   the 502 would pin our load fleet's fake credentials rather than a Fleet contract, so macOS
   has refusal coverage only.
2. **Windows and Linux lock *and* unlock are scripts, and osquery-perf answers every script with
   `exitCode := rand.Intn(2)`** — a coin flip on each step. Fleet accepts the request either way;
   the host just doesn't reach the new state, and the only recourse is to issue it again. Both
   steps therefore need retry loops — a single-shot check flakes about half the time, which is
   how the spec failed twice during development. The randomness is in our simulator, not Fleet,
   so a failure here is far likelier to be luck than a regression; the assertion messages say so.
3. **Nothing was permanently poisoned.** The earlier worry — that `UnlockHost` refuses while
   `IsPendingLock()`, stranding a host forever — did not materialise, because the simulations do
   run orbit (`orbit_version 1.22.0`, `scripts_enabled true`) and do execute scripts. Note
   `scripts_enabled` reads `null` on the **list** endpoint and `true` on the **detail** endpoint;
   the list value is what made this look unsafe at first.

Safety still holds by construction: `fleetctl` refuses a non-MDM-connected host *client-side*
(`hostMdmActionSetup`) for darwin/ios/ipados/windows/android, so the refusal specs never reach
the server. Linux is not MDM-gated and does reach it, which is why Linux appears in the free
licence specs (short-circuited before anything is queued) and in the premium lifecycle spec
(where a real lock is the point), but never in the premium refusal specs.

A fourth finding landed after the first draft: **only ~40% of simulations run orbit**
(`--orbit_prob` defaults to 0.5), and orbit is what polls for the lock script. Locking a host
without it strands it permanently — one Ubuntu host was lost that way and had to be deleted. The
picker now requires `orbit_version`, which cuts the usable Ubuntu pool from ~97 to ~39.

The lifecycle spec is **Ubuntu-only**. Windows reaches the same script path, so its increment was
thin — fleetctl's client-side MDM guard in its passing direction, plus
`VerifyMDMWindowsConfigured` — while its precondition was the fragile one (an MDM-connected
simulation, ~29 of them, enrolment set probabilistically). The gap that leaves: nothing exercises
the client-side guard in the *passing* direction, so a guard that broke toward "always refuse"
would leave the refusal specs green.

Cleanup lives in the describe's `afterAll`, not in the unlock test: the describe is serial, so a
failed lock skips the unlock test and cleanup attached to it would never run. Deletion is
last-resort only, consistent with `host-delete.spec.ts`, which already budgets four deletions per
run against the daily `tools/perf-hosts/` refresh.

To audit the pool for strays: `GET /hosts?include_device_status=true` returns `device_status`
for every host in one call, which the per-host detail endpoint otherwise requires 300 calls for.

## Open decisions

1. **Should the Windows lifecycle come back?** It was dropped for pool fragility, at the cost of
   losing the only coverage of fleetctl's client-side MDM guard in its passing direction. If that
   guard matters to us, the cheapest way back is a Windows lock/unlock pair at a low offset,
   accepting that it fails on a data precondition whenever `--mdm_prob` drift shrinks the
   MDM-connected pool below it.
2. **The fleetctl install step is now duplicated in three places** —
   `.github/gitops-action/action.yml`, `playwright-{premium,free}.yml`, and
   `gitops-nightly-cli.yml` all resolve the server version and `npm install -g` the match.
   Worth extracting to a `.github/fleetctl-install/` composite action, but that touches the four
   existing gitops workflows, so it was left alone for now.
3. **`fleetctl run-script` — build it.** An earlier draft of this plan said a simulation accepts
   the request without meaningfully running it. That was wrong: osquery-perf really does execute
   scripts (`execScripts`), which is the same machinery the lock lifecycle depends on. It returns
   real output and a real exit code, so a script genuinely round-trips. The one caveat is that
   the exit code is `rand.Intn(2)`, so assert that **a result came back** — output present,
   execution ID resolvable, status no longer pending — never that it exited 0.

4. **`fleetctl user` — build it.** Cheap, deterministic, self-cleaning, and it closes a loop
   nothing else does: FCTL-11 pins the `--global-role gitops --api-only` invocation that
   `fleetctl new` tells every new customer to run, but never runs it. There is also a real tier
   boundary — `--global-role` works on both tiers, team roles are premium-only. `create-users`
   (bulk CSV) is the same shape.

5. **`fleetctl package` — worth it, but not here.** The rarely-built types are exactly the ones
   that rot: `pkg.tar.zst` (Arch), `rpm`, and `--arch arm64`, against the well-trodden
   deb/msi/pkg. A build-only assertion (exit 0, artifact exists, plausible size) is easy to
   write, but each build pulls orbit/osqueryd/desktop from TUF and takes minutes, and MSI builds
   off Windows need extra tooling. That belongs in its own scheduled workflow — a weekly matrix
   over type × arch — not in the nightly CLI suite, which should stay fast.

6. **`fleetctl preview` — don't automate it here, and fix the existing smoke test.** See below.

## `fleetctl preview` and the upgrade smoke test

The existing smoke test starts `preview` at the released version, then again with `--tag` at the
RC, and checks that artifacts (policies, scripts) survive. **That test cannot pass, and a pass
would not mean anything** — but not for the reason it looks like.

`preview` calls `service.ApplyStarterLibrary` on **every** start
(`cmd/fleetctl/fleetctl/preview.go:396`). That renders `fleetctl new` into a temp dir and then
runs **`fleetctl gitops -f default.yml`** against the instance
(`server/service/endpoint_setup.go:144-183`). GitOps is declaratively destructive: anything not
in the starter library — every custom policy, query and label — is deleted. So the second
`preview --tag <RC>` wipes the artifacts itself, before any upgrade behaviour is exercised.

The data underneath does survive: `preview stop` is `docker-compose stop` and even `preview
reset` is `docker-compose rm -sf` **without `-v`**, so the MySQL volume persists and the new tag
boots against the existing schema and migrates it.

So the salvageable test is the one that was suggested: **can a preview instance be upgraded to a
newer tag at all** — second `preview --tag` exits 0, the server comes up, and
`fleetctl debug migrations` reports up to date. Drop the artifact-survival assertion; it is
measuring the starter library, not the upgrade.

Even then, it does not belong in this suite: every project here targets a deployed Fleet, while
`preview` boots MySQL, Redis, two Fleet servers and orbit on the local machine. And the coverage
mostly duplicates the `release-migration-test` skill, which dispatches Fleet's DB-upgrade
workflow across ~10 released versions into the RC — strictly more thorough than a two-point hop.
The one thing `preview` uniquely proves is that the **published image for that tag boots and
self-migrates**, which is worth keeping as a smoke test, just a corrected one.
