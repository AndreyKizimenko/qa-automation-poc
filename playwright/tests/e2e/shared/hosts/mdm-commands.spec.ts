/**
 * Shared • Hosts • A custom MDM command, sent and read back.
 *
 * Sends one MDM command to the real macOS VM with `fleetctl mdm run-command`,
 * then follows the answer through every place Fleet reports it:
 *
 *   - `fleetctl get mdm-command-results` — the host acknowledged it;
 *   - the host's Activity card — the activity, and with "Show MDM commands" on,
 *     the command itself, each opening the request and the host's response;
 *   - the activity log, through the API, keyed to the command's UUID;
 *   - the dashboard activity feed filtered to "Ran custom MDM command", whose
 *     row opens the same request and response.
 *
 * **The feed is read filtered, and right away.** The acknowledgement can take
 * minutes, and by then the other workers' activities can push an unfiltered row
 * past the pages a feed walk reads. Narrowed to custom MDM commands, this run's
 * row is near the top. The filter lives in the page's React state, so the row is
 * read from the filtered feed as rendered: a reload (which `expectActivity` does
 * while it waits) would drop the filter. The API check first proves the activity
 * exists, so the feed is never waited on for it.
 *
 * Every view is tied to *this* command by its UUID, which fleetctl prints and
 * the request payload carries, so an identical command sent by an earlier run
 * can't stand in for it.
 *
 * **The command is `UserList`: read-only.** It asks the Mac to list its local
 * users and changes nothing. Anything sent to a real VM must be — there are no
 * spare VMs and no re-provisioning; see the "Test hosts" rules in
 * `playwright/CLAUDE.md`.
 *
 * Tier-agnostic: free and premium send custom commands the same way and render
 * the same Activity card, toggle and details modal with the same copy.
 *
 * **Real VM only.** The command has to reach a device that answers it; an
 * MDM-enrolled osquery-perf simulation never acknowledges anything.
 *
 * **Windows takes an `<Exec>`.** A custom Windows command must be a single
 * `<Exec>` (`ParseWindowsMDMCommand`: "You can run only <Exec> command type."),
 * so there is no read-only `<Get>` to send. The second test sends Defender's
 * `UpdateSignature`, from Fleet's own command catalogue (`docs/mdm-commands.yml`):
 * a signature update Windows also runs by itself, which changes nothing else on
 * the VM (approved by Andrey, 2026-11-19). Fleet reports a Windows command by
 * its target (the LocURI) and the device's status code, 200 for a command it
 * ran, where Apple's say Acknowledged; Fleet shows 101 until the device answers,
 * on its next MDM sync. The activity feeds name it by the target's last segment
 * (".../UpdateSignature"), and a Windows host's Activity card has no "Show MDM
 * commands" switch, so the command's own status is read from the CLI. The device's answer is a whole SyncML message whose
 * header carries its MDM credential, so the test reads it without printing it.
 */
import * as fs from 'fs';
import { test, expect } from '@fixtures';
import { activityCopy } from '@helpers/activity-copy';
import { findActivity, getHostMdmIdentity, requireRealHost } from '@helpers/api';
import { fleetctl, output } from '@helpers/fleetctl';
import type { MdmCommandDetailsModal } from '@pages';

const REQUEST_TYPE = 'UserList';

const USER_LIST_PAYLOAD = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Command</key>
  <dict>
    <key>RequestType</key>
    <string>${REQUEST_TYPE}</string>
  </dict>
