export const WORLD = {
  width: 9000,
  height: 1280,
  groundTop: 920,
  groundHeight: 360,
  playerStartX: 220,
  playerY: 850,
  encounterDistance: 180,
  bossKillsRequired: 10,
};

export const PLAYER_BASE = {
  maxHp: 100,
  hp: 100,
  attack: 20,
  attackSpeed: 1,
  critChance: 0.1,
  critMultiplier: 2,
  moveSpeed: 180,
  attackRange: 150,
  killHeal: 0,
  damageReduction: 0,
};

export const ENEMY_BASE = {
  maxHp: 40,
  hp: 40,
  attack: 8,
  attackInterval: 1200,
  exp: 20,
};

export const BOSS_BASE = {
  name: '训练场守卫',
  maxHp: 300,
  hp: 300,
  attack: 15,
  attackInterval: 1000,
  exp: 0,
};

export const PROGRESSION = {
  level: 1,
  exp: 0,
  expToNext: 40,
  expGrowth: 1.35,
};

export const UI = {
  attackButtonRadius: 72,
  safeMargin: 34,
};
