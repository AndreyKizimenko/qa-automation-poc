# Round 2 — decisions

The scope calls behind [the batches](README.md), with the evidence for each. Kept separate so the working docs
stay short; come here when someone asks "why isn't X in scope?".

---

## 1. What the export actually was

It arrived as five folders and looked like 614 specs. It was not.

| folder | specs | what it is |
|---|---:|---|
| `TEMPENVFORFREE/` | 52 | **round 1**, re-exported as TypeScript |
| `TEMPENVIRONMENTforPREMIUMflowstotransfer/` | 212 | **round 1**, re-exported as TypeScript |
| `TempEnvforPromotions/` | 1 | a single spec, also present in `Free/` |
| `Free/` | 43 | QA Wolf's **live** free environment |
| `Premium/` | 306 | QA Wolf's **live** premium environment |

The two `TEMPENV*` folders are the flows we already migrated. Verified by filename, not by vibe: 52/52 against
`flows-Free/` and 211/212 against `flows-Premium/`. The single mismatch is a folder move
(`failing-policies/` → `fleet-maintained-filters/failing-policies/`), and five `authentication-*` flows in
round 1's export are absent here because QA Wolf has since retired them.

**Those three redundant folders were removed on 2026-09-22** — the export on disk is now `Free/` + `Premium/`
only, and `qa-wolf/` holds just that plus round 1's `flows-Free/` and `flows-Premium/`, which stay because
[`audit/`](../audit/) cites their basenames. Nothing was lost: the round-1 duplicates are recoverable from the
original `Fleet_20260828 (1).zip`, and the `.flow.js` originals they duplicated are still here.

So the real scope is `Free ∪ Premium` minus round 1:

