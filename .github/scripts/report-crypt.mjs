#!/usr/bin/env node
// Encrypts a Playwright report for upload, and decrypts one after download.
//
// A report holds live credentials: the HTML report writes every `fill()` value
// into its step titles (the admin, static-user and SSO passwords), a trace
// records the Authorization header of every API call, and a failed API
// assertion prints its request headers into the error text. This repository is
// public, and anyone signed in to GitHub can download a public repository's
// artifacts, so a report never leaves CI in the clear.
//
// CI encrypts to the public key committed at .github/report-public-key.pem and
// holds no secret that could decrypt. The private key lives only with the
// people who read reports (see playwright/docs/ci-pipeline.md).
//
// Usage:
//   report-crypt.mjs encrypt <public-key.pem>               < plain > encrypted
//   report-crypt.mjs decrypt <private-key.pem> <encrypted>  > plain
//   report-crypt.mjs keygen  <private-key-out.pem> <public-key-out.pem>
//   report-crypt.mjs selftest
//
// File layout: "QAREPORT" + a version byte, the length of the wrapped key (two
// bytes, big-endian), the wrapped key, a 12-byte IV, the ciphertext, and a
// 16-byte authentication tag. Each file gets its own random AES-256-GCM key,
// wrapped with RSA-OAEP (SHA-256). The header is authenticated with the data.
import crypto from 'node:crypto';
import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable, Writable } from 'node:stream';

const MAGIC = Buffer.concat([Buffer.from('QAREPORT'), Buffer.from([1])]);
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const OAEP = { padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' };

function fail(message) {
  process.stderr.write(`report-crypt: ${message}\n`);
  process.exit(1);
}

/** Writes the encrypted form of `input` to `output`. */
export async function encrypt(publicKeyPem, input, output) {
  const key = crypto.randomBytes(32);
  const iv = crypto.randomBytes(IV_LENGTH);
  const wrapped = crypto.publicEncrypt({ key: publicKeyPem, ...OAEP }, key);
  const length = Buffer.alloc(2);
  length.writeUInt16BE(wrapped.length);
  const header = Buffer.concat([MAGIC, length, wrapped, iv]);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(header);
  await pipeline(
    async function* () {
      yield header;
      for await (const chunk of input) yield cipher.update(chunk);
      yield cipher.final();
      yield cipher.getAuthTag();
    },
    output,
  );
}

/** Writes the plain form of the encrypted file at `path` to `output`. Throws when the key or the file is wrong. */
export async function decrypt(privateKeyPem, path, output) {
  const { size } = fs.statSync(path);
  const fd = fs.openSync(path, 'r');
  try {
    const fixed = Buffer.alloc(MAGIC.length + 2);
    fs.readSync(fd, fixed, 0, fixed.length, 0);
    if (!fixed.subarray(0, MAGIC.length).equals(MAGIC)) {
      throw new Error(`${path} is not an encrypted report (it may be a plain one from before reports were encrypted)`);
    }
    const wrappedLength = fixed.readUInt16BE(MAGIC.length);
    const headerLength = fixed.length + wrappedLength + IV_LENGTH;
    if (size < headerLength + TAG_LENGTH) throw new Error(`${path} is truncated`);
    const header = Buffer.alloc(headerLength);
    fs.readSync(fd, header, 0, headerLength, 0);
    const tag = Buffer.alloc(TAG_LENGTH);
    fs.readSync(fd, tag, 0, TAG_LENGTH, size - TAG_LENGTH);

    let key;
    try {
      key = crypto.privateDecrypt({ key: privateKeyPem, ...OAEP }, header.subarray(fixed.length, fixed.length + wrappedLength));
    } catch {
      throw new Error('this private key does not open the report: it was encrypted to a different public key');
    }
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, header.subarray(headerLength - IV_LENGTH));
    decipher.setAAD(header);
    decipher.setAuthTag(tag);
    const body = size - TAG_LENGTH > headerLength
      ? fs.createReadStream(path, { start: headerLength, end: size - TAG_LENGTH - 1 })
      : Readable.from([]);
    try {
      await pipeline(body, decipher, output);
    } catch (err) {
      if (/authenticate/i.test(String(err?.message))) throw new Error(`${path} is corrupted: its contents fail authentication`);
      throw err;
    }
  } finally {
    fs.closeSync(fd);
  }
}

function keygen(privatePath, publicPath) {
  for (const p of [privatePath, publicPath]) {
    if (fs.existsSync(p)) fail(`${p} already exists; refusing to overwrite a key`);
  }
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  fs.writeFileSync(privatePath, privateKey, { mode: 0o600 });
  fs.writeFileSync(publicPath, publicKey);
  process.stderr.write(`report-crypt: private key → ${privatePath} (keep it out of the repository), public key → ${publicPath}\n`);
}

/** Collects what is written to it, for the self-test. */
function sink() {
  const chunks = [];
  const stream = new Writable({ write(chunk, _enc, done) { chunks.push(chunk); done(); } });
  return { stream, bytes: () => Buffer.concat(chunks) };
}

async function selftest() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const other = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const dir = fs.mkdtempSync(`${process.env.RUNNER_TEMP || process.env.TMPDIR || '/tmp'}/report-crypt-`);
  try {
    for (const plain of [crypto.randomBytes(3 * 1024 * 1024 + 17), Buffer.alloc(0)]) {
      const file = `${dir}/report.enc`;
      await encrypt(publicKey, Readable.from([plain.subarray(0, 1000), plain.subarray(1000)]), fs.createWriteStream(file));
      const encrypted = fs.readFileSync(file);
      if (plain.length && encrypted.includes(plain.subarray(0, 64))) throw new Error('the encrypted file contains plain text');

      const round = sink();
      await decrypt(privateKey, file, round.stream);
      if (!round.bytes().equals(plain)) throw new Error('decrypting did not return what was encrypted');

      let refused = false;
      await decrypt(other.privateKey, file, sink().stream).catch(() => { refused = true; });
      if (!refused) throw new Error('a different private key opened the file');

      const tampered = Buffer.from(encrypted);
      tampered[tampered.length - TAG_LENGTH - 1 - (plain.length ? 5 : 0)] ^= 0x01;
      fs.writeFileSync(file, tampered);
      refused = false;
      await decrypt(privateKey, file, sink().stream).catch(() => { refused = true; });
      if (!refused) throw new Error('a tampered file decrypted without an error');
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  process.stderr.write('report-crypt: self-test passed (round trip, wrong key refused, tampering detected)\n');
}

const [command, ...args] = process.argv.slice(2);
try {
  if (command === 'encrypt' && args.length === 1) {
    await encrypt(fs.readFileSync(args[0], 'utf8'), process.stdin, process.stdout);
  } else if (command === 'decrypt' && args.length === 2) {
    await decrypt(fs.readFileSync(args[0], 'utf8'), args[1], process.stdout);
  } else if (command === 'keygen' && args.length === 2) {
    keygen(args[0], args[1]);
  } else if (command === 'selftest' && args.length === 0) {
    await selftest();
  } else {
    fail('usage: encrypt <public-key.pem> < plain > encrypted | decrypt <private-key.pem> <encrypted> > plain | keygen <private-out.pem> <public-out.pem> | selftest');
  }
} catch (err) {
  fail(err?.message || String(err));
}
