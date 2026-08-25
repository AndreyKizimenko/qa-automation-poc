/**
 * Runs the `fleetctl` binary against the suite's target Fleet instance.
 *
 * Three things every caller needs and nobody should re-implement:
 *
 * 1. **Config isolation.** `fleetctl` reads `~/.fleetctl/config` by default, so
 *    an un-isolated call would both read the developer's own context (wrong
 *    instance) and be clobbered by `fleetctl config set`. Every invocation
 *    passes `--config <.auth/fleetctl-<suite>.yml>`, written on first use from
 *    FLEET_URL + FLEET_API_TOKEN.
 * 2. **Banner stripping.** When client and server versions differ, `fleetctl`
 *    prints a three-line "Warning: Version mismatch." block to stderr on every
 *    single command. Left in place it breaks naive stderr assertions, so it is
 *    removed here and exposed separately via `versionMismatch()`.
 * 3. **No throw on non-zero.** Licensing checks assert on exit code and message,
 *    so a failing command is a normal result, not an exception.
 */
import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const VERSION_BANNER = /^Warning: Version mismatch\.\nClient Version:.*\nServer Version:.*\n?/m;

export interface FleetctlResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Absolute path to the fleetctl binary. Override with FLEETCTL_BIN. */
export function fleetctlBin(): string {
  return process.env.FLEETCTL_BIN ?? 'fleetctl';
}

function suite(): string {
  const s = process.env.SUITE;
  if (!s) throw new Error('SUITE is not set — playwright.config.ts resolves it at load time');
  return s;
}

/**
 * Builds a throwaway home directory holding the suite's fleetctl context and
 * returns its path, to be handed to the child process as `HOME`.
 *
 * **Why `HOME` and not `--config`.** Most commands take a `--config` flag, but
 * `mdm lock` / `unlock` / `wipe` / `clear-passcode` never register one — they
 * only carry `--context`, `--debug` and `--host`, so passing `--config` to them
 * fails with `flag provided but not defined: -config`. `fleetctl` resolves its
 * default config through `os.UserHomeDir()`, which reads `$HOME`, so overriding
 * that isolates *every* command uniformly with no per-command knowledge.
 *
 * The file mirrors what `fleetctl config set --address --token` produces, written
 * directly rather than shelled out to so it costs no subprocess.
 *
 * Note the directory is `.fleet/config`, not `.fleetctl/` — the latter is only
 * where the binary is commonly installed.
 */
export function fleetctlHome(): string {
  const home = path.resolve(__dirname, '..', '.auth', `fleetctl-home-${suite()}`);
  const address = process.env.FLEET_URL;
  const token = process.env.FLEET_API_TOKEN;
  if (!address) throw new Error('FLEET_URL is required to build the fleetctl context');
  if (!token) throw new Error('FLEET_API_TOKEN is required to build the fleetctl context');

  fs.mkdirSync(path.join(home, '.fleet'), { recursive: true });
  fs.writeFileSync(
    path.join(home, '.fleet', 'config'),
    [
      'contexts:',
      '  default:',
      `    address: ${address}`,
      '    custom-headers: null',
      '    email: ""',
      '    rootca: ""',
      '    tls-skip-verify: false',
      `    token: ${token}`,
      '    url-prefix: ""',
      '',
    ].join('\n'),
    { mode: 0o600 },
  );
  return home;
}

/** A home with no context in it, for commands that must not reach a server. */
function emptyHome(): string {
  const home = path.resolve(__dirname, '..', '.auth', 'fleetctl-home-offline');
  fs.mkdirSync(path.join(home, '.fleet'), { recursive: true });
  return home;
}

/**
 * Runs `fleetctl <args>` against the suite's instance.
 *
 * Pass `withoutConfig` for commands that never contact a server (`new`,
 * `--version`) so a missing token doesn't block them. Either way the child gets
 * a throwaway `HOME`, so the developer's own `~/.fleet/config` is never read or
 * written.
 */
export async function fleetctl(
  args: string[],
  opts: { env?: Record<string, string>; withoutConfig?: boolean; cwd?: string } = {},
): Promise<FleetctlResult> {
  const home = opts.withoutConfig ? emptyHome() : fleetctlHome();

  try {
    const { stdout, stderr } = await execFileAsync(fleetctlBin(), args, {
      env: { ...process.env, HOME: home, USERPROFILE: home, ...opts.env },
      cwd: opts.cwd,
      maxBuffer: 64 * 1024 * 1024,
    });
    return { code: 0, stdout, stderr: stripBanner(stderr) };
  } catch (err) {
    const e = err as { code?: number | string; stdout?: string; stderr?: string };
    if (e.code === 'ENOENT') {
      throw new Error(
        `fleetctl binary not found at "${fleetctlBin()}". Install it (npm i -g fleetctl@<server version>) ` +
          'or point FLEETCTL_BIN at an existing binary.',
      );
    }
    if (typeof e.code !== 'number') throw err;
    return { code: e.code, stdout: e.stdout ?? '', stderr: stripBanner(e.stderr ?? '') };
  }
}

/** stdout + stderr combined, for the several commands that report errors on stdout. */
export function output(res: FleetctlResult): string {
  return `${res.stdout}\n${res.stderr}`;
}

function stripBanner(stderr: string): string {
  return stderr.replace(VERSION_BANNER, '');
}

/** The client version `fleetctl --version` reports. */
export async function clientVersion(): Promise<string> {
  const res = await fleetctl(['--version'], { withoutConfig: true });
  const match = res.stdout.match(/version (\S+)/);
  if (!match) throw new Error(`could not parse fleetctl version from: ${res.stdout}`);
  return match[1];
}

/** True when the binary printed the version-mismatch banner for this instance. */
export async function versionMismatch(): Promise<boolean> {
  const home = fleetctlHome();
  const res = await execFileAsync(fleetctlBin(), ['get', 'enroll_secret'], {
    env: { ...process.env, HOME: home, USERPROFILE: home },
  }).catch((e: { stderr?: string }) => ({ stderr: e.stderr ?? '' }));
  return /Version mismatch/.test(res.stderr ?? '');
}
