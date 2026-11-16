# Starts decrypting C:. The volume object Disable-BitLocker returns carries the recovery password, so it is dropped.
Disable-BitLocker -MountPoint 'C:' | Out-Null
$v = Get-BitLockerVolume -MountPoint 'C:'
"decryption started: $($v.VolumeStatus) $($v.EncryptionPercentage)%"
