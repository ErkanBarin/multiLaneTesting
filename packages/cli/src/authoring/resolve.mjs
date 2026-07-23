// @multilane/cli — resolve an `@multilane/authoring-<lane>` package from a consumer project.
//
// Real-world path: the consumer project has the authoring package as a (pinned) devDependency and
// standard Node resolution finds it in `node_modules`. Fallback: this monorepo, where the CLI and
// the authoring packages are workspace siblings — used when `mlt` scaffolds+installs in one step
// (`mlt create-system`) before anything is published, and by fixture tests that symlink a
// consumer's `node_modules/@multilane/authoring-<lane>` to the real package directory (proving the
// standard resolution path without requiring live Nexus access).
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve as pathResolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
// packages/cli/src/authoring -> packages/
const MONOREPO_PACKAGES_DIR = pathResolve(HERE, '../../../');

/**
 * Resolve an authoring package's directory and parsed package.json.
 * @returns {{ dir: string, pkg: object } | null}
 */
export function resolveAuthoringPackage(pkgName, { cwd = process.cwd() } = {}) {
  try {
    const req = createRequire(join(cwd, 'package.json'));
    const pkgJsonPath = req.resolve(`${pkgName}/package.json`);
    return { dir: dirname(pkgJsonPath), pkg: JSON.parse(readFileSync(pkgJsonPath, 'utf8')) };
  } catch {
    // Not resolvable from the consumer project — try the monorepo sibling fallback.
  }
  const short = pkgName.replace('@multilane/', '');
  const sibling = join(MONOREPO_PACKAGES_DIR, short);
  const siblingPkgJson = join(sibling, 'package.json');
  if (existsSync(siblingPkgJson)) {
    return { dir: sibling, pkg: JSON.parse(readFileSync(siblingPkgJson, 'utf8')) };
  }
  return null;
}
