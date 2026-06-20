export const PROFESSIONS = Object.freeze({
  warrior: { id:'warrior', name:'战士', description:'普通攻击更强，生存更稳定，受伤后短暂反击。', bonuses:{ attackMultiplier:1.15, maxHp:20 }, mechanic:'受到实际生命伤害后，4秒内造成伤害 +20%。', color:0xd95f3f, supportedTags:['physical','melee'], resourceType:'rage', triggerTags:['damageTaken','normalAttack'] },
  mage: { id:'mage', name:'法师', description:'技能输出更强，技能释放更频繁。', bonuses:{ skillDamageMultiplier:0.2, cooldownReduction:0.1 }, mechanic:'每释放5次主动技能，下一次主动伤害技能伤害 +50%。', color:0x6f7cff, supportedTags:['magic','fire','lightning'], resourceType:'arcane', triggerTags:['activeSkill'] },
  ranger: { id:'ranger', name:'游侠', description:'攻击速度高，暴击更频繁，擅长连续输出。', bonuses:{ attackSpeedMultiplier:0.15, critChance:0.08 }, mechanic:'连续3次普通攻击命中后，第4次普通攻击必定暴击。', color:0x42c978, supportedTags:['physical','projectile'], resourceType:'focus', triggerTags:['normalAttack','critical'] },
});

export const PROFESSION_STATE_DEFAULTS = Object.freeze({
  warriorBuffUntil: 0,
  mageCastCount: 0,
  mageEmpoweredNext: false,
  rangerHitCount: 0,
});

export const getProfession = (id) => PROFESSIONS[id] || null;

export const getProfessionChoices = ({ routeId = null, currentSkills = [], currentArtifacts = [] } = {}) => ['warrior','mage','ranger'].map(getProfession).filter(Boolean);
