export const TAGS = Object.freeze({
  FIRE: 'fire',
  POISON: 'poison',
  LIGHTNING: 'lightning',
  DOT: 'dot',
  CRITICAL: 'critical',
  NORMAL_ATTACK: 'normalAttack',
  HEAVY_HIT: 'heavyHit',
  ACTIVE_SKILL: 'activeSkill',
  SUMMON: 'summon',
  SHIELD: 'shield',
  HEALING: 'healing',
  MELEE: 'melee',
  PROJECTILE: 'projectile',
  BUILD_FIRE: 'buildFire',
  BUILD_SWORD: 'buildSword',
  BUILD_POISON_SUMMON: 'buildPoisonSummon',
  BUILD_STRENGTH: 'buildStrength',
  BUILD_DEFENSE: 'buildDefense',
  BUILD_AFTERIMAGE: 'buildAfterimage',
});

export const LEGACY_TAG_ALIASES = Object.freeze({
  heal: TAGS.HEALING,
  skill: TAGS.ACTIVE_SKILL,
  attack: TAGS.NORMAL_ATTACK,
});

export const BUILD_TAGS = Object.freeze([
  TAGS.BUILD_FIRE,
  TAGS.BUILD_SWORD,
  TAGS.BUILD_POISON_SUMMON,
  TAGS.BUILD_STRENGTH,
  TAGS.BUILD_DEFENSE,
  TAGS.BUILD_AFTERIMAGE,
]);

export const CORE_TAGS = Object.freeze(Object.values(TAGS));
