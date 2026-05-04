$ErrorActionPreference = 'Stop'
# Removes the marker created by create-fleet-playwright-marker.ps1. Idempotent.
$Marker = "$env:TEMP\fleet-playwright-marker.txt"
if (Test-Path $Marker) {
  Remove-Item $Marker -Force
}
Write-Output "Removed $Marker"
