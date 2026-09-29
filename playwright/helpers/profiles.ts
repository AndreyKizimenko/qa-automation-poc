/**
 * Configuration profiles built at run time on the pattern of the committed inert
 * pair — `test-data/{apple/macos,windows}/profiles/fleet-pw-inert.*`, whose READMEs
 * say why each is safe to deliver to a real VM. Every profile the suite uploads
 * reaches a VM sooner or later, so nothing here may ever carry a payload that
 * gates access to a host. Each generator is a payload Andrey approved for the
 * VMs (batch E): a preference domain nothing reads, Game DVR off, Apple's no-op
 * test declaration, and a profile macOS refuses outright.
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
 * reports it Failed — with nothing ever applied. Its one payload has an unknown
 * `com.apple.` type, which macOS rejects; an unknown type *outside* `com.apple.`
 * would be installed as a custom preference domain instead (what
 * {@link inertMobileconfig} relies on).
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
			<string>${name} unknown payload</string>
			<key>PayloadIdentifier</key>
			<string>${identifier}.inner</string>
			<key>PayloadType</key>
			<string>com.apple.fleet.nonexistent.payloadtype</string>
			<key>PayloadUUID</key>
			<string>${crypto.randomUUID().toUpperCase()}</string>
			<key>PayloadVersion</key>
			<integer>1</integer>
			<key>MadeUpKey</key>
			<string>made-up-value</string>
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
