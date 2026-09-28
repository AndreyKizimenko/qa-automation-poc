# Round 2 — triage record

**Decided 2026-09-22; extended 2026-09-23. 29 of the 156 source specs are cut before the audit starts; 127
go forward.**

This is the evidence for that call, one row per cut spec. It exists so nobody re-opens the question per-agent
mid-audit, and so a future reader can challenge any single row without re-deriving all 29.

Cut here means **out of the QA Wolf intake**. It does not always mean "never test this" — group A becomes a
coverage backlog and group C has a destination already chosen. Where the intent survives, the row says where it
went.

The source files are **not deleted**. `qa-wolf/Fleet_20260828 (1)/{Free,Premium}/` stays as-is (gitignored);
group B in particular is worth reading later for preconditions. This document is the authority on what counts
as intake, not the file listing.

| group | what | count |
|---|---|---:|
| **A** | Empty shells and broken source — a title, not a test | 20 |
| **B** | Utilities wearing a test costume | 4 |
| **C** | Tests of something that isn't Fleet's UI | 5 |
| | **total cut** | **29** |
| | **carried into the audit** | **127** |

---

## Group A — empty shells and broken source (20)

The body is the `Arrange: / Act: / Assert:` comment banners and nothing else, or a recording that walks part
way into a form and stops. **Zero `expect()` calls in all 19** — that, not file size, is the test for this
group. The first pass used "no assertions *and* under 30 lines" and missed
`certificates/deploy-user-certificates-…`, which spends 53 lines navigating to Settings → Integrations →
Certificates, clicking **Add CA**, choosing *Custom SCEP* and filling the Name field — then stops, with an
empty `Assert:` block and no save. Length measures how far the recording got, not whether it verifies
anything.

```js
// vpp/renew-vpp-token.spec.ts, in full:
test("Renew VPP Token", async () => {
    await test.step("Renew VPP Token", async () => {
      //--------------------------------
      // Arrange:
      //--------------------------------
      //--------------------------------
      // Act:
      //--------------------------------
      //--------------------------------
      // Assert:
      //--------------------------------
    });
  });
```

