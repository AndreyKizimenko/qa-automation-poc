# Certificates — test cases

> Feature area. Effective regression set curated from Fleet feature-story test
> plans (audited: deduped across former product groups; cosmetic/low-value checks
> pruned). Each case keeps its origin story #s in **Source**. See
> [`README.md`](README.md) for conventions; GitOps flows live in [`gitops.md`](gitops.md).

## CA connection & certificate deployment

### CERT-001 — Deploy SCEP certificates from a Windows NDES SCEP server

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Fleet (Premium) with Apple MDM enabled; a reachable NDES SCEP server (Enterprise CA on Windows Server) configured and able to issue certs; an enrolled macOS host that has an IdP end-user email associated (`mdm_idp_accounts` source present in `host_emails`).
- **Source:** #13420, #21955

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In Fleet, configure the NDES SCEP connection (admin URL, username, password) and save. | Configuration saves successfully and a corresponding entry appears in the global activity feed. |
| 2 | Upload a configuration profile (via UI or GitOps) that uses the `$FLEET_VAR_NDES_SCEP_CHALLENGE`, `$FLEET_VAR_HOST_END_USER_EMAIL_IDP`, and `$FLEET_VAR_NDES_SCEP_PROXY_URL` variables, targeted at the enrolled macOS host with an IdP email. | The profile is delivered, Fleet fetches a one-time challenge from NDES, and the host receives a SCEP certificate issued by the NDES CA. |
| 3 | Upload a profile containing an unsupported variable such as `$FLEET_VAR_BOZO`, or a SCEP profile targeting a host that has no IdP email. | Fleet rejects/fails the profile delivery rather than issuing a certificate. |
| 4 | Attempt to use the NDES SCEP Fleet variables inside a Windows profile or an Apple DDM profile. | The variables are not honored for those profile types; the profile does not deploy a SCEP cert via NDES. |
| 5 | Deploy the SCEP profile to an offline macOS host, leave it offline for more than 60 minutes, then bring it online. | When the host comes back online, Fleet re-sends the profile with a freshly fetched one-time password (the prior NDES password having expired) and the cert is issued. |
| 6 | Edit and then delete the NDES SCEP configuration in Fleet. | A global activity feed entry is recorded for each of the edit and delete actions. |

### CERT-002 — MDM SCEP certificate is issued with "Fleet" issuer string

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** Apple MDM configured. A macOS host newly enrolling (or renewing its MDM SCEP cert).
- **Source:** #18427

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Turn on MDM for a new macOS host so a fresh SCEP certificate is issued. | The issued SCEP certificate uses "Fleet" (not the legacy "Fleetdm") as the issuer/organization string in its subject. |

### CERT-003 — Connect DigiCert CA and deploy a certificate to the macOS host Keychain

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** macOS
- **Preconditions:** Fleet Premium with Apple MDM configured. Valid DigiCert One credentials (API token, profile GUID) available. A macOS host enrolled with MDM on.
- **Source:** #22709, #26436

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Go to Settings > Integrations > Certificates and select Add CA > DigiCert. | DigiCert form appears with required fields; CA cannot be saved until all fields are populated. |
| 2 | Fill the form with valid DigiCert info, use name `DIGICERT_WIFI`, and select Add CA. | Fleet validates the API token, saves the CA, lists it on the Certificates page, and records an activity for adding the CA. |
| 3 | Create a PKCS12 configuration profile, replacing the password field with `$FLEET_VAR_DIGICERT_PASSWORD_DIGICERT_WIFI` and the data field with `$FLEET_VAR_DIGICERT_DATA_DIGICERT_WIFI`, and upload it to Fleet. | Profile uploads successfully (no unknown-`$FLEET_VAR_` error). |
| 4 | Open the host's details page and check OS settings status for the profile. | Profile reaches "Verified". |
| 5 | Open the macOS host's Keychain and search for the deployed certificate. | A real DigiCert-issued certificate is present in the Keychain. |
| 6 | Deploy the same profile to two or more hosts. | All targeted hosts receive their own certificate. |

