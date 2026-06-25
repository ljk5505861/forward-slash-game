import { ARTIFACTS } from '../config/artifacts.js';
import { SKILLS } from '../config/skills.js';
import { CombatEvents } from '../core/CombatEvents.js';
import { StatusEffects } from './StatusEffectSystem.js';
import { TAGS } from '../config/tags.js';
import { REWARD_BIAS } from '../config/rewardBias.js';
import { getBuildBiasContext, calculateBuildBiasWeight, createWeightedCandidates } from '../utils/rewardWeighting.js';
import { mergeTags } from '../utils/tagUtils.js';

const FALLBACK_OPTIONS = [
  { id:'fallback_attack', title:'临时磨炼｜通用成长型\n攻击力 +10%', statBonus:{ attackMultiplier:1.1 } },
  { id:'fallback_hp', title:'生命精粹｜通用成长型\n最大生命 +15；当前生命 +15', instant:{ maxHp:15, heal:15 } },
  { id:'fallback_crit', title:'鹰眼符｜通用成长型\n暴击率 +4%', statBonus:{ critChance:0.04 } },
];

export const artifactIdOf = (entry) => typeof entry === 'string' ? entry : entry?.id;
export const artifactLevelOf = () => 1;

export default class ArtifactSystem {
  constructor(scene){ this.scene=scene; this.unsubs=[]; this.cooldowns=new Map(); this.windHits=0; this.appliedLevels=new Map(); this.rejuvenationKills=0; this.heartMirrorKeys=new Set(); }
  load(){ this.cleanup(); this.normalizeArtifacts(); this.scene.playerData.artifacts.forEach(a=>this.register(artifactIdOf(a))); }
  normalizeArtifacts(){ const p=this.scene.playerData; p.artifactLevels=p.artifactLevels||{}; const seen=new Set(); p.artifacts=(p.artifacts||[]).map(a=>({ id:artifactIdOf(a) })).filter(a=>a.id&&!seen.has(a.id)&&seen.add(a.id)); p.artifacts.forEach(a=>{ if(!p.artifactLevels[a.id]) p.artifactLevels[a.id]=1; }); }
  has(id){ return this.scene.playerData.artifacts.some(a=>artifactIdOf(a)===id); }
  level(id){ return this.has(id) ? 1 : 0; }
  isValid(cfg){ if(!cfg) return false; if(!cfg.requiredSkillId) return true; return this.scene.playerData.skills.some(s=>s.id===cfg.requiredSkillId); }
  rollRewardOptions(count=3){ const p=this.scene.playerData; this.normalizeArtifacts(); const context=getBuildBiasContext({ skills:p.skills, artifacts:p.artifacts, professionId:p.professionId, config:REWARD_BIAS }); const ownedIds=new Set(p.artifacts.map(artifactIdOf)); const toCandidate=(artifact,baseWeight)=>{ const option=this.optionFor(artifact.id); const tags=mergeTags(artifact.tags, artifact.supportedTags, artifact.affectedTags, artifact.synergyTags); const bias=calculateBuildBiasWeight({ baseWeight, tags, context }); return { ...option, tags, baseWeight, ...bias }; };
    const freshCandidates=Object.values(ARTIFACTS).filter(a=>!ownedIds.has(a.id)&&this.isValid(a)).map(a=>toCandidate(a,1)); const picked=createWeightedCandidates(freshCandidates,{count,uniqueKey:o=>o.artifactId||o.id}); if(picked.length<count) createWeightedCandidates(FALLBACK_OPTIONS.map(f=>({ ...f, type:'fallback', baseWeight:1, weight:1, tags:[] })),{count:count-picked.length,uniqueKey:o=>o.id}).forEach(o=>{ if(!picked.some(x=>x.id===o.id)) picked.push(o); }); if(this.scene.debugMode) this.scene.lastRewardBiasDebug={ kind:'artifact', enabled:context.enabled, dominantTags:context.dominantTags, candidates:freshCandidates.map(c=>({ id:c.id, title:c.title, tags:c.tags, weight:Number(c.weight.toFixed(3)), baseWeight:c.baseWeight, matchedBuildTags:c.matchedBuildTags, matchedProfessionTags:c.matchedProfessionTags })), picked:picked.map(o=>o.id) }; return picked.slice(0,count); }
  optionFor(id){ const cfg=ARTIFACTS[id]; const skill=cfg.requiredSkillId ? SKILLS[cfg.requiredSkillId]?.name || cfg.requiredSkillId : ''; return { id:`artifact_${id}`, type:'new', artifactId:id, title:cfg.name, category:cfg.category, requiredSkillName:skill }; }
  add(id){ if(this.has(id)) return false; this.normalizeArtifacts(); const p=this.scene.playerData; p.artifacts.push({ id }); p.artifactLevels[id]=1; this.applyLevelEffects(id,1,0); this.register(id); this.scene.hud?.update(); return true; }
  upgrade(){ return false; }
  applyFallback(option){ if(option.statBonus) this.applyBonusObject(option.statBonus); if(option.instant) this.applyInstant(option.instant); this.scene.hud?.update(); }
  applyLevelEffects(id, level, oldLevel=0){ const cfg=ARTIFACTS[id]; if(!cfg) return; if(cfg.statBonusByLevel){ const old=cfg.statBonusByLevel[oldLevel]||{}; const next=cfg.statBonusByLevel[level]||{}; this.applyBonusDelta(old,next); }
    if(cfg.instantByLevel?.[level]) this.applyInstant(cfg.instantByLevel[level]); }
  applyBonusDelta(oldBonus,nextBonus){ const p=this.scene.playerData; Object.keys({ ...oldBonus, ...nextBonus }).forEach(key=>{ const old=oldBonus[key]||0; const next=nextBonus[key]||0; if(key==='attackMultiplier'){ const ratio=old ? next/old : next; p.attack=Math.max(1,Math.round(p.attack*ratio)); } else this.applyBonusObject({ [key]:next-old }); }); }
  applyBonusObject(bonus){ const p=this.scene.playerData; Object.entries(bonus).forEach(([key,value])=>{ if(key==='attackMultiplier') p.attack=Math.max(1,Math.round(p.attack*value)); else if(key==='attackSpeedMultiplier') p.attackSpeedMultiplier=Math.min(2.5,(p.attackSpeedMultiplier||1)+value); else p[key]=(p[key]||0)+value; }); }
  applyInstant(e){ const p=this.scene.playerData; if(e.maxHp) p.maxHp+=e.maxHp; if(e.defense) p.defense+=e.defense; if(e.heal) p.hp=Math.min(p.maxHp,p.hp+e.heal); }
  eventNamesFor(id,cfg){
    if(id==='flame_heart') return [CombatEvents.STATUS_STACK_CHANGED];
    if(id==='venom_sac') return [CombatEvents.STATUS_APPLIED];
    if(id==='wind_wheel') return [CombatEvents.PLAYER_HEAVY_HIT];
    if(id==='battle_mark') return [CombatEvents.PLAYER_HIT,CombatEvents.SWORD_ATTACKED];
    return [cfg.listenEvent,...(cfg.extraListenEvents||[])].filter(Boolean);
  }
  register(id){ const cfg=ARTIFACTS[id]; if(!cfg) return; this.eventNamesFor(id,cfg).forEach(eventName=>{ const off=this.scene.eventBus.on(eventName,(p)=>this.tryTrigger(cfg,p)); this.unsubs.push(off); }); }
  shiftTimers(pausedDuration, pausedAt){ this.cooldowns.forEach((readyAt,id)=>{ if(readyAt>pausedAt) this.cooldowns.set(id, readyAt+pausedDuration); }); }
  highHpDamageMultiplier(){ if(!this.has('army_breaker_token')) return 1; return this.scene.playerData.hp/this.scene.playerData.maxHp>0.8 ? 1.18 : 1; }
  tryTrigger(cfg,payload){
    const now=this.scene.getGameplayTime();
    if(now<(this.cooldowns.get(cfg.id)||0)) return;
    if(cfg.id==='flame_heart' && (payload.type!==StatusEffects.BURN || (payload.stacks||0)<8)) return;
    if(cfg.id==='venom_sac' && payload.type!==StatusEffects.POISON) return;
    if(cfg.id==='wind_wheel' && !payload.heavyHit && !payload.enemy) return;
    this.cooldowns.set(cfg.id, now+(cfg.internalCooldownMs||0));
    this.scene.eventBus.emit(CombatEvents.ARTIFACT_TRIGGERED,{ artifact:cfg, payload });
    if(cfg.id==='thunder_orb') this.thunder(payload);
    if(cfg.id==='blood_jade') this.blood(payload);
    if(cfg.id==='flame_heart') this.flameBurst(payload);
    if(cfg.id==='venom_sac') this.venom(payload);
    if(cfg.id==='wind_wheel') this.wind(payload);
    if(cfg.id==='battle_mark') this.battle(payload);
    if(cfg.id==='rejuvenation_jade') this.rejuvenation(payload);
    if(cfg.id==='heart_guard_mirror') this.heartMirror(payload);
  }
  thunder(payload){ if(payload.source==='artifact') return; const s=this.scene; const lv=s.skillSystem.getLevel('lightning'); const hits=lv>=3?2:1; for(let i=0;i<hits;i++){ const e=s.targeting.random(); if(e) s.combatSystem.damageEnemy(e, lv?28:18, { source:'artifact', artifactId:'thunder_orb', tags:[TAGS.LIGHTNING] }); } }
  blood(payload){ const s=this.scene; const mult={b:18,e:12,n:6}; const bonus=payload.enemy?.isBoss?mult.b:payload.enemy?.isElite?mult.e:mult.n; this.healOrShield(bonus,'blood_jade'); }
  healOrShield(amount,id){ const s=this.scene; const value=Math.max(0,Math.floor(Number(amount)||0)); if(value<=0) return; const missingBefore=Math.max(0,s.playerData.maxHp-s.playerData.hp); const intendedHeal=Math.min(value,missingBefore); const overflow=Math.max(0,value-intendedHeal); const heal=s.healPlayer?.(intendedHeal,'artifact',{artifactId:id})||0; const shield=overflow>0?Math.min(8,overflow):0; if(shield>0) s.statusEffects?.addPermanentShield(shield); if(heal>0||shield>0) s.floatText(s.player.x,s.player.y-96,heal?`+${heal}`:`盾+${shield}`,'#ff6f9f'); s.hud?.update(); }
  rejuvenation(payload){ this.rejuvenationKills += payload.enemy?.isBoss ? 2 : 1; if(this.rejuvenationKills>=5){ this.rejuvenationKills-=5; this.healOrShield(8,'rejuvenation_jade'); } }
  heartMirror(payload){ const key=payload.bossType||payload.encounterId||payload.enemy?.id||'boss'; if(this.heartMirrorKeys.has(key)) return; this.heartMirrorKeys.add(key); const amount=20; this.scene.statusEffects?.add(StatusEffects.SHIELD,this.scene.playerData,{ durationMs:600000,value:amount,remainingValue:amount,sourceId:`heart_mirror_${key}` }); this.scene.hud?.update(); }
  flameBurst(payload){ const s=this.scene; const target=payload.target; if(!s.targeting.valid(target)) return; const consumed=s.statusEffects.consumeStacks(target,StatusEffects.BURN,4); if(consumed<=0) return; const damage=18+consumed*5; s.combatSystem.damageEnemy(target,damage,{ source:'artifact', artifactId:'flame_heart', tags:[TAGS.FIRE,TAGS.DOT], noDeathExplosion:true }); s.targeting.all().filter(e=>e!==target&&Math.hypot(e.x-target.x,e.y-target.y)<=90).forEach(e=>s.combatSystem.damageEnemy(e,Math.round(damage*0.55),{ source:'artifact', artifactId:'flame_heart', tags:[TAGS.FIRE], noDeathExplosion:true })); s.floatText(target.x,target.y-95,'燃爆','#ff9a4d'); }
  venom(payload){ const effect=payload.effect; if(!effect||effect.type!==StatusEffects.POISON) return; effect.expiresAt+=1200; effect.maxStacks=(effect.maxStacks||15)+3; effect.stacks=Math.min(effect.maxStacks,(effect.stacks||1)+1); }
  wind(payload){ const s=this.scene; const target=payload.enemy; if(!s.targeting.valid(target)) return; const damage=Math.max(1,Math.round((payload.damage||0)*0.35)); s.targeting.all().filter(e=>e!==target&&Math.hypot(e.x-target.x,e.y-target.y)<=110).forEach(e=>s.combatSystem.damageEnemy(e,damage,{source:'artifact',artifactId:'wind_wheel',tags:['physical',TAGS.HEAVY_HIT],allowLifeSteal:false})); s.floatText(target.x,target.y-100,'震荡','#ffd37a'); }
  battle(payload){ const s=this.scene; const p=s.playerData; const max=5; const isSword=!!payload.sword; const target=payload.enemy||payload.target; const next=Math.min(max,(p.battleMarkStacks||0)+1); if((payload.heavyHit||isSword)&&next>=max&&s.targeting.valid(target)){ const ratio=payload.heavyHit?0.45:0.3; const base=Math.max(12,Math.round((payload.damage||40)*ratio)); p.battleMarkStacks=0; s.combatSystem.damageEnemy(target,base,{source:'artifact',artifactId:'battle_mark',tags:['physical'],allowLifeSteal:false}); s.floatText(target.x,target.y-115,'战意爆发','#ffd866'); } else p.battleMarkStacks=next; s.hud?.update(); }
  update(){}
  cleanup(){ this.unsubs.forEach(off=>off()); this.unsubs=[]; this.cooldowns.clear(); this.windHits=0; this.rejuvenationKills=0; this.heartMirrorKeys.clear(); }
}
