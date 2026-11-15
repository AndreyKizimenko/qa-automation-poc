/**
 * Builds a minimal, valid RPM package in memory: the `.rpm` counterpart of
 * `helpers/deb.ts`, for the same reason. Fleet names an `.rpm`'s title after the
 * package's `Name`, and a fleet holds one installer per title, so tests that
 * install on several rpm hosts of one fleet at once each need a package of
 * their own name. No `.rpm` is kept on disk.
 *
 * The package is `noarch` and holds only what `files` lists, by convention one
 * marker under `/usr/share/<name>/`, with that directory listed as the
 * package's own so that erasing the package removes it too. It has no
 * scriptlets, no dependencies and no signature: installing it changes nothing
 * on the host beyond that directory, and `rpm -e` (which `dnf remove` and
 * `zypper remove` end in) leaves nothing behind.
 *
 * **Unsigned.** `dnf install <file>`, which is Fleet's default install script
 * for an `.rpm`, takes an unsigned local package on RHEL 9 and 10, Amazon Linux
 * 2023 and Fedora: Fedora's rpm 6 enforces signatures by itself, and dnf5
 * skips the check for a file given on the command line. `zypper install`
 * refuses one ("File is unsigned") unless given `--allow-unsigned-rpm`.
 *
 * Checked with `rpm -K`, an install, `rpm -V` and a removal that left no
 * directory behind, in containers of Rocky Linux 9 and Amazon Linux 2023 (rpm
 * 4.16), AlmaLinux 10 (4.19), openSUSE Leap 16 (4.20, zypper) and Fedora 45
 * (6.1, dnf5): the versions the lab's rpm hosts run.
 *
 * The layout is the one `rpmpack` writes (github.com/google/rpmpack, which
 * `fleetctl package --type=rpm` builds fleetd's own package with, through
 * nfpm), reduced to what one directory and its files need:
 *
 *   lead (96 bytes) · signature header, padded to 8 · header · gzip(cpio newc)
 *
 * A header is an index of 16-byte entries (tag, type, offset, count) over a
 * data store. Its first entry is the region tag, whose 16 bytes of data sit at
 * the *end* of the store and point back over the index. The signature header
 * carries the SHA-256 of the header, and the header the SHA-256 of the
 * compressed payload: rpm 4.14 and later refuse a package with neither.
 * Standard library only.
 */
import * as crypto from 'crypto';
import * as zlib from 'zlib';

export interface RpmFile {
  /** Absolute install path, e.g. `/usr/share/fleet-pw-x/marker.txt`. */
  path: string;
  content: Buffer | string;
}

export interface RpmSpec {
  /** The package's `Name`, which is also the title Fleet lists. */
  name: string;
  version: string;
  /** Defaults to `1`. */
  release?: string;
  /**
   * Files of one directory, which the package owns along with them. rpm removes
   * only what a package lists, so an unlisted parent would outlive the package.
   */
  files: RpmFile[];
}

/** Fixed, so two builds of one spec are the same bytes. 2026-01-01T00:00:00Z. */
const BUILD_TIME = 1_767_225_600;

const TYPE = { int16: 3, int32: 4, string: 6, bin: 7, stringArray: 8 } as const;
/** Only integers are aligned in a header's store: some rpm versions refuse a misaligned one. */
const ALIGNMENT: Record<number, number> = { [TYPE.int16]: 2, [TYPE.int32]: 4 };

/** The region tags: every header opens with one. */
const REGION = { signatures: 62, immutable: 63 } as const;

/** Tags of the signature header. */
const SIG = { sha256: 273, size: 1000, payloadSize: 1007 } as const;

/** Tags of the header proper (rpm's `rpmtag.h`). */
const TAG = {
  i18nTable: 100,
  name: 1000,
  version: 1001,
  release: 1002,
  summary: 1004,
  description: 1005,
  buildTime: 1006,
  buildHost: 1007,
  size: 1009,
  vendor: 1011,
  license: 1014,
  group: 1016,
  os: 1021,
  arch: 1022,
  fileSizes: 1028,
  fileModes: 1030,
  fileRdevs: 1033,
  fileMtimes: 1034,
  fileDigests: 1035,
  fileLinkTos: 1036,
  fileFlags: 1037,
  fileUserName: 1039,
  fileGroupName: 1040,
  sourceRpm: 1044,
  fileVerifyFlags: 1045,
  provideName: 1047,
  fileDevices: 1095,
  fileInodes: 1096,
  fileLangs: 1097,
  provideFlags: 1112,
  provideVersion: 1113,
  dirIndexes: 1116,
  baseNames: 1117,
  dirNames: 1118,
  payloadFormat: 1124,
  payloadCompressor: 1125,
  payloadFlags: 1126,
  fileDigestAlgo: 5011,
  payloadDigest: 5092,
  payloadDigestAlgo: 5093,
} as const;

