import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';
import { StatusEffects } from '../../systems/StatusEffectSystem.js';

const nineLevels = (values, build, milestones={}) => values.map((value, index) => ({
  ...build(value, index + 1),
  ...(milestones[index + 1] ? { milestoneText:milestones[index + 1] } : {}),
}));

const configs = {
  fireball: {
    id:'fireball', name:'火球', rarity:'COMMON', handler:'entry_fireball', maxLevel:9,
    tags:[TAGS.FIRE,TAGS.ACTIVE_SKILL,TAGS.PROJECTILE,TAGS.BUILD_FIRE], cooldownMs:1900,
    targetType:'nearestAhead', color:0xff6533, short:'火',
    description:'向前方敌人发射火球，命中后点燃目标并叠加燃烧。',
    levels:nineLevels([
      [50,6,1,1900],[58,6,1,1800],[68,8,2,1750],[78,8,2,1680],[90,10,2,1620],[104,10,3,1560],[120,12,3,1500],[138,12,3,1440],[160,14,4,1360]
    ],([damage,burnDamage,burnStacks,cooldownMs],level)=>({ damage,burnDamage,burnStacks,cooldownMs,burnMs:3600,burnIntervalMs:600,maxStacks:12,desc:level===1?'发射火球并施加燃烧。':`火球伤害提高，命中叠加${burnStacks}层燃烧。` }),{
      3:'命中时叠加2层燃烧',
      6:'命中时叠加3层燃烧',
      9:'命中时叠加4层燃烧'
    })
  },
  sword_wave: {
    id:'sword_wave', name:'御剑术', rarity:'COMMON', handler:'entry_sword', passive:true, maxLevel:9,
    tags:['physical',TAGS.SUMMON,TAGS.PROJECTILE,TAGS.BUILD_SWORD], cooldownMs:999999,
    targetType:'passive', color:0xb8f7ff, short:'剑',
    description:'召出常驻飞剑悬浮身后，自动出击斩杀敌人。',
    levels:nineLevels([
      [1,34,1300],[1,42,1220],[2,44,1180],[2,54,1100],[2,64,1030],[3,68,980],[3,82,920],[3,96,860],[4,104,780]
    ],([swords,damage,attackIntervalMs],level)=>({ swords,damage,attackIntervalMs,desc:level===1?'召出1把常驻飞剑自动攻击。':`维持${swords}把飞剑，缩短出击间隔并提高伤害。` }),{
      3:'飞剑数量增加至2把',
      6:'飞剑数量增加至3把',
      9:'飞剑数量增加至4把'
    })
  },
  poison_cloud: {
    id:'poison_cloud', name:'毒针', rarity:'COMMON', handler:'entry_poison_needle', maxLevel:9,
    tags:[TAGS.POISON,TAGS.DOT,TAGS.ACTIVE_SKILL,TAGS.PROJECTILE,TAGS.BUILD_POISON_SUMMON], cooldownMs:1700,
    targetType:'nearestAhead', color:0x40d060, short:'毒',
    description:'发射毒针造成伤害，并为目标叠加持续中毒。',
    levels:nineLevels([
      [26,6,1,1700,1],[32,6,1,1620,1],[40,8,2,1550,1],[48,8,2,1480,1],[58,10,2,1420,1],[70,10,3,1360,2],[84,12,3,1300,2],[100,14,3,1240,2],[120,16,4,1160,3]
    ],([damage,poisonDamage,poisonStacks,cooldownMs,pierce],level)=>({ damage,poisonDamage,poisonStacks,cooldownMs,pierce,poisonMs:4200,poisonIntervalMs:700,maxStacks:15,desc:level===1?'发射毒针并施加中毒。':`毒针可命中${pierce}个目标，并叠加${poisonStacks}层中毒。` }),{
      3:'每次命中叠加2层中毒',
      6:'毒针可穿透2个目标，并叠加3层中毒',
      9:'毒针可穿透3个目标，并叠加4层中毒'
    })
  },
  spinning_blade: {
    id:'spinning_blade', name:'重击', rarity:'COMMON', handler:'entry_heavy_hit', passive:true, maxLevel:9,
    tags:['physical',TAGS.NORMAL_ATTACK,TAGS.HEAVY_HIT,TAGS.MELEE,TAGS.BUILD_STRENGTH], cooldownMs:999999,
    targetType:'passive', color:0xffbb66, short:'重',
    description:'每数次普通攻击触发一次重击，造成更高伤害和击退。',
    levels:nineLevels([
      [5,1.55,0],[5,1.7,0],[4,1.8,0.01],[4,1.95,0.01],[4,2.1,0.02],[3,2.2,0.03],[3,2.35,0.04],[3,2.5,0.05],[2,2.65,0.07]
    ],([heavyHitEvery,heavyHitMultiplier,heavyHitLifeSteal],level)=>({ heavyHitEvery,heavyHitMultiplier,heavyHitLifeSteal,desc:level===1?'每5次普通攻击触发一次重击。':`每${heavyHitEvery}次攻击触发${Math.round(heavyHitMultiplier*100)}%伤害重击。` }),{
      3:'每4次攻击触发重击，并获得1%重击吸血',
      6:'每3次攻击触发重击，并获得3%重击吸血',
      9:'每2次攻击触发重击，并获得7%重击吸血'
    })
  },
  healing: {
    id:'healing', name:'铁壁', rarity:'COMMON', handler:'entry_iron_wall', passive:true, maxLevel:9,
    tags:[TAGS.SHIELD,TAGS.BUILD_DEFENSE], cooldownMs:999999,
    targetType:'passive', color:0x8aa0b8, short:'壁',
    description:'永久提高防御，并在高等级获得少量伤害减免。',
    levels:nineLevels([
      [2,0],[3,0],[5,0],[7,0.02],[9,0.03],[12,0.04],[15,0.05],[18,0.06],[22,0.08]
    ],([defense,damageReduction],level)=>({ defense,damageReduction,desc:level===1?'永久获得2点防御。':`获得${defense}点防御${damageReduction?`和${Math.round(damageReduction*100)}%减伤`:''}。` }),{
      3:'防御提高至5点',
      6:'防御提高至12点，并获得4%伤害减免',
      9:'防御提高至22点，并获得8%伤害减免'
    })
  },
  shadow_fist: {
    id:'shadow_fist', name:'身法', rarity:'COMMON', handler:'entry_movement', passive:true, maxLevel:9,
    tags:['shadow',TAGS.BUILD_AFTERIMAGE], cooldownMs:999999,
    targetType:'passive', color:0x7766ff, short:'身',
    description:'提高闪避率；成功闪避是后续残影技能的核心入口。',
    levels:nineLevels([
      0.05,0.07,0.10,0.12,0.14,0.17,0.19,0.22,0.25
    ],(dodgeChance,level)=>({ dodgeChance,desc:`获得${Math.round(dodgeChance*100)}%闪避率。` }),{
      3:'闪避率提高至10%',
      6:'闪避率提高至17%',
      9:'闪避率提高至25%'
    })
  }
};

