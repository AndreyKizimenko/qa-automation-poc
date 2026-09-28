# Auth & account — test audit

**Specs covered:** 9 files · **Test declarations:** 17 · **Projects:** premium / free

This area covers everything before and around the app shell: the `/login` form (password
and SSO), client-side form validation, sign-out, the forgot-password entry point, and the
`/account` page (profile fields, role/fleets side panel, change-password modal, theme picker).
Seven of the nine specs live in `tests/e2e/shared/`, so **13 of the 17 declarations execute
twice per nightly** — once against the premium instance and once against free.

**Relationship to the setup projects.** `premium-setup` / `free-setup`
([`setup/premium.setup.ts`](../../setup/premium.setup.ts),
[`setup/free.setup.ts`](../../setup/free.setup.ts)) already log the admin in through the real
UI form via `loginAsAdmin` and park the session in `.auth/<suite>-admin.json`; every other spec
in the suite consumes that state. So the happy-path password login is *already proven* before
any test runs — if `AUTH-01` fails, the whole run has already failed at the setup dependency.
What these specs add on top of setup is the negative and edge paths: bad credentials, empty
fields, signed-out redirect, already-authenticated redirect, sign-out, SSO, and the reset link.
Note also that `loginAsAdmin` ([`helpers/auth.ts:14`](../../helpers/auth.ts)) carries two
hardening measures the specs' own `LoginPage.login()` does **not**: a `toPass` retry for Fleet's
suite-wide 10/min `POST /login` throttle, and a wait on the `GET /api/v1/fleet/sso` probe that
re-renders (and detaches) the login inputs.

## Contents

| ID | Spec | Test | Mode | Manual? |
|---|---|---|---|---|
| AUTH-01 | `shared/auth/login.spec.ts` | Login › admin can log in | UI | ☐ |
| AUTH-02 | `shared/auth/login.spec.ts` | Login › shows error for invalid email | UI | ☐ |
| AUTH-03 | `shared/auth/login.spec.ts` | Login › shows error for valid email with wrong password | UI | ☐ |
| AUTH-04 | `shared/auth/login.spec.ts` | Login › redirects to login when visiting a protected route signed out | UI | ☐ |
| AUTH-05 | `shared/auth/login.spec.ts` | Login › redirects to dashboard when already authenticated | UI | ☐ |
| AUTH-06 | `shared/auth/login-validation.spec.ts` | Login validation › both fields empty | UI | ☐ |
| AUTH-07 | `shared/auth/login-validation.spec.ts` | Login validation › email empty | UI | ☐ |
| AUTH-08 | `shared/auth/login-validation.spec.ts` | Login validation › password empty | UI | ☐ |
| AUTH-09 | `shared/auth/login-validation.spec.ts` | Login validation › invalid email format | UI | ☐ |
| AUTH-10 | `shared/auth/logout.spec.ts` | Logout › sign out returns to login page | UI | ☐ |
| AUTH-11 | `shared/auth/forgot-password.spec.ts` | Forgot password › link navigates to reset page | UI | ☐ |
| AUTH-12 | `shared/auth/sso-login.spec.ts` | Okta SSO login › SSO button visible + Okta in tooltip | UI | ☐ |
| AUTH-13 | `shared/auth/sso-login.spec.ts` | Okta SSO login › valid Okta credentials log in | UI | ☐ |
| AUTH-14 | `shared/account/change-password.spec.ts` | My Account change password › rotate + re-login | UI+API | ☐ |
| AUTH-15 | `shared/account/theme.spec.ts` | Account • theme › Dark applies + persists | UI | ☐ |
| AUTH-16 | `free/account/my-account.spec.ts` | Free • My Account › 3 static roles (loop) | UI | ☐ |
| AUTH-17 | `premium/account/my-account.spec.ts` | Premium • My Account › 7 static roles (loop) | UI | ☐ |

`Mode`: **UI** (all validation through the browser), **UI+API** (browser flow, some
assertions/setup via API), **API** (no meaningful UI validation), **PERF** (timing).

---

### AUTH-01 · Login › admin can log in

- **File:** [`playwright/tests/e2e/shared/auth/login.spec.ts`](../../tests/e2e/shared/auth/login.spec.ts)
- **Grep:** `npx playwright test -g "Login › admin can log in"`
- **Project:** premium **and** free (shared spec — runs twice per nightly)
- **Mode:** UI · **Isolation:** file-level `test.use({ storageState: { cookies: [], origins: [] } })` — blank session, no shared state
- **Preconditions:** `FLEET_ADMIN_EMAIL` / `FLEET_ADMIN_PASSWORD` valid on the target instance
- **Data created:** a server-side session for the admin (never signed out — left to expire)

**Flow**

1. ☐ *(beforeEach)* Open `/login` via URL — `LoginPage.goto()`.
   - ✅ *(UI)* The **Email** field is visible (readiness anchor inside `goto()`).
2. ☐ Fill **Email** + **Password** with the admin credentials, click **Log in** — `LoginPage.login()`.
   - ✅ *(UI)* URL matches `/\/dashboard/`.

**Assessment**
- *Value:* Near zero as a regression signal — `premium-setup` / `free-setup` perform this exact login (through the same form) as a project dependency, so a broken password login fails the run before this test is collected.
- *Coverage gaps:* Asserts only the URL. Doesn't confirm the dashboard actually rendered (`dashboard.firstCard`), that the navbar shows the signed-in user, or that the session cookie is `HttpOnly`/`Secure`.
- *Redundancy:* Duplicates `setup/{premium,free}.setup.ts`. Also implicitly re-covered by AUTH-10 (logs in before signing out), AUTH-14 (logs in twice), AUTH-16/17 (log in per role).
- *Efficiency / smells:* Uses `LoginPage.login()` ([`pages/auth/LoginPage.ts:40`](../../pages/auth/LoginPage.ts)), which lacks both protections `loginAsAdmin` documents at [`helpers/auth.ts:19-37`](../../helpers/auth.ts) — no retry for the shared 10/min `POST /login` throttle, and no wait on the `/sso` probe that detaches the inputs mid-`fill()`. This is the suite's most throttle-exposed spec (AUTH-01/02/03 + AUTH-13 + AUTH-10 all spend from the same bucket, ×2 tiers).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### AUTH-02 · Login › shows error for invalid email

