import { readFileSync } from 'node:fs';
import { BALANCE } from '../src/config/balance.js';
import { ENEMIES } from '../src/config/enemies.js';

const p = BALANCE.enemyPopulation;
for (const key of ['earlyTarget','midTarget','lateTarget','hardCap']) if (!Number.isFinite(p[key])) throw new Error(`missing ${key}`);
if (!(p.earlyTarget < p.midTarget && p.midTarget < p.lateTarget && p.hardCap >= p.lateTarget)) throw new Error('bad population targets');
if (ENEMIES.grunt.hp > 30 || ENEMIES.grunt.damage > 5) throw new Error('grunt not weakened enough');

const assertRange = (name, actual, expected) => {
  if (!Array.isArray(actual) || actual[0] !== expected[0] || actual[1] !== expected[1]) throw new Error(`${name} must be [${expected}]`);
};
assertRange('waveGapMs.early', p.waveGapMs?.early, [4000, 5000]);
assertRange('waveGapMs.mixed', p.waveGapMs?.mixed, [3500, 4500]);
assertRange('waveGapMs.late', p.waveGapMs?.late, [3000, 4000]);
assertRange('waveSize.early', p.waveSize?.early, [3, 5]);
assertRange('waveSize.mixed', p.waveSize?.mixed, [4, 6]);
assertRange('waveSize.late', p.waveSize?.late, [5, 8]);
if (p.waveTriggerRemaining?.early !== 2 || p.waveTriggerRemaining?.mixed !== 3 || p.waveTriggerRemaining?.late !== 4) throw new Error('bad wave trigger thresholds');
assertRange('midBossInitial', p.midBossInitial, [5, 7]);
assertRange('midBossSummonGapMs', p.midBossSummonGapMs, [8000, 12000]);
assertRange('midBossSummonSize', p.midBossSummonSize, [3, 5]);
if (p.midBossMinionCap !== 8) throw new Error('mid boss minion cap must be 8');
assertRange('finalBossInitial', p.finalBossInitial, [6, 9]);
assertRange('finalBossSummonGapMs', p.finalBossSummonGapMs, [7000, 10000]);
assertRange('finalBossSummonSize', p.finalBossSummonSize, [4, 6]);
assertRange('finalBossMinionCap', p.finalBossMinionCap, [10, 12]);
assertRange('bossWaveSpawnIntervalMs', p.bossWaveSpawnIntervalMs, [100, 250]);

const stageSystem = readFileSync(new URL('../src/systems/StageSystem.js', import.meta.url), 'utf8');
const requiredPatterns = [
  [/activeMinionCount\(\)>pop\.waveTriggerRemaining\[phaseId\]/, 'remaining monsters above threshold blocks next normal wave'],
  [/time<this\.nextWaveAt/, 'wave gap blocks generation before nextWaveAt'],
  [/queueWave\(Math\.min\(this\.randomRange\(pop\.waveSize\[phaseId\]\),room\)\)/, 'normal phases queue a full configured batch'],
  [/recommendedCapForPhase/, 'normal waves respect phase recommended caps'],
  [/activeEnemyCount\(\)<this\.scene\.balance\.enemyPopulation\.hardCap/, 'wave queue respects hardCap'],
  [/resetWaveState\(\).*nextWaveAt=0.*waveIndex=0.*waveQueue=\[\].*nextBossSummonAt=0/s, 'phase reset clears wave and boss summon state'],
  [/midBossSummonGapMs/, 'mid boss summon interval is configured'],
  [/finalBossSummonGapMs/, 'final boss summon interval is configured'],
  [/activeMinionCount\(\)>=cap/, 'boss minion cap prevents summon'],
  [/half\?0\.8:1/, 'final boss half health only shortens interval'],
  [/if\(this\.waveQueue\.length/, 'queued batches prevent continuous refill loops'],
];
for (const [pattern, message] of requiredPatterns) if (!pattern.test(stageSystem)) throw new Error(message);
if (/nextPopulationSpawnAt|nextBossMinionAt|bossReinforceMin|bossReinforceMax/.test(stageSystem)) throw new Error('old continuous refill timers/config remain in StageSystem');

console.log('[validate:enemy-population] PASS wave spawning, caps, boss summons, and reset checks');
