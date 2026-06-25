import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';
import { CombatEvents } from '../../core/CombatEvents.js';
import { StatusEffects } from '../../systems/StatusEffectSystem.js';

const SOURCE_POISON_CHAIN='poison_chain';
const SOURCE_POISON_KING='poison_king';
const MIN_INSECT_INTERVAL_MS=650;
const MAX_SINGLE_EXTEND_MS=1800;
const MAX_EFFECT_REMAINING_MS=12000;

const levels=(values,build,milestones={})=>values.map((value,index)=>({ ...build(value,index+1), ...(milestones[index+1]?{milestoneText:milestones[index+1]}:{}) }));
const removeUpdater=(system,updater)=>{ const index=system.passiveUpdaters.indexOf(updater); if(index>=0) system.passiveUpdaters.splice(index,1); };
const sumBonuses=bonuses=>Object.values(bonuses||{}).reduce((sum,value)=>sum+(Number(value)||0),0);
const ensureRuntime=p=>{
  p.parasiticGuAbsorbBonuses??={};
  p.parasiticGuGrowthCapBonuses??={};
  p.parasiticGuDamageBonuses??={};
  p.poisonInsectDamageBonuses??={};
  p.poisonInsectAttackSpeedBonuses??={};
  p.poisonInsectExtendBonuses??={};
};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const destroyVisual=o=>{ if(!o) return; o.destroy?.(); };

const CONFIGS={
  poison_chain:{ id:SOURCE_POISON_CHAIN,name:'毒链',rarity:'EPIC',handler:SOURCE_POISON_CHAIN,passive:true,maxLevel:9,requiredSkillId:'bone_eating_insect',tags:[TAGS.POISON,TAGS.DOT,TAGS.SUMMON,TAGS.BUILD_POISON_SUMMON],cooldownMs:999999,targetType:'passive',color:0x42e76d,short:'链',description:'中毒目标受到真实毒伤时，将部分毒性传导给附近敌人。',levels:levels([
    [1,0.35,140,700],[1,0.40,155,650],[2,0.44,165,620],[2,0.48,175,580],[2,0.52,185,540],[2,0.56,195,500],[3,0.59,205,470],[3,0.62,215,440],[3,0.65,220,400]
  ],([maxLinks,damageRatio,radius,internalCooldownMs])=>({maxLinks,damageRatio,radius,internalCooldownMs,desc:`毒伤跳动时，向${radius}范围内最多${maxLinks}名目标传导${Math.round(damageRatio*100)}%毒链伤害。`}),{3:'连接目标提高至2个',6:'传导比例和范围提高',9:'最多连接3个目标，冷却缩短'}) },
  poison_king:{ id:SOURCE_POISON_KING,name:'毒王',rarity:'EPIC',handler:SOURCE_POISON_KING,passive:true,maxLevel:9,requiredSkillId:SOURCE_POISON_CHAIN,tags:[TAGS.POISON,TAGS.DOT,TAGS.SUMMON,TAGS.BUILD_POISON_SUMMON],cooldownMs:999999,targetType:'passive',color:0x1f9d45,short:'王',description:'强化寄生蛊与蚀骨毒虫；高毒层宿主死亡时产生受控毒性爆发。',levels:levels([
    [0.15,0.15,0.15,0.08,0,8,120,5,10,1],[0.18,0.18,0.18,0.10,0,8,130,6,10,1],[0.22,0.22,0.22,0.12,0,7,140,7,11,1],[0.26,0.26,0.26,0.15,0.04,7,150,8,11,1],[0.30,0.30,0.30,0.17,0.06,6,160,9,12,2],[0.34,0.34,0.34,0.20,0.08,6,170,10,12,2],[0.36,0.38,0.38,0.22,0.10,5,180,11,13,2],[0.38,0.42,0.42,0.24,0.12,5,185,12,14,2],[0.40,0.45,0.45,0.25,0.15,5,190,13,15,3]
  ],([absorbBonus,guDamageBonus,insectDamageBonus,insectAttackSpeedBonus,insectExtendBonus,burstStackThreshold,burstRadius,burstDamagePerStack,burstMaxStacks,burstPoisonStacks])=>({absorbBonus,growthCapBonus:absorbBonus,guDamageBonus,insectDamageBonus,insectAttackSpeedBonus,insectExtendBonus,burstStackThreshold,burstRadius,burstDamagePerStack,burstMaxStacks,burstPoisonStacks,desc:`寄生与毒虫伤害提高；${burstStackThreshold}层以上中毒敌人死亡时爆发。`}),{3:'寄生与毒虫强化提高，爆发阈值降低',6:'爆发范围扩大并附加更多中毒',9:'强化达到顶峰，爆发最多附加3层毒'}) }
};

export function configurePoisonSummonAdvancedSkills(){ Object.entries(CONFIGS).forEach(([id,cfg])=>{ SKILLS[id]={...cfg}; }); }

