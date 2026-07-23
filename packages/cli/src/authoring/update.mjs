// @multilane/cli — `mlt authoring update`.
//
// Update is never automatic — it is an explicit, reviewable re-materialization from whatever
// authoring package version is currently resolvable (a devDependency bump the developer already
// made and can diff in review). It re-runs install with force so previously-installed files are
// intentionally overwritten, for exactly the lanes already recorded in provenance (or an explicit
// --lanes override).
import { installAuthoring, formatInstallReport } from './install.mjs';
import { readProvenance } from './provenance.mjs';

export function updateAuthoring({ lanes, tools, cwd = process.cwd(), env = process.env }) {
  const targetLanes = lanes ?? Object.keys(readProvenance(cwd)?.lanes ?? {});
  if (targetLanes.length === 0) {
    throw new Error('Nothing to update: no lanes are recorded in .multilane/authoring.lock.json. Run "mlt authoring install" first.');
  }
  return installAuthoring({ lanes: targetLanes, tools, cwd, env, force: true });
}

export { formatInstallReport };
