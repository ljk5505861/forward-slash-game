export const PROFESSIONS = Object.freeze({
  warrior: { id:'warrior', name:'战士', description:'近身压制与受伤反击，可兼容火焰、毒素、暴击、护盾等构筑。', bonuses:{ attackMultiplier:1.15, maxHp:20 }, mechanic:'受到实际生命伤害后，4秒内造成伤害 +20%。', color:0xd95f3f, supportedTags:['melee','hit','crit','burn','poison','summon','shield'], resourceType:'rage', triggerTags:['hit','damageTaken'] },
  mage: { id:'mage', name:'法师', description:'围绕技能释放与蓄能强化，可兼容火焰、毒素、雷电、召唤、治疗等构筑。', bonuses:{ skillDamageMultiplier:0.2, cooldownReduction:0.1 }, mechanic:'每释放5次主动技能，下一次主动伤害技能伤害 +50%。', color:0x6f7cff, supportedTags:['skill','burn','poison','lightning','summon','healing'], resourceType:'arcane', triggerTags:['skillCast'] },
  ranger: { id:'ranger', name:'游侠', description:'围绕连续命中、暴击和标记，可兼容投射物、毒素、雷电、召唤等构筑。', bonuses:{ attackSpeedMultiplier:0.15, critChance:0.08 }, mechanic:'连续3次普通攻击命中后，第4次普通攻击必定暴击。', color:0x42c978, supportedTags:['normalAttack','crit','projectile','poison','lightning','mark'], resourceType:'mark', triggerTags:['normalAttackHit','crit'] },
});

export const PROFESSION_STATE_DEFAULTS = Object.freeze({
  warriorBuffUntil: 0,
  mageCastCount: 0,
  mageEmpoweredNext: false,
  rangerHitCount: 0,
});

export const getProfession = (id) => PROFESSIONS[id] || null;

export const getProfessionChoices = ({ routeId=null, currentSkills=[], currentArtifacts=[] }={}) => {
  void routeId; void currentSkills; void currentArtifacts;
  return ['warrior','mage','ranger'].map(getProfession).filter(Boolean);
};