</dict>
</plist>
`;

test('a custom MDM command is acknowledged by the host and reported everywhere Fleet shows it', { tag: '@vm-macos' }, async ({
  hostDetails,
  dashboard,
  request,
}, testInfo) => {
  // The VM acknowledges in seconds, but only on its next MDM check-in.
  test.setTimeout(240_000);

  const host = await requireRealHost(request, 'darwin');
  const { hostname, enrollmentStatus } = await getHostMdmIdentity(request, host.id);
  expect(enrollmentStatus, `${host.displayName} must be MDM-enrolled to take a command`).toMatch(/^On/);

  const payloadPath = testInfo.outputPath('user-list.xml');
  fs.writeFileSync(payloadPath, USER_LIST_PAYLOAD);

  const sent = await fleetctl(['mdm', 'run-command', '--payload', payloadPath, '--hosts', hostname]);
  expect(sent.code, output(sent)).toBe(0);
  expect(sent.stdout).toContain('Hosts will run the command the next time they check into Fleet.');
  const commandUuid = sent.stdout.match(/fleetctl get mdm-command-results --id=([0-9a-f-]{36})/)?.[1];
  expect(commandUuid, `fleetctl printed no results hint:\n${sent.stdout}`).toBeDefined();

  // The CLI's own view of the answer: one host, this command, acknowledged.
  await expect
    .poll(
      async () => {
        const res = await fleetctl(['get', 'mdm-command-results', `--id=${commandUuid}`]);
        return res.stdout.match(/STATUS:\s*\n\s*(\S+)/)?.[1];
      },
      { message: `${hostname} never acknowledged ${commandUuid}`, timeout: 180_000, intervals: [5_000] },
    )
    .toBe('Acknowledged');
  const results = output(await fleetctl(['get', 'mdm-command-results', `--id=${commandUuid}`]));
  expect(results).toMatch(new RegExp(`TYPE:\\s*\\n\\s*${REQUEST_TYPE}\\b`));
  expect(results).toMatch(new RegExp(`HOSTNAME:\\s*\\n\\s*${hostname.replace(/\./g, '\\.')}\\b`));

  const details = hostDetails.mdmCommandDetailsModal;
  const carriesThisCommand = async (modal: MdmCommandDetailsModal = details) => {
    await expect(modal.requestPayload).toHaveValue(
      new RegExp(`<string>${REQUEST_TYPE}</string>.*<key>CommandUUID</key><string>${commandUuid}</string>`, 's'),
    );
    await expect(modal.response).toHaveValue(
      new RegExp(`<string>${commandUuid}</string>\\s*<key>Status</key>\\s*<string>Acknowledged</string>`),
    );
  };

  // The activity. The newest custom-command activity on this host is this run's:
  // nothing else sends this host a UserList.
  await hostDetails.goto(host.id);
  await hostDetails.showPastActivities();
  await hostDetails.showMdmCommands(false);
  await hostDetails
    .activityItem(activityCopy.mdmCommand.ranOnThisHost({ requestType: REQUEST_TYPE }))
    .first()
    .click();
  await details.expectOpen();
  await expect(details.statusMessage).toHaveText(
    activityCopy.mdmCommand.ranOnThisHost({ requestType: REQUEST_TYPE }),
  );
  await carriesThisCommand();
  await details.close();

  // The command itself, with "Show MDM commands" on. The switch swaps the feed
  // wholesale: activities give way to commands.
  await hostDetails.showMdmCommands(true);
  await expect(
    hostDetails.activityItem(activityCopy.mdmCommand.ranOnThisHost({ requestType: REQUEST_TYPE })),
  ).toHaveCount(0);
  await hostDetails
    .activityItem(activityCopy.mdmCommand.acknowledged({ requestType: REQUEST_TYPE }))
    .first()
    .click();
  await details.expectOpen();
  await expect(details.statusMessage).toContainText(
    `The ${REQUEST_TYPE} command was acknowledged by ${hostname}`,
  );
  await carriesThisCommand();
  await details.close();

  // Acknowledged means no longer upcoming.
  await hostDetails.showUpcomingActivities();
  await hostDetails.showMdmCommands(true);
  await expect(
    hostDetails.activityItem(new RegExp(`^The ${REQUEST_TYPE} command is pending\\.`)),
  ).toHaveCount(0);

  // The global feed, filtered to this activity type. The newest row for a UserList
  // on this host is this run's, and the modal's UUID check proves it. The activity
  // is looked up by its command UUID first; its actor is the API user fleetctl
  // signs in as, not the browser's admin.
  expect(
    await findActivity(request, 'ran_custom_mdm_command', (d) => d.command_uuid === commandUuid),
    `no ran_custom_mdm_command activity for ${commandUuid}`,
  ).toBeDefined();
  await dashboard.goto();
  await dashboard.selectActivityType('Ran custom MDM command');
  const feedRow = dashboard
    .activityRows(activityCopy.mdmCommand.ran({ requestType: REQUEST_TYPE, host: host.displayName }))
    .first();
  await expect(feedRow).toBeVisible();
  await feedRow.click();
  await dashboard.mdmCommandDetailsModal.expectOpen();
  await expect(dashboard.mdmCommandDetailsModal.statusMessage).toContainText(
    `ran ${REQUEST_TYPE} as a custom MDM command on ${hostname}.`,
  );
  await carriesThisCommand(dashboard.mdmCommandDetailsModal);
  await dashboard.mdmCommandDetailsModal.close();
});

const WINDOWS_TARGET = './Device/Vendor/MSFT/Defender/UpdateSignature';
/** How the activity feeds name a Windows command: the target's last segment (`getMdmCommandDisplayName`). */
const WINDOWS_TARGET_SHOWN = '.../UpdateSignature';

/** Fleet's catalogue entry for UpdateSignature, as a bare `<Exec>`. Fleet replaces the CmdID with the command's UUID. */
const UPDATE_SIGNATURE_PAYLOAD = `<Exec>
  <CmdID>pw-update-signature</CmdID>
  <Item>
    <Target>
      <LocURI>${WINDOWS_TARGET}</LocURI>
    </Target>
    <Meta>
      <Format xmlns="syncml:metinf">chr</Format>
      <Type>text/plain</Type>
    </Meta>
  </Item>
