export const UPGRADE_POOL = [
  { id: 'attack', title: '攻击力 +5', apply: (p) => { p.attack += 5; } },
  { id: 'hp', title: '最大生命 +20\n恢复 20', apply: (p) => { p.maxHp += 20; p.hp = Math.min(p.maxHp, p.hp + 20); } },
  { id: 'speed', title: '攻击速度 +15%', apply: (p) => { p.attackSpeed *= 1.15; } },
  { id: 'crit', title: '暴击率 +5%', apply: (p) => { p.critChance = Math.min(0.6, p.critChance + 0.05); } },
  { id: 'critDamage', title: '暴击伤害 +25%', apply: (p) => { p.critMultiplier += 0.25; } },
  { id: 'heal', title: '击杀恢复 +5', apply: (p) => { p.killHeal += 5; } },
  { id: 'reduction', title: '伤害减免 +10%', apply: (p) => { p.damageReduction = Math.min(0.5, p.damageReduction + 0.1); } },
  { id: 'range', title: '攻击范围 +15%', apply: (p) => { p.attackRange *= 1.15; } },
];

export default class UpgradeSystem {
  getChoices(count = 3) {
    return [...UPGRADE_POOL]
      .sort(() => Math.random() - 0.5)
      .slice(0, count);
  }

  applyUpgrade(choice, playerStats) {
    choice.apply(playerStats);
  }
}