export function configureEntryArchetypeSkills(){
  const keep=new Set(Object.keys(configs));
  Object.keys(SKILLS).forEach(id=>{ if(!keep.has(id)) delete SKILLS[id]; });
  Object.entries(configs).forEach(([id,config])=>{ SKILLS[id]={...config}; });
}

function passiveUpdater(system, key, apply){
  const updater=()=>apply(system.getData(key),system.getLevel(key));
  system.passiveUpdaters.push(updater);
  updater();
  return ()=>{};
}

export const EntryFireballSkill={
  cast(system,cfg,data,level,ctx){
    const s=system.scene;
    const target=s.targeting.nearestAhead(760);
    if(!target) return;
    ctx.originalTarget=target;
    system.projectile(s.player.x,s.player.y-60,target.x,target.y-45,cfg.color);
    system.hit(target,system.damageValue(data.damage,ctx),cfg,level,ctx,system.baseDamageValue(data.damage,ctx));
    s.statusEffects.add(StatusEffects.BURN,target,{ durationMs:data.burnMs,intervalMs:data.burnIntervalMs,value:data.burnDamage,stacks:data.burnStacks,maxStacks:data.maxStacks,sourceId:'entry_fireball',damageMultiplier:ctx.damageMultiplier,baseDamageMultiplierWithoutProfession:ctx.baseDamageMultiplierWithoutProfession,professionMultiplier:ctx.professionMultiplier,professionApplied:true });
  }
};

