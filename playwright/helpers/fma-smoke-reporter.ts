/**
 * Playwright reporter for the FMA smoke projects. Collects every attempt's
 * `fma-smoke` annotation (helpers/fma-smoke.ts) and, once the run ends, writes
 * `buildFmaSmokeSummary`'s Markdown to the GitHub job summary in CI and to
 * `fma-smoke-summary.md` in the output directory either way. Every attempt is
 * kept, not just the last, so a test that passed on a retry shows as flaky with
 * its failed attempts in the Detail column.
 *
 * Used beside the usual reporters (`--reporter=github,blob,./helpers/fma-smoke-reporter.ts`);
 * it writes nothing when no test recorded a result.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { FullConfig, Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import {
  FMA_SMOKE_ANNOTATION,
  FMA_SMOKE_URLS_ANNOTATION,
  buildFmaSmokeSummary,
  type FmaSmokeAttempt,
  type FmaSmokeResult,
  type FmaUrlCheckSummary,
} from './fma-smoke';

class FmaSmokeReporter implements Reporter {
  private attempts: FmaSmokeAttempt[] = [];
  private urls: FmaUrlCheckSummary | undefined;
  private outputDir = 'test-results';

  onBegin(config: FullConfig): void {
    this.outputDir = config.projects[0]?.outputDir ?? this.outputDir;
  }

  onTestEnd(_test: TestCase, result: TestResult): void {
    for (const a of result.annotations) {
      if (!a.description) continue;
      if (a.type === FMA_SMOKE_ANNOTATION) {
        this.attempts.push({ retry: result.retry, result: JSON.parse(a.description) as FmaSmokeResult });
      } else if (a.type === FMA_SMOKE_URLS_ANNOTATION) {
        this.urls = JSON.parse(a.description) as FmaUrlCheckSummary;
      }
    }
  }

  onEnd(): void {
    if (this.attempts.length === 0 && !this.urls) return;
    const md = buildFmaSmokeSummary(this.attempts, this.urls);
    fs.mkdirSync(this.outputDir, { recursive: true });
    fs.writeFileSync(path.join(this.outputDir, 'fma-smoke-summary.md'), md);
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  }

  printsToStdio(): boolean {
    return false;
  }
}

export default FmaSmokeReporter;
