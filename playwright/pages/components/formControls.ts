import { expect, Locator } from '@playwright/test';

/**
 * Turns one of Fleet's `Slider` switches on or off and waits until it reads
 * that way. The slider is a `role="switch"` button Fleet gives no accessible
 * name, so the caller finds it by what surrounds it; its state is
 * `aria-checked`. The state is read only once the switch is on screen, so one
 * still rendering isn't taken for off, and the switch is clicked only when it
 * differs, which makes the call safe to repeat.
 */
export async function setSlider(toggle: Locator, on: boolean): Promise<void> {
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute('aria-checked')) !== String(on)) await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', String(on));
}

/**
 * Picks the radio named `name` inside `scope`, then waits for it to read
 * checked. Fleet's `Radio` hides the real input behind a styled control, so the
 * `<label>` wrapping it (which also gives the radio its name) takes the click.
 */
export async function pickRadio(scope: Locator, name: string): Promise<void> {
  // The `has` locator is rooted at the page: one built from `scope` would look
  // for the scope inside each label, and match nothing.
  await scope
    .locator('label')
    .filter({ has: scope.page().getByRole('radio', { name, exact: true }) })
    .click();
  await expect(scope.getByRole('radio', { name, exact: true })).toBeChecked();
}
