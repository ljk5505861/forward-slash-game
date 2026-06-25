import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';

const levels = (values, build, milestones={}) => values.map((value,index)=>({
  ...build(value,index+1),
  ...(milestones[index+1]?{milestoneText:milestones[index+1]}:{}),
}));

const STRENGTH_CORE_SKILLS = {
  giant_force: {
    id:'giant_force', name:'巨力', rarity:'RARE', handler:'giant_force', passive:true, maxLevel:9,
    coreSkill:true, requiredSkillId:'spinning_blade',
    tags:['physical',TAGS.NORMAL_ATTACK,TAGS.HEAVY_HIT,TAGS.MELEE,TAGS.BUILD_STRENGTH], cooldownMs:999999,
    targetType:'passive', color:0xffc06a, short:'力',
    description:'提高普通攻击伤害与击退距离，让重击获得更强的正面压制力。',
    levels:levels([
      [4,8],[6,10],[9,14],[12,18],[15,22],[19,28],[23,34],[28,40],[34,48]
    ],([attackBonus,knockbackBonus])=>({ attackBonus,knockbackBonus,desc:`攻击力提高${attackBonus}点，普通攻击额外击退${knockbackBonus}距离。` }),{
      3:'攻击力提高9点，额外击退提高至14',
      6:'攻击力提高19点，额外击退提高至28',
      9:'攻击力提高34点，额外击退提高至48'
    })
  },
  bloodthirst: {
    id:'bloodthirst', name:'嗜血', rarity:'RARE', handler:'bloodthirst', passive:true, maxLevel:9,
    coreSkill:true, requiredSkillId:'spinning_blade',
    tags:['physical',TAGS.NORMAL_ATTACK,TAGS.HEAVY_HIT,TAGS.BUILD_STRENGTH], cooldownMs:999999,
    targetType:'passive', color:0xd84d5c, short:'血',
    description:'普通攻击获得吸血，重击额外获得更高吸血比例。',
    levels:levels([
      [0.02,0.03],[0.025,0.04],[0.03,0.05],[0.035,0.06],[0.04,0.07],[0.045,0.09],[0.05,0.11],[0.055,0.13],[0.06,0.16]
    ],([lifeSteal,heavyLifeSteal])=>({ lifeSteal,heavyLifeSteal,desc:`普通攻击吸血${Math.round(lifeSteal*100)}%，重击额外吸血${Math.round(heavyLifeSteal*100)}%。` }),{
      3:'普通攻击吸血提高至3%，重击额外吸血提高至5%',
      6:'普通攻击吸血提高至5%，重击额外吸血提高至9%',
      9:'普通攻击吸血提高至6%，重击额外吸血提高至16%'
    })
  }
};

export function configureStrengthCoreSkills(){
  Object.entries(STRENGTH_CORE_SKILLS).forEach(([id,config])=>{ SKILLS[id]={...config}; });
}

export const GiantForceSkill={
  bind(system){
    let appliedAttack=0;
    let appliedKnockback=0;
    const updater=()=>{
      const p=system.scene.playerData;
      const data=system.getData('giant_force');
      p.attack=Math.max(1,(p.attack||1)-appliedAttack);
      p.normalAttackKnockbackBonus=Math.max(0,(p.normalAttackKnockbackBonus||0)-appliedKnockback);
      appliedAttack=data?.attackBonus||0;
      appliedKnockback=data?.knockbackBonus||0;
      p.attack+=appliedAttack;
      p.normalAttackKnockbackBonus+=appliedKnockback;
    };
    system.passiveUpdaters.push(updater);
    updater();
    return ()=>{};
  }
};

export const BloodthirstSkill={
  bind(system){
    let appliedLifeSteal=0;
    let appliedHeavyLifeSteal=0;
    const updater=()=>{
      const p=system.scene.playerData;
      const data=system.getData('bloodthirst');
      p.lifeSteal=Math.max(0,(p.lifeSteal||0)-appliedLifeSteal);
      p.heavyHitLifeSteal=Math.max(0,(p.heavyHitLifeSteal||0)-appliedHeavyLifeSteal);
      appliedLifeSteal=data?.lifeSteal||0;
      appliedHeavyLifeSteal=data?.heavyLifeSteal||0;
      p.lifeSteal+=appliedLifeSteal;
      p.heavyHitLifeSteal+=appliedHeavyLifeSteal;
    };
    system.passiveUpdaters.push(updater);
    updater();
    return ()=>{};
  }
};
