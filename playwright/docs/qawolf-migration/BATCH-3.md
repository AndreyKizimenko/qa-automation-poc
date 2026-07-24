# Batch 3 — Hosts area (list + details, host-independent)

The hosts area had **zero e2e coverage** (only `tests/loadtest/hosts.spec.ts`). Full per-flow
dispositions: `C1-hosts-list.md` (27 flows) + `C2-hosts-details.md` (25 flows). This tracker scopes what's
**actionable now** (host-independent UI + reads on the 62 offline/Unassigned hosts) vs. deferred to **Batch 4**
(needs an online host, is destructive, or is blocked on provisioning).

Validation gate per slice: `npm run check` (0 errors) → live `test:premium` (+ `test:free` for `shared/`) →
commit to `main` in a logical chunk. Selectors grounded in `~/repositories/fleet/frontend`.

Instance realities that gate this batch: 62 **offline, Unassigned** hosts (~21 macOS/22 Win/17 Ubuntu/1
Android) — they keep last-checkin records, so list/export/columns/CTA and cached host-data reads work; live
actions do not. No team-admin static user. No host provisioning / no re-enrollable pool.

Legend: [ ] todo · [x] done (green + committed) · [→4] moved to Batch 4 · [cut] dropped

## Actionable now — hosts LIST (C1)
- [x] **export-csv** (shared) — `tests/e2e/shared/hosts/export-csv.spec.ts`. "Export hosts" → CSV download
  (`getByRole('button',{name:'Export hosts'})`; `HostsListPage.exportHosts()` returns the Download; read via
  `fs.readFileSync(await download.path())`). Asserts the CSV contains the first Unassigned host. C1 #4/#18.
- [x] **edit-columns** (shared) — `tests/e2e/shared/hosts/edit-columns.spec.ts`. Edit columns modal
  (`.modal__modal_container` "Edit columns"; column = Fleet `<Checkbox>` → `getByRole('checkbox',{name})`;
  Save). Shows then hides the "User email" column (`columnHeader('User email')` = table columnheader). **Fleet
  hides `device_mapping`/"User email" by DEFAULT** (verified live), so the flow is hidden→show→hide (also
  self-restores). Choice persists to per-context localStorage (`hostHiddenColumns`), so no cross-test
  mutation. C1 #7/#24. `HostsListPage.columnHeader()` + `toggleColumn()`. Live: premium + free.
- [x] **add-hosts-download** (shared) — `tests/e2e/shared/hosts/add-hosts-download.spec.ts`. New
  `AddHostsModal` component (`.add-hosts-modal`/`.platform-wrapper`): open → **Advanced** tab shows the Fleet
  cert download (`.platform-wrapper__fleet-certificate-download`, `.first()` — it renders twice once expanded);
  the **"Plain osquery"** RevealButton then shows enroll-secret + flagfile downloads (all three Buttons are
  just named "Download" → scope enroll-secret/flagfile to `.platform-wrapper__advanced--{enroll-secrets,
  flagfile}`). Downloads fire via FileSaver (captured by `waitForEvent('download')`; read with
  `fs.readFileSync(await dl.path())`). Asserts cert `BEGIN CERTIFICATE`, enroll secret ∈ global secrets, flagfile
  `--enroll_secret_path=secret.txt` + `--tls_server_certs=fleet.pem`. Select **"All fleets"** → modal uses the
  global secret (no-op on free). New `getGlobalEnrollSecrets` (GET `/spec/enroll_secret`). No mutation. C1
  #1/#9. Live: premium + free.
