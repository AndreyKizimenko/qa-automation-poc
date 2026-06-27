# Identity & Access — test cases

> Feature area. Effective regression set curated from Fleet feature-story test
> plans (audited: deduped across former product groups; cosmetic/low-value checks
> pruned). Each case keeps its origin story #s in **Source**. See
> [`README.md`](README.md) for conventions; GitOps flows live in [`gitops.md`](gitops.md).

## SSO login

### IDENTITY-001 — Global SSO toggle does not block existing or new users from logging in

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** An identity provider is configured (e.g. mocksaml.com). Logged in as a global admin. At least one test user exists.
- **Source:** #15236

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Confirm the global SSO enable/disable control and its surrounding copy/layout match the current design | UI matches design; the toggle and its description render correctly |
| 2 | With global SSO enabled, create a user with SSO enabled, then log in as that user via SSO | User is created and can log in successfully via SSO |
| 3 | As admin, remove SSO from that user, then have the user log in | User can still log in (via password) |
| 4 | Disable global SSO as admin, create another user without SSO, and have that user log in | User is created and can log in successfully |
| 5 | Re-enable global SSO as admin, add SSO to a user, and have that user log in via SSO | Toggling global SSO off and back on does not break SSO; the user logs in successfully via SSO |

## SCIM IdP integration & host vitals

### IDENTITY-002 — Connect IdP via SCIM and surface end user IdP info in host vitals

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | iOS/iPadOS
- **Preconditions:** Fleet Premium. An IdP supporting SCIM provisioning (Entra ID, or authentik fronting Google Workspace) with users and groups configured. Hosts mapped to those IdP users.
- **Source:** #28196, #28197, #42915

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Create the SCIM integration app in the IdP (Entra ID / authentik) but leave something misconfigured, then run "test connection". | The integration card state on /settings/integrations/identity-provider does NOT change (still shows not-connected) until the first successful request. |
| 2 | Correct the configuration so the IdP sends a valid SCIM request to Fleet. | After the first successful request the card shows IdP connected and displays the latest request timestamp. |
| 3 | Cause a subsequent SCIM request to error. | The card shows an error message in a tooltip on hover over the card text; latest-request timestamp continues to reflect the most recent request. |
| 4 | View a mapped host's Host details > User (IdP) card. | The user information and Groups in the card match what is assigned to the user in the IdP. |
| 5 | In the IdP, update a user's lastName or userName, and change a user's group assignments. | The updated attributes and group membership changes are reflected on the host's Host details. |

### IDENTITY-003 — Populate IdP department host vital and profile variable via SCIM

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows | iOS/iPadOS
- **Preconditions:** Premium Fleet instance with SCIM configured against a supported IdP (Okta, Entra ID, Google Workspace, or Authentik); a configuration profile using `$FLEET_VAR_HOST_END_USER_IDP_DEPARTMENT`.
- **Source:** #29609

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Configure a department for an IdP user and sync via SCIM. | Fleet fetches the user's department for each supported IdP. |
| 2 | Deploy a configuration profile containing `$FLEET_VAR_HOST_END_USER_IDP_DEPARTMENT` to a host whose user has a department set. | The profile deploys with the department value populated. |
| 3 | Deploy the same profile to a host whose user has no/empty department. | The profile deployment fails. |

### IDENTITY-004 — Automatically remove Fleet users when removed from the IdP

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Premium Fleet instance with SCIM-connected IdP (Okta, Entra ID, Google Workspace, Authentik, etc.); multiple users including more than one admin and an API-access account.
- **Source:** #36785

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On Settings > Integrations > Identity Providers (IdP), review the description and, with an IdP connected, the "received" copy. | Updated description and "received" copy are displayed. |
| 2 | Connect an IdP via SCIM, then remove a non-admin user from the IdP. | The user is also deleted from Fleet. |
| 3 | Reduce to a single remaining admin account and open the Actions dropdown for it. | "Delete" is disabled with the new tooltip (last admin cannot be removed). |
| 4 | Confirm an API-access account in the IdP-managed set. | API access accounts are not deleted by this feature. |

## MSP dashboard & end-user auth SSO

### IDENTITY-005 — MSP dashboard signs in via Entra ID SSO

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** MSP dashboard running locally with Entra SSO config (`entraClientId`, `entraTenantId`, `entraClientSecret`) set and redirect URI registered; a test user in Entra.
- **Source:** #24688

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Start the MSP dashboard with Entra SSO config set. | Terminal logs "Entra SSO enabled. The built-in authorization mechanism will be disabled." |
| 2 | Navigate to the app. | Redirected to the Microsoft Entra login screen. |
| 3 | Enter the test user's credentials (completing any required 2FA). | Login succeeds and redirects back to the profiles page. |
| 4 | Open the account page and click "Edit profile". | The user's email address field cannot be edited. |

