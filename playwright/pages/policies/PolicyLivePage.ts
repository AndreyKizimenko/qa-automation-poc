import { Page, Locator } from '@playwright/test';
import { ReportLivePage } from '../reports/ReportLivePage';

/**
 * `/policies/:id/live` — a policy run live, reached from the policy's details
 * page with "Run policy". The same target picker and results screen as a
 * report's live run ("Running policy" → "Policy finished"), so everything but
 * the policy's own summary comes from `ReportLivePage`.
 *
 * A host that answers with rows is marked **Pass**, one that answers with none
 * **Fail**, and a host whose query errors lands on the Errors tab instead. Once
 * the run has finished, the results header reads "(Yes: X%, No: Y%)", each share
 * of the hosts that answered without an error, with its host count in a tooltip.
 */
export class PolicyLivePage extends ReportLivePage {
  /**
   * The "(Yes: X%, No: Y%)" summary beside the results count, rendered only once
   * the run has finished. Role-less spans, so the component's class is the handle.
   */
  readonly passFailSummary: Locator;
  /** The Yes share: hover it for its "N host(s)" tooltip. */
  readonly yesShare: Locator;
  /** The No share: hover it for its "N host(s)" tooltip. */
  readonly noShare: Locator;

  constructor(page: Page) {
    super(page, 'policy');
    this.passFailSummary = page.locator('.query-results__results-pass-fail-pct');
    // Each percentage is wrapped by Fleet's TooltipWrapper, whose hover target is
    // the only element carrying `data-tooltip-id`; Yes renders before No.
    const shares = this.passFailSummary.locator('[data-tooltip-id]');
    this.yesShare = shares.nth(0);
    this.noShare = shares.nth(1);
  }

  /** The tooltip a hovered share raises, matched by its exact text. */
  shareTooltip(text: string): Locator {
    return this.page.getByRole('tooltip').filter({ hasText: new RegExp(`^${text}$`) });
  }
}
