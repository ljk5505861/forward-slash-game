import { StatusEffects } from '../../systems/StatusEffectSystem.js';
import { TAGS } from '../../config/tags.js';

export const SWORD_MYTHIC = Object.freeze({ NONE:'none', MAIN:'main_sword', TOMB:'sword_tomb' });
export const SWORD_QUALITIES = ['COMMON','RARE','EPIC','MYTHIC'];
export const SOUL_THRESHOLDS = [0,12,36,80];
export const QUALITY_MULTIPLIERS = Object.freeze({
  COMMON:{ damage:1, speed:1, interval:1, bodySize:1, glowSize:1 },
  RARE:{ damage:1.30, speed:1.15, interval:0.88, bodySize:1.15, glowSize:1.20 },
  EPIC:{ damage:1.75, speed:1.35, interval:0.72, bodySize:1.40, glowSize:1.50 },
  MYTHIC:{ damage:2.50, speed:1.70, interval:0.55, bodySize:1.80, glowSize:2.00 },
});
const LV3 = { speed:1.25, interval:0.85 };
const LV6 = { critChance:0.15, critMultiplierBonus:0.5 };
const LV9 = { finalDamage:1.5, bodySize:1.3, glowSize:1.3 };
const BASE_SOUL_VALUE = { normal:1, elite:5, boss:20 };

