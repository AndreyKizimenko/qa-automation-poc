/**
 * Builds the rule that keeps one shared widget's selector inside its component
 * in pages/components/: `pattern` is the widget's selector, `use` what a page
 * object writes instead. Each widget is a rule of its own (`index.js`), so the
 * places that predate it are recorded for that widget alone.
 */

/** The text of a string literal or template, its `${…}` parts left out. */
function textOf(node) {
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node.type === 'TemplateLiteral') return node.quasis.map((q) => q.value.cooked ?? '').join('');
  return null;
}

/** @returns {import('eslint').Rule.RuleModule} */
function widgetRule({ widget, pattern, use }) {
  return {
    meta: {
      type: 'suggestion',
      docs: { description: `${widget}'s selector lives in its component, not in each page object` },
      schema: [],
      messages: { widgetSelector: `This is ${widget}'s selector: use ${use}.` },
    },
    create(context) {
      const check = (node) => {
        const text = textOf(node);
        if (text !== null && pattern.test(text)) context.report({ node, messageId: 'widgetSelector' });
      };
      return { Literal: check, TemplateLiteral: check };
    },
  };
}

module.exports = {
  modal: widgetRule({
    widget: "Fleet's Modal",
    pattern: /modal__modal_container/,
    use: "`fleetModal(page, '<title>')` from pages/components/Modal",
  }),
  reactSelect: widgetRule({
    widget: "Fleet's DropdownWrapper (react-select)",
    pattern: /\breact-select__/,
    use: '`new ReactSelect(<its container>)` from pages/components/dropdowns',
  }),
  sqlEditor: widgetRule({
    widget: 'the report and policy SQL editor',
    // The class itself, not one that starts with it (`.sql-editor-example`).
    pattern: /\.sql-editor(?![\w-])/,
    use: '`new SqlEditor(page)` from pages/components/SqlEditor',
  }),
  actionsMenu: widgetRule({
    widget: "Fleet's ActionsDropdown (a row's Actions menu)",
    pattern: /actions-dropdown/,
    use: '`new ActionsMenu(row).choose(action)` from pages/components/dropdowns',
  }),
};
