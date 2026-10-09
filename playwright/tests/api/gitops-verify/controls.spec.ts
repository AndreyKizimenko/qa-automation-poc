/**
 * A fleet's MDM controls: disk encryption and key escrow per platform, the
 * BitLocker PIN and managed local account, Recovery Lock, the host name
 * template, the OS update settings for all four platforms, and the setup
 * experience — every `controls` key a fleet file declares beyond its profile
 * and script lists, read back from GET /fleets/{id} → `mdm`.
 *
 * The YAML names a few of these differently from the API: `apple_settings` is
 * `macos_settings`, `setup_experience` is `macos_setup` with
 * `apple_enable_release_device_manually` → `enable_release_device_manually`,
 * `enable_create_local_admin_account` → `enable_managed_local_account`,
 * `macos_manual_agent_install` → `manual_agent_install` and `macos_script` →
 * `script`, which Fleet echoes as the path the YAML gave, so it is compared by
 * basename. Only declared keys are compared.
 *
 * These controls reach the hosts of the fleet that carries them, which is why
 * only the Compliance fleet — which has none — declares them; the no-team
 * scope's global MDM flags are the settings spec's.
 */
import { test, expect } from '@playwright/test';
import * as path from 'path';
import { gitopsConfig, gitopsLabel, resolveTeamId, getJson, expectSubset } from './_config';

const controls = () => gitopsConfig.controls;

test.describe(`GitOps verify · controls · ${gitopsLabel}`, () => {
  test.skip(gitopsConfig.scope !== 'team', 'the per-platform controls are declared by fleet files');

  let mdm: Record<string, any> = {};

  test.beforeAll(async ({ request }) => {
    const teamId = await resolveTeamId(request);
    mdm = (await getJson(request, `fleets/${teamId}`)).team?.mdm ?? {};
  });

  test('disk encryption, key escrow, the BitLocker PIN and the managed local account match gitops', async () => {
    const apple = controls().apple_settings ?? controls().macos_settings ?? {};
    expectSubset('mdm.macos_settings', mdm.macos_settings, {
      enable_disk_encryption: apple.enable_disk_encryption,
      enable_escrow_disk_encryption_key: apple.enable_escrow_disk_encryption_key,
    });
    const windows = controls().windows_settings ?? {};
    expectSubset('mdm.windows_settings', mdm.windows_settings, {
      enable_disk_encryption: windows.enable_disk_encryption,
      require_bitlocker_pin: windows.require_bitlocker_pin,
      enable_managed_local_account: windows.enable_managed_local_account,
    });
    expectSubset('mdm.linux_settings', mdm.linux_settings, {
      enable_escrow_disk_encryption_key: controls().linux_settings?.enable_escrow_disk_encryption_key,
    });
  });

  test('Recovery Lock and the host name template match gitops', async () => {
    expectSubset('mdm', mdm, {
      enable_recovery_lock_password: controls().enable_recovery_lock_password,
      name_template: controls().name_template,
    });
  });

  test('OS update settings match gitops', async () => {
    for (const key of ['macos_updates', 'ios_updates', 'ipados_updates', 'windows_updates']) {
      expectSubset(`mdm.${key}`, mdm[key], controls()[key]);
    }
  });

  test('setup experience matches gitops', async () => {
    const setup = controls().setup_experience ?? controls().macos_setup;
    test.skip(!setup, 'the fleet file declares no setup_experience');
    expectSubset('mdm.macos_setup', mdm.macos_setup, {
      enable_end_user_authentication: setup.enable_end_user_authentication,
      lock_end_user_info: setup.lock_end_user_info,
      enable_release_device_manually: setup.apple_enable_release_device_manually ?? setup.enable_release_device_manually,
      manual_agent_install: setup.macos_manual_agent_install ?? setup.manual_agent_install,
      require_all_software_macos: setup.require_all_software_macos,
      require_all_software_windows: setup.require_all_software_windows,
      enable_managed_local_account: setup.enable_create_local_admin_account ?? setup.enable_managed_local_account,
      end_user_local_account_type: setup.end_user_local_account_type,
    });
    const script = setup.macos_script ?? setup.script;
    if (script !== undefined) {
      expect
        .soft(path.basename(String(mdm.macos_setup?.script ?? '')), 'mdm.macos_setup.script')
        .toBe(path.basename(String(script)));
    }
  });
});
