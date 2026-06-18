import { ARTIFACTS } from '../config/artifacts.js';
import { CombatEvents } from '../core/CombatEvents.js';
export default class ArtifactSystem { constructor(scene){ this.scene=scene; this.unsubs=[]; this.cooldowns=new Map(); } load(){ this.cleanup(); this.scene.playerData.artifacts.forEach(id=>this.register(id)); } add(id){ if(!this.scene.playerData.artifacts.includes(id)) this.scene.playerData.artifacts.push(id); this.register(id); this.scene.hud?.update(); }
  register(id){ const cfg=ARTIFACTS[id]; if(!cfg) return; const off=this.scene.eventBus.on(cfg.listenEvent,(p)=>this.tryTrigger(cfg,p)); this.unsubs.push(off); }
  tryTrigger(cfg,payload){ const now=this.scene.time.now; if(now<(this.cooldowns.get(cfg.id)||0)) return; if(cfg.id==='flame_heart' && !payload.tags?.includes('fire')) return; if(payload.source==='burn') return; this.cooldowns.set(cfg.id, now+cfg.internalCooldownMs); this.scene.eventBus.emit(CombatEvents.ARTIFACT_TRIGGERED,{ artifact:cfg, payload }); if(cfg.id==='thunder_orb'){ const e=this.scene.targeting.random(); if(e) this.scene.combatSystem.damageEnemy(e,18,{ source:'artifact', artifactId:cfg.id, tags:cfg.tags }); }
    if(cfg.id==='blood_jade'){ const heal=6; this.scene.playerData.hp=Math.min(this.scene.playerData.maxHp,this.scene.playerData.hp+heal); this.scene.floatText(this.scene.player.x,this.scene.player.y-96,`+${heal}`,'#ff6f9f'); this.scene.hud?.update(); }
    if(cfg.id==='flame_heart' && payload.enemy) this.applyBurn(payload.enemy); }
  applyBurn(enemy){ if(enemy.burnTick) enemy.burnTick.remove(false); let ticks=3; enemy.burnTick=this.scene.time.addEvent({ delay:500, repeat:2, callback:()=>{ if(!this.scene.targeting.valid(enemy)) return; ticks-=1; this.scene.combatSystem.damageEnemy(enemy,5,{ source:'burn', tags:['burn'], canTriggerArtifacts:false }); if(ticks<=0) enemy.burnTick=null; } }); }
  cleanup(){ this.unsubs.forEach(off=>off()); this.unsubs=[]; this.cooldowns.clear(); }
}
