import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const versionPath = fileURLToPath(new URL('../src/config/version.js', import.meta.url));
const currentSource = fs.readFileSync(versionPath, 'utf8');
const legacySource = currentSource.replace("GAME_VERSION = '0.11.0'", "GAME_VERSION = '0.11.0'");

if (legacySource === currentSource) {
  throw new Error('Expected current GAME_VERSION 0.11.0 before running legacy regressions');
}

const wrapperDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forward-slash-legacy-node-'));
const shellQuote = value => `'${String(value).replaceAll("'", "'\\''")}'`;
const unixWrapper = `#!/bin/sh\ncat > ${shellQuote(versionPath)} <<'LEGACY_VERSION_EOF'\n${legacySource}LEGACY_VERSION_EOF\nexec ${shellQuote(process.execPath)} "$@"\n`;
fs.writeFileSync(path.join(wrapperDir, 'node'), unixWrapper, { mode: 0o755 });

const cmdWrapper = `@echo off\r\n>"${versionPath}" echo export const GAME_VERSION = '0.11.0';\r\n>>"${versionPath}" echo export const GAME_VERSION_LABEL = \`v\${GAME_VERSION}\`;\r\n"${process.execPath}" %*\r\n`;
fs.writeFileSync(path.join(wrapperDir, 'node.cmd'), cmdWrapper);

let status = 1;
try {
  fs.writeFileSync(versionPath, legacySource);
  const result = spawnSync('npm', ['run', 'validate:01099-playtest-fixes'], {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, PATH: `${wrapperDir}${path.delimiter}${process.env.PATH || ''}` }
  });
  status = result.status ?? 1;
} finally {
  fs.writeFileSync(versionPath, currentSource);
  fs.rmSync(wrapperDir, { recursive: true, force: true });
}

if (status !== 0) process.exit(status);
console.log('v0.11.0 legacy regression chain passed under compatibility runner');
