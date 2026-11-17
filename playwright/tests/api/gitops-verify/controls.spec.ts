/**
 * A fleet's MDM controls: disk encryption and key escrow per platform, the
 * BitLocker PIN, Recovery Lock, the host name template, the OS update settings
 * for all four platforms, and the setup experience with both managed local
 * accounts — every `controls` key a fleet file declares beyond its profile and
 * script lists, read back from GET /fleets/{id} → `fleet.mdm`.
 *
 * The API names each key as the YAML does. `setup_experience.macos_script` is
 * echoed as the path the YAML gave, so it is compared by basename. Only
 * declared keys are compared.
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
const apple = () => controls().apple_settings;
const windows = () => controls().windows_settings;
const linux = () => controls().linux_settings;
const setup = () => controls().setup_experience;
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
    mdm = (await getJson(request, `fleets/${teamId}`)).fleet?.mdm ?? {};
  });

  test('disk encryption, key escrow and the BitLocker PIN match gitops', async () => {
    test.skip(
      !declares(apple(), 'enable_disk_encryption', 'enable_escrow_disk_encryption_key') &&
        !declares(windows(), 'enable_disk_encryption', 'require_bitlocker_pin') &&
        !declares(linux(), 'enable_escrow_disk_encryption_key'),
      'the fleet file declares no disk encryption, key escrow or BitLocker PIN setting',
    );
    expectSubset('mdm.apple_settings', mdm.apple_settings, {
      enable_disk_encryption: apple()?.enable_disk_encryption,
      enable_escrow_disk_encryption_key: apple()?.enable_escrow_disk_encryption_key,
    });
    expectSubset('mdm.windows_settings', mdm.windows_settings, {
      enable_disk_encryption: windows()?.enable_disk_encryption,
      require_bitlocker_pin: windows()?.require_bitlocker_pin,
    });
    expectSubset('mdm.linux_settings', mdm.linux_settings, {
      enable_escrow_disk_encryption_key: linux()?.enable_escrow_disk_encryption_key,
    });
  });

  test('Recovery Lock and the host name template match gitops', async () => {
    test.skip(
      !declares(controls(), 'macos_recovery_lock_password_enabled', 'name_template'),
      'the fleet file declares neither Recovery Lock nor a host name template',
    );
    expectSubset('mdm', mdm, {
      macos_recovery_lock_password_enabled: controls().macos_recovery_lock_password_enabled,
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
    const { macos_script: script, ...declared } = setup()!;
    expectSubset('mdm.setup_experience', mdm.setup_experience, declared);
    if (script !== undefined) {
      expect
        .soft(path.basename(String(mdm.setup_experience?.macos_script ?? '')), 'mdm.setup_experience.macos_script')
        .toBe(path.basename(String(script)));
    }
  });
});