### CERT-004 — Deploy certificates to the login (user) Keychain on macOS

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Fleet Premium with Apple MDM. At least one CA connected (custom SCEP, NDES, and/or DigiCert). One or more enrolled macOS hosts.
- **Source:** #26913

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add a custom SCEP CA named `SCEP_WIFI` via Settings > Integrations > Certificates. | CA is saved and listed. |
| 2 | In a profile editor, create a SCEP configuration profile with a top-level `PayloadScope` of `User`, replacing the challenge with `$FLEET_VAR_CUSTOM_SCEP_CHALLENGE_SCEP_WIFI` and the URL with `$FLEET_VAR_CUSTOM_SCEP_PROXY_URL_SCEP_WIFI`, and upload it. | Profile uploads without error. |
| 3 | Open Host details and check the profile status, then deploy the profile to two or more hosts. | Profile reaches "Verified" on each host; each host's Certificates section shows the installed certificate. |
| 4 | On a macOS host, open the Keychain app and inspect the "login" keychain. | The delivered certificate appears in the login (user) keychain, not the system keychain. |
| 5 | Repeat steps 2-4 for NDES and DigiCert user-scoped profiles. | NDES and DigiCert certificates are also delivered to the login (user) keychain. |

### CERT-005 — Connect custom SCEP CA via one-time challenge code and deploy a certificate

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Fleet Premium with Apple MDM. A custom SCEP CA endpoint that issues one-time (single-use) challenge codes. An enrolled macOS host.
- **Source:** #29172

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Go to Settings > Integrations > Certificates, select Add CA > Custom Simple Certificate Enrollment Protocol (SCEP), and configure it for a CA that uses one-time challenge codes; save as `SCEP_WIFI`. | Fleet validates the SCEP URL and saves the CA. |
| 2 | Create a SCEP configuration profile replacing the challenge field with `$FLEET_VAR_CUSTOM_SCEP_CHALLENGE_SCEP_WIFI` and the URL field with `$FLEET_VAR_CUSTOM_SCEP_PROXY_URL_SCEP_WIFI`, and upload it. | Profile uploads without error. |
| 3 | Deploy the profile to the host and check Host details. | Profile reaches "Verified"; a valid SCEP certificate is issued even though the CA challenge code is single-use, and the certificate appears in the Keychain and on Host details. |
| 4 | Deploy the same profile to a second host. | The second host obtains its own valid certificate (a fresh one-time code is used per host). |

### CERT-006 — Throttle certificate-bearing profile delivery to ease CA server load

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** Fleet Premium with Apple MDM. An NDES (or custom SCEP / DigiCert / Smallstep) CA connected. Fleet server started with `FLEET_MDM_CERTIFICATE_PROFILES_LIMIT` set to an artificially low value (e.g. 1). A team with roughly 10 enrolled macOS hosts.
- **Source:** #38002

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Upload an Apple configuration profile containing variables that reference the connected CA and target the team of ~10 hosts. | Profile begins delivering; UI may show "Pending" for all hosts, but in `host_mdm_apple_profiles` only one host per 30-second reconciler tick gets a non-null "pending" status and command UUID (rate = the configured limit per 30s). |
| 2 | While throttled delivery is in progress, enroll a new host from ADE with no setup experience items. | The newly enrolling host receives its profile quickly and is not forced to wait behind the throttled queue. |
| 3 | Transfer some throttled hosts to another team. | The certificate profile is removed from those hosts quickly (removal is not throttled). |
| 4 | Transfer hosts into this team. | The profile is sent to the newly applicable hosts at the throttled rate. |
| 5 | Delete the profile. | The profile is removed from all hosts quickly, not in the metered manner used for sending. |

### CERT-007 — Fleet delivers certificates with subject alternative name (SAN) attributes

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Android
- **Preconditions:** Fleet Premium with a custom SCEP certificate authority that supports SAN attributes such as UPN (for example EJBCA) configured; an enrolled Android host targeted by the certificate template.
- **Source:** #41472

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add a certificate template that includes a `subject_alternative_name` (for example `DNS=example.com, UPN=$FLEET_VAR_HOST_END_USER_IDP_USERNAME`) via the API or YAML, issuing from the SAN-capable SCEP CA. | The template is saved with both `subject_name` and `subject_alternative_name` persisted; `GET` of the certificate template returns the configured SAN. |
| 2 | Let Fleet deliver the certificate to the targeted Android host. | The certificate is delivered to the Android host successfully. |
| 3 | Inspect the delivered certificate on the host (or via the SCEP CA) and check its SAN field. | The certificate carries the expected SAN, with `$FLEET_VAR_*` variables resolved to the host's values (for example the UPN populated with the host end user's IdP username), matching the reference SAN certificates. |

