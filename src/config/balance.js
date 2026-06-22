import { TUNING } from './tuning.js';

export const BALANCE = {
  groundTopY: 920, groundHeight: 360,
  player: { startX:220, startY:850, width:80, height:140, bodyWidth:58, bodyHeight:126, speedX:185, pressSpeedX:32, maxHp:120, attack:10, encounterDistance:520, stopBuffer:12 },
  leveling: { baseRequiredXp:TUNING.xp.baseRequired, growth:TUNING.xp.growthPerLevel },
  enemyFadeMs: 260,
  camera: { playerScreenAnchorX: 0.27 },
  enemies: { entrySpeed: 55, respawnPadding: 80, fullEntryPadding: 0 },
  enemyPopulation: { earlyTarget:10, midTarget:16, lateTarget:22, bossMinionsTarget:12, hardCap:28, midBossInitial:8, finalBossInitial:10, bossReinforceMin:3, bossReinforceMax:6 },
};
export const createPlayerRuntime = () => ({ level:1, xp:0, xpToNext:BALANCE.leveling.baseRequiredXp, gold:0, hp:BALANCE.player.maxHp, maxHp:BALANCE.player.maxHp, attack:10, attackSpeedMultiplier:1, skillDamageMultiplier:1, cooldownReduction:0, critChance:0.05, critMultiplier:1.5, defense:0, damageReduction:0, lifeSteal:0, weaponId:'short_sword', skills:[], artifacts:[], upgradesChosen:[], shield:0, permanentShield:0, maxShield:50, temporaryDamageReduction:0, battleMarkStacks:0, nextSkillDamageBonus:0, professionId:null, professionWeaponId:null, professionAttackProfile:null, professionState:{ warriorBuffUntil:0, mageCastCount:0, mageEmpoweredNext:false, rangerHitCount:0 } });
export const estimateDemoDurationSeconds = () => 90;
