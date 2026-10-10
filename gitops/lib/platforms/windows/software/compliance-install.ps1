# Install script declared on the Compliance fleet's Windows package in place of
# Fleet's default. Never runs (the fleet has no hosts); declared to be read
# back, so it does nothing — a real installer command in the body trips the WAF
# in front of the premium instance.
Write-Output "compliance install"
