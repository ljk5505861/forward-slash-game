import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';
import { CombatEvents, RunStates } from '../../core/CombatEvents.js';

const SOURCE='myriad_afterimage';
const copyRatios=[0.15,0.18,0.21,0.24,0.27,0.30,0.34,0.38,0.45];
const lv=()=>copyRatios.map((copyDamageRatio,i)=>({
  copyDamageRatio,
  maxCopyAfterimages:i>=8?Number.MAX_SAFE_INTEGER:(i>=5?3:(i>=2?2:1)),
  echoDelayMs:i>=8?120:(i>=5?150:190),
  doubleEcho:i>=8,
  copyStatus:i>=5,
  desc:`首次获得时选择一个合格的神话以下技能并锁定；万象残身升级时可重选。残影复制强度${Math.round(copyDamageRatio*100)}%。`,
  ...({3:{milestoneText:'可复制残影数提高至2个。'},6:{milestoneText:'可复制残影数提高至3个，并继承可复制技能的关键异常/标签。'},9:{milestoneText:'所有残影参与复制，复制比例提高至45%，每个残影复制两次。'}}[i+1]||{})
}));

const CONFIG={ id:SOURCE, name:'万象残身', rarity:'MYTHIC', handler:SOURCE, passive:true, maxLevel:9, ultimateSkill:true,
  tags:['shadow','afterimage',TAGS.BUILD_AFTERIMAGE], cooldownMs:999999, targetType:'passive', color:0x9b7cff, short:'象',
  description:'玩家选择并锁定一个合格的神话以下技能；只有万象残身升级时才能重新选择，残影按锁定技能进行复制。',
  levels:lv()
};

export function configureAfterimageUltimateSkills(){ SKILLS[SOURCE]={...CONFIG}; }

const validAfterimages=s=>s.afterimages?.getAll?.().filter(a=>!a.expiresAt||s.getGameplayTime()<a.expiresAt)||[];
const participants=(s,data)=>validAfterimages(s).slice(0,data.maxCopyAfterimages);
const sumBonuses = bonuses => Object.values(bonuses||{}).reduce((sum,value)=>sum+(Number(value)||0),0);
const selectedId=s=>s.playerData?.myriadAfterimageSkillId||null;
const isAfterimageMaker=id=>['phantom_step','instant_step','myriad_afterimage'].includes(id);
const isPureAttribute=skill=>skill?.passive && !skill?.handler && !(skill.tags||[]).some(t=>[TAGS.ACTIVE_SKILL,TAGS.NORMAL_ATTACK,TAGS.SUMMON,TAGS.DOT,TAGS.SHIELD].includes(t));
const isEligibleSkill=skill=>!!skill && skill.id!==SOURCE && skill.rarity!=='MYTHIC' && !skill.ultimateSkill && !isAfterimageMaker(skill.id) && !isPureAttribute(skill);
function eligibleOwned(system){ return (system.scene.playerData.skills||[]).map(s=>SKILLS[s.id]).filter(isEligibleSkill); }
function nearestFrom(s,x){ return s.targeting.all().filter(e=>e.x>=x-30).sort((a,b)=>Math.abs(a.x-x)-Math.abs(b.x-x))[0]||null; }
function schedule(state,s,delay,fn){ const timer=s.time.delayedCall(delay,fn); state.timers.add(timer); timer.once?.('complete',()=>state.timers.delete(timer)); return timer; }
function pulse(s,afterimage,color=0x9b7cff){ const v=afterimage.view; if(!v) return; s.tweens.add({ targets:v, alpha:0.52, duration:80, yoyo:true }); const flare=s.add.circle(v.x,v.y,22,color,0.18).setDepth(146); s.tweens.add({ targets:flare, alpha:0, scale:1.35, duration:180, onComplete:()=>flare.destroy() }); }

function openSelection(system,reason='obtain'){
  const s=system.scene, options=eligibleOwned(system).map(skill=>({ type:'myriadCopySkill', id:`myriad_${skill.id}`, title:`锁定复制：${skill.name}`, skillId:skill.id, nextLevel:system.getLevel(skill.id)||1 }));
  if(!options.length){ s.playerData.myriadAfterimageSkillId=null; return false; }
  const wasPaused=s.isGameplayPaused?.();
  s.beginGameplayPause?.();
  s.runState=RunStates.UPGRADING;
  s.upgradePanel?.show?.({ title:reason==='upgrade'?'万象残身升级：重新选择复制技能':'万象残身：选择复制技能', options, onConfirm:o=>{ s.playerData.myriadAfterimageSkillId=o.skillId; s.floatText?.(s.player.x,s.player.y-132,`万象锁定：${SKILLS[o.skillId]?.name||o.skillId}`,'#d8b4fe'); s.upgradePanel?.hide?.(); if(!wasPaused) s.resumeModalFlow?.(); return true; } });
  return true;
}

