# First impressions — test cases

> Area: `#g-first-impressions`. Derived from Fleet feature-story test plans
> (oldest→newest, superseded behavior collapsed). GitOps flows live in
> [`gitops.md`](gitops.md). See [`README.md`](README.md) for method/template.
> **Live-verified 2026-06-27:** Queries→Reports (nav + `/reports/manage`, "Gather data about your hosts") and Teams→Fleets (nav "All fleets"; Settings tab "Fleets") both confirmed on the live product.

## Terminology renames & migrations

### FI-RENAME-001 — Existing `queries` continue to work after the Reports rename

- **Tier:** Both
- **Priority:** P0
- **Platforms:** All
- **Preconditions:** A Fleet instance with one or more pre-existing `queries` defined before the Reports rename.
- **Source:** #39238

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open Fleet and locate the previously created `queries`. | The existing `queries` are present and unchanged. |
| 2 | Exercise each existing `queries` (run/view) as before the rename. | Each `queries` behaves identically to its pre-rename behavior, confirming backward compatibility. |

### FI-RENAME-002 — New `reports` provide full functionality

- **Tier:** Both
- **Priority:** P0
- **Platforms:** All
- **Preconditions:** A Fleet instance on the build containing the Reports rename.
- **Source:** #39238

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Create a new `reports` entity. | The `reports` entity is created successfully. |
| 2 | Use the full set of `reports` capabilities (create, view, run, edit, delete). | Every `reports` capability functions correctly end to end. |

### FI-RENAME-003 — Conflicts between `queries` and `reports` are handled

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A Fleet instance on the build containing the Reports rename.
- **Source:** #39238

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Attempt to define both `queries` and `reports` that conflict with one another. | The conflict is detected and handled according to the rename's conflict-handling rules rather than silently corrupting either entity. |

### FI-RENAME-004 — fleetctl behaves correctly with `reports`

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** fleetctl is installed and authenticated against a Fleet instance on the build containing the Reports rename.
- **Source:** #39238

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Run fleetctl commands that operate on `reports` (and on legacy `queries`). | fleetctl returns the expected results for `reports` and continues to support legacy `queries`. |

### FI-RENAME-005 — GitOps applies `reports` correctly

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A GitOps configuration and a Fleet instance on the build containing the Reports rename.
- **Source:** #39238

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Apply a GitOps configuration that defines `reports` (and any legacy `queries`). | GitOps applies the configuration with the expected `reports` behavior and backward compatibility for `queries`. |

### FI-RENAME-006 — Logging, webhooks, and streaming reflect the Reports rename

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A Fleet instance on the build containing the Reports rename with logging, webhooks, and streaming configured.
- **Source:** #39238

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Trigger activity that produces logs, webhook deliveries, and streamed output related to `reports`. | Logging, webhook, and streaming output behave as expected for `reports`. |

### FI-RENAME-007 — Frontend reflects the Reports rename

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A Fleet instance on the build containing the Reports rename.
- **Source:** #39238

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Navigate the Fleet frontend to the area covering `reports`. | The frontend behavior for `reports` is correct and consistent with the rename. |

### FI-RENAME-008 — Existing `teams` continue to work after the Fleets rename

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** All
- **Preconditions:** A Premium Fleet instance with one or more pre-existing `teams` defined before the Fleets rename.
- **Source:** #39314

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open Fleet and locate the previously created `teams`. | The existing `teams` are present and unchanged. |
| 2 | Exercise each existing `teams` as before the rename. | Each `teams` behaves identically to its pre-rename behavior, confirming backward compatibility. |

### FI-RENAME-009 — New `fleets` provide full functionality

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** All
- **Preconditions:** A Premium Fleet instance on the build containing the Fleets rename.
- **Source:** #39314

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Create a new `fleets` entity. | The `fleets` entity is created successfully. |
| 2 | Use the full set of `fleets` capabilities (create, view, edit, delete). | Every `fleets` capability functions correctly end to end. |

### FI-RENAME-010 — API is consistent for `fleets`

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A Premium Fleet instance on the build containing the Fleets rename with API access.
- **Source:** #39314

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Call the API endpoints covering `fleets` (and legacy `teams`). | The API responds consistently for `fleets` and maintains backward compatibility for `teams`. |

### FI-RENAME-011 — GitOps applies the `teams`-to-`fleets` rename correctly

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A GitOps configuration and a Premium Fleet instance on the build containing the Fleets rename.
- **Source:** #39314

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Apply a GitOps configuration exercising the `teams`-to-`fleets` rename. | GitOps applies the rename with the expected `fleets` behavior and backward compatibility for `teams`. |

### FI-RENAME-012 — ABM config reflects the `fleets` rename

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A Premium Fleet instance with Apple Business Manager configured on the build containing the Fleets rename.
- **Source:** #39314

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Review and update the ABM configuration that references `fleets`. | The ABM config correctly reflects the `fleets` rename and applies as expected. |

### FI-RENAME-013 — Reserved names are enforced for `fleets`

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A Premium Fleet instance on the build containing the Fleets rename.
- **Source:** #39314

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Attempt to create a `fleets` entity using a reserved name. | The reserved name is rejected according to the rename's reserved-name rules. |

### FI-RENAME-014 — Logging, multipart, streaming, and activity reflect the Fleets rename

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A Premium Fleet instance on the build containing the Fleets rename with logging, multipart, streaming, and activity feeds available.
- **Source:** #39314

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Trigger activity that produces logs, multipart requests, streamed output, and activity-feed entries related to `fleets`. | Logging, multipart, streaming, and activity behavior are all correct for `fleets`. |

