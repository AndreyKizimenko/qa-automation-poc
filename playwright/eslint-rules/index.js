// The suite's own lint rules: the parts of its written contract (CLAUDE.md, the
// author and reviewer skills) that a syntax tree can check. `eslint.config.js`
// registers them as `suite/<name>` and says which folders each applies to;
// `tests.js` beside this file holds a passing and a failing case for each.
module.exports = {
  meta: { name: 'eslint-plugin-suite' },
  rules: {
    'no-class-locator-in-spec': require('./no-class-locator-in-spec'),
    'no-page-locator-in-spec': require('./no-page-locator-in-spec'),
    'no-date-now-in-name': require('./no-date-now-in-name'),
    'use-own-name': require('./use-own-name'),
    'no-api-cleanup-in-finally': require('./no-api-cleanup-in-finally'),
    'modal-in-component': require('./widget-in-component').modal,
    'react-select-in-component': require('./widget-in-component').reactSelect,
    'actions-menu-in-component': require('./widget-in-component').actionsMenu,
    'activity-needs-baseline': require('./activity-needs-baseline'),
    'no-swallowed-response': require('./no-swallowed-response'),
    'skip-needs-reason': require('./skip-needs-reason'),
    'no-to-be-ok': require('./no-to-be-ok'),
    'no-toast-copy-in-spec': require('./no-toast-copy-in-spec'),
  },
};