- **File:** [`playwright/tests/e2e/shared/auth/login.spec.ts`](../../tests/e2e/shared/auth/login.spec.ts)
- **Grep:** `npx playwright test -g "Login › shows error for invalid email"`
- **Project:** premium **and** free · **Mode:** UI
- **Isolation:** blank session (file-level `test.use`) · `pageHealth.disable()` at [`login.spec.ts:17`](../../tests/e2e/shared/auth/login.spec.ts)
- **Preconditions:** `nonexistent@example.com` must not be a real user on the instance

**Flow**

1. ☐ *(beforeEach)* Open `/login` via URL.
   - ✅ *(UI)* **Email** field visible.
2. ☐ Fill **Email** = `nonexistent@example.com`, **Password** = `SomePassword123!`, click **Log in**.
   - ✅ *(UI)* Text **"Authentication failed"** is visible.
   - ✅ *(UI)* URL still matches `/\/login/`.

**Assessment**
- *Value:* Real — confirms Fleet does not leak "user unknown" vs "wrong password" (paired with AUTH-03, which asserts the identical message for a *known* email; the pair is the actual security assertion).
- *Coverage gaps:* Doesn't assert the fields keep/clear their values, that focus returns to the form, or that repeated failures eventually rate-limit (Fleet's 429 path is untested anywhere).
- *Redundancy:* Same assertion bundle as AUTH-03 — deliberately, to prove message parity. Keep both, but they belong side-by-side with a comment saying *why* the duplication exists.
- *Efficiency / smells:* `pageHealth.disable()` kills **both** monitors, not just the console one — [`fixtures.ts:270-288`](../../fixtures.ts) gates console errors *and* 5xx failures behind the same flag. A 500 from `POST /login` would pass silently here. Worth checking whether the disable is still needed at all: `DEFAULT_IGNORED_CONSOLE_ERRORS` ([`helpers/console.ts:6`](../../helpers/console.ts)) already swallows `'Failed to load resource: the server responded with a status of'` and `'data: Object, status:'`, which are the two generic 401 messages. ⚠️ unclear: the residual console-error text can't be determined from source.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### AUTH-03 · Login › shows error for valid email with wrong password

- **File:** [`playwright/tests/e2e/shared/auth/login.spec.ts`](../../tests/e2e/shared/auth/login.spec.ts)
- **Grep:** `npx playwright test -g "wrong password"`
- **Project:** premium **and** free · **Mode:** UI
- **Isolation:** blank session · `pageHealth.disable()` at [`login.spec.ts:24`](../../tests/e2e/shared/auth/login.spec.ts)
- **Preconditions:** admin email valid; `WrongPassword999!` is not the admin password

**Flow**

1. ☐ *(beforeEach)* Open `/login` via URL. ✅ *(UI)* **Email** field visible.
2. ☐ Fill the real admin **Email** with **Password** = `WrongPassword999!`, click **Log in**.
   - ✅ *(UI)* Text **"Authentication failed"** is visible — identical copy to AUTH-02.
   - ✅ *(UI)* URL still matches `/\/login/`.

**Assessment**
- *Value:* Same pair-value as AUTH-02: proves the error message does not distinguish a real account from a fake one.
- *Coverage gaps:* Doesn't verify the failed attempt is recorded (Fleet has no activity for failed logins) nor that the account is not locked out.
- *Redundancy:* Intentional mirror of AUTH-02.
- *Efficiency / smells:* Burns a slot from the shared `POST /login` throttle bucket. Same over-broad `pageHealth.disable()` as AUTH-02.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### AUTH-04 · Login › redirects to login when visiting a protected route signed out

- **File:** [`playwright/tests/e2e/shared/auth/login.spec.ts`](../../tests/e2e/shared/auth/login.spec.ts)
- **Grep:** `npx playwright test -g "protected route signed out"`
- **Project:** premium **and** free · **Mode:** UI
- **Isolation:** blank session · `pageHealth.disable()` at [`login.spec.ts:33`](../../tests/e2e/shared/auth/login.spec.ts) (booting unauthenticated on a protected route logs a 401-driven console error before the redirect resolves)
- **Preconditions:** none

**Flow**

1. ☐ *(beforeEach)* Open `/login` via URL (redundant here — the test navigates away immediately).
2. ☐ Navigate to `/dashboard` **via URL** while signed out.
   - ✅ *(UI)* URL matches `/\/login/`.
   - ✅ *(UI)* The **Email** field is visible (the login form actually rendered, not just the route).

**Assessment**
- *Value:* Good — this is the front-end auth guard, and it's the only test of it. Added from the QA Wolf migration (flow #4 in [`qawolf-migration/audit/C10-auth-roles-api.md`](../qawolf-migration/audit/C10-auth-roles-api.md)).
- *Coverage gaps:* Only probes `/dashboard`. Doesn't check a deep protected route (`/settings/organization`, `/hosts/1`), and — more valuable — doesn't check the **redirect-back-after-login** behaviour (sign in from here → do you land on the originally requested page or on `/dashboard`?).
- *Redundancy:* Logical inverse of AUTH-05; the two belong together.
- *Efficiency / smells:* The `beforeEach` `loginPage.goto()` is wasted work for this test — it loads `/login` only to immediately `goto('/dashboard')`.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### AUTH-05 · Login › redirects to dashboard when already authenticated

- **File:** [`playwright/tests/e2e/shared/auth/login.spec.ts`](../../tests/e2e/shared/auth/login.spec.ts)
- **Grep:** `npx playwright test -g "already authenticated"`
- **Project:** premium **and** free · **Mode:** UI
- **Isolation:** builds its **own** context from `.auth/${SUITE}-admin.json`, closed in-test. The auto `pageHealth` fixture watches the *unused* default `page`, so this test has effectively **no page-health coverage**.
- **Preconditions:** the setup project has written `.auth/<suite>-admin.json` and the session is still valid

**Flow**

