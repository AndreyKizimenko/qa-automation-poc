// `page`, or a second page a test opened (`adminPage`), or the page a page
// object carries (`dashboard.page`). Page objects themselves expose no getBy*
// method, so a `…Page.getBy*()` receiver is always a Playwright page.
function isPage(node) {
  if (node.type === 'Identifier') return /^(page|[a-z]\w*Page)$/.test(node.name);
  return node.type === 'MemberExpression' && !node.computed && node.property.name === 'page';
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'suggestion',
    docs: { description: 'A spec does not build locators from the page' },
    schema: [],
    messages: {
      pageLocator:
        '`{{receiver}}.{{method}}()` in a spec: a locator belongs to a page object or component, and the spec calls it by name.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const { callee } = node;
        if (callee.type !== 'MemberExpression' || callee.computed) return;
        if (!/^getBy[A-Z]/.test(callee.property.name)) return;
        if (!isPage(callee.object)) return;
        context.report({
          node: callee,
          messageId: 'pageLocator',
          data: {
            receiver: context.sourceCode.getText(callee.object),
            method: callee.property.name,
          },
        });
      },
    };
  },
};
