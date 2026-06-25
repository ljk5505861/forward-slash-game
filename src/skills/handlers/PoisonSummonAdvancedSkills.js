import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';
import { CombatEvents } from '../../core/CombatEvents.js';
import { StatusEffects } from '../../systems/StatusEffectSystem.js';

const SOURCE_POISON_CHAIN='poison_chain';
const SOURCE_POISON_KING='poison_king';
const MIN_INSECT_INTERVAL_MS=650;
const MAX_SINGLE_EXTEND_MS=1800;
const MAX_EFFECT_REMAINING_MS=12000;
const MIN_INFECTION_SCORE=45;
const CHAIN_REBUILD_MS=800;
const BERSERK_MS=4000;

const levels=(values,build,milestones={})=>values.map((value,index)=>({ ...build(value,index+1), ...(milestones[index+1]?{milestoneText:milestones[index+1]}:{}) }));
const removeUpdater=(system,updater)=>{ const index=system.passiveUpdaters.indexOf(updater); if(index>=0) system.passiveUpdaters.splice(index,1); };
const sumBonuses=bonuses=>Object.values(bonuses||{}).reduce((sum,value)=>sum+(Number(value)||0),0);
const ensureRuntime=p=>{
  p.parasiticGuAbsorbBonuses??={}; p.parasiticGuGrowthCapBonuses??={}; p.parasiticGuDamageBonuses??={};
  p.poisonInsectDamageBonuses??={}; p.poisonInsectAttackSpeedBonuses??={}; p.poisonInsectExtendBonuses??={};
};
const dist=(a,b)=>Math.hypot((a?.x||0)-(b?.x||0),(a?.y||0)-(b?.y||0));
const destroyVisual=o=>{ if(!o) return; o.destroy?.(); };
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const poisonNeedleData=system=>system.getData('poison_cloud')||{poisonDamage:3,poisonMs:3200,poisonIntervalMs:700,maxStacks:15};
const isBoss=e=>!!(e?.isBoss||e?.isMidBoss||e?.isFinalBoss);

function ensurePoisonRuntime(scene){
  if(scene.poisonSummonRuntime) return scene.poisonSummonRuntime;
  const runtime={
    parasiticGuSnapshot:null,
    recentPoisonChainTargets:new Map(),
    poisonChainRebuildUntil:0,
    poisonKing:null,
    getParasiticGuSnapshot(){ return this.parasiticGuSnapshot||{host:null,growth:0,maxGrowth:0}; },
    setParasiticGuSnapshot(snapshot){ this.parasiticGuSnapshot=snapshot||null; },
    recordPoisonChainTarget(target,time=scene.getGameplayTime?.()||0){ if(target) this.recentPoisonChainTargets.set(target,time); },
    prunePoisonChainTargets(time=scene.getGameplayTime?.()||0){ this.recentPoisonChainTargets.forEach((seenAt,target)=>{ if(time-seenAt>4000||!scene.targeting?.valid?.(target)) this.recentPoisonChainTargets.delete(target); }); },
    getRecentPoisonChainTargets(){ const now=scene.getGameplayTime?.()||0; this.prunePoisonChainTargets(now); return [...this.recentPoisonChainTargets.keys()].slice(0,6); },
    getRecentPoisonChainTargetCount(){ return this.getRecentPoisonChainTargets().length; },
    clearRecentPoisonChainTargets(){ this.recentPoisonChainTargets.clear(); },
    setPoisonChainRebuildUntil(time){ this.poisonChainRebuildUntil=Math.max(this.poisonChainRebuildUntil||0,time||0); },
    isPoisonChainRebuilding(time=scene.getGameplayTime?.()||0){ return time<(this.poisonChainRebuildUntil||0); },
    getPoisonKing(){ return this.poisonKing&&!this.poisonKing.dead?this.poisonKing:null; },
    hasPoisonKing(){ return !!this.getPoisonKing(); },
    setPoisonKing(king){ this.poisonKing=king||null; },
    resetPoisonSummonRuntime(){ this.parasiticGuSnapshot=null; this.recentPoisonChainTargets.clear(); this.poisonChainRebuildUntil=0; this.poisonKing=null; }
  };
  scene.poisonSummonRuntime=runtime;
  return runtime;
}

