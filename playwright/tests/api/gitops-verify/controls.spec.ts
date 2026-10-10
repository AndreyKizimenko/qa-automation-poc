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
 * scope's global MDM flags are the settings spec's. Each test skips for a
 * fleet file that declares none of the keys it reads: a comparison of nothing
 * would otherwise report that the fleet's encryption or OS updates "match".
 */
import { test, expect } from '@playwright/test';
import * as path from 'path';
import { gitopsConfig, gitopsLabel, resolveTeamId, getJson, expectSubset } from './_config';

const controls = () => gitopsConfig.controls;
const apple = () => controls().apple_settings ?? controls().macos_settings;
const windows = () => controls().windows_settings;
const linux = () => controls().linux_settings;
const setup = () => controls().setup_experience ?? controls().macos_setup;
const UPDATE_KEYS = ['macos_updates', 'ios_updates', 'ipados_updates', 'windows_updates'];

/** Whether the fleet file declares any of `keys` under `section` (its `controls`, or one platform block of it). */
function declares(section: Record<string, unknown> | undefined, ...keys: string[]): boolean {
  return !!section && keys.some((key) => section[key] !== undefined);
}

test.describe(`GitOps verify · controls · ${gitopsLabel}`, () => {
  test.skip(gitopsConfig.scope !== 'team', 'the per-platform controls are declared by fleet files');

  let mdm: Record<string, any> = {};

  test.beforeAll(async ({ request }) => {
    const teamId = await resolveTeamId(request);
    mdm = (await getJson(request, `fleets/${teamId}`)).team?.mdm ?? {};
  });

  test('disk encryption, key escrow, the BitLocker PIN and the managed local account match gitops', async () => {
    test.skip(
      !declares(apple(), 'enable_disk_encryption', 'enable_escrow_disk_encryption_key') &&
        !declares(windows(), 'enable_disk_encryption', 'require_bitlocker_pin', 'enable_managed_local_account') &&
        !declares(linux(), 'enable_escrow_disk_encryption_key'),
      'the fleet file declares no disk encryption, key escrow, BitLocker PIN or managed local account setting',
    );
    expectSubset('mdm.macos_settings', mdm.macos_settings, {
      enable_disk_encryption: apple()?.enable_disk_encryption,
      enable_escrow_disk_encryption_key: apple()?.enable_escrow_disk_encryption_key,
    });
    expectSubset('mdm.windows_settings', mdm.windows_settings, {
      enable_disk_encryption: windows()?.enable_disk_encryption,
      require_bitlocker_pin: windows()?.require_bitlocker_pin,
      enable_managed_local_account: windows()?.enable_managed_local_account,
    });
    expectSubset('mdm.linux_settings', mdm.linux_settings, {
      enable_escrow_disk_encryption_key: linux()?.enable_escrow_disk_encryption_key,
    });
  });

  test('Recovery Lock and the host name template match gitops', async () => {
    test.skip(
      !declares(controls(), 'enable_recovery_lock_password', 'name_template'),
      'the fleet file declares neither Recovery Lock nor a host name template',
    );
    expectSubset('mdm', mdm, {
      enable_recovery_lock_password: controls().enable_recovery_lock_password,
      name_template: controls().name_template,
    });
  });

  test('OS update settings match gitops', async () => {
    test.skip(!declares(controls(), ...UPDATE_KEYS), 'the fleet file declares no OS update settings');
    for (const key of UPDATE_KEYS) {
      expectSubset(`mdm.${key}`, mdm[key], controls()[key]);
    }
  });

  test('setup experience matches gitops', async () => {
    test.skip(!setup(), 'the fleet file declares no setup_experience');
    const declared = setup()!;
    expectSubset('mdm.macos_setup', mdm.macos_setup, {
      enable_end_user_authentication: declared.enable_end_user_authentication,
      lock_end_user_info: declared.lock_end_user_info,
      enable_release_device_manually:
        declared.apple_enable_release_device_manually ?? declared.enable_release_device_manually,
      manual_agent_install: declared.macos_manual_agent_install ?? declared.manual_agent_install,
      require_all_software_macos: declared.require_all_software_macos,
      require_all_software_windows: declared.require_all_software_windows,
      enable_managed_local_account:
        declared.enable_create_local_admin_account ?? declared.enable_managed_local_account,
      end_user_local_account_type: declared.end_user_local_account_type,
    });
    const script = declared.macos_script ?? declared.script;
    if (script !== undefined) {
      expect
        .soft(path.basename(String(mdm.macos_setup?.script ?? '')), 'mdm.macos_setup.script')
        .toBe(path.basename(String(script)));
    }
  });
});
