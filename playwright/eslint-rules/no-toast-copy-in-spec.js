const { isCopyLiteral } = require('./static-text');

/** `toast`, or a page object's or modal's `.toast`. */
function isToast(node) {
  if (node.type === 'Identifier') return node.name === 'toast';
  return node.type === 'MemberExpression' && !node.computed && node.property.name === 'toast';
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Toast copy has one home, outside the specs' },
    schema: [],
    messages: {
      toastCopy:
        'Toast copy typed in a spec: take it from `toastCopy` (`@helpers/toast-copy`), adding the entry there ' +
        'with the Fleet source that renders it.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const { callee } = node;
        if (callee.type !== 'MemberExpression' || callee.computed) return;
        if (callee.property.name !== 'expectSuccess' && callee.property.name !== 'expectError') return;
        if (!isToast(callee.object)) return;
        if (isCopyLiteral(node.arguments[0])) {
          context.report({ node: node.arguments[0], messageId: 'toastCopy' });
        }
      },
    };
  },
};