const CONFIGS={
  poison_chain:{ id:SOURCE_POISON_CHAIN,name:'毒链',rarity:'EPIC',handler:SOURCE_POISON_CHAIN,passive:true,maxLevel:9,requiredSkillId:'bone_eating_insect',tags:[TAGS.POISON,TAGS.DOT,TAGS.SUMMON,TAGS.BUILD_POISON_SUMMON],cooldownMs:999999,targetType:'passive',color:0x42e76d,short:'链',description:'中毒目标受到真实毒伤时，将部分毒性传导给附近敌人。',levels:levels([
    [1,0.35,140,700],[1,0.40,155,650],[2,0.44,165,620],[2,0.48,175,580],[2,0.52,185,540],[2,0.56,195,500],[3,0.59,205,470],[3,0.62,215,440],[3,0.65,220,400]
  ],([maxLinks,damageRatio,radius,internalCooldownMs])=>({maxLinks,damageRatio,radius,internalCooldownMs,desc:`毒伤跳动时，向${radius}范围内最多${maxLinks}名目标传导${Math.round(damageRatio*100)}%毒链伤害。`}),{3:'连接目标提高至2个',6:'传导比例和范围提高',9:'最多连接3个目标，冷却缩短'}) },
  poison_king:{ id:SOURCE_POISON_KING,name:'毒王',rarity:'EPIC',handler:SOURCE_POISON_KING,passive:false,maxLevel:9,requiredSkillId:SOURCE_POISON_CHAIN,targetType:'self',tags:[TAGS.POISON,TAGS.DOT,TAGS.SUMMON,TAGS.ACTIVE_SKILL,TAGS.BUILD_POISON_SUMMON],color:0x1f9d45,short:'王',description:'吞噬场上部分感染孵化毒王；感染规模越大，毒王形态和战斗能力越强。',levels:levels([
    [19000,0.25,0.20,8500,140,18,1500,0.10,0.10,0.10,0.10,0.05,0,8,120,5,10,1],
    [18600,0.27,0.22,8800,160,22,1450,0.12,0.12,0.12,0.12,0.06,0,8,130,6,10,1],
    [18200,0.30,0.25,9200,185,27,1400,0.15,0.15,0.15,0.15,0.08,0,7,140,7,11,1],
    [17800,0.32,0.27,9500,215,33,1350,0.18,0.18,0.18,0.18,0.10,0.03,7,150,8,11,1],
    [17400,0.34,0.30,9800,250,40,1300,0.21,0.21,0.21,0.21,0.12,0.05,6,160,9,12,2],
    [17000,0.37,0.33,10200,290,48,1240,0.25,0.25,0.25,0.25,0.15,0.07,6,170,10,12,2],
    [16600,0.39,0.36,10600,335,58,1180,0.28,0.28,0.28,0.28,0.17,0.09,5,180,11,13,2],
    [16200,0.42,0.40,11000,385,70,1120,0.32,0.32,0.32,0.32,0.19,0.11,5,185,12,14,2],
    [15500,0.45,0.45,11600,450,85,1050,0.36,0.36,0.36,0.36,0.22,0.14,5,190,13,15,3]
  ],([cooldownMs,consumeRatio,guGrowthContributionRatio,durationMs,hp,biteDamage,attackIntervalMs,absorbBonus,growthCapBonus,guDamageBonus,insectDamageBonus,insectAttackSpeedBonus,insectExtendBonus,burstStackThreshold,burstRadius,burstDamagePerStack,burstMaxStacks,burstPoisonStacks])=>({cooldownMs,consumeRatio,guGrowthContributionRatio,durationMs,hp,biteDamage,attackIntervalMs,absorbBonus,growthCapBonus,guDamageBonus,insectDamageBonus,insectAttackSpeedBonus,insectExtendBonus,burstStackThreshold,burstRadius,burstDamagePerStack,burstMaxStacks,burstPoisonStacks,desc:'吞噬感染孵化毒王，感染规模越大形态越强。'}),{3:'吞毒成长\n提高感染吞噬比例，毒王持续时间和基础战斗能力增强。',6:'万毒之躯\n毒王攻击附加中毒，移动留下毒雾，并成为毒链中心节点。',9:'毒王降世\n高感染时直接孵化完全体；毒王周期孵化毒虫，退场后重新播散毒性。'}) }
};

const FORMS=[
  {id:'normal',name:'普通体',min:45,scale:1,duration:1,hp:1,damage:1,interval:1,mistMs:2400,range:130,aura:1,color:0x174f26,spawnMax:0},
  {id:'mature',name:'成熟体',min:100,scale:1.18,duration:1.12,hp:1.35,damage:1.25,interval:0.92,mistMs:2200,range:155,aura:1.15,color:0x239a43,spawnMax:1},
  {id:'complete',name:'完全体',min:170,scale:1.38,duration:1.25,hp:1.75,damage:1.55,interval:0.84,mistMs:1950,range:185,aura:1.30,color:0x31d45c,spawnMax:2},
  {id:'berserk',name:'暴走体',min:240,scale:1.58,duration:1.32,hp:2.10,damage:1.90,interval:0.72,mistMs:1250,range:210,aura:1.45,color:0x75ff63,spawnMax:3}
];
const formForPower=(power,level)=>{ let form=FORMS[0]; FORMS.forEach(f=>{ if(power>=f.min) form=f; }); if(level>=9&&power>=170&&form.min<170) form=FORMS[2]; return form; };