1. ☐ *(beforeEach)* Open `/login` on the blank-session default page (unused by the body).
2. ☐ In a second browser context restored from the saved admin session, navigate to `/login` **via URL**.
   - ✅ *(UI)* URL matches `/\/dashboard/` — an authenticated visit to `/login` bounces to the dashboard.
3. ☐ Close the context.

**Assessment**
- *Value:* Moderate — catches a regression where a signed-in user gets stuck on the login form. Also the only test that proves the stored session state is *reusable*, which the whole suite depends on.
- *Coverage gaps:* Doesn't assert the dashboard rendered (no `firstCard` check), so a redirect to a broken dashboard passes.
- *Redundancy:* Inverse of AUTH-04.
- *Efficiency / smells:* (a) `baseURL: process.env.FLEET_URL` at [`login.spec.ts:43`](../../tests/e2e/shared/auth/login.spec.ts) is redundant — `browser.newContext()` inside a test inherits the project's `use` options (which is precisely why `withCleanContext` has to *override* `storageState`). (b) The auth-state path is re-derived inline instead of being shared with the config. (c) Raw `browser.newContext` in a spec body where `withCleanContext`-style helper coverage exists for the blank case but not the authenticated one — a `withAdminContext(browser, fn)` helper would fit. (d) Page-health is silently vacuous for this test.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### AUTH-06 · Login validation › shows validation errors when both fields are empty

- **File:** [`playwright/tests/e2e/shared/auth/login-validation.spec.ts`](../../tests/e2e/shared/auth/login-validation.spec.ts)
- **Grep:** `npx playwright test -g "both fields are empty"`
- **Project:** premium **and** free · **Mode:** UI
- **Isolation:** blank session (file-level `test.use`) · page-health **on**
- **Preconditions:** none

**Flow**

1. ☐ *(beforeEach)* Open `/login` via URL. ✅ *(UI)* **Email** field visible.
2. ☐ Click **Log in** with both fields untouched.
   - ✅ *(UI)* **"Email field must be completed"** is visible.
   - ✅ *(UI)* **"Password field must be completed"** is visible.

**Assessment**
- *Value:* Low-moderate. Client-side form validation copy; cheap and stable, catches a broken validation wiring after a form refactor.
- *Coverage gaps:* Doesn't assert no network request was made (the point of client-side validation is *not* hitting the server), and doesn't assert the errors clear once the fields are filled.
- *Redundancy:* AUTH-06 is the union of AUTH-07 + AUTH-08 — three tests assert two messages between them.
- *Efficiency / smells:* Clicks `loginPage.loginButton` directly from the spec rather than through a POM method — acceptable, but it means the `/sso`-probe re-render race (see [`helpers/auth.ts:21-28`](../../helpers/auth.ts)) is unguarded in all four validation tests.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### AUTH-07 · Login validation › shows validation error when email is empty

- **File:** [`playwright/tests/e2e/shared/auth/login-validation.spec.ts`](../../tests/e2e/shared/auth/login-validation.spec.ts)
- **Grep:** `npx playwright test -g "when email is empty"`
- **Project:** premium **and** free · **Mode:** UI · **Isolation:** blank session
- **Preconditions:** none

**Flow**

1. ☐ *(beforeEach)* Open `/login` via URL. ✅ *(UI)* **Email** field visible.
2. ☐ Fill **Password** = `SomePassword123!`, leave **Email** blank, click **Log in**.
   - ✅ *(UI)* **"Email field must be completed"** is visible.

**Assessment**
- *Value:* Marginal on its own.
- *Coverage gaps:* Doesn't assert the *password* error is absent — which is the only thing that distinguishes this test from AUTH-06.
- *Redundancy:* Subset of AUTH-06. Merge candidate: one test that fills nothing → both errors, then fills each field in turn and asserts the matching error disappears.
- *Efficiency / smells:* none beyond the shared `/sso` re-render exposure.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### AUTH-08 · Login validation › shows validation error when password is empty

- **File:** [`playwright/tests/e2e/shared/auth/login-validation.spec.ts`](../../tests/e2e/shared/auth/login-validation.spec.ts)
- **Grep:** `npx playwright test -g "when password is empty"`
- **Project:** premium **and** free · **Mode:** UI · **Isolation:** blank session
- **Preconditions:** `FLEET_ADMIN_EMAIL` set (used only as a syntactically valid address — no login is attempted)

**Flow**

1. ☐ *(beforeEach)* Open `/login` via URL. ✅ *(UI)* **Email** field visible.
2. ☐ Fill **Email** with the admin address, leave **Password** blank, click **Log in**.
   - ✅ *(UI)* **"Password field must be completed"** is visible.

**Assessment**
- *Value:* Marginal on its own.
- *Coverage gaps:* Doesn't assert the email error is absent.
- *Redundancy:* Subset of AUTH-06; mirror of AUTH-07.
- *Efficiency / smells:* Uses the real admin email where any literal (`a@b.com`) would do — makes the test read as if credentials matter when they don't.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### AUTH-09 · Login validation › shows validation error for invalid email format

- **File:** [`playwright/tests/e2e/shared/auth/login-validation.spec.ts`](../../tests/e2e/shared/auth/login-validation.spec.ts)
- **Grep:** `npx playwright test -g "invalid email format"`
- **Project:** premium **and** free · **Mode:** UI · **Isolation:** blank session · page-health **on**
- **Preconditions:** none

**Flow**

1. ☐ *(beforeEach)* Open `/login` via URL. ✅ *(UI)* **Email** field visible.
2. ☐ Fill **Email** = `notanemail`, **Password** = `SomePassword123!`, click **Log in** — `LoginPage.login()`.
   - ✅ *(UI)* Text **"Email must be a valid email address"** is visible.

