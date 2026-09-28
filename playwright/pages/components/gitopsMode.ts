import { Locator, Page, expect } from '@playwright/test';

/**
 * Assertions for "this control is locked by gitops mode".
 *
 * `GitOpsModeTooltipWrapper` hands its child a `disableChildren` flag and lets
 * the child decide what disabled means, so there are four DOM signatures in the
 * product: a native `disabled` control, Fleet's `Checkbox` (a
 * `div[role=checkbox][aria-disabled=true]`), a react-select that exposes no
 * disabled accessible element at all, and a raw `disabled` with no wrapper.
 *
 * The one invariant across all of them is the wrapper itself: the marker span
 * is in the DOM **if and only if** gitops mode is effectively enabled for that
 * control, exceptions included. Every assertion here is built on that.
 */

/**
 * The marker span `GitOpsModeTooltipWrapper` renders. Fleet gives it no role,
 * no accessible name and no attribute, so the class is the only handle — and
 * nothing else in the app carries it.
 */
const WRAPPER_CLASS = 'gitops-mode-tooltip-wrapper';
const WRAPPER = `.${WRAPPER_CLASS}`;

/** First line of `getGitOpsModeTipContent`; the second is "(GitOps mode enabled)". */
const TOOLTIP_TEXT = 'Manage in YAML';

/**
 * react-select renders its disabled state as a class on the container and
 * nothing else — no `aria-disabled`, no accessible name, only a hidden input.
 */
const REACT_SELECT_DISABLED_CLASS = 'actions-dropdown-select--is-disabled';

/**
 * How the wrapped child expresses "disabled". `control` covers both a native
 * `disabled` attribute and Fleet's `Checkbox`, whose `aria-disabled` Playwright
 * already reads as disabled for the `checkbox` role.
 */
export type GitOpsDisabledStyle = 'control' | 'react-select';

export interface GitOpsGateOptions {
  /**
   * What to hover to raise the tooltip. Defaults to the wrapper, which is where
   * the tooltip anchors. Pass something else for a control the wrapper doesn't
   * cover — a pattern-D button under a plain `TooltipWrapper`, for instance,
   * whose own overlay intercepts pointer events.
   */
  hoverTarget?: Locator;
  style?: GitOpsDisabledStyle;
}

/** Every gitops wrapper on the page — the cheapest whole-page probe there is. */
export function gitopsWrappers(page: Page): Locator {
  return page.locator(WRAPPER);
}

/**
 * The wrapper around `control`, if the product rendered one.
 *
 * Walking *up* from the control is the only correct direction here, and
 * neither CSS nor `filter({ has })` can express it: `has` re-resolves its
 * argument underneath each candidate, so a control reached through a container
 * ("this button inside that modal") silently matches nothing while a control
 * that every wrapper contains matches all of them.
 */
export function gitopsWrapperFor(control: Locator): Locator {
  return control.locator(`xpath=ancestor-or-self::*[contains(@class, "${WRAPPER_CLASS}")]`);
}

/**
 * The disabled react-select under `control`, or `control` itself when it is the
 * select container. Self-or-descendant because call sites reach the control at
 * different depths, and a plain descendant search would find nothing on the
 * container that carries the class — reading as "not disabled" either way.
 */
function reactSelectDisabled(control: Locator): Locator {
  return control.locator(
    `xpath=descendant-or-self::*[contains(@class, "${REACT_SELECT_DISABLED_CLASS}")]`,
  );
}

/**
 * Hover `hoverTarget` and assert the gitops tooltip appears, with its `YAML`
 * link pointing at the configured repository.
 *
 * Matches on the tooltip's content rather than its class: the same tip content
 * ships from two different components, and only one of them adds the
 * `gitops-mode-tooltip-wrapper__tip-text` class.
 *
 * Leaves the pointer parked away from the control so the next call starts from
 * a clean slate — the tooltip only exists in the DOM while it is showing, and a
 * leftover one would let the next assertion pass without hovering anything.
 */
export async function expectGitOpsTooltip(
  page: Page,
  hoverTarget: Locator,
  repoUrl: string,
): Promise<void> {
  const tooltip = page.getByRole('tooltip').filter({ hasText: TOOLTIP_TEXT });
  await expect(tooltip).toHaveCount(0);

  await hoverTarget.hover();
  await expect(tooltip.first()).toBeVisible();
  // `new URL()` is how Fleet builds the href, and it normalises
  // "https://example.com" to "https://example.com/".
  await expect(tooltip.first().getByRole('link', { name: 'YAML' })).toHaveAttribute(
    'href',
    new URL(repoUrl).toString(),
  );

  await page.mouse.move(0, 0);
  await expect(tooltip).toHaveCount(0);
}

/**
 * Assert a control is gated: wrapped, disabled, and showing the "Manage in
 * YAML" tooltip on hover.
 */
export async function expectGatedByGitOps(
  control: Locator,
  repoUrl: string,
  opts: GitOpsGateOptions = {},
): Promise<void> {
  const page = control.page();
  const wrapper = gitopsWrapperFor(control);
  await expect(wrapper).toHaveCount(1);

  if (opts.style === 'react-select') {
    // Pair the class check with the wrapper assertion above: a react-select
    // that stopped emitting the class on a dependency bump would otherwise
    // read as "not disabled" instead of failing.
    await expect(reactSelectDisabled(control)).toHaveCount(1);
  } else {
    await expect(control).toBeDisabled();
  }

  await expectGitOpsTooltip(page, opts.hoverTarget ?? wrapper, repoUrl);
}

/**
 * Assert a control is *not* gated: present, enabled, with no gitops wrapper
 * around it. Covers both "mode off" and "this entity is excepted" — they render
 * identically, which is exactly the point.
 *
 * Visibility is asserted first and it is load-bearing, not decoration: every
 * other assertion here is a `toHaveCount(0)`, which a control that simply has
 * not rendered yet satisfies immediately. Without it a slow page reads as a
 * fully-restored one.
 */
export async function expectNotGatedByGitOps(
  control: Locator,
  opts: { style?: GitOpsDisabledStyle } = {},
): Promise<void> {
  await expect(control).toBeVisible();
  await expect(gitopsWrapperFor(control)).toHaveCount(0);
  if (opts.style === 'react-select') {
    await expect(reactSelectDisabled(control)).toHaveCount(0);
  } else {
    await expect(control).toBeEnabled();
  }
}
