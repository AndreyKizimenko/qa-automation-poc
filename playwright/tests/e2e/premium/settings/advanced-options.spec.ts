/**
 * Premium • Settings • Organization → Advanced options.
 *
 * The Advanced card's Save is a single bundled write: one `performSave` posts
 * host-lifecycle, activity-retention, features and server-authentication values
 * together, whatever the user actually touched. The risk this spec guards is
 * therefore not "can a field be edited" but **"does editing one field disturb
 * the others"** — a formData glitch here would silently reset settings that much
 * of the rest of the suite depends on (software inventory, the server URL, host
 * expiry).
 *
 * So it edits the most inert field on the card — the SMTP `domain`, which is
 * unused on the QA instances (SMTP is deliberately unconfigured) — and then
 * asserts every neighbouring subtree came through the save byte-identical.
 *
 * Deliberately avoids `host_expiry_settings`: raising or lowering that window
 * can make Fleet delete hosts, which the whole host-dependent batch relies on.
 *
 * Teardown restores only the field the test edits. Patching whole snapshotted
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

test.describe('Premium • Settings • advanced options', () => {
  test('editing one advanced field leaves its neighbours untouched', async ({
    organizationAdvanced,
    request,
    page,
  }) => {
    const before = await getAppConfig(request);
    const originalDomain = (before.smtp_settings as Record<string, unknown>)?.domain ?? '';
    const marker = `pw-advanced-${Date.now()}.example.com`;

    try {
      await organizationAdvanced.goto();

      await organizationAdvanced.domainInput.fill(marker);
      await organizationAdvanced.save();
      await organizationAdvanced.toast.expectSuccess('Successfully updated settings.');

      // The edit itself landed and survives a reload.
      await organizationAdvanced.goto();
      await expect(organizationAdvanced.domainInput).toHaveValue(marker);

      const after = await getAppConfig(request);
      expect((after.smtp_settings as Record<string, unknown>)?.domain).toBe(marker);

      // Everything the bundled save also posted must be unchanged. Compared as
      // whole subtrees so a reset nested field can't slip through.
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

      expect(page.url()).toContain('/settings/organization/advanced');
    } finally {
      await patchAppConfig(request, { smtp_settings: { domain: originalDomain } });
    }
  });
});
