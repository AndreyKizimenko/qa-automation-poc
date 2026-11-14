/**
 * Names for what a test creates on the instance.
 *
 * `ownName('policy-hosts')` is `pw-policy-hosts-<run>-w<worker>-<nonce>`:
 *
 *   - `pw-<kind>-` first, so every sweep in `setup/cleanup.steps.ts` matches it
 *     as it matches the names written by hand before it, including the sweeps
 *     that go by exact prefix (`pw-role-`, `pw-run-script-`, `pw-rl-`,
 *     `pw-stored-results-`): the kind is that prefix;
 *   - the run that made it (`PW_RUN_ID`, which `playwright.config.ts` sets
 *     once per invocation and CI ties to the workflow run), and the worker
 *     (`TEST_WORKER_INDEX`, which Playwright sets in each worker process), so a
 *     leftover says who left it, and a sweep can one day take only its own run's
 *     names while another run is on the instance;
 *   - a random nonce, so two names of one kind made in the same worker differ.
 *
 * A file's extension goes outside it (`${ownName('role-script')}.sh`). A name
 * that can't take this shape (an email address, a custom variable's
 * `PW_VAR_<NAME>`) keeps `runNonce()` from `@helpers/profiles`.
 */
import * as crypto from 'crypto';

/** Lowercase words joined by single dashes: what keeps the name's parts findable. */
const KIND = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A per-run name for something a test creates: `pw-<kind>-<run>-w<worker>-<nonce>`. */
export function ownName(kind: string): string {
  if (!KIND.test(kind)) {
    throw new Error(`[ownName] kind "${kind}" must be lowercase letters and digits, words joined by "-"`);
  }
  const run = process.env.PW_RUN_ID;
  if (!run) {
    throw new Error('[ownName] PW_RUN_ID is unset: playwright.config.ts sets it, so this ran outside a Playwright run');
  }
  // The runner process loads spec files to list their tests and has no worker
  // index; a name made there names nothing on the instance.
  const worker = process.env.TEST_WORKER_INDEX ?? 'x';
  return `pw-${kind}-${run}-w${worker}-${crypto.randomBytes(3).toString('hex')}`;
}
