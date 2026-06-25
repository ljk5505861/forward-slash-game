import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';
import { CombatEvents } from '../../core/CombatEvents.js';
import { StatusEffects } from '../../systems/StatusEffectSystem.js';

const SOURCE='myriad_afterimage';
const SUPPORTED=new Set(['fireball','poison_cloud']);
const lv=(rows)=>rows.map(([maxCopyAfterimages,copyDamageRatio,echoDelayMs,shadowSwordDamageRatio,shadowSwordIntervalMultiplier,inheritHalfStatusStacks,allAfterimages],i)=>({
  maxCopyAfterimages,copyDamageRatio,echoDelayMs,shadowSwordDamageRatio,shadowSwordIntervalMultiplier,inheritHalfStatusStacks,allAfterimages,
  desc:`残影继承火球、毒针、重击与御剑术的部分能力，复制伤害${Math.round(copyDamageRatio*100)}%。`,
  ...({3:{milestoneText:'最多两个残影可以继承火球、毒针、重击与御剑术。'},6:{milestoneText:'最多三个残影参与继承，残影火球与毒针可继承更多异常层数。'},9:{milestoneText:'场上所有残影均可继承基础流派能力，继承效果提高至50%。'}}[i+1]||{})
}));

const CONFIG={ id:SOURCE, name:'万象残身', rarity:'MYTHIC', handler:SOURCE, passive:true, maxLevel:9, requiredSkillId:'instant_step', ultimateSkill:true,
  tags:['shadow','afterimage',TAGS.BUILD_AFTERIMAGE], cooldownMs:999999, targetType:'passive', color:0x9b7cff, short:'象',
  description:'残影继承火球、毒针、重击与御剑术的部分能力，强度取决于真实残影数量。',
  levels:lv([[1,0.25,240,0.25,1.35,false,false],[1,0.28,230,0.28,1.32,false,false],[2,0.30,220,0.30,1.30,false,false],[2,0.34,205,0.34,1.26,false,false],[2,0.37,190,0.37,1.22,false,false],[3,0.40,175,0.40,1.18,true,false],[3,0.43,165,0.43,1.15,true,false],[3,0.46,155,0.46,1.12,true,false],[Number.MAX_SAFE_INTEGER,0.50,140,0.50,1.08,true,true]])
};

export function configureAfterimageUltimateSkills(){ SKILLS[SOURCE]={...CONFIG}; }

const validAfterimages=s=>s.afterimages?.getAll?.().filter(a=>!a.expiresAt||s.getGameplayTime()<a.expiresAt)||[];
const participants=(s,data)=>validAfterimages(s).slice(0,data.allAfterimages?Number.MAX_SAFE_INTEGER:data.maxCopyAfterimages);
const hasSkill=(system,id)=>system.getLevel(id)>0;
const stacks=(data,original)=>data.inheritHalfStatusStacks?Math.max(1,Math.ceil((original||1)*0.5)):1;
const meta=(afterimage,skillId,castId)=>({ fromMyriadAfterimage:true, sourceAfterimageId:afterimage.id, originalSkillId:skillId, castId, noInstantStep:true, noSwordTrigger:true, noHeavenSplit:true, noDeathExplosion:true, noPoisonSpread:true });
const validRuntime=(system,afterimage,skillId)=>system.getData(SOURCE)&&hasSkill(system,skillId)&&system.scene.afterimages?.getById?.(afterimage.id)&&system.scene.playerData.hp>0;

function pulse(s,afterimage,color){ const v=afterimage.view; if(!v) return; s.tweens.add({ targets:v, alpha:0.5, duration:80, yoyo:true }); const flare=s.add.circle(v.x,v.y,22,color,0.18).setDepth(146); s.tweens.add({ targets:flare, alpha:0, scale:1.35, duration:180, onComplete:()=>flare.destroy() }); }
function nearestFrom(s,x){ return s.targeting.all().filter(e=>e.x>=x-30).sort((a,b)=>a.x-b.x)[0]||null; }
function schedule(state,s,delay,fn){ const timer=s.time.delayedCall(delay,fn); state.timers.add(timer); timer.once?.('complete',()=>state.timers.delete(timer)); return timer; }

