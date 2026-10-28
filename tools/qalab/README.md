# qalab

One front door for the Fleet QA lab utilities in `tools/`: `vm` (UTM test VMs), `ssolab` (identity providers for
SSO / end-user auth) and `loglab` (log destinations). Each tool runs on its own; qalab only launches them and shows a
one-line status for each. This folder also holds the lab config they all share, `lab.env`.

- `qalab` — menu with a live status line per tool (refreshed every 30 s and when you come back from a tool).
  Enter or the tool's letter (`v`, `s`, `l`) opens that tool's interactive view; quitting it returns to the menu.
- `qalab <tool> [args]` — pass-through to the tool's CLI: `qalab vm check`, `qalab sso status`, `qalab log test rc`.
  Aliases: `sso` = `ssolab`, `log`/`logs` = `loglab`.
- `qalab ls` — the tools and their status, non-interactive (also what plain `qalab` prints when not on a terminal).

Tools that aren't on PATH show as "not installed"; the rest keep working. Status lines are read-only: the VM line
asks `vm status` only while UTM is already open, so qalab never launches UTM.

## Install
Requires macOS with `/usr/bin/python3` (3.9+); no pip packages. Put the tools you use on PATH, e.g.:

```sh
cd tools
for t in qalab/bin/qalab vm/bin/vm ssolab/bin/ssolab loglab/bin/loglab; do ln -sf "$PWD/$t" /usr/local/bin/; done
cp qalab/lab.env.example qalab/lab.env      # then edit it
```

Symlinks are fine: each tool finds `lab.env` relative to its real (resolved) path. See each tool's README for its own
prerequisites (UTM, Docker, AWS CLI…).

## Lab config: `lab.env`
One file configures every tool. Lookup order (first that exists wins):

1. `$QALAB_ENV`
2. `tools/qalab/lab.env` next to the tool's real script path (gitignored)
3. `~/.config/qalab/lab.env`

A tool that needs it and finds none exits with a message saying where to put it. Format: plain `KEY=VALUE` lines,
no `export`, no command substitution; surrounding quotes are stripped and a leading `~` is expanded. **No secrets
here**: each tool keeps its own in its data dir (`vm`: `$VM_DATA/LOGINS.md`, `ssolab`: `$SSOLAB_DATA/LOGINS.md`,
`loglab`: `$LOGLAB_DATA/SECRETS.env`).

### Fleet instances (all tools)
| key | meaning |
|---|---|
| `INSTANCES` | space-separated instance names (`"rc prev"`); every tool takes these as its `<instance>` argument |
| `INSTANCE_<i>_CONTEXT` | fleetctl context in `~/.fleet/config` (with an API token) |
| `INSTANCE_<i>_URL` | public server URL (fallback; the live `server_url` wins) |
| `INSTANCE_<i>_FLEETCTL` | fleetctl binary for this instance (default: `fleetctl` on PATH) |
| `INSTANCE_<i>_SRC` | optional Fleet source checkout the server runs from (loglab: which log plugins the build has) |
| `INSTANCE_<i>_FLEET_BIN` | optional built `fleet` binary (loglab validates configs with `fleet config_dump`) |
| `INSTANCE_<i>_SERVER_LOG` | optional file fleet serve's output goes to (ssolab `why`, loglab stdout/test/view) |
| `INSTANCE_<i>_HANGAR_ID` | optional Fleet Hangar server id (`s1`, `s2`…) if that server runs in Fleet Hangar |

### vm
| key | meaning |
|---|---|
| `VM_DATA` | UTM bundles (`golden/`, `hosts/`), `inventory.tsv`, `LOGINS.md`. Other tools ask `vm config VM_DATA` |
| `INSTALLERS_DIR` | fleetd packages, one subfolder per instance: `<dir>/<instance>/*.deb|rpm|pkg|msi` |
| `SSH_KEY` | private key whose `.pub` is in the guests' `authorized_keys` |
| `GUEST_USER` | guest login user |
| `UTMCTL` | path to `utmctl` |

### ssolab
| key | meaning |
|---|---|
| `SSOLAB_DATA` | ssolab's data dir (IdP state, `LOGINS.md`) |
| `SSOLAB_GITOPS_DEFAULT` | optional GitOps `default.yml` that `ssolab gitops` edits (empty = gitops commands off) |
| `SSOLAB_OP_VAULT` | optional 1Password vault for `ssolab` logins sync (needs the `op` CLI) |

### loglab
| key | meaning |
|---|---|
| `LOGLAB_DATA` | loglab's data dir: `SECRETS.env`, `config/<instance>.yml` (the files fleet serve reads), `state/`, `sinks/`, `created.txt`. The environment variable of the same name overrides it |
| `LOGLAB_OWNER` | your name on shared AWS resources (tag `owner=`, and in default names); default `$USER` |
| `LOGLAB_ACCEPT_SPLUNK_LICENSE` | `1` = you accept Splunk's license and General Terms for the local Splunk container; anything else = `splunk-local` is off |

### Fleet Hangar (optional)
| key | meaning |
|---|---|
| `HANGAR` | `auto` (default): use Fleet Hangar's settings/logs if it's installed; `0`: ignore it; `1`: use it even if its settings file isn't found. Only instances with `INSTANCE_<i>_HANGAR_ID` are treated as Hangar servers |

Without Hangar nothing is lost except Hangar's wiring checks: point your own `fleet serve` at the files the tools
print (e.g. `loglab path <instance>`), and set `_SERVER_LOG` where a tool needs the server log.

## Adding a tool
Append a row to `TOOLS` in `bin/qalab`: name, aliases, hotkey, executable on PATH, one-line blurb, and an optional
summary function returning `(text, colour)` (0 plain, 1 green, 3 yellow). Keep summaries cheap and read-only — they
run in background threads.
