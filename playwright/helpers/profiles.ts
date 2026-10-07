/**
 * Configuration profiles built at run time on the pattern of the committed inert
 * pair — `test-data/{apple/macos,windows}/profiles/fleet-pw-inert.*`, whose READMEs
 * say why each is safe to deliver to a real VM. Every profile the suite uploads
 * reaches a VM sooner or later, so nothing here may ever carry a payload that
 * gates access to a host. Each generator is a payload Andrey approved for the
 * VMs: a preference domain nothing reads, Game DVR off, Apple's no-op
 * test declaration, and one meant to be refused — **except the two at the end**,
 * which force OS updates and are for fleets without real hosts only.
 *
 * A spec that uploads several profiles at once, or runs beside another that does,
 * needs each one to be its own:
 *
 *  - Fleet refuses a second profile with the same name, or the same macOS
 *    `PayloadIdentifier`, on one fleet;
 *  - two macOS profiles managing one preference domain overlap on the host, so
 *    each profile here gets a domain of its own — which is also what lets a spec
 *    read *this* profile's effect back with {@link readManagedPreferenceDomain};
 *  - two Windows profiles setting one LocURI undo each other: deleting either
 *    sends a `<Delete>` for it. There is one approved inert Windows setting, so a
 *    fleet may hold only one generated Windows profile at a time.
 *
 * Every name starts `pw-`, which is what the cleanup sweep removes.
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface GeneratedProfile {
  /** What Fleet lists the profile as. */
  name: string;
  fileName: string;
  content: string;
}

export interface InertAppleProfile extends GeneratedProfile {
  /** The preference domain the profile manages, and the one key it sets there. */
  domain: string;
  marker: string;
}

export interface InertWindowsProfile extends GeneratedProfile {
  /** The `PolicyManager` area and value name Windows records the setting under. */
  policyArea: string;
  policyName: string;
  /** What the value reads while the profile is on the host. */
  appliedValue: string;
}

const OWN_NAME = /^pw-[a-z0-9-]+$/;

/** The acknowledgement the OS update generators demand — checked at run time too, for untyped callers. */
function assertNoRealHosts(ack: { noRealHostsOnFleet: true }): void {
  if (ack?.noRealHostsOnFleet !== true) throw new Error('OS update profiles are only for a fleet with no real hosts');
}

function assertOwnName(name: string): void {
  if (!OWN_NAME.test(name)) {
    throw new Error(`generated profile names must match ${OWN_NAME} so the cleanup sweep finds them — got "${name}"`);
  }
}

/**
 * A macOS profile that writes one marker key to a preference domain of its own,
 * `com.fleetdm.qa.playwright.<name>`. Fleet lists it by `name` (its
 * `PayloadDisplayName`).
 */