### CERT-008 — Deploy and delete certificates on Android hosts via UI and API

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Android
- **Preconditions:** Fleet Premium license; Android enterprise (work profile) enrolled host; a certificate authority (e.g. SCEP) configured; a configuration profile that deploys a certificate assigned to the team.
- **Source:** #30876, #34856, #35198

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Assign a certificate-bearing configuration profile to the team containing the enrolled Android host (via UI or API). | Certificate is delivered to the Android work profile; OS settings show the certificate progressing to verified. |
| 2 | Open Host details for the Android host and view OS settings. | Deployed certificate is listed with its status. |
| 3 | Remove the certificate profile from the host (delete via UI or API). | Certificate is removed from the Android work profile and no longer listed in OS settings. |
| 4 | Verify the global activity feed. | Activities are recorded for the certificate being installed and removed. |

### CERT-009 — Deploy a certificate from an NDES CA to a Windows host

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Windows
- **Preconditions:** Fleet Premium license; Windows host enrolled via MDM; an NDES (Network Device Enrollment Service) server configured and accessible; the NDES/SCEP CA added in Fleet Settings.
- **Source:** #33421

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Deploy the root CA certificate to the Windows host per the setup guide. | Root CA certificate is installed on the Windows host. |
| 2 | Assign a configuration profile that requests a certificate from the NDES CA to the Windows host. | Fleet requests the certificate from NDES and delivers it to the host. |
| 3 | View OS settings on the Windows Host details page. | NDES-issued certificate progresses to verified. |
| 4 | Inspect the certificate on the Windows host. | Certificate is present and chains to the deployed root CA. |

## Certificate renewal

### CERT-010 — Auto-renew host MDM SCEP ("Fleet Identity") certificate before expiration

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Fleet server running with `mdm.apple_scep_signer_validity_days` configured to a value less than 180 days (so issued certs expire in under 180 days). Apple MDM configured. A new macOS host available to enroll.
- **Source:** #15332, #19684

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Turn on MDM features for the new macOS host while the server has `apple_scep_signer_validity_days` < 180. | Host enrolls; in Keychain the "Fleet Identity" SCEP certificate expires within the configured (sub-180-day) window. |
| 2 | Restart the Fleet server without the validity-days override set, then trigger the `cleanups_then_aggregation` cron job. | The job enqueues a SCEP certificate renewal for the host (renewal fires because cert is within 180 days of expiration). |
| 3 | Search for the "Fleet Identity" certificate in the host's Keychain after renewal completes. | A newly issued "Fleet Identity" certificate is present, now valid for the default 1-year period. |
| 4 | (ADE + SSO variant) Enroll a host via ADE with MDM SSO enabled, force a renewal, then re-inspect the enrollment profile. | After renewal the enrollment profile still contains the `enrollment_reference` query parameter; SSO enrollment remains intact. |

### CERT-011 — Renew NDES SCEP certificate on macOS before expiration

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Fleet Premium with Apple MDM. NDES CA connected. A macOS host enrolled with MDM on, with an NDES SCEP certificate profile deployed.
- **Source:** #24468, #27984

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add a macOS SCEP configuration profile referencing the NDES CA but omit one of `$FLEET_VAR_NDES_SCEP_CHALLENGE`, `$FLEET_VAR_NDES_SCEP_PROXY_URL`, or `$FLEET_VAR_SCEP_RENEWAL_ID`. | Fleet rejects the profile, requiring all three variables in their appropriate keys. |
| 2 | Add a valid NDES SCEP profile containing all three variables (including `$FLEET_VAR_SCEP_RENEWAL_ID`) and deploy to the host. | Profile deploys; `$FLEET_VAR_SCEP_RENEWAL_ID` is replaced with `fleet-` + the profile UUID before delivery; certificate is installed and shown in the host's Keychain and on the Host details > Certificates section. |
| 3 | Let the certificate reach 30 days from expiration (or, for a validity period under 30 days, half that period before expiration). | Fleet automatically resends the NDES SCEP profile and a renewed certificate is issued. |
| 4 | Move the host to another team, or remove the SCEP profile. | The certificate is removed from the host's Keychain. |

