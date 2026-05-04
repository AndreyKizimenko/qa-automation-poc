/**
 * Loads the GitOps directory once per test run. Each spec imports
 * `gitopsConfig` and asserts the live Fleet instance matches.
 *
 * Override the directory with the GITOPS_DIR env var:
 *   GITOPS_DIR=../gitops/free-fleetqa-min npm run test:api-verify:free
 */
import * as path from 'path';
import { loadGitOpsConfig } from '@helpers/gitops-yaml';

const dir = process.env.GITOPS_DIR
  ? path.resolve(process.cwd(), process.env.GITOPS_DIR)
  : path.resolve(__dirname, '../../../gitops/free-fleetqa');

export const gitopsDir = dir;
export const gitopsLabel = path.basename(dir);
export const gitopsConfig = loadGitOpsConfig(dir);
