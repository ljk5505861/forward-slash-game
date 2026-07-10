import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GAME_VERSION } from '../src/config/version.js';

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const packageLock = JSON.parse(fs.readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));

assert.equal(GAME_VERSION, '0.11.3');
assert.equal(packageJson.version, '0.11.3');
assert.equal(packageLock.version, '0.11.3');
assert.equal(packageLock.packages?.['']?.version, '0.11.3');

console.log('v0.11.1 version synchronization validation passed');
