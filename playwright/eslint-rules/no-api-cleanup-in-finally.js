/** Whether `node` sits inside an `afterEach` or `afterAll` callback, which a timeout doesn't cut short. */
function inAfterHook(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (
      current.type === 'CallExpression' &&
      current.callee.type === 'MemberExpression' &&
      current.callee.property.type === 'Identifier' &&
      (current.callee.property.name === 'afterEach' || current.callee.property.name === 'afterAll')
    ) {
      return true;
    }
  }
  return false;
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: { description: "A spec's undo goes to the cleanup fixture, which runs after a timeout; a `finally` doesn't" },
    schema: [],
    messages: {
      finallyCleanup:
        "A `finally` that calls the API is skipped when the test times out, and what it undoes stays on the instance: " +
        'register the undo with the `cleanup` fixture instead (`cleanup.add(what, (request) => …)`), or create ' +
        'through `throwawayFleet`, `borrowSims` or `seed`, which register their own.',
    },
  },
  create(context) {
    return {
      TryStatement(node) {
        if (!node.finalizer || inAfterHook(node)) return;
        // `request` is the API context every helper takes: a `finally` that
        // names it is putting the instance back. One that only closes a local
        // file or context is not.
        const usesApi = context.sourceCode
          .getTokens(node.finalizer)
          .some((token) => token.type === 'Identifier' && token.value === 'request');
        if (usesApi) context.report({ node: node.finalizer, messageId: 'finallyCleanup' });
      },
    };
  },
};
