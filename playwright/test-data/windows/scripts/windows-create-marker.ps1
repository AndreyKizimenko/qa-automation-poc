$ErrorActionPreference = 'Stop'
# Creates a marker file so an osquery `file` table check can confirm execution.
$Marker = "$env:TEMP\fleet-playwright-marker.txt"
$Stamp = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
"fleet-playwright created $Stamp" | Set-Content -Path $Marker -Encoding UTF8
Write-Output "Created $Marker"
