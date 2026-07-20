#!/bin/sh
# Remediation script (coverage fixture). Declared in a team's controls.scripts and
# referenced by a policy's `run_script:` automation so GitOps wires the two together.
echo "coverage remediation script ran"
