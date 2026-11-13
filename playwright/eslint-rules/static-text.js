/**
 * The text of a string or template literal, with each `${…}` standing in as
 * `x` so the shape around it survives (`.${base}__row` reads as `.x__row`).
 * Anything else (a variable, a call) has no text a rule can read: `null`.
 */
function staticText(node) {
  if (!node) return null;
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node.type === 'TemplateLiteral') return node.quasis.map((q) => q.value.cooked ?? '').join('x');
  return null;
}

/** True for a string literal, a template literal or a regex literal. */
function isCopyLiteral(node) {
  if (!node) return false;
  if (node.type === 'TemplateLiteral') return true;
  return node.type === 'Literal' && (typeof node.value === 'string' || Boolean(node.regex));
}

module.exports = { staticText, isCopyLiteral };
