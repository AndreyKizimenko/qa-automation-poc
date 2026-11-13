/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: { description: 'An activity assertion is keyed to an id taken before the action' },
    schema: [],
    messages: {
      noBaseline:
        '`assertActivity` accepts any earlier activity with these details: take `latestActivityId()` before the action and use `assertActivityAfter`.',
    },
  },
  create(context) {
    return {
      'CallExpression[callee.type="Identifier"][callee.name="assertActivity"]'(node) {
        context.report({ node: node.callee, messageId: 'noBaseline' });
      },
    };
  },
};
