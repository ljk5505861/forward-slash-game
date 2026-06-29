import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';
import { CombatEvents, RunStates } from '../../core/CombatEvents.js';
import { StatusEffects } from '../../systems/StatusEffectSystem.js';
import { SPIRIT_WOLVES_ID, inheritRatioForLevel } from './SpiritWolvesSkill.js';

const PhaserRef=globalThis.Phaser||{};
const SHUTDOWN_EVENT=PhaserRef.Scenes?.Events?.SHUTDOWN||'shutdown';
const SOURCE='myriad_afterimage';
const NORMAL_ATTACK_ID='normal_attack';
const COPY_RATIOS=[0.15,0.18,0.21,0.24,0.27,0.30,0.34,0.38,0.45];
const ECHO_DELAYS=[240,230,220,205,190,175,165,155,140];
const COPY_ADAPTERS=Object.freeze({
  [NORMAL_ATTACK_ID]:'normalAttack',
  fireball:'active',fire_seed:'active',burn_burst:'active',poison_cloud:'active',poison_chain:'active',spirit_wolves:'active',spinning_blade:'attackResolved',
  traceless:'heal',bloodthirst:'heal',guardian_shield:'shield',thorn_armor:'damage',sword_wave:'damage',sword_sheath:'damage',sword_tomb:'damage',parasitic_gu:'damage'
});
const levels=()=>COPY_RATIOS.map((copyRatio,index)=>({
  copyRatio,echoDelayMs:ECHO_DELAYS[index],copyFullShape:index>=2,refreshAfterimages:index>=5,extraHalfEcho:index>=8,
  desc:`获得1个常驻本命残影，并选择普通攻击或一个合格技能供全部残影复制；单个残影效果为${Math.round(copyRatio*100)}%。`,
  ...({3:{milestoneText:'万法留影：复制保留范围、穿透、连锁、异常状态及技能固有效果。'},6:{milestoneText:'影随法动：复制开始时刷新全部幻影步残影至完整6秒。'},9:{milestoneText:'万象齐鸣：整轮结束后，第一名仍有效残影额外复制一次，效果为正常复制的50%。'}}[index+1]||{})
}));
const CONFIG={
  id:SOURCE,name:'万象残身',rarity:'MYTHIC',handler:SOURCE,passive:true,maxLevel:9,ultimateSkill:true,
  tags:['shadow','afterimage',TAGS.BUILD_AFTERIMAGE],cooldownMs:999999,targetType:'passive',color:0x9b7cff,short:'象',
  description:'获得1个常驻本命残影；选择普通攻击或一个已拥有的合格技能供本命残影与幻影步残影复制。只有万象残身升级时才能重新选择。',levels:levels()
};

export function configureAfterimageUltimateSkills(){ SKILLS[SOURCE]={...CONFIG}; }

