# Returns C: to Windows 11's stock state after a test: encrypted, protection off, no key protectors.
# Every cmdlet's output goes to Out-Null, since the volume object it returns carries the recovery password.
$ErrorActionPreference = 'Stop'
try {
  Suspend-BitLocker -MountPoint 'C:' -RebootCount 0 | Out-Null
  foreach ($p in @((Get-BitLockerVolume -MountPoint 'C:').KeyProtector)) {
    Remove-BitLockerKeyProtector -MountPoint 'C:' -KeyProtectorId $p.KeyProtectorId | Out-Null
  }
} catch {
  "reset failed: $($_.Exception.Message)"
}
$v = Get-BitLockerVolume -MountPoint 'C:'
"volume: $($v.VolumeStatus) $($v.EncryptionPercentage)% method=$($v.EncryptionMethod) protection=$($v.ProtectionStatus)"
"protectors: " + ((@($v.KeyProtector) | ForEach-Object { $_.KeyProtectorType }) -join ', ')
