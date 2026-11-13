const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);

/** Whether `node` or anything under it satisfies `test`. A nested function is another function's business. */
function contains(node, test, visitorKeys) {
  if (!node || typeof node.type !== 'string') return false;
  if (test(node)) return true;
  if (FUNCTIONS.has(node.type)) return false;
  return (visitorKeys[node.type] ?? []).some((key) => {
    const child = node[key];
    return Array.isArray(child) ? child.some((c) => contains(c, test, visitorKeys)) : contains(child, test, visitorKeys);
  });
}

const isThrow = (node) => node.type === 'ThrowStatement';
const readsStatus = (node) =>
  node.type === 'CallExpression' &&
  node.callee.type === 'MemberExpression' &&
  !node.callee.computed &&
  node.callee.property.name === 'status';

/**
 * A branch that throws, or that returns something built from the status
 * (`return \`the hosts list answered ${res.status()}\``), passes the failure on.
 * One that returns nothing, `null` or `[]`, or only logs, drops it.
 */
function passesTheFailureOn(consequent, visitorKeys) {
  if (contains(consequent, isThrow, visitorKeys)) return true;
  const statements = consequent.type === 'BlockStatement' ? consequent.body : [consequent];
  return statements.some(
    (s) => s.type === 'ReturnStatement' && s.argument && contains(s.argument, readsStatus, visitorKeys),
  );
}

/** `!res.ok()`, alone: a test that also names a status (`&& res.status() !== 404`) is handling it on purpose. */
function isNotOk(test) {
  return (
    test.type === 'UnaryExpression' &&
    test.operator === '!' &&
    test.argument.type === 'CallExpression' &&
    test.argument.arguments.length === 0 &&
    test.argument.callee.type === 'MemberExpression' &&
    !test.argument.callee.computed &&
    test.argument.callee.property.name === 'ok'
  );
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: { description: 'A helper throws on a non-OK response' },
    schema: [],
    messages: {
      swallowed:
        'A non-OK response is dropped: throw with the status and body, and name an expected status (404, 402) before it.',
    },
  },
  create(context) {
    return {
      IfStatement(node) {
        if (!isNotOk(node.test)) return;
        if (passesTheFailureOn(node.consequent, context.sourceCode.visitorKeys)) return;
        context.report({ node: node.test, messageId: 'swallowed' });
      },
    };
  },
};
