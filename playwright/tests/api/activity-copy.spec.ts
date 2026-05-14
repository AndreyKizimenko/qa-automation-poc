/**
 * Snapshot validation for @helpers/activity-copy. Each generated regex is
 * paired with a known-good rendered string captured from Fleet's frontend
 * activity item source (frontend/.../GlobalActivityItem.tsx). When Fleet
 * changes copy upstream this file fails before the CRUD specs do, so the
 * rename gets pinned to one helper update instead of a cascade.
 *
 * Pure unit-style — no Fleet calls, no fixtures. Imports from
 * `@playwright/test` directly so the page-object fixtures aren't needed.
 */
import { test, expect } from '@playwright/test';
import { activityCopy } from '@helpers/activity-copy';

const NAME = 'demo';
const EMAIL = 'qa-test-123@fleetdm.com';

test.describe('activityCopy', () => {
  test('policy.created — All fleets, Unassigned, Workstations', () => {
    expect(activityCopy.policy.created({ name: NAME, scope: 'All fleets' })
      .test(`created a policy ${NAME} globally.`)).toBe(true);
    expect(activityCopy.policy.created({ name: NAME, scope: 'Unassigned' })
      .test(`created a policy ${NAME} for Unassigned.`)).toBe(true);
    expect(activityCopy.policy.created({ name: NAME, scope: 'Workstations' })
      .test(`created a policy ${NAME} on the Workstations fleet.`)).toBe(true);
  });

  test('policy.edited / policy.deleted use "the policy" article', () => {
    expect(activityCopy.policy.edited({ name: NAME, scope: 'All fleets' })
      .test(`edited the policy ${NAME} globally.`)).toBe(true);
    expect(activityCopy.policy.deleted({ name: NAME, scope: 'Workstations' })
      .test(`deleted the policy ${NAME} on the Workstations fleet.`)).toBe(true);
  });

  test('report.* — globally + workstations; no Unassigned suffix', () => {
    expect(activityCopy.report.created({ name: NAME, scope: 'All fleets' })
      .test(`created a report ${NAME} globally.`)).toBe(true);
    expect(activityCopy.report.edited({ name: NAME, scope: 'Workstations' })
      .test(`edited the report ${NAME} on the Workstations fleet.`)).toBe(true);
    // Reports omit the " for Unassigned" suffix — the regex must accept the
    // bare period directly after the name.
    expect(activityCopy.report.deleted({ name: NAME, scope: 'Unassigned' })
      .test(`deleted the report ${NAME}.`)).toBe(true);
  });

  test('pack.* — global, no scope variants', () => {
    expect(activityCopy.pack.created({ name: NAME })
      .test(`created pack ${NAME}.`)).toBe(true);
    expect(activityCopy.pack.edited({ name: NAME })
      .test(`edited pack ${NAME}.`)).toBe(true);
    expect(activityCopy.pack.deleted({ name: NAME })
      .test(`deleted pack ${NAME}.`)).toBe(true);
  });

  test('script.* — to / for / from prepositions; unassigned + team', () => {
    expect(activityCopy.script.added({ name: NAME, scope: 'Unassigned' })
      .test(`added script ${NAME} to unassigned.`)).toBe(true);
    expect(activityCopy.script.edited({ name: NAME, scope: 'Workstations' })
      .test(`edited script ${NAME} for the Workstations fleet.`)).toBe(true);
    expect(activityCopy.script.deleted({ name: NAME, scope: 'Workstations' })
      .test(`deleted script ${NAME} from the Workstations fleet.`)).toBe(true);
  });

  test('user.created tolerates doubled whitespace before the email', () => {
    // Fleet's createdUser template emits `<b> EMAIL</b>` (leading space
    // inside <b>) so the rendered text has two spaces between "user" and
    // the email. `\s+` in the regex handles both single and doubled gaps.
    expect(activityCopy.user.created({ email: EMAIL })
      .test(`created a user ${EMAIL}.`)).toBe(true);
    expect(activityCopy.user.created({ email: EMAIL })
      .test(`created a user  ${EMAIL}.`)).toBe(true);
  });

  test('user.deleted', () => {
    expect(activityCopy.user.deleted({ email: EMAIL })
      .test(`deleted a user ${EMAIL}.`)).toBe(true);
  });

  test('name with regex-meta chars is escaped', () => {
    const tricky = 'name.with(parens).and+plus';
    expect(activityCopy.policy.created({ name: tricky, scope: 'All fleets' })
      .test(`created a policy ${tricky} globally.`)).toBe(true);
  });
});
