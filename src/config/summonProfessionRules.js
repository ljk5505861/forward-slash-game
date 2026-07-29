// Every current production TAGS.SUMMON skill is explicitly classified here.
export const SUMMON_PROFESSION_RULES=Object.freeze({
  sword_wave:{summonEntityType:'non_entity',professionCountMode:'none',primaryEffect:'attack'},
  spirit_wolves:{summonEntityType:'entity',professionCountMode:'extra',primaryEffect:'attack'},
  spirit_bird:{summonEntityType:'entity',professionCountMode:'unique',primaryEffect:'healing'},
  spirit_slime:{summonEntityType:'entity',professionCountMode:'unique',primaryEffect:'support'},
  sword_sheath:{summonEntityType:'non_entity',professionCountMode:'none',primaryEffect:'attack'},
  sword_tomb:{summonEntityType:'non_entity',professionCountMode:'none',primaryEffect:'attack'},
  parasitic_gu:{summonEntityType:'entity',professionCountMode:'extra',primaryEffect:'attack'},
  poison_chain:{summonEntityType:'non_entity',professionCountMode:'none',primaryEffect:'attack'},
  poison_king:{summonEntityType:'entity',professionCountMode:'unique',primaryEffect:'attack'},
});
export const getSummonProfessionRule=skillId=>SUMMON_PROFESSION_RULES[skillId]||null;
