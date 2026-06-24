export const WEAPONS = {
  short_sword: { id: 'short_sword', name: '短剑', attackRange: 88, damageMultiplier: 1, attackIntervalMs: 333, knockback: 72 },
};
export const getWeapon = (id) => WEAPONS[id] || WEAPONS.short_sword;
