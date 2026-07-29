export const SUMMON_CREATURE_CONTRACTS=Object.freeze({
  spirit_wolves:Object.freeze({
    skillId:'spirit_wolves',
    name:'狼群契约',
    description:'灵狼伤害 +25%，最大生命 +25%。',
    damageMultiplier:1.25,
    maxHpMultiplier:1.25
  }),
  spirit_bird:Object.freeze({
    skillId:'spirit_bird',
    name:'守护契约',
    description:'灵鸟治疗量 +25%，治疗间隔缩短20%。',
    healingMultiplier:1.25,
    actionIntervalMultiplier:0.80
  }),
  spirit_slime:Object.freeze({
    skillId:'spirit_slime',
    name:'共生契约',
    description:'灵泥对玩家和召唤物提供的全部正面强化提高25%。',
    supportMultiplier:1.25
  }),
  parasitic_gu:Object.freeze({
    skillId:'parasitic_gu',
    name:'寄生契约',
    description:'寄生蛊毒能获取 +30%，自然生命流失降低30%。',
    poisonEnergyMultiplier:1.30,
    lifeLossMultiplier:0.70
  }),
  poison_king:Object.freeze({
    skillId:'poison_king',
    name:'毒皇契约',
    description:'毒王毒伤转化成长效率 +30%，每阶段生命与攻击成长提高20%。',
    growthMultiplier:1.30,
    stageStatMultiplier:1.20
  })
});

export const SUMMON_CREATURE_CONTRACT_IDS=Object.freeze(Object.keys(SUMMON_CREATURE_CONTRACTS));
export const getSummonCreatureContract=skillId=>SUMMON_CREATURE_CONTRACTS[skillId]||null;
export const isSummonCreatureContractSkill=skillId=>!!getSummonCreatureContract(skillId);
