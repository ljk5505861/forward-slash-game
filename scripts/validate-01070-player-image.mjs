import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GAME_VERSION } from '../src/config/version.js';

assert.equal(GAME_VERSION, '0.11.5');

const png = readFileSync(new URL('../src/player_idle.png', import.meta.url));
assert.deepEqual(
  [...png.subarray(0, 8)],
  [137, 80, 78, 71, 13, 10, 26, 10],
  'player_idle.png must have a valid PNG signature',
);
assert.equal(png.toString('ascii', 12, 16), 'IHDR', 'PNG must begin with IHDR');
assert.equal(png.readUInt32BE(16), 127, 'player image width must match the configured frame');
assert.equal(png.readUInt32BE(20), 176, 'player image height must match the configured frame');

const colorType = png[25];
assert.ok([3, 4, 6].includes(colorType), 'player image must support transparency');
if (colorType === 3) {
  assert.ok(png.includes(Buffer.from('tRNS')), 'indexed player image must contain a transparency chunk');
}

console.log('v0.11.1 player image validation passed.');
