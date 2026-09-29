/**
 * Builds a minimal, valid Debian package in memory — the same shape
 * `test-data/linux/software/make-deb.py` writes to disk, for specs that need a
 * package whose name, version, architecture or size is decided at run time:
 *
 *  - install/uninstall specs give each run's package a title no other spec (or
 *    earlier run) can share;
 *  - an `amd64` package on the aarch64 Linux VMs is a deterministic failed
 *    install (dpkg refuses the architecture), with nothing touching the host;
 *  - the large-upload spec needs ~100 MB that is still a real package Fleet
 *    accepts, so the upload ends in success rather than a parse error.
 *
 * The package holds only what `files` lists — by convention one marker under
 * `/usr/share/<name>/` — and no maintainer scripts, so installing it changes
 * nothing on the host beyond that file, and dpkg removes it cleanly.
 *
 * The `ar` container is written by hand for the reason `make-deb.py` gives:
 * Fleet recognises a `.deb` by the magic `!<arch>\ndebian`, so `debian-binary`
 * must be the first member. Standard library only.
 */
import * as zlib from 'zlib';

export interface DebFile {
  /** Absolute install path, e.g. `/usr/share/fleet-pw-x/marker.txt`. */
  path: string;
  content: Buffer | string;
}

export interface DebSpec {
  /** The `Package:` field — which is also the title Fleet lists. */
  name: string;
  version: string;
  /** `all` installs anywhere; a mismatched one (amd64 on arm64) is refused by dpkg. */
  arch: 'all' | 'amd64' | 'arm64';
  files: DebFile[];
  /** gzip level for the payload. 0 stores it, which is what a large, incompressible payload wants. */
  compressionLevel?: number;
}

const MTIME = 0;

/** One ustar entry: a 512-byte header and the content padded to 512. */
function tarEntry(path: string, data: Buffer, type: '0' | '5' = '0'): Buffer {
  const header = Buffer.alloc(512);
  const write = (value: string, offset: number, length: number) =>
    header.write(value.slice(0, length), offset, length, 'ascii');
  const octal = (value: number, length: number) =>
    (value.toString(8).padStart(length - 1, '0') + '\0');

  write(path, 0, 100);
  write(octal(type === '5' ? 0o755 : 0o644, 8), 100, 8);
  write(octal(0, 8), 108, 8);
  write(octal(0, 8), 116, 8);
  write(octal(data.length, 12), 124, 12);
  write(octal(MTIME, 12), 136, 12);
  header.fill(' ', 148, 156);
  write(type, 156, 1);
  write('ustar\0', 257, 6);
  write('00', 263, 2);
  write('root', 265, 32);
  write('root', 297, 32);
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8);

  const padding = Buffer.alloc((512 - (data.length % 512)) % 512);
  return Buffer.concat([header, data, padding]);
}

/** A gzipped tar of `entries`, with the parent directories dpkg expects. */
function tarGz(entries: Array<{ path: string; data: Buffer }>, level: number): Buffer {
  const dirs = new Set<string>();
  for (const { path } of entries) {
    const parts = path.replace(/^\.\//, '').split('/').slice(0, -1);
    for (let i = 1; i <= parts.length; i++) dirs.add(`./${parts.slice(0, i).join('/')}/`);
  }
  const blocks = [
    ...[...dirs].sort().map((dir) => tarEntry(dir, Buffer.alloc(0), '5')),
    ...entries.map(({ path, data }) => tarEntry(path, data)),
    Buffer.alloc(1024),
  ];
  return zlib.gzipSync(Buffer.concat(blocks), { level });
}

function arMember(name: string, data: Buffer): Buffer {
  const header =
    name.padEnd(16) +
    String(MTIME).padEnd(12) +
    '0'.padEnd(6) +
    '0'.padEnd(6) +
    '100644'.padEnd(8) +
    String(data.length).padEnd(10) +
    '`\n';
  return Buffer.concat([
    Buffer.from(header, 'ascii'),
    data,
    data.length % 2 ? Buffer.from('\n') : Buffer.alloc(0),
  ]);
}

export function buildDeb(spec: DebSpec): Buffer {
  const control = [
    `Package: ${spec.name}`,
    `Version: ${spec.version}`,
    `Architecture: ${spec.arch}`,
    'Maintainer: Fleet QA <qa@fleetdm.com>',
    'Section: utils',
    'Priority: optional',
    'Description: Inert fixture package for the Fleet Playwright suite.',
    ' Ships marker files under /usr/share and changes nothing else.',
    '',
  ].join('\n');

  const data = spec.files.map((f) => ({
    path: `.${f.path}`,
    data: Buffer.isBuffer(f.content) ? f.content : Buffer.from(f.content),
  }));

  return Buffer.concat([
    Buffer.from('!<arch>\n', 'ascii'),
    arMember('debian-binary', Buffer.from('2.0\n')),
    arMember('control.tar.gz', tarGz([{ path: './control', data: Buffer.from(control) }], 9)),
    arMember('data.tar.gz', tarGz(data, spec.compressionLevel ?? 9)),
  ]);
}

/** The conventional one-marker package for `name`. */
export function inertDeb(name: string, version: string, arch: DebSpec['arch'] = 'all'): Buffer {
  return buildDeb({
    name,
    version,
    arch,
    files: [{ path: `/usr/share/${name}/marker.txt`, content: `fleet playwright fixture ${version}\n` }],
  });
}