**Assessment**
- *Value:* Moderate — distinct message from the "must be completed" family, so it's the only test of Fleet's email-format validator on this form.
- *Coverage gaps:* One malformed input only. No `a@`, `a@b`, leading/trailing whitespace, or uppercase-normalisation case. Doesn't assert the request was suppressed.
- *Redundancy:* none.
- *Efficiency / smells:* The expected copy is asserted with a raw `page.getByText(...)` in the spec ([`login-validation.spec.ts:34`](../../tests/e2e/shared/auth/login-validation.spec.ts)) while the sibling messages are POM locators on `LoginPage` — add `invalidEmailMessage` to [`pages/auth/LoginPage.ts`](../../pages/auth/LoginPage.ts) for consistency. Notably this test runs with page-health **on**, unlike AUTH-02/03, which suggests the format failure never reaches the server — useful evidence when reconsidering those `disable()` calls.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### AUTH-10 · Logout › sign out returns to login page

- **File:** [`playwright/tests/e2e/shared/auth/logout.spec.ts`](../../tests/e2e/shared/auth/logout.spec.ts)
- **Grep:** `npx playwright test -g "sign out returns to login page"`
- **Project:** premium **and** free · **Mode:** UI
- **Isolation:** describe-level blank `storageState` — **load-bearing**: signing out invalidates the server-side session, which would break the `.auth/<suite>-admin.json` cookies the rest of the suite shares. `pageHealth.disable()` at [`logout.spec.ts:12`](../../tests/e2e/shared/auth/logout.spec.ts) (post-logout config fetch 401s).
- **Preconditions:** valid admin credentials
- **Data created:** one throwaway admin session, then destroyed

**Flow**

1. ☐ Log in as the admin through the real form — `loginAsAdmin` ([`helpers/auth.ts:14`](../../helpers/auth.ts)): waits for the `GET /api/v1/fleet/sso` probe to resolve, opens `/login`, fills **Email** + **Password**, submits with **Enter**, all inside a `toPass` retry (≤90s) to survive the shared login throttle.
   - ✅ *(UI)* URL is no longer `/\/login/` (asserted inside the helper).
2. ☐ Navigate to `/dashboard` via URL — `dashboard.goto()`.
   - ✅ *(UI)* The first dashboard widget card (`data-testid="card"`) is visible.
3. ☐ Open the **user menu** (avatar, `data-testid="user-menu"`) and click **Sign out** — `Navbar.signOut()`.
   - ✅ *(UI)* URL matches `/\/login/`.

**Assessment**
- *Value:* Good — the only test of sign-out, and the only test that exercises the navbar user menu's **Sign out** item.
- *Coverage gaps:* Stops at the URL. Does not assert the login form rendered, that the session cookie was cleared, or — the real regression worth catching — that pressing **Back** or re-visiting `/dashboard` after sign-out does *not* restore the session.
- *Redundancy:* Re-covers AUTH-01's happy-path login as a precondition (via the more robust `loginAsAdmin`, which arguably makes AUTH-01 redundant rather than the reverse).
- *Efficiency / smells:* `pageHealth.disable()` also disables 5xx detection for the whole test, including the login and dashboard load. Step 2's full dashboard load exists only to reach the navbar — the navbar renders on every authenticated page, so a cheaper landing page would do.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### AUTH-11 · Forgot password › forgot password link navigates to reset page

- **File:** [`playwright/tests/e2e/shared/auth/forgot-password.spec.ts`](../../tests/e2e/shared/auth/forgot-password.spec.ts)
- **Grep:** `npx playwright test -g "forgot password link navigates to reset page"`
- **Project:** premium **and** free · **Mode:** UI
- **Isolation:** blank session (file-level `test.use`) · page-health **on**
- **Preconditions:** none

**Flow**

1. ☐ Open `/login` via URL. ✅ *(UI)* **Email** field visible.
2. ☐ Click the **Forgot password?** link.
   - ✅ *(UI)* URL matches `/\/login\/forgot/`.
   - ✅ *(UI)* Heading **"Reset password"** is visible.
   - ✅ *(UI)* The **Email** field is visible.
   - ✅ *(UI)* The **Get instructions** button is visible.

**Assessment**
- *Value:* Low — a link-and-render smoke test. It deliberately stops short of submitting: the "email sent" confirmation only renders when the instance has SMTP/SES configured, and the QA instances don't (the endpoint returns `ErrPasswordResetNotConfigured`). The in-spec comment documents this.
- *Coverage gaps:* The entire password-reset flow is untested: submit → confirmation copy, the emailed token, `/login/reset`, token expiry/reuse, and Fleet's admin-forced-reset interstitial on first login. Most of that is genuinely blocked by the missing SMTP config, but the **submit → error-state** path (what the user sees when reset isn't configured) is testable today and isn't asserted.
- *Redundancy:* none.
- *Efficiency / smells:* none — clean, correctly scoped, and the limitation is documented in-place.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### AUTH-12 · Okta SSO login › SSO button is visible and names Okta in its hover tooltip

- **File:** [`playwright/tests/e2e/shared/auth/sso-login.spec.ts`](../../tests/e2e/shared/auth/sso-login.spec.ts)
- **Grep:** `npx playwright test -g "names Okta in its hover tooltip"`
- **Project:** premium **and** free · **Mode:** UI
- **Isolation:** blank session (file-level `test.use`) · page-health **on**
- **Preconditions:** Admin SSO **pre-configured on the instance** (assumed, per [`CLAUDE.md`](../../CLAUDE.md) — the suite does not provision it). **Not env-gated and not skipped** — `FLEET_SSO_LOGIN_USERNAME` / `FLEET_SSO_LOGIN_PASSWORD` are read with `!` at module scope but this test never uses them, so it fails hard (not skips) on an instance without SSO.

**Flow**

1. ☐ *(beforeEach)* Open `/login` via URL. ✅ *(UI)* **Email** field visible.
2. ☐ Locate the SSO button (`button` matching `/sign in with/i`).
   - ✅ *(UI)* The button is visible.
   - ✅ *(UI)* Its text matches `/sign in with sso/i` — i.e. the label is IdP-agnostic.
3. ☐ Hover the button.
   - ✅ *(UI)* A `role="tooltip"` element contains `/okta/i` — the configured IdP name.

