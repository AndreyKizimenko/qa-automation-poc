# Coverage lenses

Questions to ask of a story while mapping risk (step 2). Go through every section. For each lens,
decide consciously: it applies (→ rows), it doesn't (one line in notes.md saying why), or nobody has
decided yet (→ open question). Most missed coverage comes from a lens nobody thought to ask, not from a
lens someone wrongly dismissed.

## 1. The story template's "Changes" list

Every item that changed implies rows. Every "No changes" is a claim about the design, so check it
against what the story actually does. A wrong "No changes" is one of the most valuable things a
test plan can surface, because nobody else is looking for it.

| Item | When it changed, cover | When it says "No changes", ask |
|---|---|---|
| UI | Figma frames and dev notes: each new element, loading / empty / error states, long names, breakpoints the wireframes show (480, 768, 1024, 1280, 1440) | Does any existing page show the changed data (host details, lists, My device, activity feed)? |
| CLI (fleetctl) | Each command and flag, plus help text | Do existing commands hit the changed endpoints (`mdm wipe`, `mdm run-command`, `get`, `apply`, `gitops`)? Then they changed too. |
| YAML | `fleetctl gitops` apply, `--dry-run`, removal or clearing, and the `generate-gitops` round trip | A new admin-configurable thing with no YAML means GitOps users can't manage it. Intended? |
| REST API | Every endpoint and param: types, bounds, missing, zero, unknown ids, all API prefixes, error messages, response shape against the docs PR | Do existing endpoints return new fields or behave differently (validation moved, error changed)? |
| fleetd | Each platform, an old agent with the new server, a new agent with the old server | |
| Server config | Default, set, invalid value, and what happens when it changes on a running server | |
| Exposed public endpoints | Reachable unauthenticated, and only what's meant to be | |
| GitOps mode UI | The feature with GitOps mode on: read-only controls, tooltips, copy | New UI controls that change config. Are they disabled in GitOps mode? |
| GitOps generation | `generate-gitops` includes the field, secrets stay redacted, and the output applies cleanly | A new configurable field with "No changes" here is usually wrong |
| Activity | Type name, details fields, feed text, which entry points log it (and that none log it twice) | Does an action that used to fail now succeed, so it starts logging something? |
| Permissions | Role matrix (global and fleet), API-only users and the granular endpoint catalog (`server/api_endpoints/api_endpoints.yml`) | A new endpoint that never made it into the API-only endpoint catalog. If the gate really is unchanged, one row confirming it still holds is enough, not a full matrix. |
| Paid features / tiers | Free blocked in the backend (API), not only hidden in the frontend. Premium works. | Does Free reach the new code through another entry point? |
| My device / fleetdm.com/better | End-user view and what it reveals | |
| Usage statistics | The stats payload field | |
| Compatibility | Upgrade from the previous release, old clients, old saved data | |
| Database migrations | Upgrade with existing rows (nulls, defaults, big tables), not just a fresh install | |
| Load testing | Out of scope for this plan. Point at the load-test subtask (fleet-loadtest-qa runs those). | Does the change add work per host check-in, per cron run or per API call? If so, ask. |

## 2. Fleet events (design-qa-considerations.md)

Read the live doc from the Fleet checkout. For each event ask: "what happens to this feature when X
happens, or has already happened?" The ones that bite most often:

- **Fleets:** No fleet (Unassigned) vs a fleet vs "All fleets". Fleet created after the feature is set,
  renamed, or deleted while something still points at it. Host transferred in or out.
- **Hosts:** enrolled, deleted and re-enrolled (same record or a new one?), offline, wiped or locked,
  BYOD vs company-owned. On Android, personally-owned (work profile) vs fully managed.
- **MDM:** the platform's MDM turned off, all MDM off, MDM on but the feature's integration missing
  (ABM/VPP tokens, Android enterprise). Single-host MDM off.
- **Software / profiles / scripts:** add, edit, remove, resend, label-scoped (include/exclude
  any/all), setup experience vs self-service vs host details install.
- **Users:** created, removed, role changed while the feature is mid-flight. API-only users.
- **Integrations:** a third party (Google, Apple, Microsoft, IdP) slow, failing or returning
  not-found for something that's gone on their side.