export function configurePoisonSummonAdvancedSkills(){ Object.entries(CONFIGS).forEach(([id,cfg])=>{ SKILLS[id]={...cfg}; }); }

export const PoisonChainSkill={ bind(system){
  const s=system.scene; const runtime=ensurePoisonRuntime(s); const sourceReady=new WeakMap(); const tickKeys=new Set(); const visuals=new Set();
  const showLine=(from,to)=>{ const g=s.add.graphics().setDepth(148); g.lineStyle(5,0x4cff78,0.9); g.lineBetween(from.x,from.y-48,to.x,to.y-48); visuals.add(g); s.tweens.add({targets:g,alpha:0,duration:180,onComplete:()=>{ visuals.delete(g); destroyVisual(g); }}); };
  const off=s.eventBus.on(CombatEvents.STATUS_TICK,p=>{
    const data=system.getData(SOURCE_POISON_CHAIN); if(!data) return;
    const now=s.getGameplayTime(); if(runtime.isPoisonChainRebuilding(now)) return;
    if(p.type!==StatusEffects.POISON||p.source!=='poison'||p.actualDamage<=0||p.effect?.type!==StatusEffects.POISON) return;
    if(p.noPoisonChain||p.damageKind==='poisonChain'||p.effect?.sourceId===SOURCE_POISON_CHAIN) return;
    const source=p.target; if(!s.targeting.valid(source)) return;
    if(now<(sourceReady.get(source)||0)) return;
    const tickKey=`${p.statusId||p.effect?.id}:${p.effect?.nextTickAt||now}:${source.id||source.name||''}`; if(tickKeys.has(tickKey)) return; tickKeys.add(tickKey); if(tickKeys.size>160) tickKeys.clear();
    const all=s.targeting.all().filter(e=>e!==source&&dist(e,source)<=data.radius);
    const infected=all.filter(e=>s.statusEffects.has(e,StatusEffects.POISON));
    let pool=(infected.length?infected:all).sort((a,b)=>dist(a,source)-dist(b,source)||s.statusEffects.getStackCount(b,StatusEffects.POISON)-s.statusEffects.getStackCount(a,StatusEffects.POISON)).slice(0,data.maxLinks);
    if(!pool.length) return; sourceReady.set(source,now+data.internalCooldownMs);
    runtime.recordPoisonChainTarget(source,now);
    const damage=Math.max(1,Math.round(p.actualDamage*data.damageRatio));
    pool.forEach(target=>{ runtime.recordPoisonChainTarget(target,now); showLine(source,target); s.combatSystem.damageEnemy(target,damage,{ source:'skill', skillId:SOURCE_POISON_CHAIN, damageKind:'poisonChain', tags:[TAGS.POISON,TAGS.DOT,TAGS.BUILD_POISON_SUMMON], allowLifeSteal:false, noKnockback:true, noPoisonChain:true, noPoisonKingBurst:true }); });
  });
  return ()=>{ off?.(); tickKeys.clear(); visuals.forEach(destroyVisual); visuals.clear(); };
} };

function infectionSnapshot(system){
  const s=system.scene, runtime=ensurePoisonRuntime(s), now=s.getGameplayTime();
  const enemies=s.targeting.all().filter(e=>s.targeting.valid(e));
  let score=0,totalStacks=0,totalRemainScore=0;
  const poisoned=enemies.filter(e=>s.statusEffects.has(e,StatusEffects.POISON));
  poisoned.forEach(e=>{
    score+=isBoss(e)?18:10;
    const stacks=s.statusEffects.getStackCount(e,StatusEffects.POISON); totalStacks+=stacks; score+=stacks*(isBoss(e)?3:2);
    const remainMs=s.statusEffects.getEffects(e,StatusEffects.POISON).reduce((sum,fx)=>sum+Math.max(0,(fx.expiresAt||now)-now),0);
    const remainScore=Math.min(isBoss(e)?12:8,Math.floor(remainMs/1000)); totalRemainScore+=remainScore; score+=remainScore;
  });
  const gu=runtime.getParasiticGuSnapshot();
  if(gu.host&&s.targeting.valid(gu.host)){ score+=15; score+=Math.min(18,Math.floor((gu.growth||0)/2)); }
  const recentPoisonChainNodes=runtime.getRecentPoisonChainTargetCount(); score+=Math.min(6,recentPoisonChainNodes)*5;
  return { score, enemies, poisoned, totalStacks, totalRemainScore, gu, recentPoisonChainNodes };
}

