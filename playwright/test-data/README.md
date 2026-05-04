# Test data

Static **binary fixtures** that smoke specs upload, install, or otherwise feed
into Fleet — bootstrap packages, sample scripts, custom software packages,
configuration profiles, and declarations.

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
│   │   ├── scripts/             # marker create/delete .sh scripts
│   │   ├── setup-assistant/     # automatic-enrollment .json
│   │   └── software/            # .pkg custom packages
│   └── ios-ipados/              # (future) .mobileconfig, declarations
├── linux/
│   ├── scripts/                 # marker create/delete .sh scripts
│   └── software/                # .deb / .rpm / .tar.gz custom packages
├── windows/
│   ├── profiles/                # .xml profiles
│   ├── scripts/                 # marker create/delete .ps1 scripts
│   └── software/                # .msi / .exe custom packages
└── shared/                      # (future) cross-platform fixtures
```

## Naming conventions

- **Software**: real upstream installers, kept verbatim by their
  upstream filename so the source is obvious. Examples:
  `gh_2.92.0_macOS_universal.pkg`, `7z2601-x64.msi`,
  `step-cli_0.30.2-1_amd64.deb`,
  `npp.8.9.4.Installer.x64.msi`,
  `sublime-text_build-4200_amd64.deb`. Pick the closest fit for what a
  test needs (display-name, source, multi-arch, etc.).

- **Profiles**: `fleet-test-passcode.mobileconfig` (macOS),
  `fleet-test-screenlock.xml` (Windows) — minimal, deterministic, no
  `$FLEET_SECRET_*` placeholders so they upload cleanly without prior
  setup.

- **Scripts**: platform-prefixed `<platform>-{create,delete}-marker`
  pairs (`macos-create-marker.sh`, `linux-create-marker.sh`,
  `windows-create-marker.ps1`, …). Each writes / removes
  `/tmp/fleet-playwright-marker.txt` (or `%TEMP%\fleet-playwright-marker.txt`
  on Windows) so a future host-execution test can verify success via
  osquery's `file` table. Idempotent — safe to re-run on the same
  host. The platform prefix lets the three platforms run in parallel
  against the shared smoke fleet without filename collisions.

- **Bootstrap package**: `dummy-bootstrap-package.pkg` — small,
  signed-but-inert payload. Fleet won't actually install it on a host
  because we never enroll an ADE Mac during smoke; we only verify
  upload/list/download/delete.

- **Setup Assistant**: `automatic-enrollment.dep.json` — a minimal
  DEP profile that the Setup Assistant smoke uploads, downloads, then
  deletes.

## Adding new fixtures

When a new spec needs a fixture that isn't here yet, add it under the
matching `<platform>/<category>/` path and reference it from the spec
via
`path.resolve(__dirname, '../../test-data/<platform>/<category>/<file>')`.

Don't gitignore binary fixtures — committing them is intentional so any
contributor can run the suite without a prior data-fetch step. If a
fixture would be impractically large (>50 MB), generate it on demand
instead.