### IDENTITY-006 — Enforce 4-character minimum for end-user auth Entity ID

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Premium Fleet instance with end-user authentication (SSO) configuration available; admin access and GitOps capability.
- **Source:** #29512

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Enter `1234` as the Entity ID in the UI and save. | The 4-character Entity ID is accepted. |
| 2 | Apply `4321` as the Entity ID via GitOps. | The Entity ID is accepted via GitOps. |
| 3 | Clear the Entity ID field in the UI and attempt to save. | A validation error is shown. |

## Conditional access enforcement

### IDENTITY-007 — Block end users who fail policies via Entra conditional access

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** macOS
- **Preconditions:** Conditional access configured and enabled for the host's team (see configuration case); host is MDM-enrolled; Entra/Office 365 login available
- **Source:** #19235, #26835

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open "Manage automations" > "Conditional access", select a policy that is failing on the host, and save | The host is flagged for conditional access on that policy |
| 2 | Attempt to log in via Entra (e.g. Office 365) on the failing host | The user is directed to a page with instructions to resolve policies and is blocked from access |
| 3 | Resolve the failing policy so it passes | Access is restored after the policy passes |
| 4 | Add a new policy to the team and log in via Entra before the host is marked passing | Access is not blocked by the not-yet-evaluated policy |
| 5 | Remove the device from MDM | The device is shown as out of compliance in Entra |

### IDENTITY-008 — Migrate hosts to Entra conditional access without end-user interaction

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS
- **Preconditions:** Managed cloud Fleet Premium instance with conditional access configured; existing enrolled hosts to migrate per the guide's "Migration" section
- **Source:** #33319

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Follow each step in the guide's "Migration" section to migrate existing hosts onto Entra conditional access | Hosts are migrated and reflect correct compliance state in Entra without requiring any end-user interaction |

### IDENTITY-009 — End user passing conditional access policies is allowed through across browsers

- **Tier:** Premium
- **Platforms:** macOS
- **Priority:** P1
- **Preconditions:** Premium instance with Okta conditional access configured; a Mac enrolled and passing its conditional access policies; the Okta-issued client certificate deployed to the host.
- **Source:** #31909

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the host, sign in to the Okta-protected app using Chrome. | End user is allowed through with no popups to select a certificate or allow keychain access. |
| 2 | Repeat the sign-in using Safari. | End user is allowed through; at most one certificate/keychain popup may appear. |
| 3 | Repeat the sign-in using Firefox. | End user is allowed through; one or more certificate popups may appear. |
| 4 | Using the same Okta account, sign in from a device without a certificate (e.g. an iPhone) while the Mac is failing policies. | The certificate-less device is allowed through and is not blocked because of the Mac's failing policies. |

## Conditional access configuration

### IDENTITY-010 — Disconnect Entra conditional access integration

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Managed cloud Fleet Premium instance with conditional access configured (Entra connected)
- **Source:** #19235

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the conditional access configuration page, click "Delete" | A confirmation modal appears with copy matching Figma |
| 2 | Confirm disconnecting Entra | The configuration form reappears with no tenant ID pre-filled (tenant ID deleted) |
| 3 | Go to a team's policies page and open "Manage automations" | "Conditional access" is disabled with a tooltip |
| 4 | On a host that is failing a policy, attempt to log in via Entra | Login succeeds; access is restored despite failing policies (host marked compliant in Entra) |

### IDENTITY-011 — Conditional access availability gating on self-hosted and Free instances

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Access to a self-hosted Fleet Premium instance and a Fleet Free instance; a team with at least one policy on each
- **Source:** #19235

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the self-hosted Premium instance, navigate directly to Settings > Integrations > Conditional access | The user is redirected to the team settings page; "Conditional access" does not appear in the nav |
| 2 | On the self-hosted instance, open "Manage automations" on the "All teams" and on a team policies page | "Conditional access" is not listed in the dropdown |
| 3 | Make a request to the fleetdm.com proxy directly using the self-hosted license key | The request returns a 403 error |
| 4 | On the Fleet Free instance, go to Settings > Integrations > Conditional access | An "Available in Fleet Premium" message is shown |
| 5 | On the Fleet Free instance, open "Manage automations" on the policies page | "Conditional access" is listed but disabled with a tooltip noting it is available in Premium |

