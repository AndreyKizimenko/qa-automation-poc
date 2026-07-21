# macOS configuration-profile fixtures

- `fleet-test-passcode.mobileconfig` — a plain (unsigned) XML profile. The happy-path
  upload/download/delete lifecycle spec (`premium/controls/os-settings/configuration-profiles.spec.ts`)
  uses it.
- `fleet-test-signed.mobileconfig` — the same profile wrapped in a CMS/PKCS7 signature so it
  trips Fleet's "signed profiles are not supported" check. Used by the signed-profile rejection
  test. Regenerate with:

  ```sh
  openssl req -x509 -newkey rsa:2048 -keyout /tmp/signer-key.pem -out /tmp/signer-cert.pem \
    -days 3650 -nodes -subj "/CN=Playwright Test Signer"
  openssl smime -sign -signer /tmp/signer-cert.pem -inkey /tmp/signer-key.pem \
    -in fleet-test-passcode.mobileconfig -out fleet-test-signed.mobileconfig \
    -outform DER -nodetach
  ```

  The signer is a throwaway self-signed cert; Fleet rejects the profile for *being* signed,
  regardless of which key signed it, so the cert never needs to be trusted or renewed.
