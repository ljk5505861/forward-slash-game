export const TAGS = Object.freeze({
  FIRE: 'fire',
  MAGIC: 'magic',
  SPELL: 'spell',
  POISON: 'poison',
  LIGHTNING: 'lightning',
  GRAVITY: 'gravity',
  CELESTIAL: 'celestial',
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
  BUILD_SUMMON: 'buildSummon',
  BUILD_STRENGTH: 'buildStrength',
  BUILD_DEFENSE: 'buildDefense',
  BUILD_AFTERIMAGE: 'buildAfterimage',
  BUILD_WEAPON: 'buildWeapon',
  BUILD_GRAVITY: 'buildGravity',
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
  TAGS.BUILD_SUMMON,
  TAGS.BUILD_STRENGTH,
  TAGS.BUILD_DEFENSE,
  TAGS.BUILD_AFTERIMAGE,
  TAGS.BUILD_WEAPON,
  TAGS.BUILD_GRAVITY,
]);

export const CORE_TAGS = Object.freeze(Object.values(TAGS));
