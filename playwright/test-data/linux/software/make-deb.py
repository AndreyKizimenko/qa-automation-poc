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

# make-deb.py [name version arch] — defaults build fleet-playwright-pkg_1.0.0_amd64.deb.
NAME, VERSION, ARCH = sys.argv[1:4] if len(sys.argv) > 3 else ("fleet-playwright-pkg", "1.0.0", "amd64")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), f"{NAME}_{VERSION}_{ARCH}.deb")
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
    """entries: list of (path, text). Returns gzipped tar bytes.

    Each file's parent directories go in first, as their own entries: dpkg
    unpacks into them and fails ("unable to create …: No such file or
    directory") when a package ships a file under a directory it doesn't list.
    """
    raw = io.BytesIO()
    with tarfile.open(fileobj=raw, mode="w", format=tarfile.GNU_FORMAT) as tf:
        dirs = []
        for path, _ in entries:
            parts = path.split("/")[:-1]
            for i in range(2, len(parts) + 1):
                d = "/".join(parts[:i]) + "/"
                if d not in dirs:
                    dirs.append(d)
        for d in dirs:
            info = tarfile.TarInfo(d)
            info.type, info.mtime, info.mode = tarfile.DIRTYPE, MTIME, 0o755
            tf.addfile(info)
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
