# Settings — org, integrations, webhooks, secrets — test audit

**Specs covered:** 9 files · **Test declarations:** 11 · **Projects:** premium / free (the shared spec runs in both)

This area covers Fleet's **Settings** section: Organization info, Fleet Desktop, Advanced
options, a fleet's own settings page, enroll secrets, and the Integrations subpages (MDM /
EULA / end-user migration, SSO end-user authentication, host-status alerts). Almost every
spec here writes **instance-wide config** — org name, SMTP domain, global or fleet webhook
settings, a team's enroll-secret list — so each one snapshots the affected subtree through
the API and restores it in teardown. The two read-only exceptions (Fleet Desktop presence,
end-user migration URL validation) mutate nothing.

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
| SET-04 | `premium/settings/advanced-options.spec.ts` | Premium • Settings • advanced options › editing one advanced field leaves its neighbours untouched | UI+API | ☐ |
| SET-05 | `premium/settings/enroll-secrets.spec.ts` | Premium • Settings • enroll secrets › add an enroll secret to the Workstations fleet | UI+API | ☐ |
| SET-06 | `shared/settings/host-status-webhook.spec.ts` | Shared • Settings • Host status webhook › enabling the host status webhook with a destination URL persists | UI+API | ☐ |
| SET-07 | `premium/settings/team-host-status-webhook.spec.ts` | Premium • Settings • fleet host status webhook › a team admin enables their fleet host status webhook and it persists | UI+API | ☐ |
| SET-08 | `premium/settings/team-host-status-webhook.spec.ts` | Premium • Settings • fleet host status webhook › the fleet host expiry checkbox derives from the global and fleet settings | UI+API | ☐ |
| SET-09 | `premium/settings/integrations/mdm.spec.ts` | Premium • Settings • MDM end-user migration › the migration webhook URL is validated client-side | UI | ☐ |
| SET-10 | `premium/settings/integrations/automatic-enrollment.spec.ts` | Premium • Settings • Automatic enrollment — EULA › upload then delete a macOS EULA | UI+API | ☐ |
| SET-11 | `premium/settings/integrations/automatic-enrollment.spec.ts` | Premium • Settings • Automatic enrollment — end-user authentication (SSO) › IdP form renders and Save is gated on the required fields | UI | ☐ |

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

### SET-04 · Premium • Settings • advanced options › editing one advanced field leaves its neighbours untouched

- **File:** [`playwright/tests/e2e/premium/settings/advanced-options.spec.ts`](../../tests/e2e/premium/settings/advanced-options.spec.ts)
- **Grep:** `npx playwright test -g "editing one advanced field leaves its neighbours untouched"`
- **Project:** premium · **Scopes:** global
- **Mode:** UI+API · **Isolation:** standalone; restore in a `try/finally` inside the test body (not an `afterEach`)
- **Preconditions:** admin session. SMTP deliberately **unconfigured** on the QA instance — that is why the SMTP `domain` field is safe to scribble on. A full `GET /config` is captured as `before`.
- **Data created / mutated:** **global** `smtp_settings.domain` → `pw-advanced-<epoch-ms>.example.com`. The `finally` PATCHes `smtp_settings.domain` back to its original (or `''`).
  - The card's Save is a **single bundled write**: Fleet's `performSave` posts `smtp_settings`, `features`, `host_expiry_settings`, `server_settings` and `activity_expiry_settings` together, whatever the user touched. So one click here can in principle rewrite all five.
  - ⚠️ If the restore is skipped the leftover is cosmetic (a bogus SMTP domain on an instance with SMTP off). The **real** blast radius is a Fleet-side formData bug: the test exists precisely because a bundled save could silently flip `features.enable_software_inventory` off (kills every software spec), rewrite `server_settings.server_url` (kills agent check-ins), or turn on `host_expiry_settings` (Fleet then **deletes the simulated hosts** the whole host batch depends on). The spec deliberately never edits host expiry itself, and deliberately does **not** try to PATCH whole snapshotted subtrees back — `/config` rejects them with 400 because they carry read-only members such as `smtp_settings.configured`.

**Flow**

1. ☐ `GET /config` and note `smtp_settings.domain` plus the other four subtrees.
2. ☐ Open **Settings → Organization → Advanced options** (via URL `/settings/organization/advanced`).
   - ✅ *(UI)* Heading **Host lifecycle** visible (the page has no title of its own; the first section is the anchor) — `OrganizationAdvancedPage.goto()`.
