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
- [ ] **cta-visibility** (free + premium, explicit tiers — role-different) — admin/maintainer see Add hosts /
  Manage enroll secret / Add label; observer does not (Export always visible). Uses static users; bundles the
  enroll-secret add/delete lifecycle (POM support exists from Batch 2). C1 #5/#6/#19/#21/#23.
- [ ] **host-status-webhook** (shared settings) — global host-status webhook enable + URL + %, save, verify
  persist, restore. appConfig save/restore (`webhook_settings.host_status_webhook`). C1 #3/#17.
- [ ] **labels-crud via Hosts label-filter** — OVERLAPS the shipped `premium/labels/labels.spec.ts` (Batch 2,
  created via `/labels/manage`). This is the *Hosts label-filter* entry (Add label + filter-pill pencil/trash).
  Decide: augment the existing labels spec with the filter entry point, or skip as redundant. C1 #2/#14/#15.

## Actionable now — hosts DETAILS reads (C2, offline-host cached data)
- [ ] **host-software** (free + premium) — Software tab (Full inventory) search-by-name filters; drill a
  title → Hosts count → `/hosts/manage` filtered by that software (filter pill shows the name). Reads cached
  inventory on offline hosts; reuses `SoftwareTitleDetailPage` + `HostsListPage.filterPill`. C2 #6/#9/#16/#21.
- [ ] **host-details-smoke (partial)** — Local-user-accounts card search + (premium) Agent/osquery tooltip
  hover are cached reads; **Refetch is online-only → Batch 4**, so this spec is only partially authorable now.
  C2 #10/#17/#22 now; #7/#19 (refetch) → Batch 4.

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
