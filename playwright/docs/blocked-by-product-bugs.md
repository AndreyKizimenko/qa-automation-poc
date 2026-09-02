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
- This file is the durable record. The per-run triage write-ups it came from live
  in `docs/run-reviews/`, which is **gitignored** — so every root cause worth
  keeping has to be written out here, not left behind as a link.

## Active

| Flow / test | Spec | Scope | Fleet issue | Discovered | Unblock condition |
|---|---|---|---|---|---|
| Linux (deb) host → vulnerable software → version → CVE detail | [vulnerabilities.spec.ts:256](../tests/e2e/premium/software/vulnerabilities.spec.ts#L256) | premium, Unassigned | [fleetdm/fleet#49913](https://github.com/fleetdm/fleet/issues/49913) | 2026-07-22 (v4.90.0-rc; latent in GA ≥4.80) | CVE detail endpoint renders matched-but-unenriched CVEs (no 404) — then drop the `osKey === 'deb'` skip |
| Linux (deb) software titles → version → CVE detail | [vulnerabilities.spec.ts:161](../tests/e2e/premium/software/vulnerabilities.spec.ts#L161) | premium, Unassigned | [fleetdm/fleet#49913](https://github.com/fleetdm/fleet/issues/49913) | 2026-07-28 (v4.90.0-rc) | Same as above — one fix unblocks both deb variants |
| Every vulnerable-filtered software title reports vulnerability data | [vulnerabilities.spec.ts:102](../tests/e2e/premium/software/vulnerabilities.spec.ts#L102) | premium, Unassigned | [fleetdm/fleet#50059](https://github.com/fleetdm/fleet/issues/50059) | 2026-07-28 (v4.90.0-rc; latent in GA ≥4.80) | `vulnerable=true` respects the fleet scope (or the column shows the matching CVEs) — then un-skip the test |

## Ignored console errors

Not skips. When a product bug is *cosmetic* and the flow under test still passes,
the cheaper concession is to allow that one console error rather than skip the
test — the flow keeps its coverage and only the console assertion is relaxed.
Entries live in `DEFAULT_IGNORED_CONSOLE_ERRORS` in
[helpers/console.ts](../helpers/console.ts) and follow the same rules as above:
a filed issue, a `TODO(fleetdm/fleet#NNNNN)` at the entry, and a concrete
unblock condition.

| Ignored substring | Affected flows | Scope | Fleet issue | Discovered | Unblock condition |
|---|---|---|---|---|---|
| `theme-fleet.js` | Controls → Scripts → Library (every editor mount) | premium + free | [fleetdm/fleet#52434](https://github.com/fleetdm/fleet/issues/52434) | 2026-09-02 (v4.92.0-rc) | Scripts editor registers Fleet's ace theme again (`.ace_editor` carries `ace-fleet`, no request for `/assets/theme-fleet.js`) — then drop the allowlist entry |

### Notes

**#52434 — scripts editor loses Fleet's ace theme.** `components/Editor` renders
`<AceEditor theme="fleet">` but never imports the module that defines that
theme; it only worked because `components/SQLEditor` (which does
`import "./theme"`) used to be statically bundled, registering
`ace/theme/fleet` before any editor mounted. Fleet 4.92 made both editors
`React.lazy` into a shared `ace-editor` chunk (fleetdm/fleet#52038), and webpack
only *evaluates* the module actually imported — so a page that mounts `Editor`
without `SQLEditor` leaves the theme unregistered, ace falls back to fetching
`/assets/theme-fleet.js`, and Fleet 404s it. Verified on the DOM: the scripts
editor carries ace's default `ace-tm`, while the policy editor (a `SQLEditor`
consumer) still carries `ace-fleet`.

The upload / edit / save flows all pass — the failure was entirely the
`pageHealth` fixture reacting to the console error. Left as an ignored error
rather than a skip because skipping would have cost 9 tests plus ~30 more
aborted downstream in the same serial blocks, to hide a styling bug. Surfaced by
the 4.92 upgrade runs (13 premium / 8 free failures, reproducible 4/4).

**#49913 — CVE detail 404 for matched-but-unenriched CVEs.** Fleet lists a CVE
that's matched to host software (`software_cve` + `vulnerability_host_counts`,
host_count ≥ 1) but its premium detail endpoint inner-joins `cve_meta` and 404s
when the CVE has no NVD metadata yet — while the list treats `cve_meta` as
optional. The deb host's `accountsservice` package surfaces such CVEs
(CVE-2026-61897/61898), so the deb variant deterministically fails. Only the deb
variants are skipped; the macOS/Windows host→CVE variants still run (they land on
enriched CVEs today, but could hit the same bug if their newest CVE is ever
unenriched). First surfaced in premium run
[29901965767](https://github.com/AndreyKizimenko/qa-automation-poc/actions/runs/29901965767).

Both the host path and the software-titles path reach `accountsservice`'s
unenriched CVE, so both deb variants carry the skip — the titles path was added
after premium run
[30368075570](https://github.com/AndreyKizimenko/qa-automation-poc/actions/runs/30368075570)
hit the same 404 from the other direction.

*Re-verified 2026-09-02 on v4.92.0-rc — bug unfixed, trigger currently absent.*
The premium detail query is byte-identical in 4.92 (`FROM cve_meta cm JOIN (…)`,
still an inner join), so the defect is intact. But NVD metadata has since caught
up for the two CVEs we relied on: `CVE-2026-61897/61898` now return **200** with
`cvss_score 7.8`, `published 2026-08-20`, so the join succeeds and the deb
variants would pass today. **Keep the skips.** The failure condition is
data-dependent — it returns the moment `accountsservice`'s newest matched CVE is
one NVD hasn't published yet — and un-skipping would buy back two tests at the
cost of an intermittent failure that only reproduces on someone else's unlucky
day. Revisit when #49913 actually lands.

**#50059 — `vulnerable=true` is not fleet-scoped.** The software-titles filter
joins `software` → `software_cve` on `s.title_id = st.id` with no team predicate,
while the per-version payload resolves CVEs through scope-gated
`software_host_counts`. A title whose only vulnerable version sits on a host in
another fleet is therefore listed under the Vulnerable filter but renders `---`
in the Vulnerabilities column. On the premium QA instance `fuse3` does this: its
vulnerable `3.18.2-1` lives on one host in fleet `VMs`, while Unassigned carries
only non-vulnerable versions. Free is unaffected (single scope), so the free
counterpart of the assertion still runs. Surfaced in premium run
[30368075570](https://github.com/AndreyKizimenko/qa-automation-poc/actions/runs/30368075570).

*Re-verified 2026-09-02 on v4.92.0-rc — still reproduces.* `GET
/software/titles?vulnerable=true&fleet_id=0` returns `fuse3` (deb_packages) with
versions `3.10.5-1build1` / `3.10.5-1build1.1` and no CVEs on either — 1 of 200
titles in that scope shows the symptom. Skip stays as-is.

## Resolved

_None yet._
