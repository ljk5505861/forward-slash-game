import { TAGS } from './tags.js';

export const PROFESSION_ATTACK_PROFILES = Object.freeze({
  sword_slash: { id:'sword_slash', type:'swordSlash', range:210, intervalMultiplier:1.18, damageMultiplier:1.18, projectileSpeed:0, pierce:3, visualId:'sword_arc', hitEffectId:'slash_hit' },
  arcane_bolt: { id:'arcane_bolt', type:'arcaneBolt', range:560, intervalMultiplier:1, damageMultiplier:1, projectileSpeed:520, pierce:1, visualId:'arcane_bolt', hitEffectId:'arcane_burst' },
  hunter_arrow: { id:'hunter_arrow', type:'hunterArrow', range:760, intervalMultiplier:0.82, damageMultiplier:0.86, projectileSpeed:920, pierce:1, visualId:'hunter_arrow', hitEffectId:'pierce_hit' },
});

export const PROFESSIONS = Object.freeze({
  warrior: { id:'warrior', name:'流浪剑客', description:'以长剑开路，越挫越勇；受伤后的短时间内提升所有伤害，适配普攻、技能、持续伤害与召唤构筑。', bonuses:{ attackMultiplier:1.12, maxHp:24 }, mechanic:'受到实际生命伤害后，4秒内所有伤害 +20%。', color:0xd95f3f, supportedTags:['physical',TAGS.MELEE,'survival',TAGS.ACTIVE_SKILL,TAGS.SUMMON,TAGS.DOT], resourceType:'resolve', triggerTags:['damageTaken','allDamage'], professionWeaponId:'wanderer_sword', professionAttackProfile:'sword_slash' },
  mage: { id:'mage', name:'禁书学者', description:'禁书悬浮施法，擅长调度主动技能；多次释放后强化下一次造成伤害的主动技能。', bonuses:{ skillDamageMultiplier:0.16, cooldownReduction:0.1 }, mechanic:'每释放5次主动技能，强化下一次造成伤害的主动技能 +50%。', color:0x6f7cff, supportedTags:[TAGS.ACTIVE_SKILL,'magic',TAGS.FIRE,TAGS.LIGHTNING,TAGS.POISON,TAGS.SHIELD,TAGS.HEALING,TAGS.SUMMON], resourceType:'forbidden_pages', triggerTags:['activeSkillCast','activeSkillDamage'] , professionWeaponId:'forbidden_book', professionAttackProfile:'arcane_bolt' },
  ranger: { id:'ranger', name:'荒野猎人', description:'以猎弓压制远处目标；连续命中同一目标会叠加猎印并触发额外伤害。', bonuses:{ attackSpeedMultiplier:0.15, critChance:0.08 }, mechanic:'普攻或主动技能直接命中同一目标叠加猎印，3层后造成一次职业额外伤害。', color:0x42c978, supportedTags:[TAGS.PROJECTILE,TAGS.CRITICAL,TAGS.ACTIVE_SKILL,'mark',TAGS.SUMMON,TAGS.DOT], resourceType:'hunt_mark', triggerTags:['normalAttackHit','activeSkillDirectHit'], professionWeaponId:'wild_bow', professionAttackProfile:'hunter_arrow' },
});

export const PROFESSION_STATE_DEFAULTS = Object.freeze({
  warriorBuffUntil: 0,
  mageCastCount: 0,
  mageEmpoweredNext: false,
  rangerHitCount: 0,
  rangerLastTargetId: null,
  rangerLastTargetMarks: 0,
});

export const getProfession = (id) => PROFESSIONS[id] || null;
export const getProfessionAttackProfile = (id) => PROFESSION_ATTACK_PROFILES[id] || null;
export const getProfessionChoices = ({ routeId = null, currentSkills = [], currentArtifacts = [] } = {}) => ['warrior','mage','ranger'].map(getProfession).filter(Boolean);
