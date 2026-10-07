/**
 * GitOps-mode helpers — the `config.gitops` subtree that puts the UI in
 * read-only mode.
 *
 * GitOps mode is a **UI-only** lock: the API keeps accepting writes from any
 * user whose role allows them, so every helper here works with the mode on.
 * That is also why a stuck flag is dangerous rather than self-correcting — the
 * instance keeps answering while every mutating UI spec in the next run fails.
 *
 * Exception naming is inverted relative to intuition: `exceptions.labels = true`
 * means gitops mode is treated as *disabled* for labels. `useGitOpsMode` reads
 * it as `enabled && !excepted`.
 */
import { APIRequestContext } from '@playwright/test';
import { getAppConfig, patchAppConfig } from './config';
import { withApiRequest } from './core';

/** The three entities Fleet can exempt from gitops mode. */
export type GitOpsEntity = 'labels' | 'software' | 'secrets';

export interface GitOpsExceptions {
  labels: boolean;
  software: boolean;
  secrets: boolean;
}

export interface GitOpsModeConfig {
  gitops_mode_enabled: boolean;
  repository_url: string;
  exceptions: GitOpsExceptions;
}

/** Every exception off — the fully-gated state most specs want. */
const NO_EXCEPTIONS: GitOpsExceptions = { labels: false, software: false, secrets: false };

/**
 * The exceptions the premium instance rests on between runs.
 *
 * These values are load-bearing outside gitops mode: `fleetctl gitops` reads
 * them with the mode off too. An entity that isn't excepted and whose key the
 * YAML omits is deleted, and an excepted entity whose key the YAML carries is
 * refused. Premium's YAML declares no `secrets:` (enroll secrets are the UI's),
 * so `secrets: false` makes the next apply delete every enroll secret the
 * simulations re-enroll with; it declares `labels:` and `software:`, so either
 * one excepted turns the gitops chain red.
 *
 * Nothing can declare them (gitops rejects `org_settings.gitops.exceptions`), so
 * they're pinned here and in `.github/scripts/restore-gitops-exceptions.sh`,
 * which restores them before every premium apply. Change both together.
 */
export const GITOPS_EXCEPTIONS_BASELINE: Readonly<GitOpsExceptions> = {
  labels: false,
  software: false,
  secrets: true,
};

interface RawGitOpsConfig {
  gitops_mode_enabled?: boolean;
  repository_url?: string;
  exceptions?: Partial<GitOpsExceptions>;
}

/**
 * Read `config.gitops` as Fleet currently has it, normalised so callers never
 * have to deal with a missing subtree (free instances still answer, with the
 * flag off).
 */
export async function getGitOpsMode(request: APIRequestContext): Promise<GitOpsModeConfig> {
  const gitops = ((await getAppConfig(request)).gitops ?? {}) as RawGitOpsConfig;
  return {
    gitops_mode_enabled: gitops.gitops_mode_enabled ?? false,
    repository_url: gitops.repository_url ?? '',
    exceptions: { ...NO_EXCEPTIONS, ...(gitops.exceptions ?? {}) },
  };
}

/**
 * Write the whole `gitops` subtree. `PATCH /config` merges at the top level
 * but replaces `gitops` wholesale, so every field goes out on every write — a
 * partial write silently drops the exceptions.
 */
export async function setGitOpsMode(
  request: APIRequestContext,
  next: GitOpsModeConfig,
): Promise<GitOpsModeConfig> {
  await patchAppConfig(request, {
    gitops: {
      gitops_mode_enabled: next.gitops_mode_enabled,
      repository_url: next.repository_url,
      exceptions: { ...next.exceptions },
    },
  });
  return getGitOpsMode(request);
}

/**
 * Turn gitops mode on with an explicit exception set. Exceptions default to
 * all-off rather than to whatever the instance happens to carry, so a spec
 * can't pass because a previous one left an exception on.
 *
 * `repositoryUrl` defaults to the instance's own value: hard-coding a literal
 * would rewrite the QA instance's config and then assert against that write.
 */
