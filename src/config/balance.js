import { TUNING } from './tuning.js';

export const BALANCE = {
  stageWorldWidth:100000, groundTopY: 920, groundHeight: 360,
  player: { startX:220, startY:850, width:45, height:78, bodyWidth:32, bodyHeight:71, speedX:185, pressSpeedX:32, maxHp:500, attack:10, encounterDistance:520, stopBuffer:8 },
  enemyFadeMs: 260,
  camera: { playerScreenAnchorX: 0.15 },
  enemies: { respawnPadding: 96, fullEntryPadding: 0, rangeBuffer: 24 },
  enemyPopulation: { earlyTarget:10, midTarget:16, lateTarget:22, hardCap:28, initialSpawnDelayMs:2000, waveClearDelayMs:1500, waveGapMs:{ early:[3000,3000], mid:[3000,3000], late:[3000,3000] }, waveSize:{ early:[3,5], mid:[4,6], late:[5,8] }, phaseWaveLimit:{ late:3 }, boss1Initial:[5,7], boss2Initial:[5,7], boss3Initial:[6,9], bossIntroDelayMs:1000, sameTypeSpawnIntervalMs:100, typeSwitchSpawnIntervalMs:120 },
};
export const createPlayerRuntime = () => ({ level:1, gold:0, hp:BALANCE.player.maxHp, maxHp:BALANCE.player.maxHp, mana:TUNING.leveling.initialPlayerMana, maxMana:TUNING.leveling.initialPlayerMana, stamina:100, maxStamina:100, attack:10, strength:0, strengthBonuses:{}, attackRangeMultiplierBonuses:{}, physicalDamageBonuses:{}, physicalCritChanceBonuses:{}, physicalCritMultiplierBonuses:{}, physicalCritFinalMultiplierBonuses:{}, physicalCritDefenseIgnoreBonuses:{}, physicalLifeStealBonuses:{}, attackSpeedMultiplier:1, skillDamageMultiplier:1, cooldownReduction:0, critChance:0.05, critMultiplier:1.5, defense:0, damageReduction:0, lifeSteal:0, weaponId:'short_sword', skills:[], artifacts:[], upgradesChosen:[], shield:0, permanentShield:0, maxShield:50, temporaryDamageReduction:0, battleMarkStacks:0, nextSkillDamageBonus:0, professionId:null, advancedProfessionId:null, professionWeaponId:null, professionAttackProfile:null, professionState:{ warriorBuffUntil:0, mageCastCount:0, mageEmpoweredNext:false, rangerHitCount:0 } });
export const estimateDemoDurationSeconds = () => 180;

export const sumRuntimeBonuses = (bonuses={}) => Object.values(bonuses||{}).reduce((sum,value)=>sum+(Number(value)||0),0);
export const getTotalStrength = (p={}) => Math.max(0, Math.round((Number(p.strength)||0)+sumRuntimeBonuses(p.strengthBonuses)));
export const getEffectiveAttack = (p={}) => Math.max(1, Math.round((Number(p.attack)||1)+getTotalStrength(p)));