3. ☐ Set **Domain** to `pw-advanced-<timestamp>.example.com`, click **Save**.
   - ✅ *(UI)* Success toast `Successfully updated settings.`
4. ☐ Reload `/settings/organization/advanced`.
   - ✅ *(UI)* **Domain** field value equals the marker — the edit survives a reload.
5. ☐ Re-read `GET /config`.
   - ✅ *(API)* `smtp_settings.domain` equals the marker.
   - ✅ *(API)* `features`, `host_expiry_settings`, `server_settings`, `activity_expiry_settings` each `toEqual` their pre-save snapshot — compared as **whole subtrees** so a reset nested field can't slip through.
   - ✅ *(API)* Named re-assertions on the two the rest of the suite is most exposed to: `features.enable_software_inventory` and `server_settings.server_url` unchanged.
   - ✅ *(UI)* `page.url()` still contains `/settings/organization/advanced` (non-retrying string check).

**Assessment**
- *Value:* the highest-value test in this area. It is the only guard against a bundled-save regression silently resetting instance settings that dozens of other specs assume. A failure here is a real Fleet bug, not a test to repair.
- *Coverage gaps:* none of the Advanced card's *functional* fields are exercised — host expiry window, activity retention, server URL, "enable analytics", host status webhook interplay — so a broken host-expiry save would not be caught (deliberate: enabling expiry deletes simulated hosts). Nothing asserts SMTP validation or the SMTP "test connection" path. `sso_settings` and `agent_options` are not in `OWNED_SUBTREES`, so if the bundled save ever grew to include them the guard would not notice.
- *Redundancy:* `features.enable_software_inventory` / `server_settings.server_url` are also asserted by [`tests/api/gitops-verify/org-settings.spec.ts`](../../tests/api/gitops-verify/org-settings.spec.ts) and [`tests/api/config.spec.ts`](../../tests/api/config.spec.ts), but there as static drift checks — not as "survives an unrelated save", so this is complementary, not duplicate.
- *Efficiency / smells:*
  - Restore lives in `try/finally` (`advanced-options.spec.ts:79-81`) rather than an `afterEach`. A hard test timeout can abandon the body before `finally` runs; `afterEach` gets its own timeout budget and is the more reliable restore surface. Same pattern in SET-07.
  - `expect(page.url()).toContain(...)` (`:78`) is a non-web-first assertion with no retry, and adds nothing after `goto()` already anchored on the heading.
  - The subtree comparison is snapshot-vs-snapshot across a window in which other workers are live (`fullyParallel: true`, 2–4 workers). No other spec writes these five subtrees today, so it holds — but it is an implicit ordering assumption worth a comment.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SET-05 · Premium • Settings • enroll secrets › add an enroll secret to the Workstations fleet

