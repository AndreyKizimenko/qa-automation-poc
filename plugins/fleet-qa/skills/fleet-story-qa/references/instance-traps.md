# Instance traps

Things that cost time in earlier story and quick-win runs. What's specific to one engineer's machine
(which server is which, container names, log paths, role users) is in `~/.claude/fleet-qa.local.md`, not
here. See `fleet-bug-qa/references/local-setup.md`.

## Which server is which

- Map the instances before assuming anything. The local file says how they run. Confirm with
  `ps -eo pid,lstart,command | grep 'fleet serve'` and each context's `GET /api/v1/fleet/version`,
  because an instance may have been redeployed at another version since the file was written.
- When the user says "switched to Free", confirm it on the instance (`GET /api/v1/fleet/config` →
  `license.tier`). They may have restarted the other instance. Switching tiers usually needs a restart,
  which the user does.
- Activities live in a separate store. Read them through the API
  (`/api/v1/fleet/activities?activity_type=...`, `/api/v1/fleet/hosts/:id/activities`), not the database.

## Auth

- API-only user tokens can stop working after a server restart or overnight ("Authentication
  required"). Create a fresh one rather than debugging it.
- API-only users can't use the UI. For UI-by-role, use the real role users with fleetctl contexts that
  the local file lists, with `pw.mjs` / `screenshot.mjs --token`. For any other role, the user signs in
  (in the browser pane) as a real user of that role; Claude never types the password.
  - Never log out in the UI as these users: that deletes the token.
  - Don't delete these users in cleanup.
  - If a token is rejected, ask the user to rerun `fleetctl login --context <name>`.
- `fleetapi.sh` reads tokens from `~/.fleet/config`. In shell one-liners, zsh doesn't word-split
  `$var`, so `set -- $x` tricks break: loop over arrays, or quote.

## Android

- Turning Android MDM off deletes the enterprise, all zero-touch tokens and **every Android app in every
  fleet**, and logs no activity. If the user plans to toggle it, snapshot the app lists and
  setup-experience selections first, so they can be restored.
- Fleet talks to Google through the fleetdm.com AMAPI proxy. AMAPI errors often surface as a bare
  `500 Internal Server Error` that hides Google's reason.
- `mdm_android_device_reconciler` runs hourly, and `fleetctl trigger --name mdm_android_device_reconciler`
  runs it now. It only checks whether each device exists in the enterprise.
- Preinstalled apps (Chrome, Gmail, Maps on Samsung) regularly hit #52617 (the setup app is marked
  Failed while it's installed). Recognise it; don't re-investigate.

## Scratch tests

A fallback, not a first resort. Use one only with the engineer's go-ahead (the live path can't be
produced, or they say a scratch test is good enough; see the Evidence section in the skills), and say in
RESULTS.md what it skips.

- Service-layer tests with mocks go in `ee/server/mdm/...` or `server/service/...`: quick, no database.
  For datastore tests with a lagging replica, use
  `testing_utils.DatastoreTestOptions{DummyReplica: true}` plus `opts.RunReplication()`, run with
  `MYSQL_TEST=1`.
- The Fleet checkout may hold the user's untracked scratch tests from other QA runs. If they no longer
  compile and break the package build, move them aside for the run, then restore them.
- `endpointer.EncodeError(ctx, err, httptest.NewRecorder(), nil)` shows the exact HTTP status and body a
  client would get for a service error.

## UI evidence

- The browser pane can't save PNGs. Capture evidence with `screenshot.mjs`, or a `pw.mjs` driver,
  against the real state.
- Don't fake states with `page.route` (license, role, settings, host state); ask for the real setup
  instead. The one legitimate use is rendering an error nobody can trigger, once the engineer has
  agreed. Label it in RESULTS.md, and never show it as a bare ✅.
- The pane blocks pop-ups: a button that calls `window.open` shows the page's own "allow pop-ups" error
  there. That's the pane, not Fleet. Open the destination URL directly, or use a `pw.mjs` driver
  (`page.waitForEvent('popup')`).
- A burst of 502s from a tunnel or proxy in front of an instance usually means the server is restarting
  (the user may be switching tiers). Check `ps` before reading anything into it.
- Read every PNG before sending. For public tickets, crop out tokens, enroll secrets and DPC extras.