export const EntryPoisonNeedleSkill={
  cast(system,cfg,data,level,ctx){
    const s=system.scene;
    const targets=s.targeting.all().filter(e=>e.x>=s.player.x-30).sort((a,b)=>a.x-b.x).slice(0,data.pierce);
    ctx.originalTargets=targets;
    ctx.originalTarget=targets[0]||null;
    targets.forEach((target,index)=>{
      system.projectile(s.player.x,s.player.y-55-index*5,target.x,target.y-45,0x60e878);
      system.hit(target,system.damageValue(data.damage,ctx),cfg,level,ctx,system.baseDamageValue(data.damage,ctx));
      s.statusEffects.add(StatusEffects.POISON,target,{ durationMs:data.poisonMs,intervalMs:data.poisonIntervalMs,value:data.poisonDamage,stacks:data.poisonStacks,maxStacks:data.maxStacks,sourceId:'entry_poison_needle',damageMultiplier:ctx.damageMultiplier,baseDamageMultiplierWithoutProfession:ctx.baseDamageMultiplierWithoutProfession,professionMultiplier:ctx.professionMultiplier,professionApplied:true });
    });
  }
};

export const EntrySwordSkill={
  bind(system){
    const state={ readyAt:0, appliedLevel:0 };
    return passiveUpdater(system,'sword_wave',(data,level)=>{
      const s=system.scene;
      if(!data||level<=0){ s.flyingSwords?.getAll().filter(x=>x.ownerSkillId==='sword_wave').forEach(x=>s.flyingSwords.removeSword(x.id,'skillRemoved')); return; }
      const owned=s.flyingSwords?.getAll().filter(x=>x.ownerSkillId==='sword_wave')||[];
      while(owned.length<data.swords){ owned.push(s.flyingSwords.createSword({ownerSkillId:'sword_wave',type:'imperial',damageScale:1,color:0xb8f7ff})); }
      while(owned.length>data.swords){ const sword=owned.pop(); s.flyingSwords.removeSword(sword.id,'countReduced'); }
      const now=s.getGameplayTime();
      owned.forEach(sword=>{
        if(sword.attackEndsAt&&now>=sword.attackEndsAt){
          const target=sword.target;
          if(s.targeting.valid(target)) s.combatSystem.damageEnemy(target,data.damage,{source:'skill',skillId:'sword_wave',tags:SKILLS.sword_wave.tags,allowLifeSteal:false});
          sword.attackEndsAt=0;
          s.flyingSwords.returnToOrbit(sword.id);
        }
      });
      if(now<state.readyAt||owned.some(x=>x.state==='attack')) return;
      const target=s.targeting.nearestAhead(760);
      if(!target) return;
      const sword=owned.find(x=>x.state==='orbit');
      if(!sword) return;
      s.flyingSwords.markAttack(sword.id,target,{skillId:'sword_wave'});
      sword.attackEndsAt=now+180;
      state.readyAt=now+data.attackIntervalMs;
    });
  }
};

export const EntryHeavyHitSkill={
  bind(system){
    let appliedLifeSteal=0;
    return passiveUpdater(system,'spinning_blade',(data,level)=>{
      const p=system.scene.playerData;
      p.heavyHitEvery=data?.heavyHitEvery||0;
      p.heavyHitMultiplier=data?.heavyHitMultiplier||1.8;
      p.heavyHitLifeSteal=Math.max(0,(p.heavyHitLifeSteal||0)-appliedLifeSteal);
      appliedLifeSteal=data?.heavyHitLifeSteal||0;
      p.heavyHitLifeSteal+=appliedLifeSteal;
      if(level<=0){ p.heavyHitCounter=0; p.nextAttackIsHeavy=false; }
    });
  }
};

export const EntryIronWallSkill={
  bind(system){
    let appliedDefense=0;
    let appliedReduction=0;
    return passiveUpdater(system,'healing',(data)=>{
      const p=system.scene.playerData;
      p.defense=Math.max(0,(p.defense||0)-appliedDefense);
      p.damageReduction=Math.max(0,(p.damageReduction||0)-appliedReduction);
      appliedDefense=data?.defense||0;
      appliedReduction=data?.damageReduction||0;
      p.defense+=appliedDefense;
      p.damageReduction=Math.min(0.8,p.damageReduction+appliedReduction);
    });
  }
};

export const EntryMovementSkill={
  bind(system){
    let appliedDodge=0;
    return passiveUpdater(system,'shadow_fist',(data)=>{
      const p=system.scene.playerData;
      p.dodgeChance=Math.max(0,(p.dodgeChance||0)-appliedDodge);
      appliedDodge=data?.dodgeChance||0;
      p.dodgeChance=Math.min(0.75,p.dodgeChance+appliedDodge);
    });
  }
};
