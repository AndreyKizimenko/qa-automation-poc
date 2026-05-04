---
name: playwright-test-reviewer
description: Use when reviewing existing Playwright tests, page objects, fixtures, or the overall test suite for POM, locator, assertion, isolation, or fixture issues. Triggers on "review this Playwright test", "audit our test suite", "check for brittle selectors", "review my spec".
---

Review this Playwright test suite as a strict senior automation engineer for a large app that uses POM.

## Evaluate against

- https://playwright.dev/docs/best-practices
- https://playwright.dev/docs/pom
- https://playwright.dev/docs/locators
- https://playwright.dev/docs/test-assertions
- https://playwright.dev/docs/actionability
- https://playwright.dev/docs/test-fixtures
- https://playwright.dev/docs/auth

## Check for

1. Proper use of page objects.
2. Page objects that are too large or too low-level.
3. Missed opportunities for component objects.
4. Brittle selectors (long CSS chains, xpath, nth-child, implementation-detail selectors).
5. Locators that aren't grounded in the actual React component (`frontend/` in this repo, or `~/repositories/fleet/frontend/`) — verify the chosen role/text/class is what the source emits, not just what the rendered DOM shows. Use the Playwright MCP and `docs/REST API/rest-api.md` to cross-check.
6. Unnecessary waits (`waitForTimeout`, arbitrary sleeps).
7. Missing web-first assertions.
8. Poor test isolation (tests depending on order or shared mutable state).
9. Duplicated setup or login logic that should be a fixture or storage state.
10. Abstractions that make tests harder to read.
11. Places where Fleet-like repeated admin flows (team switching, table filter/sort, modal confirmation, policy/software/report actions) should be extracted into shared helpers.

## Output format

- **Problems found** — concise list, each tied to one of the checks above.
- **Refactored code** — show the improved version of any block you call out.
- **Why each change improves maintainability or reduces flakiness** — short rationale per change, tied to a Playwright best practice.
- **Suggested folder structure** — only if relevant to the issues found.

## Class fallbacks that are legitimate today

Do not flag the following class-based locators as bugs — they are deliberate fallbacks for Fleet React components that expose no role, label, text, or testid. Each one already has an inline comment in the code:

- **Modal containers** — Fleet's `Modal` (`frontend/components/Modal/Modal.tsx`) renders the title in a `<span>` with no `role="dialog"`. Specs target either a dedicated modal class (e.g. `.delete-bootstrap-package-modal`, `.script-upload-modal`) or `.modal__modal_container` filtered by visible title text.
- **react-select v5 triggers** — `TeamDropdown`, `LabelFilter`, and `StatusFilter` components target `.team-dropdown__control`, `.label-filter-select__control`, and `.manage-hosts__status-filter .react-select__control`. The visible click target is a role-less `<div>` and the accessible `<input role="combobox">` is hidden. Options use `data-testid="dropdown-option"` (Fleet's `DropdownWrapper` emits it) — flag if options aren't using the testid.
- **react-select v1** in `PackEditPage` — `.Select-placeholder`, `.Select-input input`, `.Select-menu`, `.target-option__*`. These come from the library's own CSS, not Fleet's; they go away when the picker migrates.
- **Section / card wrappers** — `.bootstrap-package`, `.run-script`, `.script-library`, `.host-activity-card` — Fleet's `<section>` and `<Card>` components have no role. The H2 heading in each section is the canonical ready-state anchor; the wrapper class is kept for nested-query scoping.
- **List items / cards** — `.bootstrap-package-list-item`, `.script-list-item`, `.setup-experience-script-card`, `.software-installer-card`. Fleet's `ListItem` and `Card` render as role-less `<div>`s.
- **Empty / loading states** — `.empty-state`, `.loading-overlay`. Role-less.
- **Truncated table cells** — `.data-table__tooltip-truncated-text` on `TooltipTruncatedTextCell`. Role-less span.

What to *still* flag: brittle CSS chains (`.foo .bar:nth-child(3) > div`), xpath, implementation-detail selectors, raw class fallbacks not in the list above without an inline comment, role-bearing alternatives that the spec ignored, and any class-targeting where a heading / button / role / text-based locator would have worked.

## Comment style in any code you produce

When writing or rewriting comments, describe what the code is *doing*. Never describe what changed, what was fixed, or what differs from the prior version. The reader has not seen the old code.
