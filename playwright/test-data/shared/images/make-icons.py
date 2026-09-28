#!/usr/bin/env python3
"""Generate the PNG fixtures the Fleet Playwright suite uploads.

Each file sits on one side of a Fleet validation boundary — see README.md for
the table. Standard library only, and deterministic: re-running produces
byte-identical files.
"""
import os
import struct
import sys
import zlib

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))

def chunk(tag, data):
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

def write_png(path, width, height, row_fn):
    raw = b"".join(b"\x00" + row_fn(y) for y in range(height))
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)  # 8-bit RGB
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", ihdr))
        f.write(chunk(b"IDAT", zlib.compress(raw, 9)))
        f.write(chunk(b"IEND", b""))

def solid(width, rgb):
    return lambda y: bytes(rgb) * width

def noise(width, seed=20260927):
    # Deterministic LCG stream: incompressible, so the file lands well over the
    # 100 KB limit while the image stays a valid square PNG.
    state = [seed]
    def row(_y):
        out = bytearray(width * 3)
        s = state[0]
        for i in range(len(out)):
            s = (s * 1103515245 + 12345) & 0x7FFFFFFF
            out[i] = (s >> 16) & 0xFF
        state[0] = s
        return bytes(out)
    return row

FILES = [
    ("fleet-test-icon-valid.png",       256,  256,  solid(256, (0, 82, 204))),
    ("fleet-test-icon-too-small.png",   100,  100,  solid(100, (0, 82, 204))),
    ("fleet-test-icon-too-large.png",   1025, 1025, solid(1025, (0, 82, 204))),
    ("fleet-test-icon-not-square.png",  200,  256,  solid(200, (0, 82, 204))),
    ("fleet-test-icon-oversize.png",    256,  256,  noise(256)),
    ("fleet-test-logo.png",             256,  256,  solid(256, (255, 92, 0))),
]

for name, w, h, fn in FILES:
    path = os.path.join(OUT, name)
    write_png(path, w, h, fn)
    print(f"{name:34} {w}x{h:<5} {os.path.getsize(path):>7} bytes")
