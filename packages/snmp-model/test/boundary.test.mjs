import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packagesDirectory = new URL('../../', import.meta.url);

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : entry.name.endsWith('.mjs') ? [path] : [];
  });
}

function sourceText(packageName) {
  const packageDirectory = new URL(`${packageName}/`, packagesDirectory);
  return [readFileSync(new URL('index.mjs', packageDirectory), 'utf8'), ...sourceFiles(fileURLToPath(new URL('src/', packageDirectory))).map((file) => readFileSync(file, 'utf8'))].join('\n');
}

test('snmp-model stays free of runtime and selection dependencies', () => {
  const source = sourceText('snmp-model');
  assert.doesNotMatch(source, /from\s+['"](?:net-snmp|@multilane\/snmp-adapter-selection)['"]/);
});

test('snmp-runtime stays free of selection adapter dependencies', () => {
  const source = sourceText('snmp-runtime');
  assert.doesNotMatch(source, /from\s+['"]@multilane\/snmp-adapter-selection['"]/);
});