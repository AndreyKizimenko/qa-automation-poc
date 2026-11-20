/**
 * Settings: every key the config declares outside the entity lists holds its
 * declared value on the instance. For the no-team scope that is
 * `org_settings` (read back through GET /config), the global MDM flags under
 * `controls`, `agent_options`, and on free the enroll secrets; for a fleet it
 * is the file's `settings:` block and `agent_options` (GET /fleets/{id}).
 *
 * Only declared keys are compared (`expectSubset`): Fleet fills defaults and
 * adds read-only fields, and a key the YAML doesn't manage can't drift from
 * it. A few values need a known translation first: `$VAR` references are
 * already expanded by the loader; the ABM token mapping is matched by
 * organization name, since the list is unordered; and `enable_analytics` on
 * premium is whatever the YAML says only because Fleet forces it on for a
 * premium license, so the YAML has to say true.
 *
 * The ABM list `GET /config` returns is the list the apply sent, so the tokens
 * themselves are read from `GET /ab_tokens` too: every token there has to be
 * declared, with the default and fleets the config gives it. With more than one
 * token, an apply that marks none `default` leaves Fleet without a default
 * token, and a token added by hand that the config doesn't name would go
 * unnoticed.
 *
 * `GET /config` has no VPP list at all: the apply's
 * `mdm.volume_purchasing_program` assigns fleets to the tokens and Fleet keeps
 * the assignment on each token only (fleetdm/fleet#58523, Fleet 5). So the VPP
 * check reads `GET /vpp_tokens`, matched by location, both ways: every token
 * there is declared, every declared token is there, and each serves exactly
 * the fleets the config gives it.
 *
 * Enroll secrets are compared as sets and never printed: the messages carry
 * counts only.
 */
import { test, expect } from '@playwright/test';
import { gitopsConfig, gitopsLabel, resolveTeamId, getJson, expectSubset, expectExactNames } from './_config';

const isNoTeam = gitopsConfig.scope === 'no-team';

test.describe(`GitOps verify · org settings · ${gitopsLabel}`, () => {
  test.skip(!isNoTeam, 'org settings are declared by the no-team config');

  let config: Record<string, any> = {};

  test.beforeAll(async ({ request }) => {
    config = await getJson(request, 'config');
  });

  const org = () => gitopsConfig.orgSettings ?? {};

  test('org_info, server_settings, features and fleet_desktop match gitops', async () => {
    expectSubset('org_info', config.org_info, org().org_info);
    // Fleet stores `server_url` as given, so a trailing slash in the instance's
    // configured URL survives: both sides are compared without one.
    expectSubset(
      'server_settings',
      { ...config.server_settings, server_url: trimSlash(config.server_settings?.server_url) },
      { ...org().server_settings, server_url: trimSlash(org().server_settings?.server_url) },
    );
    expectSubset('features', config.features, org().features);
    expectSubset('fleet_desktop', config.fleet_desktop, org().fleet_desktop);
  });

  test('expiry, webhook, activity and gitops settings match gitops', async () => {
    expectSubset('host_expiry_settings', config.host_expiry_settings, org().host_expiry_settings);
    expectSubset('activity_expiry_settings', config.activity_expiry_settings, org().activity_expiry_settings);
    expectSubset('webhook_settings', config.webhook_settings, org().webhook_settings);
    expectSubset('gitops', config.gitops, org().gitops);
    expectSubset('vulnerability_settings', config.vulnerability_settings, org().vulnerability_settings);
  });

  test('SSO settings match gitops', async () => {
    expect(org().sso_settings, 'the config declares sso_settings').toBeTruthy();
    expectSubset('sso_settings', config.sso_settings, org().sso_settings);
  });

  test('MDM integrations match gitops', async () => {
    const mdm = org().mdm ?? {};
    expectSubset('mdm.end_user_authentication', config.mdm?.end_user_authentication, mdm.end_user_authentication);
    expectSubset('mdm.apple_server_url', config.mdm?.apple_server_url, mdm.apple_server_url);
    expectSubset(
      'mdm.windows_automatic_enrollment',
      config.mdm?.windows_automatic_enrollment,
      mdm.windows_automatic_enrollment,
    );
    const abm = mdm.apple_business;
    if (abm) {
      const liveAbm = (config.mdm?.apple_business ?? []) as Array<Record<string, unknown>>;
      for (const declared of abm) {
        const token = liveAbm.find((t) => t.organization_name === declared.organization_name);
        expect.soft(token, `ABM token "${declared.organization_name}" is configured`).toBeTruthy();
        expectSubset(`ABM token "${declared.organization_name}"`, token, declared);
      }
      expect.soft(liveAbm, 'ABM token count').toHaveLength(abm.length);
    }
  });

  test('every ABM token on the instance is declared, with its default and fleets', async ({ request }) => {
    const mdm = org().mdm ?? {};
    const abm = mdm.apple_business as Array<Record<string, any>> | undefined;
    test.skip(!abm, 'the config declares no ABM tokens');
    const tokens = ((await getJson(request, 'ab_tokens')).ab_tokens ?? []) as Array<Record<string, any>>;
    expect(tokens.length, 'ABM tokens on the instance').toBeGreaterThan(0);
    for (const token of tokens) {
      const name = token.org_name as string;
      const declared = abm!.find((d) => d.organization_name === name);
      expect.soft(declared, `ABM token "${name}" is declared`).toBeTruthy();
      if (!declared) continue;
      expect.soft(token.default === true, `ABM token "${name}" is the default`).toBe(declared.default === true);
      // An undeclared fleet is Unassigned, which the token reports as fleet 0.
      for (const key of ['macos_fleet', 'ios_fleet', 'ipados_fleet', 'byod_fleet']) {
        const live = token[key]?.fleet_id ? token[key].name : '';
        const want = declared[key] ?? '';
        expect.soft(live, `ABM token "${name}" ${key}`).toBe(want);
      }
    }
  });

  test('the VPP tokens on the instance are the declared ones, each with its fleets', async ({ request }) => {
    const vpp = (org().mdm ?? {}).volume_purchasing_program as
      | Array<{ location: string; fleets?: string[] }>
      | undefined;
    test.skip(!vpp, 'the config declares no VPP tokens');
    const tokens = ((await getJson(request, 'vpp_tokens')).vpp_tokens ?? []) as Array<{
      location: string;
      fleets: unknown;
    }>;
    for (const declared of vpp!) {
      const token = tokens.find((t) => t.location === declared.location);
      // A declared token missing from the instance is reported by the location check below.
      if (!token) continue;
      expect
        .soft(liveVppFleets(token.fleets), `VPP token "${declared.location}" fleets`)
        .toEqual(declaredVppFleets(declared.fleets));
    }
    expectExactNames(
      'VPP tokens (by location)',
      tokens.map((t) => t.location),
      vpp!.map((d) => d.location),
    );
  });

  test('the global MDM flags under controls match gitops', async () => {
    const controls = gitopsConfig.controls;
    expectSubset('mdm', config.mdm, {
      windows_mdm_enabled: controls.windows_mdm_enabled,
      android_enabled_and_configured: controls.android_enabled_and_configured,
      windows_mdm_migration_enabled: controls.windows_mdm_migration_enabled,
      enable_turn_on_windows_mdm_manually: controls.enable_turn_on_windows_mdm_manually,
      apple_require_hardware_attestation: controls.apple_require_hardware_attestation,
      only_allow_apple_business_enrollment: controls.only_allow_apple_business_enrollment,
      macos_migration: controls.macos_migration,
    });
  });

  test('agent options match gitops', async () => {
    expect(gitopsConfig.agentOptions, 'the config declares agent_options').toBeTruthy();
    expectSubset('agent_options', config.agent_options, gitopsConfig.agentOptions);
  });

  test('the global enroll secrets match gitops', async ({ request }) => {
    const declared = (org().secrets as Array<{ secret: string }> | undefined)?.map((s) => s.secret);
    test.skip(!declared, 'the config declares no global secrets (premium keeps them under the secrets exception)');
    const live = ((await getJson(request, 'spec/enroll_secret')).spec?.secrets ?? []) as Array<{ secret: string }>;
    const liveSet = new Set(live.map((s) => s.secret));
    const missing = declared!.filter((s) => !liveSet.has(s)).length;
    expect.soft(missing, 'declared enroll secrets missing on the instance (count)').toBe(0);
    expect(live, 'enroll secret count').toHaveLength(declared!.length);
  });
});