export function inertMobileconfig(name: string): InertAppleProfile {
  assertOwnName(name);
  const domain = `com.fleetdm.qa.playwright.${name}`;
  const marker = `fleet-playwright-${name}`;
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>PayloadContent</key>
	<array>
		<dict>
			<key>PayloadDisplayName</key>
			<string>${name} setting</string>
			<key>PayloadIdentifier</key>
			<string>${domain}.setting</string>
			<key>PayloadType</key>
			<string>${domain}</string>
			<key>PayloadUUID</key>
			<string>${crypto.randomUUID().toUpperCase()}</string>
			<key>PayloadVersion</key>
			<integer>1</integer>
			<key>Marker</key>
			<string>${marker}</string>
		</dict>
	</array>
	<key>PayloadDisplayName</key>
	<string>${name}</string>
	<key>PayloadIdentifier</key>
	<string>${domain}</string>
	<key>PayloadScope</key>
	<string>System</string>
	<key>PayloadType</key>
	<string>Configuration</string>
	<key>PayloadUUID</key>
	<string>${crypto.randomUUID().toUpperCase()}</string>
	<key>PayloadVersion</key>
	<integer>1</integer>
</dict>
</plist>
`;
  return { name, fileName: `${name}.mobileconfig`, content, domain, marker };
}

/**
 * A Windows profile that turns Game DVR off — the committed fixture's setting,
 * under a name of its own. Fleet names a Windows profile after its file, so it
 * lists as `name`.
 */
export function inertWindowsProfile(name: string): InertWindowsProfile {
  assertOwnName(name);
  const content = `<Replace>
  <!-- Turns off Windows Game Recording and Broadcasting (Game DVR) -->
  <Item>
    <Meta>
      <Format xmlns="syncml:metinf">int</Format>
    </Meta>
    <Target>
      <LocURI>./Device/Vendor/MSFT/Policy/Config/ApplicationManagement/AllowGameDVR</LocURI>
    </Target>
    <Data>0</Data>
  </Item>
</Replace>
`;
  return {
    name,
    fileName: `${name}.xml`,
    content,
    policyArea: 'ApplicationManagement',
    policyName: 'AllowGameDVR',
    appliedValue: '0',
  };
}

export interface InertDeclaration extends GeneratedProfile {
  /** The declaration's `Identifier`, what the device reports its status under. */
  identifier: string;
}

/**
 * An Apple DDM declaration of Apple's own test type,
 * `com.apple.configuration.management.test`: its only payload is a string the
 * device echoes back in its status report, and it configures nothing. Fleet
 * names a declaration after its file, so it lists as `name`.
 */
export function inertDeclaration(name: string): InertDeclaration {
  assertOwnName(name);
  const identifier = `com.fleetdm.qa.playwright.${name}`;
  // Apple caps a declaration's Identifier at 64 bytes, and Fleet enforces it.
  if (identifier.length > 64) throw new Error(`declaration identifier over 64 bytes: ${identifier}`);
  const content = `${JSON.stringify(
    {
      Type: 'com.apple.configuration.management.test',
      Identifier: identifier,
      Payload: { Echo: `fleet-playwright-${name}` },
    },
    null,
    2,
  )}\n`;
  return { name, fileName: `${name}.json`, content, identifier };
}

/**
 * A macOS profile the Mac refuses at install, so Fleet retries it and then
 * reports it Failed. Its one payload is a Wi-Fi network with no `SSID_STR`, the
 * key a Wi-Fi payload can't do without — Andrey's
 * `device-rejects/macos-wifi-missing-ssid.mobileconfig`, approved for the VMs,
 * with `AutoJoin` off. Were it ever accepted it would still change nothing:
 * a network with no name can't be joined, and the VMs have no Wi-Fi interface
 * — their network is virtual ethernet. (An unknown `com.apple.` payload type,
 * the obvious choice, isn't refused: macOS 26.6 installs it as a preference
 * domain.)
 */
export function rejectedMobileconfig(name: string): GeneratedProfile {
  assertOwnName(name);
  const identifier = `com.fleetdm.qa.playwright.${name}`;
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>PayloadContent</key>
	<array>
		<dict>
			<key>PayloadDisplayName</key>
			<string>${name} Wi-Fi without SSID</string>
			<key>PayloadIdentifier</key>
			<string>${identifier}.wifi</string>
			<key>PayloadType</key>
			<string>com.apple.wifi.managed</string>
			<key>PayloadUUID</key>
			<string>${crypto.randomUUID().toUpperCase()}</string>
			<key>PayloadVersion</key>
			<integer>1</integer>
			<key>EncryptionType</key>
			<string>WPA2</string>
			<key>HIDDEN_NETWORK</key>
			<false/>
			<key>AutoJoin</key>
			<false/>
		</dict>
	</array>
	<key>PayloadDisplayName</key>
	<string>${name}</string>
	<key>PayloadIdentifier</key>
	<string>${identifier}</string>
	<key>PayloadScope</key>
	<string>System</string>
	<key>PayloadType</key>
	<string>Configuration</string>
	<key>PayloadUUID</key>
	<string>${crypto.randomUUID().toUpperCase()}</string>
	<key>PayloadVersion</key>
	<integer>1</integer>
</dict>
</plist>
`;
  return { name, fileName: `${name}.mobileconfig`, content };
}

/** Writes a generated profile into `dir` (a test's output dir) for the upload modal's file input. */
export function writeProfile(profile: GeneratedProfile, dir: string): string {
  const file = path.join(dir, profile.fileName);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, profile.content);
  return file;
}

/** A short id for this run's names — distinct across workers and reruns. */
export function runNonce(): string {
  return `${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;
}

// ── OS update profiles — never for a fleet with real hosts ────────────────────
//
// Everything above is safe on a VM. These two are not: delivered to a real host,
// each makes it download and install an OS update and restart. They exist for
// the DDM-conflict spec, which uploads them only to Workstations — a fleet with
// no hosts — to see Fleet refuse them. The `noRealHostsOnFleet: true` argument is
// the caller saying so; check it (`listFleetHosts(…).filter((h) => h.real)`)
// before uploading.

/**
 * A DDM `softwareupdate.enforcement.specific` declaration: install `version` by
 * `localDateTime`. Fleet refuses it on a fleet with OS updates configured.
 */
export function updateEnforcementDeclaration(
  name: string,
  opts: { version: string; localDateTime: string; noRealHostsOnFleet: true },
): GeneratedProfile {
  assertOwnName(name);
  assertNoRealHosts(opts);
  const content = `${JSON.stringify(
    {
      Type: 'com.apple.configuration.softwareupdate.enforcement.specific',
      Identifier: `com.fleetdm.qa.playwright.${name}`,
      Payload: { TargetOSVersion: opts.version, TargetLocalDateTime: opts.localDateTime },
    },
    null,
    2,
  )}\n`;
  return { name, fileName: `${name}.json`, content };
}

/**
 * A Windows profile under the Update CSP (`./Device/Vendor/MSFT/Policy/Config/Update`),
 * the node Fleet reserves for its own Windows update settings: a quality-update
 * deadline. Fleet refuses it on a fleet with Windows updates configured.
 */
export function windowsUpdateProfile(name: string, opts: { noRealHostsOnFleet: true }): GeneratedProfile {
  assertOwnName(name);
  assertNoRealHosts(opts);
  const content = `<Replace>
  <Item>
    <Meta>
      <Format xmlns="syncml:metinf">int</Format>
    </Meta>
    <Target>
      <LocURI>./Device/Vendor/MSFT/Policy/Config/Update/ConfigureDeadlineForQualityUpdates</LocURI>
    </Target>
    <Data>7</Data>
  </Item>
</Replace>
`;
  return { name, fileName: `${name}.xml`, content };
}
