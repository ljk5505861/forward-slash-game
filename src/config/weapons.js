export const WEAPONS = {
  short_sword: { id: 'short_sword', name: '短剑', attackRange: 125, damageMultiplier: 1, attackIntervalMs: 650, knockback: 18 },
};
export const getWeapon = (id) => WEAPONS[id] || WEAPONS.short_sword;