### CERT-012 — Renew DigiCert certificate on macOS before expiration

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS
- **Preconditions:** Fleet Premium with Apple MDM. DigiCert CA connected. A macOS host enrolled with MDM on, with a DigiCert certificate profile deployed.
- **Source:** #26553

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Deploy a DigiCert certificate profile to the host and confirm the certificate appears in the Keychain and on Host details. | Certificate is installed and shown on the Host details page. |
| 2 | Let the certificate reach 30 days from expiration (or, for a validity period under 30 days, half that period before expiration). | Fleet automatically resends the DigiCert profile and issues a renewed certificate. |
| 3 | Change the variable used in the CN without changing the seat ID, then attempt the renewal/resend. | Fleet throws an error (CN variable changed but seat ID unchanged is not allowed). |
| 4 | Move the host to another team, or remove the DigiCert configuration profile. | The certificate is removed from the host's Keychain. |

### CERT-013 — Renew custom SCEP CA certificate on Windows before expiration

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Windows
- **Preconditions:** Fleet Premium with Windows MDM. A custom SCEP CA connected. An enrolled Windows host with a SCEP (Wi-Fi/VPN) configuration profile deployed (both user-scoped and device-scoped certs available to test).
- **Source:** #32746

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Deploy a Windows custom-SCEP profile that delivers a Wi-Fi or VPN certificate and confirm connectivity using that certificate. | Certificate is delivered; host has working Wi-Fi/VPN access. |
| 2 | Let the certificate reach 30 days from expiration (or half the validity period if it is under 30 days). | Fleet automatically resends the Windows SCEP profile and the certificate is renewed for both user-scoped and device-scoped SCEP certificates. |
| 3 | After renewal, confirm Wi-Fi/VPN connectivity. | The user does not lose access to Wi-Fi/VPN through the renewal. |
| 4 | On Host details > OS settings modal, select Resend for the Windows SCEP profile. | The user can manually resend the Windows profile from the modal. |
| 5 | Change the value of a built-in (`$FLEET_VAR_...`) variable referenced by any Windows profile. | Fleet automatically resends the affected profile(s), not just SCEP profiles. |

### CERT-014 — Use `$FLEET_VAR_SCEP_RENEWAL_ID` in the Organizational Unit (OU) field

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS | iOS/iPadOS
- **Preconditions:** Fleet Premium with Apple MDM. A SCEP CA connected (Smallstep, NDES, or custom SCEP). An enrolled host.
- **Source:** #33261

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add a Wi-Fi/VPN profile with a SCEP payload specifying `$FLEET_VAR_SCEP_RENEWAL_ID` in the OU field and deploy it. | Profile deploys; certificate appears on the Host details and My device pages. |
| 2 | Let the certificate approach expiration. | Fleet renews automatically starting at 30 days before expiration if validity is over 30 days, or at half the validity period if validity is under 30 days. |
| 3 | Add a SCEP Wi-Fi/VPN profile that specifies `$FLEET_VAR_SCEP_RENEWAL_ID` in neither the OU nor the CN field. | Fleet rejects it with an easy-to-understand error message. |
| 4 | Add a SCEP Wi-Fi/VPN profile that specifies `$FLEET_VAR_SCEP_RENEWAL_ID` in both the CN and the OU fields. | Fleet rejects it with an easy-to-understand error message. |
| 5 | Add a profile with `$FLEET_VAR_SCEP_RENEWAL_ID` as one of multiple OU entries alongside other OU values; on an iOS host, also put `$FLEET_VAR_HOST_END_USER_IDP_USERNAME` in the CN. | Profile deploys; the IdP username is populated in the CN; auto-renewal still occurs at the correct threshold. |

### CERT-015 — Android certificates auto-renew based on validity period

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Android
- **Preconditions:** Fleet Premium license; Android work-profile host enrolled; a SCEP CA configured; certificate configuration profiles assigned with controllable validity periods.
- **Source:** #37181, #39840

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Deploy an Android certificate with a validity period over 30 days and advance/observe to within 30 days of expiration. | Certificate auto-renews 30 days before expiration and the updated profile is pushed. |
| 2 | Deploy an Android certificate with a 10-day validity period and observe to within 5 days of expiration. | Certificate auto-renews 5 days before expiration. |
| 3 | Deploy an Android certificate with a 1-day validity period and let it approach expiration. | Certificate does not auto-renew. |
| 4 | Verify certificate renewal on Apple platforms (iOS, iPadOS, macOS). | Apple certificate renewal behavior is unchanged (no regressions). |

