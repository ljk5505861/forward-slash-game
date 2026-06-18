export const BALANCE = {
  worldWidth: 7600,
  player: {
    startX: 220,
    startY: 850,
    width: 80,
    height: 140,
    speedX: 180,
    maxHp: 120,
    damage: 28,
    attackCooldownMs: 420,
    encounterDistance: 135,
  },
  enemies: {
    countBeforeBoss: 10,
    spacing: 430,
    firstX: 760,
    y: 850,
    width: 74,
    height: 118,
    hp: 46,
    damage: 9,
    attackIntervalMs: 1100,
    xp: 24,
    fadeMs: 250,
  },
  boss: {
    xOffsetAfterFinalEnemy: 650,
    y: 825,
    width: 120,
    height: 180,
    hp: 260,
    damage: 18,
    attackIntervalMs: 950,
    xp: 120,
  },
  leveling: {
    baseRequiredXp: 50,
    growth: 25,
  },
};

export const estimateDemoDurationSeconds = () => {
  const travelDistance = BALANCE.enemies.firstX + (BALANCE.enemies.countBeforeBoss - 1) * BALANCE.enemies.spacing + BALANCE.boss.xOffsetAfterFinalEnemy - BALANCE.player.startX;
  const travelSeconds = travelDistance / BALANCE.player.speedX;
  const attacksPerEnemy = Math.ceil(BALANCE.enemies.hp / BALANCE.player.damage);
  const enemyCombatSeconds = (attacksPerEnemy * BALANCE.player.attackCooldownMs * BALANCE.enemies.countBeforeBoss) / 1000;
  const bossAttacks = Math.ceil(BALANCE.boss.hp / BALANCE.player.damage);
  const bossCombatSeconds = (bossAttacks * BALANCE.player.attackCooldownMs) / 1000;
  return Math.round(travelSeconds + enemyCombatSeconds + bossCombatSeconds);
};