export const MYRIAD_AFTERIMAGE_SKILL_ID=SOURCE;
export const MYRIAD_NORMAL_ATTACK_ID=NORMAL_ATTACK_ID;
export const selectedId=scene=>scene.playerData?.myriadAfterimageSkillId||NORMAL_ATTACK_ID;
export const selectedName=id=>id===NORMAL_ATTACK_ID?'普通攻击':(SKILLS[id]?.name||id);
export const isEligibleMyriadCopySkill=skill=>!!skill&&!!COPY_ADAPTERS[skill.id]&&skill.rarity!=='MYTHIC'&&!skill.ultimateSkill;
export function eligibleOwned(system){ return (system.scene.playerData.skills||[]).map(item=>SKILLS[item.id]).filter(isEligibleMyriadCopySkill); }
const clampChangeCount=value=>Math.max(0,Math.min(1,Math.floor(Number(value)||0)));
function hasMyriad(system){ return system.getLevel?.(SOURCE)>0; }
function restoreChoiceState(system){
  if(!hasMyriad(system)) return;
  const scene=system.scene;
  scene.playerData.myriadAfterimageSkillId??=NORMAL_ATTACK_ID;
  scene.playerData.myriadAfterimageChangeCount=clampChangeCount(scene.playerData.myriadAfterimageChangeCount);
}
function initializeFirstObtain(system){
  const scene=system.scene;
  scene.playerData.myriadAfterimageSkillId=NORMAL_ATTACK_ID;
  scene.playerData.myriadAfterimageChangeCount=eligibleOwned(system).length>0?1:0;
}
function grantUpgradeChange(system){ if(hasMyriad(system)) system.scene.playerData.myriadAfterimageChangeCount=1; }
export function getMyriadAfterimageDetailState(scene){ return { skillId:selectedId(scene), skillName:selectedName(selectedId(scene)), changeCount:clampChangeCount(scene?.playerData?.myriadAfterimageChangeCount) }; }
function livePersistentAfterimages(scene){
  const now=scene.getGameplayTime();
  return (scene.afterimages?.getAll?.()||[])
    .filter(afterimage=>(afterimage.ownerSkillId===SOURCE||afterimage.ownerSkillId==='phantom_step')&&(!afterimage.expiresAt||afterimage.expiresAt>now))
    .sort((left,right)=>(left.ownerSkillId===SOURCE?-1:0)-(right.ownerSkillId===SOURCE?-1:0)||(left.createdAt||0)-(right.createdAt||0));
}
function ensureInnateAfterimage(system,state){
  const scene=system.scene;
  if(!system.getData(SOURCE)||!scene.afterimages) return null;
  const existing=scene.afterimages.getAll().find(afterimage=>afterimage.ownerSkillId===SOURCE);
  if(existing){ state.innateAfterimageId=existing.id; return existing; }
  const afterimage=scene.afterimages.createAfterimage({ownerSkillId:SOURCE,durationMs:0,attackRatio:0,attackSpeedBonus:0,color:0xc8b5ff});
  state.innateAfterimageId=afterimage.id;
  return afterimage;
}
function nearestFrom(scene,x){ if(scene.targeting.valid(scene.currentTarget)) return scene.currentTarget; return scene.targeting.all().filter(enemy=>scene.targeting.valid(enemy)).sort((a,b)=>Math.abs(a.x-x)-Math.abs(b.x-x))[0]||null; }
function schedule(state,scene,delay,fn){ let timer=null; timer=scene.time.delayedCall(Math.max(0,delay),()=>{ state.timers.delete(timer); fn(); }); state.timers.add(timer); return timer; }
function pulse(scene,afterimage,color=0x9b7cff){ const view=afterimage.view; if(!view) return; scene.tweens.add({targets:view,alpha:0.5,duration:80,yoyo:true}); const flare=scene.add.circle(view.x,view.y,22,color,0.18).setDepth(146); scene.tweens.add({targets:flare,alpha:0,scale:1.35,duration:180,onComplete:()=>flare.destroy()}); }
function activeDamage(system,raw,ctx,scale){ const amount=system.damageValue?system.damageValue(raw,ctx):raw; const base=system.baseDamageValue?system.baseDamageValue(raw,ctx):raw; return {amount:Math.max(1,Math.round(amount*scale)),base:Math.max(1,Math.round(base*scale)),professionMultiplier:ctx?.professionMultiplier||1}; }
function dealActiveDamage(system,target,raw,ctx,scale,skillId,tags,kind='myriadActiveCopy',extra={}){
  const scene=system.scene; if(!scene.targeting.valid(target)) return false; const values=activeDamage(system,raw,ctx,scale);
  return !!scene.combatSystem.damageEnemy(target,values.amount,{source:'skill',skillId:SOURCE,originalSkillId:skillId,damageKind:kind,tags:[...new Set([...(tags||[]),'shadow',TAGS.BUILD_AFTERIMAGE])],afterimage:true,allowLifeSteal:false,noKnockback:true,fromMyriadAfterimage:true,noInstantStep:true,noSwordTrigger:true,noHeavenSplit:true,noDeathExplosion:true,noPoisonSpread:true,professionApplied:true,professionMultiplier:values.professionMultiplier,baseAmountBeforeProfession:values.base,...extra});
}
function dealEventDamage(system,target,event,scale,skillId,kind='myriadTriggeredCopy',extra={}){
  const scene=system.scene; if(!scene.targeting.valid(target)) return false; const professionMultiplier=event.professionMultiplier||1; const base=Math.max(1,Number(event.baseAmountBeforeProfession)||Number(event.damage)||1); const amount=Math.max(1,Math.round(base*professionMultiplier*scale));
  return !!scene.combatSystem.damageEnemy(target,amount,{source:'skill',skillId:SOURCE,originalSkillId:skillId,damageKind:kind,tags:[...new Set([...(event.tags||[]),'shadow',TAGS.BUILD_AFTERIMAGE])],afterimage:true,allowLifeSteal:false,noKnockback:true,fromMyriadAfterimage:true,noInstantStep:true,noSwordTrigger:true,noHeavenSplit:true,noDeathExplosion:true,noPoisonSpread:true,professionApplied:true,professionMultiplier,baseAmountBeforeProfession:Math.max(1,Math.round(base*scale)),critResolved:!!event.critResolved||event.crit!==undefined,crit:!!event.crit,...extra});
}
function addBurn(system,target,data,ctx,scale,sourceId){
  if(!system.scene.targeting.valid(target)||!data?.burnDamage) return null;
  return system.scene.statusEffects?.add?.(StatusEffects.BURN,target,{durationMs:data.burnMs||3200,intervalMs:data.burnIntervalMs||600,value:Math.max(1,Math.round(data.burnDamage*scale)),stacks:Math.max(1,data.burnStacks||1),maxStacks:data.maxStacks||5,sourceId,damageMultiplier:ctx?.damageMultiplier||1,baseDamageMultiplierWithoutProfession:ctx?.baseDamageMultiplierWithoutProfession||1,professionMultiplier:ctx?.professionMultiplier||1,professionApplied:true,tags:[TAGS.MAGIC,TAGS.SPELL,TAGS.FIRE,TAGS.DOT],fromMyriadAfterimage:true});
}
function addPoison(system,target,data,ctx,scale,sourceId,stacks=data?.poisonStacks||1){
  if(!system.scene.targeting.valid(target)||!data?.poisonDamage) return null;
  return system.scene.statusEffects?.add?.(StatusEffects.POISON,target,{durationMs:data.poisonMs||4200,intervalMs:data.poisonIntervalMs||700,value:Math.max(1,Math.round(data.poisonDamage*scale)),stacks:Math.max(1,stacks),maxStacks:data.maxStacks||15,sourceId,damageMultiplier:ctx?.damageMultiplier||1,baseDamageMultiplierWithoutProfession:ctx?.baseDamageMultiplierWithoutProfession||1,professionMultiplier:ctx?.professionMultiplier||1,professionApplied:true,poisonMeta:{nonNormal:true,sourceSkillId:SOURCE},fromMyriadAfterimage:true});
}
function copyFireball(system,state,afterimage,trigger,scale,full){
  const scene=system.scene,data=trigger.data||{},ctx=trigger.ctx||{},originX=afterimage.view?.x??scene.player.x; const count=full?Math.max(1,data.shots||1):1; const pool=scene.targeting.all().filter(enemy=>scene.targeting.valid(enemy)).sort((a,b)=>Math.abs(a.x-originX)-Math.abs(b.x-originX)); const targets=[];
  for(let i=0;i<count;i+=1){ const target=pool.find(enemy=>!targets.includes(enemy))||pool[0]; if(target) targets.push(target); }
  targets.forEach((target,index)=>{ const x=afterimage.view?.x??scene.player.x,y=(afterimage.view?.y??scene.player.y)-8,targetX=target.x,targetY=target.y; const projectile=scene.add.circle(x,y,7,0xff6b38,0.55).setStrokeStyle(2,0xffc7aa,0.45).setDepth(145); scene.tweens.add({targets:projectile,x:targetX,y:targetY-45,duration:180+index*30,onComplete:()=>projectile.destroy()}); dealActiveDamage(system,target,data.damage||0,ctx,scale,'fireball',trigger.tags,'myriadFireball'); if(!full) return; addBurn(system,target,data,ctx,scale,`myriad_fireball_${afterimage.id}_${trigger.castId}_${index}`); if((data.radius||0)>0){ scene.targeting.all().filter(enemy=>enemy!==target&&scene.targeting.valid(enemy)&&Math.hypot(enemy.x-targetX,enemy.y-targetY)<=data.radius).forEach(enemy=>{ dealActiveDamage(system,enemy,(data.damage||0)*(data.explosionScale||0.45),ctx,scale,'fireball',[...(trigger.tags||[]),'area'],'myriadFireballExplosion'); addBurn(system,enemy,data,ctx,scale,`myriad_fireball_burst_${afterimage.id}_${trigger.castId}_${index}`); }); } });
}
function copyPoisonNeedle(system,state,afterimage,trigger,scale,full){
  const scene=system.scene,data=trigger.data||{},ctx=trigger.ctx||{},originX=afterimage.view?.x??scene.player.x; const maxHits=full?Math.max(1,Math.min(scene.targeting.all().length,data.maxHits||data.pierce||3)):1; const targets=scene.targeting.all().filter(enemy=>scene.targeting.valid(enemy)&&enemy.x>=originX-20).sort((a,b)=>a.x-b.x).slice(0,maxHits);
  targets.forEach((target,index)=>{ dealActiveDamage(system,target,data.damage||0,ctx,scale,'poison_cloud',trigger.tags,'myriadPoisonNeedle'); if(full) addPoison(system,target,data,ctx,scale,`myriad_poison_${afterimage.id}_${trigger.castId}_${index}`); });
}
function copyFireSeed(system,state,afterimage,trigger,scale,full){
  const scene=system.scene,data=trigger.data||{},ctx=trigger.ctx||{},originX=afterimage.view?.x??scene.player.x; const pool=scene.targeting.all().filter(enemy=>scene.targeting.valid(enemy)).sort((a,b)=>Math.abs(a.x-originX)-Math.abs(b.x-originX)); const first=pool[0]; if(!first) return; dealActiveDamage(system,first,data.damage||0,ctx,scale,'fire_seed',trigger.tags,'myriadFireSeed'); if(!full) return; addBurn(system,first,data,ctx,scale,`myriad_fire_seed_${afterimage.id}_${trigger.castId}_0`); const extra=Math.min(Math.max(0,data.splitCount||0),Math.max(0,(data.maxSeedsPerCast||1)-1)); for(let i=0;i<extra;i+=1){ const target=pool[i+1]||first; dealActiveDamage(system,target,data.splitDamage||data.damage||0,ctx,scale,'fire_seed',trigger.tags,'myriadFireSeedSplit'); addBurn(system,target,data,ctx,scale,`myriad_fire_seed_${afterimage.id}_${trigger.castId}_${i+1}`); }
}
function copyBurnBurst(system,state,afterimage,trigger,scale,full){
  const scene=system.scene,data=trigger.data||{},ctx=trigger.ctx||{},originX=afterimage.view?.x??scene.player.x; const target=scene.targeting.valid(trigger.target)?trigger.target:nearestFrom(scene,originX); if(!target) return; const center={x:target.x,y:target.y}; if(!full){ dealActiveDamage(system,target,data.zoneDamage||data.burstDamage||0,ctx,scale,'burn_burst',trigger.tags,'myriadBurnBurst'); return; } const zone=scene.add.circle(center.x,center.y,data.radius||80,0xff5a24,0.12).setStrokeStyle(3,0xffb15a,0.55).setDepth(119); scene.tweens.add({targets:zone,alpha:0.03,duration:data.durationMs||1000,onComplete:()=>zone.destroy()}); const endAt=scene.getGameplayTime()+(data.durationMs||1000); let tickIndex=0; const tick=()=>{ if(!system.getData(SOURCE)||scene.playerData.hp<=0) return; scene.targeting.all().filter(enemy=>scene.targeting.valid(enemy)&&Math.hypot(enemy.x-center.x,enemy.y-center.y)<=(data.radius||80)).forEach(enemy=>{ dealActiveDamage(system,enemy,data.zoneDamage||0,ctx,scale,'burn_burst',[...(trigger.tags||[]),'area'],'myriadBurnZone'); addBurn(system,enemy,data,ctx,scale,`myriad_burn_zone_${afterimage.id}_${trigger.castId}_${tickIndex}`); }); tickIndex+=1; if(scene.getGameplayTime()+(data.intervalMs||650)<=endAt) schedule(state,scene,data.intervalMs||650,tick); }; tick();
}
function copyPoisonChain(system,state,afterimage,trigger,scale,full){
  const scene=system.scene,data=trigger.data||{},ctx=trigger.ctx||{},originX=afterimage.view?.x??scene.player.x; const target=scene.targeting.valid(trigger.target)?trigger.target:nearestFrom(scene,originX); if(!target) return; dealActiveDamage(system,target,data.damage||0,ctx,scale,'poison_chain',trigger.tags,'myriadPoisonChain'); if(!full) return; addPoison(system,target,{...data,poisonDamage:system.getData('poison_cloud')?.poisonDamage||1,poisonMs:2600,poisonIntervalMs:700,maxStacks:15},ctx,scale,`myriad_poison_chain_${afterimage.id}_${trigger.castId}`,1); if(!target.isBoss){ const until=scene.getGameplayTime()+(data.prisonMs||2000); target.poisonChainPrisonUntil=Math.max(target.poisonChainPrisonUntil||0,until); target.nextAttackAt=Math.max(target.nextAttackAt||0,until); target.body?.setVelocityX?.(0); schedule(state,scene,data.prisonMs||2000,()=>{ if(target.poisonChainPrisonUntil<=scene.getGameplayTime()) target.poisonChainPrisonUntil=0; }); } const chained=scene.targeting.all().filter(enemy=>enemy!==target&&scene.targeting.valid(enemy)&&Math.hypot(enemy.x-target.x,enemy.y-target.y)<=(data.extendRadius||180)).sort((a,b)=>Math.hypot(a.x-target.x,a.y-target.y)-Math.hypot(b.x-target.x,b.y-target.y))[0]; if(chained){ dealActiveDamage(system,chained,(data.damage||0)*0.5,ctx,scale,'poison_chain',trigger.tags,'myriadPoisonChainLink'); addPoison(system,chained,{...data,poisonDamage:system.getData('poison_cloud')?.poisonDamage||1,poisonMs:2600,poisonIntervalMs:700,maxStacks:15},ctx,scale,`myriad_poison_chain_link_${afterimage.id}_${trigger.castId}`,1); }
}
const wolfShadowMeta=(amount,kind)=>({ source:'skill',skillId:SOURCE,originalSkillId:SPIRIT_WOLVES_ID,damageKind:kind,tags:[TAGS.SUMMON,'shadow',TAGS.BUILD_AFTERIMAGE,TAGS.MELEE],fromMyriadAfterimage:true,afterimage:true,canTriggerArtifacts:false,allowLifeSteal:false,noKnockback:true,critResolved:true,crit:false,professionApplied:true,professionMultiplier:1,baseAmountBeforeProfession:Math.max(1,Math.round(amount)) });
function clearWolfShadow(state,shadow){ if(!shadow||shadow.destroyed) return; shadow.destroyed=true; if(shadow.timer){ state.timers?.delete?.(shadow.timer); shadow.timer.remove?.(false); shadow.timer=null; } if(shadow.tween){ shadow.tween.remove?.(); shadow.tween=null; } state.wolfShadows?.delete?.(shadow); shadow.view?.destroy?.(); shadow.view=null; }
function copySpiritWolves(system,state,afterimage,trigger,scale,full){
  const scene=system.scene,level=system.getLevel(SPIRIT_WOLVES_ID)||trigger.level||1,origin={x:afterimage.view?.x??scene.player.x,y:afterimage.view?.y??scene.player.y};
  const attack=Math.max(1,Math.round((scene.playerData.baseAttack||scene.playerData.attack||1)*inheritRatioForLevel(level))), amount=Math.max(1,Math.round(attack*scale));
  const target=scene.targeting.all().filter(enemy=>scene.targeting.valid(enemy)&&enemy.x>=origin.x-20).sort((a,b)=>Math.hypot(a.x-origin.x,a.y-origin.y)-Math.hypot(b.x-origin.x,b.y-origin.y))[0]||null;
  const view=scene.add?.circle?.(origin.x,origin.y,18,0xffffff,.34)?.setStrokeStyle?.(3,0x9fd7ff,.55)?.setDepth?.(147);
  const shadow={view,destroyed:false,timer:null,tween:null}; state.wolfShadows.add(shadow);
  const finish=()=>clearWolfShadow(state,shadow);
  if(!target){ shadow.tween=scene.tweens?.add?.({targets:view,x:origin.x+180,alpha:0,duration:260,onComplete:finish}); shadow.timer=schedule(state,scene,300,finish); return true; }
  const hit=()=>{
    if(shadow.destroyed) return;
    if(scene.targeting.valid(target)){
      scene.combatSystem.damageEnemy(target,amount,wolfShadowMeta(amount,'myriadSpiritWolfBite'));
      if(full&&level>=3){ const splash=Math.max(1,Math.round(amount*.35)); scene.targeting.all().filter(enemy=>enemy!==target&&scene.targeting.valid(enemy)&&Math.hypot(enemy.x-target.x,enemy.y-target.y)<=90).forEach(enemy=>scene.combatSystem.damageEnemy(enemy,splash,wolfShadowMeta(splash,'myriadSpiritWolfSplash'))); }
      if(full&&level>=6){ const burst=Math.max(1,Math.round(attack*.8*scale)); scene.targeting.all().filter(enemy=>scene.targeting.valid(enemy)&&Math.hypot(enemy.x-target.x,enemy.y-target.y)<=120).forEach(enemy=>scene.combatSystem.damageEnemy(enemy,burst,wolfShadowMeta(burst,'myriadSpiritWolfBurst'))); }
    }
    finish();
  };
  shadow.tween=scene.tweens?.add?.({targets:view,x:target.x,y:target.y,duration:180,onComplete:hit});
  shadow.timer=schedule(state,scene,220,hit);
  return true;
}
function copyActive(system,state,afterimage,trigger,scale,full){ if(trigger.skillId==='fireball') return copyFireball(system,state,afterimage,trigger,scale,full); if(trigger.skillId==='poison_cloud') return copyPoisonNeedle(system,state,afterimage,trigger,scale,full); if(trigger.skillId==='fire_seed') return copyFireSeed(system,state,afterimage,trigger,scale,full); if(trigger.skillId==='burn_burst') return copyBurnBurst(system,state,afterimage,trigger,scale,full); if(trigger.skillId==='poison_chain') return copyPoisonChain(system,state,afterimage,trigger,scale,full); if(trigger.skillId===SPIRIT_WOLVES_ID) return copySpiritWolves(system,state,afterimage,trigger,scale,full); }
function copyNormalAttack(system,state,afterimage,trigger,scale){
  const scene=system.scene,event=trigger.event||{},originX=afterimage.view?.x??scene.player.x;
  const target=scene.targeting.valid(event.enemy)?event.enemy:nearestFrom(scene,originX);
  if(!target) return false;
  const physical=event.profile?.type!=='arcaneBolt';
  let amount=Math.max(1,Math.round((event.baseDamage||scene.playerData.attack||1)*scale));
  let meta={canCrit:true,professionApplied:false};
  if(event.weapon&&scene.combatSystem?.calcAttackDamage){
    const result=scene.combatSystem.calcAttackDamage(event.weapon,event.profile||null,!!event.heavy,physical);
    amount=Math.max(1,Math.round(result.damage*scale));
    meta={critResolved:true,crit:!!result.crit,professionApplied:true,professionMultiplier:result.professionMult||1,baseAmountBeforeProfession:Math.max(1,Math.round((result.baseBeforeProfession||result.damage)*scale))};
  }
  const damaged=scene.combatSystem.damageEnemy(target,amount,{source:'skill',skillId:SOURCE,originalSkillId:NORMAL_ATTACK_ID,damageKind:'myriadNormalAttack',tags:[TAGS.NORMAL_ATTACK,physical?'physical':'arcane','shadow',TAGS.BUILD_AFTERIMAGE],afterimage:true,allowLifeSteal:false,canTriggerArtifacts:false,noKnockback:true,fromMyriadAfterimage:true,noInstantStep:true,noSwordTrigger:true,noHeavenSplit:true,noDeathExplosion:true,noPoisonSpread:true,...meta});
  const x=afterimage.view?.x??scene.player.x,y=afterimage.view?.y??scene.player.y-52,targetX=target.x,targetY=target.y;
  const slash=scene.add.rectangle(x+18,y,48,6,physical?0xd8ccff:0x9ee8ff,0.62).setDepth(148); slash.rotation=-0.35;
  scene.tweens.add({targets:slash,x:targetX,y:targetY-45,alpha:0,duration:150,onComplete:()=>slash.destroy()});
  return !!damaged;
}
function copySpinningBlade(system,state,afterimage,trigger,scale,full){
  const scene=system.scene,data=system.getData('spinning_blade'); if(!data) return; const origin={x:afterimage.view?.x??scene.player.x,y:(afterimage.view?.y??scene.player.y)-4}; const base=trigger.event.baseDamage||scene.playerData.attack||1; const targets=scene.targeting.all().filter(enemy=>scene.targeting.valid(enemy)&&enemy.x>=origin.x&&enemy.x-origin.x<=data.range&&Math.abs(enemy.y-origin.y)<=data.width/2).sort((a,b)=>a.x-b.x); const hits=full?targets:targets.slice(0,1); hits.forEach(target=>dealEventDamage(system,target,{...trigger.event,baseAmountBeforeProfession:base,professionMultiplier:1,tags:['physical',TAGS.NORMAL_ATTACK,TAGS.BUILD_STRENGTH]},data.ratio*scale,'spinning_blade','myriadShockwave')); if(full&&data.explosionRatio&&hits[0]){ const center={x:hits[0].x,y:hits[0].y}; scene.targeting.all().filter(enemy=>scene.targeting.valid(enemy)&&Math.hypot(enemy.x-center.x,enemy.y-center.y)<=data.explosionRadius).forEach(target=>dealEventDamage(system,target,{...trigger.event,baseAmountBeforeProfession:base,professionMultiplier:1,tags:['physical','area',TAGS.BUILD_STRENGTH]},data.explosionRatio*scale,'spinning_blade','myriadShockwaveExplosion')); }
}
function copyTriggeredDamage(system,state,afterimage,trigger,scale,full){
  const scene=system.scene,originX=afterimage.view?.x??scene.player.x; const target=scene.targeting.valid(trigger.target)?trigger.target:nearestFrom(scene,originX); if(!target) return; const thornData=trigger.skillId==='thorn_armor'?system.getData('thorn_armor'):null; dealEventDamage(system,target,trigger.event,scale,trigger.skillId,`myriad_${trigger.skillId}`,thornData?{defenseIgnore:thornData.defenseIgnore||0}:{}); if(full&&trigger.skillId==='thorn_armor'&&(thornData?.burstRadius||0)>0){ const center={x:target.x,y:target.y}; scene.targeting.all().filter(enemy=>enemy!==target&&scene.targeting.valid(enemy)&&Math.hypot(enemy.x-center.x,enemy.y-center.y)<=thornData.burstRadius).forEach(enemy=>dealEventDamage(system,enemy,trigger.event,scale*(thornData.burstRatio||0.6),'thorn_armor','myriadThornBurst',{defenseIgnore:thornData.defenseIgnore||0})); }
}
function copyHeal(system,state,afterimage,trigger,scale){ const scene=system.scene; const configured=trigger.skillId==='traceless'?system.getData('traceless')?.dodgeHeal:0; const base=configured||trigger.event.amount||0; const amount=Math.max(1,Math.round(base*scale)); const healed=scene.healPlayer?.(amount,SOURCE,{skillId:SOURCE,originalSkillId:trigger.skillId,fromMyriadAfterimage:true})||0; if(healed>0) scene.floatText?.(afterimage.view?.x??scene.player.x,(afterimage.view?.y??scene.player.y)-70,`残影 +${healed}`,'#d8b4fe'); }
function copyShield(system,state,afterimage,trigger,scale){ const scene=system.scene,effect=trigger.event.effect||{}; const amount=Math.max(1,Math.round((trigger.event.amount||effect.initialValue||0)*scale)); scene.statusEffects?.add?.(StatusEffects.SHIELD,scene.playerData,{durationMs:effect.durationMs||1,persistent:!!effect.persistent||effect.expiresNaturally===false,expiresNaturally:effect.expiresNaturally!==false,value:amount,remainingValue:amount,sourceId:`myriad_afterimage_guardian_${afterimage.id}_${scene.getGameplayTime()}`,fromMyriadAfterimage:true}); }
function executeCopy(system,state,afterimage,trigger,scale,full){
  const adapter=COPY_ADAPTERS[trigger.skillId];
  pulse(system.scene,afterimage,trigger.skillId==='traceless'||trigger.skillId==='bloodthirst'?0xd8b4fe:trigger.skillId==='guardian_shield'?0x8fd7ff:0x9b7cff);
  if(adapter==='normalAttack') return copyNormalAttack(system,state,afterimage,trigger,scale);
  if(adapter==='active') return copyActive(system,state,afterimage,trigger,scale,full);
  if(adapter==='attackResolved') return copySpinningBlade(system,state,afterimage,trigger,scale,full);
  if(adapter==='heal') return copyHeal(system,state,afterimage,trigger,scale);
  if(adapter==='shield') return copyShield(system,state,afterimage,trigger,scale);
  if(adapter==='damage') return copyTriggeredDamage(system,state,afterimage,trigger,scale,full);
}
function dispatchEcho(system,state,trigger){
  const scene=system.scene,data=system.getData(SOURCE);
  if(!data||selectedId(scene)!==trigger.skillId||scene.playerData.hp<=0) return 0;
  ensureInnateAfterimage(system,state);
  const participants=livePersistentAfterimages(scene);
  if(!participants.length) return 0;
  if(data.refreshAfterimages){ const expiresAt=scene.getGameplayTime()+6000; participants.filter(afterimage=>afterimage.ownerSkillId==='phantom_step').forEach(afterimage=>{ afterimage.expiresAt=expiresAt; }); }
  participants.forEach((afterimage,index)=>schedule(state,scene,index*data.echoDelayMs,()=>{ if(!system.getData(SOURCE)||selectedId(scene)!==trigger.skillId||scene.playerData.hp<=0||!scene.afterimages?.getById?.(afterimage.id)) return; executeCopy(system,state,afterimage,trigger,data.copyRatio,data.copyFullShape); }));
  if(data.extraHalfEcho){ schedule(state,scene,participants.length*data.echoDelayMs+80,()=>{ if(!system.getData(SOURCE)||selectedId(scene)!==trigger.skillId||scene.playerData.hp<=0) return; const first=participants.find(afterimage=>scene.afterimages?.getById?.(afterimage.id)); if(first) executeCopy(system,state,first,trigger,data.copyRatio*0.5,data.copyFullShape); }); }
  return participants.length;
}
export function selectionOptions(system){
  const scene=system.scene,current=selectedId(scene);
  const normal={type:'myriadCopySkill',id:'myriad_normal_attack',title:`普通攻击${current===NORMAL_ATTACK_ID?'（当前）':''}\n玩家普通攻击命中后，本命残影与幻影步残影依次补击。`,skillId:NORMAL_ATTACK_ID,nextLevel:1};
  return [normal,...eligibleOwned(system).map(skill=>({type:'myriadCopySkill',id:`myriad_${skill.id}`,title:`${skill.name}${current===skill.id?'（当前）':''}`,skillId:skill.id,nextLevel:system.getLevel(skill.id)||1}))];
}
function openSelection(system,reason='detail',onChanged=null,onCancel=onChanged){
  const scene=system.scene,options=selectionOptions(system);
  if(!hasMyriad(system)||clampChangeCount(scene.playerData.myriadAfterimageChangeCount)<=0) return false;
  scene.beginGameplayPause?.(); scene.runState=RunStates.UPGRADING;
  scene.upgradePanel?.show?.({title:'万象残身：更换复制技能',options,mode:'card',cancelText:'取消 / 返回技能详情',onCancel:()=>{ scene.resumeModalFlow?.(); onCancel?.(); },onConfirm:option=>{
    const current=selectedId(scene);
    if(!option?.skillId||option.skillId===current) return false;
    if(!hasMyriad(system)||clampChangeCount(scene.playerData.myriadAfterimageChangeCount)<=0) return false;
    scene.playerData.myriadAfterimageSkillId=option.skillId;
    scene.playerData.myriadAfterimageChangeCount=0;
    scene.floatText?.(scene.player.x,scene.player.y-132,`万象锁定：${selectedName(option.skillId)}`,'#d8b4fe');
    scene.resumeModalFlow?.();
    onChanged?.();
    return true;
  }});
  return true;
}