</Exec>
`;

/** One field of `fleetctl get mdm-command-results`, which prints each as `NAME:` with its value on the next line. */
const resultField = (out: string, name: string): string | undefined =>
  out.match(new RegExp(`${name}:\\s*\\n\\s*(\\S+)`))?.[1];

test('a custom Windows MDM command is run by the host and reported everywhere Fleet shows it', { tag: '@vm-windows' }, async ({
  hostDetails,
  dashboard,
  request,
}, testInfo) => {
  // The VM answers on its next MDM sync: about two minutes on 2026-11-19.
  test.setTimeout(420_000);

  const host = await requireRealHost(request, 'windows');
  const { hostname, enrollmentStatus } = await getHostMdmIdentity(request, host.id);
  expect(enrollmentStatus, `${host.displayName} must be MDM-enrolled to take a command`).toMatch(/^On/);

  const payloadPath = testInfo.outputPath('update-signature.xml');
  fs.writeFileSync(payloadPath, UPDATE_SIGNATURE_PAYLOAD);

  const sent = await fleetctl(['mdm', 'run-command', '--payload', payloadPath, '--hosts', hostname]);
  expect(sent.code, output(sent)).toBe(0);
  const commandUuid = sent.stdout.match(/fleetctl get mdm-command-results --id=([0-9a-f-]{36})/)?.[1];
  expect(commandUuid, `fleetctl printed no results hint:\n${sent.stdout}`).toBeDefined();

  // The CLI's view: one host, this target, status 200. Only the fields are read, never printed whole.
  let results = '';
  await expect
    .poll(
      async () => {
        results = (await fleetctl(['get', 'mdm-command-results', `--id=${commandUuid}`])).stdout;
        return resultField(results, 'STATUS');
      },
      { message: `${hostname} never ran ${commandUuid}`, timeout: 360_000, intervals: [10_000] },
    )
    .toBe('200');
  expect(resultField(results, 'TYPE')).toBe(WINDOWS_TARGET);
  expect(resultField(results, 'HOSTNAME')?.toLowerCase()).toBe(hostname.toLowerCase());

  const details = hostDetails.mdmCommandDetailsModal;
  // The request carries this command's UUID, and the device's answer holds a Status element for it, 200. Read
  // as a yes or no: the answer's header carries the device's MDM credential, which a failure must not print.
  const ranThisCommand = new RegExp(`<CmdRef>${commandUuid}</CmdRef>\\s*<Cmd>Exec</Cmd>\\s*<Data>200</Data>`);
  const carriesThisCommand = async (modal: MdmCommandDetailsModal = details) => {
    await expect(modal.requestPayload).toHaveValue(
      new RegExp(`<CmdID>${commandUuid}</CmdID>.*<LocURI>${WINDOWS_TARGET.replace(/\./g, '\\.')}</LocURI>`, 's'),
    );
    await expect
      .poll(async () => ranThisCommand.test(await modal.response.inputValue()), {
        message: `the response from ${hostname} has no status 200 for ${commandUuid}`,
      })
      .toBe(true);
  };

  // The activity, on the host's Activity card. A Windows host's card has no "Show MDM commands" switch (Host
  // details offers it to Apple hosts only, `canGetMDMCommands`), so the command's own status is the CLI's above.
  await hostDetails.goto(host.id);
  await hostDetails.showPastActivities();
  const ranOnThisHost = activityCopy.mdmCommand.ranOnThisHost({ requestType: WINDOWS_TARGET_SHOWN });
  await hostDetails.activityItem(ranOnThisHost).first().click();
  await details.expectOpen();
  await expect(details.statusMessage).toHaveText(ranOnThisHost);
  await carriesThisCommand();
  await details.close();

  // The global feed, filtered to custom commands, tied to this command by its UUID first.
  expect(
    await findActivity(request, 'ran_custom_mdm_command', (d) => d.command_uuid === commandUuid),
    `no ran_custom_mdm_command activity for ${commandUuid}`,
  ).toBeDefined();
  await dashboard.goto();
  await dashboard.selectActivityType('Ran custom MDM command');
  const feedRow = dashboard
    .activityRows(activityCopy.mdmCommand.ran({ requestType: WINDOWS_TARGET_SHOWN, host: host.displayName }))
    .first();
  await expect(feedRow).toBeVisible();
  await feedRow.click();
  await dashboard.mdmCommandDetailsModal.expectOpen();
  await carriesThisCommand(dashboard.mdmCommandDetailsModal);
  await dashboard.mdmCommandDetailsModal.close();
});
