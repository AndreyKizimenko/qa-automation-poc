/**
 * The text a string expression opens with, when it opens with written text: a
 * template's first part, or the first literal of a `+` chain. `null` otherwise.
 */
function leadingText(node) {
  if (node.type === 'TemplateLiteral') return node.quasis[0].value.cooked ?? '';
  if (node.type === 'Literal') return typeof node.value === 'string' ? node.value : null;
  if (node.type === 'BinaryExpression' && node.operator === '+') return leadingText(node.left);
  return null;
}

/** Whether a `+` chain adds anything but literals, i.e. builds its string at run time. */
function hasRuntimePart(node) {
  if (node.type === 'BinaryExpression' && node.operator === '+') {
    return hasRuntimePart(node.left) || hasRuntimePart(node.right);
  }
  if (node.type === 'TemplateLiteral') return node.expressions.length > 0;
  return node.type !== 'Literal';
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'suggestion',
    docs: { description: 'A per-run `pw-` name comes from ownName(), which carries the run and the worker' },
    schema: [],
    messages: {
      handBuilt:
        "A `pw-` name built by hand: use `ownName('<kind>')` from `@helpers/own-name`, which carries the run and " +
        "the worker; an extension goes outside it (`${ownName('kind')}.sh`).",
    },
  },
  create(context) {
    const opensWithPw = (node) => (leadingText(node) ?? '').startsWith('pw-');
    return {
      TemplateLiteral(node) {
        if (node.parent.type === 'TaggedTemplateExpression') return;
        // A template inside a `+` chain is judged with the chain.
        if (node.parent.type === 'BinaryExpression' && node.parent.operator === '+') return;
        if (node.expressions.length > 0 && opensWithPw(node)) context.report({ node, messageId: 'handBuilt' });
      },
      BinaryExpression(node) {
        if (node.operator !== '+') return;
        if (node.parent.type === 'BinaryExpression' && node.parent.operator === '+') return;
        if (opensWithPw(node) && hasRuntimePart(node)) context.report({ node, messageId: 'handBuilt' });
      },
    };
  },
};
