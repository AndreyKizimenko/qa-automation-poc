#!/usr/bin/env python3
"""Combine screenshots into one PNG, in reading order, so a comparison is one attachment.

usage: stack.py <out.png> <in1.png> <in2.png> [...] [--side] [--gap N]
  default   stack top to bottom (best for full-width crops of the same page)
  --side    place left to right (best for narrow before/after clips, e.g. a modal)
  --gap N   divider thickness in px between images (default 2; 0 for none)
Narrower/shorter images are padded with white; nothing is scaled.
"""
import sys
from PIL import Image

args = sys.argv[1:]
side = "--side" in args
gap = 2
if "--gap" in args:
    i = args.index("--gap")
    gap = int(args[i + 1])
    del args[i : i + 2]
args = [a for a in args if a != "--side"]
if len(args) < 3:
    sys.exit(__doc__)

out, paths = args[0], args[1:]
imgs = [Image.open(p).convert("RGB") for p in paths]
if side:
    size = (sum(i.width for i in imgs) + gap * (len(imgs) - 1), max(i.height for i in imgs))
else:
    size = (max(i.width for i in imgs), sum(i.height for i in imgs) + gap * (len(imgs) - 1))

canvas = Image.new("RGB", size, (208, 212, 220))  # divider colour shows through the gaps
pos = 0
for im in imgs:
    if side:
        cell = Image.new("RGB", (im.width, size[1]), "white")
        cell.paste(im, (0, 0))
        canvas.paste(cell, (pos, 0))
        pos += im.width + gap
    else:
        cell = Image.new("RGB", (size[0], im.height), "white")
        cell.paste(im, (0, 0))
        canvas.paste(cell, (0, pos))
        pos += im.height + gap
canvas.save(out)
print(f"{out}: {size[0]}x{size[1]} from {len(imgs)} images")