function copyFireball(system,state,event,data){
  const s=system.scene, cfg=SKILLS.fireball, original=data.originalTarget;
  participants(s,data).forEach((afterimage,index)=>schedule(state,s,index*data.echoDelayMs,()=>{
    state.timers.forEach(t=>{ if(t.hasDispatched) state.timers.delete(t); });
    if(!validRuntime(system,afterimage,'fireball')) return;
    const target=s.targeting.valid(original)?original:nearestFrom(s,afterimage.view?.x??s.player.x);
    if(!target) return;
    const m=meta(afterimage,'fireball',event.ctx?.castId);
    const x=afterimage.view?.x??s.player.x, y=(afterimage.view?.y??s.player.y)-8;
    pulse(s,afterimage,0xff8a55);
    const obj=s.add.circle(x,y,7,0xff6b38,0.55).setStrokeStyle(2,0xffc7aa,0.45).setDepth(145);
    s.tweens.add({ targets:obj, x:target.x, y:target.y-45, duration:180, onComplete:()=>obj.destroy() });
    const dmg=Math.max(1,Math.round((event.data.damage||0)*data.copyDamageRatio));
    s.combatSystem.damageEnemy(target,dmg,{ source:'skill', skillId:SOURCE, damageKind:'myriadFireball', tags:[TAGS.FIRE,TAGS.PROJECTILE,TAGS.BUILD_AFTERIMAGE], allowLifeSteal:false, noKnockback:true, ...m });
    s.statusEffects.add(StatusEffects.BURN,target,{ durationMs:event.data.burnMs, intervalMs:event.data.burnIntervalMs, value:Math.max(1,Math.round((event.data.burnDamage||0)*data.copyDamageRatio)), stacks:stacks(data,event.data.burnStacks), maxStacks:event.data.maxStacks, sourceId:`myriad_afterimage_fireball_${afterimage.id}_${event.ctx?.castId}`, damageMultiplier:event.ctx?.damageMultiplier||1, baseDamageMultiplierWithoutProfession:event.ctx?.baseDamageMultiplierWithoutProfession||1, professionMultiplier:event.ctx?.professionMultiplier||1, professionApplied:true, ...m });
  }));
}

function copyPoison(system,state,event,data){
  const s=system.scene;
  participants(s,data).forEach((afterimage,index)=>schedule(state,s,index*data.echoDelayMs,()=>{
    if(!validRuntime(system,afterimage,'poison_cloud')) return;
    const x=afterimage.view?.x??s.player.x, y=(afterimage.view?.y??s.player.y)-4;
    const targets=s.targeting.all().filter(e=>e.x>=x-30).sort((a,b)=>a.x-b.x).slice(0,event.data.pierce);
    if(!targets.length) return;
    pulse(s,afterimage,0x60e878);
    targets.forEach((target,i)=>{
      const m=meta(afterimage,'poison_cloud',event.ctx?.castId);
      const obj=s.add.rectangle(x,y-i*5,34,5,0x60e878,0.55).setDepth(145);
      obj.rotation=Math.atan2(target.y-45-y,target.x-x);
      s.tweens.add({ targets:obj, x:target.x, y:target.y-45, duration:160, onComplete:()=>obj.destroy() });
      s.combatSystem.damageEnemy(target,Math.max(1,Math.round((event.data.damage||0)*data.copyDamageRatio)),{ source:'skill', skillId:SOURCE, damageKind:'myriadPoisonNeedle', tags:[TAGS.POISON,TAGS.DOT,TAGS.PROJECTILE,TAGS.BUILD_AFTERIMAGE], allowLifeSteal:false, noKnockback:true, ...m });
      s.statusEffects.add(StatusEffects.POISON,target,{ durationMs:event.data.poisonMs, intervalMs:event.data.poisonIntervalMs, value:Math.max(1,Math.round((event.data.poisonDamage||0)*data.copyDamageRatio)), stacks:stacks(data,event.data.poisonStacks), maxStacks:event.data.maxStacks, sourceId:`myriad_afterimage_poison_${afterimage.id}_${event.ctx?.castId}`, damageMultiplier:event.ctx?.damageMultiplier||1, baseDamageMultiplierWithoutProfession:event.ctx?.baseDamageMultiplierWithoutProfession||1, professionMultiplier:event.ctx?.professionMultiplier||1, professionApplied:true, ...m });
    });
  }));
}

