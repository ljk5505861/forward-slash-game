// Every current production TAGS.SUMMON skill is explicitly classified here.
export const SUMMON_PROFESSION_RULES=Object.freeze({
  sword_wave:{summonEntityType:'non_entity',professionCountMode:'none',primaryEffect:'attack',supportsActionSpeed:true,supportsCommanderSplash:true,directAttackKind:'single',uniqueCompensationKind:'none'},
  spirit_wolves:{summonEntityType:'entity',professionCountMode:'extra',primaryEffect:'attack',supportsActionSpeed:true,supportsCommanderSplash:true,directAttackKind:'mixed',uniqueCompensationKind:'none'},
  spirit_bird:{summonEntityType:'entity',professionCountMode:'unique',primaryEffect:'healing',supportsActionSpeed:true,supportsCommanderSplash:false,directAttackKind:'none',uniqueCompensationKind:'healing'},
  spirit_slime:{summonEntityType:'non_entity',professionCountMode:'unique',primaryEffect:'support',supportsActionSpeed:true,supportsCommanderSplash:true,directAttackKind:'single',uniqueCompensationKind:'support'},
  sword_sheath:{summonEntityType:'non_entity',professionCountMode:'none',primaryEffect:'attack',supportsActionSpeed:false,supportsCommanderSplash:false,directAttackKind:'area',uniqueCompensationKind:'none'},
  sword_tomb:{summonEntityType:'non_entity',professionCountMode:'none',primaryEffect:'attack',supportsActionSpeed:false,supportsCommanderSplash:false,directAttackKind:'area',uniqueCompensationKind:'none'},
  parasitic_gu:{summonEntityType:'entity',professionCountMode:'extra',primaryEffect:'attack',supportsActionSpeed:true,supportsCommanderSplash:true,directAttackKind:'single',uniqueCompensationKind:'none'},
  poison_chain:{summonEntityType:'non_entity',professionCountMode:'none',primaryEffect:'attack',supportsActionSpeed:false,supportsCommanderSplash:false,directAttackKind:'chain',uniqueCompensationKind:'none'},
  poison_king:{summonEntityType:'entity',professionCountMode:'unique',primaryEffect:'attack',supportsActionSpeed:true,supportsCommanderSplash:true,directAttackKind:'mixed',uniqueCompensationKind:'attack'},
});
export const getSummonProfessionRule=skillId=>SUMMON_PROFESSION_RULES[skillId]||null;
