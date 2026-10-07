# Windows configuration-profile fixtures

> ## ⚠️ Every profile here must be safe to deliver to a real VM
>
> Uploading a profile is delivering it. On **free** there are no fleets, so Unassigned is where the
> MDM-enrolled Windows VM is, and Fleet's profile reconciler sends it whatever profiles it finds, every 30 s. An
> upload → delete lifecycle only races that tick; it doesn't avoid it. On premium the VMs fleet is the delivery target for the label-targeting specs by design.
>
> So nothing in this folder may gate access to a host: no **DeviceLock** CSP (`DevicePasswordEnabled`,
> `MaxInactivityTimeDeviceLock`, `MinDevicePasswordLength`, …), no account-lockout policy, nothing that disables
> remote login, RDP or manual MDM unenrollment, and nothing under `Policy/Config/Update` (that one also triggers
> OS updates). A "valid" profile — one that applies cleanly — is not the same as a safe one.
>
> This folder used to hold `fleet-test-screenlock.xml`, a DeviceLock policy (password required, 15-minute
> inactivity lock, 10-character minimum), on the belief that the library lifecycle never reaches a host. On free
> it did — the free Windows VM received it 32 times over 23 days. Don't add one back. If you're unsure a payload
> is safe, it isn't; ask first. See `playwright/CLAUDE.md` → "Test hosts".

## `fleet-pw-inert.xml`

The profile the suite delivers: one `<Replace>` of
`./Device/Vendor/MSFT/Policy/Config/ApplicationManagement/AllowGameDVR` to `0`, which turns off Xbox Game Bar
recording. Nothing on a QA VM records gameplay, so installing and removing it changes nothing a person or a
process on the VM could notice. It is also a setting our own gitops (`lib/platforms/windows/configuration-profiles/disable-game-dvr.xml`)
already applies to the free VMs every night.

- **Profile name in Fleet:** `fleet-pw-inert` — Fleet names a Windows profile after its file name.
- **Proving it reached the host:** Windows records an MDM policy under
  `HKLM\SOFTWARE\Microsoft\PolicyManager\current\device\ApplicationManagement`; osquery's `registry` table
  reads it:

  ```sql
  SELECT name, data FROM registry
  WHERE key = 'HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\PolicyManager\current\device\ApplicationManagement'
    AND name = 'AllowGameDVR';
  ```
- **Timing, measured on the premium Windows VM (2026-09-29):** delivered on the same 30-second reconciler tick
  as a macOS profile uploaded beside it, and *verified* by Fleet — which reads the LocURI back — within about a
  minute.
- **Removal:** deleting the profile in Fleet sends a SyncML `<Delete>` for each LocURI it set, and Windows
  reverts the policy to its default rather than removing the value: `AllowGameDVR` read `1` 8 s after the
  delete. So "removed" on the device is `data != '0'`, not "no row". (The free VM's history shows the same for
  the old DeviceLock fixture: a `<Delete>` per LocURI, and the DeviceLock values at their defaults afterwards.)
- **Two profiles setting this same LocURI on one fleet collide:** deleting either sends the `<Delete>`, and the
  other then fails verification. Fleet doesn't refuse the pair, so a spec that needs a second Windows profile
  on the same fleet at the same time needs a second harmless LocURI.
- **Used by:** the premium and free library lifecycle (`{premium,free}/controls/os-settings/configuration-profiles.spec.ts`).
- sha256 `77b02f5db388ca3e3f2d44e59564e31ff92268da874b03e721b914a9d27bc205`
