# Prints C:'s BitLocker state and the types of its key protectors. Never a protector's value.
$v = Get-BitLockerVolume -MountPoint 'C:'
"volume: $($v.VolumeStatus) $($v.EncryptionPercentage)% method=$($v.EncryptionMethod) protection=$($v.ProtectionStatus)"
"protectors: " + ((@($v.KeyProtector) | ForEach-Object { $_.KeyProtectorType }) -join ', ')
