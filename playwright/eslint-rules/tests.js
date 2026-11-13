// One passing and one failing set of cases per suite rule. Run with
// `npm run lint:rules` (part of `npm run check`): RuleTester throws on the
// first case that doesn't behave as listed.
const { RuleTester } = require('eslint');
const tseslint = require('typescript-eslint');
const { rules } = require('./index');

const tester = new RuleTester({
  languageOptions: { parser: tseslint.parser, ecmaVersion: 2022, sourceType: 'module' },
});

tester.run('no-class-locator-in-spec', rules['no-class-locator-in-spec'], {
  valid: [
    `page.locator('body')`,
    `row.locator('tbody tr')`,
    // A dot inside a quoted attribute value or an engine argument is not a class.
    `page.locator('input[name="credentials.passcode"]')`,
    `page.locator('a[href$=".pkg"]')`,
    `page.locator('text=v1.2 is installed')`,
    // A selector held in a variable has no text to read.
    `page.locator(selector)`,
    `hostsPage.rowWith(name)`,
  ],
  invalid: [
    { code: `row.locator('.permissions__cell')`, errors: [{ messageId: 'classInSpec' }] },
    { code: `page.locator('div.modal__content')`, errors: [{ messageId: 'classInSpec' }] },
    { code: 'page.locator(`.${baseClass}__row`)', errors: [{ messageId: 'classInSpec' }] },
    { code: `page.locator('.file-details [data-testid="graphic"]')`, errors: [{ messageId: 'classInSpec' }] },
    { code: `page.locator('[class*="tooltip"]')`, errors: [{ messageId: 'classInSpec' }] },
    {
      code: `table.filter({ has: page.locator('.actions-dropdown') })`,
      errors: [{ messageId: 'classInSpec' }],
    },
  ],
});

tester.run('no-page-locator-in-spec', rules['no-page-locator-in-spec'], {
  valid: [
    `hostsPage.rowWith(name)`,
    `usersPage.toast.expectSuccess()`,
    // A locator scoped to one the page object handed over.
    `policiesList.automationsModal.getByRole('button', { name: 'Save' })`,
    `row.getByText('Admin')`,
  ],
  invalid: [
    { code: `page.getByRole('heading', { name: 'Hosts' })`, errors: [{ messageId: 'pageLocator' }] },
    { code: `page.getByText('Enter a name')`, errors: [{ messageId: 'pageLocator' }] },
    { code: `adminPage.getByLabel('Email')`, errors: [{ messageId: 'pageLocator' }] },
    { code: `dashboard.page.getByText('Vulnerabilities')`, errors: [{ messageId: 'pageLocator' }] },
  ],
});

tester.run('no-date-now-in-name', rules['no-date-now-in-name'], {
  valid: [
    // Time arithmetic and deadlines.
    `const deadline = Date.now() + timeoutMs; while (Date.now() < deadline) {}`,
    `const elapsed = Date.now() - start;`,
    `const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();`,
    `const started = Date.now(); expect(Date.now() - started).toBeLessThan(5000);`,
    'const started = Date.now(); const age = Math.round((Date.now() - started) / 1000); console.log(`took ${age}s`);',
    'const name = `pw-policy-${runNonce()}`;',
  ],
  invalid: [
    { code: 'const name = `pw-policy-${Date.now()}`;', errors: [{ messageId: 'clockInName' }] },
    { code: 'const name = `pw-${Date.now().toString(36)}`;', errors: [{ messageId: 'clockInName' }] },
    { code: 'const name = `pw-${Date.now() % 100000}`;', errors: [{ messageId: 'clockInName' }] },
    { code: `const name = 'pw-policy-' + Date.now();`, errors: [{ messageId: 'clockInName' }] },
    { code: `const name = 'pw-' + label + '-' + Date.now();`, errors: [{ messageId: 'clockInName' }] },
    { code: `const name = Date.now() + '-report';`, errors: [{ messageId: 'clockInName' }] },
    {
      code: 'const stamp = Date.now(); test("creates", async () => { await create(`qa-test-${stamp}@example.com`); });',
      errors: [{ messageId: 'clockInName' }],
    },
  ],
});

tester.run('activity-needs-baseline', rules['activity-needs-baseline'], {
  valid: [
    `await assertActivityAfter(request, 'created_policy', baseline, (d) => d.policy_name === name);`,
    `await dashboard.expectActivities([activityCopy.createdPolicy(name)]);`,
  ],
  invalid: [
    {
      code: `await assertActivity(request, 'created_policy', (d) => d.policy_name === name);`,
      errors: [{ messageId: 'noBaseline' }],
    },
  ],
});

tester.run('no-swallowed-response', rules['no-swallowed-response'], {
  valid: [
    `if (!res.ok()) throw new Error(\`[listLabels] \${res.status()}: \${await res.text()}\`);`,
    `if (!res.ok()) { throw new Error('failed'); }`,
    // A status named on purpose is a decision, not a swallow.
    `if (res.status() === 404) return null;`,
    `if (!res.ok() && res.status() !== 404) { throw new Error('failed'); }`,
    `await expect(res).toBeOK();`,
    // The status travels on in what the function returns.
    'async function f() { if (!res.ok()) return `the hosts list answered ${res.status()}`; }',
  ],
  invalid: [
    { code: `async function f() { if (!res.ok()) return; }`, errors: [{ messageId: 'swallowed' }] },
    { code: `async function f() { if (!res.ok()) return null; }`, errors: [{ messageId: 'swallowed' }] },
    { code: `async function f() { if (!res.ok()) { return []; } }`, errors: [{ messageId: 'swallowed' }] },
    { code: `for (const id of ids) { if (!swRes.ok()) continue; }`, errors: [{ messageId: 'swallowed' }] },
    { code: `if (!res.ok()) console.warn('cleanup failed');`, errors: [{ messageId: 'swallowed' }] },
    // The throw belongs to the callback, so the branch itself still falls through.
    {
      code: `if (!res.ok()) { onFail(() => { throw new Error('later'); }); }`,
      errors: [{ messageId: 'swallowed' }],
    },
  ],
});

tester.run('no-toast-copy-in-spec', rules['no-toast-copy-in-spec'], {
  valid: [
    `await usersPage.toast.expectSuccess();`,
    `await labelsPage.toast.expectError(REFUSED);`,
    `await usersPage.toast.dismissAll();`,
  ],
  invalid: [
    {
      code: `await policiesList.toast.expectSuccess('Successfully updated policy automations.');`,
      errors: [{ messageId: 'toastCopy' }],
    },
    {
      code: 'await usersPage.toast.expectSuccess(`${name} has been created!`);',
      errors: [{ messageId: 'toastCopy' }],
    },
    { code: `await toast.expectError(/Script is too large/);`, errors: [{ messageId: 'toastCopy' }] },
  ],
});

console.log(`suite lint rules: ${Object.keys(rules).length} rules behave as listed`);
