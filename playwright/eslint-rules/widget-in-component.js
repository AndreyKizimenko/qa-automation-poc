/**
 * Selectors that belong to one shared widget's component in pages/components/,
 * with what a page object writes instead. A widget is listed here once its
 * component exists, so the rule always names the replacement.
 */
const WIDGETS = [
  {
    pattern: /modal__modal_container/,
    use: "`fleetModal(page, '<title>')` from pages/components/Modal",
  },
];

/** The text of a string literal or template, its `${…}` parts left out. */
function textOf(node) {
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node.type === 'TemplateLiteral') return node.quasis.map((q) => q.value.cooked ?? '').join('');
  return null;
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'suggestion',
    docs: { description: "A shared widget's selector lives in its component, not in each page object" },
    schema: [],
    messages: {
      widgetSelector: "This is a shared widget's selector: use {{use}}.",
    },
  },
  create(context) {
    const check = (node) => {
      const text = textOf(node);
      if (text === null) return;
      const widget = WIDGETS.find((w) => w.pattern.test(text));
      if (widget) context.report({ node, messageId: 'widgetSelector', data: { use: widget.use } });
    };
    return { Literal: check, TemplateLiteral: check };
  },
};
