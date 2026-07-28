# Flows blocked by Fleet product bugs

Tests (or sub-flows) that are `skip`ped **not** because the test is wrong, but
because a confirmed Fleet product bug makes the flow un-passable. Each row links
the filed Fleet issue so we can unblock the moment it's fixed.

**Rules of the road**
- Only list skips caused by a *product* defect with a filed issue. Flaky tests,
  test bugs, and intentional/perma-skips (e.g. tracked in `TODO.md`) don't belong here.
- Every entry must have a Fleet issue link and a concrete **unblock condition** —
  what has to be true to delete the skip.
- The skip in the spec must carry a matching `TODO(fleetdm/fleet#NNNNN)` comment
  pointing back here, so the two never drift.
- When the issue closes: re-run the flow against a build with the fix, and if it
  passes, remove the skip and move the row to **Resolved** (keep the history).

## Active

| Flow / test | Spec | Scope | Fleet issue | Discovered | Unblock condition |
|---|---|---|---|---|---|
| Linux (deb) host → vulnerable software → version → CVE detail | [vulnerabilities.spec.ts:218](../tests/e2e/premium/software/vulnerabilities.spec.ts#L218) | premium, Unassigned | [fleetdm/fleet#49913](https://github.com/fleetdm/fleet/issues/49913) | 2026-07-22 (v4.90.0-rc; latent in GA ≥4.80) | CVE detail endpoint renders matched-but-unenriched CVEs (no 404) — then drop the `osKey === 'deb'` skip |
| Linux (deb) software titles → version → CVE detail | [vulnerabilities.spec.ts:122](../tests/e2e/premium/software/vulnerabilities.spec.ts#L122) | premium, Unassigned | [fleetdm/fleet#49913](https://github.com/fleetdm/fleet/issues/49913) | 2026-07-28 (v4.90.0-rc) | Same as above — one fix unblocks both deb variants |
| Every vulnerable-filtered software title reports vulnerability data | [vulnerabilities.spec.ts:79](../tests/e2e/premium/software/vulnerabilities.spec.ts#L79) | premium, Unassigned | [fleetdm/fleet#50059](https://github.com/fleetdm/fleet/issues/50059) | 2026-07-28 (v4.90.0-rc; latent in GA ≥4.80) | `vulnerable=true` respects the fleet scope (or the column shows the matching CVEs) — then un-skip the test |

### Notes

**#49913 — CVE detail 404 for matched-but-unenriched CVEs.** Fleet lists a CVE
that's matched to host software (`software_cve` + `vulnerability_host_counts`,
host_count ≥ 1) but its premium detail endpoint inner-joins `cve_meta` and 404s
when the CVE has no NVD metadata yet — while the list treats `cve_meta` as
optional. The deb host's `accountsservice` package surfaces such CVEs
(CVE-2026-61897/61898), so the deb variant deterministically fails. Only the deb
variants are skipped; the macOS/Windows host→CVE variants still run (they land on
enriched CVEs today, but could hit the same bug if their newest CVE is ever
unenriched). Full triage + root cause: [run-reviews/2026-07-22-premium-run-29901965767.md](run-reviews/2026-07-22-premium-run-29901965767.md).

Both the host path and the software-titles path reach `accountsservice`'s
unenriched CVE, so both deb variants carry the skip — the titles path was added
after run 30368075570 hit the same 404 from the other direction
([run-reviews/2026-07-28-premium-run-30368075570.md](run-reviews/2026-07-28-premium-run-30368075570.md)).

**#50059 — `vulnerable=true` is not fleet-scoped.** The software-titles filter
joins `software` → `software_cve` on `s.title_id = st.id` with no team predicate,
while the per-version payload resolves CVEs through scope-gated
`software_host_counts`. A title whose only vulnerable version sits on a host in
another fleet is therefore listed under the Vulnerable filter but renders `---`
in the Vulnerabilities column. On the premium QA instance `fuse3` does this: its
vulnerable `3.18.2-1` lives on one host in fleet `VMs`, while Unassigned carries
only non-vulnerable versions. Free is unaffected (single scope), so the free
counterpart of the assertion still runs. Full triage + root cause:
[run-reviews/2026-07-28-premium-run-30368075570.md](run-reviews/2026-07-28-premium-run-30368075570.md).

## Resolved

_None yet._
