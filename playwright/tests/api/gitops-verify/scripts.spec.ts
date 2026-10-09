/**
 * Scripts: the scope's scripts are exactly the declared files, and each one's
 * body on the instance is the file in the repo. Fleet names a script by its
 * basename, and a body swap under an unchanged name is the drift a name check
 * can't see — the body is what a host runs.
 */
import { test, expect } from '@playwright/test';
import { gitopsConfig, gitopsLabel, resolveTeamId, getAll, getText, expectExactNames, normalizeBody } from './_config';

interface ApiScript {
  id: number;
  name: string;
}

let teamId = 0;
let live: ApiScript[] = [];

test.beforeAll(async ({ request }) => {
  teamId = await resolveTeamId(request);
  live = await getAll<ApiScript>(request, `scripts?team_id=${teamId}`, 'scripts');
});

test.describe(`GitOps verify · scripts · ${gitopsLabel}`, () => {
  test('the script set matches gitops exactly', async () => {
    expectExactNames(
      'scripts',
      live.map((s) => s.name),
      gitopsConfig.scripts.map((s) => s.name),
    );
  });

  test("each script's body matches the repo", async ({ request }) => {
    const byName = new Map(live.map((s) => [s.name, s]));
    for (const declared of gitopsConfig.scripts) {
      const script = byName.get(declared.name);
      if (!script) continue; // reported by the set test
      const body = await getText(request, `scripts/${script.id}?alt=media`);
      expect.soft(normalizeBody(body), `script "${declared.name}" body`).toBe(normalizeBody(declared.body));
    }
  });
});