- **Tables and forms:** pagination, sort, search, URL params, empty and loading states, error
  placement and when it triggers, disabled states.

## 3. Bug classes that keep escaping at Fleet

Each one has shipped more than once. If the story touches the area, a row should be able to catch it.

- **Feature gated on the wrong MDM.** A Windows, Android or Linux feature that only works while Apple
  MDM is on (`VerifyAppleMDM` middleware, `mdm.enabled_and_configured` checks in the UI). Row: the
  feature with Apple MDM off, on an Android-only or Windows-only setup.
- **Tier gating only in the UI.** A Premium-only feature hidden on Free but reachable through the API.
  Row: the Free API call.
- **A second entry point skips the rule.** The same operation through another route (the custom-command
  path vs the dedicated endpoint, the GitOps batch endpoint vs single PATCH, add vs edit) skips the
  validation or side effect. Row per entry point, not per surface.
- **Alternate payload shapes.** The same request with an optional field omitted (`type` missing,
  empty object, `fleet_id=0` vs no param) taking a different code path.
- **Docs vs response.** Response shape or field names differ from the REST API reference. Row:
  compare a real response to the docs PR.
- **Pages reachable by URL.** A global-admin-only page opened by a fleet admin through a direct URL.
- **Concurrent first use.** Two requests creating the same thing at once: duplicate-key errors, or
  orphans left behind by an external call that succeeded before the DB write failed.
- **External object already gone.** Google, Apple or the IdP returns 404 for something deleted on their
  side: the result is a 500, or a command that never reaches a terminal state.
- **GitOps clearing.** Removing a key, a file or a whole section doesn't clear the setting. An empty
  file isn't treated as "remove".
- **generate-gitops gaps.** A new field missing from the output, or a secret printed in clear.
- **Variables not re-applied.** `$FLEET_VAR_*` or `$FLEET_SECRET_*` substituted once but not re-sent
  when the value, the host's IdP user or the secret changes.
- **Status shown vs status stored.** A pending, failed or verified state suppressed or mislabeled in
  the UI while the API says otherwise. Installs marked failed when they're only deferred.
- **Activities.** Missing for one entry point, logged twice, or logged on failure.
- **Upgrade.** Rows written by the previous release (nulls, old enum values) breaking new code.
- **Read after write.** Reading from the replica right after a write returns stale data (MySQL
  primary/replica setups).
- **Long names and narrow widths.** Fleet names, software titles and profile names overflowing
  pickers, tables and modals.

## 4. Who can run what (row cost)

fleet-story-qa splits a plan between Claude and the QA engineer. Write rows so the split is obvious.

**Claude runs these. They're cheap, so be thorough:**
- REST API on every prefix, with every param shape, every role (API-only users per global and fleet
  role), unauthenticated, and docs vs response.
- `fleetctl` commands, `fleetctl gitops` (apply, dry-run, clearing), `generate-gitops`.
- DB state, activities, server logs, cron runs (`fleetctl trigger`), concurrency bursts.
- Simulated hosts (osquery-perf) for macOS, Windows, Linux, iPhone/iPad over MDM and Android,
  enrolling through Fleet's real endpoints. They reach states like "wipe pending" through real API
  calls, so an enrollment, inventory or pending-state row usually doesn't need a real device.
- Headless UI on the RC instance for the states it can produce: render, empty, error, long names,
  narrow width, GitOps mode if it's already on.

In the issue, name the need ("a BYOD Android host", "Google reports the device as gone"), not the
tool that produces it. Tools such as osquery-perf, a mock or a database seed go in `notes.md`.

**A person runs these. They're expensive, so batch them and keep only what needs them:**
- Real devices: anything the device itself must show (a setting applied, a prompt, a work profile
  removed, an app installed, zero-touch provisioning). Factory resets and re-enrollments are the
  slowest steps, so order device rows so one enrollment serves several checks.
- Global switches: license (Free vs Premium needs a server restart), MDM on or off per platform, GitOps
  mode, org settings, Apple or Android enterprise setup.
- Third-party consoles (zero-touch portal, ABM, Google admin, the IdP).
- A real UI login as a given role (API-only users can't open the UI).
