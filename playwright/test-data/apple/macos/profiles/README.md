# macOS configuration-profile fixtures

> ## ⚠️ Every profile here must be safe to deliver to a real VM
>
> Uploading a profile is delivering it. On **free** there are no fleets, so Unassigned is where the
> MDM-enrolled macOS VM is, and Fleet's profile reconciler sends it whatever profiles it finds, every 30 s. An
> upload → delete lifecycle only races that tick; it doesn't avoid it. On premium the VMs fleet is the delivery target for batch E's specs by design.
>
> So nothing in this folder may gate access to a host: **no passcode payload**
> (`com.apple.mobiledevice.passwordpolicy`, `forcePIN`, `minLength`, `maxInactivity`, `allowSimple`), no screen
> lock, inactivity timeout, FileVault, login-window restriction, and nothing that disables SSH, remote
> management or the MDM channel. There are only a few real VMs per tier and no re-provisioning automation: one
> such payload delivered ends every real-host spec until someone rebuilds the machine by hand.
>
> This folder used to hold a passcode profile, `fleet-test-passcode.mobileconfig`, on the belief that the
> library lifecycle never reaches a host. On free it did — the free macOS VM acknowledged it 7 times. Don't add
> one back. If you're unsure a payload is safe, it isn't; ask first. See `playwright/CLAUDE.md` → "Test hosts".

## `fleet-pw-inert.mobileconfig`

The profile the suite delivers. It writes one key, `Marker = fleet-playwright-inert`, to the preference domain
`com.fleetdm.qa.playwright.inert` — a domain no software on the machine reads, so installing and removing it
changes nothing a person or a process on the VM could notice. System scope, one payload, no `$FLEET_*`
variables, so it uploads without setup.

- **Profile name in Fleet:** `Fleet Playwright Inert` (its top-level `PayloadDisplayName`).
- **PayloadIdentifier:** `com.fleetdm.qa.playwright.inert` — not one of the identifiers Fleet reserves
  (`FleetPayloadIdentifiers()` in `server/mdm/apple/mobileconfig/mobileconfig.go`).
- **Proving it reached the host:** macOS lists every managed preference in osquery's `managed_policies` table.
  Read it **filtered by this domain only**:

  ```sql
  SELECT domain, name, value FROM managed_policies WHERE domain = 'com.fleetdm.qa.playwright.inert';
  ```

  It returns the key once per scope it's managed in, so expect the row more than once. An unfiltered read
  returns fleetd's own configuration too, *enroll secret included*, which would then sit in stored report
  results and failure screenshots.
- **Timing, measured on the premium macOS VM (2026-09-29):** listed on the host 21 s after the upload (Fleet's
  profile reconciler runs every 30 s), *verified* about a minute later once a refetch landed.
- **Removal:** deleting the profile in Fleet sends `RemoveProfile`, and macOS drops the managed domain with it —
  the filtered read above came back empty 21 s after the delete.
- **Used by:** the premium and free library lifecycle (`{premium,free}/controls/os-settings/configuration-profiles.spec.ts`).
- sha256 `758273af58643a5b095c284b6c8ad30483a259d9ddb704aca5c5f460dc4c0d7e`

## `fleet-pw-inert-signed.mobileconfig`

The same profile wrapped in a CMS/PKCS7 signature, for the rejection test: Fleet signs profiles itself and
refuses a pre-signed one ("Configuration profiles can't be signed"). It is the *inert* profile that is signed,
so even a Fleet that regressed and accepted it would deliver nothing harmful. Regenerate with:

```sh
openssl req -x509 -newkey rsa:2048 -keyout /tmp/signer-key.pem -out /tmp/signer-cert.pem \
  -days 3650 -nodes -subj "/CN=Playwright Test Signer"
openssl smime -sign -signer /tmp/signer-cert.pem -inkey /tmp/signer-key.pem \
  -in fleet-pw-inert.mobileconfig -out fleet-pw-inert-signed.mobileconfig \
  -outform DER -nodetach
```

The signer is a throwaway self-signed cert; Fleet rejects the profile for *being* signed, regardless of which
key signed it, so the cert never needs to be trusted or renewed.
