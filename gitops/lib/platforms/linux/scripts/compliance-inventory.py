#!/usr/bin/env python3
# A Python script, so the Compliance fleet's scripts glob carries all three
# kinds Fleet accepts (.sh, .ps1, .py). The fleet has no hosts; it never runs.
# The Linux scripts glob in both no-team configs is `*.sh`, so this file joins
# the Compliance fleet only.
import platform

print(platform.platform())
