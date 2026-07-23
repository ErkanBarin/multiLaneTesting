// @multilane/core — `mlt verify` engine.
//
// Runs every deterministic gate against a project and returns a structured result the CLI renders
// as a green/red table. This is the single implementation behind `mlt verify` and the repo's own
// `npm run check:*` scripts.
import { loadProjectConfig } from './config.mjs';
import { runNoRuntimeAiGate } from './gates/no-runtime-ai.mjs';
import { runRobotContractGate } from './gates/robot-contract.mjs';
import { runScreenPartitionGate } from './gates/screen-partition.mjs';

/**
 * Run all deterministic gates against a project root.
 * @returns {{ ok: boolean, gates: Array<{ name: string, ok: boolean, detail: string }> }}
 */
export function runVerify({ cwd = process.cwd(), env = process.env } = {}) {
  const project = loadProjectConfig(cwd);

  const noAi = runNoRuntimeAiGate({
    cwd,
    runtimeDirs: project.runtimeDirs,
    authoringDirs: project.authoringDirs,
  });
  const robot = runRobotContractGate({
    cwd,
    specDir: project.specDir,
    contractDoc: project.contractDoc,
    tags: project.robotTags,
  });
  const screenPartition = runScreenPartitionGate({ env, lanes: project.lanes });

  const gates = [
    {
      name: 'no-runtime-ai',
      ok: noAi.ok,
      detail: noAi.ok
        ? `${noAi.scanned} runtime file(s) scanned`
        : noAi.scanned === 0
          ? '0 runtime files scanned — configure runtimeDirs in multilane.config.json'
          : `${noAi.violations.length} violation(s): ${noAi.violations.map((v) => v.path).join(', ')}`,
    },
    {
      name: 'robot-contract',
      ok: robot.ok,
      detail: robot.ok
        ? `${robot.specTags.length} spec tag(s) consistent`
        : robot.errors.join('; '),
    },
    {
      name: 'screen-partition',
      ok: screenPartition.ok,
      detail: !screenPartition.active
        ? 'screen lane not active'
        : screenPartition.ok
          ? `SCREEN_RPS_PARTITION=${screenPartition.partition}`
          : screenPartition.error,
    },
  ];

  return { ok: gates.every((g) => g.ok), gates };
}

/**
 * Render a verify result as a green/red table. Returns the overall pass/fail.
 * @returns {boolean}
 */
export function printVerifyTable(result) {
  const pad = (s, n) => String(s).padEnd(n);
  console.log(`${pad('GATE', 18)}${pad('STATUS', 8)}DETAIL`);
  console.log(`${pad('----', 18)}${pad('------', 8)}------`);
  for (const g of result.gates) {
    console.log(`${pad(g.name, 18)}${pad(g.ok ? 'PASS' : 'FAIL', 8)}${g.detail}`);
  }
  console.log('');
  console.log(result.ok ? '✓ mlt verify: all gates passed.' : '✖ mlt verify: one or more gates failed.');
  return result.ok;
}
