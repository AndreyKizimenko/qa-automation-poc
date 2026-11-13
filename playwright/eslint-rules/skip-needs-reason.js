/** `skip` or `fixme` for `test.skip`, `test.fixme`, `test.describe.skip`, `test.describe.fixme`; else null. */
function skipKind(callee) {
  if (callee.type !== 'MemberExpression' || callee.computed) return null;
  const name = callee.property.name;
  if (name !== 'skip' && name !== 'fixme') return null;
  const receiver = callee.object;
  if (receiver.type === 'Identifier') return receiver.name === 'test' ? name : null;
  const isDescribe =
    receiver.type === 'MemberExpression' &&
    !receiver.computed &&
    receiver.property.name === 'describe' &&
    receiver.object.type === 'Identifier' &&
    receiver.object.name === 'test';
  return isDescribe ? name : null;
}

const isTitle = (node) =>
  node.type === 'TemplateLiteral' || (node.type === 'Literal' && typeof node.value === 'string');

// Where a skip is tracked: the Fleet issue that blocks it, or the suite's TODO.md.
const TRACKED = /TODO\(fleetdm\/fleet#\d+\)|TODO\.md/;

/**
 * The comment block that sits directly on top of `node`'s statement: each
 * comment ends on the line above the next one, or above the statement. A blank
 * line ends the block, so a far-off header is not read as the skip's reason.
 */
function commentBlockAbove(sourceCode, node) {
  let statement = node;
  while (statement.parent && !/Statement$/.test(statement.type)) statement = statement.parent;
  const block = [];
  let nextLine = statement.loc.start.line;
  for (const comment of [...sourceCode.getCommentsBefore(statement)].reverse()) {
    if (comment.loc.end.line < nextLine - 1) break;
    block.push(comment.value);
    nextLine = comment.loc.start.line;
  }
  return block.join('\n');
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: { description: 'A skip says where it is tracked, or carries its reason' },
    schema: [],
    messages: {
      untracked:
        'This {{kind}} takes the test out of every run, and nothing above it says where that is tracked. Put `// TODO(fleetdm/fleet#N): …` above it for a Fleet defect (with the row in docs/blocked-by-product-bugs.md), or name its TODO.md row.',
      noDescription:
        'A conditional {{kind}} takes its reason as the second argument: `test.skip(!host, \'no online macOS host\')`.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const kind = skipKind(node.callee);
        if (!kind) return;
        const [first, second] = node.arguments;
        const onDescribe = node.callee.object.type === 'MemberExpression';
        // `test.skip('title', fn)`, `test.describe.skip(…)` and a bare `test.skip()` take a test
        // out of every run. `test.skip(condition, reason)` takes it out of some, and carries its
        // reason itself.
        const always = onDescribe || !first || isTitle(first);
        if (always) {
          if (!TRACKED.test(commentBlockAbove(context.sourceCode, node))) {
            context.report({ node: node.callee, messageId: 'untracked', data: { kind } });
          }
        } else if (!second) {
          context.report({ node: node.callee, messageId: 'noDescription', data: { kind } });
        }
      },
    };
  },
};
