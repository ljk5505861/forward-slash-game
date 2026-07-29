// Production summons opt in explicitly; never infer behavior from an id or name.
export const SUMMON_PROFESSION_RULES=Object.freeze({
  bullet_eater:{summonEntityType:'non_entity',professionCountMode:'none',role:'attack'},
  mirror_march:{summonEntityType:'non_entity',professionCountMode:'none',role:'attack'},
  spirit_wolves:{summonEntityType:'entity',professionCountMode:'extra',role:'attack'},
  spirit_bird:{summonEntityType:'entity',professionCountMode:'unique',role:'healing'},
  spirit_slime:{summonEntityType:'entity',professionCountMode:'unique',role:'support'},
  sword_soul:{summonEntityType:'non_entity',professionCountMode:'none',role:'attack'},
  sword_array:{summonEntityType:'non_entity',professionCountMode:'none',role:'attack'},
  poison_parasite:{summonEntityType:'entity',professionCountMode:'extra',role:'attack'},
  mantra_heavenly_book:{summonEntityType:'entity',professionCountMode:'unique',role:'attack'},
});
export const getSummonProfessionRule=skillId=>SUMMON_PROFESSION_RULES[skillId]||null;
