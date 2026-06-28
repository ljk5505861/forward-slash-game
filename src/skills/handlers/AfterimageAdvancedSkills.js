import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';
import { CombatEvents } from '../../core/CombatEvents.js';
import { getWeapon } from '../../config/weapons.js';

const SOURCE_STEP='instant_step';
const sumBonuses=bonuses=>Object.values(bonuses||{}).reduce((sum,value)=>sum+(Number(value)||0),0);
const levels=(values,build,milestones={})=>values.map((value,index)=>({
  ...build(value,index+1),
  ...(milestones[index+1]?{milestoneText:milestones[index+1]}:{})
}));
const RATIOS=[0.60,0.68,0.76,0.84,0.92,1.00,1.08,1.18,1.30];
const COOLDOWNS=[7000,6700,6400,6100,5800,5400,5000,4600,4200];
const CONVERT_CAPS=[0.06,0.07,0.08,0.10,0.12,0.14,0.16,0.18,0.20];
const PHASE_DURATIONS=[150,160,170,180,190,200,215,230,250];

const AFTERIMAGE_ADVANCED_SKILLS={
  instant_step:{
    id:'instant_step',name:'瞬身',rarity:'EPIC',handler:'instant_step',passive:true,maxLevel:9,advancedSkill:true,
    tags:['shadow','movement','dodge','afterimage','physical',TAGS.BUILD_AFTERIMAGE],cooldownMs:999999,targetType:'passive',color:0xe8fbff,short:'瞬',
    description:'将额外攻速转换为闪避；真实闪避时按额外攻速生成1—3个强化残影攻击敌人。',
    levels:levels(RATIOS.map((damageRatio,i)=>[damageRatio,COOLDOWNS[i],CONVERT_CAPS[i],PHASE_DURATIONS[i]]),([damageRatio,cooldownMs,convertDodgeCap,phaseDurationMs],level)=>({
      damageRatio,cooldownMs,convertDodgeCap,phaseDurationMs,extraAttackSpeedPerDodge:0.10,dodgePerStep:0.01,minAfterimages:level>=3?2:1,maxAfterimages:3,
      cooldownReducePerAfterimageMs:level>=6?400:0,cooldownReduceCapMs:level>=6?1200:0,attacksPerAfterimage:level>=9?2:1,
      desc:`每10%额外攻速转1%闪避（上限${Math.round(convertDodgeCap*100)}%）；闪避时生成强化残影造成普攻${Math.round(damageRatio*100)}%伤害，冷却${(cooldownMs/1000).toFixed(1)}秒。`
    }),{
      3:'双重瞬影：每次瞬身至少生成2个强化残影',
      6:'无间瞬身：每个造成实际伤害的强化残影减少瞬身自身冷却0.4秒，单次最多1.2秒',
      9:'刹那万影：每个强化残影连续攻击2次，第二次造成同等伤害'
    })
  }
};

export function configureAfterimageAdvancedSkills(){ Object.entries(AFTERIMAGE_ADVANCED_SKILLS).forEach(([id,config])=>{ SKILLS[id]={...config}; }); }

function extraAttackSpeed(playerData){ return Math.max(0,(playerData.attackSpeedMultiplier||1)+sumBonuses(playerData.attackSpeedMultiplierBonuses)-1); }
function normalAttackRoll(scene,ratio){
  const weapon=getWeapon(scene.playerData.weaponId);
  const profile=scene.professionSystem?.currentAttackProfile?.()||null;
  if(scene.combatSystem?.calcAttackDamage&&weapon){
    const result=scene.combatSystem.calcAttackDamage(weapon,profile,false,true);
    return {
      amount:Math.max(1,Math.round(result.damage*ratio)),
      meta:{critResolved:true,crit:!!result.crit,professionApplied:true,professionMultiplier:result.professionMult||1,baseAmountBeforeProfession:Math.max(1,Math.round((result.baseBeforeProfession||result.damage)*ratio))}
    };
  }
  const base=(scene.playerData.attack||1)*(1+sumBonuses(scene.playerData.attackDamageBonuses)+sumBonuses(scene.playerData.normalAttackDamageBonuses));
  const critChance=Math.max(0,Math.min(0.95,(scene.playerData.critChance||0)+sumBonuses(scene.playerData.physicalCritChanceBonuses)));
  const crit=Math.random()<critChance;
  const critMultiplier=crit?((scene.playerData.critMultiplier||1.5)+sumBonuses(scene.playerData.physicalCritMultiplierBonuses)):1;
  return {amount:Math.max(1,Math.round(base*critMultiplier*ratio)),meta:{critResolved:true,crit,professionApplied:true,professionMultiplier:1,baseAmountBeforeProfession:Math.max(1,Math.round(base*critMultiplier*ratio))}};
}
function targetForStep(scene,x){
  if(scene.targeting.valid(scene.currentTarget)) return scene.currentTarget;
  return scene.targeting.all().filter(enemy=>scene.targeting.valid(enemy)).sort((a,b)=>Math.abs(a.x-x)-Math.abs(b.x-x))[0]||null;
}
function attackTarget(scene,x,y,data,afterimageIndex,hitIndex){
  const target=targetForStep(scene,x);
  if(!target||scene.playerData.hp<=0) return false;
  const targetX=target.x,targetY=target.y;
  const bonus=1+sumBonuses(scene.playerData.afterimageDamageBonuses);
  const roll=normalAttackRoll(scene,data.damageRatio*bonus);
  const damaged=scene.combatSystem.damageEnemy(target,roll.amount,{
    source:'skill',damageKind:'instantStepAfterimage',skillId:SOURCE_STEP,tags:['shadow','physical',TAGS.NORMAL_ATTACK,TAGS.BUILD_AFTERIMAGE],
    afterimage:true,allowLifeSteal:false,noKnockback:true,noInstantStep:true,noSwordTrigger:true,fromAfterimage:true,...roll.meta
  });
  const slash=scene.add.rectangle(x+16+hitIndex*10,y-52+afterimageIndex*8,54,7,0xe8fbff,0.62).setDepth(148); slash.rotation=-0.35;
  scene.tweens.add({targets:slash,x:targetX,y:targetY-45,alpha:0,duration:140,onComplete:()=>slash.destroy()});
  return !!damaged;
}

