/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: { description: 'A response is checked with expectOk(), which prints no headers' },
    schema: [],
    messages: {
      toBeOk:
        '`toBeOK()` prints the request\'s headers when it fails, the bearer token among them. Use `expectOk(res, what)` from `@helpers/api`.',
    },
  },
  create(context) {
    return {
      'CallExpression[callee.type="MemberExpression"][callee.computed=false][callee.property.name="toBeOK"]'(node) {
        context.report({ node: node.callee.property, messageId: 'toBeOk' });
      },
    };
  },
};
