# Round 3 — triage record

**Decided 2026-10-01. 13 of the 154 gaps the audit found aren't being built; 141 go to the batches.**

Each row below is one of those 13, with the reason, so nobody reopens the question one agent at a time, and so
anyone can challenge a single row without re-deriving the rest. More gaps will leave at each batch's review
(a gap the flow body shows is a duplicate, a depth item not worth its runtime). Those cuts are written in the
batch file's review table, not here; this file holds only what was decided before batching.

| group | what | count |
|---|---|---:|
| **cut** | not worth a test: the behaviour is covered another way, or the case can't fail | 7 |
| **accepted** | a known partial that stays partial, and why | 3 |
| **long-term** | needs infrastructure the instances don't have ([`../../long-term-goals.md`](../../long-term-goals.md)) | 3 |
| | **not built** | **13** |
| | **batched** | **141** |

---

## Cut (7)

| gap | what | why it's cut |
|---|---|---|
| round 1 C6 #8 | the Vulnerabilities tab's column sort (Severity, Probability of exploit, Published, Detected, Hosts; ascending and descending) | Sorting is a prop of Fleet's shared `TableContainer`, and `titles-table.spec.ts` and `sort-view.spec.ts` already exercise it. Asserting five more columns tests the table component again, not anything about vulnerabilities. The flow's full-page screenshot has no baseline infrastructure here. |
| round 1 C10 #17, #18, #19, #21, #23, #25 | the **under-limit** size cases: batch profiles < 25 MB, multiple scripts < 5 MB, batch scripts < 25 MB, an EULA PDF < 25 MB, one profile < 1 MB, one script < 1 MB, each accepted | `tests/api/premium/max-request-file-sizes.spec.ts` covers the **rejections**, which is where a limit breaks. An accepted upload under the limit is what every upload spec in the suite already does (profiles, scripts, packages, the EULA in `automatic-enrollment.spec.ts`), so a regression that refused a small file would fail a dozen specs at once. Generating 25 MB bodies per run to prove it again costs upload time and proves nothing new. |

## Accepted as partial (3)

| gap | what stays untested | why |
|---|---|---|
| round 1 C5 #5 | free: the host Reports tab's "Oldest results" sort, with real results to order | `shared/hosts/host-reports-tab.spec.ts` runs the sort on both tiers and asserts that cards awaiting results sort last. Free has no stored results to put on the other side (no fleets, so no durable report survives `cleanup-setup`'s drain of global reports), so there the invariant holds trivially, as the spec's header says. On premium, `pw-host-report-results` on the VMs fleet gives it both sides (C5 #18). |
| round 2 C, *Not covered* | a host report card's "N additional results not shown" banner | It renders only when a host has more than one result row; the durable report returns one, and seeding a multi-row one means waiting out a scheduled interval (~3.5 min) every run. The card's preview of the first row **is** covered cell for cell. Decided in [round 2 C](../round-2/C-host-reads.md#not-covered-and-why). |
| round 2 #14, #64 | IdP: the host's SCIM *Full name*, *Groups* and *Department* | The premium instance has never received a SCIM request (`GET /scim/details` → `last_request: null`), so there's nothing to show; the IdP username, its activity and its removal are covered (`host-idp-username.spec.ts`, both tiers). Unblocked by an IdP that provisions over SCIM — not migration work. Decided in [round 2 F](../round-2/F-provisioning.md). |

## Long-term (3)

Each needs something the QA instances don't have. They're listed in
[`../../long-term-goals.md`](../../long-term-goals.md), which says what each would unblock.

| gap | what | what it needs |
|---|---|---|
| round 1 C9 #5 | Controls › OS settings › Certificates: the Add modal's validation, add a certificate from a CA, delete it | A certificate-authority integration on the instance (SCEP, NDES or DigiCert; the flow used one named `android_test`). Round 1 noted it's config-only, with no Android device needed, so it's cheap once a CA exists. Listed under *Certificate authorities*. |
| round 1 C6 #25 | a `.rpm` installed through a policy automation on a Fedora host | A Fedora (RPM-based) VM. Listed under *Host types*. |
| round 1 C10 #5 | "Forgot password?" → the reset email → a new password | A mailbox the suite can read. Listed under *A readable mailbox*. |

## Moved back in after triage

- **round 1 C9 #2** (a bad setup-assistant profile is refused with Apple's error) was triaged long-term on the
  belief it needed an Apple Business Manager round trip. It does, but premium already has one:
  `SetOrUpdateMDMAppleSetupAssistant` validates every new profile with Apple through any ABM token
  (`server/mdm/apple/apple_mdm.go`, `ValidateSetupAssistant`), and `setup-assistant.spec.ts`'s valid upload
  passes on premium every night. It's in [batch F](F-mdm-setup-android.md).
