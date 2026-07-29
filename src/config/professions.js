import { TAGS } from './tags.js';

export const PROFESSION_SOURCE_KEYS=Object.freeze({ base:'profession_base', advanced:'profession_advanced' });

export const PROFESSIONS=Object.freeze({
  warrior:{id:'warrior',name:'战士',description:'选择坚韧的战斗方向。',bonuses:{attackMultiplierBonus:.10,maxHp:40,defense:4},mechanic:'攻击力 +10%，最大生命 +40，防御 +4',color:0xd95f3f,supportedTags:['physical',TAGS.MELEE,'survival']},
  mage:{id:'mage',name:'法师',description:'选择主动法术方向。',bonuses:{maxMana:30,manaRegenPerSecond:1,activeSkillDamage:.10},mechanic:'最大法力 +30，法力恢复 +1/秒，主动技能伤害 +10%',color:0x6f7cff,supportedTags:[TAGS.ACTIVE_SKILL,TAGS.MAGIC,TAGS.SPELL]},
  summoner:{id:'summoner',name:'召唤师',description:'选择召唤与契约方向。',bonuses:{summonDamage:.10,summonHealing:.10,summonMaxHp:.15},mechanic:'召唤伤害/治疗 +10%，实体召唤生命 +15%，获得一个契约槽',color:0x42c978,supportedTags:[TAGS.SUMMON]},
});

export const ADVANCED_PROFESSIONS=Object.freeze({
  berserker:{id:'berserker',base:'warrior',name:'狂战士',description:'每100点最终最大生命使全部伤害 +2%，最高 +24%。',color:0xff3b30,icon:'狂'},
  swordsman:{id:'swordsman',base:'warrior',name:'剑士',description:'最大生命 +70，防御 +8，获得的普通护盾量 +25%。',color:0x8fd7ff,icon:'剑'},
  blade_master:{id:'blade_master',base:'warrior',name:'刀客',description:'全部伤害 +10%，玩家普通攻击速度 +10%，暴击伤害 +15%。',color:0xffe08a,icon:'刀'},
  arcanist:{id:'arcanist',base:'mage',name:'奥术师',description:'冷却缩减 +12%，主动技能耗蓝 -15%；成功真实耗蓝施法后恢复2点法力。',color:0x768cff,icon:'奥'},
  blood_demon:{id:'blood_demon',base:'mage',name:'血魔',description:'主动技能伤害 +15%；直接伤害5%吸血，持续伤害1%吸血。',color:0xb91c1c,icon:'血'},
  curse_master:{id:'curse_master',base:'mage',name:'咒术师',description:'玩家负面状态持续时间 +25%；对带负面状态目标全部伤害 +12%。',color:0xb56cff,icon:'咒'},
  spirit_horde_master:{id:'spirit_horde_master',base:'summoner',name:'群灵使',description:'可增量实体召唤数量 +1；实体生命额外 +20%，召唤伤害/治疗额外 +10%。',color:0x84cc16,icon:'群'},
  symbiosis_master:{id:'symbiosis_master',base:'summoner',name:'共生师',description:'实体召唤物动态继承攻击20%、防御20%、生命15%和额外攻速30%。',color:0x22c55e,icon:'生'},
  summon_commander:{id:'summon_commander',base:'summoner',name:'统御师',description:'召唤物重复行动速度 +20%；直接单体伤害产生100范围20%溅射。',color:0x14b8a6,icon:'御'},
});

export const PROFESSION_STATE_DEFAULTS=Object.freeze({ summonContractSkillId:null, dotLifeStealRemainder:0 });
export const getProfession=id=>PROFESSIONS[id]||null;
export const getProfessionChoices=()=>['warrior','mage','summoner'].map(getProfession);
export const getAdvancedProfession=id=>ADVANCED_PROFESSIONS[id]||null;
export const getAdvancedProfessionChoices=professionId=>Object.values(ADVANCED_PROFESSIONS).filter(p=>p.base===professionId);