**Assessment**
- *Value:* Moderate and specific — this pair of assertions encodes a Fleet UI change (the IdP name moved off the button label into a hover tooltip); it is the regression guard for that. Cheap, no third-party dependency.
- *Coverage gaps:* Doesn't check the button is *absent* when SSO is disabled, nor the "SSO required" variant where password login is hidden entirely.
- *Redundancy:* none.
- *Efficiency / smells:* `loginPage.ssoTooltip` is an unscoped `page.getByRole('tooltip')` ([`LoginPage.ts:28`](../../pages/auth/LoginPage.ts)) — fine while the page has one tooltip. Hard-codes "Okta" for both tiers, so it silently assumes both QA instances use the same IdP.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### AUTH-13 · Okta SSO login › valid Okta credentials result in successful login

- **File:** [`playwright/tests/e2e/shared/auth/sso-login.spec.ts`](../../tests/e2e/shared/auth/sso-login.spec.ts)
- **Grep:** `npx playwright test -g "valid Okta credentials"`
- **Project:** premium **and** free · **Mode:** UI
- **Isolation:** blank session (file-level `test.use`) · page-health **on** — including while the browser is on **Okta's** origin
- **Preconditions:** SSO pre-configured; the Okta test user exists in the IdP and is JIT-provisionable in Fleet. **No env gate, no skip** — `FLEET_SSO_LOGIN_USERNAME` / `FLEET_SSO_LOGIN_PASSWORD` are read with `!` at [`sso-login.spec.ts:7-8`](../../tests/e2e/shared/auth/sso-login.spec.ts), so a missing value surfaces as an empty `fill()` and a failed Okta sign-in, not a skip.
- **Data created:** on first-ever run, JIT-provisions a real Fleet user for the Okta identity. That user's email is **not** `qa-test-*`, so `deleteAllQaTestUsers` never removes it — it persists on the instance indefinitely.

**Flow**

1. ☐ *(beforeEach)* Open `/login` via URL. ✅ *(UI)* **Email** field visible.
2. ☐ Click **Sign in with SSO** → the browser leaves Fleet for Okta.
3. ☐ Fill the Okta username field (`input[name="identifier"]` or `input[name="username"]`, `.first()`).
   - ✅ *(UI)* The username field appears within 15s.
4. ☐ If a **Next** button appears within 2s, click it (Okta orgs that split username/password across two screens).
5. ☐ Fill the Okta password field (`input[name="credentials.passcode"]` or `input[name="password"]`, `.first()`).
   - ✅ *(UI)* The password field appears within 15s.
6. ☐ Click the submit control (`input[type="submit"]`, or a button named `/sign in|verify|continue/i`, `.first()`).
   - ✅ *(UI)* URL matches `/\/dashboard/` within 30s — SAML round-trip completed and Fleet created a session.

**Assessment**
- *Value:* High in principle — the only end-to-end SAML assertion, and the only test that proves JIT provisioning works. Also the highest-maintenance test in the area (depends on a third-party UI and a live IdP tenant).
- *Coverage gaps:* Asserts only the landing URL. Doesn't verify *which* user is signed in (My Account email), the role JIT assigned, that a Fleet activity was recorded, or that the SSO user cannot change their password. Nothing covers SSO **logout**/SLO, an SSO user hitting the password form, or MFA.
- *Redundancy:* Shares the `/login` entry point with AUTH-12; the two could be one test (button → tooltip → click through), at the cost of losing the cheap tooltip assertion when Okta is flaky. The current split is defensible.
- *Efficiency / smells:* (a) All Okta locators are raw `input[name=...]` CSS with `.or()`/`.first()` chains living in the spec body — the suite's stated anti-pattern, though a third-party DOM has no role-based alternative; if it stays, it belongs in an `OktaLoginPage` POM. (b) The `if (await nextButton.isVisible(...).catch(() => false))` branch at [`sso-login.spec.ts:32`](../../tests/e2e/shared/auth/sso-login.spec.ts) is an `if` that can silently take the wrong path. (c) Three bespoke long timeouts (15s/15s/30s). (d) `pageHealth` is left **enabled** across Okta's pages, so Okta's own console noise can fail a Fleet test. (e) Fires a `POST /login`-class request into the shared throttle bucket. (f) Runs on both tiers, doubling IdP exposure for the same assertion.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### AUTH-14 · My Account change password › user rotates their password and can log back in with the new value

- **File:** [`playwright/tests/e2e/shared/account/change-password.spec.ts`](../../tests/e2e/shared/account/change-password.spec.ts)
- **Grep:** `npx playwright test -g "rotates their password"`
- **Project:** premium **and** free · **Mode:** UI+API
- **Isolation:** **Safe — no state leakage.** The rotated password belongs to a disposable API-created user, not the admin, and every UI step runs in a throwaway context via `withCleanContext` ([`helpers/auth.ts:51`](../../helpers/auth.ts)). The original password is *not* restored, and doesn't need to be: the user is deleted in `afterAll`, and any leftover is swept by `deleteAllQaTestUsers` (matches `QA_TEST_EMAIL_RE`) in the `cleanup-setup` / `cleanup-teardown` projects.
- **Preconditions:** `FLEET_TEST_USER_PASSWORD` set (`qaTestPassword()` throws otherwise)
- **Data created:** user `qa-test-<ts>-changepw@fleetdm.com`, global **observer**, `admin_forced_password_reset: false` — deleted in `afterAll` (`ignoreMissing: true`)

**Flow**

1. ☐ *(beforeAll, API)* `POST /users/admin` — create "QA Change Password" with the env password and global role `observer`, forced-reset off.
   - ✅ *(API)* Response is OK (`createUser` asserts `toBeOK`), `user.id` captured.
