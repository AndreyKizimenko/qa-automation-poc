#!/usr/bin/env python3
"""Build the inert .deb fixture the Fleet Playwright suite uploads.

macOS `ar` always prepends a __.SYMDEF member, which breaks Fleet's
`!<arch>\\ndebian` magic-byte check, so the archive is written here directly.
"""
import gzip
import io
import os
import sys
import tarfile

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "fleet-playwright-pkg_1.0.0_amd64.deb"
)
NAME, VERSION, ARCH = "fleet-playwright-pkg", "1.0.0", "amd64"
MTIME = 0  # fixed epoch keeps the build byte-for-byte reproducible

CONTROL = f"""Package: {NAME}
Version: {VERSION}
Architecture: {ARCH}
Maintainer: Fleet QA <qa@fleetdm.com>
Section: utils
Priority: optional
Description: Inert fixture package for the Fleet Playwright suite.
 Ships one marker file under /usr/share and changes nothing else.
"""
MARKER = "fleet playwright fixture\n"

def tar_gz(entries):
    """entries: list of (path, text). Returns gzipped tar bytes."""
    raw = io.BytesIO()
    with tarfile.open(fileobj=raw, mode="w", format=tarfile.GNU_FORMAT) as tf:
        for path, text in entries:
            data = text.encode()
            info = tarfile.TarInfo(path)
            info.size, info.mtime, info.mode = len(data), MTIME, 0o644
            tf.addfile(info, io.BytesIO(data))
    out = io.BytesIO()
    with gzip.GzipFile(fileobj=out, mode="wb", mtime=MTIME) as gz:
        gz.write(raw.getvalue())
    return out.getvalue()

def ar_member(name, data):
    header = f"{name:<16}{MTIME:<12}{0:<6}{0:<6}{0o100644:<8o}{len(data):<10}`\n".encode()
    return header + data + (b"\n" if len(data) % 2 else b"")

members = [
    ("debian-binary", b"2.0\n"),
    ("control.tar.gz", tar_gz([("./control", CONTROL)])),
    ("data.tar.gz", tar_gz([(f"./usr/share/{NAME}/marker.txt", MARKER)])),
]
blob = b"!<arch>\n" + b"".join(ar_member(n, d) for n, d in members)
with open(OUT, "wb") as f:
    f.write(blob)
print(f"{OUT}  {len(blob)} bytes")
