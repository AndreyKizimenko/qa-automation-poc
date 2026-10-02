/**
 * Settings • Organization → Advanced options.
 *
 * The Advanced card's Save is a single bundled write: one `performSave` posts
 * host-lifecycle, activity-retention, features and server-authentication values
 * together, whatever the user actually touched. The risk this spec guards is
 * therefore not "can a field be edited" but **"does editing one section disturb
 * the others"** — a formData glitch here would silently reset settings that much
 * of the rest of the suite depends on (software inventory, the server URL, host
 * expiry).
 *
 * So it edits the most inert fields on the card — the SMTP section's Domain,
 * Verify SSL certs and Enable STARTTLS, all unused on the QA instances (SMTP is
 * deliberately unconfigured) — and then asserts every neighbouring subtree, the
 * rest of `smtp_settings`, and the `mdm` / `sso_settings` members the save also
 * posts, came through the save unchanged. The two
 * checkboxes are flipped from whatever they are now, so the test holds in
 * either state.
 *
 * Shared: the card renders on both tiers (`OrgSettingsPage` only filters Fleet
 * Desktop out of free's nav), and every subtree compared here exists on free.
 * Only the Host lifecycle section has premium-only controls, and this spec
 * doesn't touch it.
 *
 * Deliberately avoids `host_expiry_settings`: raising or lowering that window
 * can make Fleet delete hosts, which the whole host-dependent batch relies on.
 *
 * The `afterEach` restores only the fields the test edits (an `afterEach`, so
 * a timed-out test still restores them). Patching whole snapshotted
 * subtrees back is not an option — `/config` rejects them (400) because they
 * carry read-only members such as `smtp_settings.configured`. If a neighbour
 * ever *does* come back changed, that's a real Fleet bug and the assertion below
 * should fail loudly rather than be quietly repaired.
 */
import { test, expect } from '@fixtures';
import { getAppConfig, patchAppConfig } from '@helpers/api';

/** Subtrees the Advanced card's bundled save can write. */
const OWNED_SUBTREES = [
  'smtp_settings',
  'features',
  'host_expiry_settings',
  'server_settings',
  'activity_expiry_settings',
] as const;

/**
 * The save also posts these members of `mdm` and `sso_settings` from the form.
 * They're compared by name, not as whole subtrees: other specs change the rest
 * of `mdm` while this one runs.
 */
const postedNeighbours = (config: Record<string, unknown>) => {
  const mdm = (config.mdm ?? {}) as Record<string, unknown>;
  const sso = (config.sso_settings ?? {}) as Record<string, unknown>;
  return {
    apple_server_url: mdm.apple_server_url,
    apple_require_hardware_attestation: mdm.apple_require_hardware_attestation,
    only_allow_apple_business_enrollment: mdm.only_allow_apple_business_enrollment,
    sso_server_url: sso.sso_server_url,
  };
};

/** The `smtp_settings` members this test edits. */
const EDITED_SMTP = ['domain', 'verify_ssl_certs', 'enable_start_tls'] as const;

const smtpOf = (config: Record<string, unknown>) => (config.smtp_settings ?? {}) as Record<string, unknown>;

const withoutEdited = (smtp: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(smtp).filter(([k]) => !(EDITED_SMTP as readonly string[]).includes(k)));

test.describe('Settings • advanced options', () => {
  let original: Record<string, unknown> | undefined;

  test.beforeEach(async ({ request }) => {
    original = smtpOf(await getAppConfig(request));
  });

  test.afterEach(async ({ request }) => {
    if (!original) return;
    await patchAppConfig(request, {
      smtp_settings: {
        domain: original.domain ?? '',
        verify_ssl_certs: original.verify_ssl_certs,
        enable_start_tls: original.enable_start_tls,
      },
    });
  });

  test('editing the SMTP fields saves them and leaves every other section untouched', async ({
    organizationAdvanced,
    request,
    page,
  }) => {
    const before = await getAppConfig(request);
    const smtpBefore = smtpOf(before);
    const marker = `pw-advanced-${Date.now()}.example.com`;
    const verifySsl = !smtpBefore.verify_ssl_certs;
    const startTls = !smtpBefore.enable_start_tls;

    await organizationAdvanced.goto();

    await organizationAdvanced.domainInput.fill(marker);
    await organizationAdvanced.verifySslCertsCheckbox.setChecked(verifySsl);
    await organizationAdvanced.enableStartTlsCheckbox.setChecked(startTls);
    await organizationAdvanced.save();
    await organizationAdvanced.toast.expectSuccess('Successfully updated settings.');

    // The edits landed and survive a reload.
    await organizationAdvanced.goto();
    await expect(organizationAdvanced.domainInput).toHaveValue(marker);
    if (verifySsl) await expect(organizationAdvanced.verifySslCertsCheckbox).toBeChecked();
    else await expect(organizationAdvanced.verifySslCertsCheckbox).not.toBeChecked();
    if (startTls) await expect(organizationAdvanced.enableStartTlsCheckbox).toBeChecked();
    else await expect(organizationAdvanced.enableStartTlsCheckbox).not.toBeChecked();

    const after = await getAppConfig(request);
    expect(smtpOf(after)).toMatchObject({
      domain: marker,
      verify_ssl_certs: verifySsl,
      enable_start_tls: startTls,
    });
    expect(withoutEdited(smtpOf(after)), 'the rest of smtp_settings must be unchanged').toEqual(
      withoutEdited(smtpBefore),
    );

    // Everything else the bundled save also posted must be unchanged. Compared
    // as whole subtrees so a reset nested field can't slip through.
    for (const key of OWNED_SUBTREES) {
      if (key === 'smtp_settings') continue;
      expect(after[key], `${key} must survive an unrelated Advanced save`).toEqual(before[key]);
    }

    // Guard the two the rest of the suite is most exposed to, by name.
    expect(
      (after.features as Record<string, unknown>)?.enable_software_inventory,
      'software inventory must stay enabled',
    ).toBe((before.features as Record<string, unknown>)?.enable_software_inventory);
    expect(
      (after.server_settings as Record<string, unknown>)?.server_url,
      'server URL must be unchanged',
    ).toBe((before.server_settings as Record<string, unknown>)?.server_url);
    expect(postedNeighbours(after), 'the MDM and SSO fields the save posts must be unchanged').toEqual(
      postedNeighbours(before),
    );

    expect(page.url()).toContain('/settings/organization/advanced');
  });
});