- [x] **cta-visibility** (free + premium, explicit tiers) — `{free,premium}/hosts/cta-visibility.spec.ts`.
  Role-based CTA visibility via `withStaticUser` (fresh context per role). Asserts the three clean header CTAs:
  **Add hosts** + **Enroll secrets** (both gated on `canEnrollHosts` = global/team admin|maintainer) and
  **Export hosts** (no role gate). Admin (and maintainer, premium) see all three; global observer sees only
  Export. `HostsListPage.enrollSecretsButton` (exact "Enroll secrets" — NOT the empty-state "Manage enroll
  secrets" banner link). **Scoped to the three header CTAs on purpose:** "Add label" is an icon-only button
  (a11y name resolves to "plus") inside the *opened* label dropdown, and role-based label-add is already
  covered by the Batch-2 labels role-access spec; the enroll-secret add/copy/delete lifecycle is a mutation
  (dropped — visibility is the concern here). C1 #5/#6/#19/#21/#23. Live: premium 3, free 2.
- [x] **host-status-webhook** (shared settings) — `tests/e2e/shared/settings/host-status-webhook.spec.ts`.
  Settings → Integrations → **Host status alerts** (`/settings/integrations/host-status-webhook`, H2 "Host
  status alerts"; both tiers, not premium-gated). Enable (Fleet `<Checkbox>` → `getByRole('checkbox',
  {name:'enableHostStatusWebhook'})` — a11y name is the `name` prop; read aria-checked) → fill Destination URL
  (getByLabel; only rendered once enabled) → Save ("Save"; toast **"Successfully updated settings."**) →
  API-verify. **% and days dropdowns need NOT be set** — they default to 1 and only `destination_url` is
  validated. appConfig snapshot/restore of `webhook_settings.host_status_webhook` (new `HostStatusWebhook`
  config interface). `IntegrationsPage.gotoHostStatusWebhook`/`setHostStatusWebhookEnabled`/
  `saveHostStatusWebhook`. C1 #3/#17. Live: premium + free.
- [skip] **labels-crud via Hosts label-filter** — SKIPPED as redundant (per lead): label CRUD is covered by the
  shipped `premium/labels/labels.spec.ts` and role-access by the labels role-access spec (both Batch 2). The
  only unique bit here is the Hosts label-filter entry point (Add label + filter-pill pencil/trash), not worth a
  duplicate spec. C1 #2/#14/#15.

## Actionable now — hosts DETAILS reads (C2, offline-host cached data)
- [x] **host-software** (shared) — `tests/e2e/shared/hosts/host-software.spec.ts`. Host Software tab (Full
  inventory): search-by-name filters (`getByPlaceholder('Search by name or vulnerability (CVE)')`), then drill
  the first title → click its **"Hosts"** count → hosts list filtered by that software (filter pill names it).
  Made deterministic via new `findHostWithSoftware(request)` (first host reporting software — avoids a fragile
  "first host" pick). The host-count link's visible text is the volatile count, so `SoftwareTitleDetailPage.
  hostCountLink` targets it by the `software_title_id` href. Reused across tiers (identical behavior; free
  instance also has host software) → shared. `HostDetailsPage.searchSoftware`/`firstSoftwareName`;
  `SoftwareTitleDetailPage.viewHosts`. C2 #6/#9/#16/#21. Live: premium + free.
- [→4] **host-details-smoke** — Local-user-accounts search + Agent/osquery tooltip are cached reads, but
  **Refetch is online-only**, so this spec is dominated by Batch-4 work; deferred whole to Batch 4 with the
  live-host fixture. C2 #7/#10/#17/#19/#22.

## ✅ Batch 3 actionable-now set COMPLETE
All host-independent hosts-area coverage that doesn't need an online host / provisioning is shipped:
export-csv, edit-columns, add-hosts-download, cta-visibility (free+premium), host-status-webhook, host-software.
Everything else in the hosts area is in the [→4] / [cut] lists below (online-host, destructive, or blocked).

## Deferred to Batch 4 (online host / destructive / blocked)
- [→4] **bulk-transfer** + **host-transfer-permissions** (C1 #10/#12/#20/#22/#25) — mutate host↔team
  assignment on the shared instance; reversible via API but risky under parallel workers. Sequence in Batch 4
  with careful API restore. (#27 team-admin can't-transfer is also team-admin-blocked.)
- [→4] **bulk-delete** (C1 #11), **delete/lock/wipe host** (C2 #2/#4/#12/#14/#18/#25) — destructive, no
  re-enroll pool; lock/wipe need a disposable MDM host.
- [→4] **host-live-query / run-existing-query / refetch / reports-cached-results** (C2 #1/#7/#8/#11/#19/#20 +
  reports-tab #5/#15/#23/#24) — need an ONLINE host (live run, refetch, cached query results). Gated on the
  daily host-autoenroll action.
- [→4] **team-host-status-webhook** (C1 #16), **team-admin host delete/can't-transfer** (C1 #26/#27) — need a
  team-admin static user (not provisioned). Batches with the other moved-to-Batch-4 items.
- [cut] **create-team-from-transfer-modal** (C1 #13) — creates+deletes a team in-body (forbidden). Salvage:
  assert the "Create a fleet" link exists, folded into bulk-transfer.
- [reassign] **automations-activity** (C1 #8) — mis-filed under hosts; it's the dashboard automations modal.
  Belongs to a dashboard cluster.

## Conventions for this batch
- Tier-agnostic-identical flows (export-csv, edit-columns, add-hosts-download, host-status-webhook) →
  `shared/` (they are genuinely identical, like auth/packs — not parameterized tier-branching). Role-different
  flows (cta-visibility) → explicit `free/` + `premium/`.
- No team create/delete in bodies; transfers rework to Unassigned↔Workstations via `helpers/api/hosts.ts`
  transfer helpers with guaranteed restore.
- The 62 hosts are the persistent given — read them, don't mutate their team/state (except the reversible
  transfer specs in Batch 4).