### CERT-016 — Auto re-push profiles for certificates not proxied through Fleet (SCEP/ACME renewal)

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS | iOS/iPadOS
- **Preconditions:** Fleet Premium license; enrolled host(s); CAs configured for Okta conditional access (SCEP), Okta Verify (SCEP with static challenge), and Hydrant (ACME); certificate configuration profiles assigned with short validity periods.
- **Source:** #40639

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add CAs and assign certificate profiles for Okta conditional access (SCEP), Okta Verify (SCEP static challenge), and Hydrant (ACME), each issuing certificates with a short validity period. | Certificates are issued and installed on the host(s) and reach verified status. |
| 2 | Let the certificates approach the end of their short validity period. | Fleet detects the impending expiration for certificates not proxied through Fleet (including the Hydrant ACME certificate). |
| 3 | Observe renewal handling. | Fleet renews the certificates and automatically re-pushes the updated configuration profiles to the host(s). |
| 4 | Verify OS settings and certificate state after renewal. | Renewed certificates are installed and reach verified status with no manual intervention. |

## ACME hardware-attested enrollment

### CERT-017 — Enforce ACME (hardware-attested) MDM enrollment certificates

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | iOS/iPadOS
- **Preconditions:** Fleet Premium with Apple MDM. Access to Apple Silicon and Intel Macs, iPhones, and iPads enrollable via ADE/DEP and via manual (profile) enrollment.
- **Source:** #31289

| # | Step | Expected result |
|---|------|-----------------|
| 1 | With "Require Hardware Attestation" disabled, enroll Apple Silicon and Intel Macs, iPhones, and iPads via DEP and via manual profile enrollment; check Device Management > Profiles. | All devices enroll; "Fleet Enrollment" shows a SCEP enrollment. |
| 2 | Enable "Require Hardware Attestation" and re-enroll the same device types via DEP and manual enrollment. | All devices enroll; Apple Silicon Macs show an ACME enrollment, while other devices (Intel Macs, iPhones, iPads) show a SCEP enrollment. |
| 3 | Force enrollment-profile (SCEP) renewal by setting `cert_not_valid_after` to a near-future date in `nano_cert_auth_associations` for the test hosts. | After renewal, devices that qualify (Apple Silicon Macs from DEP) show ACME enrollments; all others show SCEP enrollments. |
| 4 | Break Apple attestation on an Apple Silicon DEP Mac (point appattest.apple.com hosts to 0.0.0.0) with "Require Hardware Attestation" enabled and attempt enrollment. | Enrollment fails. |
| 5 | On Host details, check the attestation indicator for ACME-enrolled/renewed devices vs others. | ACME-enrolled (or ACME-renewed) devices show "MDM Attested: Yes"; non-ACME devices do not show this field. |
| 6 | Switch the instance to Fleet Free and check the setting in UI, GitOps, and API. | The "Require Hardware Attestation" checkbox does not exist in the UI and the setting cannot be set via GitOps or API on Fleet Free. |
| 7 | With GitOps mode enabled (Premium), view the setting in the UI. | The "Require Hardware Attestation" checkbox is disabled/non-interactive. |

## Host vitals & My Device certificate display

### CERT-018 — Certificates section in host vitals with status, expiry, and details modal

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | iOS/iPadOS
- **Preconditions:** Enrolled macOS, iPhone, and iPad hosts with certificates installed; one unsupported-platform host (e.g. Windows/Linux) for negative checks.
- **Source:** #22802, #23235, #27567

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open Host details for a macOS host and click Refetch | Certificates update on the host |
| 2 | Review the Certificates section | Certificates are listed alphabetically with accurate expiry dates and a status indicator color matching expired, expiring, or valid; macOS-only Keychain text and a resolving "Learn more" link are present |
| 3 | Confirm the column set against the design and shrink the viewport | All specified columns are present; the table scrolls horizontally when columns exceed the viewport, and content truncates with a tooltip on hover |
| 4 | Open the certificate details modal | Modal data matches the design and the certificate's actual details |
| 5 | Open Host details for an unsupported-platform host and check the API | Certificates section does not appear; `GET /api/v1/fleet/hosts/:id/certificates` returns null results |
| 6 | On the host's My Device page, review the Certificates section and click "View details" | Certificates section matches the design with the same details and added columns as Host details; "View details" opens the certificate details; `GET /api/v1/fleet/device/{token}/certificates` lists the device's certificates |
| 7 | Repeat on iPhone and iPad | Behavior is consistent across macOS, iOS, and iPadOS |

