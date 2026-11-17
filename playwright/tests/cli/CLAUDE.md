# tests/cli/ — `fleetctl` specs

This file loads when work happens under `tests/cli/`; everything in `playwright/CLAUDE.md` still applies.

- The specs sit in the same `shared/` / `premium/` / `free/` split as `tests/e2e/`, plus `nightly/`, which only
  the `gitops-nightly` project picks up (CLI checks that make sense only right after the nightly's min apply).
- They run the `fleetctl` on `PATH` (or `FLEETCTL_BIN`) against the suite's instance, with a throwaway `HOME`
  holding the suite's context (`helpers/fleetctl.ts`).
- **Before a local run of a CLI spec, check the client a test will run, and update it yourself when it is
  behind.** Don't ask first and don't leave the CLI specs out: Andrey's standing word (2026-11-13, again
  2026-11-15) is that updating `fleetctl` is fine and that he forgets to.
  - **Which client:** from `playwright/`, `npm exec -c 'which fleetctl; fleetctl --version'`. That is the
    `PATH` a test's child process gets: npm puts the `node_modules/.bin` of every directory above the suite
    ahead of the rest, so it can be another copy than the one a shell finds. A `fleetctl` in the home
    directory's `node_modules` ran in place of the global one, two minors behind, while `fleetctl --version`
    in a shell looked current.
  - **Which version:** what CI installs (`.github/install-fleetctl`). The server's own release when it is
    published (`GET /api/latest/fleet/version`, without its `-rc…` suffix); otherwise, for a server on Fleet's
    `main` (`0.0.0-SNAPSHOT-<sha>`) or an RC whose release isn't out, a fleetctl built from the `revision` the
    server reports. The latest release is no stand-in across a major version: fleetctl 4 against Fleet 5 fails
    on the routes and names Fleet 5 removed.
  - **How:** `npm i -g fleetctl@<version>` for the global copy, `npm i fleetctl@<version> --prefix <dir>` for
    one in a `node_modules` above the suite. Update every copy the check can resolve, not only the first. For a
    build, from a checkout of `fleetdm/fleet` at the server's revision: `CGO_ENABLED=0 go build -trimpath
    -ldflags "-X github.com/fleetdm/fleet/v4/server/version.version=<server version>" -o <dir>/fleetctl
    ./cmd/fleetctl`, then run the specs with `FLEETCTL_BIN=<dir>/fleetctl`, which wins over every copy on
    `PATH`.
  - **What a stale one looks like:** a client more than a minor behind fails. 4.92.1's `generate-gitops`
    exits 1 on free, and its dry-run of the premium config stops on `unknown key …
    notify_before_patching`, a key the config has long carried.
- `fleetctl([...])` never throws on a non-zero exit: assert the exit code and the output.
- A global gitops file a spec dry-runs or applies on premium must declare the IdP: `carryLiveEndUserAuth`
  writes the instance's into a `fleetctl new` scaffold (Compliance has end-user authentication on, and
  fleetctl refuses a global file that would clear it).
- A spec that needs a CLI-side MDM target takes it from `findSimulatedHostForMdm` with a claim of its own in
  `helpers/claims.ts` (pool `fleetctl-mdm`), which says whether MDM is on: never leave that to chance, or a
  connected simulation receives a real lock or wipe.
