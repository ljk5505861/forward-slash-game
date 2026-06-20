import { TAGS } from './tags.js';

export const REWARD_BIAS = Object.freeze({
  buildBiasEnabled: true,
  buildBiasStrength: 0.25,
  professionBiasStrength: 0.08,
  dominantTagLimit: 3,
  maxBuildBiasMultiplier: 1.25,
  maxProfessionBiasMultiplier: 1.08,
  candidateLimit: 3,
  specificTags: Object.freeze([
    TAGS.FIRE,
    TAGS.POISON,
    TAGS.LIGHTNING,
    TAGS.SUMMON,
    TAGS.SHIELD,
    TAGS.HEALING,
    TAGS.CRITICAL,
    TAGS.NORMAL_ATTACK,
    TAGS.DOT,
    TAGS.MELEE,
  ]),
  broadTagScale: Object.freeze({
    [TAGS.ACTIVE_SKILL]: 0.35,
    [TAGS.PROJECTILE]: 0.45,
  }),
});
