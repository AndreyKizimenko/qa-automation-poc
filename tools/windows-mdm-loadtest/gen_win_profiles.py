#!/usr/bin/env python3
"""
Generate a realistic batch of 100 Windows MDM (SyncML) configuration profiles for
the Fleet Windows MDM load test (infrastructure/loadtesting/terraform/windows-mdm-loadtest.md).

Design goals (from the "Profile realism" section of the runbook):
  - Mirror the LocURI-count distribution of the real profiles in
    it-and-security/lib/windows/configuration-profiles/ (mode at 1 LocURI,
    a meaningful multi-LocURI tail up to 5-6), NOT 100 trivial single-setting profiles.
  - Each profile is valid per Fleet's validator (server/fleet/windows_mdm.go):
      * top-level elements are <Replace>/<Add> (no <Atomic> here, matching the real files)
      * every <LocURI> starts with "./" and contains no ".." segments
      * NO <?xml ...?> processing instruction (Fleet rejects ProcInst)
      * no BitLocker / Fleet-reserved LocURIs
  - LocURIs are globally unique across the whole batch (safe against any cross-profile
    dedup and closer to production, where two profiles rarely target the same setting).
    They are built from real Policy-CSP path families plus a unique disambiguator; the
    simulated osquery-perf hosts ACK everything, so only byte-size/structure realism matters.

Usage:
  python3 gen_win_profiles.py --out ./profiles_A --prefix "LoadTest A" \
      --json ./batch_A.json
  python3 gen_win_profiles.py --out ./profiles_B --prefix "LoadTest B" \
      --json ./batch_B.json   # scenario 4 "differently named" replacement set

  # Scenario "update" (in-place modify) — bump the revision to change every profile's
  # <Data> bytes while keeping the SAME names and SAME LocURIs as batch A. Re-applying
  # this declaratively is a pure modification of all 100 profiles (no add/remove churn),
  # which forces Fleet to re-verify + re-push to every host. Used to generate concurrent
  # modification-path writer load, e.g. alongside the cert-ingestion loadtest for #49705.
  python3 gen_win_profiles.py --out ./profiles_A_r2 --prefix "LoadTest A" --rev 2 \
      --json ./batch_A_r2.json

Outputs:
  <out>/*.xml         one file per profile (usable for GitOps custom_settings)
  <json>              ready-to-POST body for /api/latest/fleet/mdm/profiles/batch
                      -> {"profiles":[{"name":..,"contents":<base64>}, ...]}
"""
import argparse, base64, json, os, sys

# 100-profile LocURI-count distribution. Mirrors the real 8-file shape (mode=1, tail to 6)
# but enriches the multi-LocURI share to ~55% so per-session payload + verification are
# exercised the way production hits them.
#   count -> number of profiles carrying that many LocURIs
DIST = {1: 45, 2: 20, 3: 15, 4: 8, 5: 7, 6: 5}   # sum = 100 profiles, 227 LocURIs total

# Real Windows Policy-CSP path families (area + leaf), used as realistic bases. A unique
# index is appended to guarantee global uniqueness while keeping realistic path length.
CSP_BASES = [
    ("./Device/Vendor/MSFT/Policy/Config/DeviceLock", "MinimumPasswordLength", "int", "10"),
    ("./Device/Vendor/MSFT/Policy/Config/DeviceLock", "PasswordComplexity", "int", "1"),
    ("./Device/Vendor/MSFT/Policy/Config/DeviceLock", "MaxDevicePasswordFailedAttempts", "int", "10"),
    ("./Device/Vendor/MSFT/Policy/Config/DeviceLock", "MaxInactivityTimeDeviceLock", "int", "15"),
    ("./Device/Vendor/MSFT/Policy/Config/Defender", "AllowRealtimeMonitoring", "int", "1"),
    ("./Device/Vendor/MSFT/Policy/Config/Defender", "AllowCloudProtection", "int", "1"),
    ("./Device/Vendor/MSFT/Policy/Config/Defender", "PUAProtection", "int", "1"),
    ("./Device/Vendor/MSFT/Policy/Config/Defender", "AllowBehaviorMonitoring", "int", "1"),
    ("./Vendor/MSFT/Firewall/MdmStore/DomainProfile", "EnableFirewall", "bool", "true"),
    ("./Vendor/MSFT/Firewall/MdmStore/PrivateProfile", "EnableFirewall", "bool", "true"),
    ("./Vendor/MSFT/Firewall/MdmStore/PublicProfile", "EnableFirewall", "bool", "true"),
    ("./Vendor/MSFT/Firewall/MdmStore/DomainProfile", "AllowLocalPolicyMerge", "bool", "false"),
    ("./Device/Vendor/MSFT/Policy/Config/Update", "AllowAutoUpdate", "int", "4"),
    ("./Device/Vendor/MSFT/Policy/Config/Update", "DeferQualityUpdatesPeriodInDays", "int", "7"),
    ("./Device/Vendor/MSFT/Policy/Config/Update", "DeferFeatureUpdatesPeriodInDays", "int", "14"),
    ("./Device/Vendor/MSFT/Policy/Config/Bluetooth", "AllowDiscoverableMode", "int", "0"),
    ("./Device/Vendor/MSFT/Policy/Config/Camera", "AllowCamera", "int", "1"),
    ("./Device/Vendor/MSFT/Policy/Config/Connectivity", "AllowUSBConnection", "int", "1"),
    ("./Device/Vendor/MSFT/Policy/Config/Browser", "AllowPasswordManager", "int", "0"),
    ("./Device/Vendor/MSFT/Policy/Config/Experience", "AllowCortana", "int", "0"),
    ("./Device/Vendor/MSFT/Policy/Config/System", "AllowTelemetry", "int", "1"),
    ("./Device/Vendor/MSFT/Policy/Config/WindowsInkWorkspace", "AllowWindowsInkWorkspace", "int", "1"),
    ("./Device/Vendor/MSFT/Policy/Config/RemoteDesktopServices", "AllowUsersToConnectRemotely", "int", "0"),
    ("./Device/Vendor/MSFT/Policy/Config/Storage", "RemovableDiskDenyWriteAccess", "int", "1"),
    ("./Device/Vendor/MSFT/Policy/Config/SmartScreen", "EnableSmartScreenInShell", "int", "1"),
]

