/**
 * Builds a `.tar.gz` package in memory: one marker file at the archive's root.
 *
 * Fleet takes a tarball as a custom package for Linux as long as it comes with
 * an install and an uninstall script, and that is what a host gets whose own
 * package format Fleet takes no custom package of (Arch's `.pkg.tar.zst`).
 * fleetd unpacks the archive into the directory `$INSTALLER_PATH` names before
 * it runs the install script, so the script only has to put the marker where it
 * wants it; nothing in the archive runs.
 *
 * Fleet titles a tarball after its file name, extension and all
 * (`fleet-pw-x.tar.gz`), and keeps no inventory of it: whether it is installed
 * is what its scripts' exit codes said.
 */
import { tarGz } from './deb';

/** The file a tarball built here holds, at the archive's root. */
export const TARBALL_MARKER = 'marker.txt';

export function inertTarball(content: string): Buffer {
  return tarGz([{ path: `./${TARBALL_MARKER}`, data: Buffer.from(content) }], 9);
}