export function getSwordFlowState(system){
  return system.passiveState.swordFlow ||= { totalSouls:0, effectiveSouls:0, soulBreakdown:{normal:0,elite:0,boss:0}, affinities:{fire:0,poison:0}, mainQuality:'COMMON', mythicOwner:SWORD_MYTHIC.NONE, sheath:null, tomb:null, domain:null };
}
export function hasMainSword(system){ return system.getLevel('sword_wave')>0; }
export function swordTombLevel(system){ return system.getLevel('sword_tomb')||0; }
export function getSwordQualityBySouls(effectiveSouls){ let idx=0; while(idx<SOUL_THRESHOLDS.length-1 && effectiveSouls>=SOUL_THRESHOLDS[idx+1]) idx+=1; return SWORD_QUALITIES[idx]; }
export function addSoulFromEnemy(system, enemy){
  const st=getSwordFlowState(system);
  const kind=enemy?.isBoss?'boss':(enemy?.isElite||enemy?.isMidBoss?'elite':'normal');
  const base=BASE_SOUL_VALUE[kind];
  const purified=swordTombLevel(system)>=6 ? (kind==='normal'?1.25:1.15) : 1;
  st.totalSouls += base;
  st.effectiveSouls += base*purified;
  st.soulBreakdown[kind]=(st.soulBreakdown[kind]||0)+base;
  return base*purified;
}
export function absorbElementalSouls(system, enemy, meta={}){
  const st=getSwordFlowState(system);
  const s=system.scene;
  if(meta.burnStacksBeforeDeath>0 || s.statusEffects?.getStackCount?.(enemy,StatusEffects.BURN)>0) st.affinities.fire += 1;
  if(meta.poisonStacksBeforeDeath>0 || s.statusEffects?.getStackCount?.(enemy,StatusEffects.POISON)>0) st.affinities.poison += 1;
}
export function refreshSwordQuality(system){
  const st=getSwordFlowState(system);
  if(!hasMainSword(system)){ st.mainQuality='COMMON'; return st; }
  let quality=getSwordQualityBySouls(st.effectiveSouls);
  if(quality==='MYTHIC'){
    if(st.mythicOwner===SWORD_MYTHIC.TOMB) quality='EPIC';
    else st.mythicOwner=SWORD_MYTHIC.MAIN;
  }
  st.mainQuality=quality;
  return st;
}
export function tryPromoteSwordTomb(system){
  const st=getSwordFlowState(system);
  if(swordTombLevel(system)<9 || st.effectiveSouls<SOUL_THRESHOLDS[3] || st.mythicOwner===SWORD_MYTHIC.MAIN) return false;
  st.mythicOwner=SWORD_MYTHIC.TOMB;
  refreshSwordQuality(system);
  return true;
}
export function swordLevelBonuses(level){ return { speed:level>=3?LV3.speed:1, interval:level>=3?LV3.interval:1, critChance:level>=6?LV6.critChance:0, critMultiplierBonus:level>=6?LV6.critMultiplierBonus:0, finalDamage:level>=9?LV9.finalDamage:1, bodySize:level>=9?LV9.bodySize:1, glowSize:level>=9?LV9.glowSize:1 }; }
export function mainSwordStats(system, data=system.getData('sword_wave')){
  const st=refreshSwordQuality(system), q=QUALITY_MULTIPLIERS[st.mainQuality]||QUALITY_MULTIPLIERS.COMMON, lv=swordLevelBonuses(system.getLevel('sword_wave'));
  const fireFlat=(st.affinities.fire||0)*(swordTombLevel(system)>=6?2:6);
  const poisonFlat=(st.affinities.poison||0)*(swordTombLevel(system)>=6?2:5);
  return { state:st, quality:st.mainQuality, mythic:st.mythicOwner===SWORD_MYTHIC.MAIN, damage:Math.max(1,Math.round((data?.damage||1)*q.damage*lv.finalDamage+fireFlat+poisonFlat)), speed:q.speed*lv.speed, intervalMs:Math.max(320,Math.round((data?.attackIntervalMs||1200)*q.interval*lv.interval)), bodySize:q.bodySize*lv.bodySize, glowSize:q.glowSize*lv.glowSize, critChance:lv.critChance, critMultiplierBonus:lv.critMultiplierBonus, fireSoul:st.affinities.fire||0, poisonSoul:st.affinities.poison||0 };
}
export function tombStats(system, data=system.getData('sword_tomb')){
  const st=getSwordFlowState(system);
  if(hasMainSword(system)) return { state:st, damage:data?.damage||0, intervalMs:data?.intervalMs||0 };
  return { state:st, damage:Math.round((data?.damage||0)+st.effectiveSouls*1.5+(st.affinities.fire||0)*5+(st.affinities.poison||0)*4), intervalMs:Math.max(620,(data?.intervalMs||0)-st.effectiveSouls*8) };
}
export function sheathInheritedStats(system){
  const st=refreshSwordQuality(system), main=mainSwordStats(system), q=QUALITY_MULTIPLIERS[st.mainQuality]||QUALITY_MULTIPLIERS.COMMON, lv=swordLevelBonuses(system.getLevel('sword_wave'));
  return { damageMultiplier:1+(q.damage-1)*0.6+(lv.finalDamage-1)*0.5, sizeMultiplier:1+(main.bodySize-1)*0.7, glowMultiplier:1+(main.glowSize-1)*0.7, fireSoul:st.affinities.fire||0, poisonSoul:st.affinities.poison||0, hasMain:hasMainSword(system) };
}
export function applyElementalSouls(system, target, stats, sourceId, weakened=false){
  const s=system.scene, level=swordTombLevel(system);
  if(level<6 || !target) return;
  const fire=stats?.fireSoul||0, poison=stats?.poisonSoul||0;
  const scale=weakened?0.55:1;
  if(fire>0) s.statusEffects.add(StatusEffects.BURN,target,{ durationMs:2600, intervalMs:650, value:Math.max(2,Math.round((3+fire)*scale)), stacks:1, maxStacks:5, sourceId:`${sourceId}_fire`, tags:[TAGS.FIRE,TAGS.DOT] });
  if(poison>0) s.statusEffects.add(StatusEffects.POISON,target,{ durationMs:3000, intervalMs:700, value:Math.max(2,Math.round((2+poison)*scale)), stacks:1, maxStacks:15, sourceId:`${sourceId}_poison`, tags:[TAGS.POISON,TAGS.DOT] });
}
export function canMainSwordClaimMythic(system){ return hasMainSword(system) && getSwordFlowState(system).effectiveSouls>=SOUL_THRESHOLDS[3] && getSwordFlowState(system).mythicOwner!==SWORD_MYTHIC.TOMB; }
