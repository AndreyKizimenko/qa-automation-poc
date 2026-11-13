const { staticText } = require('./static-text');

// A selector engine prefix whose argument is not CSS, so a dot in it is not a class.
const NOT_CSS = /^\s*(text|xpath|id|data-testid|role)=|^\s*\/\//;
// Quoted attribute values and :has-text() arguments hold dots that are not classes.
const QUOTED = /"[^"]*"|'[^']*'/g;
const CLASS_TOKEN = /\.-?[A-Za-z_]/;
const CLASS_ATTRIBUTE = /\[\s*class\s*[~|^$*]?=/;

function namesAClass(selector) {
  if (NOT_CSS.test(selector)) return false;
  return CLASS_ATTRIBUTE.test(selector) || CLASS_TOKEN.test(selector.replace(QUOTED, '""'));
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'suggestion',
    docs: { description: 'A spec does not locate an element by CSS class' },
    schema: [],
    messages: {
      classInSpec:
        'Class selector in a spec: the locator belongs to the page object or component that owns the element.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const { callee } = node;
        if (callee.type !== 'MemberExpression' || callee.computed) return;
        if (callee.property.name !== 'locator') return;
        const selector = staticText(node.arguments[0]);
        if (selector !== null && namesAClass(selector)) {
          context.report({ node: node.arguments[0], messageId: 'classInSpec' });
        }
      },
    };
  },
};
