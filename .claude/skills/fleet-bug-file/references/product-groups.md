# Product group labels

From `handbook/company/product-groups.md` (re-check it if a label here stops
existing: `gh label list -R fleetdm/fleet --search '#g-'`).

| Label | Owns (areas of expertise) |
|---|---|
| `#g-orchestration` | fleetd, authn/authz, host data ingestion, foreign/IdP vitals, automations, policies, queries/reports, labels, GitOps engine |
| `#g-supply-chain` | software inventory ingestion, CVE/CPE matching, vulnerability reporting, conditional access, certificate authorities, certificate delivery/renewal, disk encryption, CIS benchmarks |
| `#g-apple-at-work` | Apple MDM protocol and configuration profiles, ADE/DEP onboarding, setup experience, macOS/iOS/iPadOS configuration and updates |
| `#g-auto-patching` | software install/uninstall/patch, Fleet-maintained apps, VPP, Google Play apps, in-house apps, self-service, scripts |
| `#g-power-to-pc` | Windows MDM (no area list in the handbook — inferred from its mission) |
| `#g-byod` | Android enrollment and management (no area list — inferred from its mission) |
| `#g-first-impressions` | no area list in the handbook — ask before using |
| `#g-website` | fleetdm.com |

Pick by **where the broken behavior lives**, not where it was noticed: a policy
automation that runs a script is policies/automations (orchestration) if the bug is
in the automation trigger, auto-patching if it's in the script execution itself.
Check `CODEOWNERS` for the files involved when the area is ambiguous. State the
choice with a one-line reason; if two groups fit equally, say so and ask.
