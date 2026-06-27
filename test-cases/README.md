# Fleet test case library

Manual/regression test cases for Fleet, organized by product area. This is the
human-readable counterpart to the Playwright e2e suite: it captures **what to
test and what the expected result is**, including scenarios that are impractical
to automate (host-dependent flows, MDM enrollment, GitOps, cross-platform).

## Why this exists

- The [`release-qa`](https://github.com/fleetdm/fleet/blob/main/.github/ISSUE_TEMPLATE/release-qa.md)
  template only covers high-level smokes.
- Feature **stories** carry detailed `## Test plan` checklists that are otherwise
  lost once the story closes.
- We need a durable, reviewable place to run regressions against.

## How cases are derived

1. **Stories (source of intent).** For each area we read its feature stories
   (`label:story -label:~engineering-initiated`) oldest → newest, extracting the
   `## Test plan` from each. Reading old → new lets us see requirements **drift**
   and collapse superseded behavior into one current case. Stories with **no test
   plan** are skipped. Linked **Figma**, **API PRs**, and **`.yml`/GitOps PRs** are
   used to enrich detail.
2. **Live product (source of truth).** Every authored case is verified against a
   running Fleet instance (Playwright MCP). Where the story and the live product
   disagree, the live product wins and the case is updated.

## Organization

One file per general area (= Fleet product group). GitOps is cross-cutting and
lives in its own file rather than being interleaved into each area.

| File | Area | Cases |
|------|------|------:|
| [`software.md`](software.md) | Software — inventory, FMA, VPP, packages, scripts, self-service, setup experience (`#g-software`) | 176 |
| [`security-compliance.md`](security-compliance.md) | Vulnerabilities, CIS, certificates (SCEP/NDES/ACME), conditional access, disk encryption, IdP identity (`#g-security-compliance`) | 57 |
| [`endpoint-ops.md`](endpoint-ops.md) | Host vitals, queries & policies, live query, scripts, fleetd agent, maintenance windows (`#g-endpoint-ops`) | 59 |
| [`power-to-pc.md`](power-to-pc.md) | Windows & Android MDM, Windows/Android certificates (`#g-power-to-pc`) | 20 |
| [`first-impressions.md`](first-impressions.md) | Terminology renames (Queries→Reports, Teams→Fleets) & onboarding (`#g-first-impressions`) | 14 |
| [`gitops.md`](gitops.md) | GitOps behavior across all areas | 41 |

Planned: `orchestration.md` (`#g-orchestration`), `mdm.md` (`#g-mdm`). Only `software.md`
has been live-verified so far; the others are derived from story test plans and
marked "not yet live-verified" in their headers.

## Test case anatomy

```
### SW-FMA-001 — Add a Fleet-maintained app to a team

- **Tier:** Premium            (Free | Premium — gated by license)
- **Priority:** P1             (P0 smoke/release-blocker | P1 core | P2 extended)
- **Platforms:** macOS         (macOS | Windows | Linux | iOS/iPadOS | Android | All | N/A)
- **Preconditions:** Logged in as admin; a team exists.
- **Source:** #32763, #37804   (origin stories — traceability back to intent)

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Software > Add > Fleet-maintained | Catalog of available FMA loads |
| 2 | Select an app, choose target (team/all), Add | App appears in the team's software, status "—" until installed |
```

### Conventions

- **ID scheme:** `<AREA>-<SUBAREA>-<NNN>`, number running per sub-area, zero-padded
  to 3. Area codes: `SW` Software, `ORCH` Orchestration, `MDM` MDM, `SEC` Security &
  Compliance, `GITOPS` GitOps. IDs are **stable** — never renumber; deprecate
  instead (`~~SW-FMA-007~~ (removed in 4.80: feature cut)`).
- **One test case = one user-observable outcome.** Prefer several focused cases
  over one mega-case with branching.
- **Steps are imperative; expected results are observable.** "Profile shows status
  Pending", not "it works".
- **Tier matters.** Mark Premium-only cases; Free cases must also be verified to
  be correctly *hidden/restricted* under Free.
- A case that depends on GitOps lives in [`gitops.md`](gitops.md), cross-referenced
  from the area file.