**Why cut:** porting a title costs exactly what writing the test from scratch costs. There is no coverage to
harvest, no selector to mine, no assertion to re-author — the defining input of this whole method
([PLAYBOOK §2](../PLAYBOOK.md#2-audit-classify-before-you-build)) is absent. Counting them as intake would
overstate what QA Wolf is handing us by 12%.

| Spec | Tier | LOC |
|---|---|---:|
| `vpp/renew-vpp-token` | Premium | 14 |
| `vpp/install-apple-app-store-apps-on-mac-os-host` | Premium | 14 |
| `vpp/expired-vpp-token` | Premium | 17 |
| `software/install-vpp-apps-on-mac-os` | Premium | 14 |
| `software/add-ipa-software-on-ios-ipad-os-in-ui` | Premium | 25 |
| `scep/bad-scep-cert-config-file-errors-out-on-os-settings` | Premium | 14 |
| `scep/entering-invalid-credentials-for-scep-errors-out` | Premium | 14 |
| `certificates/custom-eft-certificate-authority-and-fleet-api-to-request-a-certificate` | Premium | 26 |
| `ipad-ios/lost-mode-lock-unlock-ios-ipados-hosts` | Premium | 14 |
| `configuration-profiles/upload-configuration-profiles-to-android-host` | Premium | 14 |
| `maintenance-windows/create-a-new-maintenance-window-in-30-seconds-or-less` | Premium | 17 |
| `maintenance-windows/update-existing-maintenance-window-descriptions` | Premium | 14 |
| `api-max-request-file-sizes/endpoints-that-take-multiple-scripts-or-queries-totaling-6mb` | Premium | 14 |
| `api-max-request-file-sizes/microsoft-mdm-endpoints-queries-totaling-3mb` | Premium | 14 |
| `api-max-request-file-sizes/microsoft-mdm-endpoints-queries-totaling-less-2mb` | Premium | 14 |
| `uncategorized/apply-install-script-automations-as-a-maintainer` | Premium | 21 |
| `uncategorized/send-receive-email-check` | Premium | 22 |
| `uncategorized/create-mfa-enabled-user` | Free | 24 |
| `certificates/deploy-user-certificates-certificate-becomes-available-on-the-host-details-page-…` | Premium | 53 |
| `software/software-installers-add-software-installers-ios-ipados` † | Premium | 108 |

† **Broken rather than empty** — added 2026-09-23. It has assertions, so it passed the zero-`expect()` test,
but it cannot run: `filepath` and `softwareName` are both declared **only as commented-out lines**
(`// const softwareName = "";`) and then used, so the first `fill(softwareName)` throws a `ReferenceError`.
QA Wolf marked it blocked themselves in a header comment dated 2025-04-21. Its body is also not an iOS test at
all — it opens the **Custom package** tab and asserts `SlackSetup.exe successfully added.`, a Windows
executable. Whatever it once tested is covered twice over by
`software/software-installers-add-software-installers-windows` (which survives triage) and by our own
`premium/software/library.spec.ts` Windows custom-package case.

### The pattern in where they land

Count them by area and the distribution is not random:

| area | shells | area total (round 2) |
|---|---:|---:|
| VPP / App Store / `.ipa` | 5 | 6 |
| SCEP / certificates | 4 | 6 |
| iOS / iPadOS / Android | 3 | — |
| maintenance windows | 2 | 2 |
| `api-max-request-file-sizes` | 3 | 7 |
| other | 3 | — |

Every cluster except `api-max-request-file-sizes` is one we have no infrastructure for
([DECISIONS](DECISIONS.md)). **QA Wolf couldn't
automate these either.** That is a useful independent signal: where their live suite has a name and no body,
the blocker is environmental, and it will block us the same way. Treat the shells as corroboration of the §5
asks rather than as lost coverage.

Three consequences worth stating outright, because they invert the §5 priority order:

- **Apple VPP contributes zero specs to round 2.** All four VPP-named sources plus
  `software/install-vpp-apps-on-mac-os` are shells. A VPP token would unlock nothing in this intake — and we
  already have one configured anyway (see below).
- **SCEP/EST issuance likewise contributes zero.** Both `scep/` sources, the custom-EST/CA source and
  `deploy-user-certificates` are all shells. The two surviving `certificates/` specs *read* the certificates
  card on host details; they need a host that already carries certs, not a CA that issues them.
- **iOS/iPadOS contributes zero specs that need an iOS device.** The one real-looking installer spec is broken
  (above); `mdm/past-and-upcoming-host-activities-add-mdm-commands-macos-ios-ipados` is titled for three
  platforms but its host list is `["macos26-prem", "macos15-prem"]` and it never touches an iPad.

**None of these clusters was ever device-gated.** Fleet's App Store and Managed Google Play flows are catalog
operations against the server — you add an app by App Store id or `com.android.chrome` and assert the
software row. QA Wolf had no iOS or Android hosts either, which is exactly why these files are shells: the
parts needing a device were never written, and the parts that don't need one are config. Our suite already
proves the point — `premium/software/library.spec.ts` runs `{ kind: 'vpp', platform: 'iOS', appName: 'Bear' }`
and `{ kind: 'android', applicationId: 'com.openai.chatgpt' }` with **no skip gate**, so the premium instance
already has both a VPP token and Managed Google Play, and neither case owns a device.

The three `api-max-request-file-sizes` shells are the exception and the interesting one — that area is pure
API, needs no devices, and we already have `tests/api/premium/max-request-file-sizes.spec.ts` covering its
siblings. Nothing stopped them except priority. Those three titles are the strongest backlog candidates in
group A.

### Where the titles go

Not into `docs/test-plans/` as files. That folder holds deep per-feature plans (`command-palette.md`,
`fleetctl.md` — 25–29 KB each, with case lists and environment facts); 20 orphan titles are not that, and
scattering eight stubs there would dilute it.

They live **here**, in the table above, as a named backlog. When an area's infrastructure lands (a VPP token, a
SCEP CA, an iPad), whoever picks it up reads this section and writes a real test plan for that area then —
with the product as the source, not a QA Wolf filename.

---

## Group B — utilities wearing a test costume (4)

| Spec | Tier | What it actually is |
|---|---|---|
| `util/util-disable-gitops-mode` | Premium | Un-sticks the environment after a gitops-mode test |
| `util/createFailingPolicyThatRetriesEveryHour` | Premium | Builds a precondition; see below |
| `uncategorized/do-not-delete-create-users-huishis-util` | Premium | Provisions 3 `GlobalObserver` users by driving the UI |
| `uncategorized/do-not-delete-create-users-huishis-util` | Free | Same, free instance |

**Why cut:** these are setup scripts QA Wolf ran by hand between suites. The title `[DO NOT DELETE] Create
users (Huishi's util)` says so. We already solve all three concerns properly and better:

| their utility | our equivalent |
|---|---|
| create observer users through the UI, then reset each password in a second browser context | the static-user catalog in `helpers/api/static-users.ts` + `withStaticUser` |
| turn gitops mode off | gitops config, and the isolation decision in [DECISIONS §5](DECISIONS.md#5-gitops-mode-scope) |
| create a failing policy with a `run_script` automation | `helpers/api/policies` — as a precondition inside the spec that needs it |

### What to mine before forgetting these exist

**`createFailingPolicyThatRetriesEveryHour` is not really a utility** — it is a complete end-to-end flow
(create policy → attach `run_script` automation → enable continuous automations → run against a targeted host
→ refetch → assert `Fleet ran the …sh script on this host.` in the Past-activities feed, polling up to 5
minutes). It is filed under `util/` because QA Wolf used it to *set up* the spec that survives triage:
`policies/enabling-continuous-software-and-script-automations-on-a-policy-retries-every-hour`.

So: cut as a spec, but **the audit agent who takes that policies spec must read this file.** It carries the
whole precondition — the SQL that reliably fails (`SELECT 1 FROM osquery_info WHERE start_time < 1;`), the
`continuous-automations-enabled` checkbox, and the activity-feed string to assert. Noted against D6 in the
slice table.

Both `do-not-delete-create-users` variants are also worth one read for the **password-reset dance** — a new
user comes back with `force_password_reset: true` and they work around it by logging in as the new user in a
fresh context and resetting. Round 1 already learned this
([PLAYBOOK §6](../PLAYBOOK.md#6-instance-level-gotchas-worth-knowing-up-front)); this is just corroboration that
it is still true.

---

## Group C — not tests of Fleet's UI (5)

### C-1. osquery table content (3)

| Spec | What it asserts | Needs |
|---|---|---|
| `queries-global-users/alf-table-returns-results-on-mac-os-14` | `SELECT * FROM alf, os_version;` returns rows | a **macOS 14** host (we run 15 / 26) |
| `queries-global-users/crowdstrike-falcon-agent-query-table-on-linux` | `crowdstrike_falcon` returns agent id, version, sensor state | **CrowdStrike Falcon installed** on `qawolf-premium-ubuntu-2204` |
| `queries-global-users/osquery-get-npm-packages-installed-with-npm-or-nvm` | `npm_packages` returns rows | **Node/nvm installed** on a named macOS host |

**Why cut:** the Fleet-side mechanics these exercise — saved report → **Live report** → platform targeting →
results table — are already covered by round 1's `host-live-query.spec.ts` and the `ReportLivePage` extension
built for it. What remains, the part that makes each one *this* test rather than a generic live-query test, is
whether a given osquery table returns rows on a given OS. That is osquery's contract, tested in osquery's and
Fleet's own CI, and it needs third-party agents installed on hosts we don't build that way.

They also resolve hosts **by literal name** (`hostName = "qawolf-premium-ubuntu-2204"`, `"macos26-prem"`),
which is the anti-pattern round 1 corrected — our load fleet regenerates names and ids on every daemon restart
([PLAYBOOK §7](../PLAYBOOK.md#7-test-hosts-fidelity-vs-volume)).

*Caveat worth stating plainly:* if any of these three exists because a customer hit a regression, the
provenance outweighs the layering argument and it should come back. Nothing in the source files records why
they were written. Worth one question to whoever requested them.

### C-2. `fleetctl package` (2)

| Spec | Tier |
|---|---|
| `software/fleetctl-generate-deb-arm-64-package` | Premium |
| `software/fleetctl-generate-deb-arm-64-package-desktop` | Premium |

These `npm install fleetctl`, configure and log in the CLI, then build a `fleet-osquery_*_arm64.deb`.

**This is not a layering rejection — it is a redirect to a destination we already picked.**
[`docs/test-plans/fleetctl.md` §5](../../test-plans/fleetctl.md) says, of `fleetctl package`:

> **worth it, but not here.** The rarely-built types are exactly the ones that rot: `pkg.tar.zst` (Arch),
> `rpm`, and `--arch arm64`, against the well-trodden deb/msi/pkg. […] each build pulls orbit/osqueryd/desktop
> from TUF and takes minutes […] That belongs in its own scheduled workflow — a weekly matrix over type × arch
> — not in the nightly CLI suite, which should stay fast.

That verdict was reached independently, and it names `--arch arm64` specifically. So these two specs
**corroborate an existing plan item rather than being rejected by it.** Cut from the round-2 intake; the
weekly `type × arch` matrix in the fleetctl plan is where the coverage belongs, and these two are evidence
that someone else thought arm64 deb was worth pinning.

---

## Not in scope, for the record

`general/new-hover-states-and-gray-underlines-across-fleet` looks like a round-2 triage candidate (it asserts
`toHaveCSS('background-color', 'rgb(244, 244, 246)')`, avatar `src` regexes and focus-ring colors by literal
value). It is not — it came over in **round 1** and was already CUT there, for the same reason:

> Pure cosmetic. Asserts exact CSS pixel/color values + visual snapshots; brittle, tests styling not behavior.
> — [`audit/C5`](../audit/C5-reports-dashboard-general.md), flow #14

Listed here only because it was flagged once before the round-1 audit was re-checked, and the next reader will
flag it again otherwise.
