# A script-only package: this file is the installer. Declared on the Compliance
# fleet, which has no hosts, so it never runs; it does nothing, since a file
# write in the body trips the WAF in front of the premium instance.
Write-Output "compliance marker"