function clearShadowSwords(system,state){ const s=system.scene; state.swords.forEach(id=>s.flyingSwords?.removeSword(id,'myriadCleared')); state.swords.clear(); }
function syncShadowSwords(system,state){
  const s=system.scene, data=system.getData(SOURCE), swordData=system.getData('sword_wave');
  if(!data||!swordData||!s.flyingSwords){ clearShadowSwords(system,state); return; }
  const live=new Set(validAfterimages(s).map(a=>a.id));
  [...state.swords.entries()].forEach(([aid,sid])=>{ if(!live.has(aid)||!s.flyingSwords.getById(sid)){ s.flyingSwords.removeSword(sid,'afterimageGone'); state.swords.delete(aid); } });
  validAfterimages(s).forEach(a=>{ if(state.swords.has(a.id)) return; const sword=s.flyingSwords.createSword({ ownerSkillId:SOURCE, type:'shadow', shadowSword:true, sourceAfterimageId:a.id, color:0x8f7cff, orbitRadius:42, orbitSpeed:1.4, inheritedTags:['shadow','afterimage',TAGS.BUILD_AFTERIMAGE] }); state.swords.set(a.id,sword.id); });
  const now=s.getGameplayTime();
  state.swords.forEach((sid,aid)=>{ const sword=s.flyingSwords.getById(sid), a=s.afterimages.getById(aid); if(!sword||!a) return; if(sword.attackEndsAt&&now>=sword.attackEndsAt){ if(s.targeting.valid(sword.target)) s.combatSystem.damageEnemy(sword.target,Math.max(1,Math.round(swordData.damage*data.shadowSwordDamageRatio)),{ source:'skill', skillId:SOURCE, damageKind:'myriadShadowSword', tags:['shadow',TAGS.PROJECTILE,TAGS.BUILD_AFTERIMAGE], allowLifeSteal:false, noKnockback:true, fromMyriadAfterimage:true, sourceAfterimageId:aid, originalSkillId:'sword_wave', noSwordTrigger:true, noInstantStep:true }); sword.attackEndsAt=0; s.flyingSwords.returnToOrbit(sid); }
    if(now<(sword.nextAttackAt||0)||sword.state==='attack') return; const target=nearestFrom(s,a.view?.x??s.player.x); if(!target) return; s.flyingSwords.markAttack(sid,target,{ skillId:SOURCE, tags:sword.inheritedTags, fromMyriadAfterimage:true, sourceAfterimageId:aid, originalSkillId:'sword_wave', noSwordTrigger:true }); sword.attackEndsAt=now+170; sword.nextAttackAt=now+Math.round(swordData.attackIntervalMs*data.shadowSwordIntervalMultiplier); });
}

export const MyriadAfterimageSkill={
  bind(system){
    const s=system.scene;
    const state={ timers:new Set(), swords:new Map(), seen:new Set() };
    const clearTimers=()=>{ state.timers.forEach(t=>t.remove?.(false)); state.timers.clear(); };
    const onCastDone=(event={})=>{
      if(event.fromMyriadAfterimage||event.ctx?.fromMyriadAfterimage||!SUPPORTED.has(event.skillId)||state.seen.has(`${event.skillId}:${event.ctx?.castId}`)) return;
      const data=system.getData(SOURCE); if(!data||!validAfterimages(s).length) return;
      state.seen.add(`${event.skillId}:${event.ctx?.castId}`); if(state.seen.size>80) state.seen.clear();
      if(event.skillId==='fireball') copyFireball(system,state,event,{...data,originalTarget:event.target});
      if(event.skillId==='poison_cloud') copyPoison(system,state,event,data);
    };
    const offCast=s.eventBus.on(CombatEvents.SKILL_CAST_COMPLETED,onCastDone);
    const offRemoved=s.eventBus.on(CombatEvents.AFTERIMAGE_REMOVED,({afterimage})=>{ const sid=state.swords.get(afterimage.id); if(sid) s.flyingSwords?.removeSword(sid,'afterimageRemoved'); state.swords.delete(afterimage.id); });
    const updater=()=>syncShadowSwords(system,state);
    system.passiveUpdaters.push(updater);
    return ()=>{ offCast?.(); offRemoved?.(); clearTimers(); clearShadowSwords(system,state); const i=system.passiveUpdaters.indexOf(updater); if(i>=0) system.passiveUpdaters.splice(i,1); };
  }
};
