import { strict as assert } from 'node:assert';
import { PROFESSIONS, getAdvancedProfessionChoices } from '../src/config/professions.js';
import GameSceneSource from 'node:fs';

const source = GameSceneSource.readFileSync(new URL('../src/scenes/GameScene.js', import.meta.url), 'utf8');
assert(!source.includes('midBossRewardOpen'), 'old mid-boss reward flag removed');
assert(!source.includes('midBossPostFightFlowStarted'), 'old mid-boss flow flag removed');
assert(!source.includes('midBossFlowStep'), 'old mid-boss step flag removed');
assert(source.includes('stageSystem?.onProfessionChosen'), 'profession completion returns to StageSystem');
assert.deepEqual(Object.keys(PROFESSIONS), ['warrior','mage','ranger']);
assert.deepEqual(getAdvancedProfessionChoices('warrior').map(p=>p.id), ['berserker','guardian','swordmaster']);
assert.deepEqual(getAdvancedProfessionChoices('mage').map(p=>p.id), ['elementalist','arcanist','blood_mage']);
assert.deepEqual(getAdvancedProfessionChoices('ranger').map(p=>p.id), ['sharpshooter','beast_hunter','shadow_dancer']);
console.log('[validate:profession-flow] PASS StageSystem-owned profession and advanced profession flow');