export const InstantStepSkill={
  bind(system){
    const scene=system.scene;
    let readyAt=0,phaseTimer=null,restorePhase=null;
    const visuals=new Set(),timers=new Set();
    const clearConversion=()=>{ Reflect.deleteProperty(scene.playerData.dodgeChanceBonuses||{},SOURCE_STEP); };
    const applyConversion=()=>{
      const data=system.getData(SOURCE_STEP);
      clearConversion();
      if(!data) return;
      scene.playerData.dodgeChanceBonuses??={};
      const converted=Math.floor((extraAttackSpeed(scene.playerData)+1e-9)/data.extraAttackSpeedPerDodge)*data.dodgePerStep;
      const applied=Math.min(data.convertDodgeCap,converted);
      if(applied>0) scene.playerData.dodgeChanceBonuses[SOURCE_STEP]=applied;
    };
    const schedule=(delay,fn)=>{
      let timer=null;
      timer=scene.time.delayedCall(delay,()=>{ timers.delete(timer); fn(); });
      timers.add(timer);
      return timer;
    };
    const restorePlayer=()=>{
      phaseTimer?.remove?.(false); phaseTimer=null;
      restorePhase?.(); restorePhase=null;
    };
    const beginPhase=data=>{
      restorePlayer();
      const player=scene.player;
      if(!player) return;
      const alpha=player.alpha??1,scaleX=player.scaleX??1,scaleY=player.scaleY??1;
      restorePhase=()=>{ if(!player?.active) return; player.setAlpha?.(alpha); player.setScale?.(scaleX,scaleY); };
      player.setAlpha?.(Math.min(alpha,0.35));
      player.setScale?.(scaleX*0.96,scaleY*0.96);
      phaseTimer=scene.time.delayedCall(data.phaseDurationMs,()=>{ phaseTimer=null; restorePhase?.(); restorePhase=null; });
    };
    const off=scene.eventBus.on(CombatEvents.PLAYER_DODGED,payload=>{
      const data=system.getData(SOURCE_STEP);
      if(!data||payload?.noInstantStep||scene.playerData.hp<=0) return;
      const now=scene.getGameplayTime();
      if(now<readyAt) return;
      const extra=extraAttackSpeed(scene.playerData);
      const count=system.getLevel(SOURCE_STEP)>=3?(extra>=1?3:2):(extra>=1?3:extra>=0.5?2:1);
      readyAt=now+data.cooldownMs;
      beginPhase(data);
      const triggerState={remainingReduction:data.cooldownReduceCapMs||0,reducedGhosts:new Set()};
      const originX=scene.player.x,originY=scene.player.y;
      scene.floatText?.(originX,originY-130,'瞬身','#e8fbff');
      for(let i=0;i<count;i+=1){
        const ghostX=originX-22-i*18,ghostY=originY-52+i*8;
        const ghost=scene.add.rectangle(ghostX,ghostY,34,76,0xe8fbff,0.24).setStrokeStyle(2,0xb7f7ff,0.42).setDepth(96);
        visuals.add(ghost);
        for(let hitIndex=0;hitIndex<data.attacksPerAfterimage;hitIndex+=1){
          schedule(i*90+hitIndex*120,()=>{
            if(!system.getData(SOURCE_STEP)||scene.playerData.hp<=0) return;
            const damaged=attackTarget(scene,ghostX,originY,data,i,hitIndex);
            if(damaged&&!triggerState.reducedGhosts.has(i)&&triggerState.remainingReduction>0){
              triggerState.reducedGhosts.add(i);
              const reduction=Math.min(data.cooldownReducePerAfterimageMs||0,triggerState.remainingReduction);
              triggerState.remainingReduction-=reduction;
              readyAt=Math.max(scene.getGameplayTime(),readyAt-reduction);
            }
          });
        }
        scene.tweens.add({targets:ghost,alpha:0,x:ghostX-20,duration:280,onComplete:()=>{ visuals.delete(ghost); ghost.destroy(); }});
      }
    });
    system.passiveUpdaters.push(applyConversion);
    applyConversion();
    return ()=>{
      off?.();
      clearConversion();
      restorePlayer();
      timers.forEach(timer=>timer.remove?.(false)); timers.clear();
      visuals.forEach(visual=>visual.destroy?.()); visuals.clear();
      system.passiveUpdaters=system.passiveUpdaters.filter(fn=>fn!==applyConversion);
      readyAt=0;
    };
  }
};