2. ☐ *(fresh context #1)* Log in as the new user through the real form — `loginAsAdmin` (waits on the `/sso` probe, submits with **Enter**, retries ≤90s past the login throttle).
   - ✅ *(UI)* URL is no longer `/\/login/`.
3. ☐ Open `/account` **via URL** — `MyAccountPage.goto()`.
   - ✅ *(UI)* `<h1>` **"My account"** is visible.
4. ☐ Click **Change password** in the side panel's **Password** row — `openChangePassword()`.
   - ✅ *(UI)* The **Change password** modal is visible.
   - ✅ *(UI)* The **Original password** field is visible.
5. ☐ Fill **Original password** / **New password** / **New password confirmation** (the latter two both `NewPassw0rd!Test123`) and click **Change password** — `submitChangePassword()`.
   - ✅ *(UI)* The modal is hidden.
   - ✅ *(UI)* A success toast reading **"Password changed successfully"** — `Toast.expectSuccess`, matched on the `toast-notification__card--success` modifier class so a success is not confused with an error card.
6. ☐ *(fresh context #2)* Log in as the same user with the **new** password.
   - ✅ *(UI)* URL matches `/\/dashboard/` — the rotation actually took effect server-side.
7. ☐ *(afterAll, API)* `DELETE /users/:id`.

**Assessment**
- *Value:* High. Real round-trip: UI rotation → server-side effect proven by a second real login. Well-isolated by construction and the file's header comment explains why.
- *Coverage gaps:* Only the happy path. Untested: wrong **Original password** (error state), mismatched confirmation, a new password violating Fleet's policy (<12 chars / no digit / no symbol), reusing the current password, **Cancel** dismissing the modal, and — the most valuable missing assertion — that the **old password no longer works** and that other sessions for that user are invalidated.
- *Redundancy:* Overlaps the free/premium `settings/users/edit` password work flagged in [`qawolf-migration/audit/C7-settings.md`](../qawolf-migration/audit/C7-settings.md) (admin-sets-another-user's-password), but from the self-service side — complementary, not duplicative. Re-covers login (AUTH-01) twice as scaffolding.
- *Efficiency / smells:* (a) `NEW_PASSWORD` is a module-level literal, so two concurrent tiers/workers rotate to the same value — harmless because the user is unique, but a `qaTestEmail`-style generator would be more honest. (b) `new MyAccountPage(page)` is constructed inline because there is no `myAccount` fixture — the same workaround appears in AUTH-15/16/17; the manual context makes it unavoidable *here*, but not in AUTH-15. (c) Reaches `/account` by URL rather than via the navbar **My account** menu item, so that link stays untested (see area observations). (d) Uses `loginAsAdmin` for a non-admin user — the helper name is misleading (`loginAs` would fit).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### AUTH-15 · Account • theme › selecting Dark applies dark mode and persists across reload

- **File:** [`playwright/tests/e2e/shared/account/theme.spec.ts`](../../tests/e2e/shared/account/theme.spec.ts)
- **Grep:** `npx playwright test -g "selecting Dark applies dark mode"`
- **Project:** premium **and** free · **Mode:** UI
- **Isolation:** runs as the shared **admin** on the default `page`. Safe because the theme is written to the per-test context's `localStorage`, which is never persisted back to `.auth/<suite>-admin.json`. ⚠️ note: if Fleet ever moves the theme preference server-side (a `PATCH /users/me`-style setting), this test would start leaving the admin in dark mode for every other spec in the run.
- **Preconditions:** none
- **Data created:** none (context-local `localStorage`)

**Flow**

1. ☐ Open `/account` **via URL** — `MyAccountPage.goto()`. ✅ *(UI)* `<h1>` **"My account"** visible.
2. ☐ Click the **Dark** theme radio's `<label for="theme-dark">` (Fleet hides the real `<input>` with `display:none`) — `selectTheme('Dark')`.
   - ✅ *(UI)* The radio named **Dark** is checked (asserted inside `selectTheme`).
   - ✅ *(UI)* `<body>` carries the `dark-mode` class.
3. ☐ Reload the page.
   - ✅ *(UI)* The **My account** heading is visible again.
   - ✅ *(UI)* `<body>` still carries `dark-mode` — the choice survived the reload.

**Assessment**
- *Value:* Moderate. Asserts the mechanism (class + persistence) without screenshots, which is the right call — the suite keeps no visual baselines.
- *Coverage gaps:* **Light** and **System** are never selected, so switching *back* is untested and the test always leaves the context dark. `System` (`prefers-color-scheme`) has no coverage at all. Persistence is only checked across a reload — the migration audit ([`C5-reports-dashboard-general.md`](../qawolf-migration/audit/C5-reports-dashboard-general.md), flows #2/#11) specifically wanted persistence **across logout/login**, which would prove the preference is stored per-user rather than per-browser. Nothing asserts a dark-mode page is actually legible (accepted — no baselines).
- *Redundancy:* none in-suite; supersedes the two screenshot-heavy QA Wolf dark-mode flows.
- *Efficiency / smells:* (a) `new MyAccountPage(page)` inline — no `myAccount` fixture. (b) Raw `page.locator('body')` and `label[for="theme-dark"]` in the spec/POM; the label selector is justified and commented, but the `dark-mode` body assertion would read better as `myAccount.expectDarkMode()`. (c) One-directional: a `for (const theme of ['Dark','Light'])` shape would cover the toggle back and leave the context clean.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### AUTH-16 · Free • My Account › `<key>` sees their email, name, and role (no Fleets section)

- **File:** [`playwright/tests/e2e/free/account/my-account.spec.ts`](../../tests/e2e/free/account/my-account.spec.ts)
- **Grep:** `npx playwright test -g "sees their email, name, and role"`
- **Project:** free only · **Roles (loop → 3 tests):** `global-admin`, `global-maintainer`, `global-observer`
- **Mode:** UI · **Isolation:** each role runs in its own context via `withStaticUser` ([`helpers/auth.ts:105`](../../helpers/auth.ts)); the admin storage state is untouched
- **Preconditions:** the three static humans are pre-provisioned on the free instance and `FLEET_STATIC_USER_PASSWORD` is set. Specs never create or delete them.
- **Data created:** a cached session file `.auth/static-free-<key>.json` per role (reused across workers *and runs* to stay inside Fleet's 10/min login throttle)

**Flow** *(per role)*

1. ☐ Restore the cached session for the role if one exists and navigate to `/dashboard`; if that bounces to `/login`, fall back to a fresh form login as the role — `withStaticUser`.
   - ✅ *(UI)* The restored/fresh page is not on `/login` (guard inside the helper).
2. ☐ Open `/account` **via URL**. ✅ *(UI)* `<h1>` **"My account"** visible.
3. ☐ Read the profile form and side panel.
   - ✅ *(UI)* The **Email** input's value equals the catalog email for the role.
   - ✅ *(UI)* The **Full name** input's value equals the catalog name.
   - ✅ *(UI)* The side-panel **Role** `<dd>` has exactly the expected display text (`Admin` / `Maintainer` / `Observer`, via `expectedRoleDisplay`).
   - ✅ *(UI)* The side-panel **Fleets** `<dd>` is **hidden** — Fleet renders that row only `isPremiumTier`. This is the free-tier-specific assertion and the reason this file exists.

**Assessment**
- *Value:* Moderate. The `Fleets`-row-absent check is a genuine free-tier paywall assertion; the email/name/role checks are a cheap per-role smoke test that the account page renders for non-admins.
- *Coverage gaps:* Expected values come from the **checked-in catalog** ([`helpers/api/static-users.ts`](../../helpers/api/static-users.ts)), not from `GET /users/:id` — so the test proves "UI matches our constants", and a server-side role drift that also drifted the catalog would pass. Also unchecked: the **Position** field, the **Update** button (editing name/email/position is untested anywhere), **Get API token**, and whether **Change password** is offered to every role.
- *Redundancy:* Structurally identical to AUTH-17 apart from `toBeHidden()` vs `toHaveText()` on `fleetsValue` and the role list — three of AUTH-17's seven roles are the same users. Also overlaps the role-access API specs ([`tests/api/role-access/free/global-roles.spec.ts`](../../tests/api/role-access/free/global-roles.spec.ts)), which prove the same roles from the permission side; the QA Wolf audit classed the equivalent flows as DUP of this file.
- *Efficiency / smells:* (a) `new MyAccountPage(page)` inline (no fixture). (b) `/account` reached by URL, not via the navbar menu. (c) Three near-identical tests where the free-specific value is one assertion — a single role plus a dedicated "Fleets row is premium-only" test would carry almost the same signal.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### AUTH-17 · Premium • My Account › `<key>` sees their email, name, role, and fleets

- **File:** [`playwright/tests/e2e/premium/account/my-account.spec.ts`](../../tests/e2e/premium/account/my-account.spec.ts)
- **Grep:** `npx playwright test -g "sees their email, name, role, and fleets"`
- **Project:** premium only · **Roles (loop → 7 tests):** `global-admin`, `global-maintainer`, `global-observer`, `global-observer-plus`, `global-technician`, `ws-maintainer`, `ws-observer`
- **Mode:** UI · **Isolation:** per-role context via `withStaticUser`; admin storage untouched
- **Preconditions:** all seven static humans pre-provisioned on premium; `FLEET_STATIC_USER_PASSWORD` set; the `Workstations` fleet exists (gitops)
- **Data created:** cached session file `.auth/static-premium-<key>.json` per role
- **Cross-link:** free mirror is **AUTH-16**

**Flow** *(per role)*

1. ☐ Restore or create a session as the role — `withStaticUser` (same cached-session + fallback-login logic as AUTH-16).
2. ☐ Open `/account` **via URL**. ✅ *(UI)* `<h1>` **"My account"** visible.
3. ☐ Read the profile form and side panel.
   - ✅ *(UI)* **Email** input value equals the catalog email.
   - ✅ *(UI)* **Full name** input value equals the catalog name.
   - ✅ *(UI)* Side-panel **Role** `<dd>` text equals `expectedRoleDisplay(spec)` — `Admin` / `Maintainer` / `Observer` / `Observer+` / `Technician`, mirroring Fleet's `capitalizeRole`.
   - ✅ *(UI)* Side-panel **Fleets** `<dd>` text equals `expectedFleetsDisplay(spec)` — `Global` for the five global roles, `Workstations` for the two fleet-scoped ones.

**Assessment**
- *Value:* Good coverage breadth for the side panel — five global roles plus fleet-scoped display, including `Observer+` and `Technician`, which nothing else asserts in the UI.
- *Coverage gaps:* (a) **`team-admin` is provisioned in the catalog but absent from `MY_ACCOUNT_USERS`** — it's the only static human with **two** fleet assignments, so the `"N fleets"` branch of `expectedFleetsDisplay` and the `'Various'` branch of `expectedRoleDisplay` ([`static-users.ts:333-341`](../../helpers/api/static-users.ts)) are **never exercised by any test in this area**. The QA Wolf audit listed this as blocked on provisioning a `team-admin`; that user now exists, so the gap is a one-line fix. (b) Same catalog-not-API fidelity issue as AUTH-16. (c) **Position** field, **Update** (profile edit), **Get API token** all untested. (d) No negative check that a low-privilege role *cannot* see something on this page.
- *Redundancy:* Same body as AUTH-16 for three shared roles; overlaps [`tests/api/role-access/premium/*.spec.ts`](../../tests/api/role-access/premium/) on role semantics. Seven browser logins for what is fundamentally one page rendering a two-row side panel — the highest cost-per-assertion cluster in this area (mitigated substantially by the cross-run session cache).
- *Efficiency / smells:* (a) `new MyAccountPage(page)` inline. (b) `/account` by URL, never via the navbar. (c) `expectedRoleDisplay` / `expectedFleetsDisplay` re-implement Fleet's `frontend/utilities/helpers.tsx` logic in test code — if Fleet's formatter changes, the helper changes with it and the test keeps passing.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

## Area observations

### Coverage map

| Feature / user flow | Covered by | Gap |
|---|---|---|
| Password login (happy path) | AUTH-01 + both setup projects + AUTH-10/14/16/17 as scaffolding | Over-covered; nothing asserts cookie flags or post-login landing of a *requested* deep link |
| Login failure messaging | AUTH-02, AUTH-03 | Rate-limit (429) behaviour untested — and it is the suite's #1 known auth flake source |
| Client-side form validation | AUTH-06..AUTH-09 | Errors clearing on correction; no-network-request assertion; one malformed-email case only |
| Auth guard / redirects | AUTH-04 (signed-out → login), AUTH-05 (signed-in → dashboard) | Deep protected routes; redirect-back-after-login |
| Sign-out | AUTH-10 | Cookie cleared; back-button after logout; "other sessions" invalidation |
| Forgot / reset password | AUTH-11 (link + form render only) | Submit → confirmation *or* not-configured error; emailed token; `/login/reset`; token expiry; admin-forced first-login reset — mostly blocked by no SMTP on QA |
| SSO (SAML) | AUTH-12 (button + tooltip), AUTH-13 (full Okta round-trip) | Which user signed in; JIT-assigned role; SSO logout/SLO; SSO-required mode hiding the password form; button absent when SSO off |
| MFA | — | **No coverage at all.** `updateUser` supports `mfa_enabled` ([`helpers/api/users.ts:181`](../../helpers/api/users.ts)) but no spec sets it |
| Session lifecycle | — | **No coverage.** Expiry, `DELETE /users/:id/sessions` (helper exists, unused by this area), concurrent sessions |
| My Account — read | AUTH-16 (free, 3 roles), AUTH-17 (premium, 7 roles) | `team-admin` / multi-fleet display; **Position** field; values sourced from catalog not API |
| My Account — edit profile | — | **No coverage.** `positionInput` / `updateButton` exist on the POM and are used by zero tests |
| Change password (self-service) | AUTH-14 | Wrong original password; mismatch; policy violation; Cancel; old password stops working |
| Get API token | — | **No coverage.** `getApiTokenButton` on the POM, used by zero tests |
| Theme | AUTH-15 (Dark + reload) | Light / System; toggle back; persistence across logout/login |
| Navbar user menu | AUTH-10 (**Sign out** only) | **My account** menu item is never clicked by any spec in the repo — every account spec reaches `/account` by URL |

### Duplication

1. **Happy-path login, 5 ways.** AUTH-01 asserts what `premium-setup`/`free-setup` already proved; AUTH-10, AUTH-14 (×2) and AUTH-16/17 (×10 roles) all log in through the form as a precondition. AUTH-01 is the weakest of these because it's the only one using the un-hardened `LoginPage.login()`.
2. **AUTH-06 ⊇ AUTH-07 + AUTH-08.** Three tests, two distinct messages, no test asserting an error *clears* or that the *other* error is absent.
3. **AUTH-02 ≡ AUTH-03** by assertion. Justified (message-parity is the security property) but undocumented as intentional.
4. **AUTH-16 vs AUTH-17.** Same body; the free file's only unique assertion is `fleetsValue` hidden. Three of AUTH-16's roles duplicate AUTH-17's.
5. **My Account vs role-access API specs.** `tests/api/role-access/{free,premium}/` prove role semantics; AUTH-16/17 prove the role *label*. The QA Wolf audit already classed those flows as DUP of these files.
6. **Tier duplication.** 13 of 17 declarations run once per tier. Login/validation/logout/forgot-password are genuinely tier-agnostic, so the free pass adds ~nothing beyond instance-availability signal — but it doubles this area's spend from the shared login throttle.

### UI-vs-API balance

Unusually healthy for this suite: **16 of 17 tests are pure UI**, which is correct — auth *is* the UI. Only AUTH-14 touches the API, and only for setup/teardown (`POST /users/admin`, `DELETE /users/:id`), which is the right shortcut: creating the disposable user through the UI would add a whole admin flow to a test about password rotation. No test in this area substitutes an API check for a UI assertion.

The inverse problem does appear: several assertions are **weaker than the UI could support** — AUTH-01/05/10/13 stop at `toHaveURL()` without confirming the destination rendered, and AUTH-16/17 compare the UI against a checked-in constant rather than the server's own `GET /users/:id`. That last one is the one place a small amount of API validation would *strengthen* the tests.

### Quick wins

1. Add `team-admin` to `MY_ACCOUNT_USERS` in [`tests/e2e/premium/account/my-account.spec.ts:18`](../../tests/e2e/premium/account/my-account.spec.ts) — the user is already provisioned, and it's the only way to exercise the `"N fleets"` / `'Various'` display branches.
2. Switch AUTH-01 (and any future form login) to `loginAsAdmin` from [`helpers/auth.ts`](../../helpers/auth.ts), or move its `/sso`-probe wait + throttle retry into `LoginPage.login()` — today the hardening lives only in the helper, and the specs that hit `/login` hardest don't use it.
3. Give `pageHealth` an `ignore(pattern)` alongside `disable()` in [`fixtures.ts:270`](../../fixtures.ts), then narrow the four `disable()` calls (AUTH-02/03/04/10) so those tests keep 5xx detection. AUTH-09 already runs clean with health on, which suggests the residual noise is small and pattern-able.
4. Add a `myAccount` page-object fixture — four specs (AUTH-14/15/16/17) currently do `new MyAccountPage(page)` inline, against the suite's own convention.
5. Add one navbar entry test: **user menu → My account → `/account`**. `Navbar.myAccountItem` exists and is used by zero specs; every account spec deep-links by URL.

### Bigger bets

1. **Collapse the validation family and strengthen it.** Fold AUTH-06/07/08 into one test that asserts both errors, then fills each field and asserts the matching error *clears*, plus a "no `POST /login` was issued" assertion. Net: 3 tests → 1, with more signal. Same treatment for AUTH-16 (3 roles → 1 role + 1 dedicated "Fleets row is premium-only" paywall test).
2. **Own the account page properly.** One `My Account` spec covering profile edit (name/position → **Update** → toast → reload persists), **Get API token**, the change-password negative paths (wrong original / mismatch / policy violation / Cancel / old password rejected), and theme Light↔Dark↔System with persistence across logout/login. That closes six untested surfaces that already have POM locators waiting for them.
3. **Decide the SSO strategy explicitly.** AUTH-13 is the area's only third-party-dependent test and it runs twice nightly with page-health enabled on Okta's own DOM. Either (a) extract an `OktaLoginPage` POM, disable page-health for the off-origin leg, drop the `Next`-button `if`, and restrict it to one tier; or (b) accept it as a manual pre-release check and keep only AUTH-12 automated. Related: nothing verifies *which* user SSO signed in, so the test would pass if SAML mapped the identity to the wrong account.
