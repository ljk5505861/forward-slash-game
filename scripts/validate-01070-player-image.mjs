import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GAME_VERSION } from '../src/config/version.js';

assert.equal(GAME_VERSION, '0.10.70');
const png = readFileSync(new URL('../src/player_idle.png', import.meta.url));
assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
assert.equal(png.toString('ascii', 12, 16), 'IHDR');
assert.equal(png.readUInt32BE(16), 127);
assert.equal(png.readUInt32BE(20), 176);
assert.equal(png[25], 6);
console.log('v0.10.70 player image validation passed.');
