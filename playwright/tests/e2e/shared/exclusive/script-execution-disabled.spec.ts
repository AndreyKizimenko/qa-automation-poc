/**
 * Shared • Controls • Turning script execution off (exclusive project).
 *
 * Settings → Organization settings → Advanced options → "Script execution"
 * is the organization-wide switch for running scripts. This walks it off and
 * back on and checks every place the setting is felt:
 *
 *   - the host's Actions menu keeps "Run script" but disables it, with Fleet's
 *     reason as the tooltip;
 *   - the Scripts library says running is off while the library stays usable;
 *   - Fleet itself refuses a run, not just the UI (API 403).
 *
 * **Why it runs in the exclusive project.** `scripts_disabled` is global. While
 * it is on, Fleet rejects every new script run and stops handing queued ones to
 * hosts, so running this beside the other script specs would fail them. The
 * `premium-exclusive` / `free-exclusive` projects run it on one worker after the
 * main project has finished. A run killed while the switch is off is healed by
 * `cleanup-setup`, which turns script execution back on at the start of every run.
 *
 * Tier-agnostic: the setting, its surfaces and their copy are the same on free
 * and premium. The Scripts library is opened on the host's own fleet — the VMs
 * fleet on premium, Unassigned on free — so the banner is read where the host's
 * scripts live.
 */
import { test, expect } from '@fixtures';
import {
  enableScriptExecution,
  isScriptExecutionEnabled,
  postAdHocScript,
  requireRealHost,
} from '@helpers/api';

const DISABLED_COPY = 'Running scripts is disabled in organization settings.';

test('turning script execution off disables running scripts everywhere Fleet offers it', async ({
  organizationAdvanced,
  hostDetails,
  scriptsLibrary,
  request,
  page,
}) => {
  const host = await requireRealHost(request, 'darwin');
  const { fleetId } = host;

  expect(
    await isScriptExecutionEnabled(request),
    'script execution arrived off — cleanup-setup turns it on, so an earlier step of this run left it off',
  ).toBe(true);

  try {
    await organizationAdvanced.goto();
    await expect(organizationAdvanced.scriptExecutionCheckbox).toBeChecked();
    await organizationAdvanced.scriptExecutionCheckbox.uncheck();
    await organizationAdvanced.save();
    await organizationAdvanced.toast.expectSuccess('Successfully updated settings.');
    expect(await isScriptExecutionEnabled(request)).toBe(false);

    // The action stays listed so the reason can be given, but can't be picked.
    await hostDetails.goto(host.id);
    await hostDetails.openActions();
    const runScript = hostDetails.actionOption('Run script');
    await expect(runScript).toHaveAttribute('aria-disabled', 'true');
    await runScript.hover();
    await expect(page.getByRole('tooltip')).toHaveText(DISABLED_COPY);

    await scriptsLibrary.goto(fleetId ? { fleetId } : {});
    await expect(scriptsLibrary.disabledBanner).toBeVisible();
    await expect(scriptsLibrary.addScriptButton).toBeEnabled();

    // Enforced by Fleet, not only by the UI.
    const refused = await postAdHocScript(request, host.id, '#!/bin/sh\necho unreachable\n');
    expect(refused.status()).toBe(403);
    expect(await refused.text()).toContain(DISABLED_COPY);

    await organizationAdvanced.goto();
    await expect(organizationAdvanced.scriptExecutionCheckbox).not.toBeChecked();
    await organizationAdvanced.scriptExecutionCheckbox.check();
    await organizationAdvanced.save();
    await organizationAdvanced.toast.expectSuccess('Successfully updated settings.');
    expect(await isScriptExecutionEnabled(request)).toBe(true);

    await hostDetails.goto(host.id);
    await hostDetails.openActions();
    await expect(hostDetails.actionOption('Run script')).not.toHaveAttribute('aria-disabled', 'true');
  } finally {
    await enableScriptExecution(request);
  }
});