### CERT-019 — Certificates table displays on Windows host details

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Windows
- **Preconditions:** Fleet Premium with Windows MDM enabled; a Windows host enrolled and reporting at least one certificate via osquery.
- **Source:** #31294

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the enrolled Windows host's Host details page. | The page loads and a Certificates section is shown. |
| 2 | Locate the Certificates table. | The certificates table renders for the Windows host, listing its reported certificates. |
| 3 | Read the help text shown below the certificates table on this Windows host. | The help text below the table is present and reflects the updated wording (matching the equivalent updated text on macOS). |
| 4 | Open a certificate's details modal and compare its fields against the host's osquery certificate data. | Table columns and details-modal fields are correctly populated and mapped from the underlying osquery certificate table. |
| 5 | Inspect a certificate whose scope is reported as "User". | The certificate's scope is shown as User, and that certificate is scoped to that user only (not available to every user on the device). |

### CERT-020 — Certificate section is hidden on hosts reporting no certificates

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Windows | macOS
- **Preconditions:** Fleet Premium; an enrolled Windows or macOS host that reports no certificates via osquery.
- **Source:** #31294

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the Host details page for a host that reports zero certificates. | No certificate section/table or help text is rendered; the entire certificate section is hidden. |

## Activity feed

### CERT-021 — Global and host activity for a failing SCEP renewal

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** MDM turned on; ability to force a SCEP/enrollment-profile renewal to fail; both a manually enrolled and a DEP-enrolled macOS host; silent migration workflow available.
- **Source:** #40623

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Force a SCEP renewal to fail | A failing-renewal event appears on both the global and host activity feeds |
| 2 | Repeat using the silent migration workflow | A failure activity is created |
| 3 | Repeat on a manually enrolled host and a DEP-enrolled host | Failure activity is created in both enrollment cases |
| 4 | Send a configuration profile with bad values that fails to install | The enrollment-profile (renewal) activity is not created for this unrelated failure |
| 5 | Inspect the host activity for the Fleet enrollment | It appears as an InstallProfile MDM command |
| 6 | Open the "Enrollment profile renewal details" modal | Modal displays the error (if available), the decoded request payload, and the response from the host |

## Linux TPM host identity certificates

### CERT-022 — Linux hosts authenticate to Fleet with TPM-backed identity certificates

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Linux
- **Preconditions:** Fleet server running with `FLEET_AUTH_REQUIRE_HTTP_MESSAGE_SIGNATURE=true`. fleetd built from TUF with `FLEET_MANAGED_HOST_IDENTITY_CERTIFICATE=1` for both amd64 and arm64. Linux hosts with and without a TPM available.
- **Source:** #28818, #30458, #30900

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Generate fleetd combining `--fleet-managed-host-identity-certificate` with `--fleet-tls-client-certificate` (and separately with `--fleet-tls-client-key`) | Generation fails with a clear, easy-to-understand error message |
| 2 | Generate fleetd for Windows or macOS with `--fleet-managed-host-identity-certificate` | Generation fails with a clear error message (feature is Linux-only) |
| 3 | Install managed-cert fleetd on a Linux host without a TPM | Connection is denied; the Fleet Desktop dropdown shows the "Can't connect" message, fleetd logs show clear errors, and the host does not appear in Fleet |
| 4 | Install managed-cert fleetd with the wrong enrollment secret | Connection is denied with a clear message in the Fleet Desktop dropdown |
| 5 | Install managed-cert fleetd on a TPM-equipped Linux host (test both amd64 on x64 and arm64 on arm64) | The host obtains a certificate and shows as online; queries and scripts run normally |
| 6 | Inspect API traffic from a working managed-cert host | Requests include HTTP message Signature headers |
| 7 | Delete the `host_identity*` cert files on the host and restart fleetd | fleetd obtains a new cert and reconnects to Fleet |
| 8 | Delete the host's certificate from the Fleet DB | All subsequent traffic from that host is denied |
| 9 | Uninstall and reinstall fleetd, then reinstall on top of an existing install | Both flows succeed and the host re-enrolls |
| 10 | Delete the host from Fleet; separately restart fleetd (`systemctl restart orbit`) and reboot the host OS | After deletion fleetd restarts and re-enrolls; restarts and reboot cause no change |
| 11 | Enroll a non-managed-cert fleetd against a server with `FLEET_AUTH_REQUIRE_HTTP_MESSAGE_SIGNATURE=true` | Enrollment is rejected |

