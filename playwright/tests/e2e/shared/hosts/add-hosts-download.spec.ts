/**
 * Shared • Hosts • Add hosts — advanced enrollment downloads.
 *
 * The Add Hosts modal's Advanced tab downloads the Fleet certificate; the
 * "Plain osquery" reveal adds the enroll-secret and flagfile downloads.
 * Verifies each downloads with the expected content. Read-only (no state
 * mutation) and tier-agnostic → shared. Selecting "All fleets" makes the modal
 * show the global enroll secret (no-op on free, which is always global).
 */
import * as fs from 'fs';
import { test, expect } from '@fixtures';
import { getGlobalEnrollSecrets } from '@helpers/api';

test('Hosts — Add hosts modal downloads the certificate, enroll secret, and flagfile', async ({
  hostsList,
  request,
}) => {
  await hostsList.goto();
  await hostsList.teamDropdown.select('All fleets');

  await hostsList.openAddHosts();
  await hostsList.addHostsModal.openAdvanced();

  const certPath = await (await hostsList.addHostsModal.downloadCertificate()).path();
  expect(fs.readFileSync(certPath, 'utf-8')).toContain('BEGIN CERTIFICATE');

  await hostsList.addHostsModal.revealPlainOsquery();

  const globalSecrets = (await getGlobalEnrollSecrets(request)).map((s) => s.secret);
  const secretPath = await (await hostsList.addHostsModal.downloadEnrollSecret()).path();
  expect(globalSecrets).toContain(fs.readFileSync(secretPath, 'utf-8').trim());

  const flagfile = fs.readFileSync(
    await (await hostsList.addHostsModal.downloadFlagfile()).path(),
    'utf-8',
  );
  expect(flagfile).toContain('--enroll_secret_path=secret.txt');
  expect(flagfile).toContain('--tls_server_certs=fleet.pem');
});
