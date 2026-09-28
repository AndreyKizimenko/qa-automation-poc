# Linux software fixtures

Mostly real upstream installers kept under their upstream filenames
(`step-cli_0.30.2-1_amd64.deb`, `sublime-text_build-4200_amd64.deb`,
`gh_2.92.0_linux_amd64.tar.gz`, …). One is generated.

## `fleet-playwright-pkg_1.0.0_amd64.deb`

An inert 626-byte Debian package: one marker file under
`/usr/share/fleet-playwright-pkg/`, no maintainer scripts, nothing that touches
a host. Used by `premium/software/package-scripts.spec.ts`.

It exists because a spec needs a package whose **title name is unique across
the suite**. Fleet names a `.deb` title after the `Package:` field, so every
real `.deb` here shares a title with another spec's fixture ("step-cli",
"Sublime Text"), and a premium title can hold several packages — two specs
uploading to the same title on the same fleet leaves the Library accordion with
two rows and every row-scoped locator ambiguous. `Package: fleet-playwright-pkg`
belongs to one spec and always will.

A `.deb` in particular, rather than a tarball or a script package, because Fleet
generates *both* an install and an uninstall script for it, and both are short
enough for Ace to render whole — Ace virtualises long documents, so a real
installer's scripts would only be partly in the DOM and could never be compared
against what the API stored.

### Regenerating

```sh
python3 test-data/linux/software/make-deb.py
```

Standard library only, and deterministic: file mtimes are pinned to the epoch,
so a rebuild is byte-identical (sha256
`b63cfc2478f8b15ec1206aee10bcfcc12df47dba88f191b2a6cd7c0913faabfd`).

The script writes the `ar` archive itself instead of shelling out to `ar`.
macOS's `ar` always prepends a `__.SYMDEF` member, and Fleet detects a `.deb`
by the magic bytes `!<arch>\ndebian` — the `debian-binary` member has to come
first or the upload is rejected as an unsupported file type.
