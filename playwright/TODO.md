# TODO

Tests / specs that are currently **skipped**, **gated behind env vars**, or
**deliberately deferred**, with the reason and the unblock condition.

> When you add a new skip, add a row here. A skip without a TODO entry is a bug.

---

## Skipped tests

| Test | Why | Unblock |
|---|---|---|
| `tests/smoke/orchestration/packs-flow.spec.ts` → `pack query executes on targeted host` | `POST /api/v1/fleet/packs/schedule` returns 405 — the schedule endpoint appears partially deprecated. | Find the replacement scheduling endpoint or drop the test. |

`FLEET_SSO_LOGIN_*` is required by the Okta SSO login spec — tests fail rather than skip if it is missing. Admin SSO and EUA are assumed to be pre-configured on the instance and are no longer set up by the suite. Project-level scoping (premium / free / loadtest) is handled via tags and `playwright.config.ts` grep, not env vars.

## Deferred coverage

| Where | What's missing | When |
|---|---|---|
| All smoke specs | Currently scoped to the per-product-group smoke fleets only. We want every flow run against `fleet_id=0` ("No team") as well. | After the smoke-fleet path is solid; needs a UI team-switching pattern that handles the "All fleets" URL quirk. |
| Hackathon `software-titles.spec.ts` / `software-vulnerabilities.spec.ts` | Not ported. Coverage exists in `tests/smoke/security-and-compliance/vulnerabilities.spec.ts`. | Probably leave; revisit only if the existing spec gets unwieldy. |

---

## Upstream Fleet issues

| Upstream | Effect | Workaround |
|---|---|---|
| [fleetdm/fleet#38044](https://github.com/fleetdm/fleet/issues/38044) — API-only users get 403 on several admin endpoints | `FLEET_API_TOKEN` (api-only user) cannot upload software packages, manage `/packs`, or mutate `/queries` / `/policies`. | Affected helpers and specs use `sessionAuthHeaders()` (storage-state cookie token) instead of `authHeaders()`. Flip back when the upstream issue ships. |

## Locator strategy

The suite follows [Playwright locator priorities](https://playwright.dev/docs/locators):
`getByRole` → `getByLabel` → `getByPlaceholder` → `getByText` → `getByTestId` →
`page.locator('.css-class')` (last resort, requires an inline comment).

Class-based locators only remain where Fleet's React output exposes no role,
label, text, or testid:

- **Modal containers** — Fleet's `Modal` renders the title in a `<span>` and
  emits no `role="dialog"`. Every modal locator either targets a dedicated
  modal class (`.delete-bootstrap-package-modal`, `.script-upload-modal`,
  `.delete-script-modal`, `.delete-setup-experience-script-modal`) or
  `.modal__modal_container` filtered by the title text.
- **react-select v5 triggers** (`TeamDropdown`, `LabelFilter`, `StatusFilter`)
  — visible click target is a role-less `<div>`. `LabelFilter` and
  `StatusFilter` options use `data-testid="dropdown-option"` (Fleet's
  `DropdownWrapper`); `TeamDropdown` options are *not* wrapped and have
  no testid/role, so the component targets `.team-dropdown__option`
  directly.
- **react-select v1** in `PackEditPage` (`.Select-*`) — library-internal
  CSS classes; will go away when Fleet migrates the picker.
- **Section wrappers** (`.bootstrap-package`, `.run-script`, `.script-library`)
  — Fleet's `<section>` and `<Card>` have no role/region. The canonical
  ready-state anchor is each section's `<h2>` heading; the wrapper class
  exists for tests that need to scope nested queries.
- **List items / cards** (`.bootstrap-package-list-item`, `.script-list-item`,
  `.setup-experience-script-card`, `.software-installer-card`) — role-less.
- **Empty / loading states** (`.empty-state`, `.loading-overlay`) — role-less.

Reference patterns where roles work and should be used:
- Page anchors: `getByRole('heading', { name, level: 2 })`.
- Actions: `getByRole('button', { name })`.
- Tabs: `getByRole('tab', { name })`.
- Activity rows: `getByRole('button', { name: /\bago\b/ })`.
- Modal confirm buttons inside class-targeted modals.

---

## Conventions for marking skips

1. **Static skip with reason** at the top of a describe — when the feature is
   unavailable on this instance:
   ```ts
   test.skip(
     process.env.FLEET_LICENSE !== 'free',
     'Set FLEET_LICENSE=free to run Fleet Free tests',
   );
   ```
2. **`test.describe.skip(...)` block** — when an entire describe is inert.
3. **`test.skip('name', async () => { ... })`** — one specific test broken
   for a reason unrelated to the rest of the spec.

Every skip needs an entry above. Every env var gate needs a row in
`.env.example`.
