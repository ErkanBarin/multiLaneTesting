#!/usr/bin/env node
// Thin wrapper — the implementation lives in @multilane/core so the engine, the `mlt verify` CLI,
// and consumer projects all run the same gate. See packages/core/src/gates/no-runtime-ai.mjs.
import { runNoRuntimeAiGate, reportNoRuntimeAi, loadProjectConfig } from '@multilane/core';

const project = loadProjectConfig();
const result = runNoRuntimeAiGate({
  runtimeDirs: project.runtimeDirs,
  authoringDirs: project.authoringDirs,
});
process.exit(reportNoRuntimeAi(result) ? 0 : 1);
