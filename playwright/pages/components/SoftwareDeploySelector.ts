import { Locator, expect } from '@playwright/test';

/** The Patch options radios, by the label Fleet shows. */
export type PatchOptionLabel = 'Patch when app is closed' | 'Force patch' | 'End user initiated (manual)';

/** The End user experience dropdown's options (Force patch, macOS only). */
export type EndUserExperienceLabel = 'Patch immediately' | 'Notify before patching';

/**
 * Fleet's Deploy choices for a software title (`SoftwareDeploySelector`):
 * **Force install** (a policy that installs the app on every host missing it)
 * and **Patch** (a policy that installs the newest version on every host running
 * an older one — Fleet-maintained apps only). Patch opens three options, and Force
 * patch on a macOS app adds an **End user experience** dropdown — Patch immediately
 * or Notify before patching. Windows gets no dropdown.
 *
 * Fleet renders the selector in the title's Deploy modal and on the add-software
 * pages, so it's constructed on whichever container holds it.
 *
 * The two checkboxes are Fleet's `Checkbox`, whose accessible name is its `name`
 * (`force-install`, `patch`). The options are a labelled radiogroup; Fleet's
 * radio inputs sit behind a styled control, so a choice clicks the `<label>`
 * that wraps the radio and asserts the radio took it.
 */
export class SoftwareDeploySelector {
  readonly root: Locator;
  readonly forceInstallCheckbox: Locator;
  readonly patchCheckbox: Locator;
  readonly patchOptions: Locator;
  /** react-select v5 (`DropdownWrapper` named `end-user-experience`). */
  readonly endUserExperience: Locator;
  /** The dropdown's chosen value; react-select renders it in a role-less div. */
  readonly endUserExperienceValue: Locator;

  constructor(container: Locator) {
    this.root = container;
    this.forceInstallCheckbox = container.getByRole('checkbox', { name: 'force-install', exact: true });
    this.patchCheckbox = container.getByRole('checkbox', { name: 'patch', exact: true });
    this.patchOptions = container.getByRole('radiogroup', { name: 'Patch options' });
    this.endUserExperience = container.getByRole('combobox', { name: 'end-user-experience' });
    // The combobox input sits inside the control; the value and the click
    // target are the control's react-select classes.
    this.endUserExperienceValue = this.patchOptions.locator('.react-select__single-value');
  }

  patchOption(label: PatchOptionLabel): Locator {
    return this.patchOptions.getByRole('radio', { name: label, exact: true });
  }

  /** Ticks or unticks Patch and asserts it took. The checkbox is disabled until Fleet has loaded the app. */
  async setPatch(on: boolean): Promise<void> {
    await expect(this.patchCheckbox).toBeEnabled();
    if ((await this.patchCheckbox.getAttribute('aria-checked')) !== String(on)) await this.patchCheckbox.click();
    await expect(this.patchCheckbox).toHaveAttribute('aria-checked', String(on));
  }

  async choosePatchOption(label: PatchOptionLabel): Promise<void> {
    // The `has` locator is built from the page: one carrying this container's
    // chain would look for the container inside the label and match nothing.
    const wrapper = this.patchOptions
      .locator('label')
      .filter({ has: this.root.page().getByRole('radio', { name: label, exact: true }) });
    await expect(wrapper).toBeVisible();
    await wrapper.click();
    await expect(this.patchOption(label)).toBeChecked();
  }

  async chooseEndUserExperience(label: EndUserExperienceLabel): Promise<void> {
    const control = this.patchOptions.locator('.react-select__control');
    await expect(control).toBeVisible();
    await control.click();
    const option = this.root.page().getByTestId('dropdown-option').filter({ hasText: label });
    await expect(option).toHaveCount(1);
    await option.click();
    await expect(this.endUserExperienceValue).toHaveText(label);
  }
}
