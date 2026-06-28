import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';
import { CombatEvents } from '../../core/CombatEvents.js';

const SOURCE_STEP='instant_step';
const sumBonuses = bonuses => Object.values(bonuses||{}).reduce((sum,value)=>sum+(Number(value)||0),0);
const levels=(values,build,milestones={})=>values.map((value,index)=>({
  ...build(value,index+1),
  ...(milestones[index+1]?{ milestoneText:milestones[index+1] }:{})
}));
const ratios=[0.60,0.68,0.76,0.84,0.92,1.00,1.10,1.20,1.30];
const cooldowns=[7600,7300,7000,6700,6400,6100,5800,5500,5200];
const convertCaps=[0.04,0.05,0.06,0.07,0.08,0.10,0.12,0.15,0.18];

const AFTERIMAGE_ADVANCED_SKILLS={
  instant_step:{
    id:'instant_step', name:'瞬身', rarity:'EPIC', handler:'instant_step', passive:true, maxLevel:9,
    advancedSkill:true,
    tags:['shadow','movement','dodge','afterimage','physical',TAGS.BUILD_AFTERIMAGE], cooldownMs:999999,
    targetType:'passive', color:0xe8fbff, short:'瞬',
    description:'将额外攻速转换为闪避；真实闪避时按额外攻速生成1—3个强化残影攻击敌人。',
    levels:levels(ratios.map((damageRatio,i)=>[damageRatio,cooldowns[i],convertCaps[i]]),([damageRatio,cooldownMs,convertDodgeCap],level)=>({ damageRatio,cooldownMs,convertDodgeCap,extraAttackSpeedPerDodge:0.10,dodgePerStep:0.01,minAfterimages:level>=3?2:1,maxAfterimages:3,cooldownReducePerAfterimageMs:level>=6?400:0,cooldownReduceCapMs:level>=6?1200:0,attacksPerAfterimage:level>=9?2:1,desc:`每10%额外攻速转1%闪避（上限${Math.round(convertDodgeCap*100)}%）；闪避时生成强化残影造成普攻${Math.round(damageRatio*100)}%伤害，冷却${(cooldownMs/1000).toFixed(1)}秒。` }),{
      3:'最低生成2个强化残影',
      6:'每个强化残影减少瞬身自身冷却0.4秒，单次最多1.2秒',
      9:'每个强化残影攻击两次，伤害提高至普攻130%'
    })
  }
};

export function configureAfterimageAdvancedSkills(){ Object.entries(AFTERIMAGE_ADVANCED_SKILLS).forEach(([id,config])=>{ SKILLS[id]={...config}; }); }

function extraAttackSpeed(p){ return Math.max(0,(p.attackSpeedMultiplier||1)+sumBonuses(p.attackSpeedMultiplierBonuses)-1); }
function attackTarget(s,x,y,data,afterimageIndex,hitIndex){
  const target=s.targeting.all().filter(e=>e.x>=x-45).sort((a,b)=>Math.abs(a.x-x)-Math.abs(b.x-x))[0]||null;
  if(!target) return false;
  const base=(s.playerData.attack||1)*(1+sumBonuses(s.playerData.attackDamageBonuses)+sumBonuses(s.playerData.normalAttackDamageBonuses));
  const amount=Math.max(1,Math.round(base*data.damageRatio*(1+sumBonuses(s.playerData.afterimageDamageBonuses))));
  const damaged=s.combatSystem.damageEnemy(target,amount,{ source:'skill', damageKind:'instantStepAfterimage', skillId:SOURCE_STEP, tags:['shadow','physical',TAGS.NORMAL_ATTACK,TAGS.BUILD_AFTERIMAGE], afterimage:true, allowLifeSteal:false, noKnockback:true, noInstantStep:true });
  const slash=s.add.rectangle(x+16+hitIndex*10,y-52+afterimageIndex*8,54,7,0xe8fbff,0.62).setDepth(148); slash.rotation=-0.35;
  s.tweens.add({targets:slash,x:target.x,alpha:0,duration:140,onComplete:()=>slash.destroy()});
  return damaged;
}

export const InstantStepSkill={
  bind(system){
    const s=system.scene;
    let readyAt=0, appliedDodge=0;
    const visuals=new Set();
    const clearDodge=()=>{ if(s.playerData.dodgeChanceBonuses) delete s.playerData.dodgeChanceBonuses[SOURCE_STEP]; appliedDodge=0; };
    const applyConversion=()=>{ const data=system.getData(SOURCE_STEP); clearDodge(); if(!data) return; s.playerData.dodgeChanceBonuses??={}; appliedDodge=Math.min(data.convertDodgeCap,Math.floor(extraAttackSpeed(s.playerData)/data.extraAttackSpeedPerDodge)*data.dodgePerStep); if(appliedDodge>0) s.playerData.dodgeChanceBonuses[SOURCE_STEP]=appliedDodge; };
    const off=s.eventBus.on(CombatEvents.PLAYER_DODGED,payload=>{
      const data=system.getData(SOURCE_STEP); if(!data||payload?.noInstantStep) return;
      const now=s.getGameplayTime(); if(now<readyAt) return;
      const count=Math.max(data.minAfterimages,Math.min(data.maxAfterimages,1+Math.floor(extraAttackSpeed(s.playerData)/0.50)));
      const reduction=Math.min(data.cooldownReduceCapMs||0,count*(data.cooldownReducePerAfterimageMs||0));
      readyAt=now+Math.max(300,data.cooldownMs-reduction);
      const ox=s.player.x, oy=s.player.y;
      s.floatText?.(ox,oy-130,'瞬身','#e8fbff');
      for(let i=0;i<count;i+=1){
        const ghost=s.add.rectangle(ox-22-i*18,oy-52+i*8,34,76,0xe8fbff,0.24).setStrokeStyle(2,0xb7f7ff,0.42).setDepth(96); visuals.add(ghost);
        for(let h=0;h<data.attacksPerAfterimage;h+=1){ s.time.delayedCall(i*90+h*120,()=>{ if(!system.getData(SOURCE_STEP)) return; attackTarget(s,ghost.x||ox,ghost.y?ghost.y+52:oy,data,i,h); }); }
        s.tweens.add({targets:ghost,alpha:0,x:ox-42-i*22,duration:280,onComplete:()=>{ visuals.delete(ghost); ghost.destroy(); }});
      }
    });
    const updater=()=>applyConversion();
    system.passiveUpdaters.push(updater); applyConversion();
    return ()=>{ off?.(); clearDodge(); visuals.forEach(v=>v.destroy?.()); visuals.clear(); system.passiveUpdaters=system.passiveUpdaters.filter(fn=>fn!==updater); readyAt=0; };
  }
};