export async function enableGitOpsMode(
  request: APIRequestContext,
  opts: { exceptions?: Partial<GitOpsExceptions>; repositoryUrl?: string } = {},
): Promise<GitOpsModeConfig> {
  const current = await getGitOpsMode(request);
  return setGitOpsMode(request, {
    gitops_mode_enabled: true,
    repository_url: opts.repositoryUrl ?? current.repository_url,
    exceptions: { ...NO_EXCEPTIONS, ...opts.exceptions },
  });
}

/**
 * Turn gitops mode off, leaving `repository_url` and the exceptions exactly as
 * found — the URL is itself part of the gate for a few surfaces, and blanking
 * it would quietly change the instance's configuration.
 *
 * Idempotent and safe to call when the mode is already off (it then writes
 * nothing at all), which is what lets both the teardown project and
 * `cleanup-setup` call it unconditionally, on either tier.
 */
export async function disableGitOpsMode(request: APIRequestContext): Promise<void> {
  const current = await getGitOpsMode(request);
  if (!current.gitops_mode_enabled) return;
  await setGitOpsMode(request, { ...current, gitops_mode_enabled: false });
}

/**
 * Put the instance back at rest: the mode off and the exceptions at
 * {@link GITOPS_EXCEPTIONS_BASELINE}, the repository URL as found. Writes
 * nothing when it's already there.
 *
 * Unlike a `withGitOpsMode` restorer, this doesn't trust a snapshot: one taken
 * after an earlier run died mid-flip would put the stuck exception back.
 */
export async function resetGitOpsMode(request: APIRequestContext): Promise<GitOpsModeConfig> {
  const current = await getGitOpsMode(request);
  const atBaseline = (Object.keys(GITOPS_EXCEPTIONS_BASELINE) as GitOpsEntity[]).every(
    (entity) => current.exceptions[entity] === GITOPS_EXCEPTIONS_BASELINE[entity],
  );
  if (!current.gitops_mode_enabled && atBaseline) return current;
  return setGitOpsMode(request, {
    ...current,
    gitops_mode_enabled: false,
    exceptions: { ...GITOPS_EXCEPTIONS_BASELINE },
  });
}

/** Flip one exception, leaving the other two and the mode flag alone. */
export async function setGitOpsException(
  request: APIRequestContext,
  entity: GitOpsEntity,
  excepted: boolean,
): Promise<GitOpsModeConfig> {
  const current = await getGitOpsMode(request);
  return setGitOpsMode(request, {
    ...current,
    exceptions: { ...current.exceptions, [entity]: excepted },
  });
}

/**
 * Snapshot the whole subtree, apply `next`, and hand back a restorer — the
 * shape `helpers/api/config.ts` already uses for org info and webhooks.
 * Whatever `next` leaves out stays as found, each exception included, so a
 * spec writes only the exceptions it needs.
 *
 * Call the restorer from a teardown hook so a failing assertion still puts the
 * instance back, exceptions and repository URL included.
 *
 * The restorer opens its own request context rather than reusing the caller's,
 * because the usual place to call it is an `afterAll` hook — by which point a
 * context borrowed from `withApiRequest` or from the test-scoped `request`
 * fixture has already been disposed.
 */
export async function withGitOpsMode(
  request: APIRequestContext,
  next: Partial<Omit<GitOpsModeConfig, 'exceptions'>> & { exceptions?: Partial<GitOpsExceptions> },
): Promise<() => Promise<void>> {
  const before = await getGitOpsMode(request);
  await setGitOpsMode(request, {
    gitops_mode_enabled: next.gitops_mode_enabled ?? before.gitops_mode_enabled,
    repository_url: next.repository_url ?? before.repository_url,
    exceptions: { ...before.exceptions, ...next.exceptions },
  });
  return async () => {
    await withApiRequest((restoreRequest) => setGitOpsMode(restoreRequest, before));
  };
}
