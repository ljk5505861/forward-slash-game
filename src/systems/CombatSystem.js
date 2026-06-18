export default class CombatSystem {
  constructor(scene) {
    this.scene = scene;
  }

  rollPlayerDamage(playerStats) {
    const critical = Math.random() < playerStats.critChance;
    const damage = Math.round(playerStats.attack * (critical ? playerStats.critMultiplier : 1));
    return { damage, critical };
  }

  enemyDamage(enemy, playerStats, multiplier = 1) {
    const reduced = enemy.attack * multiplier * (1 - playerStats.damageReduction);
    return Math.max(1, Math.round(reduced));
  }
}
