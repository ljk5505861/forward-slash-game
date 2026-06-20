import { DESIGN_WIDTH } from '../config/gameConfig.js';

export default class TargetingSystem {
  constructor(scene){ this.scene=scene; }
  valid(e){ return !!(e?.active && !e.isDefeated && e.hp > 0); }
  isEnemyInCombatViewport(enemy, padding=60){ if(!this.valid(enemy)) return false; const cam=this.scene.cameras?.main; const left=cam?.scrollX ?? 0; const width=cam?.width ?? DESIGN_WIDTH; return enemy.x >= left - padding && enemy.x <= left + width + padding; }
  all({ includeOffscreen=false }={}){ return this.scene.enemies.filter((e)=>this.valid(e) && (includeOffscreen || this.isEnemyInCombatViewport(e))); }
  nearestAhead(range=Infinity){ const px=this.scene.player.x; return this.all().filter(e=>e.x >= px - 20 && e.x - px <= range).sort((a,b)=>a.x-b.x)[0] || null; }
  random(){ const a=this.all(); return a.length ? a[Math.floor(Math.random()*a.length)] : null; }
  aroundPlayer(radius){ return this.all().filter(e=>Math.abs(e.x-this.scene.player.x)<=radius); }
}
