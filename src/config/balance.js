import { TUNING } from './tuning.js';

export const BALANCE = {
  stageWorldWidth:12400, groundTopY: 920, groundHeight: 360,
  player: { startX:220, startY:850, width:80, height:140, bodyWidth:58, bodyHeight:126, speedX:185, pressSpeedX:32, maxHp:120, attack:10, encounterDistance:520, stopBuffer:12 },
  leveling: { baseRequiredXp:TUNING.xp.baseRequired, growth:TUNING.xp.growthPerLevel },
  enemyFadeMs: 260,
  camera: { playerScreenAnchorX: 0.27 },
  enemies: { entrySpeed: 72, respawnPadding: 96, fullEntryPadding: 0 },
  enemyPopulation: { earlyTarget:10, midTarget:16, lateTarget:22, hardCap:28, initialSpawnDelayMs:3000, waveClearDelayMs:5000, waveGapMs:{ early:[5000,5000], mid:[5000,5000], late:[5000,5000] }, waveSize:{ early:[3,5], mid:[4,6], late:[5,8] }, boss1Initial:[5,7], boss2Initial:[5,7], boss3Initial:[6,9], bossIntroDelayMs:5000, sameTypeSpawnIntervalMs:150, typeSwitchSpawnIntervalMs:300 },
};
export const createPlayerRuntime = () => ({ level:1, xp:0, xpToNext:BALANCE.leveling.baseRequiredXp, gold:0, hp:BALANCE.player.maxHp, maxHp:BALANCE.player.maxHp, attack:10, attackSpeedMultiplier:1, skillDamageMultiplier:1, cooldownReduction:0, critChance:0.05, critMultiplier:1.5, defense:0, damageReduction:0, lifeSteal:0, weaponId:'short_sword', skills:[], artifacts:[], upgradesChosen:[], shield:0, permanentShield:0, maxShield:50, temporaryDamageReduction:0, battleMarkStacks:0, nextSkillDamageBonus:0, professionId:null, professionWeaponId:null, professionAttackProfile:null, professionState:{ warriorBuffUntil:0, mageCastCount:0, mageEmpoweredNext:false, rangerHitCount:0 } });
export const estimateDemoDurationSeconds = () => 90;