> **10 new free + 146 new premium = 156 flows**, less the 29 cut in [TRIAGE.md](TRIAGE.md) → **127 carried
> forward**, mapped to 60 target specs across [seven batches](README.md#3-the-batches).

One more number worth knowing: **71 specs** (19 free, 52 premium) existed in the `TEMPENV*` folders but are gone
from QA Wolf's live environments. They churned their own suite between the two exports. We already cover those
— it costs us nothing — but it means **this export is a snapshot, not a contract.** If the handover slips
another two months, expect another delta. Argue for freezing their suite at a date.

## 2. Why their specs are not portable

imports `@playwright/test`, ships a `playwright.config.ts` and a fixtures file. It is very tempting to assume
we can copy them in and fix up imports.

We cannot. The conversion was mechanical. Every spec still:

- destructures its helpers out of a **1861-line `node-20-helpers-premium.js`** that doesn't exist here;
- hardcodes `fleet+GlobalAdmin12@qawolf.email` accounts, per-spec, by number;
- locates by CSS internals — `.name__header .ascending .descending-arrow`, `.hosts_count__cell`,
  `[class*="option"]:has-text(...)`, `.toast-notification__message`;
- leans on `slowMo: 500`, `waitForTimeout`, and a homegrown `waitForPageLoad`;
- resolves hosts **by name** (`const hostName = "_.EBE1e"`) — the exact mistake round 1 corrected, because our
  load fleet regenerates names and ids on every daemon restart;
- runs `headless: false` with a 30-minute test timeout and `trace: 'on'`.

**The economics are unchanged from round 1: these are coverage transcripts.** Harvest *what* they assert,
re-author *how*. The one genuinely new asset is `node-20-helpers-premium.js` — it is a catalog of QA Wolf's
selectors, toast copy and nav paths. Mine it for grounding; port none of it.

## 3. Test data

`test-data/` is **176 MB and committed to git.** Round 2 asks for materially more, and some of it cannot go in
a repo at all:

| what the specs want | size | where it can live |
|---|---|---|
| `software/software-installer-file-over-1gb` | **>1 GB** | never in git — generate at run time |
| `progress-indicator-…-during-upload-of-large-software` | large | same |
| EULA PDFs at the 26.21 MB boundary | ~26 MB | generate (round 1 already set this precedent) |
| batch profiles/scripts totaling >26.21 MB | ~26 MB | generate |
| `.ipa` for iOS/iPadOS installers | ~100 MB | needs a real signed app — licensing question, not a size one |
| RPMs for Fedora, arm64 debs | present already | fine |

We already have the pattern from round 1 ("**Big fixture (~26.5MB) — generate at runtime**"). Round 2 should
make it a rule rather than a case-by-case call:

**Proposal.** Anything over ~10 MB is *generated or fetched*, never committed. Add
`helpers/test-data.ts` with `generateFile(bytes)` / `generatePdf(bytes)` / `ensureFixture(name)` (fetch +
cache under a gitignored `test-data/.cache/`), and document the boundary in `test-data/README.md`. Then audit
the 176 MB we already carry — `gh_2.92.0_*`, `npp.*`, `7z*`, `step-cli*` are all public downloads and several
are probably fetchable instead of stored.

Second data question, separate and more interesting: **identity data.** Three of the four real 2FA/MFA specs
need a mailbox to read a magic link out of. QA Wolf used their platform's `getInbox()`; the stub in this export
throws by design. We'd need our own — Mailpit on the QA box, or a real catch-all domain. That's a small
infrastructure decision with a large coverage payoff (it also unlocks invite flows and password-reset
round-trips we currently assert only up to the send).

## 4. Environment — almost nothing is needed

**This section has been wrong twice and is now grounded in the source.** It first claimed infrastructure was a third of round 2 and a VPP token was the top schedule risk; triage
killed that. A second pass still listed IdP, iOS/iPadOS and Android as "unowned"; reading those specs killed
that too.

**Nothing in round 2 needs an iOS or Android device, a VPP token, a SCEP CA, or an IdP integration.**

Why, one cluster at a time:

| cluster | what it actually does | needs a device? |
|---|---|---|
| Apple VPP | every source was a shell | — nothing to run |
| SCEP / EST issuance | every source was a shell | — nothing to run |
| iOS / iPadOS installers | broken source; body uploads a Windows `.exe` (§3) | — cut |
| `mdm/…-add-mdm-commands-macos-ios-ipados` | titled for three platforms; host list is `["macos26-prem", "macos15-prem"]` | **no** — macOS only |
| Android app catalog | adds Google Chrome by `com.android.chrome` via Software → Add software → App store → Platform: Android; asserts the toast, `Type: Application (Android)`, the software row; deletes it | **no** — a server-side catalog write |
| IdP username (UI + API) | writes `device_mapping` with `source: "mdm_idp_accounts"` on `qawolf-premium-ubuntu-2204` and reads it back | **no** — no IdP is contacted; Fleet just stores the field |

The pattern: **Fleet's App Store, Managed Google Play and IdP-username surfaces are configuration, not
enforcement.** You add an app by store id and assert the catalog row; you set a username field and assert it
persists. Installing onto a device is a separate flow that these specs never reach. QA Wolf had no iOS or
Android hosts either — which is precisely why the device-dependent halves are the shells.

Our own suite already settles it. `premium/software/library.spec.ts` runs, with **no skip gate**:

```ts
{ kind: 'vpp', platform: 'iOS', appName: 'Bear' },
{ kind: 'android', applicationId: 'com.openai.chatgpt' },
```

backed by `SoftwareAppStoreVppPage` (`VppPlatformLabel = 'macOS' | 'iOS' | 'iPadOS'`) and
`SoftwareAppStoreAndroidPage`. So the premium instance **already has a VPP token and Managed Google Play
configured**, and we already assert iOS VPP and Android app add/delete — with zero mobile devices. Round 1's
audit reached the same conclusion in writing: *"Does NOT need android hosts (config-only)"*
([`audit/C9`](../audit/C9-mdm-labels-misc.md), flow #5).

One consequence for the audit: the Android spec is very likely **DUP or a thin AUGMENT** on `library.spec.ts`,
not new work. Round 1 made exactly that call for its sibling flow (C9 #3 → AUGMENT). What the round-2 version
might add is the Application-ID entry path and the `Type: Application (Android)` summary-card assertion. E4's builder decides — it is mapped as an augment on `library.spec.ts`.

### What is actually left

| item | specs | status |
|---|---:|---|
| **gitops mode** | 5 | ours — an isolation decision (§4), nothing to procure |
| **2FA / MFA mailbox** | 3 | ours — Mailpit or a catch-all domain (§3) |
| macOS recovery lock | 2 | ours — semi-destructive, see §4 |
| python on macOS | 2 | the real macOS VM, which we have |
| IdP username | 2 | needs a host and `device_mapping`; **verify** the `Username (IdP)` control renders |
| certificates (read-only) | 1 | **verify** a host carries certs to read |
| Fedora / RPM | 1 | **verify** an online Fedora VM exists (round 1 cited `qawolf-premium-fedora`) |

**Readiness, stated plainly: 113 of the 127 need nothing we don't already have.** The 14 that do are the
five gitops specs (deferred by decision, §6), three 2FA specs (mailbox), two IdP, two recovery-lock, one
Fedora and one certificates. **B2 and B3 can start the moment the audit does** — they are not waiting on
anything.

**Action:** the week-1 "environment probe" is now three API checks — a Fedora host, a host with certificates,
and the IdP-username control — not a procurement exercise. Round 1's lesson still applies to exactly those
three: *a plan document asserted a durable VM that no longer existed, and a fixture built on it was dead on
arrival.* One API call would have caught it.

## 5. gitops mode scope

1. **gitops mode runs last**, after every other batch is complete and green.
2. **We expand it well past what QA Wolf wrote** — a systematic sweep of what gitops mode gates and, just as
   importantly, what it does *not*.

### Why last, mechanically

Enabling gitops mode is a **global config write**. Under `fullyParallel: true` it would silently disable the
controls every other mutating spec depends on — the failure mode in
[PLAYBOOK §5](../PLAYBOOK.md#5-isolation-under-fullyparallel-true), except global rather than per-subtree. QA Wolf
lived with this: one of their utilities exists only to un-stick the environment afterwards
(`util-disable-gitops-mode`, cut in [TRIAGE.md](TRIAGE.md) group B), which tells you how often they left it
stuck.

So it gets **its own Playwright project**, ordered after the tier projects and pinned to one worker:

```ts
{
  name: 'gitops-mode',
  testDir: './tests/e2e/premium/gitops-mode',
  workers: 1,
  dependencies: ['premium'],      // runs only after the premium project finishes
  teardown: 'gitops-mode-teardown', // disables gitops mode whatever happened
}
```

The suite already uses exactly this shape — `premium` declares `dependencies: ['premium-setup',
'cleanup-setup']` and `teardown: 'cleanup-teardown'`. The teardown project matters more here than anywhere
else: an aborted run that leaves gitops mode **on** disables the next run's entire suite.

### What it actually gates — read from the source, not the flows

Gating is one component, `GitOpsModeTooltipWrapper`, driven by one hook, `useGitOpsMode`. **93 files render
it.** By area:

| area | files | do we have the POM? |
|---|---:|---|
| Controls (OS settings, OS updates, scripts, setup experience, variables) | 25 | yes — `pages/controls/` |
| Settings › Integrations (MDM, SSO, CAs, calendars, webhooks, IdP) | 21 | yes — `pages/settings/` |
| Settings › Org settings (info, advanced, agents, SMTP, desktop, web address) | 10 | yes |
| Software (add, details, deploy, versions, automations) | 9 | yes — `pages/software/` |
| Settings › Fleets (fleet table, team settings, agent options) | 5 | yes |
| Policies (form, table, automations, patch CTA) | 5 | yes — `pages/policies/` |
| Shared components (enroll secrets, file uploader, action buttons) | 5 | partly |
| Reports/queries (form, table, automations) | 3 | yes — `pages/reports/` |
| Hosts (filter block, activity automations, script details) | 3 | yes — `pages/hosts/` |
| Labels (new label, label form) | 2 | yes — `pages/labels/` |

**That is the argument for expanding.** QA Wolf covered three of these areas at surface level in 5 specs. We
already own page objects for all ten — 77 POMs across exactly these directories — so the marginal cost of a
gitops-mode assertion is *navigate with the flag on and assert the control is disabled plus its tooltip*. The
POM investment is already paid.

### The half QA Wolf never touched: exceptions

`useGitOpsMode` takes an optional entity type, and Fleet's config carries per-entity **exceptions**:

```ts
gitops: {
  gitops_mode_enabled: boolean,
  repository_url: string,
  exceptions: { labels: boolean, software: boolean, secrets: boolean },
}
```

> *"When an entity is excepted, GitOps mode is treated as disabled for that entity."* — `hooks/useGitOpsMode.ts`

Three entity types, declared at **23 call sites**:

| exception | controls that honour it |
|---|---|
| `secrets` | `EnrollSecretModal` (×2), `EnrollSecretRow` |
| `software` | setup-experience `InstallSoftwareForm` (×2), FMA `FleetAppDetailsForm` (×3), `DeployModal` (×2), `EditAutoUpdateConfigModal`, `LibraryItemAccordion`, `VersionsModal`, `SoftwareDetailsSummary`, `SoftwareAndroidForm`, `SoftwareVppForm`, `ManageSoftwareAutomationsModal` |
| `labels` | `NewLabelPage`, `LabelForm` (×2), hosts `HostsFilterBlock` |

> **Correction (2026-09-27, from the live sweep in [GITOPS-PLAN.md](GITOPS-PLAN.md)).** The counts above are
> stale. Today's checkout renders `GitOpsModeTooltipWrapper` in **88** files, not 93, and the exception surface
> is **~35 call sites, not 23** — 21 `entityType=` props plus 14 direct `useGitOpsMode("<entity>")` calls this
> table never counted. Separately, **34 files read `config.gitops.gitops_mode_enabled` directly**, bypassing the
> hook entirely, and are therefore structurally incapable of honouring an exception. None of them gates an
> excepted entity today, so it is latent rather than broken — but it is the mechanism by which a future
> exception silently fails to apply. The per-area table is otherwise accurate.

**QA Wolf tests none of them.** Their 5 specs only ever assert the on/off axis. The exception axis is where the
interesting regression lives: a change that stops honouring `exceptions.software` locks customers out of
software management while gitops mode is on, and nothing would catch it.

### What "not affected" means, and why it's the sharper assertion

The ask was to cover what gitops mode **doesn't** gate as well as what it does. That is the more valuable
half, because over-gating ships as often as under-gating and is louder for customers. Two examples already
visible in the source and in QA Wolf's own flow:

- **"Add hosts" stays enabled** on a fleet page in gitops mode — their settings spec asserts exactly this,
  alongside Enroll secrets / Rename fleet / Delete fleet being disabled. Enrolling a host isn't a config change,
  so it must not be gated.
- **Every excepted entity stays enabled** when its exception is set, which is the whole point of the mechanism.

So the matrix has three axes, not one: **area × control × (mode off · mode on · mode on + exception)**.

### Corrections from live exploration (2026-09-27)

The counts above were derived by grepping for the JSX prop alone and are **wrong in one material way**.
Verified against today's checkout:

| claim above | actual | why it was wrong |
|---|---|---|
| 93 files render the wrapper | **89** | the original count included the component's own files and `docs/patterns.md` |
| 23 `entityType` call sites | **21** | two of the 23 were in `GitOpsModeTooltipWrapper.tests.tsx` |
| — | **+14 direct `useGitOpsMode("<entity>")` calls** | grepping only for `entityType=` missed an entire category |

**So the exception surface is ~35 sites, not 23.** Components can consume the hook directly and gate
themselves without ever rendering the wrapper — `SoftwareCustomPackage`, `PackageForm`, `EditSoftwareModal`,
`ManualLabelForm` and `EditLabelPage` all do.

Worse: **34 files read `config.gitops.gitops_mode_enabled` directly**, bypassing `useGitOpsMode` altogether.
Those are structurally incapable of honouring an exception, which is the root cause of at least one confirmed
bug (see [GITOPS-PLAN.md](GITOPS-PLAN.md)).

**"One representative control per area" does not survive contact with the UI.** The Software and Hosts list
pages render **zero** wrappers — gating is two clicks deep (Software → title details → Library accordion →
"Delete this version"; Hosts → select a custom label filter → "Edit/Delete label"). A breadth-first probe on
`/software/inventory` would have found nothing and concluded the area was ungated. Worse, asserting "Manage
automations is disabled" there would pass with gitops mode **off**, because it is disabled by fleet scope.
The revised unit is **one control per gating *pattern* per area**, not per area.

### Scope decision still open

Ten areas × the on/off/excepted axis is a lot of cells, and the right size is a judgement call the audit
should inform. Two viable shapes:

- **Breadth-first** — one representative disabled control per area (10 cases) + the full exception matrix
  (3 entity types × excepted/not). Catches "a whole area stopped being gated"; misses one control regressing.
- **Per-area depth** — enumerate the controls inside each area. Closest to real coverage, and it scales with
  the 93 files rather than the 10 areas.

**Recommendation: breadth-first for the areas, depth on the exceptions.** The exceptions are three booleans
with 23 call sites and no coverage anywhere; the area sweep has real but lower marginal value per case, and
`entityType` is the thing most likely to break silently. E12 should size this against the live UI.