### IDENTITY-012 — Configure Okta and Entra conditional access integrations as an IT admin

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Fleet Premium instance (managed cloud or self-hosted) with an admin user; Okta and Entra tenants available for conditional access setup.
- **Source:** #19235, #26760, #28622, #31909

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Go to Settings > Integrations > Conditional access. | Conditional access section is shown for both managed-cloud and self-hosted deployments. |
| 2 | Open the Okta conditional access modal and follow the in-modal link to the setup guide. | Guide link opens the correct Okta conditional access documentation (no 404). |
| 3 | In the Okta modal, upload an invalid certificate. | Fleet rejects the upload with a validation error rather than saving it. |
| 4 | Upload a valid certificate and complete the Okta configuration. | Okta integration is saved and shown as configured. |
| 5 | Open the Entra conditional access modal and follow the in-modal link to the setup guide. | Guide link opens the correct Entra conditional access documentation (no 404). |
| 6 | Configure the Entra integration so both Okta and Entra are configured at the same time. | Both Okta and Entra integrations are saved and shown as configured concurrently. |
| 7 | Remove the Okta integration. | Okta integration is removed and no longer shown as configured; Entra remains unaffected. |
| 8 | Reload the page with GitOps mode enabled and open the conditional access forms. | Forms can still be filled out and submitted with GitOps mode enabled. |
| 9 | Open Settings > Integrations > Conditional access on a Fleet Free instance. | Conditional access configuration is not available on Fleet Free. |

## Host IdP username management

### IDENTITY-013 — Set an IdP username via API on a host with no IdP data

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** All
- **Preconditions:** Premium-licensed Fleet instance with SCIM configured. An enrolled host that did not authenticate during setup and therefore has no IdP data. The IdP username being set matches an existing IdP user.
- **Source:** #28070

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Call the API to set an IdP username on the host. | API returns success. |
| 2 | Open the host detail page. | The IdP username is displayed on the host detail page. |
| 3 | Inspect the IdP-derived fields on the host detail page. | Other data from IdP (e.g. full name, groups) is populated for the host. |

### IDENTITY-014 — Change an IdP username via API to a user that does not exist clears other IdP data

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Premium-licensed Fleet instance with SCIM configured. An enrolled host that has an IdP username and populated IdP data.
- **Source:** #28070

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Call the API to change the IdP username to a value that does not correspond to any existing IdP user. | API returns success. |
| 2 | Open the host detail page. | The IdP username changes to the new value on the host detail page. |
| 3 | Inspect the IdP-derived fields on the host detail page. | Other data from IdP is cleared out because the IdP user does not exist. |

### IDENTITY-015 — Add an IdP username via API without SCIM configured saves only the username

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Premium-licensed Fleet instance with SCIM not configured. An enrolled host with no IdP data.
- **Source:** #28070

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Call the API to set an IdP username on the host. | API returns success and the username is saved. |
| 2 | Open the host detail page and inspect the IdP fields. | The IdP username is displayed, but no other IdP data is populated. |

### IDENTITY-016 — Updating a host's IdP username via the API is blocked on Fleet Free

- **Tier:** Free
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Fleet Free (no Premium license). An enrolled host.
- **Source:** #28070

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Call the API to set or change the host's IdP username. | The request is rejected; changing the IdP username only works with a Premium license. |

### IDENTITY-017 — Add a host's IdP username for the first time via the UI

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** All
- **Preconditions:** Premium-licensed Fleet instance with SCIM configured. An enrolled host with no IdP username set.
- **Source:** #33909

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the host detail page and open the action to add an IdP username. | The add/edit IdP username modal opens. |
| 2 | Enter an existing IdP username and confirm. | The modal closes and the IdP username is displayed on the host detail page. |

### IDENTITY-018 — Remove a host's IdP username via the UI

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Premium-licensed Fleet instance with SCIM configured. An enrolled host that has an IdP username set.
- **Source:** #33909

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the host detail page and use the UI option to remove the IdP username. | The IdP username is removed and is no longer displayed on the host detail page. |

### IDENTITY-019 — IdP username changes are recorded in the activity feed

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Premium-licensed Fleet instance with SCIM configured. An enrolled host.
- **Source:** #33909

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add, edit, and then remove the host's IdP username. | Each action completes successfully. |
| 2 | Open the activity feed. | The activity feed records the add, edit, and removal of the host's IdP username. |

### IDENTITY-020 — IdP username management via the UI is hidden on Fleet Free