function reducePoison(system,target,ratio){
  const s=system.scene, now=s.getGameplayTime(), boss=isBoss(target);
  const effects=s.statusEffects.getEffects(target,StatusEffects.POISON).filter(effect=>(effect.stacks||1)>0);
  const before=effects.reduce((sum,effect)=>sum+(effect.stacks||1),0);
  if(before<=0) return {stacks:0,seconds:0};
  const actualRatio=boss?ratio*0.5:ratio;
  const minimumTotal=boss?Math.ceil(before*0.70):1;
  let remainingToConsume=Math.min(Math.floor(before*actualRatio),Math.max(0,before-minimumTotal));
  let consumedStacks=0, consumedMs=0;
  const ordered=[...effects].sort((a,b)=>(b.stacks||1)-(a.stacks||1)||((a.expiresAt||now)-(b.expiresAt||now))||((a.id||0)-(b.id||0)));
  for(const effect of ordered){
    if(remainingToConsume<=0) break;
    const previousStacks=effect.stacks||1;
    const consume=Math.min(previousStacks,remainingToConsume);
    const nextStacks=previousStacks-consume;
    remainingToConsume-=consume; consumedStacks+=consume;
    if(nextStacks<=0){
      s.statusEffects.removeEffect(effect,'poisonKingConsumed');
    } else {
      effect.stacks=nextStacks;
      s.statusEffects.emit?.(CombatEvents.STATUS_STACK_CHANGED,{ effect, target, type:StatusEffects.POISON, previousStacks, stacks:nextStacks, delta:nextStacks-previousStacks, sourceId:effect.sourceId });
    }
  }
  const minRemain=boss?1800:900;
  s.statusEffects.getEffects(target,StatusEffects.POISON).forEach(effect=>{
    const remain=Math.max(0,(effect.expiresAt||now)-now);
    const reduce=Math.min(Math.floor(remain*actualRatio),Math.max(0,remain-minRemain));
    if(reduce>0){ effect.expiresAt-=reduce; consumedMs+=reduce; }
  });
  return {stacks:consumedStacks,seconds:consumedMs/1000};
}

function applyKingAura(system,data,form){
  const p=system.scene.playerData; ensureRuntime(p); const mult=form.aura||1;
  ['parasiticGuAbsorbBonuses','parasiticGuGrowthCapBonuses','parasiticGuDamageBonuses','poisonInsectDamageBonuses','poisonInsectAttackSpeedBonuses','poisonInsectExtendBonuses'].forEach(k=>{ if(p[k]) delete p[k][SOURCE_POISON_KING]; });
  p.parasiticGuAbsorbBonuses[SOURCE_POISON_KING]=data.absorbBonus*mult;
  p.parasiticGuGrowthCapBonuses[SOURCE_POISON_KING]=data.growthCapBonus*mult;
  p.parasiticGuDamageBonuses[SOURCE_POISON_KING]=data.guDamageBonus*mult;
  p.poisonInsectDamageBonuses[SOURCE_POISON_KING]=data.insectDamageBonus*mult;
  p.poisonInsectAttackSpeedBonuses[SOURCE_POISON_KING]=data.insectAttackSpeedBonus*mult;
  p.poisonInsectExtendBonuses[SOURCE_POISON_KING]=data.insectExtendBonus*mult;
}
function clearKingAura(scene){ const p=scene.playerData; ['parasiticGuAbsorbBonuses','parasiticGuGrowthCapBonuses','parasiticGuDamageBonuses','poisonInsectDamageBonuses','poisonInsectAttackSpeedBonuses','poisonInsectExtendBonuses'].forEach(k=>{ if(p?.[k]) delete p[k][SOURCE_POISON_KING]; }); }

