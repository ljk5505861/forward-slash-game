export const TUNING = {
  xp: { baseRequired: 50, growthPerLevel: 28, normalEnemy: 18, eliteEnemy: 45, bossEnemy: 100 },
  pacing: { targetFirstSkillSeconds: 20, targetFirstArtifactSeconds: 45, targetRunDurationSeconds: 90, warningNoUpgradeSeconds: 30 },
  combat: { bossKnockbackDistance: 10 },
  difficulty: {
    normalHpMultiplier: 2,
    eliteHpMultiplier: 1.8,
    bossHpMultiplier: 1,
    normalDamageMultiplier: 0.75,
    eliteDamageMultiplier: 0.75,
    bossDamageMultiplier: 0.8,
  },
  leveling: {
    wavesPerLevel: 3,
    playerHpPerLevel: 8,
    playerManaPerLevel: 5,
    initialPlayerMana: 20,
    enemyHpGrowthPerLevel: 0.12,
    enemyDamageGrowthPerLevel: 0.04,
  },
};
