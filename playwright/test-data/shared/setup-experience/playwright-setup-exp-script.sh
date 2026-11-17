#!/bin/sh
# A script-only package (this file is the installer) that the setup-experience
# Install software spec selects on the macOS and Linux tabs: the way Fleet 5
# runs a script during setup, in place of the deprecated Run script step. The
# suite never enrolls a host through setup experience, so it never runs, and it
# only prints. Fleet titles it after the filename, "playwright-setup-exp-script".
echo "playwright setup experience script"