export function openMyriadAfterimageSelection(scene,onChanged=null,onCancel=onChanged){
  const system=scene?.skillSystem;
  if(!system?.getData?.(SOURCE)) return false;
  return openSelection(system,'detail',onChanged,onCancel);
}


export const MyriadAfterimageSkill={
  bind(system){
    const scene=system.scene,state={timers:new Set(),seen:new Set(),wolfShadows:new Set(),innateAfterimageId:null};
    system.passiveState.myriadAfterimage=state;
    let cleaned=false;
    restoreChoiceState(system);
    const clearTimers=()=>{ state.timers.forEach(timer=>timer.remove?.(false)); state.timers.clear(); };
    const clearWolfShadows=()=>{ [...state.wolfShadows].forEach(shadow=>clearWolfShadow(state,shadow)); state.wolfShadows.clear(); };
    const ensureInnate=()=>ensureInnateAfterimage(system,state);
    system.passiveUpdaters.push(ensureInnate);
    ensureInnate();
    const offUpgrade=scene.eventBus.on(CombatEvents.UPGRADE_CHOSEN,payload=>{ if(payload?.skillId!==SOURCE) return; if((payload.level||1)>1) grantUpgradeChange(system); else initializeFirstObtain(system); });
    const offStarting=scene.eventBus.on(CombatEvents.STARTING_SKILL_CHOSEN,payload=>{ if(payload?.skillId===SOURCE) initializeFirstObtain(system); });
    const offCast=scene.eventBus.on(CombatEvents.SKILL_CAST_COMPLETED,event=>{ const skillId=event?.skillId,adapter=COPY_ADAPTERS[skillId],key=`active:${skillId}:${event?.ctx?.castId}`; if(adapter!=='active'||event?.fromMyriadAfterimage||event?.ctx?.fromMyriadAfterimage||state.seen.has(key)) return; state.seen.add(key); if(state.seen.size>120) state.seen.clear(); dispatchEcho(system,state,{skillId,data:event.data||system.getData(skillId),ctx:event.ctx||{},target:event.target,targets:event.targets||[],tags:event.skill?.tags||SKILLS[skillId]?.tags||[],castId:event.ctx?.castId||scene.getGameplayTime(),event}); });
    const offAttackResolved=scene.eventBus.on(CombatEvents.PLAYER_ATTACK_RESOLVED,event=>{
      if(event?.fromMyriadAfterimage) return;
      const choice=selectedId(scene);
      if(choice===NORMAL_ATTACK_ID){ dispatchEcho(system,state,{skillId:NORMAL_ATTACK_ID,event:event||{},target:event?.enemy,tags:[TAGS.NORMAL_ATTACK],castId:scene.getGameplayTime()}); return; }
      if(choice==='spinning_blade'&&system.getData('spinning_blade')) dispatchEcho(system,state,{skillId:'spinning_blade',event:event||{},target:event?.enemy,tags:SKILLS.spinning_blade?.tags||[],castId:scene.getGameplayTime()});
    });
    const offEnemyHit=scene.eventBus.on(CombatEvents.ENEMY_HIT,event=>{ const skillId=event?.skillId,adapter=COPY_ADAPTERS[skillId]; if(adapter!=='damage'||event?.fromMyriadAfterimage||event?.afterimage||!event?.enemy) return; if(skillId==='thorn_armor'&&event.damageKind==='thornBurst') return; dispatchEcho(system,state,{skillId,event,target:event.enemy,tags:event.tags||SKILLS[skillId]?.tags||[],castId:scene.getGameplayTime()}); });
    const offHealed=scene.eventBus.on(CombatEvents.PLAYER_HEALED,event=>{ const skillId=event?.skillId||event?.source; if(COPY_ADAPTERS[skillId]!=='heal'||event?.fromMyriadAfterimage) return; dispatchEcho(system,state,{skillId,event,target:null,tags:SKILLS[skillId]?.tags||[],castId:scene.getGameplayTime()}); });
    const offShield=scene.eventBus.on(CombatEvents.SHIELD_GAINED,event=>{ if(!String(event?.sourceId||'').startsWith('guardian_shield')||event?.effect?.fromMyriadAfterimage) return; dispatchEcho(system,state,{skillId:'guardian_shield',event,target:null,tags:SKILLS.guardian_shield?.tags||[],castId:scene.getGameplayTime()}); });
    const cleanup=()=>{
      if(cleaned) return;
      cleaned=true;
      offUpgrade?.(); offStarting?.(); offCast?.(); offAttackResolved?.(); offEnemyHit?.(); offHealed?.(); offShield?.();
      scene.events?.off?.(SHUTDOWN_EVENT,onShutdown);
      clearTimers(); clearWolfShadows(); state.seen.clear();
      system.passiveUpdaters=system.passiveUpdaters.filter(fn=>fn!==ensureInnate);
      scene.afterimages?.getAll?.().filter(afterimage=>afterimage.ownerSkillId===SOURCE).forEach(afterimage=>scene.afterimages.removeAfterimage(afterimage.id,'skillRemoved'));
      Reflect.deleteProperty(scene.playerData,'myriadAfterimageSkillId');
      Reflect.deleteProperty(scene.playerData,'myriadAfterimageChangeCount');
      if(system.passiveState.myriadAfterimage===state) Reflect.deleteProperty(system.passiveState,'myriadAfterimage');
    };
    const onShutdown=()=>cleanup();
    scene.events?.once?.(SHUTDOWN_EVENT,onShutdown);
    return cleanup;
  },
  eligibleSkills(system){ return [NORMAL_ATTACK_ID,...eligibleOwned(system).map(skill=>skill.id)]; },
  openSelection,
  copyAdapters:COPY_ADAPTERS
};