/** rpm's id for SHA-256 (`PGPHASHALGO_SHA256`). */
const SHA256 = 8;
/** `RPMSENSE_EQUAL`: a package provides itself at exactly its own version. */
const SENSE_EQUAL = 8;

const DIR_MODE = 0o040755;
const FILE_MODE = 0o100644;

interface Entry {
  type: number;
  count: number;
  data: Buffer;
}

const sha256 = (data: Buffer): string => crypto.createHash('sha256').update(data).digest('hex');

function ints(type: typeof TYPE.int16 | typeof TYPE.int32, values: number[]): Entry {
  const width = type === TYPE.int16 ? 2 : 4;
  const data = Buffer.alloc(values.length * width);
  values.forEach((value, i) => {
    if (width === 2) data.writeUInt16BE(value & 0xffff, i * 2);
    else data.writeUInt32BE(value >>> 0, i * 4);
  });
  return { type, count: values.length, data };
}
const int32 = (...values: number[]): Entry => ints(TYPE.int32, values);
const int16 = (...values: number[]): Entry => ints(TYPE.int16, values);
const str = (value: string): Entry => ({ type: TYPE.string, count: 1, data: Buffer.from(`${value}\0`) });
const strings = (values: string[]): Entry => ({
  type: TYPE.stringArray,
  count: values.length,
  data: Buffer.from(values.map((value) => `${value}\0`).join('')),
});

/** One header: the intro, the index (region entry first, then the tags in order) and the store. */
function header(region: number, entries: Map<number, Entry>): Buffer {
  const tags = [...entries.keys()].sort((a, b) => a - b);
  const store: Buffer[] = [];
  let length = 0;
  const offsets = tags.map((tag) => {
    const entry = entries.get(tag)!;
    const boundary = ALIGNMENT[entry.type];
    if (boundary && length % boundary) {
      const padding = boundary - (length % boundary);
      store.push(Buffer.alloc(padding));
      length += padding;
    }
    store.push(entry.data);
    length += entry.data.length;
    return length - entry.data.length;
  });

  const indexEntry = (tag: number, type: number, offset: number, count: number): Buffer => {
    const b = Buffer.alloc(16);
    b.writeInt32BE(tag, 0);
    b.writeInt32BE(type, 4);
    b.writeInt32BE(offset, 8);
    b.writeInt32BE(count, 12);
    return b;
  };
  // The region's data closes the store: an index entry of its own, whose offset
  // is minus the size of the index it stands at the head of.
  const indexCount = tags.length + 1;
  store.push(indexEntry(region, TYPE.bin, -16 * indexCount, 16));
  const regionOffset = length;
  length += 16;

  const intro = Buffer.alloc(16);
  Buffer.from([0x8e, 0xad, 0xe8, 0x01]).copy(intro);
  intro.writeInt32BE(indexCount, 8);
  intro.writeInt32BE(length, 12);

  return Buffer.concat([
    intro,
    indexEntry(region, TYPE.bin, regionOffset, 16),
    ...tags.map((tag, i) => indexEntry(tag, entries.get(tag)!.type, offsets[i], entries.get(tag)!.count)),
    ...store,
  ]);
}

/** One `newc` cpio entry: a 110-byte ASCII header, the name and the data, each padded to 4. */
function cpioEntry(name: string, mode: number, links: number, data: Buffer): Buffer {
  const hex = (value: number) => value.toString(16).toUpperCase().padStart(8, '0');
  const fields = [
    0, // inode
    mode,
    0, // uid
    0, // gid
    links,
    0, // mtime
    data.length,
    0, // device major
    0, // device minor
    0, // rdevice major
    0, // rdevice minor
    name.length + 1,
    0, // checksum
  ];
  const head = Buffer.from(`070701${fields.map(hex).join('')}${name}\0`, 'ascii');
  const pad = (length: number) => Buffer.alloc((4 - (length % 4)) % 4);
  return Buffer.concat([head, pad(head.length), data, pad(data.length)]);
}

/** The 96-byte lead: only its magic and the header-style signature type are read today. */
function lead(nameVersionRelease: string): Buffer {
  const b = Buffer.alloc(96);
  Buffer.from([0xed, 0xab, 0xee, 0xdb, 0x03, 0x00]).copy(b); // magic, format 3.0
  b.writeUInt16BE(0, 6); // a binary package
  b.writeUInt16BE(1, 8); // architecture number
  b.write(nameVersionRelease.slice(0, 65), 10, 'ascii');
  b.writeUInt16BE(1, 76); // Linux
  b.writeUInt16BE(5, 78); // the signature is a header
  return b;
}