- **File:** [`playwright/tests/e2e/premium/settings/enroll-secrets.spec.ts`](../../tests/e2e/premium/settings/enroll-secrets.spec.ts)
- **Grep:** `npx playwright test -g "add an enroll secret to the Workstations fleet"`
- **Project:** premium · **Scopes:** Workstations (the gitops-provisioned fleet)
- **Mode:** UI+API · **Isolation:** standalone; `beforeEach` snapshot + `afterEach` restore
- **Preconditions:** `workstationsFleetId` worker fixture (resolved once per worker from the Fleet API). `beforeEach` reads `GET /fleets/<id>/secrets` and stores the full list — [`helpers/api/enroll-secrets.ts`](../../helpers/api/enroll-secrets.ts) `getTeamEnrollSecrets`.
- **Data created / mutated:** one **new enroll secret** on the Workstations fleet (value generated by Fleet's UI, captured from the pre-filled field). `afterEach` calls `setTeamEnrollSecrets` with the snapshot — a PATCH that **replaces the whole list**, so it both removes the addition and rewrites the pre-existing secrets.
  - ⚠️ Skip the restore and Workstations accumulates junk secrets. Worse: because the restore is a *whole-list replace*, a bad snapshot (empty, or captured on a different fleet) would **delete the gitops-provisioned `FLEET_ENROLL_SECRET`**, at which point osquery-perf simulated hosts can no longer re-enroll into Workstations and every Workstations-scoped host test degrades. `gitops-verify` does not check enroll secrets, so nothing else would flag it.

**Flow**

1. ☐ Open the **Manage enroll secrets** modal for Workstations. The test deep-links `/hosts/manage?fleet_id=<id>&manage_enroll_secrets=1` rather than clicking the header button — `HostsListPage.openEnrollSecrets`.
   - ✅ *(UI)* A modal containing "Manage enroll secrets" is visible.
2. ☐ Click **Add secret** — `HostsListPage.addEnrollSecret`.
   - ✅ *(UI)* The secret-editor modal is visible (scoped by its helper text "Must contain at least 32 characters", since it shares the "Add secret" title with the button).
3. ☐ Read the pre-generated value out of the **Secret** field, click **Save**.
   - ✅ *(UI)* Success toast `Successfully added enroll secret.`
4. ☐ Re-read `GET /fleets/<id>/secrets`.
   - ✅ *(API)* The list is exactly one longer than the snapshot.
   - ✅ *(API)* The list contains the secret string captured from the UI field.

**Flagged:** the "joins the fleet's list" claim is verified **only via the API**. The test never re-reads the modal's secret list, so a UI bug that saves the secret but fails to render it in the list would pass. The spec header calls the API check "authoritative", which is defensible for a credential, but a one-line "the new secret appears as a row in the modal" would close the gap cheaply.

**Assessment**
- *Value:* covers the enroll-secret add path end to end, including the generated-value round-trip — a regression that saved a *different* string than the one shown would be caught, which matters because the displayed secret is what a user pastes into an installer.
- *Coverage gaps:* no delete, no edit/rotate, no `<32 characters` validation, no duplicate-secret rejection; nothing checks the secret actually enrolls a host. **Global (Unassigned) enroll secrets are untested in this area** — `getGlobalEnrollSecrets` exists in the helper but is only consumed by [`tests/e2e/shared/hosts/add-hosts-download.spec.ts`](../../tests/e2e/shared/hosts/add-hosts-download.spec.ts).
- *Redundancy:* partial overlap with `add-hosts-download.spec.ts`, which reads global secrets to assert the install-package command — different scope and different concern.
- *Efficiency / smells:*
  - Filed under `settings/` but the flow lives entirely on the **Hosts** page and drives `HostsListPage`. Either move it next to the hosts specs or note the cross-area ownership.
  - Deep-links the modal via `manage_enroll_secrets=1` instead of clicking **Manage enroll secrets**, so the entry point itself is never tested (documented as deliberate in `HostsListPage.openEnrollSecrets`).
  - Two raw `.modal__modal_container` class locators back this flow (`pages/hosts/HostsListPage.ts:112,116-118`) — both carry the required justifying comment.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### SET-06 · Shared • Settings • Host status webhook › enabling the host status webhook with a destination URL persists

- **File:** [`playwright/tests/e2e/shared/settings/host-status-webhook.spec.ts`](../../tests/e2e/shared/settings/host-status-webhook.spec.ts)
- **Grep:** `npx playwright test -g "enabling the host status webhook with a destination URL persists"`
- **Project:** premium **and** free (tier-agnostic, lives under `shared/`) · **Scopes:** global
- **Mode:** UI+API · **Isolation:** standalone; `beforeEach` snapshot + `afterEach` restore
- **Preconditions:** admin session. `beforeEach` stores `webhook_settings.host_status_webhook` from `GET /config`.
- **Data created / mutated:** **global** `webhook_settings.host_status_webhook` → `{ enable_host_status_webhook: true, destination_url: 'https://example.com/host-status-webhook' }`. `afterEach` PATCHes the snapshot back (or `{}` if there was none).
  - `PATCH /config` merges *within* `webhook_settings` — verified and documented in [`tests/e2e/premium/dashboard/automations-activity.spec.ts`](../../tests/e2e/premium/dashboard/automations-activity.spec.ts). That is what makes this safe to run in parallel with the three sibling specs that write other keys of the same subtree (`vulnerabilities_webhook`, `failing_policies_webhook`, `activities_webhook`).
  - ⚠️ If the restore is skipped, the instance keeps firing host-status webhooks at `example.com` and the enabled state leaks into any later test that reads this subtree. Note the restore sends `{}` when nothing was configured, which relies on Fleet treating an empty object as "leave defaults" — worth eyeballing by hand once.

**Flow**

1. ☐ Open **Settings → Integrations → Host status alerts** (via URL `/settings/integrations/host-status-webhook`).
   - ✅ *(UI)* Heading **Host status alerts** visible — `IntegrationsPage.gotoHostStatusWebhook()`.
2. ☐ Tick the enable checkbox — `setHostStatusWebhookEnabled(true)` reads `aria-checked` first so it is idempotent whatever the instance's starting state.
   - ✅ *(UI)* The checkbox reports `aria-checked="true"`.
3. ☐ Fill **Destination URL** with `https://example.com/host-status-webhook`.
4. ☐ Click **Save** — `saveHostStatusWebhook()`.
   - ✅ *(UI)* Success toast `Successfully updated settings.`
5. ☐ Re-read `GET /config`.
   - ✅ *(API)* `webhook_settings.host_status_webhook.enable_host_status_webhook === true`.
   - ✅ *(API)* `…destination_url` equals the URL.

**Flagged:** persistence is asserted **only via `GET /config`** — the test never reloads the settings page. A UI bug that saves correctly but fails to rehydrate the checkbox/URL on reload passes here. SET-07, the fleet-scoped sibling, does reload and is strictly stronger; copying its two reload assertions in would cost three lines.

**Assessment**
- *Value:* covers the global host-status alert save path on both tiers, plus the idempotent-toggle helper.
- *Coverage gaps:* the card's other two inputs — **host percentage** and **days count** — are never set or asserted; no validation case (empty or malformed destination URL); no disable-round-trip (turn it off and confirm it clears); nothing asserts the webhook actually fires.
- *Redundancy:* same feature as SET-07 at global scope. The two are complementary (global vs fleet, admin vs team admin), but the *assertions* are near-identical, so any change should be made to both.
- *Efficiency / smells:* API-only persistence check (above). `hostStatusSaveButton` is `getByRole('button', { name: 'Save', exact: true })` page-wide rather than scoped to the card — fine while the page has one Save, fragile if a second card lands on it. `hostStatusWebhookToggle` matches on the React `name` prop (`enableHostStatusWebhook`), documented in the POM.

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

## Global-config mutation ledger

The reference table for a manual pass. "Restored?" describes what the automation does — when
*you* run the step by hand, you are the restore.

| ID | What it writes | Snapshot | Restore mechanism | If the restore is skipped |
|---|---|---|---|---|
| SET-01 | global `org_info.org_name`, `org_info.contact_url` | `GET /config` in `beforeEach` | `afterEach` → `PATCH /config` (two fields only) | Instance named `PW Org <ts>`; fails `gitops-verify` org-name check; visible to all users |
| SET-02 | same, on the free instance | same | same | same, on free |
| SET-03 | nothing | — | — | — |
| SET-04 | global `smtp_settings.domain` (bundled save also posts `features`, `host_expiry_settings`, `server_settings`, `activity_expiry_settings`) | full `GET /config` in body | `try/finally` → `PATCH /config` (domain only) | Cosmetic leftover; but a Fleet formData bug here could disable software inventory, rewrite the server URL, or enable host expiry (→ simulated hosts deleted) |
| SET-05 | Workstations fleet enroll-secret list (adds one) | `GET /fleets/<id>/secrets` in `beforeEach` | `afterEach` → `PATCH /fleets/<id>/secrets` (**replaces the whole list**) | Junk secrets accumulate; a bad snapshot deletes the gitops `FLEET_ENROLL_SECRET` → simulated hosts can't re-enroll into Workstations |
| SET-06 | global `webhook_settings.host_status_webhook` | `GET /config` in `beforeEach` | `afterEach` → `PATCH /config` (merges within `webhook_settings`) | Instance keeps POSTing host-status alerts to `example.com`; enabled state leaks into later reads |
| SET-07 | Workstations fleet **whole** `webhook_settings` subtree | `GET /teams/<id>` in body | `try/finally` → `PATCH /teams/<id>` (whole subtree, verbatim) | Fleet's gitops failing-policies webhook + its policy ids are wiped (PATCH replaces the subtree) → policy automations silently off |
| SET-08 | nothing (read-only) | — | — | — |
| SET-09 | nothing (toggle is client-side only, never saved) | — | — | — |
| SET-10 | global macOS **EULA** (`pw-eula.pdf`) | n/a — pre-cleaned instead | test body deletes it, plus `afterEach` `deleteEulaIfPresent` | A fake EULA is shown to every real end user during Apple automatic enrollment; `cleanup.steps.ts` does **not** wipe it |
| SET-11 | nothing (form filled, never saved) | — | — | — |

## Area observations

**Coverage map**

| Feature / user flow | Covered by | Gap |
|---|---|---|
| Organization info — name + support URL round-trip | SET-01, SET-02 | Validation (empty name, bad URL); logo-URL fields; org name rendered outside the form |
| Organization — Fleet Desktop | SET-03 (presence only) | Setting/saving a custom transparency URL; free-tier absence |
| Organization — Advanced options | SET-04 (neighbour-preservation only) | Every functional field: host expiry, activity retention, server URL, analytics, SMTP config/test |
| Enroll secrets — add (fleet-scoped) | SET-05 | Delete / rotate; `<32 char` validation; duplicate rejection; **global (Unassigned) secrets via UI**; secret actually enrolls a host |
| Host status alerts — global webhook | SET-06 | Host percentage / days count; disable round-trip; UI rehydration on reload; validation |
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

- **SET-06 is the one true offender:** its only persistence evidence is `GET /config`. There is no activity-feed contract to justify it — the settings page is right there, and SET-07 shows the reload assertion costs three lines. Fix this one.
- **SET-05** is API-only for "the secret joined the list". Justifiable for a credential (the server list is authoritative), but the modal's own list is never re-read, so a render regression passes.
- **SET-04** is API-heavy *by design* — the whole point is comparing config subtrees, and it also does a UI reload check. Correct as is.
- **SET-07 / SET-10** are the model: UI reload **and** API confirmation.
- **SET-08** derives its expectations from the API rather than from a fixture, which caps what it can catch to "UI disagrees with config".
- **SET-03 / SET-09 / SET-11** are pure UI and mutate nothing — appropriate for presence and client-side validation.

**Quick wins**

1. Delete one of SET-01/SET-02 and move the survivor to `tests/e2e/shared/settings/organization/organization-info.spec.ts` — the form is tier-agnostic and the specs are byte-identical.
2. Add a reload + two UI value assertions to SET-06 ([`shared/settings/host-status-webhook.spec.ts:34`](../../tests/e2e/shared/settings/host-status-webhook.spec.ts)) so persistence isn't proven by `GET /config` alone.
3. Move SET-09's three inline raw locators onto `IntegrationsPage` (`mdm.spec.ts:16,20,26`) and route it through `gotoMdm()` — removes the last spec-level class selectors in this area.
4. Convert the `try/finally` restores in SET-04 (`advanced-options.spec.ts:79`) and SET-07 (`team-host-status-webhook.spec.ts:73`) to `afterEach` hooks (nesting SET-07's describe so SET-08 is unaffected) — `finally` can be abandoned on a hard timeout, and these two restores protect the enroll-secret/webhook state the suite leans on.
5. Drop the dead `IntegrationsPage.goto()` / `scimText` members, or give them a spec (Ticket destinations is the only Integrations card with a POM anchor and no test).

**Bigger bets**

1. **A settings-config guard fixture.** Every spec in this area hand-rolls snapshot + restore, in three different shapes (`beforeEach`/`afterEach`, `try/finally`, pre-clean + `afterEach`), and each one encodes a different merge-vs-replace rule (`/config` merges within `webhook_settings`; `/teams/:id` replaces it; enroll secrets replace the whole list). A `configGuard(['org_info', 'webhook_settings.host_status_webhook'])` fixture that snapshots on setup and restores in worker/test teardown would centralise those rules, survive timeouts, and make the mutation ledger above enforceable instead of documentary.
2. **Make the ABM dependency explicit.** SET-09 and SET-10 fail with "locator not found" when the instance's ABM token lapses — a yearly certainty. A shared precondition that reads `mdm.apple_bm_enabled_and_configured` from `GET /config` and fails with a named message (or an ops alert on token expiry) turns an annual triage mystery into a one-line diagnosis. Same treatment for the premium SSO/EUA prerequisites behind SET-11.
3. **Cover the Advanced card's functional fields on a disposable instance.** SET-04 can only ever assert non-interference, because the interesting fields (host expiry, retention, server URL) are too dangerous to write on a shared QA instance with simulated hosts. Those belong in a short-lived-instance job where enabling host expiry is harmless — which would also unlock SET-08's currently-dead ticked-and-locked branch.
