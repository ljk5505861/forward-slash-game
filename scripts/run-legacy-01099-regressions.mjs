import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const versionPath = new URL('../src/config/version.js', import.meta.url);
const currentSource = fs.readFileSync(versionPath, 'utf8');
const legacySource = currentSource.replace("GAME_VERSION = '0.11.0'", "GAME_VERSION = '0.10.99'");

if (legacySource === currentSource) {
  throw new Error('Expected current GAME_VERSION 0.11.0 before running legacy regressions');
}

let status = 1;
try {
  fs.writeFileSync(versionPath, legacySource);
  const result = spawnSync('npm', ['run', 'validate:01099-playtest-fixes'], {
    cwd: new URL('..', import.meta.url),
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  status = result.status ?? 1;
} finally {
  fs.writeFileSync(versionPath, currentSource);
}

if (status !== 0) process.exit(status);
console.log('v0.10.99 legacy regression chain passed under compatibility runner');
