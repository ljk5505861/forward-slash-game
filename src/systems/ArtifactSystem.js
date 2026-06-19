import { ARTIFACTS } from '../config/artifacts.js';
import { CombatEvents } from '../core/CombatEvents.js';
import { StatusEffects } from './StatusEffectSystem.js';
export default class ArtifactSystem { constructor(scene){ this.scene=scene; this.unsubs=[]; this.cooldowns=new Map(); this.windHits=0; } load(){ this.cleanup(); this.scene.playerData.artifacts.forEach(id=>this.register(id)); } add(id){ if(!this.scene.playerData.artifacts.includes(id)) this.scene.playerData.artifacts.push(id); this.register(id); this.scene.hud?.update(); }
  register(id){ const cfg=ARTIFACTS[id]; if(!cfg) return; const off=this.scene.eventBus.on(cfg.listenEvent,(p)=>this.tryTrigger(cfg,p)); this.unsubs.push(off); }
  shiftTimers(pausedDuration, pausedAt){ this.cooldowns.forEach((readyAt,id)=>{ if(readyAt>pausedAt) this.cooldowns.set(id, readyAt+pausedDuration); }); }
  tryTrigger(cfg,payload){ const now=this.scene.getGameplayTime(); if(now<(this.cooldowns.get(cfg.id)||0)) return; if(cfg.id==='flame_heart' && (!payload.tags?.includes('fire')||payload.source==='burn')) return; if(cfg.id==='venom_sac' && !payload.tags?.includes('poison')) return; if(cfg.id==='wind_wheel' && payload.skill?.id!=='spinning_blade') return; this.cooldowns.set(cfg.id, now+(cfg.internalCooldownMs||0)); this.scene.eventBus.emit(CombatEvents.ARTIFACT_TRIGGERED,{ artifact:cfg, payload });
    if(cfg.id==='thunder_orb') this.thunder(payload); if(cfg.id==='blood_jade') this.blood(payload); if(cfg.id==='flame_heart'&&payload.enemy) this.burn(payload.enemy); if(cfg.id==='wind_wheel') this.wind(); if(cfg.id==='battle_mark') this.battle(); }
  thunder(payload){ if(payload.source==='artifact') return; const s=this.scene; const lv=s.skillSystem.getLevel('lightning'); const hits=lv>=3?2:1; for(let i=0;i<hits;i++){ const e=s.targeting.random(); if(e) s.combatSystem.damageEnemy(e, lv?28:18, { source:'artifact', artifactId:'thunder_orb', tags:['lightning'] }); } }
  blood(payload){ const s=this.scene; const bonus=payload.enemy?.isBoss?18:payload.enemy?.isElite?12:6; const missing=s.playerData.maxHp-s.playerData.hp; const heal=Math.min(missing,bonus); s.playerData.hp+=heal; const overflow=bonus-heal; if(overflow>0) s.playerData.shield=Math.min(s.playerData.maxShield,s.playerData.shield+overflow); s.floatText(s.player.x,s.player.y-96,heal?`+${heal}`:`盾+${overflow}`,'#ff6f9f'); s.hud?.update(); }
  burn(enemy){ this.scene.statusEffects.add(StatusEffects.BURN,enemy,{ durationMs:1800, intervalMs:500, value:5, sourceId:'flame_heart', maxStacks:3 }); }
  wind(){ if(this.windHits>=4) return; this.windHits+=1; const cd=this.scene.skillSystem.cooldowns.get('spinning_blade'); if(cd) this.scene.skillSystem.cooldowns.set('spinning_blade',Math.max(this.scene.getGameplayTime()+250,cd-180)); }
  battle(){ const p=this.scene.playerData; p.battleMarkStacks=Math.min(5,(p.battleMarkStacks||0)+1); this.scene.hud?.update(); }
  update(){ if(this.scene.isGameplayPaused?.()) return; }
  cleanup(){ this.unsubs.forEach(off=>off()); this.unsubs=[]; this.cooldowns.clear(); this.windHits=0; }
}