### CERT-023 — TPM-backed Linux host identity certificates renew automatically

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Linux
- **Preconditions:** A Linux host enrolled using TPM-backed host identity certs (per #28818). Fleet server started with `FLEET_DEV_HOST_IDENTITY_CERT_VALIDITY_DAYS=1` to force short-lived certs.
- **Source:** #28818, #30476

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Leave the host online and observe certificate handling as expiry approaches | The certificate is renewed at the appropriate time before expiry |
| 2 | Take the host offline, wait until the certificate expires, change the enrollment secret, then bring the host back online | The host cannot access Fleet or renew its certificate |

## Certificate removal

### CERT-024 — Deleting a Windows certificate profile removes the certificate

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** Windows
- **Preconditions:** Fleet Premium with Windows MDM turned on; an enrolled Windows host with a certificate delivered via a configuration profile.
- **Source:** #33418

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In Controls > OS settings, confirm the certificate profile is applied to the Windows host. | The certificate appears as delivered on the host. |
| 2 | Delete the certificate profile. | The delete command is issued and the host is not left in a bad state. |
| 3 | Wait for the command to process and re-check the host. | The certificate is removed from the device and the profile no longer appears in OS settings. |

### CERT-025 — Resend an Android certificate to a specific host

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Android
- **Preconditions:** Fleet Premium license; Android work-profile host enrolled with certificates in verified, pending, and failed states; a SCEP CA configured.
- **Source:** #37556, #42608

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open OS settings for the Android host and inspect certificate rows. | "Resend" action is available for verified and failed certificates; no "Resend" action is offered for pending certificates. |
| 2 | Click "Resend" on a verified certificate. | Certificate enters "pending" state, then resolves to verified (or failed). |
| 3 | Click "Resend" on a terminally failed certificate. | Certificate resets to "pending"; if delivery fails again it becomes immediately terminal with no auto-retry. |
| 4 | After a successful resend, check the global activity feed. | A `resent_certificate` activity is recorded for the host. |
| 5 | Call the resend API for a pending certificate. | API returns an error and no resend occurs. |

## Certificate activity & retries (Android)

### CERT-026 — Android certificate install retries 3 times then terminally fails

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** Android
- **Preconditions:** Fleet Premium license; Android work-profile host enrolled; a SCEP CA configured (with the ability to deliberately misconfigure it); a certificate configuration profile assigned.
- **Source:** #37546, #42608, #42734

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Deploy a certificate successfully to an Android host and check the host activity feed. | `installed_certificate` activity appears with `status: "installed"` and no details modal. |
| 2 | Misconfigure the SCEP server to force an install failure and deploy a certificate. | An `installed_certificate` activity with `status: "failed_install"` appears after each failed attempt; certificate status resets to `pending` in OS settings between attempts. |
| 3 | Allow the retries to exhaust (3 retries / 4 total attempts). | After the final attempt the certificate status becomes terminally `failed`. |
| 4 | Click a failed certificate activity in the feed. | Details modal shows an error icon, a failure message with the certificate name and host name in bold, a collapsible "Details" section with the error text, and a "Done" button. |
| 5 | On the Android host details page, hover the "Upcoming" tab. | Tab is grayed out with tooltip "Currently, upcoming activity is only supported for macOS, Windows, Linux, iOS, and iPadOS hosts." |
| 6 | Confirm behavior on a non-Android host (macOS/Windows/Linux/iOS). | Activity card, Upcoming tab, and existing certificate activities work normally with no regressions. |

## Controls OS settings certificate management

### CERT-027 — View and manage SCEP certificates in Controls OS settings

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** Fleet Premium license; admin access to Controls > OS settings > Certificates; ability to configure a custom SCEP CA.
- **Source:** #39346

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open Controls > OS settings > Certificates with no custom SCEP CA configured. | New empty state is displayed prompting configuration of a CA. |
| 2 | Configure a custom SCEP CA but add no certificates, then revisit the Certificates view. | "Add certificate" empty state is shown with heading text reduced to 16px/1rem. |
| 3 | Open the "Add certificate" form. | CA selection field appears at the top of the form. |
| 4 | Add a certificate and review the resulting list. | Updated copy and an actions dropdown are present on the certificate row. |
| 5 | Open the actions dropdown and choose Delete. | A delete confirmation modal opens. |
| 6 | Open the actions dropdown and choose View. | Certificate details modal opens matching the approved designs. |
