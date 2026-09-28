# Batch E — Label targeting

**21 source flows → 10 specs.** `Label targeting`

Read [README.md](README.md) first for the standing rules and how a batch runs. Source flows live in
`qa-wolf/Fleet_20260828 (1)/{Free,Premium}/src/tests/<path>` — the paths below are relative to that.

---

The largest batch and the one with the most new page-object work: include-all / include-any / exclude label
targeting for configuration profiles, declarations, software and policies, plus the broken-label and
DDM-conflict edge cases.

**This is where their coverage is most worth preserving and least worth copying.** The flows are long,
hardcode host and label names, shell out to `fleetctl`, and assert with
`expect(currVerifiedHostsCount).toBeGreaterThanOrEqual(2)` — which passes whether targeting worked or not. The
behaviour they describe is valuable; the assertion is worthless.

### Hosts for this batch

Use the **real VMs**, not the simulations. Resolve them at run time —
`findOnlineHost(request, platform, { kind: 'real' })`, the `vmsFleetId` worker fixture for the premium VMs
fleet, `liveMacosHost` for a macOS one — never by stored name or id. Simulations ignore live-query SQL, return
no rows ~20% of runs and never install anything, so a green assertion against one proves nothing about the
feature.

> **⚠️ Never deploy a passcode profile to a real host.** It blocks access permanently, there is no recovery,
> and there are only a few VMs per tier. No `com.apple.mobiledevice.passwordpolicy`, `forcePIN`, `minLength`,
> `maxInactivity` or `allowSimple` — nor screen lock, inactivity timeout, FileVault, login-window restrictions,
> or anything disabling SSH / remote management / the MDM channel. `fleet-test-passcode.mobileconfig` is one of
> these: safe in the library lifecycle where round 1 uses it, never safe to deliver. See
> [README §5](README.md#5-test-hosts--use-the-real-vms-and-never-lock-yourself-out).

## Label targeting

*21 source flows → 10 specs.*

Include-all / include-any / exclude targeting across profiles, declarations, software and policies.

**Re-author the assertion.** For label targeting the meaningful check is that the profile applies to exactly
the hosts in the label set and to none outside it. Resolve both sets through the API and assert set
membership, not a count floor.

**Build the targets form once.** Include-all / include-any / exclude appears on profiles, declarations,
software and policies as the same component. One `ProfileTargetsForm` component object serves all four — the
highest-leverage new object in round 2.

**POM work:** new `ProfileTargetsForm`; `ConfigurationProfilesPage` — custom-targets tab and declarations;
`OsUpdatesPage` — DDM conflict errors; label-scoped variants on `SoftwareTitleDetailPage` and
`PolicyEditPage`. Grow `helpers/api/labels.ts` to resolve the exact host set a label matches.

| Target spec | Kind | Source flows folded in |
|---|---|---|
| `tests/e2e/premium/controls/os-settings/profile-delivery-retry.spec.ts` | **new** | `activity-feed/host-activity-show-configuration-profile-name-and-status`<br>`configuration-profiles/macos-configurations-profiles-retry-3-times`<br>`configuration-profiles/resend-configuration-profile` |
| `tests/e2e/premium/controls/os-settings/profile-declarations.spec.ts` | **new** | `configuration-profiles/configuration-profile-declarations-including-excluding-labels-macos`<br>`configuration-profiles/configuration-profiles-declarations-broken-state-declarations-are-not-applied-macos` |
| `tests/e2e/premium/controls/os-settings/profile-broken-labels.spec.ts` | **new** | `configuration-profiles/configuration-profiles-broken-deleted-label-profiles-are-not-applied-to-hosts-macos`<br>`configuration-profiles/configuration-profiles-broken-deleted-label-profiles-are-not-applied-to-hosts-windows`<br>`controls/controls-macos-custom-settings-verify-warning-symbol-upon-deleting-custom-label-from-hosts` |
| `tests/e2e/premium/controls/os-settings/profile-label-targets.spec.ts` | **new** | `configuration-profiles/configuration-profiles-custom-targets-with-include-all-and-exclude`<br>`configuration-profiles/configuration-profiles-custom-targets-with-include-any-and-exclude`<br>`configuration-profiles/configuration-profiles-include-any-label-on-custom-targets-macos`<br>`configuration-profiles/configuration-profiles-include-exclude-labels-macos-hosts`<br>`configuration-profiles/configuration-profiles-include-exclude-labels-windows-hosts` |
| `tests/e2e/premium/controls/os-settings/configuration-profiles.spec.ts` | augment | `controls/controls-macos-custom-settings-upload-and-remove-configuration-profile` |
| `tests/e2e/premium/controls/os-updates/macos-updates.spec.ts` | **new** | `controls/controls-macos-updates-ui-validation` |
| `tests/e2e/premium/controls/os-updates/ddm-conflict.spec.ts` | **new** | `custom-software-updates-ddm/cannot-deploy-custom-software-update-enforcement-declaration-ddm-when-manage-os-settings-are-set-macos`<br>`custom-software-updates-ddm/cannot-deploy-custom-software-update-enforcement-declaration-ddm-when-manage-os-settings-are-set-windows` |
| `tests/e2e/premium/software/software-label-targets.spec.ts` | **new** | `hosts/labels-include-all-install-software-on-hosts-that-include-all-labels-and-hosts-that-do-not-include-all-labels-do-not-install-software`<br>`hosts/labels-include-any-add-software-to-hosts-that-include-any-labels-and-hosts-that-do-not-include-any-labels-cannot-install-software` |
| `tests/e2e/premium/policies/policy-label-targets.spec.ts` | **new** | `policies/policies-include-all` |
| `tests/e2e/premium/reports/report-label-targets.spec.ts` | **new** | `policies/report-include-all` |

---

## Done when

- every target spec above exists and is green on each tier it targets;
- `npm run check` is clean;
- each spec ran at least once headed and at least once **with** dependencies (no `--no-deps`);
- anything timing-sensitive survived `--repeat-each=5`;
- a line per shipped slice is appended to [DELIVERY-LOG.md](../DELIVERY-LOG.md);
- anything parked has a row in [`../blocked-by-product-bugs.md`](../../blocked-by-product-bugs.md)
  or a reasoned note in this file — never a silent skip.
