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
| Every vulnerable-filtered software title reports vulnerability data | [vulnerabilities.spec.ts:102](../tests/e2e/premium/software/vulnerabilities.spec.ts#L102) | premium, Unassigned | [fleetdm/fleet#50059](https://github.com/fleetdm/fleet/issues/50059) | 2026-07-28 (v4.90.0-rc; latent in GA ≥4.80) | `vulnerable=true` respects the fleet scope (or the column shows the matching CVEs) — then un-skip the test |

## Worked around in the suite

Not skips either. Where a product bug makes only *part* of the data un-navigable,
the test can steer around it and keep covering the flow. Same rules as above: a
filed issue, a `TODO(fleetdm/fleet#NNNNN)` at the workaround, and a concrete
unblock condition. Listed here so the workaround is found when the bug closes —
an un-skipped test hides its concession far better than a skipped one.

| Flow / test | Workaround | Scope | Fleet issue | Discovered | Unblock condition |
|---|---|---|---|---|---|
| software titles → version → CVE detail (macOS · deb · Windows) — [free](../tests/e2e/free/software/vulnerabilities.spec.ts#L104), [premium](../tests/e2e/premium/software/vulnerabilities.spec.ts#L146) | drill into a CVE whose detail endpoint answers, not the top row | both tiers; premium Unassigned | [fleetdm/fleet#49913](https://github.com/fleetdm/fleet/issues/49913) | 2026-07-22 (v4.90.0-rc; latent in GA ≥4.80) | detail endpoint renders matched-but-unenriched CVEs — then drop `findRenderableCve` and click the first row |
| host → vulnerable software → version → CVE detail (macOS · deb · Windows) — [free](../tests/e2e/free/software/vulnerabilities.spec.ts#L170), [premium](../tests/e2e/premium/software/vulnerabilities.spec.ts#L247) | same | both tiers; premium Unassigned | [fleetdm/fleet#49913](https://github.com/fleetdm/fleet/issues/49913) | 2026-07-22 (v4.90.0-rc; latent in GA ≥4.80) | same — one fix unblocks all six variants |
| delete a single host from host details — [host-delete.spec.ts:107](../tests/e2e/premium/hosts/host-delete.spec.ts#L107) | assert the generic `This will remove all host data` copy instead of the host's display name | premium (copy is tier-agnostic) | [fleetdm/fleet#53760](https://github.com/fleetdm/fleet/issues/53760) | 2026-09-22 (v4.93.0-rc; regressed from 4.92) | the single-host delete modal names the host again — then revert the assertion to `` `This will remove ${host.displayName}` `` |

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

_None active._

### Notes

**#49913 — CVE detail 404 for matched-but-unenriched CVEs.** Fleet matches a CVE
to host software (`software_cve`) and links it from the software-version page,
but the CVE detail endpoint inner-joins `cve_meta` and 404s
(*"This is not a known CVE. None of Fleet's vulnerability sources are aware of
this CVE."*) while the rest of the product treats that table as optional. The UI
renders the 404 as *"Vulnerability not detected — No hosts are affected by
CVE-…"*, so a drill-in that Fleet itself offered dead-ends on an empty state.
First surfaced in premium run
[29901965767](https://github.com/AndreyKizimenko/qa-automation-poc/actions/runs/29901965767)
on the deb host's `accountsservice` package (CVE-2026-61897/61898), then from the
software-titles direction in
[30368075570](https://github.com/AndreyKizimenko/qa-automation-poc/actions/runs/30368075570).

*Re-verified 2026-09-02 on v4.92.0-rc — bug unfixed, trigger absent.* The premium
detail query is byte-identical in 4.92 (`FROM cve_meta cm JOIN (…)`, still an
inner join). NVD had caught up for `CVE-2026-61897/61898` (both **200**,
`cvss_score 7.8`, `published 2026-08-20`), so the deb variants would have passed.
The skips stayed, on the reasoning that the trigger would return on someone's
unlucky day.

*It returned, on a platform nobody had skipped.* The free nightly failed this
flow **two nights running** — run
[35591082037](https://github.com/AndreyKizimenko/qa-automation-poc/actions/runs/35591082037)
(2026-09-21) on `CVE-2026-85893` and run
[35714274093](https://github.com/AndreyKizimenko/qa-automation-poc/actions/runs/35714274093)
(2026-09-22) on `CVE-2026-88097`, both via **Microsoft Edge 104.0.1293.47**
(`programs`, version id 1635 on free), both deterministic across all three
attempts. That is the escape the note above had predicted for macOS/Windows.

**The mechanism is a race with NVD enrichment, not a property of any platform.**
CVE-2026-88097 was matched onto that version at 08:31 UTC and the run started at
10:07 UTC; `GET /vulnerabilities/CVE-2026-88097` 404s. The *previous* night's
offender, CVE-2026-85893, returns **200** with `hosts_count: 166` a day later —
it healed once metadata landed. So any freshly-matched CVE 404s for a window of
hours, and the version-detail table sorts newest-CVE-first, which put the
un-renderable row at the top exactly where the test clicked. Worth noting for the
issue: for these very fresh matches `GET /vulnerabilities?query=<cve>` returns
**zero** results too, so `software/versions/:id` is ahead of both `cve_meta` *and*
`vulnerability_host_counts` — a step beyond the "list shows it, detail 404s"
shape originally filed.

**Concession changed from skip to workaround (2026-09-22).** Because the trigger
is the *newest* CVE rather than any platform, skipping per-OS was the wrong
instrument — it kept two deb tests dark while leaving four others exposed to the
same bug, and free's deb variant was never skipped at all. The six drill-in
variants now resolve which CVE to click through
[`findRenderableCve`](../helpers/api/software.ts), which probes the rendered CVEs
in page order and returns the first whose detail endpoint answers; the flow skips
only in the genuine dead end where *every* CVE on the version 404s. The two
`osKey === 'deb'` skips are gone.

Verified 2026-09-22 against both live instances: free's whole
`software/vulnerabilities` spec passes 11/11 with CVE-2026-88097 still 404ing (so
the probe is doing real work), and the two premium deb variants pass unskipped.
Note the premium deb pass is joint evidence — `accountsservice`'s CVEs are
enriched again today, so that pair would pass either way; the free Windows case is
the one that proves the workaround.

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

**#53760 — host-details delete modal stopped naming the host.** 4.93 split
`DeleteHostModal`'s body into per-platform variants and introduced
`removeAllDataSentence`, whose singular branch renders `This will remove all host
data…` and never calls `hostText()`. `HostDetailsPage` has always passed
`hostName={host?.display_name}` and `hostText()` returns it, so the name is
available and simply dropped. The result is inconsistent within the component:
for a single host, Android, the macOS one-time-secret body and the
unknown-platform fallback all still name it; only the macOS/Windows/Linux and
iOS/iPadOS paths don't, and those cover essentially every host.

Scope is **host details only**. The Hosts-list single-selection path never named
the host — on 4.92 `ManageHostsPage` passed no `hostName` and the modal read
*"This will remove **1 host** and associated data…"* — so that path went from
"1 host" to "all host data", which is a wash. What is odd is that 4.93 *added*
`hostName={selectedHosts.length === 1 ? selectedHosts[0].display_name :
undefined}` to `ManageHostsPage`, and the singular branch then discards it; that
dead plumbing is the strongest sign this is an oversight rather than a copy
decision. The change rode in on fleetdm/fleet#53167 (*One time enroll secrets
(3/3): Frontend*) with no changelog entry. Worked around rather than skipped
because the delete flow itself is healthy; only the copy moved.

## Resolved

| Flow / test | Concession | Fleet issue | Discovered | Resolved |
|---|---|---|---|---|
| Controls → Scripts → Library (every editor mount) | ignored `theme-fleet.js` console error | [fleetdm/fleet#52434](https://github.com/fleetdm/fleet/issues/52434) | 2026-09-02 (v4.92.0-rc) | 2026-09-03 — fixed by fleetdm/fleet#52441, cherry-picked as #52468 |

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

**Fixed 2026-09-03** by fleetdm/fleet#52441 (cherry-picked to the RC as #52468), which moves the
theme into a shared `utilities/ace_theme` module that `Editor`, `SQLEditor` and `YamlAce` all import,
so registration no longer depends on which editor mounts first. The allowlist entry is gone.

The upload / edit / save flows all passed throughout — the failure was entirely the
`pageHealth` fixture reacting to the console error. Left as an ignored error
rather than a skip because skipping would have cost 9 tests plus ~30 more
aborted downstream in the same serial blocks, to hide a styling bug. Surfaced by
the 4.92 upgrade runs (13 premium / 8 free failures, reproducible 4/4).