test.describe(`GitOps verify · fleet settings · ${gitopsLabel}`, () => {
  test.skip(isNoTeam, 'fleet settings are declared by fleet files');

  let fleet: Record<string, any> = {};

  test.beforeAll(async ({ request }) => {
    const teamId = await resolveTeamId(request);
    fleet = (await getJson(request, `fleets/${teamId}`)).fleet;
  });

  test("the fleet's settings match gitops", async () => {
    const settings = gitopsConfig.settings ?? {};
    expectSubset('features', fleet.features, settings.features);
    expectSubset('host_expiry_settings', fleet.host_expiry_settings, settings.host_expiry_settings);
    expectSubset('webhook_settings', fleet.webhook_settings, settings.webhook_settings);
    expectSubset('integrations', fleet.integrations, settings.integrations);
  });

  test("the fleet's agent options match gitops", async () => {
    expect(gitopsConfig.agentOptions, 'the fleet file declares agent_options').toBeTruthy();
    expectSubset('agent_options', fleet.agent_options, gitopsConfig.agentOptions);
  });
});

function trimSlash(url: unknown): unknown {
  return typeof url === 'string' ? url.replace(/\/+$/, '') : url;
}

const ALL_FLEETS = 'All fleets';

/**
 * A VPP token's fleets from `GET /vpp_tokens`, as the YAML names them, sorted.
 * Fleet answers `[]` for a token on every fleet, `null` for a token on none,
 * and `No team` for Unassigned (fleet 0), the name the YAML uses too
 * (`validateVPPAssignments` and the datastore's `ListVPPTokens` in Fleet's server). Anything
 * else (the key missing or renamed) is an error, never an empty list that could
 * match a declaration of no fleets.
 */
function liveVppFleets(fleets: unknown): string[] {
  if (fleets === null) return [];
  if (!Array.isArray(fleets)) {
    throw new Error(`GET /vpp_tokens gave a token no fleets list (got ${JSON.stringify(fleets)})`);
  }
  if (fleets.length === 0) return [ALL_FLEETS];
  return fleets.map((f: { name: string }) => f.name).sort();
}

/** A declared token's fleets, sorted. Fleet 5 refuses Fleet 4's `All teams` (fleetdm/fleet#59160), so a config names `All fleets`. */
function declaredVppFleets(fleets: string[] | undefined): string[] {
  return [...(fleets ?? [])].sort();
}
