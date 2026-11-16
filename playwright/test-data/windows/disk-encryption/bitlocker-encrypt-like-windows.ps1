# Starts encrypting a fully decrypted C: the way Windows 11 does by itself: used space only, XTS-AES 128, under a
# TPM protector, with no hardware test (which would wait for a restart). bitlocker-reset.ps1 then suspends
# protection and deletes the protector, which is the stock state. The volume object Enable-BitLocker returns is
# dropped, like every other here.
$ErrorActionPreference = 'Stop'
try {
  Enable-BitLocker -MountPoint 'C:' -EncryptionMethod XtsAes128 -UsedSpaceOnly -TpmProtector -SkipHardwareTest | Out-Null
  "encryption started"
} catch {
  "encryption not started: $($_.Exception.Message)"
}
