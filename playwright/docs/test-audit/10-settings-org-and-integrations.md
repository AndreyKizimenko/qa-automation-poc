# Settings — org, integrations, webhooks, secrets — test audit

**Specs covered:** 12 files · **Test declarations:** 15 (the logo spec's 2 are loop-generated, one per theme) · **Projects:** premium / free (the four shared specs run in both)

This area covers Fleet's **Settings** section: Organization info, Fleet Desktop, Advanced
options, the organization logo, a fleet's own settings page, enroll secrets, and the
Integrations subpages (MDM / EULA / end-user migration, SSO end-user authentication,
host-status alerts). Almost every spec here writes **instance-wide config** — org name,
SMTP domain, the org logo blob, global or fleet webhook settings, a team's enroll-secret
list — so each one snapshots the affected subtree through the API and restores it in
teardown (the logo spec restores in the test's own `finally`, not a hook — see SET-12).
The read-only exceptions (Fleet Desktop presence, end-user migration URL validation, the
fleet host-expiry derivation, the SSO form-gating case) mutate nothing.

> **Blast-radius warning for a manual re-run.** Doing these by hand means you *are* the
> teardown. Before touching anything, capture the current value (`GET /api/v1/fleet/config`,
> or `GET /api/v1/fleet/teams/<workstations_id>`) and put it back when you are done. The
> table in [Global-config mutation ledger](#global-config-mutation-ledger) lists exactly what
> each test writes and what breaks if you forget.

## Contents

| ID | Spec | Test | Mode | Manual? |
|---|---|---|---|---|
| SET-01 | `premium/settings/organization/organization-info.spec.ts` | Premium • Settings • Organization info › org name and support URL persist across reload | UI | ☐ |
| SET-02 | `free/settings/organization/organization-info.spec.ts` | Free • Settings • Organization info › org name and support URL persist across reload | UI | ☐ |
| SET-03 | `premium/settings/organization/fleet-desktop.spec.ts` | Premium • Settings • Fleet Desktop › the Fleet Desktop section shows the Custom transparency URL field | UI | ☐ |
| SET-04 | `shared/settings/organization/advanced-options.spec.ts` | Settings • advanced options › editing the SMTP fields saves them and leaves every other section untouched | UI+API | ☐ |
| SET-05 | `premium/settings/enroll-secrets.spec.ts` | Premium • Settings • enroll secrets › add, copy and delete an enroll secret on the Workstations fleet | UI+API | ☐ |
| SET-06 | `shared/settings/host-status-webhook.spec.ts` | Shared • Settings • Host status webhook › enabling the host status webhook with a URL, percentage and window persists | UI+API | ☐ |
| SET-07 | `premium/settings/team-host-status-webhook.spec.ts` | Premium • Settings • fleet host status webhook › a team admin enables their fleet host status webhook and it persists | UI+API | ☐ |
| SET-08 | `premium/settings/team-host-status-webhook.spec.ts` | Premium • Settings • fleet host status webhook › the fleet host expiry checkbox derives from the global and fleet settings | UI+API | ☐ |
| SET-09 | `premium/settings/integrations/mdm.spec.ts` | Premium • Settings • MDM end-user migration › the migration webhook URL is validated client-side | UI | ☐ |
| SET-10 | `premium/settings/integrations/automatic-enrollment.spec.ts` | Premium • Settings • Automatic enrollment — EULA › upload then delete a macOS EULA | UI+API | ☐ |
| SET-11 | `premium/settings/integrations/automatic-enrollment.spec.ts` | Premium • Settings • Automatic enrollment — end-user authentication (SSO) › IdP form renders and Save is gated on the required fields | UI | ☐ |
| SET-12 | `shared/settings/organization/custom-logo.spec.ts` | Settings • Organization logo › a light-mode logo replaces the default and removing it restores it | UI+API | ☐ |
| SET-13 | `shared/settings/organization/custom-logo.spec.ts` | … › a dark-mode logo replaces the default and removing it restores it | UI+API | ☐ |
| SET-14 | `shared/settings/enroll-secrets.spec.ts` | Settings • global enroll secrets › an admin adds, copies and deletes a global enroll secret, and the others stay | UI+API | ☐ |
| SET-15 | `premium/settings/fleets-lifecycle.spec.ts` | Premium • Settings • fleet lifecycle › an admin adds, renames and deletes a fleet | UI+API | ☐ |

---

### SET-01 · Premium • Settings • Organization info › org name and support URL persist across reload

- **File:** [`playwright/tests/e2e/premium/settings/organization/organization-info.spec.ts`](../../tests/e2e/premium/settings/organization/organization-info.spec.ts)
- **Grep:** `npx playwright test -g "Premium • Settings • Organization info › org name and support URL persist across reload"`
- **Project:** premium · **Scopes:** global (no team dropdown on this page)
- **Mode:** UI · **Isolation:** standalone test; `beforeEach` snapshot + `afterEach` restore
- **Preconditions:** admin session (`.auth/premium-admin.json`). `beforeEach` reads `GET /config` and stores `org_info` — [`helpers/api/config.ts`](../../helpers/api/config.ts) `getAppConfig`.
- **Data created / mutated:** **global** `org_info.org_name` → `PW Org <epoch-ms>` and `org_info.contact_url` → `https://example.com/pw-support`. `afterEach` PATCHes back **only** `org_name` and `contact_url` (`contact_url` falls back to `''` when the snapshot had none). Other `org_info` members (logo URLs) are never written.
  - ⚠️ If the restore is skipped, the instance is left named `PW Org <timestamp>`. That fails [`tests/api/gitops-verify/org-settings.spec.ts`](../../tests/api/gitops-verify/org-settings.spec.ts) (`org name matches gitops`) and shows a nonsense org name in the navbar/login page for everyone. [`tests/api/config.spec.ts`](../../tests/api/config.spec.ts) only checks the name is truthy, so it will **not** catch the drift.

**Flow**

1. ☐ Go to **Settings → Organization → Organization info** (via URL `/settings/organization/info`).
   - ✅ *(UI)* "Organization info" heading visible — `OrganizationInfoPage.goto()`.
   - ✅ *(UI)* **Organization name** textbox visible — same method.
2. ☐ Replace **Organization name** with `PW Org <timestamp>`.
3. ☐ Replace **Organization support URL** with `https://example.com/pw-support`.
4. ☐ Click **Save**.
   - ✅ *(UI)* Success toast `Successfully updated settings.` — asserted inside `OrganizationInfoPage.save()` via `Toast.expectSuccess`, which requires a `role="alert"` card carrying the `toast-notification__card--success` class.
5. ☐ Reload the page (`goto()` again — re-anchors on the heading + name field).
   - ✅ *(UI)* **Organization name** field value equals the submitted name.
   - ✅ *(UI)* **Organization support URL** field value equals the submitted URL.

**Assessment**
- *Value:* catches a broken save/round-trip on the most-used org settings card (form not persisting, or the GET not rehydrating the form).
- *Coverage gaps:* no assertion the saved value reaches `GET /config` (the restore hook proves the API works, but nothing asserts it); no validation cases (empty org name, malformed support URL); logo-URL fields untested; no check the new org name renders anywhere outside the form (navbar, login page, Fleet Desktop transparency).
- *Redundancy:* **byte-identical** to SET-02 apart from the describe title. Both are the same tier-agnostic form.
- *Efficiency / smells:* enters by direct URL rather than clicking through the navbar, which `playwright/CLAUDE.md` reserves for non-flow contexts. Uses a timestamped org name where a fixed marker would do — a leaked value is harder to spot as "the same test again".

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SET-02 · Free • Settings • Organization info › org name and support URL persist across reload

- **File:** [`playwright/tests/e2e/free/settings/organization/organization-info.spec.ts`](../../tests/e2e/free/settings/organization/organization-info.spec.ts)
- **Grep:** `npx playwright test -g "Free • Settings • Organization info › org name and support URL persist across reload"`
- **Project:** free · **Scopes:** global (free has no team dropdown)
- **Mode:** UI · **Isolation:** standalone test; `beforeEach` snapshot + `afterEach` restore
- **Preconditions:** admin session (`.auth/free-admin.json`); `beforeEach` snapshots `org_info` from `GET /config`.
- **Data created / mutated:** identical to SET-01, on the **free** instance's global config. Same restore, same failure mode if skipped.

**Flow** — identical to [SET-01](#set-01--premium--settings--organization-info--org-name-and-support-url-persist-across-reload); the same `OrganizationInfoPage` methods and the same two field-value assertions after reload. Nothing tier-specific is asserted (no license check, no absence of premium fields).

**Assessment**
- *Value:* proves the org-info save path is not premium-gated. That is the only thing it adds over SET-01.
- *Coverage gaps:* same as SET-01. It also doesn't assert what makes the free page *different* — no Fleet Desktop section (see SET-03), no Teams nav link (that one lives in [`tests/e2e/free/paywalls.spec.ts`](../../tests/e2e/free/paywalls.spec.ts)).
- *Redundancy:* duplicate of SET-01.
- *Efficiency / smells:* the spec's own header comment says "the form is tier-agnostic" — which is the argument for moving it to `tests/e2e/shared/settings/organization/` and deleting one of the two copies.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SET-03 · Premium • Settings • Fleet Desktop › the Fleet Desktop section shows the Custom transparency URL field

- **File:** [`playwright/tests/e2e/premium/settings/organization/fleet-desktop.spec.ts`](../../tests/e2e/premium/settings/organization/fleet-desktop.spec.ts)
- **Grep:** `npx playwright test -g "the Fleet Desktop section shows the Custom transparency URL field"`
- **Project:** premium · **Scopes:** global
- **Mode:** UI · **Isolation:** fully independent, read-only
- **Preconditions:** premium license (the card returns `null` on free). Admin session.
- **Data created:** none — no mutation at all.

**Flow**

1. ☐ Open `/settings/organization/fleet-desktop` (via URL — no POM, raw `page.goto`).
   - ✅ *(UI)* Heading **Fleet Desktop** visible.
   - ✅ *(UI)* Textbox **Custom transparency URL** visible.

**Assessment**
- *Value:* a license-gate smoke test — catches the premium Fleet Desktop card disappearing or the route 404ing.
- *Coverage gaps:* never sets or saves a transparency URL, so the actual feature (custom transparency link surfaced to end users in Fleet Desktop) is untested; no free-tier counterpart asserting the section is *absent* on free, even though the spec comment asserts that behaviour in prose.
- *Redundancy:* none.
- *Efficiency / smells:* the only spec in this area with no page object — `fleet-desktop.spec.ts:15-16` uses raw `page` locators while a sibling `OrganizationInfoPage` exists for the same Settings → Organization section. Either add a small `OrganizationFleetDesktopPage` or fold the two visibility assertions into a broader "org settings subnav renders" spec.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SET-04 · Settings • advanced options › editing the SMTP fields saves them and leaves every other section untouched

- **File:** [`playwright/tests/e2e/shared/settings/organization/advanced-options.spec.ts`](../../tests/e2e/shared/settings/organization/advanced-options.spec.ts)
- **Grep:** `npx playwright test -g "editing the SMTP fields saves them"`
- **Project:** premium **and** free (moved from `premium/settings/` in round 3 batch A: the card and every subtree it compares exist on free) · **Scopes:** global
- **Mode:** UI+API · **Isolation:** standalone; `beforeEach` snapshots `smtp_settings`, `afterEach` restores the three edited members (an `afterEach`, so a timed-out test still restores them)
- **Preconditions:** admin session. SMTP deliberately **unconfigured** on both QA instances — that is why the SMTP Domain, Verify SSL certs and Enable STARTTLS fields are safe to change. A full `GET /config` is captured as `before`.
- **Data created / mutated:** **global** `smtp_settings.domain` → `pw-advanced-<epoch-ms>.example.com`; `verify_ssl_certs` and `enable_start_tls` → the opposite of their current values (both default to on). The `afterEach` PATCHes all three back.
  - The card's Save is a **single bundled write**: Fleet's `performSave` posts `smtp_settings`, `features`, `host_expiry_settings`, `server_settings` and `activity_expiry_settings` together, whatever the user touched, **as they were loaded** when the page opened. So one click here can in principle rewrite all five — and can revert another session's change to `features` / `server_settings` made while the page was open.
  - ⚠️ If the restore is skipped the leftover is cosmetic (SMTP is off). The **real** blast radius is a Fleet-side formData bug: the test exists precisely because a bundled save could silently flip `features.enable_software_inventory` off (kills every software spec), rewrite `server_settings.server_url` (kills agent check-ins), or turn on `host_expiry_settings` (Fleet then **deletes the simulated hosts** the whole host batch depends on). The spec deliberately never edits host expiry itself — QA Wolf's flow left it on with a 1-day window — and does **not** PATCH whole snapshotted subtrees back: `/config` rejects them with 400 because they carry read-only members such as `smtp_settings.configured`.

**Flow**

1. ☐ `GET /config` and note the SMTP fields plus the other four subtrees.
2. ☐ Open **Settings → Organization → Advanced options** (via URL `/settings/organization/advanced`).
   - ✅ *(UI)* Heading **Host lifecycle** visible (the page has no title of its own; the first section is the anchor) — `OrganizationAdvancedPage.goto()`.
3. ☐ Set **Domain** to `pw-advanced-<timestamp>.example.com`, flip **Verify SSL certs** and **Enable STARTTLS** (Fleet's `Checkbox`, accessible names `verifySSLCerts` / `enableStartTLS`), click **Save**.
   - ✅ *(UI)* Success toast `Successfully updated settings.`
4. ☐ Reload `/settings/organization/advanced`.
   - ✅ *(UI)* **Domain** equals the marker; both checkboxes show their new state — the edits survive a reload.
5. ☐ Re-read `GET /config`.
   - ✅ *(API)* `smtp_settings.domain`, `verify_ssl_certs`, `enable_start_tls` hold the new values.
   - ✅ *(API)* The rest of `smtp_settings` equals its pre-save snapshot.
   - ✅ *(API)* `features`, `host_expiry_settings`, `server_settings`, `activity_expiry_settings` each `toEqual` their pre-save snapshot — compared as **whole subtrees** so a reset nested field can't slip through.
   - ✅ *(API)* Named re-assertions on the two the rest of the suite is most exposed to: `features.enable_software_inventory` and `server_settings.server_url` unchanged.
   - ✅ *(UI)* `page.url()` still contains `/settings/organization/advanced` (non-retrying string check).

**Assessment**
- *Value:* the highest-value test in this area, now on both tiers. It is the only guard against a bundled-save regression silently resetting instance settings that dozens of other specs assume. A failure here is a real Fleet bug, not a test to repair.
- *Coverage gaps:* host expiry window, activity retention, server URL and the Features switches are never edited — deliberately: expiry deletes simulated hosts, and the Features switches (Live reports, Script execution, Generative AI) and Store report results are what other specs stand on. Nothing asserts SMTP validation or the "test connection" path. `sso_settings` and `agent_options` are not in `OWNED_SUBTREES`, so if the bundled save ever grew to include them the guard would not notice.
- *Redundancy:* `features.enable_software_inventory` / `server_settings.server_url` are also asserted by [`tests/api/gitops-verify/org-settings.spec.ts`](../../tests/api/gitops-verify/org-settings.spec.ts) and [`tests/api/config.spec.ts`](../../tests/api/config.spec.ts), but there as static drift checks — not as "survives an unrelated save", so this is complementary, not duplicate.
- *Efficiency / smells:*
  - `expect(page.url()).toContain(...)` is a non-web-first assertion with no retry, and adds nothing after `goto()` already anchored on the heading.
  - The subtree comparison is snapshot-vs-snapshot across a window in which other workers are live (`fullyParallel: true`). Nothing else in the main project writes these five subtrees today, so it holds; a spec that does belongs in `exclusive/`.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SET-05 · Premium • Settings • enroll secrets › add, copy and delete an enroll secret on the Workstations fleet

- **File:** [`playwright/tests/e2e/premium/settings/enroll-secrets.spec.ts`](../../tests/e2e/premium/settings/enroll-secrets.spec.ts)
- **Grep:** `npx playwright test -g "add, copy and delete an enroll secret on the Workstations fleet"`
- **Project:** premium · **Scopes:** Workstations (the gitops-provisioned fleet)
- **Mode:** UI+API · **Isolation:** standalone; `beforeEach` snapshot + `afterEach` restore; the context has clipboard permissions
- **Preconditions:** `workstationsFleetId` worker fixture. `beforeEach` reads `GET /fleets/<id>/secrets` and stores the full list (`getTeamEnrollSecrets`).
- **Data created / mutated:** one **new enroll secret** on the Workstations fleet (Fleet's generated value, kept), deleted again by the test. `afterEach` calls `setTeamEnrollSecrets` with the snapshot — a PATCH that **replaces the whole list**. Safe for this fleet: nothing enrolls with Workstations' secrets. The global list never gets this treatment (SET-14).

**Flow**

1. ☐ Open the **Manage enroll secrets** modal for Workstations by deep link (`/hosts/manage?fleet_id=<id>&manage_enroll_secrets=1`) — `EnrollSecretModal.goto`.
   - ✅ *(UI)* The modal lists as many secrets as the API returned (`expectLoaded`) — the modal shows an empty state for a moment before its list arrives, and Fleet saves its cached list plus one.
2. ☐ Click **Add secret**, keep the generated value, **Save** — `addGenerated`.
   - ✅ *(UI)* Success toast `Successfully added enroll secret.`
   - ✅ *(API)* The fleet's list is one longer and contains the value from the field.
3. ☐ Click the new secret's row **Copy to clipboard** (row found by its value).
   - ✅ *(UI)* The row shows `Copied!`.
   - ✅ *(UI)* The clipboard holds that value.
4. ☐ Click the row's **Delete enroll secret**, confirm **Delete** in "Delete secret" (*Hosts can no longer enroll using this secret.*).
   - ✅ *(UI)* Success toast `Successfully deleted enroll secret.`; the row is gone.
   - ✅ *(API)* The fleet's list equals the snapshot again.

**Assessment**
- *Value:* the fleet-scoped add / copy / delete round trip, with the generated value followed from field to clipboard to server — a regression that saved or copied a *different* string than the one shown would be caught.
- *Coverage gaps:* no edit/rotate, no `<32 characters` validation, no duplicate-secret rejection; nothing checks the secret actually enrolls a host. The add is still proven through the API, not by re-reading the modal's list (the copy step does find the row, which comes close).
- *Redundancy:* the same modal and actions as SET-14 at fleet scope; SET-14 covers the global list on both tiers.
- *Efficiency / smells:* filed under `settings/` but the flow lives on the **Hosts** page; reaches the modal by deep link, so the entry point is SET-14's (the gear menu).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SET-06 · Shared • Settings • Host status webhook › enabling the host status webhook with a URL, percentage and window persists

- **File:** [`playwright/tests/e2e/shared/settings/host-status-webhook.spec.ts`](../../tests/e2e/shared/settings/host-status-webhook.spec.ts)
- **Grep:** `npx playwright test -g "enabling the host status webhook with a URL, percentage and window persists"`
- **Project:** premium **and** free (tier-agnostic, lives under `shared/`) · **Scopes:** global
- **Mode:** UI+API · **Isolation:** standalone; `beforeEach` snapshot + `afterEach` restore
- **Preconditions:** admin session. `beforeEach` stores `webhook_settings.host_status_webhook` from `GET /config`.
- **Data created / mutated:** **global** `webhook_settings.host_status_webhook` → `{ enable_host_status_webhook: true, destination_url: 'https://example.com/host-status-webhook', host_percentage: 5, days_count: 3 }`. `afterEach` PATCHes the snapshot back (or `{}` if there was none).
  - `PATCH /config` merges *within* `webhook_settings` — verified and documented in [`tests/e2e/premium/dashboard/automations-activity.spec.ts`](../../tests/e2e/premium/dashboard/automations-activity.spec.ts). That is what makes this safe to run in parallel with the three sibling specs that write other keys of the same subtree (`vulnerabilities_webhook`, `failing_policies_webhook`, `activities_webhook`).
  - ⚠️ If the restore is skipped, the instance keeps firing host-status webhooks at `example.com` and the enabled state leaks into any later test that reads this subtree. Note the restore sends `{}` when nothing was configured, which relies on Fleet treating an empty object as "leave defaults" — worth eyeballing by hand once.

**Flow**

1. ☐ Open **Settings → Integrations → Host status alerts** (via URL `/settings/integrations/host-status-webhook`).
   - ✅ *(UI)* Heading **Host status alerts** visible — `IntegrationsPage.gotoHostStatusWebhook()`.
2. ☐ Tick the enable checkbox — `setHostStatusWebhookEnabled(true)` reads `aria-checked` first so it is idempotent whatever the instance's starting state.
   - ✅ *(UI)* The checkbox reports `aria-checked="true"`.
3. ☐ Fill **Destination URL** with `https://example.com/host-status-webhook`.
4. ☐ Pick **Percentage of hosts** → `5%` and **Number of days** → `3 days` (both default to 1; react-select v1 menus, rendered only while the webhook is enabled) — `selectHostStatusOption`.
   - ✅ *(UI)* Each dropdown shows the picked value.
5. ☐ Click **Save** — `saveHostStatusWebhook()`.
   - ✅ *(UI)* Success toast `Successfully updated settings.`
6. ☐ Reload the page.
   - ✅ *(UI)* The checkbox is ticked, the URL, `5%` and `3 days` are shown — the page rehydrates what was saved.
7. ☐ Re-read `GET /config`.
   - ✅ *(API)* `webhook_settings.host_status_webhook` matches `{ enable_host_status_webhook: true, destination_url: <URL>, host_percentage: 5, days_count: 3 }`.

**Assessment**
- *Value:* covers the global host-status alert save path on both tiers, plus the idempotent-toggle helper.
- *Coverage gaps:* no validation case (empty or malformed destination URL); no disable-round-trip (turn it off and confirm it clears); nothing asserts the webhook actually fires.
- *Redundancy:* same feature as SET-07 at global scope. The two are complementary (global vs fleet, admin vs team admin), but the *assertions* are near-identical, so any change should be made to both.
- *Efficiency / smells:* `hostStatusSaveButton` is `getByRole('button', { name: 'Save', exact: true })` page-wide rather than scoped to the card — fine while the page has one Save, fragile if a second card lands on it. `hostStatusWebhookToggle` matches on the React `name` prop (`enableHostStatusWebhook`), documented in the POM.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SET-07 · Premium • Settings • fleet host status webhook › a team admin enables their fleet host status webhook and it persists

- **File:** [`playwright/tests/e2e/premium/settings/team-host-status-webhook.spec.ts`](../../tests/e2e/premium/settings/team-host-status-webhook.spec.ts)
- **Grep:** `npx playwright test -g "a team admin enables their fleet host status webhook and it persists"`
- **Project:** premium · **Scopes:** Workstations fleet
- **Mode:** UI+API · **Isolation:** standalone, but shares the Workstations fleet with SET-08, which runs in parallel. Snapshot/restore lives **inside the test body** (`try/finally`) precisely so a describe-level hook can't roll this test back mid-flight.
- **Preconditions:** `workstationsFleetId` worker fixture. The pre-provisioned **`team-admin@fleetdm.com`** static user (admin of Workstations *and* VMs) — pulled via `withStaticUser(browser, 'team-admin', …)` from [`helpers/auth.ts`](../../helpers/auth.ts), which reuses a cached storage state and silently re-logs-in with `FLEET_STATIC_USER_PASSWORD` if the session bounced to `/login`. The password lives in 1Password; never mint a replacement.
- **Data created / mutated:** the Workstations fleet's **entire `webhook_settings` subtree**, snapshotted with `getFleetWebhookSettings` and written back verbatim with `setFleetWebhookSettings` ([`helpers/api/fleets.ts`](../../helpers/api/fleets.ts)). Whole-subtree handling is required because `PATCH /teams/:id` **replaces** `webhook_settings` wholesale.
  - ⚠️ If the restore is skipped, Workstations loses its gitops-provisioned **failing-policies webhook (with its policy ids)** — because the UI save posts only the host-status key and Fleet drops the rest. That silently disables policy automations for the fleet and drifts from gitops.

**Flow**

1. ☐ Snapshot the fleet's `webhook_settings` via `GET /teams/<id>`.
2. ☐ Sign in as the **team admin** in a separate browser context (cached session, or a fresh login).
3. ☐ Open the fleet's settings page (via URL `/settings/fleets/settings?fleet_id=<id>`).
   - ✅ *(UI)* Heading **Webhook settings** visible — `TeamSettingsPage.goto()`.
4. ☐ Tick **Enable host status webhook** — `setHostStatusWebhookEnabled(true)`, idempotent via `aria-checked`.
   - ✅ *(UI)* The checkbox reports `aria-checked="true"`.
5. ☐ Fill the destination URL field (targeted by its placeholder `https://server.com/example`, which survives the label being swapped for an error message) with `https://example.com/fleet-team-host-status`. The field only renders once the webhook is enabled.
6. ☐ Click **Save**.
   - ✅ *(UI)* Success toast `Successfully updated settings.`
7. ☐ Reload the fleet settings page.
   - ✅ *(UI)* The checkbox still reports `aria-checked="true"`.
   - ✅ *(UI)* The destination-URL field still holds the URL.
8. ☐ Re-read `GET /teams/<id>` as the admin API user.
   - ✅ *(API)* `webhook_settings.host_status_webhook.enable_host_status_webhook === true`.
   - ✅ *(API)* `…destination_url` equals the URL.
9. ☐ Restore the snapshotted `webhook_settings`.

**Assessment**
- *Value:* the strongest webhook test here — it covers a *role* (team admin, not global admin) on a *fleet-scoped* setting, reloads to prove rehydration, and independently confirms the server state. It is also the only test in this area that exercises a non-admin persona.
- *Coverage gaps:* doesn't check the negative role case (a Workstations *maintainer* or *observer* should not be able to save); doesn't disable-and-clear; the destination URL's client-side validation is untested; nothing asserts the fleet webhook fires independently of the global one, which is the whole point of the feature.
- *Redundancy:* asserts the same three things as SET-06 at a different scope. Keep both, but treat them as one pair.
- *Efficiency / smells:*
  - `try/finally` restore rather than an `afterEach` — reasoned in the header comment (the sibling read-only test shares the fleet), but a nested `test.describe` with its own hook would give the same isolation *and* the sturdier restore. Worth revisiting.
  - `TeamSettingsPage.save()` does not wait for its toast (unlike `OrganizationInfoPage.save()`), so the toast assertion is the spec's job — an inconsistency between two POMs in the same folder.
  - `destinationUrlInput` is matched by placeholder; the reason is documented, but it means a placeholder copy change breaks the test.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SET-08 · Premium • Settings • fleet host status webhook › the fleet host expiry checkbox derives from the global and fleet settings

- **File:** [`playwright/tests/e2e/premium/settings/team-host-status-webhook.spec.ts`](../../tests/e2e/premium/settings/team-host-status-webhook.spec.ts)
- **Grep:** `npx playwright test -g "the fleet host expiry checkbox derives from the global and fleet settings"`
- **Project:** premium · **Scopes:** Workstations fleet
- **Mode:** UI+API · **Isolation:** read-only; runs in parallel with SET-07 on the same fleet (safe — different setting)
- **Preconditions:** `workstationsFleetId`; the `team-admin` static user; `GET /config` for global `host_expiry_settings` and `GET /teams/<id>` for the fleet's.
- **Data created:** none.
  - Context: fleet-level host expiry **stacks** on the global setting — Fleet ticks the fleet checkbox when either is on, and **locks** it while the global one is on (a fleet can add a window on top, never opt out). The QA instances keep global host expiry **off** (gitops `default.yml`) and the suite deliberately never turns it on: a live expiry window makes Fleet delete the osquery-perf simulated hosts the rest of the suite depends on.

**Flow**

1. ☐ Read global `host_expiry_settings.host_expiry_enabled` via `GET /config`, and the fleet's via `GET /teams/<id>`.
2. ☐ Sign in as the **team admin**; open `/settings/fleets/settings?fleet_id=<id>`.
   - ✅ *(UI)* Heading **Webhook settings** visible.
3. ☐ Inspect the **Enable host expiry** checkbox.
   - ✅ *(UI)* `aria-checked` equals `String(fleetEnabled || globalEnabled)`.
   - ✅ *(UI)* `aria-disabled` equals `String(globalEnabled)`.
   - ✅ *(UI)* Help text "Host expiry is globally enabled in organization settings…" is visible **iff** the global setting is on, otherwise it has count 0.
4. ☐ Hover the **Enable host expiry** label (the tooltip hangs off the label, not the checkbox).
   - ✅ *(UI)* A `role="tooltip"` containing "allows automatic cleanup of" appears.

**Assessment**
- *Value:* documents and pins a genuinely confusing product rule (stacking + lock). The tooltip assertion is the only real unconditional check.
- *Coverage gaps:* because global expiry is off on both QA instances and the suite will never enable it, the interesting half of this test — checkbox ticked-and-locked, help text visible — **never executes**. In practice the test asserts "unchecked, enabled, tooltip present". Verifying the lock is a manual-only job (or needs a throwaway fleet on a throwaway instance).
- *Redundancy:* none.
- *Efficiency / smells:*
  - The `if (globalEnabled) … else …` branch at `team-host-status-webhook.spec.ts:106-110` is a silently-passing branch of exactly the kind `tests/README.md` warns about — one arm is dead on every environment the suite runs against.
  - Expectations are computed from the API rather than asserted against a fixed value, so the test can only catch "UI disagrees with config", never "config is wrong". That's the right call for a shared instance, but it means the assertion strength depends entirely on instance state.
  - Signs in as the team admin for a pure read; a global-admin page load would prove the same rendering rule and skip the extra login. The role coverage is only meaningful if the negative case (no save permission) is also asserted.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SET-09 · Premium • Settings • MDM end-user migration › the migration webhook URL is validated client-side

- **File:** [`playwright/tests/e2e/premium/settings/integrations/mdm.spec.ts`](../../tests/e2e/premium/settings/integrations/mdm.spec.ts)
- **Grep:** `npx playwright test -g "the migration webhook URL is validated client-side"`
- **Project:** premium · **Scopes:** global
- **Mode:** UI · **Isolation:** fully independent; nothing is saved, so nothing is mutated
- **Preconditions:** **Apple Business Manager must be configured on the instance** — the End-user-migration section renders `null` otherwise, so the test hard-fails rather than skips. ABM is *not* provisioned by the suite: the ABM token is set up out of band (`FLEET_ABM_ORG_NAME` in `.env.premium.example` is read only by a local `fleetctl gitops` apply, never by the suite). An expired ABM token — they expire annually — turns this into an opaque "locator not found".
- **Data created:** none. The workflow toggle is client-side state only and Save is never clicked.

**Flow**

1. ☐ Open **Settings → Integrations → MDM** (via URL `/settings/integrations/mdm`).
   - ✅ *(UI)* Heading **End user migration workflow** visible inside the `.end-user-migration-section` card.
2. ☐ Turn the workflow switch on if it isn't already (read `aria-checked`, click if needed — never saved).
   - ✅ *(UI)* The switch reports `aria-checked="true"`.
3. ☐ Type `not a url` into **Webhook URL**.
   - ✅ *(UI)* Inline error **Must be a valid URL.** is visible.
4. ☐ Replace it with `https://example.com/pw-migration`.
   - ✅ *(UI)* The **Must be a valid URL.** error is gone (count 0).

**Assessment**
- *Value:* the only client-side-validation test in this area; catches the URL validator being dropped from the migration form.
- *Coverage gaps:* the workflow is never actually saved, so persistence, the `PATCH /config` path, and the "mode" radio (voluntary vs forced) are untested; no assertion that Save is disabled while the URL is invalid — arguably the more user-visible consequence than the inline message.
- *Redundancy:* none. Free's counterpart is the paywall row `Settings — Integrations / MDM (ABM + Microsoft Entra cards)` in [`tests/e2e/free/paywalls.spec.ts`](../../tests/e2e/free/paywalls.spec.ts), which asserts two premium banners on the same URL.
- *Efficiency / smells:* the worst POM hygiene in this area — the spec drives raw locators inline, which `tests/README.md` lists as an anti-pattern: `.end-user-migration-section` (`mdm.spec.ts:16`), an unnamed `getByRole('switch')` (`:20`), and `input[name="webhook_url"]` (`:26`). All three belong on `IntegrationsPage`, which already owns the MDM subpage. Also note this spec bypasses `integrationsPage.gotoMdm()` and so does not inherit its ABM-configured anchor.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SET-10 · Premium • Settings • Automatic enrollment — EULA › upload then delete a macOS EULA

- **File:** [`playwright/tests/e2e/premium/settings/integrations/automatic-enrollment.spec.ts`](../../tests/e2e/premium/settings/integrations/automatic-enrollment.spec.ts)
- **Grep:** `npx playwright test -g "upload then delete a macOS EULA"`
- **Project:** premium · **Scopes:** global (the EULA is a single global entity — no fleet scoping)
- **Mode:** UI+API · **Isolation:** standalone; removes any pre-existing EULA as a precondition **and** in `afterEach`
- **Preconditions:** **Apple Business Manager configured** — `IntegrationsPage.gotoMdm()` anchors on the "End user license agreement (EULA)" heading, which only renders when ABM is set up. Not provisioned by the suite (see SET-09). Also: `cleanup.steps.ts` does **not** wipe the EULA, which is why the test does its own pre-clean via `deleteEulaIfPresent` ([`helpers/api/mdm.ts`](../../helpers/api/mdm.ts)).
- **Data created / mutated:** a global EULA named `pw-eula.pdf`, generated in memory as an 8-line `%PDF-1.7…%%EOF` buffer (Fleet validates only the `%PDF` magic prefix, so no multi-MB fixture is committed; the real limit is 26.21 MB). Deleted by the test body *and* by `afterEach`.
  - ⚠️ If cleanup is skipped, a fake EULA is shown to **every real end user** going through Apple automatic enrollment on that instance, and a later run of this test starts from a dirty state (mitigated by the pre-clean, not by cleanup-setup).

**Flow**

1. ☐ Delete any existing EULA via the API (`GET /setup_experience/eula/metadata` → `DELETE /setup_experience/eula/<token>`; 404 treated as success).
2. ☐ Open **Settings → Integrations → MDM** (via URL).
   - ✅ *(UI)* Heading **End user license agreement (EULA)** visible — `gotoMdm()`.
3. ☐ Choose the PDF in the EULA uploader (auto-submits on file selection) — `uploadEula` → `FileUploader.setFile`.
   - ✅ *(UI)* The uploaded-EULA list item is visible (asserted inside `uploadEula`).
   - ✅ *(UI)* The list item's name reads exactly `pw-eula.pdf`.
   - ✅ *(API)* `GET /setup_experience/eula/metadata` returns `name === 'pw-eula.pdf'`.
4. ☐ Click the trash icon on the EULA row → confirm in the **Delete EULA** modal — `deleteEula()`.
   - ✅ *(UI)* The **Delete EULA** modal is visible before confirming.
   - ✅ *(UI)* The EULA list item is hidden afterwards.
   - ✅ *(API)* `GET /setup_experience/eula/metadata` returns null (404).

**Assessment**
- *Value:* solid, self-contained CRUD-in-one-test with matched UI and API assertions on both create and delete. Catches the EULA upload endpoint, the list rendering, and the delete confirmation flow.
- *Coverage gaps:* no negative upload (non-PDF rejection, oversize rejection); no "view/open EULA" click (the sibling non-trash button on the row is never exercised); no assertion the EULA actually appears in the end-user enrolment experience; no replace-in-place case (upload while one already exists).
- *Redundancy:* none.
- *Efficiency / smells:* three justified BEM-class locators (`.eula-list-item`, `…__list-item-name`, `…__list-item-button`) plus a `[data-testid="trash-icon"]` filter and a `.modal__modal_container` filter — all documented in `IntegrationsPage`, but it means five separate coupling points to Fleet's markup for one small flow. The pre-clean is duplicated with `afterEach` (deliberate belt-and-braces, cheap).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SET-11 · Premium • Settings • Automatic enrollment — end-user authentication (SSO) › IdP form renders and Save is gated on the required fields

- **File:** [`playwright/tests/e2e/premium/settings/integrations/automatic-enrollment.spec.ts`](../../tests/e2e/premium/settings/integrations/automatic-enrollment.spec.ts)
- **Grep:** `npx playwright test -g "IdP form renders and Save is gated on the required fields"`
- **Project:** premium · **Scopes:** global
- **Mode:** UI · **Isolation:** fully independent; the form is filled but **never saved**, so no global config is mutated
- **Preconditions:** premium license (the end-user-auth section is premium-gated). Admin SSO / EUA are assumed pre-configured on the instance; the suite does not provision them (`FLEET_EUA_METADATA_URL` is read only by a local gitops apply).
- **Data created:** none.

**Flow**

1. ☐ Open **Settings → Integrations → SSO → End users** (via URL `/settings/integrations/sso/end-users`).
   - ✅ *(UI)* The `.end-user-auth-section` card is visible — `gotoSsoEndUsers()`.
2. ☐ Check the four form fields, all scoped to that card (the sibling **Fleet users** tab reuses the same labels).
   - ✅ *(UI)* **Identity provider name** visible.
   - ✅ *(UI)* **Entity ID** visible.
   - ✅ *(UI)* **Metadata URL** visible.
   - ✅ *(UI)* **Metadata** visible.
3. ☐ Fill **Identity provider name** = `pw-idp`, **Entity ID** = `pw-entity-id`, **Metadata URL** = `https://idp.example.com/metadata.xml` — `fillEndUserAuth()`.
   - ✅ *(UI)* The card's **Save** button is **enabled**.
4. ☐ Clear **Identity provider name**.
   - ✅ *(UI)* **Save** is **disabled** again.

**Flagged:** deliberately never saves, so this is a form-gating test, not an SSO test. Nothing here proves end-user authentication works.

**Assessment**
- *Value:* catches the required-field gating on the end-user IdP form and the four fields going missing / being mislabelled.
- *Coverage gaps:* only one required field is toggled — nothing checks **Entity ID** or the Metadata-URL-**or**-Metadata either/or rule (arguably the interesting validation); no invalid-metadata-URL case; the save path and the resulting `sso_settings` write are untested (and would need a snapshot/restore if added); the sibling **Fleet users** tab is untested here.
- *Redundancy:* `sso_settings.enable_sso` / `entity_id` / `idp_name` are drift-checked by [`tests/api/gitops-verify/org-settings.spec.ts`](../../tests/api/gitops-verify/org-settings.spec.ts), and admin-SSO login is covered by the `shared/auth` specs — neither overlaps this form.
- *Efficiency / smells:* lives in a file named `automatic-enrollment.spec.ts` but targets `/settings/integrations/sso/end-users`; the header comment explains the legacy naming, yet the file now holds two unrelated describes (EULA + SSO) sharing nothing. Splitting them would make grep and failure attribution clearer. `metadataField` relies on `{ exact: true }` to avoid cross-matching **Metadata URL** — correct, but brittle to a label reword.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SET-12 · Settings • Organization logo › a light-mode logo replaces the default and removing it restores it

- **File:** [`playwright/tests/e2e/shared/settings/organization/custom-logo.spec.ts`](../../tests/e2e/shared/settings/organization/custom-logo.spec.ts)
- **Grep:** `npx playwright test -g "a light-mode logo replaces the default and removing it restores it"`
- **Projects:** premium **and** free (a `shared/` spec — it runs once per tier). `OrgSettingsPage/cards/Info` has no tier gate, and the logo is the one piece of branding a free instance can change; QA Wolf only ever ran this on premium, so free's half is net-new. · **Scopes:** global
- **Mode:** UI+API · **Isolation:** **serial describe**, case 1 of 2 (light, then dark — SET-13). The two logos are independent settings but they share one **Save**, which also PATCHes `org_info`, so running the themes concurrently would have them writing the same config document at once. `test.setTimeout(90_000)`.
- **Preconditions:** admin session. `getOrgLogoUrls` is read first and the test **skips if a light-mode logo is already configured** — an upload overwrites the stored blob for that mode and only the *URL* can be restored afterwards. Fixture: [`test-data/shared/images/fleet-test-logo.png`](../../test-data/shared/images/fleet-test-logo.png) — 256×256, 567 B, generated by `make-icons.py` (the org logo shares the software-icon 100 KB cap, from Fleet's `utilities/file/orgLogoFile.ts`).
- **Data created / mutated:** **global** `org_info.org_logo_url_light_mode` **and** its deprecated alias `org_logo_url_light_background`. Also the viewer's account **theme**, which is client-side only (a `dark-mode` class plus a localStorage entry — see [`shared/account/theme.spec.ts`](../../tests/e2e/shared/account/theme.spec.ts)) and so lives and dies in this test's own browser context.
  - **Restored inside the test, in a `finally` — never in a hook.** A sibling spec's `afterEach` restore has rolled a mutating test back mid-flight before; `finally` runs in this test's own lifetime.
  - `restoreOrgLogo(request, 'light', before.light)` restores **one mode only, on purpose** — restoring both would have this case rolling back whatever SET-13 is doing.
  - ⚠️ A `PATCH /config` that merely empties one URL field is **not** a restore: it leaves the deprecated alias pointing at the old blob. `DELETE /logo?mode=light` is the only call that clears both fields and drops the blob from the object store, and it is what `restoreOrgLogo` issues when the snapshot was empty.
  - ⚠️ If the restore is skipped, every user of that instance — and the login page — is branded with the Playwright test logo until somebody clears it by hand.
- **Cross-link:** dark-mode sibling = **SET-13**

**Flow**

1. ☐ (No user action) Read `GET /config` → `org_info`'s logo URLs for **both** modes (`getOrgLogoUrls`, which folds each mode-aware field together with its deprecated alias).
   - ✅ *(API)* If the light URL is non-empty the test skips.
2. ☐ Go to **Settings → Organization → Organization info** (via URL `/settings/organization/info`).
   - ✅ *(UI)* "Organization info" heading + **Organization name** textbox visible — `OrganizationInfoPage.goto()`.
3. ☐ (No user action) Read the **light mode** logo card's starting state.
   - ✅ *(UI)* Its preview `<img>` (accessible name `Organization Logo`) carries the `default-fleet-logo` class — Fleet marks the built-in avatar with it, which is how "no custom logo" is read **without a screenshot**. The card itself is found by its BEM class filtered on the label text `Organization logo (light mode)`, the only thing telling the two cards apart.
   - ✅ *(UI)* That card's **Remove logo** (trash) button is **disabled** — nothing to remove yet.
4. ☐ Choose `fleet-test-logo.png` in the light card's uploader. A person clicks the pencil **Replace logo** button; the POM feeds the hidden `input.org-info__hidden-file-input` directly.
   - ✅ *(UI)* **Remove logo** becomes **enabled** (inside `setLogo()`). At this point the file is only *staged* — the preview has swapped to a local blob URL and nothing has reached Fleet.
5. ☐ Click **Save**.
   - ✅ *(UI)* Success toast `Successfully updated settings.` — asserted inside `save()` via `Toast.expectSuccess`.
6. ☐ Re-open the page (a real navigation, not a trust of the staged preview — until Save lands the card looks identical either way).
   - ✅ *(API)* `org_info`'s light URL now matches `/logo?mode=` — Fleet's own serving URL.
   - ✅ *(UI)* The light preview **no longer** carries `default-fleet-logo`.
   - ✅ *(UI)* The light preview's `src` equals that serving URL exactly. Unlike a screenshot, this says *which* half broke: a wrong `src` means the wrong logo was served, a right `src` on a default-classed image means it wasn't picked up.
   - ✅ *(API)* The **dark** mode URL is byte-identical to the snapshot — Fleet stores the two logos separately and one Save must not disturb the other.
7. ☐ Open `/account` and pick the **Light** theme in the side-panel Theme picker (`MyAccountPage.selectTheme()`; Fleet's `Radio` hides the real input, so the `<label for=…>` is what's clicked).
   - ✅ *(UI)* The `Light` radio is checked (inside `selectTheme()`).
   - ✅ *(UI)* `<body>` does **not** carry the `dark-mode` class.
8. ☐ (No user action) Read the top nav.
   - ✅ *(UI)* The navbar's org-logo `<img>` `src` equals the uploaded serving URL.
   - ✅ *(UI)* It does **not** carry `default-fleet-logo`. This is the point of the whole upload: the nav serves the logo matching the *viewer's* theme.
9. ☐ Re-open Organization info, click the light card's **Remove logo**, click **Save**.
   - ✅ *(UI)* **Remove logo** goes **disabled** the moment it is clicked (inside `removeLogo()`) — the removal is staged the same way the upload was.
   - ✅ *(UI)* Success toast `Successfully updated settings.`
10. ☐ Re-open the page.
    - ✅ *(API)* The light URL is `''`.
    - ✅ *(UI)* The light preview carries `default-fleet-logo` again.
    - ✅ *(UI)* **Remove logo** is disabled again.
    - ✅ *(UI)* The **navbar** logo carries `default-fleet-logo` — the removal propagates to the nav, not just the card.
11. ☐ (`finally`) Restore: `DELETE /logo?mode=light` when the snapshot was empty, or `PATCH /config` writing the recorded URL back to **both** `org_logo_url_light_mode` and `org_logo_url_light_background`.

**Assessment**
- *Value:* the only coverage of Fleet's organization branding anywhere in the suite, and one of the few specs that proves a settings write re-renders a **global chrome element** (the navbar) rather than just its own form. Asserting the `default-fleet-logo` class and the `src` rather than taking a screenshot is what makes a failure diagnosable. The "other mode is untouched" assertion pins a real product behaviour (two independent logos behind one Save).
- *Coverage gaps:* no rejection cases at all — `fleet-test-icon-oversize.png` (>100 KB), `-not-square`, `-too-large`, `-too-small` all sit in [`test-data/shared/images/`](../../test-data/shared/images/README.md) and this spec uses **none** of them (the software custom-icons spec does), so the org-logo validation boundary is untested; no replace-in-place (uploading over an existing logo), which is also why the spec has to skip where one is configured; the pencil **Replace logo** button is modelled (`replaceLogoButton`) but **never clicked** — the file goes straight to the hidden input, so the affordance a person actually uses is unexercised; the theme dimension is only ever checked in the *matching* direction, so nothing proves a light-mode logo is **not** served to a dark-mode viewer; no Cancel/discard of a staged logo; and the **login page**, where an org logo is most visible, is never looked at.
- *Redundancy:* none. The image-fixture machinery is shared with [`premium/software/custom-icons.spec.ts`](../../tests/e2e/premium/software/custom-icons.spec.ts), but the flow is not.
- *Efficiency / smells:*
  - Three class-based coupling points to Fleet's markup — `.org-info__logo-card` filtered on label text, `input.org-info__hidden-file-input`, and the `default-fleet-logo` class — all documented in the POM (Fleet gives the card label no role), but the whole case rests on them.
  - Four page loads and two full form Saves for one logo; the serial describe doubles that for the pair.
  - `new MyAccountPage(page)` is built in the spec body, but there is **no** `myAccount` fixture and every other account spec does the same — house pattern, not a smell.
  - The skip at step 1 means that on an instance where somebody has set a real logo, this test quietly stops running and nobody is told. A row in `TODO.md` or a louder annotation would make that visible.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SET-13 · Settings • Organization logo › a dark-mode logo replaces the default and removing it restores it

- **File:** [`playwright/tests/e2e/shared/settings/organization/custom-logo.spec.ts`](../../tests/e2e/shared/settings/organization/custom-logo.spec.ts)
- **Grep:** `npx playwright test -g "a dark-mode logo replaces the default and removing it restores it"`
- **Projects:** premium **and** free · **Scopes:** global
- **Mode:** UI+API · **Isolation:** **serial describe**, case 2 of 2 — it shares no state with SET-12, but a failure in SET-12 **skips** this case, and the serial mode is load-bearing: both cases write the same `org_info` document through the same Save.
- **Preconditions:** as SET-12, except the skip gate reads the **dark** URL.
- **Data created / mutated:** **global** `org_info.org_logo_url_dark_mode` **and** its deprecated alias `org_logo_url` (note: the dark mode's alias is the bare, un-suffixed field). Restored in the test's own `finally` via `restoreOrgLogo(request, 'dark', …)`, which restores that mode and nothing else.
- **Cross-link:** light-mode sibling = **SET-12**

**Flow** — the same eleven steps as [SET-12](#set-12--settings--organization-logo--a-light-mode-logo-replaces-the-default-and-removing-it-restores-it), driven by the same `OrganizationInfoPage` methods with `mode = 'dark'`. What differs:

- Step 1's skip gate reads the **dark** URL; step 6's "other mode is untouched" assertion checks the **light** URL.
- Steps 3, 4, 6, 9 and 10 act on the card labelled **Organization logo (dark mode)**.
- Step 7 picks the **Dark** theme, and the assertion flips: `<body>` **must** carry the `dark-mode` class.
- Step 11 restores `org_logo_url_dark_mode` + `org_logo_url`.

**Assessment**
- *Value:* the theme axis is the reason this is a dimension rather than a second file — it is the only place the suite proves the nav picks the logo matching the *viewer's* theme rather than a single stored image. Against SET-12, this case's unique content is the dark card, the dark alias field, and the `dark-mode` body class.
- *Coverage gaps:* as SET-12, plus: the interesting cross-case — a **dark** logo configured while the viewer is on **Light** (and vice versa) — is never set up, because each case removes its logo before the next begins. The **System** theme option is never exercised on either case, so which logo Fleet serves when the theme follows the OS is unknown.
- *Redundancy:* **high by construction** — the flow is the same eleven steps with three substitutions, which is exactly what the loop is for. Documented as a delta here for the same reason SET-02 is a delta of SET-01.
- *Efficiency / smells:* the serial describe makes the pair strictly sequential, so the two ~90 s cases cannot be split across workers; that is the correct trade for a shared config document, but it makes this file the slowest in the area.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

## Global-config mutation ledger

The reference table for a manual pass. "Restored?" describes what the automation does — when
*you* run the step by hand, you are the restore.

| ID | What it writes | Snapshot | Restore mechanism | If the restore is skipped |
|---|---|---|---|---|
| SET-01 | global `org_info.org_name`, `org_info.contact_url` | `GET /config` in `beforeEach` | `afterEach` → `PATCH /config` (two fields only) | Instance named `PW Org <ts>`; fails `gitops-verify` org-name check; visible to all users |
| SET-02 | same, on the free instance | same | same | same, on free |
| SET-03 | nothing | — | — | — |
| SET-04 | global `smtp_settings.domain`, `verify_ssl_certs`, `enable_start_tls` (bundled save also posts `features`, `host_expiry_settings`, `server_settings`, `activity_expiry_settings`) | `smtp_settings` in `beforeEach`, full `GET /config` in body | `afterEach` → `PATCH /config` (the three SMTP members) | Cosmetic leftover; but a Fleet formData bug here could disable software inventory, rewrite the server URL, or enable host expiry (→ simulated hosts deleted) |
| SET-05 | Workstations fleet enroll-secret list (adds one, deletes it) | `GET /fleets/<id>/secrets` in `beforeEach` | `afterEach` → `PATCH /fleets/<id>/secrets` (**replaces the whole list**) | Junk secrets accumulate; a bad snapshot deletes the gitops `FLEET_ENROLL_SECRET` → simulated hosts can't re-enroll into Workstations |
| SET-06 | global `webhook_settings.host_status_webhook` | `GET /config` in `beforeEach` | `afterEach` → `PATCH /config` (merges within `webhook_settings`) | Instance keeps POSTing host-status alerts to `example.com`; enabled state leaks into later reads |
| SET-07 | Workstations fleet **whole** `webhook_settings` subtree | `GET /teams/<id>` in body | `try/finally` → `PATCH /teams/<id>` (whole subtree, verbatim) | Fleet's gitops failing-policies webhook + its policy ids are wiped (PATCH replaces the subtree) → policy automations silently off |
| SET-08 | nothing (read-only) | — | — | — |
| SET-09 | nothing (toggle is client-side only, never saved) | — | — | — |
| SET-10 | global macOS **EULA** (`pw-eula.pdf`) | n/a — pre-cleaned instead | test body deletes it, plus `afterEach` `deleteEulaIfPresent` | A fake EULA is shown to every real end user during Apple automatic enrollment; `cleanup.steps.ts` does **not** wipe it |
| SET-11 | nothing (form filled, never saved) | — | — | — |
| SET-12 | global `org_info.org_logo_url_light_mode` **+ its alias** `org_logo_url_light_background`; also the viewer's account theme (client-side only) | `GET /config` at the top of the **test body** | `finally` → `restoreOrgLogo(…,'light',…)`: `DELETE /logo?mode=light` if there was none, else `PATCH /config` writing **both** fields. Restores **one mode**, never both — restoring the other would roll back SET-13 | Every user of the instance, and the login page, is branded with the Playwright test logo. A `PATCH` that only empties one URL field is **not** a fix — the deprecated alias still points at the old blob |
| SET-13 | same for dark: `org_info.org_logo_url_dark_mode` **+ its alias** `org_logo_url` (the bare field) | same | same, with `mode=dark` | same, for dark-mode viewers |
| SET-14 | **global** enroll-secret list (adds a marker, deletes it) | `GET /spec/enroll_secret` in `beforeEach` | `afterEach` → union restore (`restoreGlobalEnrollSecrets`: live − marker + any missing original; never empty) | A wrong-row delete would drop the secret the simulations re-enroll with; the union restore puts it back |
| SET-15 | a throwaway `pw-fleet-<ms>` (created, renamed, deleted) | — | `afterEach` → `DELETE /fleets/<id>` (retried); cleanup sweep of `pw-*` fleets | A stranded fleet shows in every fleet picker until the next run's sweep |

### SET-14 · Settings • global enroll secrets › an admin adds, copies and deletes a global enroll secret, and the others stay

- **File:** [`playwright/tests/e2e/shared/settings/enroll-secrets.spec.ts`](../../tests/e2e/shared/settings/enroll-secrets.spec.ts)
- **Grep:** `npx playwright test -g "adds, copies and deletes a global enroll secret"`
- **Project:** premium **and** free · **Scopes:** global (on premium the Hosts page is put on **All fleets**)
- **Mode:** UI+API · **Isolation:** standalone; clipboard permissions; `beforeEach` snapshot, `afterEach` **union restore**
- **Preconditions:** the instance's own global enroll secret (the test fails if there is none). `beforeEach` reads `GET /spec/enroll_secret`.
- **Data created / mutated:** a marker secret `pw-enroll-<ms>-<worker>-playwright` on the **global** list, deleted by the test. `afterEach` → `restoreGlobalEnrollSecrets`: the live list minus the marker, plus any original that has gone missing; it writes nothing when the list is already right and refuses to post an empty list.
  - ⚠️ **The global secret is what the ~300 simulations re-enroll with** on every daemon restart. Fleet's only write here is a full replace, and the UI posts its cached list ± one. So every row action goes by the secret's value, the test waits for the modal to list the API's count before adding (the modal flashes "You have no enroll secrets" for 50–400 ms first, and a save then would replace the whole list), and the API is checked after each write for every original secret. On free, gitops re-pins the secret nightly; on premium nothing would.

**Flow**

1. ☐ Open the dashboard, click **Hosts**, pick **All fleets** (premium; no-op on free), open the gear **Hosts page settings → Enroll secrets** — `openEnrollSecretsFromMenu`.
   - ✅ *(UI)* **Manage enroll secrets** lists as many secrets as the API returned.
2. ☐ **Add secret**, replace the generated value with the marker, **Save**.
   - ✅ *(UI)* Toast `Successfully added enroll secret.`; a row holds the marker.
   - ✅ *(API)* The global list contains the marker **and every original secret**.
3. ☐ The marker row's **Copy to clipboard**.
   - ✅ *(UI)* `Copied!` in that row; ✅ *(UI)* the clipboard holds the marker.
4. ☐ The marker row's **Delete enroll secret** → **Delete**.
   - ✅ *(UI)* Toast `Successfully deleted enroll secret.`; no marker row.
   - ✅ *(API)* The global list equals the opening snapshot.

**Assessment**
- *Value:* the global list's add / copy / delete on both tiers, through the user's own entry point — and the only test of a write that, done wrong, quietly stops the simulated fleet from re-enrolling. Verified in development by hashing each instance's global list before and after 6 runs per tier: unchanged.
- *Coverage gaps:* edit/rotate, `<32 characters` validation, duplicate rejection; whether a secret enrolls a host.
- *Redundancy:* SET-05 is the same flow at fleet scope. `add-hosts-download.spec.ts` reads the global list (its `[0]`, which the appended marker never is).
- *Efficiency / smells:* the add is proven through the API plus the row appearing; nothing re-reads the list after a reload.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SET-15 · Premium • Settings • fleet lifecycle › an admin adds, renames and deletes a fleet

- **File:** [`playwright/tests/e2e/premium/settings/fleets-lifecycle.spec.ts`](../../tests/e2e/premium/settings/fleets-lifecycle.spec.ts)
- **Grep:** `npx playwright test -g "an admin adds, renames and deletes a fleet"`
- **Project:** premium · **Mode:** UI+API · **Isolation:** standalone; `afterEach` deletes the fleet by id (retried for the gateway's odd 502), and the cleanup projects' **sweep throwaway pw-\* fleets** step removes any a killed run left
- **Preconditions:** none
- **Data created:** a throwaway fleet `pw-fleet-<ms>`, renamed `pw-fleet-<ms>-renamed`, deleted by the test. While it exists it shows in every fleet picker and gets an enroll secret and agent options — nothing reads it by name. Allowed by `playwright/CLAUDE.md`'s throwaway-fleet rule (Andrey, 2026-10-02).

**Flow**

1. ☐ Open **Settings › Fleets** (`/settings/fleets`). ✅ *(UI)* **Add fleet** visible.
2. ☐ **Add fleet** → **Fleet name** `pw-fleet-<ms>` → **Create**.
   - ✅ *(UI)* Toast `Successfully created pw-fleet-<ms>.`; the fleet's row (by its name link) is in the table.
   - ✅ *(API)* A fleet of that name exists.
3. ☐ The row's **Actions → Rename** → **Fleet name** `…-renamed` → **Save**.
   - ✅ *(UI)* Toast `Successfully updated fleet name to …-renamed.`; the new name's row is there and the old one's is gone.
   - ✅ *(API)* The fleet (same id) has the new name.
4. ☐ The row's **Actions → Delete** → **Delete** in "Delete fleet".
   - ✅ *(UI)* Toast `Successfully deleted …-renamed.`; no row.
   - ✅ *(API)* `GET /fleets/<id>` returns 404.

**Assessment**
- *Value:* the only UI coverage of fleet create / rename / delete (QA Wolf C7 #10); gitops applies exercise the API, not these three modals. Asserts named rows, not QA Wolf's row counts, which race other specs.
- *Coverage gaps:* name validation (duplicate, reserved names such as "No team" / "All fleets", which the Add modal maps to its own errors); deleting a fleet that holds hosts (they move to Unassigned); the activity feed's fleet entries (no `activityCopy` for fleets yet).
- *Redundancy:* the gitops-mode specs check these same controls are gated; this checks they work.
- *Efficiency / smells:* the row Actions are a react-select reached by class (`FleetsPage.runRowAction`), as on the Labels page.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

## Area observations

**Coverage map**

| Feature / user flow | Covered by | Gap |
|---|---|---|
| Organization info — name + support URL round-trip | SET-01, SET-02 | Validation (empty name, bad URL); logo-URL fields; org name rendered outside the form |
| Organization logo (light + dark) | SET-12, SET-13 | No rejection cases — the oversize / not-square / too-large / too-small fixtures in `test-data/shared/images/` are all unused here; no replace-in-place; the **Replace logo** pencil button is never clicked (the file goes to the hidden input); no cross-theme negative (a light logo must *not* serve to a dark viewer); the **System** theme; the login page's logo |
| Organization — Fleet Desktop | SET-03 (presence only) | Setting/saving a custom transparency URL; free-tier absence |
| Organization — Advanced options | SET-04 (neighbour-preservation only) | Every functional field: host expiry, activity retention, server URL, analytics, SMTP config/test |
| Enroll secrets — add / copy / delete | SET-05 (fleet), SET-14 (global, both tiers) | Edit / rotate; `<32 char` validation; duplicate rejection; secret actually enrolls a host |
| Host status alerts — global webhook | SET-06 | Disable round-trip; validation |
| Host status alerts — fleet webhook | SET-07 | Negative role case (maintainer/observer cannot save); disable round-trip; URL validation |
| Host expiry stacking + lock (fleet) | SET-08 | The ticked-and-locked branch never runs on QA instances (global expiry is intentionally off) |
| MDM — end-user migration workflow | SET-09 (URL validation only) | Save/persistence; voluntary-vs-forced mode; Save gating on invalid URL |
| MDM — macOS EULA | SET-10 | Non-PDF / oversize rejection; view-EULA action; replace-in-place |
| SSO — end-user authentication (IdP) | SET-11 (render + one gating case) | Entity-ID gating; Metadata-URL-or-Metadata either/or; save path; **Fleet users** tab |
| Integrations — Ticket destinations (Jira / Zendesk) | **nothing** | `IntegrationsPage.goto()` and `ticketDestinationsHeading` exist but no spec calls them |
| Integrations — Calendars, Certificate authorities, Conditional access, Change management, IdP/SCIM | free paywall rows only ([`free/paywalls.spec.ts`](../../tests/e2e/free/paywalls.spec.ts)) | No premium functional coverage at all; `IntegrationsPage.scimText` is dead code |
| ABM / VPP token upload, renewal, expiry warnings | **nothing** | Whole flow untested, yet SET-09 and SET-10 silently *depend* on ABM already being configured |

**Duplication**

1. **SET-01 ≡ SET-02** — identical bodies, identical POM calls, identical assertions; only the describe title differs. The spec comments themselves say the form is tier-agnostic. One `shared/` spec would do.
2. **SET-06 / SET-07** — the same three assertions (enabled, destination URL, persisted) at global vs fleet scope. Keep both for the scope + role difference, but they must be maintained as a pair; SET-07 is the stronger template.
3. **SET-10 / SET-11** share a file for historical naming reasons only and have no common setup, fixture, or subject.

**UI-vs-API balance**

- **SET-06** used to prove persistence through `GET /config` alone; since 2026-10-02 it reloads the page and reads all four values back before the API check.
- **SET-05** is API-only for "the secret joined the list". Justifiable for a credential (the server list is authoritative), but the modal's own list is never re-read, so a render regression passes.
- **SET-04** is API-heavy *by design* — the whole point is comparing config subtrees, and it also does a UI reload check. Correct as is.
- **SET-07 / SET-10** are the model: UI reload **and** API confirmation.
- **SET-08** derives its expectations from the API rather than from a fixture, which caps what it can catch to "UI disagrees with config".
- **SET-03 / SET-09 / SET-11** are pure UI and mutate nothing — appropriate for presence and client-side validation.

**Quick wins**

1. Delete one of SET-01/SET-02 and move the survivor to `tests/e2e/shared/settings/organization/organization-info.spec.ts` — the form is tier-agnostic and the specs are byte-identical.
2. ~~Add a reload + two UI value assertions to SET-06~~ (done 2026-10-02, with the percentage and days fields) ([`shared/settings/host-status-webhook.spec.ts:34`](../../tests/e2e/shared/settings/host-status-webhook.spec.ts)) so persistence isn't proven by `GET /config` alone.
3. Move SET-09's three inline raw locators onto `IntegrationsPage` (`mdm.spec.ts:16,20,26`) and route it through `gotoMdm()` — removes the last spec-level class selectors in this area.
4. Convert the `try/finally` restores in ~~SET-04~~ (done 2026-10-02) and SET-07 (`team-host-status-webhook.spec.ts:73`) to `afterEach` hooks (nesting SET-07's describe so SET-08 is unaffected) — `finally` can be abandoned on a hard timeout, and these two restores protect the enroll-secret/webhook state the suite leans on.
5. Drop the dead `IntegrationsPage.goto()` / `scimText` members, or give them a spec (Ticket destinations is the only Integrations card with a POM anchor and no test).

**Bigger bets**

1. **A settings-config guard fixture.** Every spec in this area hand-rolls snapshot + restore, in three different shapes (`beforeEach`/`afterEach`, `try/finally`, pre-clean + `afterEach`), and each one encodes a different merge-vs-replace rule (`/config` merges within `webhook_settings`; `/teams/:id` replaces it; enroll secrets replace the whole list). A `configGuard(['org_info', 'webhook_settings.host_status_webhook'])` fixture that snapshots on setup and restores in worker/test teardown would centralise those rules, survive timeouts, and make the mutation ledger above enforceable instead of documentary.
2. **Make the ABM dependency explicit.** SET-09 and SET-10 fail with "locator not found" when the instance's ABM token lapses — a yearly certainty. A shared precondition that reads `mdm.apple_bm_enabled_and_configured` from `GET /config` and fails with a named message (or an ops alert on token expiry) turns an annual triage mystery into a one-line diagnosis. Same treatment for the premium SSO/EUA prerequisites behind SET-11.
3. **Cover the Advanced card's functional fields on a disposable instance.** SET-04 can only ever assert non-interference, because the interesting fields (host expiry, retention, server URL) are too dangerous to write on a shared QA instance with simulated hosts. Those belong in a short-lived-instance job where enabling host expiry is harmless — which would also unlock SET-08's currently-dead ticked-and-locked branch.
