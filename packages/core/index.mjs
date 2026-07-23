// @multilane/core — public API surface.
//
// Everything a consumer or the `mlt` CLI is allowed to import lives here. Anything not re-exported
// from this file is private engine internals (enforced by the package `exports` map, which exposes
// only ".").
export {
  loadConfig,
  assertTestPartition,
  loadProjectConfig,
  DEFAULT_RUNTIME_DIRS,
  DEFAULT_AUTHORING_DIRS,
  DEFAULT_SPEC_DIR,
  DEFAULT_CONTRACT_DOC,
} from './src/config.mjs';

export {
  FORBIDDEN_RUNTIME_PATTERNS,
  runNoRuntimeAiGate,
  reportNoRuntimeAi,
} from './src/gates/no-runtime-ai.mjs';

export { runRobotContractGate, reportRobotContract } from './src/gates/robot-contract.mjs';

export { runScreenPartitionGate, reportScreenPartition } from './src/gates/screen-partition.mjs';

export { runVerify, printVerifyTable } from './src/verify.mjs';
