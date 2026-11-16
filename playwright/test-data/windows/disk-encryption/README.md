# Windows disk-encryption scripts

PowerShell scripts the `premium-encryption` project (`tests/e2e/premium/encryption/`) runs on the lab's
BitLocker host through Fleet, as ad-hoc scripts (`helpers/disk-encryption.ts` builds them). Fleet runs a
Windows script as SYSTEM. None of them prints a recovery password: every cmdlet that returns the volume
object, which carries it, is piped to `Out-Null`, and the status lists protector *types* only.

| file | what it does |
|---|---|
| `bitlocker-status.ps1` | Prints C:'s conversion state, percentage, method, protection and the types of its key protectors |
| `bitlocker-decrypt.ps1` | Starts decrypting C: (`Disable-BitLocker`) |
| `bitlocker-encrypt-like-windows.ps1` | Starts encrypting a decrypted C: as Windows 11 does by itself: used space, XTS-AES 128, a TPM protector. With `bitlocker-reset.ps1` after it, the way back to the stock state from a run that stopped mid-decryption |
| `bitlocker-reset.ps1` | Suspends protection and deletes every key protector: the state Windows 11 leaves a disk in when it encrypts it by itself, encrypted with a clear key |

## The host they are for

Only `prem-win11-bde` (`lab-hosts.json`, purpose *BitLocker from Windows 11's stock state*): a Windows 11
VM in Fleet's MDM that the lab keeps in that stock state, with its own virtual TPM. Never a pool host and
never `prem-win10-01`, which carries a smoke.

## Why it is safe

A disk with protection suspended and no protectors boots unattended: that is the host's baseline. While Fleet
holds a recovery password and a TPM protector, the host also boots unattended unless the TPM's measurements
change; the lab found BitLocker can't bind to Secure Boot on its VMs, so a firmware update on its server
could send a protected VM to the recovery prompt. That is why each test ends at the reset. If a host still
stops at the recovery prompt, the lab's owner types the key Fleet holds, or rolls the VM back. No smoke runs
on it.
