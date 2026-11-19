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
 * Page and component objects build their modals with this. Lint
 * (`suite/modal-in-component`) keeps the class in this file; the places that
 * predate it are recorded and move when next touched.
 */
export function fleetModal(page: Page, title: string | RegExp): Locator {
  return page.locator('.modal__modal_container').filter({ has: page.locator('.modal__header', { hasText: title }) });
}

/**
 * A modal's own Close button: the one its content renders, usually in its
 * footer. `Modal` names the ✕ in its header "Close" as well
 * (fleetdm/fleet#59282), so a button found by that name anywhere in the modal
 * matches both. `.modal__content` wraps whatever the modal renders, and is the
 * only thing that tells it from the header.
 */
export function modalCloseButton(modal: Locator): Locator {
  return modal.locator('.modal__content').getByRole('button', { name: 'Close', exact: true });
}

/** The ✕ in a modal's header, which every closable `Modal` renders, whatever its content offers. */
export function modalDismissButton(modal: Locator): Locator {
  return modal.locator('.modal__header').getByRole('button', { name: 'Close', exact: true });
}