export const PoisonKingSkill={
  canCast(system){
    const s=system.scene, runtime=ensurePoisonRuntime(s), now=s.getGameplayTime();
    if(runtime.hasPoisonKing()) return failPrecast(s,'毒王已存在',now);
    if(now<(s._poisonKingCanCastRetryUntil||0)) return { failed:true, throttled:true, reason:s._poisonKingCanCastFailure||'感染不足' };
    const snap=infectionSnapshot(system);
    const hasGuHost=!!(snap.gu.host&&s.targeting.valid(snap.gu.host));
    if(!snap.enemies.length) return failPrecast(s,'感染不足',now);
    if(!snap.poisoned.length&&!hasGuHost) return failPrecast(s,'感染不足',now);
    if(snap.score<MIN_INFECTION_SCORE) return failPrecast(s,'感染不足',now);
    s._poisonKingCanCastRetryUntil=0; s._poisonKingCanCastFailure='';
    return { success:true, snapshot:snap };
  },
  cast(system,cfg,data,level){
    const s=system.scene, runtime=ensurePoisonRuntime(s), now=s.getGameplayTime();
    if(runtime.hasPoisonKing()) return { failed:true, reason:'毒王已存在' };
    const snap=infectionSnapshot(system);
    if(!snap.enemies.length||(!snap.poisoned.length&&!(snap.gu.host&&s.targeting.valid(snap.gu.host)))||snap.score<MIN_INFECTION_SCORE) return { failed:true, reason:'感染不足' };
    let consumedPoisonStacks=0, consumedPoisonSeconds=0;
    snap.poisoned.forEach(e=>{ const c=reducePoison(system,e,data.consumeRatio); consumedPoisonStacks+=c.stacks; consumedPoisonSeconds+=c.seconds; });
    const parasiticGrowthContribution=Math.min(snap.gu.growth||0,(snap.gu.growth||0)*data.guGrowthContributionRatio);
    runtime.clearRecentPoisonChainTargets(); runtime.setPoisonChainRebuildUntil(now+CHAIN_REBUILD_MS);
    const lifeLossBonus=Math.min(20,snap.enemies.reduce((sum,e)=>sum+Math.max(0,(e.maxHp||0)-(e.hp||0))/(e.maxHp||1),0));
    const kingPower=clamp(Math.round(snap.score+consumedPoisonStacks*4+consumedPoisonSeconds*1.5+parasiticGrowthContribution*3+snap.recentPoisonChainNodes*6+lifeLossBonus),0,320);
    const form=formForPower(kingPower,level);
    spawnKing(system,data,level,kingPower,form,{consumedPoisonStacks,consumedPoisonSeconds});
    return { success:true };
  },
  bind(system){
    const s=system.scene, runtime=ensurePoisonRuntime(s), bursted=new WeakSet(), visuals=new Set();
    const off=s.eventBus.on(CombatEvents.ENEMY_KILLED,payload=>{ const king=runtime.getPoisonKing(); const data=system.getData(SOURCE_POISON_KING); const enemy=payload.enemy; if(!king||!data||!enemy||payload.noPoisonKingBurst||payload.damageKind==='poisonKingBurst'||bursted.has(enemy)) return; const stacks=payload.poisonStacksBeforeDeath||0; if(stacks<data.burstStackThreshold) return; bursted.add(enemy); const formMult={normal:1,mature:1.1,complete:1.25,berserk:1.4}[king.form.id]||1; const damage=Math.min(180,Math.max(1,Math.round(Math.min(data.burstMaxStacks,stacks)*data.burstDamagePerStack*formMult))); const r=data.burstRadius; const o=s.add.circle(enemy.x,enemy.y,r,0x37d666,0.14).setStrokeStyle(5,0x5dff83,0.86).setDepth(149); visuals.add(o); s.tweens.add({targets:o,alpha:0,scale:1.18,duration:260,onComplete:()=>{ visuals.delete(o); o.destroy(); }}); s.targeting.all().filter(e=>e!==enemy&&dist(e,enemy)<=r).forEach(target=>{ s.combatSystem.damageEnemy(target,damage,{ source:'skill', skillId:SOURCE_POISON_KING, damageKind:'poisonKingBurst', tags:[TAGS.POISON,TAGS.DOT,TAGS.SUMMON,TAGS.BUILD_POISON_SUMMON], allowLifeSteal:false, noKnockback:true, noPoisonChain:true, noPoisonKingBurst:true, noPoisonKingRecursive:true, noPoisonSpread:true }); addPoison(system,target,data.burstPoisonStacks,2400,4,`poison_king_burst_${s.getGameplayTime()}_${target.id||''}`); }); });
    const updater=()=>updateKing(system); system.passiveUpdaters.push(updater);
    return ()=>{ off?.(); removeUpdater(system,updater); endKing(system,'skillRemoved'); clearKingAura(s); visuals.forEach(destroyVisual); visuals.clear(); runtime.resetPoisonSummonRuntime?.(); };
  },
  cleanup(system){ endKing(system,'skillRemoved'); }
};

