export const BALANCE = {
  groundTopY: 920, groundHeight: 360,
  player: { startX:220, startY:850, width:80, height:140, bodyWidth:58, bodyHeight:126, speedX:185, pressSpeedX:32, maxHp:100, attack:10, encounterDistance:520, stopBuffer:12 },
  leveling: { baseRequiredXp:50, growth:28 },
  enemyFadeMs: 260,
};
export const createPlayerRuntime = () => ({ level:1, xp:0, xpToNext:BALANCE.leveling.baseRequiredXp, hp:100, maxHp:100, attack:10, attackSpeedMultiplier:1, skillDamageMultiplier:1, cooldownReduction:0, critChance:0.05, critMultiplier:1.5, defense:0, damageReduction:0, weaponId:'short_sword', skills:[{ id:'fireball', level:1 }], artifacts:[], upgradesChosen:[] });
export const estimateDemoDurationSeconds = () => 90;
