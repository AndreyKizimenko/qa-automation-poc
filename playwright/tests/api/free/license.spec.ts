/**
 * Free-tier license assertions. The agnostic-shape parts of /config live
 * in `tests/api/config.spec.ts`.
 *
 * The refusals below are the free half of premium-only writes whose UI free
 * hides or paywalls. Each answers 402 (`ErrMissingLicense`) before touching
 * anything, which is what's asserted: the write is read back to prove it
 * didn't land.
 */
import { test, expect } from '@fixtures';
import type { APIResponse } from '@playwright/test';
import {
  apiUrl,
  authHeaders,
  createUser,
  deleteUser,
  findSimulations,
  getHostIdpUsername,
  getUser,
  putHostIdpUsername,
  qaTestEmail,
} from '@helpers/api';

const PREMIUM_LICENSE_MESSAGE = 'Requires Fleet Premium license';

/** A 402 whose body names the license, not some other refusal that happens to share the status. */
async function expectLicenseRefusal(res: APIResponse, what: string): Promise<void> {
  expect(res.status(), `${what} should be refused on free with 402`).toBe(402);
  const body = await res.json();
  expect(body.message).toBe(PREMIUM_LICENSE_MESSAGE);
}

test.describe('Free • license', () => {
  test('license tier is free', async ({ request }) => {
    const res = await request.get(apiUrl('config'), { headers: authHeaders() });
    await expect(res).toBeOK();
    const config = await res.json();
    expect(config.license?.tier).toBe('free');
  });

  // The host details User card's modal shows the Premium message on free
  // (`tests/e2e/free/hosts/host-idp-username.spec.ts`); the endpoint behind it
  // refuses too (`SetHostDeviceMapping` / `DeleteHostIDP` license checks). A
  // simulation, so that if the check ever regressed, no real VM's end user
  // would be written.
  test('setting or removing a host IdP username is refused with 402', async ({ request }) => {
    const [hostId] = await findSimulations(request, 'windows', 1, 0);
    expect(hostId, 'expected an online simulated Windows host').toBeDefined();

    const put = await putHostIdpUsername(request, hostId, `pw-idp-free-${Date.now()}@example.com`);
    await expectLicenseRefusal(put, 'PUT device_mapping (idp)');
    expect(await getHostIdpUsername(request, hostId)).toBeNull();

    const del = await request.delete(apiUrl(`hosts/${hostId}/device_mapping/idp`), {
      headers: authHeaders(),
    });
    await expectLicenseRefusal(del, 'DELETE device_mapping/idp');
  });

  // Fleet MFA is premium: free's user form has no "Enable two-factor
  // authentication" checkbox (`UserForm.tsx`, shown only on premium or when
  // already set — see `tests/e2e/free/settings/users/`), and `ModifyUser`
  // refuses `mfa_enabled: true` on free before it checks anything else.
  test('turning on Fleet MFA for a user is refused with 402', async ({ request }) => {
    const { user } = await createUser(request, {
      name: 'QA free MFA refusal',
      email: qaTestEmail('mfa'),
      global_role: 'observer',
      admin_forced_password_reset: false,
    });
    try {
      const res = await request.patch(apiUrl(`users/${user.id}`), {
        headers: authHeaders(),
        data: { mfa_enabled: true },
      });
      await expectLicenseRefusal(res, 'PATCH users/:id mfa_enabled');
      expect((await getUser(request, user.id)).mfa_enabled).toBe(false);
    } finally {
      await deleteUser(request, user.id, { ignoreMissing: true });
    }
  });
});
