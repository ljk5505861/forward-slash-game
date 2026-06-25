import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';
import { StatusEffects } from '../../systems/StatusEffectSystem.js';

const levels = (values, build, milestones={}) => values.map((value,index)=>({
  ...build(value,index+1),
  ...(milestones[index+1]?{milestoneText:milestones[index+1]}:{}),
}));

const FLAME_CORE_SKILLS = {
  flame_spray: {
    id:'flame_spray', name:'烈焰喷射', rarity:'RARE', handler:'flame_spray', maxLevel:9,
    coreSkill:true, requiredSkillId:'fireball',
    tags:[TAGS.FIRE,TAGS.DOT,TAGS.ACTIVE_SKILL,TAGS.BUILD_FIRE], cooldownMs:4200,
    targetType:'nearestAhead', color:0xff8a3d, short:'焰',
    description:'向前方持续喷射烈焰，快速为多个敌人补充燃烧层。',
    levels:levels([
      [3,8,1,4200,330],[3,10,1,4000,350],[4,10,1,3850,370],[4,12,1,3700,390],[5,12,1,3550,410],[5,14,2,3400,430],[6,14,2,3250,450],[6,16,2,3100,470],[7,18,2,2900,500]
    ],([ticks,burnDamage,burnStacks,cooldownMs,range])=>({ ticks,burnDamage,burnStacks,cooldownMs,range,intervalMs:180,burnMs:3600,burnIntervalMs:600,maxStacks:18,desc:`连续喷射${ticks}次，每次叠加${burnStacks}层燃烧。` }),{
      3:'喷射次数增加至4次',
      6:'每次喷射叠加2层燃烧',
      9:'喷射次数增加至7次，射程提高至500'
    })
  },
  burn_burst: {
    id:'burn_burst', name:'燃爆', rarity:'RARE', handler:'burn_burst', maxLevel:9,
    coreSkill:true, requiredSkillId:'fireball',
    tags:[TAGS.FIRE,TAGS.DOT,TAGS.ACTIVE_SKILL,TAGS.BUILD_FIRE], cooldownMs:5200,
    targetType:'nearestAhead', color:0xffc15a, short:'爆',
    description:'引爆燃烧层数最高的目标，按消耗层数造成范围伤害。',
    levels:levels([
      [5,18,85,5200],[5,20,88,5000],[6,20,92,4800],[6,22,96,4600],[7,22,100,4400],[7,24,105,4200],[8,24,110,4000],[8,26,115,3800],[9,28,125,3500]
    ],([consumeStacks,damagePerStack,radius,cooldownMs])=>({ consumeStacks,damagePerStack,radius,cooldownMs,desc:`最多消耗${consumeStacks}层燃烧，每层造成${damagePerStack}点范围伤害。` }),{
      3:'最多消耗6层燃烧，爆炸范围扩大',
      6:'最多消耗7层燃烧，爆炸范围扩大至105',
      9:'最多消耗9层燃烧，爆炸范围扩大至125'
    })
  }
};

export function configureFlameCoreSkills(){
  Object.entries(FLAME_CORE_SKILLS).forEach(([id,config])=>{ SKILLS[id]={...config}; });
}

export const FlameSpraySkill={
  cast(system,cfg,data,level,ctx){
    const s=system.scene;
    let count=0;
    const active={
      skillId:cfg.id,cfg,data,level,ctx,
      nextAt:s.getGameplayTime(),
      endAt:s.getGameplayTime()+data.ticks*data.intervalMs+50,
      tick:()=>{
        const targets=s.targeting.all().filter(e=>e.x>=s.player.x-20&&e.x-s.player.x<=data.range).sort((a,b)=>a.x-b.x).slice(0,3);
        if(!targets.length){ active.ended=true; return; }
        targets.forEach((target,index)=>{
          system.line(s.player.x+20,s.player.y-55-index*5,target.x,target.y-40,cfg.color);
          s.statusEffects.add(StatusEffects.BURN,target,{ durationMs:data.burnMs,intervalMs:data.burnIntervalMs,value:data.burnDamage,stacks:data.burnStacks,maxStacks:data.maxStacks,sourceId:'flame_spray',damageMultiplier:ctx.damageMultiplier,baseDamageMultiplierWithoutProfession:ctx.baseDamageMultiplierWithoutProfession,professionMultiplier:ctx.professionMultiplier,professionApplied:true });
        });
        count+=1;
        if(count>=data.ticks) active.ended=true;
      }
    };
    system.active.push(active);
  }
};

export const BurnBurstSkill={
  cast(system,cfg,data,level,ctx){
    const s=system.scene;
    const target=s.targeting.all().filter(e=>s.statusEffects.getStackCount(e,StatusEffects.BURN)>0).sort((a,b)=>s.statusEffects.getStackCount(b,StatusEffects.BURN)-s.statusEffects.getStackCount(a,StatusEffects.BURN))[0];
    if(!target) return;
    const available=s.statusEffects.getStackCount(target,StatusEffects.BURN);
    const consumed=s.statusEffects.consumeStacks(target,StatusEffects.BURN,Math.min(data.consumeStacks,available));
    if(consumed<=0) return;
    const rawDamage=consumed*data.damagePerStack;
    const damage=system.damageValue(rawDamage,ctx);
    system.ring(target.x,target.y,data.radius,cfg.color);
    s.targeting.all().filter(e=>Math.hypot(e.x-target.x,e.y-target.y)<=data.radius).forEach(e=>system.hit(e,damage,cfg,level,ctx,system.baseDamageValue(rawDamage,ctx)));
    s.floatText(target.x,target.y-105,`燃爆 ${consumed}层`,'#ffb05a');
  }
};
