/**
 * Premium • Settings • Fleets — an admin adds a fleet, renames it and deletes
 * it from Settings › Fleets, each step confirmed by its toast, the table and
 * the API.
 *
 * **The fleet is a throwaway `pw-fleet-<ms>`, created and deleted by this
 * test.** `playwright/CLAUDE.md` protects the instance's standing fleets and
 * allows a throwaway `pw-*` one that exists only between a test's first and
 * last step. Anything this test leaves behind is removed by the `afterEach`,
 * which looks up both of its names and runs even when the test times out, and,
 * after a run killed outright, by the `pw-*` fleet sweep in
 * `setup/cleanup.steps.ts`.
 *
 * While it exists the fleet shows in every fleet picker, gets a generated
 * enroll secret and copied agent options, and logs activities — none of which
 * another spec reads by a `pw-*` name. Assertions are on the named row, not
 * the table's row count, which other specs' fleets can change.
 *
 * Grounded in frontend/pages/admin/ManageFleetsPage (CreateFleetModal,
 * RenameFleetModal, DeleteFleetModal; toasts at ManageFleetsPage.tsx:158,202,237).
 */
import type { APIRequestContext } from '@playwright/test';
import { test, expect } from '@fixtures';
import { apiUrl, authHeaders, deleteFleet, findFleetByName } from '@helpers/api';

async function fleetName(request: APIRequestContext, id: number): Promise<string | null> {
  const res = await request.get(apiUrl(`fleets/${id}`), { headers: authHeaders() });
  if (res.status() === 404) return null;
  await expect(res, `Failed to read fleet ${id}`).toBeOK();
  const body = await res.json();
  return (body.fleet ?? body.team).name as string;
}

test.describe('Premium • Settings • fleet lifecycle', () => {
  // The names this test may have created, looked up by name afterwards: the UI
  // creates the fleet before the test knows its id.
  let names: string[] = [];

  test.afterEach(async ({ request }) => {
    const leftover = names;
    names = [];
    // The QA gateway serves the odd 502, so one attempt isn't a guarantee.
    await expect(async () => {
      for (const name of leftover) {
        const fleet = await findFleetByName(request, name);
        if (fleet) await deleteFleet(request, fleet.id, { ignoreMissing: true });
      }
    }).toPass({ timeout: 30_000 });
  });

  test('an admin adds, renames and deletes a fleet', async ({ fleetsPage, request }) => {
    const name = `pw-fleet-${Date.now()}`;
    const renamed = `${name}-renamed`;
    names = [name, renamed];

    await fleetsPage.goto();
    await fleetsPage.addFleet(name);
    await fleetsPage.toast.expectSuccess(`Successfully created ${name}.`);
    await expect(fleetsPage.row(name)).toBeVisible();
    const created = await findFleetByName(request, name);
    expect(created, 'the new fleet exists in the API').not.toBeNull();
    const fleetId = created!.id;

    await fleetsPage.renameFleet(name, renamed);
    await fleetsPage.toast.expectSuccess(`Successfully updated fleet name to ${renamed}.`);
    await expect(fleetsPage.row(renamed)).toBeVisible();
    await expect(fleetsPage.row(name)).toHaveCount(0);
    expect(await fleetName(request, fleetId)).toBe(renamed);

    await fleetsPage.deleteFleet(renamed);
    await fleetsPage.toast.expectSuccess(`Successfully deleted ${renamed}.`);
    await expect(fleetsPage.row(renamed)).toHaveCount(0);
    await expect.poll(() => fleetName(request, fleetId), { message: 'the fleet is gone from the API' }).toBeNull();
  });
});
