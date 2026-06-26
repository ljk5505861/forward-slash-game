import fs from 'node:fs';
import assert from 'node:assert/strict';
import { TUNING } from '../src/config/tuning.js';
import { GAME_VERSION } from '../src/config/version.js';
import { createPlayerRuntime } from '../src/config/balance.js';
import StageSystem from '../src/systems/StageSystem.js';

const read = p => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const stage = read('src/systems/StageSystem.js');
const enemy = read('src/entities/createEnemy.js');
const hud = read('src/ui/Hud.js');
const tuning = read('src/config/tuning.js');
const balance = read('src/config/balance.js');

assert.match(GAME_VERSION, /^0\.10\.(4[2-9]|[5-9][0-9])$/);
assert.equal(TUNING.leveling.wavesPerLevel, 3);
assert.equal(TUNING.leveling.playerHpPerLevel, 8);
assert.equal(TUNING.leveling.playerManaPerLevel, 5);
assert.equal(TUNING.leveling.initialPlayerMana, 100);
assert.equal(TUNING.leveling.playerManaRegenPerSecond, 2);
assert.equal(TUNING.leveling.enemyHpGrowthPerLevel, 0.12);
assert.equal(TUNING.leveling.enemyDamageGrowthPerLevel, 0.04);
assert(!/waveHpGrowth/.test(tuning + stage));
assert(!/waveDamageGrowth/.test(tuning + stage));

const initialPlayer = createPlayerRuntime();
assert.equal(initialPlayer.level, 1);
assert.equal(initialPlayer.maxMana, 100);
assert.equal(initialPlayer.mana, 100);
assert(/enemyLevelHpMultiplier=1\+levelOffset\*\(leveling\.enemyHpGrowthPerLevel/.test(stage));
assert(/enemyLevelDamageMultiplier=1\+levelOffset\*\(leveling\.enemyDamageGrowthPerLevel/.test(stage));
assert(!/Math\.pow/.test(stage));
assert(/level:enemyLevel/.test(stage));
assert(/currentEnemyLevel\|\|1/.test(stage));
assert(/levelText/.test(hud) && /Lv\.\$\{p\.level\|\|1\}/.test(hud));
assert(/mpText/.test(hud) && /p\.mana/.test(hud) && /p\.maxMana/.test(hud));
assert(/levelText/.test(enemy) && /Lv\.\$\{enemy\.level\}/.test(enemy));
assert(/mana:TUNING\.leveling\.initialPlayerMana/.test(balance));

// Exercise the real StageSystem reward-close path instead of only matching source text.
const notifications=[];
const scene={
  playerData:createPlayerRuntime(),
  player:{x:220,y:850},
  hud:{update(){},setStage(){}},
  showSkillReward(){},
  queueShop(){},
  floatText(x,y,text){ notifications.push({x,y,text}); },
};
const stageSystem=new StageSystem(scene);
assert.equal(stageSystem.currentEnemyLevel,1);
assert.equal(stageSystem.pendingLevelUp,false);
assert.equal(stageSystem.completedWaveCount,0);
assert.equal(scene.playerData.level,1);
assert.equal(scene.playerData.hp,500);
assert.equal(scene.playerData.maxHp,500);
assert.equal(scene.playerData.mana,100);
assert.equal(scene.playerData.maxMana,100);

stageSystem.finishGroup();
assert.equal(stageSystem.pendingLevelUp,true,'third wave completion only queues the level-up');
assert.equal(stageSystem.completedWaveCount,3);
assert.equal(scene.playerData.level,1,'player must remain Lv.1 while selection is open');
assert.equal(stageSystem.currentEnemyLevel,1,'enemy level must remain Lv.1 while selection is open');
assert.equal(scene.playerData.maxHp,500);
assert.equal(scene.playerData.maxMana,100);

assert.equal(stageSystem.onSkillRewardClosed(),true,'closing the three-choice reward applies the pending level-up');
assert.equal(scene.playerData.level,2);
assert.equal(stageSystem.currentEnemyLevel,2);
assert.equal(scene.playerData.maxHp,508);
assert.equal(scene.playerData.hp,508);
assert.equal(scene.playerData.maxMana,105);
assert.equal(scene.playerData.mana,105);
assert.equal(notifications.length,1,'level-up notification should appear exactly once');

const afterFirst={...scene.playerData};
assert.equal(stageSystem.onSkillRewardClosed(),false,'duplicate close callback must be ignored');
assert.equal(scene.playerData.level,afterFirst.level);
assert.equal(scene.playerData.maxHp,afterFirst.maxHp);
assert.equal(scene.playerData.hp,afterFirst.hp);
assert.equal(scene.playerData.maxMana,afterFirst.maxMana);
assert.equal(scene.playerData.mana,afterFirst.mana);
assert.equal(stageSystem.currentEnemyLevel,2);
assert.equal(notifications.length,1);

stageSystem.completedWaveCount=6;
stageSystem.pendingLevelUp=true;
assert.equal(stageSystem.applyPendingLevelUp(),true,'second completed three-wave group applies the next level');
assert.equal(scene.playerData.level,3);
assert.equal(stageSystem.currentEnemyLevel,3);
assert.equal(scene.playerData.maxHp,516);
assert.equal(scene.playerData.hp,516);
assert.equal(scene.playerData.maxMana,110);
assert.equal(scene.playerData.mana,110);
assert.equal(stageSystem.applyPendingLevelUp(),false,'a consumed pending level-up cannot apply twice');
assert.equal(scene.playerData.maxHp,516);
assert.equal(scene.playerData.maxMana,110);

console.log('level system validation passed for current v0.10 mana rules');
