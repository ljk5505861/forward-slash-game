export const TAGS = Object.freeze({
  FIRE: 'fire',
  POISON: 'poison',
  LIGHTNING: 'lightning',
  DOT: 'dot',
  CRITICAL: 'critical',
  NORMAL_ATTACK: 'normalAttack',
  ACTIVE_SKILL: 'activeSkill',
  SUMMON: 'summon',
  SHIELD: 'shield',
  HEALING: 'healing',
  MELEE: 'melee',
  PROJECTILE: 'projectile',
});

export const LEGACY_TAG_ALIASES = Object.freeze({
  heal: TAGS.HEALING,
  skill: TAGS.ACTIVE_SKILL,
  attack: TAGS.NORMAL_ATTACK,
});

export const CORE_TAGS = Object.freeze(Object.values(TAGS));