function failPrecast(s,text,now=s.getGameplayTime?.()||0){ s._poisonKingCanCastRetryUntil=now+350; s._poisonKingCanCastFailure=text; s._poisonKingFailTextAt??=0; if(now>=s._poisonKingFailTextAt){ s.floatText?.(s.player.x,s.player.y-118,text,'#9aff79'); s._poisonKingFailTextAt=now+650; } return { failed:true, reason:text }; }
function addPoison(system,target,stacks,durationMs,value,sourceId){ const data=poisonNeedleData(system); system.scene.statusEffects.add(StatusEffects.POISON,target,{ durationMs, intervalMs:data.poisonIntervalMs||700, value:value||data.poisonDamage||3, stacks, maxStacks:Math.max(data.maxStacks||15,stacks), sourceId, damageMultiplier:1, baseDamageMultiplierWithoutProfession:1, professionMultiplier:1, professionApplied:true, noPoisonKingBurst:true }); }

function spawnKing(system,data,level,power,form,absorbedPoison){
  const s=system.scene, runtime=ensurePoisonRuntime(s), now=s.getGameplayTime();
  const view=s.add.container(s.player.x+110,s.player.y-58).setDepth(147); const body=s.add.ellipse(0,0,58,38,form.color,0.95).setStrokeStyle(4,0xb7ff82,0.8); const eye1=s.add.circle(14,-6,4,0xf2ffd2,1); const eye2=s.add.circle(26,-5,3,0xf2ffd2,1); const sac=s.add.circle(-20,6,13,0x77ff66,0.35); view.add([sac,body,eye1,eye2]); view.setScale(form.scale);
  const king={ id:`poison_king_${now}`, view, hp:Math.round(data.hp*form.hp), maxHp:Math.round(data.hp*form.hp), power, form, level, expiresAt:now+Math.min(16000,Math.round(data.durationMs*form.duration)), target:null, nextAttackAt:now+400, nextMistAt:now+700, nextSpawnAt:now+2600, nextTrailAt:now+650, tempInsects:[], mistZones:[], chainVisuals:new Set(), absorbedPoison, dead:false, ending:false, berserkUntil:form.id==='berserk'?now+BERSERK_MS:0 };
  runtime.setPoisonKing(king); applyKingAura(system,data,form); s.floatText?.(s.player.x+110,s.player.y-118,`毒王孵化 ${form.name}`,'#9dff73');
}