function copyDamageToTarget(system,state,{sourceSkillId,target,amount,tags=[],kind='myriadCopy'},data){
  const s=system.scene;
  const count=data.doubleEcho?2:1;
  participants(s,data).forEach((afterimage,index)=>{
    for(let h=0;h<count;h+=1) schedule(state,s,index*data.echoDelayMs+h*110,()=>{
      if(!system.getData(SOURCE)||!s.afterimages?.getById?.(afterimage.id)) return;
      const liveTarget=s.targeting.valid(target)?target:nearestFrom(s,afterimage.view?.x??s.player.x);
      if(!liveTarget) return;
      pulse(s,afterimage);
      const final=Math.max(1,Math.round((amount||s.playerData.attack||1)*data.copyDamageRatio*(1+sumBonuses(s.playerData.afterimageDamageBonuses))));
      s.combatSystem.damageEnemy(liveTarget,final,{ source:'skill', skillId:SOURCE, damageKind:kind, originalSkillId:sourceSkillId, tags:[...new Set([...tags,'shadow',TAGS.BUILD_AFTERIMAGE])], afterimage:true, allowLifeSteal:false, noKnockback:true, fromMyriadAfterimage:true, noInstantStep:true, noSwordTrigger:true });
    });
  });
}

export const MyriadAfterimageSkill={
  bind(system){
    const s=system.scene;
    const state={ timers:new Set(), seen:new Set() };
    const clearTimers=()=>{ state.timers.forEach(t=>t.remove?.(false)); state.timers.clear(); };
    const maybeSelect=payload=>{ if(payload?.skillId!==SOURCE) return; s.time?.delayedCall?.(0,()=>openSelection(system,payload.level>1?'upgrade':'obtain')); };
    const offUpgrade=s.eventBus.on(CombatEvents.UPGRADE_CHOSEN,maybeSelect);
    const onCastDone=(event={})=>{
      const locked=selectedId(s), data=system.getData(SOURCE);
      if(!data||!locked||event.skillId!==locked||event.fromMyriadAfterimage||event.ctx?.fromMyriadAfterimage||state.seen.has(`${event.skillId}:${event.ctx?.castId}`)||!validAfterimages(s).length) return;
      state.seen.add(`${event.skillId}:${event.ctx?.castId}`); if(state.seen.size>80) state.seen.clear();
      const target=event.target||event.targets?.[0]||nearestFrom(s,s.player.x);
      const base=event.data?.damage||event.data?.burstDamage||event.data?.zoneDamage||event.data?.heal||s.playerData.attack||1;
      copyDamageToTarget(system,state,{sourceSkillId:event.skillId,target,amount:base,tags:event.skill?.tags||[],kind:'myriadSkillCopy'},data);
    };
    const offCast=s.eventBus.on(CombatEvents.SKILL_CAST_COMPLETED,onCastDone);
    const offHit=s.eventBus.on(CombatEvents.PLAYER_HIT,event=>{ const locked=selectedId(s), data=system.getData(SOURCE); if(!data||!locked||event.afterimage||event.fromMyriadAfterimage||!validAfterimages(s).length) return; if(locked==='shadow_fist'||locked==='giant_force'||event.tags?.includes(locked)){ copyDamageToTarget(system,state,{sourceSkillId:locked,target:event.enemy,amount:event.damage,tags:event.tags||[],kind:'myriadHitCopy'},data); } });
    const offSword=s.eventBus.on(CombatEvents.SWORD_ATTACKED,event=>{ const data=system.getData(SOURCE); if(!data||selectedId(s)!=='sword_wave'||event.fromMyriadAfterimage||!validAfterimages(s).length) return; copyDamageToTarget(system,state,{sourceSkillId:'sword_wave',target:event.target,amount:system.getData('sword_wave')?.damage||s.playerData.attack,tags:['physical',TAGS.PROJECTILE],kind:'myriadSwordCopy'},data); });
    return ()=>{ offUpgrade?.(); offCast?.(); offHit?.(); offSword?.(); clearTimers(); };
  },
  eligibleSkills(system){ return eligibleOwned(system).map(s=>s.id); },
  openSelection
};