- **Tier:** Free
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Fleet Free (no Premium license). An enrolled host.
- **Source:** #33909

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the host detail page and look for the option to add, edit, or remove the IdP username. | The IdP username management feature does not appear anywhere in Fleet Free. |

## Conditional access bypass & remediation

### IDENTITY-021 — Disable-bypass setting controls the end user "Action required" remediation flow

- **Tier:** Premium
- **Platforms:** macOS
- **Priority:** P0
- **Preconditions:** Premium instance upgraded from an older Fleet version with Okta conditional access enabled; a Mac enrolled with conditional access policies; an end user able to trigger the Okta sign-in flow.
- **Source:** #34440

| # | Step | Expected result |
|---|------|-----------------|
| 1 | After upgrading, go to Settings > Integrations > Conditional access. | "Disable bypass" option is visible and is disabled (off) by default. |
| 2 | Delete the Okta conditional access configuration. | "Disable bypass" option is hidden and the setting is disabled. |
| 3 | Re-add the Okta configuration and enable "Disable bypass". | Setting is saved as enabled. |
| 4 | As an end user with a host failing policies, complete the Okta sign-in flow. | User is redirected directly to the "My device" page; the failing-policies banner directs the user toward "Action required" policies. |
| 5 | On a "My device" page with no "Action required" policies, view the failing-policies banner. | Banner renders correctly with no regressions when there are no "Action required" policies. |
| 6 | Click an "Action required" policy on the "My device" page. | No bypass option is offered for the policy. |
| 7 | Remediate the failing policy and refetch host vitals. | Once the policy passes, the end user is able to complete sign-in. |

### IDENTITY-022 — Critical conditional access policies block end user bypass; non-critical policies allow snooze

- **Tier:** Premium
- **Platforms:** macOS
- **Priority:** P0
- **Preconditions:** Premium instance with Okta conditional access configured and global bypass enabled; multiple policies have conditional access enabled; a Mac enrolled and able to fail those policies; an end user able to run the Okta sign-in flow.
- **Source:** #36105, #40521

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Check copy in Settings > Integrations > Conditional access, the Add policy and Edit policy "critical" tooltips, and Policies > Manage automations > Conditional access. | Copy and tooltips reflect the `critical`-based bypass model (no per-policy bypass checkbox). |
| 2 | In the Manage automations > Conditional access modal, enable conditional access on additional policies. | No additional per-policy bypass checkbox appears next to the policies. |
| 3 | As an end user, fail multiple conditional access policies where at least one failing policy is marked `critical`. | The "My device" page offers no option to bypass conditional access. |
| 4 | Call the bypass endpoint while the host is still failing multiple policies and one failing policy is `critical`. | The API returns an error and does not grant bypass. |
| 5 | Re-test as an end user failing multiple conditional access policies where no failing policy is `critical`; on "My device", click an "Action required" policy. | A snooze option is available for the policy. |
| 6 | Snooze the policy, then complete sign-in. | Banner text updates to reflect the snooze, and the user is able to log in. |
| 7 | Refresh the "My device" page. | The "snoozed" banner text goes away. |
| 8 | Log out and attempt to log in a second time. | The user is blocked again (snooze is single-use, not persistent). |
| 9 | Keep a host snoozed for 24+ hours and re-check. | Snooze behavior remains correct after 24+ hours. |

### IDENTITY-023 — Migrate experimental per-policy bypass setting to `critical` and exclude it from GitOps

- **Tier:** Premium
- **Platforms:** macOS
- **Priority:** P1
- **Preconditions:** Premium instance being upgraded from a version that had Okta configured, global bypass enabled, and some conditional access policies with the experimental `conditional_access_bypass_enabled` flag set.
- **Source:** #36105, #40521

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Upgrade the instance and inspect the conditional access policies. | Each policy's `critical` setting is modified only when it meets the conditions in the upgrade migration rules (per the story's upgrading diagram); other policies are left unchanged. |
| 2 | Run `fleetctl generate-gitops`. | The deprecated `conditional_access_bypass_enabled` field is no longer included in the generated policy YAML. |
| 3 | Toggle the global "disable bypass" setting off (bypass disabled). | No option to configure per-policy bypass is shown, and the end user is offered no bypass option. |
| 4 | Verify migration from a version with no bypass feature and from a version with the first iteration of the bypass feature. | Both upgrade paths complete without error and produce the correct `critical`/bypass state. |
| 5 | Open the conditional access settings on a Fleet Free instance. | The conditional access / bypass feature does not appear on Fleet Free. |
