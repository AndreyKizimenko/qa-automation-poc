# ssolab

`ssolab` switches which identity provider each Fleet lab instance uses for **admin SSO** (`sso_settings`) and
**MDM end-user authentication** (`mdm.end_user_authentication`), then checks that the IdP really accepts Fleet's
login request. Running it with no arguments opens an arrow-key view.

Providers: Okta, Microsoft Entra ID, Google Workspace, Auth0 (cloud tenants you own), plus two local ones it runs in
Docker: SimpleSAMLphp (Fleet's test IdP with its fixture users) and authentik.

## Prerequisites
- macOS with the stock `python3` (3.9+; no packages needed).
- One or more Fleet servers you can reach, each with a `fleetctl` context in `~/.fleet/config` that holds an admin
  API token (`fleetctl login --context <name>`). End-user authentication needs Premium.
- Docker Desktop, only for the local IdPs (`saml`, `authentik`).
- Optional: `fleetctl` (for `ssolab gitops write`), the 1Password CLI `op` (to mirror logins into a vault).

## Setup
1. Clone this repo and put `tools/ssolab/bin` on your PATH (or symlink `bin/ssolab` into a PATH dir).
2. Lab config: `cp tools/qalab/lab.env.example tools/qalab/lab.env` (gitignored; `QALAB_ENV=<file>` or
   `~/.config/qalab/lab.env` work too). ssolab reads:
   - `INSTANCES`, and per instance `INSTANCE_<i>_CONTEXT` (fleetctl context), `_URL` (fallback public URL; the live
     `server_url` wins), optional `_FLEETCTL` (default: `fleetctl` on PATH) and `_SERVER_LOG` (for `ssolab why`).
   - `SSOLAB_DATA`: your data dir. Everything per-user lives there: `LOGINS.md`, `profiles/*.conf`, `metadata/`,
     `state/`, `created.txt`, `saml/authsources.php` + `sp-remote.php`, `authentik/.env`.
   - `SSOLAB_GITOPS_DEFAULT` (optional): a GitOps `default.yml` that `ssolab gitops` may edit. Empty = off.
   - `SSOLAB_OP_VAULT` (optional): 1Password vault that logins are mirrored into. Empty = off.
3. `mkdir -p <your SSOLAB_DATA>`, then `ssolab doctor`: checks lab.env, python, docker, each fleetctl context (one
   read-only API call), the data dir and LOGINS.md.
4. Logins: `LOGINS.example.md` shows the table ssolab keeps in `$SSOLAB_DATA/LOGINS.md` (chmod 600). You can start
   from it, but the `connect` / `creds add` commands below fill it in for you.
5. Set up the IdPs you need (next section), then `ssolab status` and `ssolab switch <inst> <provider>`.

## Per-IdP setup
Each provider gets one SAML app per **instance × feature** (admin SSO, end-user auth) with entity IDs
`urn:fleetqa:<inst>:<admin|mdm>` and ACS URLs built from each instance's `server_url`; `ssolab sp` prints them.
`profiles/*.conf.example` show what each profile ends up holding.

| key | you need | then |
|---|---|---|
| `okta` | An Okta org (Integrator Free works) and an API token: Admin Console → Security → API → Tokens | `ssolab okta connect` creates the apps (assigned to Everyone); `ssolab okta user <email>`. By hand: `ssolab setup okta --manual` |
| `entra` | An Entra tenant and an app registration with a client secret and Graph application permissions `Application.ReadWrite.All`, `User.ReadWrite.All` (+ `Policy.Read.All`, `Policy.ReadWrite.ConditionalAccess` for `entra mfa`), admin consent granted | `ssolab entra connect` creates the apps, open to every tenant user; users sign in with their UPN. By hand: `ssolab setup entra --manual` |
| `auth0` | An Auth0 tenant and a Machine-to-Machine app authorized for the Management API (clients, connections, users) | `ssolab auth0 connect` creates the apps and enables them on `Username-Password-Authentication` |
| `google` | A Google Workspace with admin access (no API path) | `ssolab setup google`: console walkthrough, then point it at each downloaded metadata XML |
| `saml` | Docker | `ssolab saml up` (:18180). Users: Fleet's fixtures (`sso_user` / `user123#`, …) from `saml/authsources.dist.php`, plus any `saml` logins you add |
| `authentik` | Docker with ~2.1 GB free | `ssolab authentik up` (:18100) generates `authentik/.env`, starts it and provisions the apps |

Local IdPs listen on localhost only: fine for your browser and Fleet's metadata fetch, not reachable from VMs
(end-user auth on a VM needs a cloud IdP).

## Commands
```
ssolab                                   interactive view: instances + active IdP; Enter on an instance → switch
ssolab status [--json]                   same, as text
ssolab doctor                            check the setup (read-only)
ssolab switch <inst> <provider|off> [--only sso|eua] [--jit|--no-jit] [--gitops|--no-gitops] [--yes]
ssolab test <inst>                       re-run the checks
ssolab why [inst] [N]                    last N SSO sign-ins from INSTANCE_<i>_SERVER_LOG: who got in, why others failed
ssolab setup <provider>                  connect / console walkthrough, collect metadata → profiles/<p>.conf
ssolab sp [inst]                         ACS URLs / entity IDs to paste into an IdP
ssolab creds | creds add <p> [label] | creds show <p> <label> | creds sync
ssolab user create --provider P --username U [...]   one test user: IdP + LOGINS.md + Fleet
ssolab users [p] | users sync <p> [inst|both]        IdP test users ↔ Fleet users (SSO-only, created on demand)
ssolab saml up|down|status|sync          local SimpleSAMLphp
ssolab authentik up|provision|user <e>|down|status
ssolab okta|auth0|entra connect|provision|user|status   (okta, entra: also mfa)
ssolab gitops show|write <inst>|clear    optional YAML mirror into SSOLAB_GITOPS_DEFAULT
```

## Interactive view keys
Main: `↑↓` move · `⏎` instance → switch IdP, provider → its menu · `n` new user · `t` test instance · `w` why ·
`l` logins · `s` 1Password sync · `g` GitOps block · `r` refresh · `q` quit.
Logins: `⏎`/space reveal or hide a password (hides itself after 30 s) · `c` copy password · `u` copy username
(clipboard clears after 45 s if unchanged) · `f` create the selected user in Fleet · `F` all missing for that
provider · `a` new user · `s` 1Password sync.
**New user form** (`n`, or `a` in Logins): provider, username, label, Fleet sign-in email, password (`g` generates,
`v` reveals), role, fleet, which instances get a Fleet account, Okta Verify on/off → Create. The IdP user is made
first, so a rejected password leaves nothing behind.

## How a switch works
1. Pre-flight: the provider's profile must have an app for that instance + feature; its metadata is fetched and
   parsed. Local providers must be running.
2. Shows *was → new* and asks, then `PATCH /api/v1/fleet/config` (`sso_server_url` is kept).
3. Verify: `POST /api/v1/fleet/sso` → follow the redirect → login page = ✓, IdP error page = ✗. End-user auth:
   metadata check; redirect check only when Apple MDM is on. (SimpleSAMLphp checks the ACS URL only after login.)
4. If `SSOLAB_GITOPS_DEFAULT` is set, asks whether to write the settings there too (default No).

## Fleet users
Fleet only lets an SSO login in if a Fleet user with that email exists (or JIT is on). Every LOGINS.md row with an
`email` is an IdP test user; ssolab offers to create it in Fleet (`sso_enabled`, no password; role from the name,
`…_global_admin` → admin, else observer; `--role`, `--team` override). It only creates users, never edits or
deletes them, and logs each one in `$SSOLAB_DATA/created.txt` for cleanup. Adding a login with an email also creates
the user in the IdP where ssolab can (SimpleSAMLphp, authentik, Okta, Auth0, Entra).

**Okta Verify:** the Fleet apps get their own sign-in policy `ssolab - Fleet apps`: members of `ssolab-password-only`
use a password only, everyone else two factors. `ssolab okta mfa <email> on|off` toggles it per user.

## Caveats
- **GitOps resets omitted settings.** If your `default.yml` has no `sso_settings`, a gitops run clears admin SSO
  and end-user auth. `ssolab gitops write <inst>` adds a marked block (validated with that instance's
  `fleetctl gitops --dry-run`, put back if it fails); one default.yml usually serves every server, so it pushes that
  instance's entity IDs to the others too. `ssolab gitops clear` removes it.
- Fleet won't clear the end-user IdP while Controls → Setup experience → end-user authentication is on.
- A DB restore brings back whatever SSO settings were in the dump; `ssolab status` shows it.

## If you use Fleet Hangar
ssolab only talks to Fleet through its API and only runs its own compose projects (`ssolab-saml`,
`ssolab-authentik`; it refuses any other name), memory-capped and on ports 18180 / 18100, clear of Hangar's. Point
`INSTANCE_<i>_SERVER_LOG` at Hangar's server logs (`~/Library/Logs/com.fleetdm.fleet-hangar/fleet-serve-s<N>.log`)
for `ssolab why`, and `_FLEETCTL` at the worktree's `build/fleetctl` so gitops dry-runs use the matching version.
Hangar's own SAML IdP (:9080) only knows `https://localhost:8080`; use `ssolab saml` when `server_url` is public.
