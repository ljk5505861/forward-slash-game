import { ARTIFACTS, getArtifactLevelText } from '../config/artifacts.js';
import { SKILLS } from '../config/skills.js';
import { CombatEvents } from '../core/CombatEvents.js';
import { StatusEffects } from './StatusEffectSystem.js';

const FALLBACK_OPTIONS = [
  { id:'fallback_attack', title:'临时磨炼｜通用成长型\n攻击力 +10%', statBonus:{ attackMultiplier:1.1 } },
  { id:'fallback_hp', title:'生命精粹｜通用成长型\n最大生命 +15；当前生命 +15', instant:{ maxHp:15, heal:15 } },
  { id:'fallback_crit', title:'鹰眼符｜通用成长型\n暴击率 +4%', statBonus:{ critChance:0.04 } },
];

const shuffle = (items) => items.map(v=>({ v, r:Math.random() })).sort((a,b)=>a.r-b.r).map(x=>x.v);

export const artifactIdOf = (entry) => typeof entry === 'string' ? entry : entry?.id;
export const artifactLevelOf = (entry) => typeof entry === 'string' ? 1 : (entry?.level || 1);

export default class ArtifactSystem {
  constructor(scene){ this.scene=scene; this.unsubs=[]; this.cooldowns=new Map(); this.windHits=0; this.appliedLevels=new Map(); this.rejuvenationKills=0; this.heartMirrorKeys=new Set(); }
  load(){ this.cleanup(); this.normalizeArtifacts(); this.scene.playerData.artifacts.forEach(a=>this.register(artifactIdOf(a))); }
  normalizeArtifacts(){ const p=this.scene.playerData; p.artifactLevels=p.artifactLevels||{}; p.artifacts=p.artifacts.map(a=> typeof a==='string' ? { id:a, level:p.artifactLevels[a]||1 } : { id:a.id, level:a.level||p.artifactLevels[a.id]||1 }); p.artifacts.forEach(a=>{ p.artifactLevels[a.id]=a.level; }); }
  has(id){ return this.scene.playerData.artifacts.some(a=>artifactIdOf(a)===id); }
  level(id){ const entry=this.scene.playerData.artifacts.find(a=>artifactIdOf(a)===id); return entry ? artifactLevelOf(entry) : 0; }
  isValid(cfg){ if(!cfg) return false; if(!cfg.requiredSkillId) return true; return this.scene.playerData.skills.some(s=>s.id===cfg.requiredSkillId); }
  rollRewardOptions(count=3){ const ownedIds=new Set(this.scene.playerData.artifacts.map(artifactIdOf)); const fresh=shuffle(Object.values(ARTIFACTS).filter(a=>!ownedIds.has(a.id)&&this.isValid(a))).map(a=>this.optionFor(a.id,'new')); const upgrades=shuffle(this.scene.playerData.artifacts.map(artifactIdOf).filter(id=>this.level(id)<2&&this.isValid(ARTIFACTS[id])).map(id=>this.optionFor(id,'upgrade'))); const picked=[]; const add=(o)=>{ if(o && !picked.some(x=>x.id===o.id)) picked.push(o); };
    fresh.forEach(add); if(picked.length<count) upgrades.forEach(add); if(picked.length<count) shuffle(FALLBACK_OPTIONS).forEach(f=>add({ ...f, type:'fallback' })); return picked.slice(0,count); }
  optionFor(id,type){ const cfg=ARTIFACTS[id]; const lv=this.level(id)||0; const next=type==='upgrade'?lv+1:1; const skill=cfg.requiredSkillId ? SKILLS[cfg.requiredSkillId]?.name || cfg.requiredSkillId : ''; return { id:`${type}_${id}_${next}`, type, artifactId:id, level:lv, nextLevel:next, title:`${cfg.name}\n${getArtifactLevelText(id,next)}`, category:cfg.category, requiredSkillName:skill }; }
  add(id){ if(this.has(id)) return this.upgrade(id); this.normalizeArtifacts(); const p=this.scene.playerData; p.artifacts.push({ id, level:1 }); p.artifactLevels[id]=1; this.applyLevelEffects(id,1,0); this.register(id); this.scene.hud?.update(); }
  upgrade(id){ const entry=this.scene.playerData.artifacts.find(a=>artifactIdOf(a)===id); if(!entry || artifactLevelOf(entry)>=2) return; const old=artifactLevelOf(entry); entry.level=old+1; this.scene.playerData.artifactLevels[id]=entry.level; this.applyLevelEffects(id,entry.level,old); this.scene.hud?.update(); }
  applyFallback(option){ if(option.statBonus) this.applyBonusObject(option.statBonus); if(option.instant) this.applyInstant(option.instant); this.scene.hud?.update(); }
  applyLevelEffects(id, level, oldLevel=0){ const cfg=ARTIFACTS[id]; if(!cfg) return; if(cfg.statBonusByLevel){ const old=cfg.statBonusByLevel[oldLevel]||{}; const next=cfg.statBonusByLevel[level]||{}; this.applyBonusDelta(old,next); }
    if(cfg.instantByLevel?.[level]) this.applyInstant(cfg.instantByLevel[level]); }
  applyBonusDelta(oldBonus,nextBonus){ const p=this.scene.playerData; Object.keys({ ...oldBonus, ...nextBonus }).forEach(key=>{ const old=oldBonus[key]||0; const next=nextBonus[key]||0; if(key==='attackMultiplier'){ const ratio=old ? next/old : next; p.attack=Math.max(1,Math.round(p.attack*ratio)); } else this.applyBonusObject({ [key]:next-old }); }); }
  applyBonusObject(bonus){ const p=this.scene.playerData; Object.entries(bonus).forEach(([key,value])=>{ if(key==='attackMultiplier') p.attack=Math.max(1,Math.round(p.attack*value)); else if(key==='attackSpeedMultiplier') p.attackSpeedMultiplier=Math.min(2.5,(p.attackSpeedMultiplier||1)+value); else p[key]=(p[key]||0)+value; }); }
  applyInstant(e){ const p=this.scene.playerData; if(e.maxHp) p.maxHp+=e.maxHp; if(e.defense) p.defense+=e.defense; if(e.heal) p.hp=Math.min(p.maxHp,p.hp+e.heal); }
  register(id){ const cfg=ARTIFACTS[id]; if(!cfg?.listenEvent) return; const events=[cfg.listenEvent,...(cfg.extraListenEvents||[])]; events.forEach(eventName=>{ const off=this.scene.eventBus.on(eventName,(p)=>this.tryTrigger(cfg,p)); this.unsubs.push(off); }); }
  shiftTimers(pausedDuration, pausedAt){ this.cooldowns.forEach((readyAt,id)=>{ if(readyAt>pausedAt) this.cooldowns.set(id, readyAt+pausedDuration); }); }
  highHpDamageMultiplier(){ if(!this.has('army_breaker_token')) return 1; return this.scene.playerData.hp/this.scene.playerData.maxHp>0.8 ? (this.level('army_breaker_token')>=2?1.25:1.18) : 1; }
  tryTrigger(cfg,payload){ const now=this.scene.getGameplayTime(); if(now<(this.cooldowns.get(cfg.id)||0)) return; if(cfg.id==='flame_heart' && (!payload.tags?.includes('fire')||payload.source==='burn')) return; if(cfg.id==='venom_sac' && !payload.tags?.includes('poison')) return; if(cfg.id==='wind_wheel' && payload.skill?.id!=='spinning_blade') return; this.cooldowns.set(cfg.id, now+(cfg.internalCooldownMs||0)); this.scene.eventBus.emit(CombatEvents.ARTIFACT_TRIGGERED,{ artifact:cfg, payload });
    if(cfg.id==='thunder_orb') this.thunder(payload); if(cfg.id==='blood_jade') this.blood(payload); if(cfg.id==='flame_heart'&&payload.enemy) this.burn(payload.enemy); if(cfg.id==='wind_wheel') this.wind(); if(cfg.id==='battle_mark') this.battle(); if(cfg.id==='rejuvenation_jade') this.rejuvenation(payload); if(cfg.id==='heart_guard_mirror') this.heartMirror(payload); }
  thunder(payload){ if(payload.source==='artifact') return; const s=this.scene; const lv=s.skillSystem.getLevel('lightning'); const hits=lv>=3?2:1; for(let i=0;i<hits;i++){ const e=s.targeting.random(); if(e) s.combatSystem.damageEnemy(e, lv?28:18, { source:'artifact', artifactId:'thunder_orb', tags:['lightning'] }); } }
  blood(payload){ const s=this.scene; const mult=this.level('blood_jade')>=2?{b:24,e:16,n:8}:{b:18,e:12,n:6}; const bonus=payload.enemy?.isBoss?mult.b:payload.enemy?.isElite?mult.e:mult.n; this.healOrShield(bonus,'blood_jade'); }
  healOrShield(amount,id){ const s=this.scene; const missing=s.playerData.maxHp-s.playerData.hp; const heal=Math.min(missing,amount); s.playerData.hp+=heal; if(heal>0) s.eventBus.emit(CombatEvents.PLAYER_HEALED,{ amount:heal, source:'artifact', artifactId:id }); const overflow=amount-heal; if(overflow>0) s.statusEffects?.addPermanentShield(Math.min(8, overflow)); s.floatText(s.player.x,s.player.y-96,heal?`+${heal}`:`盾+${Math.min(8, overflow)}`,'#ff6f9f'); s.hud?.update(); }
  rejuvenation(payload){ this.rejuvenationKills += payload.enemy?.isBoss ? 2 : 1; if(this.rejuvenationKills>=5){ this.rejuvenationKills-=5; this.healOrShield(this.level('rejuvenation_jade')>=2?12:8,'rejuvenation_jade'); } }
  heartMirror(payload){ const key=payload.bossType||payload.encounterId||payload.enemy?.id||'boss'; if(this.heartMirrorKeys.has(key)) return; this.heartMirrorKeys.add(key); const amount=this.level('heart_guard_mirror')>=2?30:20; this.scene.statusEffects?.add(StatusEffects.SHIELD,this.scene.playerData,{ durationMs:600000,value:amount,remainingValue:amount,sourceId:`heart_mirror_${key}` }); this.scene.hud?.update(); }
  burn(enemy){ const value=this.level('flame_heart')>=2?8:5; this.scene.statusEffects.add(StatusEffects.BURN,enemy,{ durationMs:1800, intervalMs:500, value, sourceId:'flame_heart', maxStacks:3 }); }
  wind(){ if(this.windHits>=4) return; this.windHits+=1; const cd=this.scene.skillSystem.cooldowns.get('spinning_blade'); const reduce=this.level('wind_wheel')>=2?260:180; if(cd) this.scene.skillSystem.cooldowns.set('spinning_blade',Math.max(this.scene.getGameplayTime()+250,cd-reduce)); }
  battle(){ const p=this.scene.playerData; const max=this.level('battle_mark')>=2?4:5; p.battleMarkStacks=Math.min(max,(p.battleMarkStacks||0)+1); this.scene.hud?.update(); }
  update(){}
  cleanup(){ this.unsubs.forEach(off=>off()); this.unsubs=[]; this.cooldowns.clear(); this.windHits=0; this.rejuvenationKills=0; this.heartMirrorKeys.clear(); }
}
