#!/usr/bin/env node
// `mlt` — the multilanetesting command line.
//
//   mlt verify                         run every deterministic gate against the current project
//   mlt new <name> --lanes web,http    scaffold a consumer project (depends on the versioned engine packages)
import { runVerify, printVerifyTable } from '@multilane/core';
import { scaffoldProject, SUPPORTED_LANES } from '../src/scaffold.mjs';
import { installAuthoring, formatInstallReport } from '../src/authoring/install.mjs';
import { checkAuthoring, formatCheckReport } from '../src/authoring/check.mjs';
import { updateAuthoring } from '../src/authoring/update.mjs';
import { describeConfigure } from '../src/authoring/configure.mjs';
import { ALL_KNOWN_LANES } from '../src/authoring/registry.mjs';

const argv = process.argv.slice(2);
const command = argv[0];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function printHelp() {
  console.log(`mlt — multilanetesting CLI

Usage:
  mlt verify                              Run the deterministic gates in the current project.
  mlt new <name> --lanes <list>           Scaffold a consumer project.
  mlt create-system <name> --lanes <list> Scaffold a consumer project AND install its authoring assets.
                                          Lanes: ${SUPPORTED_LANES.join(', ')}
  mlt authoring install --lanes <list>    Materialize authoring skills/agents for the selected lanes.
  mlt authoring check                     Detect drift against the last authoring install.
  mlt authoring update [--lanes <list>]   Re-materialize authoring assets from the current package version.
  mlt authoring configure <id>            Print setup steps for an optional authoring capability.
                                          Lanes with authoring assets today: ${ALL_KNOWN_LANES.join(', ')}

Examples:
  mlt new demo --lanes web,http
  mlt create-system demo --lanes web
  mlt authoring install --lanes web
  mlt verify
`);
}

function printNextSteps(name) {
  console.log(`
Next (no registry serves @multilane/* yet — install from tarballs):
  node <engine-repo>/scripts/install-tarballs.mjs ${name}   # first install — creates package-lock.json; commit it (and vendor/multilane/)
  cd ${name} && npm run verify
Once the packages are published to a registry, the tarball step becomes a plain \`npm install\` in ${name}/.`);
}

function parseLanes(value) {
  return String(value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseTools(value) {
  return value === undefined ? undefined : parseLanes(value);
}

function parseFlags(args) {
  const flags = {};
  const positionals = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positionals.push(arg);
    }
  }
  return { flags, positionals };
}

switch (command) {
  case 'verify': {
    const ok = printVerifyTable(runVerify({ cwd: process.cwd() }));
    process.exit(ok ? 0 : 1);
    break;
  }
  case 'new': {
    const { flags, positionals } = parseFlags(argv.slice(1));
    const name = positionals[0];
    if (!name) fail('Usage: mlt new <name> --lanes web,http');
    const lanes = parseLanes(flags.lanes);
    try {
      const { root, files } = scaffoldProject({ name, lanes, cwd: process.cwd(), force: !!flags.force });
      console.log(`✓ Scaffolded ${name} at ${root}`);
      for (const f of files) console.log(`  + ${f}`);
      printNextSteps(name);
    } catch (err) {
      fail(`✖ ${err.message}`);
    }
    break;
  }
  case 'create-system': {
    const { flags, positionals } = parseFlags(argv.slice(1));
    const name = positionals[0];
    if (!name) fail('Usage: mlt create-system <name> --lanes web,http');
    const lanes = parseLanes(flags.lanes);
    try {
      const { root, files } = scaffoldProject({ name, lanes, cwd: process.cwd(), force: !!flags.force });
      console.log(`✓ Scaffolded ${name} at ${root}`);
      for (const f of files) console.log(`  + ${f}`);
      const authoringLanes = lanes.filter((l) => ALL_KNOWN_LANES.includes(l));
      if (authoringLanes.length) {
        const { ok, laneReports } = installAuthoring({ lanes: authoringLanes, cwd: root });
        console.log('');
        console.log(formatInstallReport(laneReports));
        if (!ok) {
          fail(
            `✖ create-system: authoring install failed (scaffold at ${root} is intact). ` +
              'Install the reported authoring package(s) and rerun `mlt authoring install`.',
          );
        }
      }
      printNextSteps(name);
    } catch (err) {
      fail(`✖ ${err.message}`);
    }
    break;
  }
  case 'authoring': {
    const sub = argv[1];
    const { flags, positionals } = parseFlags(argv.slice(2));
    try {
      if (sub === 'install') {
        const lanes = parseLanes(flags.lanes);
        const { ok, laneReports } = installAuthoring({ lanes, tools: parseTools(flags.tools), cwd: process.cwd(), force: !!flags.force });
        console.log(formatInstallReport(laneReports));
        process.exit(ok ? 0 : 1);
      } else if (sub === 'check') {
        const result = checkAuthoring({ cwd: process.cwd() });
        console.log(formatCheckReport(result));
        process.exit(result.ok ? 0 : 1);
      } else if (sub === 'update') {
        const lanes = flags.lanes ? parseLanes(flags.lanes) : undefined;
        const { ok, laneReports } = updateAuthoring({ lanes, tools: parseTools(flags.tools), cwd: process.cwd() });
        console.log(formatInstallReport(laneReports));
        process.exit(ok ? 0 : 1);
      } else if (sub === 'configure') {
        const id = positionals[0];
        if (!id) fail('Usage: mlt authoring configure <id>');
        console.log(describeConfigure(id, { cwd: process.cwd() }));
      } else {
        fail('Usage: mlt authoring <install|check|update|configure> ...');
      }
    } catch (err) {
      fail(`✖ ${err.message}`);
    }
    break;
  }
  case '--help':
  case '-h':
  case undefined:
    printHelp();
    break;
  default:
    fail(`Unknown command "${command}". Run \`mlt --help\`.`);
}
