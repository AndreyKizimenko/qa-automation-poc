#!/bin/sh
# Install script declared on the Compliance fleet's macOS package in place of
# Fleet's default. The fleet has no hosts, so it never runs; it exists to be
# declared and read back, which is why it does nothing: a real installer
# command in the body trips the WAF in front of the premium instance.
echo "compliance install"
