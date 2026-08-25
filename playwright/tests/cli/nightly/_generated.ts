/**
 * Runs `fleetctl generate-gitops` once per process and parses the result.
 *
 * The comparison these specs make is between two different YAML dialects:
 *
 *  - the **min GitOps config** the nightly just applied, which references its
 *    entities through `path:` pointers into `gitops/lib/` (loaded by
 *    `helpers/gitops-yaml.ts`, shared with the gitops-verify project);
 *  - the **generated output**, which inlines every entity.
 *
 * So the two sides are compared as resolved entity-name sets, never as text.
 * One `lib/` file can declare many entities — `macs-with-fleet-maintained-apps-
 * installed.yml` alone declares several labels — which is why counting `path:`
 * refs is not the same as counting labels.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { fleetctl, output, type FleetctlResult } from '@helpers/fleetctl';
import { loadGitOpsConfig, type ParsedConfig } from '@helpers/gitops-yaml';

/**
 * The min config whose apply produced the state under test. Override with
 * GITOPS_TARGET to point at a different applied config.
 */
const minTarget = process.env.GITOPS_TARGET
  ? path.resolve(process.cwd(), process.env.GITOPS_TARGET)
  : path.resolve(
      __dirname,
      '../../../../gitops',
      process.env.SUITE === 'premium' ? 'premium-fleetqa-min' : 'free-fleetqa-min',
    );

export const minConfig: ParsedConfig = loadGitOpsConfig(minTarget);
export const minConfigLabel = path.basename(minTarget);
/** The applied config's directory, for specs that re-run gitops against it. */
export const minConfigDir = minTarget;

export interface GeneratedScope {
  /** File path relative to the generate root, e.g. 'default.yml'. */
  file: string;
  doc: Record<string, unknown>;
}

export interface Generated {
  result: FleetctlResult;
  dir: string;
  /** default.yml — the global scope on premium, the whole config on free. */
  global: GeneratedScope;
  /** fleets/*.yml, keyed by basename without extension. Empty on free. */
  fleets: Map<string, GeneratedScope>;
}

let cached: Generated | undefined;

/** Generates into a fresh temp dir. Cached so each spec's beforeAll runs it once. */
export async function generate(): Promise<Generated> {
  if (cached) return cached;

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fleetctl-generate-'));
  const result = await fleetctl(['generate-gitops', '--dir', dir]);
  if (result.code !== 0) {
    throw new Error(`fleetctl generate-gitops failed (exit ${result.code}):\n${output(result)}`);
  }

  const globalPath = path.join(dir, 'default.yml');
  if (!fs.existsSync(globalPath)) {
    throw new Error(`generate-gitops wrote no default.yml into ${dir}`);
  }

  const fleets = new Map<string, GeneratedScope>();
  const fleetsDir = path.join(dir, 'fleets');
  if (fs.existsSync(fleetsDir)) {
    for (const entry of fs.readdirSync(fleetsDir).filter((f) => f.endsWith('.yml'))) {
      fleets.set(path.basename(entry, '.yml'), {
        file: path.join('fleets', entry),
        doc: readDoc(path.join(fleetsDir, entry)),
      });
    }
  }

  cached = {
    result,
    dir,
    global: { file: 'default.yml', doc: readDoc(globalPath) },
    fleets,
  };
  return cached;
}

/** Entity names under a top-level key, e.g. names(scope, 'labels'). */
export function names(scope: GeneratedScope, key: string): string[] {
  const block = scope.doc[key];
  if (!Array.isArray(block)) return [];
  return block
    .map((entry) => (entry as { name?: string } | null)?.name)
    .filter((n): n is string => typeof n === 'string');
}

/** Reads a dotted path out of a generated doc, e.g. 'org_settings.org_info.org_name'. */
export function at(scope: GeneratedScope, dotted: string): unknown {
  return dotted
    .split('.')
    .reduce<unknown>(
      (node, key) => (node as Record<string, unknown> | undefined)?.[key],
      scope.doc,
    );
}

function readDoc(filePath: string): Record<string, unknown> {
  // generate-gitops emits comment placeholders (___GITOPS_COMMENT_N___) as plain
  // scalars, so the output stays valid YAML and needs no pre-processing.
  return (yaml.load(fs.readFileSync(filePath, 'utf-8')) ?? {}) as Record<string, unknown>;
}
