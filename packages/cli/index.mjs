// @multilane/cli — programmatic entry (the `mlt` CLI is the primary interface; this exposes the
// scaffolder and authoring installer for tests and tooling).
export { scaffoldProject, SUPPORTED_LANES } from './src/scaffold.mjs';
export { installAuthoring, formatInstallReport } from './src/authoring/install.mjs';
export { checkAuthoring, formatCheckReport } from './src/authoring/check.mjs';
export { updateAuthoring } from './src/authoring/update.mjs';
export { describeConfigure } from './src/authoring/configure.mjs';
export { resolveAuthoringPackage } from './src/authoring/resolve.mjs';
export { AUTHORING_LANE_PACKAGES, IMPLEMENTED_AUTHORING_LANES, PLANNED_AUTHORING_LANES, ALL_KNOWN_LANES } from './src/authoring/registry.mjs';
export { PROVENANCE_PATH, readProvenance } from './src/authoring/provenance.mjs';
