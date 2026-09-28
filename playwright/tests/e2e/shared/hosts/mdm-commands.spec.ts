/**
 * Shared • Hosts • A custom MDM command, sent and read back.
 *
 * Sends one MDM command to the real macOS VM with `fleetctl mdm run-command`,
 * then follows the answer through every place Fleet reports it:
 *
 *   - `fleetctl get mdm-command-results` — the host acknowledged it;
 *   - the host's Activity card — the activity, and with "Show MDM commands" on,
 *     the command itself, each opening the request and the host's response;
 *   - the dashboard activity feed.
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
 */
import * as fs from 'fs';
import { test, expect } from '@fixtures';
import { activityCopy } from '@helpers/activity-copy';
import { findOnlineHost, getHostMdmIdentity } from '@helpers/api';
import { fleetctl, output } from '@helpers/fleetctl';

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

test('a custom MDM command is acknowledged by the host and reported everywhere Fleet shows it', async ({
  hostDetails,
  dashboard,
  request,
}, testInfo) => {
  // The VM acknowledges in seconds, but only on its next MDM check-in.
  test.setTimeout(240_000);

  const host = await findOnlineHost(request, 'darwin', { kind: 'real' });
  expect(host, 'expected an online real macOS VM').not.toBeNull();
  const { hostname, enrollmentStatus } = await getHostMdmIdentity(request, host!.id);
  expect(enrollmentStatus, `${host!.displayName} must be MDM-enrolled to take a command`).toMatch(/^On/);

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
  const carriesThisCommand = async () => {
    await expect(details.requestPayload).toHaveValue(
      new RegExp(`<string>${REQUEST_TYPE}</string>.*<key>CommandUUID</key><string>${commandUuid}</string>`, 's'),
    );
    await expect(details.response).toHaveValue(
      new RegExp(`<string>${commandUuid}</string>\\s*<key>Status</key>\\s*<string>Acknowledged</string>`),
    );
  };

  // The activity. The newest custom-command activity on this host is this run's:
  // nothing else sends this host a UserList.
  await hostDetails.goto(host!.id);
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

  await dashboard.goto();
  await dashboard.expectActivity(
    activityCopy.mdmCommand.ran({ requestType: REQUEST_TYPE, host: host!.displayName }),
  );
});
