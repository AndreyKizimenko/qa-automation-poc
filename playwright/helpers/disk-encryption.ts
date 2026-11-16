/**
 * The scripts the disk-encryption specs run on a lab host, built from `test-data/{linux,windows}/disk-encryption/`
 * (their READMEs say what each does and why it is safe), and readers for what they print. None of the scripts
 * prints a passphrase or a key, and none of the readers would be given one.
 */
import * as fs from 'fs';
import * as path from 'path';

const LINUX = path.resolve(__dirname, '../test-data/linux/disk-encryption');
const WINDOWS = path.resolve(__dirname, '../test-data/windows/disk-encryption');
const read = (dir: string, name: string): string => fs.readFileSync(path.join(dir, name), 'utf8');

/** How the helper answers fleetd's passphrase dialog. */
export type LuksAnswerMode = 'answer' | 'cancel' | 'wrong-then-answer';

/**
 * Starts the helper that answers fleetd's passphrase dialog on a host built for it, and returns. Run it and
 * wait for its result *before* clicking *Create key*: fleetd fetches its next script only once the dialog's
 * round has ended. The helper gives up after `seconds`.
 */
export function luksAnswerScript(mode: LuksAnswerMode, seconds = 300): string {
  return read(LINUX, 'luks-answer-start.sh')
    .replace('__HELPER__', read(LINUX, 'luks-answer.py').trimEnd())
    .split('__MODE__')
    .join(mode)
    .split('__SECONDS__')
    .join(String(seconds));
}

/** Prints what the answering helper saw and did. */
export const LUKS_ANSWER_LOG_SCRIPT = '#!/bin/sh\ncat /tmp/pw-luks-answer.log\n';

/** Prints the root disk's key slot numbers (`slots: 0 1`). */
export function luksSlotsScript(): string {
  return read(LINUX, 'luks-slots.sh');
}

/** The key slot numbers `luksSlotsScript` printed. Throws when it printed none. */
export function parseLuksSlots(output: string): number[] {
  const line = output.split('\n').find((l) => l.startsWith('slots:'));
  if (line === undefined) throw new Error(`[parseLuksSlots] no "slots:" line in the script's output: ${output.slice(0, 200)}`);
  return line.slice('slots:'.length).trim().split(/\s+/).filter(Boolean).map(Number);
}

/**
 * Removes every key slot above 1, the ones fleetd's escrows added, and prints the slots left. Slots 0 and 1
 * unlock the disk and are never touched. One script, so a cleanup is one round trip.
 */
export function luksRemoveEscrowSlotsScript(): string {
  return read(LINUX, 'luks-remove-escrow-slots.sh');
}

/**
 * Prints fleetd's key-escrow log lines on a Linux host since `since` (a `Date`): each request it picked up,
 * the path it took and each dialog it launched (`program=zenity`). fleetd 1.63.0 reports nothing to Fleet
 * about a prompt nobody answers, so this is the evidence that it opened.
 */
export function fleetdEscrowLogScript(since: Date): string {
  return read(LINUX, 'fleetd-escrow-log.sh').replace('__SINCE__', String(Math.floor(since.getTime() / 1000)));
}

/** Prints C:'s BitLocker state and the types of its key protectors. */
export function bitlockerStatusScript(): string {
  return read(WINDOWS, 'bitlocker-status.ps1');
}

/** Suspends protection on C: and deletes its key protectors: Windows 11's stock state. */
export function bitlockerResetScript(): string {
  return read(WINDOWS, 'bitlocker-reset.ps1');
}

/** Starts decrypting C:. */
export function bitlockerDecryptScript(): string {
  return read(WINDOWS, 'bitlocker-decrypt.ps1');
}

/** Starts encrypting a decrypted C: as Windows 11 does by itself (XTS-AES 128, a TPM protector); the reset then makes it the stock state. */
export function bitlockerEncryptLikeWindowsScript(): string {
  return read(WINDOWS, 'bitlocker-encrypt-like-windows.ps1');
}

/** C:'s BitLocker state as `bitlockerStatusScript` prints it. */
export interface BitlockerState {
  /** `FullyEncrypted`, `FullyDecrypted`, `EncryptionInProgress`, … */
  volume: string;
  percent: number;
  /** `XtsAes128`, `XtsAes256`, `None`, … */
  method: string;
  /** `On` or `Off`. */
  protection: string;
  /** `RecoveryPassword`, `Tpm`, … */
  protectors: string[];
}

export function parseBitlockerState(output: string): BitlockerState {
  const volume = /volume: (\S+) (\d+)% method=(\S+) protection=(\S+)/.exec(output);
  const protectors = /protectors:(.*)/.exec(output);
  if (!volume || !protectors) throw new Error(`[parseBitlockerState] unexpected output: ${output.slice(0, 200)}`);
  return {
    volume: volume[1],
    percent: Number(volume[2]),
    method: volume[3],
    protection: volume[4],
    protectors: protectors[1].split(',').map((p) => p.trim()).filter(Boolean),
  };
}
