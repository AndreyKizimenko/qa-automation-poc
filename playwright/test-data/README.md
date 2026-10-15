# Test data

Static fixtures that specs upload, install, or otherwise feed into Fleet —
bootstrap packages, sample scripts, custom software packages and configuration
profiles. Declarations, and profiles a spec needs its own copy of, are generated
at run time by `helpers/profiles.ts` instead.

App-store *reference* catalogues (FMA, VPP, Android) are not in here — they're
typed TypeScript modules under
[`../helpers/catalogs/`](../helpers/catalogs/). Anything imported as code
lives there; this folder is for files we read off disk and upload.

## Layout

Platform-first, mirroring how Fleet groups MDM-managed payloads:

```
test-data/
├── apple/
│   ├── macos/
│   │   ├── bootstrap-package/   # .pkg used by Setup Experience tests
│   │   ├── profiles/            # .mobileconfig
│   │   ├── scripts/             # marker-create .sh script + fleet-test-script.sh (setup-experience run script)
│   │   ├── setup-assistant/     # automatic-enrollment .json
│   │   ├── setup-experience/    # .pkg installed during setup experience
│   │   └── software/            # .pkg custom packages
│   └── ios-ipados/              # (future) .mobileconfig, declarations
├── linux/
│   ├── scripts/                 # marker-create .sh script
│   ├── setup-experience/        # .deb installed during setup experience
│   └── software/                # .deb custom packages (README)
├── windows/
│   ├── profiles/                # .xml profiles
│   ├── scripts/                 # marker-create .ps1 script
│   ├── setup-experience/        # .msi installed during setup experience
│   └── software/                # .msi / .exe custom packages
└── shared/
    ├── images/                  # PNG icons + org logo (README)
    └── software/                # script-only package (.sh — macOS & Linux)
```

## Naming conventions

- **Software**: real upstream installers, kept verbatim by their
  upstream filename so the source is obvious. Examples:
  `gh_2.92.0_macOS_universal.pkg`, `7z2601-arm64.exe`,
  `step-cli_0.30.2-1_amd64.deb`,
  `npp.8.9.4.Installer.x64.msi`,
  `sublime-text_build-4200_amd64.deb`. Pick the closest fit for what a
  test needs (display name, package type, etc.).

- **Profiles**: `fleet-pw-inert.mobileconfig` (macOS),
  `fleet-pw-inert.xml` (Windows) — inert, because **every profile upload
  can reach a real VM** (on free, Unassigned holds them). No lock, passcode
  or access-gating payload ever goes in `test-data/`; each profiles folder's
  README says why its fixtures are safe and how to prove they arrived.

- **Scripts**: one platform-prefixed `<platform>-create-marker` script per
  platform (`macos-create-marker.sh`, `linux-create-marker.sh`,
  `windows-create-marker.ps1`), which the scripts library specs upload. Each
  writes `/tmp/fleet-playwright-marker.txt` (or `%TEMP%\fleet-playwright-marker.txt`
  on Windows), so a host-execution test could verify the run via osquery's
  `file` table. Idempotent — safe to re-run on the same host. The platform
  prefix keeps the three names distinct when they share one fleet's library.
  `apple/macos/scripts/fleet-test-script.sh` is the setup-experience run script
  (`premium/controls/setup-experience/run-script.spec.ts`).

- **Bootstrap package**: `dummy-bootstrap-package.pkg` — small,
  signed-but-inert payload. Fleet won't actually install it on a host
  because the suite never enrolls an ADE Mac; the spec only verifies
  upload/list/download/delete.

- **Setup Assistant**: `automatic-enrollment.dep.json` — a minimal
  DEP profile that `premium/controls/setup-experience/setup-assistant.spec.ts`
  uploads, downloads, then deletes.

## Generated fixtures

Some fixtures are built by a script rather than downloaded, because what makes
each one useful is a *number or a name that has to be exactly right*: a byte
count on one side of a validation limit, a pixel dimension, or a package name no
other spec can collide with. Each sits next to the `make-*` script that
regenerates it:

| what | where | recipe |
|---|---|---|
| icon + org-logo PNGs | `shared/images/` | [`shared/images/README.md`](shared/images/README.md) |
| inert `.deb` packages | `linux/software/` | [`linux/software/README.md`](linux/software/README.md) — `make-deb.py [name version arch]` |
| signed `.mobileconfig` | `apple/macos/profiles/` | [`apple/macos/profiles/README.md`](apple/macos/profiles/README.md) |
| inert `.pkg` (one app bundle) | `apple/macos/software/` | `make-pkg.sh <role> [version]` — needs macOS `pkgbuild` |
| inert `.msi` (one marker file) | `windows/software/` | `make-msi.sh <role> [version]` — needs msitools' `wixl` |

The `.pkg` and `.msi` builders are shell, not Python, because each wraps the one
tool that can write the format. The `fleet-playwright-install` `.pkg`, `.msi` and
`.deb` — with 7-Zip's `7z2601-arm64.exe` — are the VMs fleet's durable
install/uninstall fixtures: declared in `gitops/premium-fleetqa/fleets/vms.yml`,
which downloads each from a commit-pinned URL and checks its `hash_sha256`, and
listed for the specs in `helpers/vm-fixtures.ts`. Each installs *nothing that
matters* on a real VM. The macOS package installs an app bundle because Fleet's
macOS inventory lists `.app` bundles only. **Rebuilding one changes its hash**:
commit it, then point its `*.package.yml` at the new commit and hash, and re-apply.

Packages whose name, version or size is decided at run time — a per-run `.deb`,
an `amd64` build that the ARM VMs refuse, a ~100 MB upload — aren't files here at
all: `helpers/deb.ts` builds them in memory.

`shared/software/fleet-playwright-script-package.sh` is written by hand but
belongs to the same family: Fleet titles a script package after its filename
minus the extension, so the filename *is* the title and has to stay unique.

## Adding new fixtures

When a new spec needs a fixture that isn't here yet, add it under the
matching `<platform>/<category>/` path and reference it from the spec
via
`path.resolve(__dirname, '../../../../test-data/<platform>/<category>/<file>')`
— one `../` per directory between the spec and `playwright/` (four from
`tests/e2e/<tier>/<area>/`, five from a sub-area such as `controls/os-settings/`).

Don't gitignore binary fixtures — committing them is intentional so any
contributor can run the suite without a prior data-fetch step. If a
fixture would be impractically large (>50 MB), generate it on demand
instead.
