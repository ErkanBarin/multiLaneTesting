#!/usr/bin/env node
// Thin wrapper — the implementation lives in @erkanbarin/core so the engine, the `mlt verify` CLI,
// and consumer projects all run the same gate. See packages/core/src/gates/robot-contract.mjs.
import { runRobotContractGate, reportRobotContract, loadProjectConfig } from '@erkanbarin/core';

const project = loadProjectConfig();
const result = runRobotContractGate({
  specDir: project.specDir,
  contractDoc: project.contractDoc,
  tags: project.robotTags,
});
process.exit(reportRobotContract(result) ? 0 : 1);
