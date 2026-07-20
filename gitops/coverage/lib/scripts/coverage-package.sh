#!/bin/sh
# Script-only software package (coverage fixture). A script-only package has no
# binary installer — this script IS the install action. Exercises the
# software.packages[] path with a .sh referenced file (no url/hash needed).
touch /tmp/.fleet-coverage-package-installed
echo "coverage script-only package installed"
