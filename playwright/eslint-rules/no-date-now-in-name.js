/** A string or template literal, or a `+` chain that holds one (`'pw-' + label`). */
function isStringSum(node) {
  if (node.type === 'TemplateLiteral') return true;
  if (node.type === 'Literal') return typeof node.value === 'string';
  return node.type === 'BinaryExpression' && node.operator === '+' && (isStringSum(node.left) || isStringSum(node.right));
}

/**
 * Whether the value of `node` ends up inside a string: as a `${…}` of a
 * template, or added to a string. Climbs through what only reshapes the number
 * on the way (`.toString(36)`, `String(…)`, `% 1e6`, `/ 1000`, `as`), and stops
 * at anything else: `Date.now() - start` and `Date.now() + 5_000` are
 * arithmetic on time, not names.
 */
function feedsAString(node) {
  let current = node;
  for (;;) {
    const parent = current.parent;
    if (!parent) return false;
    switch (parent.type) {
      case 'TemplateLiteral':
        return true;
      case 'BinaryExpression': {
        if (parent.operator === '+') {
          const other = parent.left === current ? parent.right : parent.left;
          if (isStringSum(other)) return true;
          if (other.type === 'Literal') return false;
          // `Date.now() + suffix`: a string only if the sum goes on to meet one.
          current = parent;
          continue;
        }
        if (parent.operator === '%' || parent.operator === '/') {
          current = parent;
          continue;
        }
        return false;
      }
      case 'MemberExpression':
        if (parent.object !== current) return false;
        current = parent;
        continue;
      case 'CallExpression': {
        const isMethodCall = parent.callee === current;
        const isStringCall =
          parent.callee.type === 'Identifier' && parent.callee.name === 'String' && parent.arguments[0] === current;
        if (!isMethodCall && !isStringCall) return false;
        current = parent;
        continue;
      }
      case 'TSAsExpression':
      case 'TSNonNullExpression':
        current = parent;
        continue;
      default:
        return false;
    }
  }
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'suggestion',
    docs: { description: 'A per-run name takes its unique part from runNonce(), not the clock' },
    schema: [],
    messages: {
      clockInName:
        '`Date.now()` in a per-run name: use `runNonce()` from `@helpers/profiles`.',
    },
  },
  create(context) {
    return {
      'CallExpression[callee.object.name="Date"][callee.property.name="now"]'(node) {
        if (feedsAString(node)) {
          context.report({ node, messageId: 'clockInName' });
          return;
        }
        // `const stamp = Date.now()` followed by `pw-${stamp}` somewhere in its scope.
        const declarator = node.parent;
        if (declarator.type !== 'VariableDeclarator' || declarator.init !== node) return;
        const [variable] = context.sourceCode.getDeclaredVariables(declarator);
        if (!variable) return;
        if (variable.references.some((ref) => ref.identifier !== declarator.id && feedsAString(ref.identifier))) {
          context.report({ node, messageId: 'clockInName' });
        }
      },
    };
  },
};