# A larger data blob (chr) to occasionally emit ADMX-style settings with sizeable payloads,
# mirroring "Advanced PowerShell logging" (raw_command XML size realism).
ADMX_CHR = ("<![CDATA[<enabled/><data id=\"ExecutionPolicy\" value=\"AllSigned\"/>"
            "<data id=\"Listbox_ModuleNames\" value=\"*\"/>"
            "<data id=\"OutputDirectory\" value=\"false\"/>"
            "<data id=\"EnableScriptBlockInvocationLogging\" value=\"true\"/>]]>")


def loc_uri(base, leaf, ns, gidx):
    # append a per-batch namespace + unique index. The namespace (derived from the profile
    # name prefix) keeps two batches' LocURIs DISJOINT, which matters for scenario 4: a
    # "replace" whose new profiles reuse the old LocURIs trips Fleet's LocURI-protection path
    # (deletes of settings still targeted by a retained profile are suppressed), so the old
    # profiles' host rows never clean up and hosts show 200 profiles instead of 100.
    # format-valid: "./" prefix, no ".." segments.
    return f"{base}/{leaf}_{ns}{gidx:04d}"


def replace_block(locuri, fmt, data, cmdid, rev=0):
    # rev>0 mutates the <Data> bytes (NOT the LocURI or profile name) so a re-apply is seen
    # as an in-place modification of the same profile and re-pushed. The Windows validator
    # does not check Data against Format, and osquery-perf ACKs everything, so a rev suffix
    # is safe. Every setting changes, so all 100 profiles get a new checksum.
    if fmt == "chr":
        admx = ADMX_CHR if rev == 0 else ADMX_CHR.replace(
            "]]>", f'<data id="FleetLoadtestRev" value="{rev}"/>]]>')
        data_xml = f"    <Data>\n      {admx}\n    </Data>"
    else:
        data_disp = data if rev == 0 else f"{data}_r{rev}"
        data_xml = f"    <Data>{data_disp}</Data>"
    return (
        "<Replace>\n"
        f"  <CmdID>{cmdid}</CmdID>\n"
        "  <Item>\n"
        "    <Meta>\n"
        f'      <Format xmlns="syncml:metinf">{fmt}</Format>\n'
        "    </Meta>\n"
        "    <Target>\n"
        f"      <LocURI>{locuri}</LocURI>\n"
        "    </Target>\n"
        f"{data_xml}\n"
        "  </Item>\n"
        "</Replace>"
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True, help="output dir for .xml files")
    ap.add_argument("--prefix", default="LoadTest", help="profile name prefix")
    ap.add_argument("--json", default=None, help="write batch API JSON body here")
    ap.add_argument("--rev", type=int, default=0,
                    help="revision >0 changes every profile's <Data> bytes while keeping "
                         "identical names + LocURIs, so a re-apply is an in-place MODIFY "
                         "(re-push to all hosts) rather than add/remove. Bump it each time.")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)

    # build the ordered list of per-profile LocURI counts
    counts = []
    for n, k in sorted(DIST.items()):
        counts += [n] * k
    assert len(counts) == 100, f"distribution sums to {len(counts)}, expected 100"

    # per-batch LocURI namespace derived from the name prefix (e.g. "LoadTest A" -> "a_",
    # "LoadTest B" -> "b_"). Guarantees batch A and batch B target DISJOINT LocURIs so the
    # scenario-4 replace exercises real remove+install churn instead of tripping LocURI
    # protection. Falls back to a hash-ish token if the prefix has no distinguishing tail.
    ns_token = "".join(ch for ch in args.prefix.lower() if ch.isalnum()) + "_"

    gidx = 0          # global LocURI disambiguator -> uniqueness across the whole batch
    profiles_json = []
    total_locuris = 0
    for pi, ncount in enumerate(counts, start=1):
        blocks = []
        for si in range(ncount):
            base, leaf, fmt, data = CSP_BASES[gidx % len(CSP_BASES)]
            # every ~7th single-value setting becomes a chr/ADMX blob for payload variety
            use_chr = (gidx % 7 == 0)
            blocks.append(replace_block(
                loc_uri(base, leaf, ns_token, gidx),
                "chr" if use_chr else fmt,
                data,
                si + 1,
                rev=args.rev,
            ))
            gidx += 1
            total_locuris += 1
        body = "\n".join(blocks) + "\n"
        name = f"{args.prefix} {pi:03d} ({ncount}loc)"
        fname = f"{args.prefix.replace(' ', '_').lower()}_{pi:03d}.xml"
        with open(os.path.join(args.out, fname), "w") as f:
            f.write(body)
        profiles_json.append({
            "name": name,
            "contents": base64.b64encode(body.encode()).decode(),
        })

    rev_note = "" if args.rev == 0 else (
        f", rev={args.rev} (same names+LocURIs as rev 0, changed Data -> in-place modify)")
    print(f"wrote {len(profiles_json)} profiles to {args.out} "
          f"({total_locuris} LocURIs total, avg {total_locuris/100:.2f}/profile){rev_note}")

    if args.json:
        with open(args.json, "w") as f:
            json.dump({"profiles": profiles_json}, f)
        print(f"wrote batch API body to {args.json}")


if __name__ == "__main__":
    main()