export const PoisonChainSkill={ bind(system){
  const s=system.scene; const sourceReady=new WeakMap(); const tickKeys=new Set(); const visuals=new Set();
  const showLine=(from,to)=>{ const g=s.add.graphics().setDepth(148); g.lineStyle(5,0x4cff78,0.9); g.lineBetween(from.x,from.y-48,to.x,to.y-48); visuals.add(g); s.tweens.add({targets:g,alpha:0,duration:180,onComplete:()=>{ visuals.delete(g); destroyVisual(g); }}); };
  const off=s.eventBus.on(CombatEvents.STATUS_TICK,p=>{
    const data=system.getData(SOURCE_POISON_CHAIN); if(!data) return;
    if(p.type!==StatusEffects.POISON||p.source!=='poison'||p.actualDamage<=0||p.effect?.type!==StatusEffects.POISON) return;
    if(p.noPoisonChain||p.damageKind==='poisonChain'||p.effect?.sourceId===SOURCE_POISON_CHAIN) return;
    const source=p.target; if(!s.targeting.valid(source)) return;
    const now=s.getGameplayTime(); if(now<(sourceReady.get(source)||0)) return;
    const tickKey=`${p.statusId||p.effect?.id}:${p.effect?.nextTickAt||now}:${source.id||source.name||''}`; if(tickKeys.has(tickKey)) return; tickKeys.add(tickKey); if(tickKeys.size>160) tickKeys.clear();
    const all=s.targeting.all().filter(e=>e!==source&&dist(e,source)<=data.radius);
    const infected=all.filter(e=>s.statusEffects.has(e,StatusEffects.POISON));
    const pool=(infected.length?infected:all).sort((a,b)=>dist(a,source)-dist(b,source)||s.statusEffects.getStackCount(b,StatusEffects.POISON)-s.statusEffects.getStackCount(a,StatusEffects.POISON)).slice(0,data.maxLinks);
    if(!pool.length) return; sourceReady.set(source,now+data.internalCooldownMs);
    const damage=Math.max(1,Math.round(p.actualDamage*data.damageRatio));
    pool.forEach(target=>{ showLine(source,target); s.combatSystem.damageEnemy(target,damage,{ source:'skill', skillId:SOURCE_POISON_CHAIN, damageKind:'poisonChain', tags:[TAGS.POISON,TAGS.DOT,TAGS.BUILD_POISON_SUMMON], allowLifeSteal:false, noKnockback:true, noPoisonChain:true, noPoisonKingBurst:true }); });
  });
  return ()=>{ off?.(); tickKeys.clear(); sourceReady.clear?.(); visuals.forEach(destroyVisual); visuals.clear(); };
} };

export const PoisonKingSkill={ bind(system){
  const s=system.scene; const p=s.playerData; ensureRuntime(p); const bursted=new WeakSet(); const visuals=new Set();
  const applyBonuses=()=>{ const data=system.getData(SOURCE_POISON_KING); ensureRuntime(p); if(!data) return; p.parasiticGuAbsorbBonuses[SOURCE_POISON_KING]=data.absorbBonus; p.parasiticGuGrowthCapBonuses[SOURCE_POISON_KING]=data.growthCapBonus; p.parasiticGuDamageBonuses[SOURCE_POISON_KING]=data.guDamageBonus; p.poisonInsectDamageBonuses[SOURCE_POISON_KING]=data.insectDamageBonus; p.poisonInsectAttackSpeedBonuses[SOURCE_POISON_KING]=data.insectAttackSpeedBonus; p.poisonInsectExtendBonuses[SOURCE_POISON_KING]=data.insectExtendBonus; };
  const clearBonuses=()=>{ ['parasiticGuAbsorbBonuses','parasiticGuGrowthCapBonuses','parasiticGuDamageBonuses','poisonInsectDamageBonuses','poisonInsectAttackSpeedBonuses','poisonInsectExtendBonuses'].forEach(k=>{ if(p[k]) delete p[k][SOURCE_POISON_KING]; }); };
  const ring=(x,y,r)=>{ const o=s.add.circle(x,y,r,0x37d666,0.14).setStrokeStyle(5,0x5dff83,0.86).setDepth(149); visuals.add(o); s.tweens.add({targets:o,alpha:0,scale:1.18,duration:260,onComplete:()=>{ visuals.delete(o); destroyVisual(o); }}); };
  const off=s.eventBus.on(CombatEvents.ENEMY_KILLED,payload=>{ const data=system.getData(SOURCE_POISON_KING); const enemy=payload.enemy; if(!data||!enemy||payload.noPoisonKingBurst||payload.damageKind==='poisonKingBurst'||bursted.has(enemy)) return; const stacks=payload.poisonStacksBeforeDeath||0; if(stacks<data.burstStackThreshold) return; bursted.add(enemy); const counted=Math.min(data.burstMaxStacks,stacks); const damage=Math.min(180,Math.max(1,Math.round(counted*data.burstDamagePerStack))); ring(enemy.x,enemy.y,data.burstRadius); s.targeting.all().filter(e=>e!==enemy&&Math.hypot(e.x-enemy.x,e.y-enemy.y)<=data.burstRadius).forEach(target=>{ s.combatSystem.damageEnemy(target,damage,{ source:'skill', skillId:SOURCE_POISON_KING, damageKind:'poisonKingBurst', tags:[TAGS.POISON,TAGS.DOT,TAGS.SUMMON,TAGS.BUILD_POISON_SUMMON], allowLifeSteal:false, noKnockback:true, noPoisonChain:true, noPoisonKingBurst:true, noPoisonSpread:true }); if(data.burstPoisonStacks>0) s.statusEffects.add(StatusEffects.POISON,target,{ durationMs:2400, intervalMs:650, value:4, stacks:data.burstPoisonStacks, maxStacks:6, sourceId:SOURCE_POISON_KING, canSpread:false }); }); });
  const updater=()=>applyBonuses(); system.passiveUpdaters.push(updater); applyBonuses();
  return ()=>{ off?.(); removeUpdater(system,updater); clearBonuses(); visuals.forEach(destroyVisual); visuals.clear(); };
} };

export const poisonSummonBonusUtils={ sumBonuses, ensureRuntime, MIN_INSECT_INTERVAL_MS, MAX_SINGLE_EXTEND_MS, MAX_EFFECT_REMAINING_MS };
