# tests/cli/ — `fleetctl` specs

This file loads when work happens under `tests/cli/`; everything in `playwright/CLAUDE.md` still applies.

- The specs sit in the same `shared/` / `premium/` / `free/` split as `tests/e2e/`, plus `nightly/`, which only
  the `gitops-nightly` project picks up (CLI checks that make sense only right after the nightly's min apply).
- They run the `fleetctl` on `PATH` (or `FLEETCTL_BIN`) against the suite's instance, with a throwaway `HOME`
  holding the suite's context (`helpers/fleetctl.ts`). Locally, install the one matching the server
  (`npm i -g fleetctl@<server version>`), as CI does: a client more than a minor behind fails (4.92.1's
  `generate-gitops` exits 1 on free), so with an older one the CLI specs can't be run locally at all.
- `fleetctl([...])` never throws on a non-zero exit: assert the exit code and the output.
- A global gitops file a spec dry-runs or applies on premium must declare the IdP: `carryLiveEndUserAuth`
  writes the instance's into a `fleetctl new` scaffold (Compliance has end-user authentication on, and
  fleetctl refuses a global file that would clear it).
- A spec that needs a CLI-side MDM target takes it from `findSimulatedHostForMdm` with a claim of its own in
  `helpers/claims.ts` (pool `fleetctl-mdm`), which says whether MDM is on: never leave that to chance, or a
  connected simulation receives a real lock or wipe.