function updateKing(system){ const s=system.scene, runtime=ensurePoisonRuntime(s), king=runtime.getPoisonKing(); if(!king) return; const now=s.getGameplayTime(); if(now>=king.expiresAt) return endKing(system,'expired'); const anchor={x:clamp(s.player.x+120,40,(s.scale?.width||960)-40),y:s.player.y-58}; const target=chooseKingTarget(system,king); king.target=target; const desired=target?{x:clamp(target.x-38,40,(s.scale?.width||960)-40),y:target.y-54}:anchor; const returning=target&&now+180<king.nextAttackAt; const goal=returning?anchor:desired; king.view.x+=(goal.x-king.view.x)*0.12; king.view.y+=(goal.y-king.view.y)*0.12; if(king.level>=6&&now>=king.nextTrailAt){ createTrailMist(system,king); king.nextTrailAt=now+650; } if(target&&now>=king.nextAttackAt) bite(system,king,target); if(now>=king.nextMistAt) poisonMist(system,king); if(king.level>=9&&king.form.min>=170&&now>=king.nextSpawnAt){ spawnTempInsect(system,king); king.nextSpawnAt=now+2600; } updateTempInsects(system,king); cleanupMistZones(system,king); }
function chooseKingTarget(system,king){ const s=system.scene; const all=s.targeting.all().filter(e=>s.targeting.valid(e)); if(!all.length) return null; const boss=all.find(isBoss); if(boss) return boss; const gu=ensurePoisonRuntime(s).getParasiticGuSnapshot(); if(gu.host&&s.targeting.valid(gu.host)) return gu.host; return all.sort((a,b)=>s.statusEffects.getStackCount(b,StatusEffects.POISON)-s.statusEffects.getStackCount(a,StatusEffects.POISON)||Math.abs(a.x-s.player.x)-Math.abs(b.x-s.player.x))[0]; }
function bite(system,king,target){ const s=system.scene, data=system.getData(SOURCE_POISON_KING,king.level), now=s.getGameplayTime(); const berserk=king.form.id==='berserk'&&now<king.berserkUntil; const interval=Math.max(520,Math.round(data.attackIntervalMs*king.form.interval*(berserk?0.72:1))); king.nextAttackAt=now+interval; const damage=Math.max(1,Math.round(data.biteDamage*king.form.damage)); s.combatSystem.damageEnemy(target,damage,{ source:'skill', skillId:SOURCE_POISON_KING, damageKind:'poisonKingBite', tags:[TAGS.POISON,TAGS.SUMMON,TAGS.BUILD_POISON_SUMMON], allowLifeSteal:false, noKnockback:true, noPoisonChain:true, noPoisonKingBurst:true, noPoisonKingRecursive:true, noSwordTrigger:true }); if(king.level>=6){ addPoison(system,target,king.form.min>=170?2:1,3200,poisonNeedleData(system).poisonDamage||3,`poison_king_bite_${king.id}_${now}_${target.id||''}`); chainCenter(system,king,target,damage); } if(!s.targeting.valid(target)&&king.form.spawnMax>0) spawnTempInsect(system,king); }
function poisonMist(system,king){ const s=system.scene, now=s.getGameplayTime(), berserk=king.form.id==='berserk'&&now<king.berserkUntil; const interval=berserk?1250:(king.form.id==='berserk'?1800:king.form.mistMs); king.nextMistAt=now+interval; const stacks=king.form.min>=170?2:1; const damage=Math.max(1,Math.round((poisonNeedleData(system).poisonDamage||3)*king.form.damage)); const targets=s.targeting.all().filter(e=>dist(e,king.view)<=king.form.range).slice(0,6); targets.forEach(e=>{ s.combatSystem.damageEnemy(e,damage,{source:'skill',skillId:SOURCE_POISON_KING,damageKind:'poisonKingMist',tags:[TAGS.POISON,TAGS.DOT,TAGS.SUMMON,TAGS.BUILD_POISON_SUMMON],allowLifeSteal:false,noKnockback:true,noPoisonChain:true,noPoisonKingBurst:true,noPoisonKingRecursive:true}); addPoison(system,e,stacks,3200,poisonNeedleData(system).poisonDamage||3,`poison_king_mist_${king.id}_${now}_${e.id||''}`); if(!s.targeting.valid(e)&&king.form.spawnMax>0) spawnTempInsect(system,king); }); const o=s.add.circle(king.view.x,king.view.y,king.form.range,0x40e060,0.08).setDepth(143); s.tweens.add({targets:o,alpha:0,duration:420,onComplete:()=>o.destroy()}); }
function createTrailMist(system,king){ const s=system.scene; while(king.mistZones.length>=4) king.mistZones.shift().view?.destroy?.(); const zone={x:king.view.x,y:king.view.y,r:92,expiresAt:s.getGameplayTime()+1200,hit:new WeakSet(),view:s.add.circle(king.view.x,king.view.y,92,0x4ce878,0.06).setDepth(142)}; king.mistZones.push(zone); s.targeting.all().filter(e=>dist(e,zone)<=zone.r&&!zone.hit.has(e)).forEach(e=>{ zone.hit.add(e); addPoison(system,e,1,2600,poisonNeedleData(system).poisonDamage||3,`poison_king_trail_${king.id}_${s.getGameplayTime()}_${e.id||''}`); }); }
function cleanupMistZones(system,king){ const now=system.scene.getGameplayTime(); king.mistZones=king.mistZones.filter(z=>{ if(now<z.expiresAt) return true; z.view?.destroy?.(); return false; }); }
function chainCenter(system,king,mainTarget,damage){ if(king.level<6) return; const s=system.scene, count=king.level>=8?3:2; const targets=s.targeting.all().filter(e=>e!==mainTarget&&s.statusEffects.has(e,StatusEffects.POISON)).sort((a,b)=>dist(a,king.view)-dist(b,king.view)).slice(0,count); targets.forEach(e=>{ const g=s.add.graphics().setDepth(148); g.lineStyle(4,0x8cff78,0.85).lineBetween(king.view.x,king.view.y,e.x,e.y-48); king.chainVisuals.add(g); s.tweens.add({targets:g,alpha:0,duration:160,onComplete:()=>{ king.chainVisuals.delete(g); g.destroy(); }}); s.combatSystem.damageEnemy(e,Math.max(1,Math.round(damage*0.25)),{source:'skill',skillId:SOURCE_POISON_KING,damageKind:'poisonKingCenterChain',tags:[TAGS.POISON,TAGS.SUMMON,TAGS.BUILD_POISON_SUMMON],allowLifeSteal:false,noKnockback:true,noPoisonChain:true,noPoisonKingBurst:true,noPoisonKingRecursive:true}); }); }
function spawnTempInsect(system,king){ if(king.form.spawnMax<=0) return; king.tempInsects=king.tempInsects.filter(i=>!i.dead); if(king.tempInsects.length>=king.form.spawnMax) return; const s=system.scene; const view=s.add.circle(king.view.x-10,king.view.y+10,5,0xc8ff73,0.9).setStrokeStyle(2,0x426d24,1).setDepth(146); king.tempInsects.push({view,attacksLeft:2,readyAt:s.getGameplayTime()+180,dead:false}); }
function updateTempInsects(system,king){ const s=system.scene, data=system.getData('bone_eating_insect')||{damage:7,extendMs:700,attackIntervalMs:1400}, now=s.getGameplayTime(); king.tempInsects.forEach(insect=>{ if(insect.dead) return; const targets=s.targeting.all().filter(e=>s.statusEffects.has(e,StatusEffects.POISON)); const target=(targets[0]||s.targeting.all()[0]); if(!target){ insect.view.x+=(king.view.x-insect.view.x)*0.16; insect.view.y+=(king.view.y-insect.view.y)*0.16; return; } insect.view.x+=(target.x-insect.view.x)*0.18; insect.view.y+=(target.y-45-insect.view.y)*0.18; if(now<insect.readyAt||dist(insect.view,target)>34) return; insect.readyAt=now+Math.max(650,data.attackIntervalMs||1400); insect.attacksLeft-=1; s.combatSystem.damageEnemy(target,Math.max(1,Math.round((data.damage||7)*0.6*king.form.damage)),{source:'skill',skillId:SOURCE_POISON_KING,damageKind:'poisonKingTempInsect',tags:[TAGS.POISON,TAGS.SUMMON,TAGS.BUILD_POISON_SUMMON],allowLifeSteal:false,noKnockback:true,noPoisonChain:true,noPoisonKingBurst:true,noPoisonKingRecursive:true}); s.statusEffects.getEffects(target,StatusEffects.POISON).forEach(effect=>{ effect.expiresAt=Math.min(now+MAX_EFFECT_REMAINING_MS,effect.expiresAt+Math.round((data.extendMs||700)*0.5)); }); if(insect.attacksLeft<=0){ insect.dead=true; insect.view.destroy(); } }); king.tempInsects=king.tempInsects.filter(i=>!i.dead); }
function endKing(system,reason){ const s=system.scene, runtime=ensurePoisonRuntime(s), king=runtime.getPoisonKing(); if(!king||king.ending) return; king.ending=true; const shouldReturn=king.level>=9&&(reason==='expired'||reason==='skillRemoved'); if(shouldReturn) returnInfection(system,king); king.dead=true; clearKingAura(s); king.view?.destroy?.(); king.mistZones?.forEach(z=>z.view?.destroy?.()); king.tempInsects?.forEach(i=>i.view?.destroy?.()); king.chainVisuals?.forEach(destroyVisual); runtime.setPoisonKing(null); }
function returnInfection(system,king){ const s=system.scene, data=poisonNeedleData(system); const total=Math.floor((king.absorbedPoison?.consumedPoisonStacks||0)*0.55); if(total<=0) return; const targets=s.targeting.all().filter(e=>s.targeting.valid(e)).sort((a,b)=>(isBoss(b)-isBoss(a))||((s.statusEffects.has(a,StatusEffects.POISON)?1:0)-(s.statusEffects.has(b,StatusEffects.POISON)?1:0))||s.statusEffects.getStackCount(a,StatusEffects.POISON)-s.statusEffects.getStackCount(b,StatusEffects.POISON)||Math.abs(a.x-s.player.x)-Math.abs(b.x-s.player.x)).slice(0,5); if(!targets.length) return; let remain=total; targets.forEach((target,index)=>{ const left=targets.length-index; const stacks=Math.min(4,Math.max(1,Math.floor(remain/left))); if(remain<=0) return; const give=Math.min(stacks,remain); remain-=give; addPoison(system,target,give,3200,data.poisonDamage||3,`poison_king_return_${king.id}_${target.id||index}`); }); const o=s.add.circle(s.player.x,s.player.y-60,220,0x62f66d,0.10).setStrokeStyle(5,0x9dff73,0.75).setDepth(150); s.tweens.add({targets:o,alpha:0,scale:1.18,duration:520,onComplete:()=>o.destroy()}); }

export const poisonSummonBonusUtils={ sumBonuses, ensureRuntime, MIN_INSECT_INTERVAL_MS, MAX_SINGLE_EXTEND_MS, MAX_EFFECT_REMAINING_MS, ensurePoisonRuntime };
