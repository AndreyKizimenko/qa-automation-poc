import { Locator, Page } from '@playwright/test';

/**
 * A modal of Fleet's `Modal` component (frontend/components/Modal/Modal.tsx),
 * found by its title.
 *
 * The component renders no `role="dialog"` and no heading, so the container is
 * found by its class, `modal__modal_container`, and narrowed by
 * `.modal__header`, which holds only the title. Matching the header rather
 * than any text in the modal keeps a short title ("Query") from matching every
 * modal that mentions it. `hasText` matches a substring, case-insensitively, so
 * "Delete custom variable" finds the modal titled "Delete custom variable?".
 *
 * Page objects build their modals with this, and the class lives only here.
 */
export function fleetModal(page: Page, title: string | RegExp): Locator {
  return page.locator('.modal__modal_container').filter({ has: page.locator('.modal__header', { hasText: title }) });
}