export function buildRpm(spec: RpmSpec): Buffer {
  const release = spec.release ?? '1';
  const files = spec.files
    .map((f) => ({ path: f.path, data: Buffer.isBuffer(f.content) ? f.content : Buffer.from(f.content) }))
    .sort((a, b) => (a.path < b.path ? -1 : 1));
  if (!files.length) throw new Error('[buildRpm] a package needs at least one file');
  const dir = files[0].path.slice(0, files[0].path.lastIndexOf('/'));
  if (!dir || files.some((f) => f.path.slice(0, f.path.lastIndexOf('/')) !== dir)) {
    throw new Error(`[buildRpm] every file must sit directly in one directory; got ${files.map((f) => f.path).join(', ')}`);
  }

  // The directory first (it sorts first), then its files. Each row is one
  // entry of every per-file tag below, and one cpio entry.
  const rows = [
    { path: dir, mode: DIR_MODE, links: 2, size: 4096, digest: '', data: Buffer.alloc(0) },
    ...files.map((f) => ({ path: f.path, mode: FILE_MODE, links: 1, size: f.data.length, digest: sha256(f.data), data: f.data })),
  ];
  const dirNames = [`${dir.slice(0, dir.lastIndexOf('/'))}/`, `${dir}/`];
  const dirIndexes = rows.map((_, i) => (i === 0 ? 0 : 1));
  const baseNames = rows.map((row) => row.path.slice(row.path.lastIndexOf('/') + 1));
  const each = <T>(value: T): T[] => rows.map(() => value);

  const archive = Buffer.concat([
    ...rows.map((row) => cpioEntry(row.path, row.mode, row.links, row.data)),
    cpioEntry('TRAILER!!!', 0, 1, Buffer.alloc(0)),
  ]);
  const payload = zlib.gzipSync(archive, { level: 9 });

  const main = header(
    REGION.immutable,
    new Map<number, Entry>([
      [TAG.i18nTable, str('C')],
      [TAG.name, str(spec.name)],
      [TAG.version, str(spec.version)],
      [TAG.release, str(release)],
      [TAG.summary, str('Inert fixture package for the Fleet Playwright suite')],
      [TAG.description, str('Ships marker files in one directory under /usr/share and changes nothing else.')],
      [TAG.buildTime, int32(BUILD_TIME)],
      [TAG.buildHost, str('fleet-qa')],
      [TAG.size, int32(files.reduce((sum, f) => sum + f.data.length, 0))],
      [TAG.vendor, str('Fleet QA')],
      [TAG.license, str('MIT')],
      [TAG.group, str('Unspecified')],
      [TAG.os, str('linux')],
      [TAG.arch, str('noarch')],
      // What tells rpm this is a binary package: a source package has no source package.
      [TAG.sourceRpm, str(`${spec.name}-${spec.version}-${release}.src.rpm`)],
      [TAG.provideName, strings([spec.name])],
      [TAG.provideVersion, strings([`${spec.version}-${release}`])],
      [TAG.provideFlags, int32(SENSE_EQUAL)],
      [TAG.baseNames, strings(baseNames)],
      [TAG.dirIndexes, int32(...dirIndexes)],
      [TAG.dirNames, strings(dirNames)],
      [TAG.fileSizes, int32(...rows.map((row) => row.size))],
      [TAG.fileModes, int16(...rows.map((row) => row.mode))],
      [TAG.fileRdevs, int16(...each(0))],
      [TAG.fileMtimes, int32(...each(BUILD_TIME))],
      [TAG.fileDigests, strings(rows.map((row) => row.digest))],
      [TAG.fileLinkTos, strings(each(''))],
      [TAG.fileFlags, int32(...each(0))],
      [TAG.fileUserName, strings(each('root'))],
      [TAG.fileGroupName, strings(each('root'))],
      [TAG.fileVerifyFlags, int32(...each(-1))],
      [TAG.fileDevices, int32(...each(1))],
      [TAG.fileInodes, int32(...rows.map((_, i) => i + 1))],
      [TAG.fileLangs, strings(each(''))],
      [TAG.fileDigestAlgo, int32(SHA256)],
      [TAG.payloadFormat, str('cpio')],
      [TAG.payloadCompressor, str('gzip')],
      [TAG.payloadFlags, str('9')],
      [TAG.payloadDigest, strings([sha256(payload)])],
      [TAG.payloadDigestAlgo, int32(SHA256)],
    ]),
  );

  const signature = header(
    REGION.signatures,
    new Map<number, Entry>([
      [SIG.sha256, str(sha256(main))],
      [SIG.size, int32(main.length + payload.length)],
      [SIG.payloadSize, int32(archive.length)],
    ]),
  );

  return Buffer.concat([
    lead(`${spec.name}-${spec.version}-${release}`),
    signature,
    Buffer.alloc((8 - (signature.length % 8)) % 8),
    main,
    payload,
  ]);
}

/** The conventional one-marker package for `name`: `<name>-<version>-1.noarch.rpm`. */
export function inertRpm(name: string, version: string): Buffer {
  return buildRpm({
    name,
    version,
    files: [{ path: `/usr/share/${name}/marker.txt`, content: `fleet playwright fixture ${version}\n` }],
  });
}
